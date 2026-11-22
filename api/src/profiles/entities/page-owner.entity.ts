import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from "typeorm";

/**
 * Dono de páginas, dentro de uma conta.
 *
 * Agrupa as páginas de uma mesma pessoa quando a conta administra as de
 * várias. Não tem login nem permissão: é organização. Ver a migration
 * `DonoDaPagina`.
 */
@Entity({ name: "page_owners" })
export class PageOwner {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ name: "user_id", type: "uuid" })
  userId: string;

  /** Único por conta, sem diferenciar maiúsculas (índice no banco). */
  @Column({ name: "name", type: "text" })
  name: string;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt: Date;
}
