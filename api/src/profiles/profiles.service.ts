import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { EntityManager, IsNull, Not, Repository } from "typeorm";

import { loadEnv } from "../config/env";
import { Link } from "../links/entities/link.entity";
import { PLANOS, TEMPLATE_DO_FREE, cabeMais, exigirPro, planoDe, type PlanoId } from "../plans/plans";
import { Domain } from "./entities/domain.entity";
import { Profile } from "./entities/profile.entity";
import { isReservedSlug } from "./reserved-slugs";
import type { CreateProfileDto } from "./dto/create-profile.dto";
import type { UpdateProfileDto } from "./dto/update-profile.dto";

/** Perfil como o dono dele vê (dashboard). */
/** Um domínio do pool, como o painel o oferece. */
export interface DomainView {
  id: string;
  host: string;
  label: string | null;
  /** É domínio próprio da conta (e não do pool)? */
  proprio: boolean;
}

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
  /** Domínio escolhido. `null` = o padrão da instalação. */
  domainId: string | null;
  /**
   * O host em que esta página é servida, já resolvido.
   *
   * Existe para o painel e a página pública pararem de depender de
   * `NEXT_PUBLIC_SITE_URL`, que é embutido no BUILD. Com um domínio só isso era
   * uma vantagem; com um pool, é o que faria o botão de copiar entregar o
   * endereço de outro domínio — o bug das PRs #5 e #6 por outra porta.
   */
  host: string;
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
  safePageLinks: Array<{ platform: string; url: string; title: string }>;
}

@Injectable()
export class ProfilesService {
  constructor(
    @InjectRepository(Profile) private readonly profiles: Repository<Profile>,
    @InjectRepository(Domain) private readonly domains: Repository<Domain>,
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

  /**
   * Os domínios que a criadora pode escolher.
   *
   * Só os ativos: um domínio bloqueado sai da lista na hora, sem deploy, e as
   * páginas que já estão nele continuam no ar até serem movidas.
   */
  /** Os domínios que a conta pode escolher: o pool inteiro e os próprios dela
   *  que a equipe já ativou. Domínio próprio de outra conta nunca aparece. */
  async listActiveDomains(userId: string): Promise<DomainView[]> {
    const dominios = await this.domains.find({
      where: [
        { active: true, status: "active", ownerUserId: IsNull() },
        { active: true, status: "active", ownerUserId: userId },
      ],
      order: { position: "ASC", host: "ASC" },
    });
    // Os próprios primeiro: são os que ela trouxe, e o motivo de abrir a lista.
    return dominios
      .map(toDomainView)
      .sort((a, b) => Number(b.proprio) - Number(a.proprio));
  }

  /**
   * Sorteia um domínio ativo para uma página nova.
   *
   * Conta nova não cai sempre no domínio padrão: concentrar toda a base num
   * endereço só faz um bloqueio derrubar todo mundo de uma vez. O sorteio
   * espalha o risco sem pedir nada à criadora, que nesse momento não tem
   * contexto nenhum para escolher.
   *
   * Devolve `null` com o catálogo vazio — que é o estado de hoje. O cadastro
   * **nunca** pode falhar por falta de catálogo: sem domínio, a página nasce no
   * endereço padrão da instalação, exatamente como antes deste recurso existir.
   *
   * `ORDER BY random()` e não rodízio: distribui bem o suficiente e não exige
   * guardar estado entre cadastros. Balancear por quantidade de páginas é
   * otimização para quando a distribuição se mostrar torta — e aí já haverá
   * dado para decidir.
   */
  async sortearDomainId(manager?: EntityManager): Promise<string | null> {
    const repo = manager ? manager.getRepository(Domain) : this.domains;
    const sorteado = await repo
      .createQueryBuilder("d")
      .select("d.id", "id")
      .where("d.active = true")
      // Domínio próprio é de uma conta só: nunca entra no sorteio.
      .andWhere("d.owner_user_id IS NULL")
      .andWhere("d.status = 'active'")
      .orderBy("random()")
      .limit(1)
      .getRawOne<{ id: string }>();
    return sorteado?.id ?? null;
  }

  /**
   * Valida a escolha de domínio antes de gravá-la.
   *
   * Recusar um domínio inativo importa: ele saiu de circulação por algum
   * motivo — foi bloqueado, expirou, perdeu o certificado — e deixar uma página
   * nova cair nele entregaria à criadora um endereço que não responde.
   */
  private async assertDomainEscolhivel(domainId: string, userId: string): Promise<void> {
    const existe = await this.domains.exists({
      where: [
        { id: domainId, active: true, status: "active", ownerUserId: IsNull() },
        { id: domainId, active: true, status: "active", ownerUserId: userId },
      ],
    });
    if (!existe) {
      throw new ConflictException({
        code: "dominio_indisponivel",
        message: "Esse domínio não está disponível. Escolha outro da lista.",
      });
    }
  }

  /** A página por id. Lança 404 quando não existe — quem chama já passou pelo
   *  guard, então "não existe" aqui é id inválido, não falta de permissão. */
  async findById(profileId: string): Promise<Profile> {
    const profile = await this.profiles.findOne({
      where: { id: profileId },
      relations: { domain: true },
    });
    if (!profile) throw new NotFoundException("Página não encontrada.");
    return profile;
  }

  async findByUserId(userId: string): Promise<Profile> {
    const profile = await this.profiles.findOne({
      where: { userId },
      relations: { domain: true },
    });
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
      relations: { domain: true },
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
  async createForUser(
    userId: string,
    plano: PlanoId,
    dto: CreateProfileDto,
  ): Promise<OwnProfileView> {
    if (dto.templateId && dto.templateId !== TEMPLATE_DO_FREE) exigirPro(plano, "aparencia");

    const limite = PLANOS[plano].paginas;
    if (limite !== null) {
      // Sem trava de linha, de propósito: criar página é raro e manual, e o
      // pior caso de dois cliques simultâneos é uma página a mais — que
      // continua no ar e só impede a próxima. Travar `users` aqui seria
      // segurar a linha que o login também atualiza.
      const total = await this.profiles.count({ where: { userId } });
      if (!cabeMais(limite, total)) exigirPro(plano, "paginas");
    }

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
    return toOwnProfileView(await this.findById(profileId));
  }

  async update(profileId: string, plano: PlanoId, dto: UpdateProfileDto): Promise<OwnProfileView> {
    const profile = await this.findById(profileId);
    exigirProParaMudancas(plano, profile, dto);

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
    if (dto.domainId !== undefined) {
      if (dto.domainId !== null) await this.assertDomainEscolhivel(dto.domainId, profile.userId);
      profile.domainId = dto.domainId;
      // A relação carregada ficaria velha e a view devolveria o host anterior —
      // quem acabou de trocar de domínio veria o endereço antigo na tela.
      profile.domain = dto.domainId
        ? await this.domains.findOne({ where: { id: dto.domainId } })
        : null;
    }
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
    // Query builder e não `findOne` para trazer da conta SÓ o `pro_until`: com
    // `relations: { user: true }` viriam email e hash de senha junto, numa
    // consulta que roda a cada visita de fã.
    const profile = await this.profiles
      .createQueryBuilder("p")
      .leftJoinAndSelect("p.domain", "d")
      .leftJoin("p.user", "u")
      .addSelect(["u.id", "u.proUntil"])
      .where("p.slug = :slug", { slug: slug.trim().toLowerCase() })
      .getOne();
    // Fora do ar responde igual a inexistente, de propósito: distinguir os dois
    // contaria a um curioso quais endereços existem e estão suspensos — e a
    // criadora que tirou a página do ar não quer que ela seja encontrada.
    if (!profile || !profile.published) throw new NotFoundException("Perfil não encontrado.");

    const links = await this.links.createQueryBuilder("link")
      .leftJoinAndSelect("link.safePage", "page")
      .leftJoinAndSelect("page.socialLinks", "social")
      .where("link.profileId = :profileId AND link.isActive = true", { profileId: profile.id })
      .orderBy("link.position", "ASC")
      .addOrderBy("link.createdAt", "ASC")
      .addOrderBy("social.position", "ASC")
      .getMany();

    const view = toOwnProfileView(profile);
    const ehPro = planoDe(profile.user?.proUntil) === "pro";

    return {
      profile: {
        ...view,
        // Conta que voltou ao Free: o que era Pro fica gravado e para de valer
        // aqui. Assinar de novo devolve tudo como estava. O domínio escolhido
        // NÃO volta ao padrão — mudar o endereço quebraria o link na bio.
        template: ehPro
          ? view.template
          : {
              ...view.template,
              templateId: TEMPLATE_DO_FREE,
              bgColor: null,
              accentColor: null,
              fontId: null,
            },
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
      safePageLinks: ehPro ? links.filter((link) => link.cloakEnabled)
        .flatMap((link) => (link.safePage?.socialLinks ?? []).map(({ platform, url, title }) => ({ platform, url, title }))) : [],
      links: links
        .map(toPublicLinkView)
        .map((link) => (ehPro ? link : { ...link, cloakEnabled: false })),
    };
  }
}

/**
 * Recusa o que o plano não cobre — mas só o que MUDA.
 *
 * O painel manda o perfil inteiro a cada salvamento. Uma conta que voltou ao
 * Free com o modelo "Capa" gravado manda `templateId: "capa"` até quando só
 * troca a bio; recusar isso travaria a edição de tudo. Valor igual ao gravado
 * passa; voltar ao que o Free tem (Clássico, sem cor, sem fonte) também.
 */
function exigirProParaMudancas(plano: PlanoId, profile: Profile, dto: UpdateProfileDto): void {
  const muda = <T>(novo: T | undefined, atual: T) => novo !== undefined && novo !== atual;

  const mudaAparencia =
    (muda(dto.templateId, profile.templateId) && dto.templateId !== TEMPLATE_DO_FREE) ||
    (muda(dto.bgColor, profile.bgColor) && dto.bgColor !== null) ||
    (muda(dto.accentColor, profile.accentColor) && dto.accentColor !== null) ||
    (muda(dto.fontId, profile.fontId) && dto.fontId !== null);
  if (mudaAparencia) exigirPro(plano, "aparencia");

  if (muda(dto.domainId, profile.domainId)) exigirPro(plano, "dominio");
}

/** Data URL em base64 → bytes + tipo. `null` quando não é data URL. */
function decodeDataUrl(value: string): { contentType: string; bytes: Buffer } | null {
  const match = /^data:([\w/+.-]+);base64,(.*)$/s.exec(value);
  if (!match) return null;
  return { contentType: match[1], bytes: Buffer.from(match[2], "base64") };
}

/**
 * O host padrão da instalação, a partir de `PUBLIC_SITE_URL`.
 *
 * Essa variável existia na config desde o início e **nunca era lida** por
 * ninguém. Agora ela tem trabalho: é o endereço das páginas que não escolheram
 * domínio do pool — ou seja, todas, até alguém escolher.
 *
 * Só o host interessa: o esquema é sempre https em produção, e guardar
 * `https://` no mesmo campo que alimenta o `server_name` do nginx seria
 * convidar a concatenação errada.
 */
export function hostPadrao(): string {
  return loadEnv().publicSiteUrl.replace(/^https?:\/\//, "").replace(/\/+$/, "");
}

export function toDomainView(domain: Domain): DomainView {
  return { id: domain.id, host: domain.host, label: domain.label, proprio: domain.ownerUserId !== null };
}

/**
 * @param profile precisa vir com a relação `domain` carregada quando ela
 *   existir — sem ela, uma página com domínio escolhido seria descrita com o
 *   host padrão, e o link copiado apontaria para o endereço errado.
 */
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
    domainId: profile.domainId ?? null,
    host: profile.domain?.host ?? hostPadrao(),
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
