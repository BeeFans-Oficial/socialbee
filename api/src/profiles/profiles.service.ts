import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Not, Repository } from "typeorm";

import { Link } from "../links/entities/link.entity";
import { Profile } from "./entities/profile.entity";
import { isReservedSlug } from "./reserved-slugs";
import type { UpdateProfileDto } from "./dto/update-profile.dto";

/** Perfil como o dono dele vê (dashboard). */
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
  joinedAt: string;
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

  async findByUserId(userId: string): Promise<Profile> {
    const profile = await this.profiles.findOne({ where: { userId } });
    if (!profile) throw new NotFoundException("Perfil não encontrado.");
    return profile;
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
    if (!profile) throw new NotFoundException("Perfil não encontrado.");

    const links = await this.links.find({
      where: { profileId: profile.id, isActive: true },
      order: { position: "ASC", createdAt: "ASC" },
    });

    return {
      profile: toOwnProfileView(profile),
      links: links.map(toPublicLinkView),
    };
  }
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
    joinedAt: profile.createdAt.toISOString(),
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
