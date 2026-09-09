import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from "typeorm";

import { Link } from "../../links/entities/link.entity";
import { Profile } from "../../profiles/entities/profile.entity";

/** `bigint` volta como string do driver do Postgres. O relatório soma e divide
 *  estes números, então converter na borda evita `"12" + 1 === "121"` acontecer
 *  em algum lugar distante daqui. */
const bigintToNumber = {
  to: (value: number) => value,
  from: (value: string | number | null) => (value === null ? 0 : Number(value)),
};

/**
 * Contador desnormalizado por link.
 *
 * O motivo de existir: a lista de links e o histórico precisam de número sem
 * agregar `tracking_events`, e precisam **sobreviver** à expiração do evento
 * cru. É atualizado no mesmo caminho do evento, com
 * `INSERT ... ON CONFLICT DO UPDATE SET clicks = link_counters.clicks + 1` —
 * o `UPDATE` atômico que o store em arquivo do MVP não conseguia fazer e que
 * limitava o app a um processo só.
 *
 * Aqui o `ON DELETE` é `CASCADE`: apagar um link apaga o contador dele. O
 * contador é *daquele link*; mantê-lo órfão produziria uma linha de relatório
 * sem título que ninguém sabe interpretar. O total do período continua íntegro
 * porque vem dos eventos.
 */
@Entity({ name: "link_counters" })
export class LinkCounter {
  @PrimaryColumn({ name: "profile_id", type: "uuid" })
  profileId: string;

  @PrimaryColumn({ name: "link_id", type: "uuid" })
  linkId: string;

  @ManyToOne(() => Profile, { onDelete: "CASCADE" })
  @JoinColumn({ name: "profile_id" })
  profile: Profile;

  @ManyToOne(() => Link, { onDelete: "CASCADE" })
  @JoinColumn({ name: "link_id" })
  link: Link;

  @Column({ name: "clicks", type: "bigint", default: 0, transformer: bigintToNumber })
  clicks: number;

  @Column({ name: "bot_hits", type: "bigint", default: 0, transformer: bigintToNumber })
  botHits: number;

  @Column({ name: "last_click_at", type: "timestamptz", nullable: true })
  lastClickAt: Date | null;
}
