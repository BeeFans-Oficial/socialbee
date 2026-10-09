import { Column, CreateDateColumn, Entity, JoinColumn, OneToMany, OneToOne, PrimaryGeneratedColumn } from "typeorm";

import { Link } from "./link.entity";
import { SafePageSocialLink } from "./safe-page-social-link.entity";

/** Página simplificada vinculada ao link, servida a bots em /r/[code]. */
@Entity({ name: "safe_pages" })
export class SafePage {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ name: "link_id", type: "uuid", unique: true })
  linkId: string;

  @OneToOne(() => Link, (link) => link.safePage, { onDelete: "CASCADE" })
  @JoinColumn({ name: "link_id" })
  link: Link;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt: Date;

  @OneToMany(() => SafePageSocialLink, (social) => social.safePage, {
    cascade: ["insert"],
  })
  socialLinks: SafePageSocialLink[];
}
