import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, OneToOne, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";

import { Profile } from "../../profiles/entities/profile.entity";
import { SafePage } from "./safe-page.entity";

/** Aparência do botão. Espelha `LinkAppearance` em `lib/mock-data.ts`. */
export interface LinkAppearance {
  style: "soft" | "filled" | "outlined" | "glass" | "pill";
  color: string;
  useGradient: boolean;
  gradientTo: string;
  glow: boolean;
  showIcon: boolean;
  showArrow: boolean;
  themePresetId?: string;
}

export const DEFAULT_LINK_APPEARANCE: LinkAppearance = {
  style: "soft",
  color: "#FF3C6E",
  useGradient: false,
  gradientTo: "#FF1F57",
  glow: false,
  showIcon: true,
  showArrow: true,
};

/**
 * Um link na bio.
 *
 * `appearance` é `jsonb` e não colunas: são sete campos de pura apresentação
 * que mudam junto com o design do front. Virariam sete migrations a cada
 * redesenho, e nenhuma consulta filtra ou agrega por eles. A validação de forma
 * fica no DTO — `jsonb` não é desculpa para aceitar qualquer coisa.
 *
 * A safe page, ao contrário, é relacional: o cloaking no servidor vai
 * precisar consultá-la por link, e ela tem uma coleção dentro.
 */
@Entity({ name: "links" })
@Index("idx_links_profile_position", ["profileId", "position"])
export class Link {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ name: "profile_id", type: "uuid" })
  profileId: string;

  @ManyToOne(() => Profile, (profile) => profile.links, { onDelete: "CASCADE" })
  @JoinColumn({ name: "profile_id" })
  profile: Profile;

  @Column({ name: "title", type: "text" })
  title: string;

  @Column({ name: "subtitle", type: "text", nullable: true })
  subtitle: string | null;

  @Column({ name: "thumbnail_url", type: "text", nullable: true })
  thumbnailUrl: string | null;

  /** Rótulo do canal ("onlyfans", "telegram"…). String aberta: o núcleo não
   *  conhece plataforma, o front conhece. Ver `tracking/types.ts`. */
  @Column({ name: "platform", type: "text", default: "custom" })
  platform: string;

  /** Código do redirecionador (`/r/<code>`). Único no sistema inteiro, não por
   *  perfil: o código é o endereço público e não tem namespace. */
  @Column({ name: "short_code", type: "text", unique: true })
  shortCode: string;

  @Column({ name: "destination_url", type: "text" })
  destinationUrl: string;

  @Column({ name: "is_active", type: "boolean", default: true })
  isActive: boolean;

  /** Ordem na página pública. Sem `UNIQUE` por perfil: a reordenação move
   *  vários links de uma vez e um índice único bloquearia o estado
   *  intermediário. A integridade da ordem é garantida pela transação que
   *  regrava todas as posições. */
  @Column({ name: "position", type: "integer", default: 0 })
  position: number;

  @Column({ name: "cloak_enabled", type: "boolean", default: false })
  cloakEnabled: boolean;

  @Column({ name: "appearance", type: "jsonb", default: () => "'{}'::jsonb" })
  appearance: LinkAppearance;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt: Date;

  @OneToOne(() => SafePage, (safePage) => safePage.link)
  safePage: SafePage | null;
}
