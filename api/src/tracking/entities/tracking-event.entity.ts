import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from "typeorm";

import { Link } from "../../links/entities/link.entity";
import { Profile } from "../../profiles/entities/profile.entity";
import type { Attribution, ClientContext } from "../types";

/**
 * Evento cru: um clique ou uma visualização.
 *
 * É volume, e tem TTL de 90 dias (`retention.service.ts`). Passado isso o
 * número continua em `link_counters`. Essa separação vem do bee-api-2 e é o que
 * o README do MVP promete que a troca por banco reproduziria.
 *
 * `link_id` é `ON DELETE SET NULL`, não `CASCADE`: quando a criadora apaga um
 * link, os totais do período não podem cair. O evento continua contando como
 * clique do perfil, e a quebra por link simplesmente deixa de ter aquela linha
 * (o `tally` do serviço descarta chave ausente de propósito).
 *
 * `attribution` e `client` são `jsonb` porque são registro de observação: a
 * lista de click ids cresce a cada rede nova, e virar coluna foi exatamente o
 * acoplamento que o domínio recusou.
 */
@Entity({ name: "tracking_events" })
@Index("idx_tracking_events_profile_occurred", ["profileId", "occurredAt"])
@Index("idx_tracking_events_link", ["linkId"])
export class TrackingEvent {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  /** "view" | "click" | qualquer rótulo futuro. Texto, nunca enum: um canal
   *  novo pode registrar o próprio evento sem migração de schema. */
  @Column({ name: "type", type: "text" })
  type: string;

  @Column({ name: "profile_id", type: "uuid" })
  profileId: string;

  @ManyToOne(() => Profile, { onDelete: "CASCADE" })
  @JoinColumn({ name: "profile_id" })
  profile: Profile;

  @Column({ name: "link_id", type: "uuid", nullable: true })
  linkId: string | null;

  @ManyToOne(() => Link, { onDelete: "SET NULL", nullable: true })
  @JoinColumn({ name: "link_id" })
  link: Link | null;

  @Column({ name: "channel", type: "text", nullable: true })
  channel: string | null;

  /** Host do destino, para saber para onde o tráfego saiu sem guardar a URL
   *  completa (que pode carregar token de afiliado). */
  @Column({ name: "destination_host", type: "text", nullable: true })
  destinationHost: string | null;

  @Column({ name: "occurred_at", type: "timestamptz" })
  occurredAt: Date;

  @Column({ name: "attribution", type: "jsonb" })
  attribution: Attribution;

  @Column({ name: "client", type: "jsonb" })
  client: ClientContext;
}
