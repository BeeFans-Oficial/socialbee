import { Column, CreateDateColumn, Entity, Index, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";

import { Profile } from "./profile.entity";

/**
 * Um domínio do pool — um endereço em que páginas podem ser servidas.
 *
 * Existe porque domínio de link na bio de criadora adulta é consumível: uma
 * hora é bloqueado, e quando isso acontece todas as páginas naquele endereço
 * somem de uma vez. O pool é a saída de autoatendimento — a criadora troca de
 * domínio sozinha, sem abrir chamado.
 *
 * O catálogo é dado, não configuração de build: domínio novo entra com um
 * `INSERT`, e um queimado sai de circulação com `active = false`, na hora.
 *
 * **Cadastrar aqui não faz o domínio funcionar.** Antes é preciso o registro
 * `A` apontando para a VPS, o nome no `server_name` do nginx e o certificado
 * emitido. A linha nesta tabela é o último passo, não o primeiro — inverter a
 * ordem oferece à criadora um endereço que responde com erro de TLS.
 */
@Entity({ name: "domains" })
@Index("idx_domains_active", ["active", "position"])
export class Domain {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  /** Só o host: sem esquema, sem barra, sem porta. `beesocial.bio`. */
  @Column({ name: "host", type: "text", unique: true })
  host: string;

  /** Nome curto para a criadora escolher por aparência, não por técnica. */
  @Column({ name: "label", type: "text", nullable: true })
  label: string | null;

  /** Desligado, some das opções — sem derrubar quem já está nele. */
  @Column({ name: "active", type: "boolean", default: true })
  active: boolean;

  @Column({ name: "position", type: "int", default: 0 })
  position: number;

  /** De quem é. `null` é domínio do pool, oferecido a todas; preenchido, é
   *  domínio próprio e só a dona o vê. */
  @Column({ name: "owner_user_id", type: "uuid", nullable: true })
  ownerUserId: string | null;

  /** `pending` até a equipe configurar nginx e certificado e rodar
   *  `npm run dominio:ativar`. Só `active` é oferecido para as páginas. */
  @Column({ name: "status", type: "text", default: "active" })
  status: "pending" | "active";

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt: Date;

  @OneToMany(() => Profile, (profile) => profile.domain)
  profiles: Profile[];
}
