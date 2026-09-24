import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Not, Repository } from "typeorm";

import { Link } from "../links/entities/link.entity";
import { Profile } from "./entities/profile.entity";
import { isReservedSlug } from "./reserved-slugs";
import type { CreateProfileDto } from "./dto/create-profile.dto";
import type { UpdateProfileDto } from "./dto/update-profile.dto";

/** Perfil como o dono dele vê (dashboard). */
/** A página de chegada (IAB) como o dono do perfil a edita. */
export interface IabLandingView {
  enabled: boolean;
  /** Data URL para o dono; rota de imagem na visão pública. */
  imageUrl: string | null;
  /** `null` cai no `displayName` na renderização. */
  headline: string | null;
  buttonLabel: string | null;
}

/** Layout e ajustes finos da página pública — o que o editor controla. */
export interface TemplateView {
  templateId: string;
  /** Exceções por cima do preset de `themeId`. Nulas, vale o preset. */
  bgColor: string | null;
  accentColor: string | null;
  fontId: string | null;
  /** Enquadramento da imagem de fundo, em porcentagem, e o escurecimento. */
  coverPosX: number;
  coverPosY: number;
  coverOverlay: number;
}

export interface OwnProfileView {
  id: string;
  slug: string;
  displayName: string;
  bio: string;
  avatarUrl: string | null;
  coverUrl: string | null;
  themeId: string;
  buttonStyle: string;
  isAdult: boolean;
  published: boolean;
  joinedAt: string;
  template: TemplateView;
  iab: IabLandingView;
}

/** Link como o VISITANTE o recebe.
 *
 *  `destinationUrl` está ausente de propósito, e isso é o ponto: o produto é o
 *  redirecionador. Se o destino viesse no JSON da página pública, ele estaria
 *  no HTML entregue ao visitante — e aí o link do OnlyFans é lido direto pelo
 *  robô da rede social, que é exatamente o que o cloaking existe para evitar.
 *  O visitante recebe o código curto; o destino só existe no servidor. */
export interface PublicLinkView {
  id: string;
  title: string;
  subtitle: string | null;
  thumbnailUrl: string | null;
  platform: string;
  shortCode: string;
  position: number;
  cloakEnabled: boolean;
  appearance: Link["appearance"];
}

export interface PublicProfileView {
  profile: Omit<OwnProfileView, "id"> & { id: string };
  links: PublicLinkView[];
}

@Injectable()
export class ProfilesService {
  constructor(
    @InjectRepository(Profile) private readonly profiles: Repository<Profile>,
    @InjectRepository(Link) private readonly links: Repository<Link>,
  ) {}

  /**
   * O slug está livre?
   *
   * Três motivos para indisponibilidade, e todos precisam da mesma resposta
   * para o visitante do formulário: já é de alguém, é rota do app, ou é reserva
   * de produto. Distinguir "reservado" de "em uso" contaria quem existe.
   */
  async isSlugAvailable(slug: string, exceptProfileId?: string): Promise<boolean> {
    const normalized = slug.trim().toLowerCase();
    if (!/^[a-z0-9-]{3,30}$/.test(normalized)) return false;
    if (isReservedSlug(normalized)) return false;

    const taken = await this.profiles.exists({
      where: exceptProfileId
        ? { slug: normalized, id: Not(exceptProfileId) }
        : { slug: normalized },
    });
    return !taken;
  }

  async assertSlugAvailable(slug: string, exceptProfileId?: string): Promise<void> {
    if (!(await this.isSlugAvailable(slug, exceptProfileId))) {
      throw new ConflictException({
        code: "slug_unavailable",
        message: "Esse link já está em uso. Escolha outro.",
      });
    }
  }

  /** A página por id. Lança 404 quando não existe — quem chama já passou pelo
   *  guard, então "não existe" aqui é id inválido, não falta de permissão. */
  async findById(profileId: string): Promise<Profile> {
    const profile = await this.profiles.findOne({ where: { id: profileId } });
    if (!profile) throw new NotFoundException("Página não encontrada.");
    return profile;
  }

  async findByUserId(userId: string): Promise<Profile> {
    const profile = await this.profiles.findOne({ where: { userId } });
    if (!profile) throw new NotFoundException("Perfil não encontrado.");
    return profile;
  }

  /**
   * As páginas da conta, da mais antiga para a mais nova.
   *
   * Ordem por criação e não alfabética: a primeira da lista é a página
   * original da criadora, que é a que ela reconhece como "a minha".
   */
  async listByUser(userId: string): Promise<OwnProfileView[]> {
    const perfis = await this.profiles.find({
      where: { userId },
      order: { createdAt: "ASC" },
    });
    return perfis.map(toOwnProfileView);
  }

  /**
   * Uma página nova para a conta.
   *
   * Herda `isAdult` da página mais antiga quando o DTO não diz: quem tem uma
   * página adulta quase sempre quer outra adulta, e o valor errado aqui não
   * gera erro nenhum — só deixa conteúdo +18 sem barreira.
   */
  async createForUser(userId: string, dto: CreateProfileDto): Promise<OwnProfileView> {
    await this.assertSlugAvailable(dto.slug);

    const primeira = await this.profiles.findOne({
      where: { userId },
      order: { createdAt: "ASC" },
    });

    const criado = await this.profiles.save(
      this.profiles.create({
        userId,
        slug: dto.slug,
        displayName: dto.displayName,
        bio: "",
        templateId: dto.templateId ?? "classico",
        isAdult: dto.isAdult ?? primeira?.isAdult ?? false,
      }),
    );

    return toOwnProfileView(criado);
  }

  /**
   * Apaga uma página, para sempre.
   *
   * Leva junto os links, os contadores e os eventos de clique — as três tabelas
   * têm `ON DELETE CASCADE` no perfil. Não há como desfazer, e o histórico
   * apagado é o número que a criadora usa para negociar valor com marcas.
   *
   * Duas travas, e nenhuma é decorativa:
   *
   * **A página tem que ser dela.** Verificado aqui e não só no guard — este
   * método pode ser chamado de um script ou de um módulo futuro que não passa
   * por HTTP.
   *
   * **A última página não se apaga.** Uma conta sem página é um estado que o
   * resto do sistema não sabe tratar: o token carrega um `pid` que deixaria de
   * existir, o painel não teria o que editar e `/auth/me` quebraria. Quem quer
   * sumir do ar tira a página do ar (`published = false`), que é reversível e
   * preserva tudo.
   */
  async deleteForUser(userId: string, profileId: string): Promise<void> {
    const profile = await this.profiles.findOne({ where: { id: profileId, userId } });
    if (!profile) throw new NotFoundException("Página não encontrada.");

    const total = await this.profiles.count({ where: { userId } });
    if (total <= 1) {
      throw new ConflictException({
        code: "ultima_pagina",
        message:
          "Esta é sua única página e não pode ser apagada. Para sumir do ar, tire-a do ar — assim nada é perdido.",
      });
    }

    await this.profiles.delete({ id: profileId, userId });
  }

  /**
   * A página pertence à conta?
   *
   * É o que sustenta o cabeçalho `x-profile-id` ser aceitável: o cliente diz
   * QUAL página está editando, e o servidor confere se ela é dele. Sem esta
   * verificação, o cabeçalho seria um jeito de editar a página de qualquer
   * criadora — basta trocar um id.
   */
  async belongsToUser(userId: string, profileId: string): Promise<boolean> {
    return this.profiles.exists({ where: { id: profileId, userId } });
  }

  async ownProfile(profileId: string): Promise<OwnProfileView> {
    const profile = await this.profiles.findOne({ where: { id: profileId } });
    if (!profile) throw new NotFoundException("Perfil não encontrado.");
    return toOwnProfileView(profile);
  }

  async update(profileId: string, dto: UpdateProfileDto): Promise<OwnProfileView> {
    const profile = await this.profiles.findOne({ where: { id: profileId } });
    if (!profile) throw new NotFoundException("Perfil não encontrado.");

    // Só valida o slug quando ele realmente muda: revalidar o próprio slug a
    // cada salvamento de bio devolveria "já está em uso" para o dono dele.
    if (dto.slug !== undefined && dto.slug !== profile.slug) {
      await this.assertSlugAvailable(dto.slug, profileId);
      profile.slug = dto.slug;
    }

    if (dto.displayName !== undefined) profile.displayName = dto.displayName;
    if (dto.bio !== undefined) profile.bio = dto.bio;
    if (dto.avatarUrl !== undefined) profile.avatarUrl = dto.avatarUrl;
    if (dto.coverUrl !== undefined) profile.coverUrl = dto.coverUrl;
    if (dto.themeId !== undefined) profile.themeId = dto.themeId;
    if (dto.buttonStyle !== undefined) profile.buttonStyle = dto.buttonStyle;
    if (dto.isAdult !== undefined) profile.isAdult = dto.isAdult;
    if (dto.published !== undefined) profile.published = dto.published;
    if (dto.templateId !== undefined) profile.templateId = dto.templateId;
    if (dto.bgColor !== undefined) profile.bgColor = dto.bgColor;
    if (dto.accentColor !== undefined) profile.accentColor = dto.accentColor;
    if (dto.fontId !== undefined) profile.fontId = dto.fontId;
    if (dto.coverPosX !== undefined) profile.coverPosX = dto.coverPosX;
    if (dto.coverPosY !== undefined) profile.coverPosY = dto.coverPosY;
    if (dto.coverOverlay !== undefined) profile.coverOverlay = dto.coverOverlay;
    if (dto.iabEnabled !== undefined) profile.iabEnabled = dto.iabEnabled;
    if (dto.iabImageUrl !== undefined) profile.iabImageUrl = dto.iabImageUrl;
    if (dto.iabHeadline !== undefined) profile.iabHeadline = dto.iabHeadline;
    if (dto.iabButtonLabel !== undefined) profile.iabButtonLabel = dto.iabButtonLabel;

    await this.profiles.save(profile);
    return toOwnProfileView(profile);
  }

  /**
   * Slug público → id do perfil.
   *
   * Existe para o registro de visualização nunca aceitar `profileId` vindo do
   * cliente: o navegador manda o slug (que é público), o servidor traduz. Sem
   * isso, qualquer um posta views no perfil de qualquer criadora.
   */
  async profileIdBySlug(slug: string): Promise<string | null> {
    const profile = await this.profiles.findOne({
      where: { slug: slug.trim().toLowerCase() },
      select: { id: true },
    });
    return profile?.id ?? null;
  }

  /**
   * Bytes da imagem de fundo do template. Mesma mecânica do avatar.
   */
  async coverBytes(
    slug: string,
  ): Promise<{ contentType: string; bytes: Buffer; etag: string } | null> {
    const profile = await this.profiles.findOne({
      where: { slug: slug.trim().toLowerCase() },
      select: { coverUrl: true, updatedAt: true },
    });
    if (!profile?.coverUrl) return null;

    const decoded = decodeDataUrl(profile.coverUrl);
    if (!decoded) return null;

    return { ...decoded, etag: `"${profile.updatedAt.getTime()}"` };
  }

  /**
   * Bytes da imagem da página de chegada. Mesma mecânica do avatar.
   */
  async iabImageBytes(
    slug: string,
  ): Promise<{ contentType: string; bytes: Buffer; etag: string } | null> {
    const profile = await this.profiles.findOne({
      where: { slug: slug.trim().toLowerCase() },
      select: { iabImageUrl: true, updatedAt: true },
    });
    if (!profile?.iabImageUrl) return null;

    const decoded = decodeDataUrl(profile.iabImageUrl);
    if (!decoded) return null;

    return { ...decoded, etag: `"${profile.updatedAt.getTime()}"` };
  }

  /**
   * Bytes do avatar, para a rota que o serve como imagem.
   *
   * O `etag` sai de `updated_at`: a criadora trocar a foto invalida o cache do
   * navegador na hora, e nada além disso invalida.
   */
  async avatarBytes(
    slug: string,
  ): Promise<{ contentType: string; bytes: Buffer; etag: string } | null> {
    const profile = await this.profiles.findOne({
      where: { slug: slug.trim().toLowerCase() },
      select: { avatarUrl: true, updatedAt: true },
    });
    if (!profile?.avatarUrl) return null;

    const decoded = decodeDataUrl(profile.avatarUrl);
    // Avatar que já é URL http(s) não passa por aqui — a interface o usa direto.
    if (!decoded) return null;

    return { ...decoded, etag: `"${profile.updatedAt.getTime()}"` };
  }

  /**
   * Perfil público por slug.
   *
   * Uma consulta para o perfil e uma para os links ativos, ordenados. Não usa
   * `relations` porque o filtro `isActive` num join deixado ao ORM traz o
   * perfil sem links quando nenhum está ativo — e o perfil vazio é um estado
   * legítimo que a página precisa saber renderizar.
   */
  async publicProfile(slug: string): Promise<PublicProfileView> {
    const profile = await this.profiles.findOne({
      where: { slug: slug.trim().toLowerCase() },
    });
    // Fora do ar responde igual a inexistente, de propósito: distinguir os dois
    // contaria a um curioso quais endereços existem e estão suspensos — e a
    // criadora que tirou a página do ar não quer que ela seja encontrada.
    if (!profile || !profile.published) throw new NotFoundException("Perfil não encontrado.");

    const links = await this.links.find({
      where: { profileId: profile.id, isActive: true },
      order: { position: "ASC", createdAt: "ASC" },
    });

    const view = toOwnProfileView(profile);

    return {
      profile: {
        ...view,
        // Troca o data URL pela rota que serve a imagem. O documento carrega
        // uma URL curta em vez de megabytes de base64 repetidos no HTML e no
        // payload de hidratação. O dono do perfil continua recebendo o data URL
        // em `GET /me/profile`, porque o editor precisa dele para a prévia.
        avatarUrl: profile.avatarUrl
          ? `/api/v1/public/profiles/${encodeURIComponent(view.slug)}/avatar`
          : null,
        // A capa agora É renderizada — é a imagem de fundo do template — e
        // segue o mesmo caminho do avatar, como este comentário prometia
        // quando ela ainda não aparecia em lugar nenhum.
        coverUrl: profile.coverUrl
          ? `/api/v1/public/profiles/${encodeURIComponent(view.slug)}/cover`
          : null,
        // Mesma troca do avatar, e aqui ela pesa mais: a página de chegada é o
        // PRIMEIRO documento que a fã recebe, dentro de um aplicativo, em rede
        // móvel. Base64 no HTML seria o pior lugar possível para megabytes.
        iab: {
          ...view.iab,
          imageUrl: profile.iabImageUrl
            ? `/api/v1/public/profiles/${encodeURIComponent(view.slug)}/iab-image`
            : null,
        },
      },
      links: links.map(toPublicLinkView),
    };
  }
}

/** Data URL em base64 → bytes + tipo. `null` quando não é data URL. */
function decodeDataUrl(value: string): { contentType: string; bytes: Buffer } | null {
  const match = /^data:([\w/+.-]+);base64,(.*)$/s.exec(value);
  if (!match) return null;
  return { contentType: match[1], bytes: Buffer.from(match[2], "base64") };
}

export function toOwnProfileView(profile: Profile): OwnProfileView {
  return {
    id: profile.id,
    slug: profile.slug,
    displayName: profile.displayName,
    bio: profile.bio,
    avatarUrl: profile.avatarUrl,
    coverUrl: profile.coverUrl,
    themeId: profile.themeId,
    buttonStyle: profile.buttonStyle,
    isAdult: profile.isAdult,
    published: profile.published,
    joinedAt: profile.createdAt.toISOString(),
    template: {
      templateId: profile.templateId,
      bgColor: profile.bgColor,
      accentColor: profile.accentColor,
      fontId: profile.fontId,
      coverPosX: profile.coverPosX,
      coverPosY: profile.coverPosY,
      coverOverlay: profile.coverOverlay,
    },
    // A dona do perfil recebe o data URL cru: o editor precisa dele para a
    // prévia antes de salvar. A visitante recebe a rota (ver `publicProfile`).
    iab: {
      enabled: profile.iabEnabled,
      imageUrl: profile.iabImageUrl,
      headline: profile.iabHeadline,
      buttonLabel: profile.iabButtonLabel,
    },
  };
}

export function toPublicLinkView(link: Link): PublicLinkView {
  return {
    id: link.id,
    title: link.title,
    subtitle: link.subtitle,
    thumbnailUrl: link.thumbnailUrl,
    platform: link.platform,
    shortCode: link.shortCode,
    position: link.position,
    cloakEnabled: link.cloakEnabled,
    appearance: link.appearance,
  };
}
