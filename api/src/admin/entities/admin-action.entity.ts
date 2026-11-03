import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from "typeorm";

/** Os papéis que uma conta pode ter. Espelha o `CHECK` de `users.role`. */
export type Papel = "creator" | "admin";

/**
 * Uma ação feita por um admin. Só se escreve; nunca se apaga nem se edita.
 * Ver a migration `1791000000000-PapelDeAdmin` para o porquê de cada coluna.
 */
@Entity({ name: "admin_actions" })
export class AdminAction {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ name: "admin_user_id", type: "uuid", nullable: true })
  adminUserId: string | null;

  @Column({ name: "action", type: "text" })
  action: string;

  @Column({ name: "target_user_id", type: "uuid", nullable: true })
  targetUserId: string | null;

  @Column({ name: "target_profile_id", type: "uuid", nullable: true })
  targetProfileId: string | null;

  @Column({ name: "reason", type: "text" })
  reason: string;

  @Column({ name: "details", type: "jsonb", default: () => "'{}'::jsonb" })
  details: Record<string, unknown>;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt: Date;
}
