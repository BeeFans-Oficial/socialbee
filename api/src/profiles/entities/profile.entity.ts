import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";

import { User } from "../../auth/entities/user.entity";
import { Link } from "../../links/entities/link.entity";

/**
 * Identidade pública da criadora — o que `/[slug]` mostra.
 *
 * Uma conta tem um perfil hoje, mas a tabela é separada porque todo o
 * rastreamento já é escopado por `profileId` (ver `tracking/types.ts`) e o
 * domínio foi escrito para multi-perfil. Fazer isto depois seria migrar dado de
 * clique junto.
 */
@Entity({ name: "profiles" })
export class Profile {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ name: "user_id", type: "uuid" })
  userId: string;

  @ManyToOne(() => User, (user) => user.profiles, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user: User;

  /** Endereço público. Minúsculas, 3-30, `[a-z0-9-]` — garantido por `CHECK`
   *  no banco, não só pelo DTO: o DTO protege a API, o `CHECK` protege o dado
   *  de qualquer outro caminho de escrita (seed, script, psql). */
  @Column({ name: "slug", type: "text", unique: true })
  slug: string;

  @Column({ name: "display_name", type: "text" })
  displayName: string;

  @Column({ name: "bio", type: "text", default: "" })
  bio: string;

  @Column({ name: "avatar_url", type: "text", nullable: true })
  avatarUrl: string | null;

  @Column({ name: "cover_url", type: "text", nullable: true })
  coverUrl: string | null;

  /** Id do tema em `lib/mock-data.ts` (`THEMES`). Texto livre de propósito: o
   *  catálogo de temas é apresentação e vive no front; a API só guarda a
   *  escolha. Um tema novo não é migração de banco. */
  @Column({ name: "theme_id", type: "text", default: "neon-pink" })
  themeId: string;

  @Column({ name: "button_style", type: "text", default: "soft" })
  buttonStyle: string;

  /** Liga a barreira de idade no perfil público. */
  @Column({ name: "is_adult", type: "boolean", default: false })
  isAdult: boolean;

  /**
   * Página de chegada para navegador embutido (IAB).
   *
   * Ligada, `/{slug}` passa a servir DOIS documentos: esta página a quem vem do
   * navegador embutido de um aplicativo (e a robôs), e o perfil completo ao
   * resto. Desligada, o comportamento é o de antes.
   *
   * A imagem é data URL em base64, como o avatar, e pelo mesmo motivo: não há
   * upload de arquivo ainda. Quem a serve como imagem de verdade é
   * `AvatarController`, para o data URL não entrar no HTML.
   */
  @Column({ name: "iab_enabled", type: "boolean", default: false })
  iabEnabled: boolean;

  @Column({ name: "iab_image_url", type: "text", nullable: true })
  iabImageUrl: string | null;

  /** Título da página de chegada. Vazio cai no `displayName` na renderização —
   *  o default não é gravado, para trocar o nome não deixar o título velho. */
  @Column({ name: "iab_headline", type: "text", nullable: true })
  iabHeadline: string | null;

  @Column({ name: "iab_button_label", type: "text", nullable: true })
  iabButtonLabel: string | null;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt: Date;

  @OneToMany(() => Link, (link) => link.profile)
  links: Link[];
}
