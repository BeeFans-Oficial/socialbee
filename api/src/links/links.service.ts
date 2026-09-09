import { randomInt } from "node:crypto";

import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, Repository, type EntityManager } from "typeorm";

import { checkDestination, destinationErrorMessage } from "../common/url";
import { LinkCounter } from "../tracking/entities/link-counter.entity";
import type { ResolvedLink } from "../tracking/types";
import { DEFAULT_LINK_APPEARANCE, Link, type LinkAppearance } from "./entities/link.entity";
import { SafePage } from "./entities/safe-page.entity";
import { SafePageSocialLink } from "./entities/safe-page-social-link.entity";
import type { CreateLinkDto } from "./dto/create-link.dto";
import type { ReorderLinksDto } from "./dto/reorder-links.dto";
import type { UpdateLinkDto } from "./dto/update-link.dto";

/** Link como o DONO dele vê. Inclui o destino e os números — o oposto de
 *  `PublicLinkView`, que omite os dois. */
export interface OwnLinkView {
  id: string;
  title: string;
  subtitle: string | null;
  thumbnailUrl: string | null;
  platform: string;
  shortCode: string;
  destinationUrl: string;
  isActive: boolean;
  position: number;
  cloakEnabled: boolean;
  appearance: LinkAppearance;
  /** Total histórico do contador desnormalizado, não a contagem da janela do
   *  relatório. Sobrevive à expiração do evento cru. */
  clicks: number;
  botHits: number;
  lastClickAt: string | null;
  safePage: {
    id: string;
    createdAt: string;
    socialLinks: Array<{ platform: string; url: string; title: string }>;
  } | null;
  createdAt: string;
}

/** Alfabeto e tamanho iguais aos de `generateShortCode` em `lib/utils.ts`, para
 *  os códigos gerados antes e depois da API terem a mesma cara. */
const CODE_ALPHABET = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const CODE_LENGTH = 6;

@Injectable()
export class LinksService {
  constructor(
    @InjectRepository(Link) private readonly links: Repository<Link>,
    @InjectRepository(LinkCounter) private readonly counters: Repository<LinkCounter>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Busca escopada por perfil.
   *
   * O `profileId` faz parte do `where`, não de uma conferência depois da
   * consulta. É a diferença entre "não encontrei" e "encontrei e decidi não
   * mostrar" — a segunda forma vaza a existência do recurso pelo tempo de
   * resposta e por qualquer log que registre o achado.
   */
  async findOwned(profileId: string, linkId: string): Promise<Link> {
    const link = await this.links.findOne({
      where: { id: linkId, profileId },
      relations: { safePage: { socialLinks: true } },
    });
    if (!link) throw new NotFoundException("Link não encontrado.");
    return link;
  }

  async list(profileId: string): Promise<OwnLinkView[]> {
    const [links, counters] = await Promise.all([
      this.links.find({
        where: { profileId },
        relations: { safePage: { socialLinks: true } },
        order: { position: "ASC", createdAt: "ASC" },
      }),
      this.counters.find({ where: { profileId } }),
    ]);

    const byLink = new Map(counters.map((counter) => [counter.linkId, counter]));
    return links.map((link) => toOwnLinkView(link, byLink.get(link.id)));
  }

  async show(profileId: string, linkId: string): Promise<OwnLinkView> {
    const link = await this.findOwned(profileId, linkId);
    const counter = await this.counters.findOne({ where: { profileId, linkId } });
    return toOwnLinkView(link, counter ?? undefined);
  }

  async create(profileId: string, dto: CreateLinkDto): Promise<OwnLinkView> {
    const destination = this.validateDestination(dto.destinationUrl);

    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(Link);

      // Link novo entra no topo, como o `handleSaveLink` do MVP já fazia — é o
      // que a criadora acabou de criar e o que ela quer ver primeiro. Os
      // demais descem uma posição.
      const position = dto.position ?? 0;
      await manager
        .createQueryBuilder()
        .update(Link)
        .set({ position: () => `"position" + 1` })
        .where("profile_id = :profileId AND position >= :position", { profileId, position })
        .execute();

      const link = await repo.save(
        repo.create({
          profileId,
          title: dto.title,
          subtitle: dto.subtitle ?? null,
          thumbnailUrl: dto.thumbnailUrl ?? null,
          platform: dto.platform ?? "custom",
          shortCode: await this.uniqueShortCode(manager),
          destinationUrl: destination.toString(),
          isActive: dto.isActive ?? true,
          position,
          cloakEnabled: dto.cloakEnabled ?? false,
          appearance: { ...DEFAULT_LINK_APPEARANCE, ...(dto.appearance ?? {}) },
        }),
      );

      if (dto.safePage) {
        await this.replaceSafePage(manager, link.id, dto.safePage.socialLinks);
      }

      return toOwnLinkView(await this.reload(manager, link.id));
    });
  }

  async update(profileId: string, linkId: string, dto: UpdateLinkDto): Promise<OwnLinkView> {
    const existing = await this.findOwned(profileId, linkId);

    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(Link);
      const link = await repo.findOneOrFail({ where: { id: existing.id } });

      if (dto.title !== undefined) link.title = dto.title;
      if (dto.subtitle !== undefined) link.subtitle = dto.subtitle ?? null;
      if (dto.thumbnailUrl !== undefined) link.thumbnailUrl = dto.thumbnailUrl ?? null;
      if (dto.platform !== undefined) link.platform = dto.platform;
      if (dto.destinationUrl !== undefined) {
        link.destinationUrl = this.validateDestination(dto.destinationUrl).toString();
      }
      if (dto.isActive !== undefined) link.isActive = dto.isActive;
      if (dto.cloakEnabled !== undefined) link.cloakEnabled = dto.cloakEnabled;
      if (dto.appearance !== undefined) {
        // Mescla com o default e não com o valor atual: a tela de aparência
        // manda o objeto inteiro, e mesclar com o atual deixaria um campo
        // desligado (glow, por exemplo) ligado para sempre.
        link.appearance = { ...DEFAULT_LINK_APPEARANCE, ...dto.appearance };
      }
      if (dto.position !== undefined) link.position = dto.position;

      await repo.save(link);

      if (dto.safePage !== undefined) {
        await manager.getRepository(SafePage).delete({ linkId: link.id });
        if (dto.safePage) {
          await this.replaceSafePage(manager, link.id, dto.safePage.socialLinks);
        }
      }

      return toOwnLinkView(await this.reload(manager, link.id));
    });
  }

  /**
   * Remoção.
   *
   * Apaga a linha. O contador vai com ela (`ON DELETE CASCADE`) e os eventos
   * ficam com `link_id` nulo (`ON DELETE SET NULL`), então o total de cliques
   * do período não cai — só a quebra por link perde aquela linha. As posições
   * dos que sobram são renumeradas na mesma transação, para não ficar buraco
   * na sequência.
   */
  async remove(profileId: string, linkId: string): Promise<void> {
    const link = await this.findOwned(profileId, linkId);

    await this.dataSource.transaction(async (manager) => {
      await manager.getRepository(Link).delete({ id: link.id, profileId });
      await this.renumber(manager, profileId);
    });
  }

  /**
   * Reordenação.
   *
   * Uma transação, e a lista precisa ser exatamente o conjunto de links do
   * perfil. Aceitar uma lista parcial faria os ausentes ficarem com a posição
   * antiga e colidir com as novas — duas linhas na mesma posição é ordem
   * indefinida na página pública, o tipo de bug que aparece só no celular de
   * uma pessoa.
   */
  async reorder(profileId: string, dto: ReorderLinksDto): Promise<OwnLinkView[]> {
    const owned = await this.links.find({ where: { profileId }, select: { id: true } });
    const ownedIds = new Set(owned.map((link) => link.id));

    const unknown = dto.ids.filter((id) => !ownedIds.has(id));
    if (unknown.length > 0) {
      throw new NotFoundException("Um dos links da nova ordem não existe.");
    }
    if (dto.ids.length !== ownedIds.size) {
      throw new BadRequestException({
        code: "incomplete_order",
        message: "A nova ordem precisa incluir todos os links do perfil.",
      });
    }

    await this.dataSource.transaction(async (manager) => {
      // Um UPDATE por link, na mesma transação. Poderia ser um CASE único, mas
      // a lista tem dezenas de itens no pior caso e a clareza vale mais aqui.
      for (const [position, id] of dto.ids.entries()) {
        await manager.getRepository(Link).update({ id, profileId }, { position });
      }
    });

    return this.list(profileId);
  }

  /**
   * Código curto → link, para o redirecionador.
   *
   * É a implementação real do `LinkResolver` que o MVP tinha lendo
   * `mock-data.ts`. O índice único em `short_code` é o que o comentário do
   * resolver antigo prometia que o banco faria.
   */
  async resolveByShortCode(shortCode: string): Promise<ResolvedLink | null> {
    const link = await this.links.findOne({
      where: { shortCode },
      select: {
        id: true,
        profileId: true,
        platform: true,
        destinationUrl: true,
        isActive: true,
      },
    });
    if (!link) return null;

    return {
      linkId: link.id,
      profileId: link.profileId,
      channel: link.platform,
      destinationUrl: link.destinationUrl,
      isActive: link.isActive,
    };
  }

  private validateDestination(rawUrl: string): URL {
    const result = checkDestination(rawUrl);
    if (!result.url) {
      throw new BadRequestException({
        code: "invalid_destination",
        message: destinationErrorMessage(result.reason),
      });
    }
    return result.url;
  }

  /**
   * Código curto único.
   *
   * Sorteia e confere. Com 62^6 combinações (~57 bilhões) a colisão é remota,
   * mas "remota" não é "impossível" — e o índice único no banco recusaria o
   * insert, derrubando a criação de link com erro que a criadora não entende.
   * Cinco tentativas cobrem qualquer volume que este produto vá ter.
   */
  private async uniqueShortCode(manager: EntityManager): Promise<string> {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const code = randomShortCode();
      const taken = await manager.getRepository(Link).exists({ where: { shortCode: code } });
      if (!taken) return code;
    }
    throw new BadRequestException({
      code: "short_code_exhausted",
      message: "Não foi possível gerar o endereço do link. Tente novamente.",
    });
  }

  private async replaceSafePage(
    manager: EntityManager,
    linkId: string,
    socialLinks: Array<{ platform: string; url: string; title: string }>,
  ): Promise<void> {
    const page = await manager.getRepository(SafePage).save(
      manager.getRepository(SafePage).create({ linkId }),
    );

    if (socialLinks.length === 0) return;

    await manager.getRepository(SafePageSocialLink).save(
      socialLinks.map((social, position) =>
        manager.getRepository(SafePageSocialLink).create({
          safePageId: page.id,
          platform: social.platform,
          url: social.url,
          title: social.title,
          position,
        }),
      ),
    );
  }

  /** Renumera 0..n-1 mantendo a ordem atual. Chamado depois de remover. */
  private async renumber(manager: EntityManager, profileId: string): Promise<void> {
    const links = await manager.getRepository(Link).find({
      where: { profileId },
      select: { id: true },
      order: { position: "ASC", createdAt: "ASC" },
    });
    for (const [position, link] of links.entries()) {
      await manager.getRepository(Link).update({ id: link.id }, { position });
    }
  }

  private async reload(manager: EntityManager, linkId: string): Promise<Link> {
    return manager.getRepository(Link).findOneOrFail({
      where: { id: linkId },
      relations: { safePage: { socialLinks: true } },
    });
  }
}

function randomShortCode(): string {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i += 1) {
    // `randomInt` do node:crypto, não `Math.random()`: o código curto é o
    // endereço público do link e não deve ser previsível a partir de outro.
    code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  }
  return code;
}

export function toOwnLinkView(link: Link, counter?: LinkCounter): OwnLinkView {
  return {
    id: link.id,
    title: link.title,
    subtitle: link.subtitle,
    thumbnailUrl: link.thumbnailUrl,
    platform: link.platform,
    shortCode: link.shortCode,
    destinationUrl: link.destinationUrl,
    isActive: link.isActive,
    position: link.position,
    cloakEnabled: link.cloakEnabled,
    appearance: { ...DEFAULT_LINK_APPEARANCE, ...(link.appearance ?? {}) },
    clicks: counter?.clicks ?? 0,
    botHits: counter?.botHits ?? 0,
    lastClickAt: counter?.lastClickAt ? counter.lastClickAt.toISOString() : null,
    safePage: link.safePage
      ? {
          id: link.safePage.id,
          createdAt: link.safePage.createdAt.toISOString(),
          socialLinks: [...(link.safePage.socialLinks ?? [])]
            .sort((a, b) => a.position - b.position)
            .map((social) => ({
              platform: social.platform,
              url: social.url,
              title: social.title,
            })),
        }
      : null,
    createdAt: link.createdAt.toISOString(),
  };
}
