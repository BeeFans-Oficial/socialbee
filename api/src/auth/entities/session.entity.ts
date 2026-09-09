import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from "typeorm";

import { User } from "./user.entity";

/**
 * Uma linha por token emitido.
 *
 * É o que faz "sair" significar algo. Sem esta tabela, logout é apagar o cookie
 * do navegador e o JWT continua válido até expirar — quem copiou o token
 * continua dentro. O `id` é o `jti` do token, e o guard confere a linha em toda
 * requisição.
 */
@Entity({ name: "sessions" })
@Index("idx_sessions_user_id", ["userId"])
export class Session {
  /** É o `jti` do JWT, gerado pela aplicação ao abrir a sessão. */
  @PrimaryColumn({ name: "id", type: "uuid" })
  id: string;

  @Column({ name: "user_id", type: "uuid" })
  userId: string;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user: User;

  @Column({ name: "expires_at", type: "timestamptz" })
  expiresAt: Date;

  @Column({ name: "revoked_at", type: "timestamptz", nullable: true })
  revokedAt: Date | null;

  @Column({ name: "user_agent", type: "text", nullable: true })
  userAgent: string | null;

  /** Prefixo /24 do IP, não o IP. Serve para a pessoa reconhecer a sessão numa
   *  futura tela de "dispositivos conectados" sem a API guardar endereço
   *  completo de quem só fez login. */
  @Column({ name: "ip_prefix", type: "text", nullable: true })
  ipPrefix: string | null;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt: Date;
}
