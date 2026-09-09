import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from "typeorm";

import { SafePage } from "./safe-page.entity";

/** Um perfil de rede social listado na safe page. */
@Entity({ name: "safe_page_social_links" })
@Index("idx_safe_page_social_links_page", ["safePageId", "position"])
export class SafePageSocialLink {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ name: "safe_page_id", type: "uuid" })
  safePageId: string;

  @ManyToOne(() => SafePage, (page) => page.socialLinks, { onDelete: "CASCADE" })
  @JoinColumn({ name: "safe_page_id" })
  safePage: SafePage;

  @Column({ name: "platform", type: "text" })
  platform: string;

  @Column({ name: "url", type: "text" })
  url: string;

  @Column({ name: "title", type: "text", default: "" })
  title: string;

  @Column({ name: "position", type: "integer", default: 0 })
  position: number;
}
