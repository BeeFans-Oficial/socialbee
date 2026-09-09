import { Column, CreateDateColumn, Entity, JoinColumn, OneToMany, OneToOne, PrimaryGeneratedColumn } from "typeorm";

import { Link } from "./link.entity";
import { SafePageSocialLink } from "./safe-page-social-link.entity";

/**
 * A página "limpa" servida ao robô da rede social no lugar do destino real.
 *
 * O `LinkModal` já monta esta estrutura na interface e hoje ela é **descartada
 * no fechamento do modal** (ver README, "Cloaking no servidor"). A tabela
 * existe para o dado parar de morrer; servir conteúdo diferente ao crawler
 * continua sendo decisão de produto em aberto, e esta API não faz isso por
 * conta própria.
 */
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
