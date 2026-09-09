import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Between, Repository } from "typeorm";

import { loadEnv } from "../config/env";

import { LinkCounter } from "./entities/link-counter.entity";
import { TrackingEvent } from "./entities/tracking-event.entity";
import type {
  DateRange,
  LinkCounters,
  TrackingEventRecord,
  TrackingStore,
} from "./types";

/**
 * Persistência do rastreamento em Postgres.
 *
 * Substitui `lib/tracking/store-file.ts` do MVP, e o motivo está escrito lá:
 * o store em arquivo servia **um processo só**, porque o contador fazia
 * ler-modificar-gravar sob um mutex em memória. Dois cliques simultâneos em
 * instâncias diferentes perdiam um incremento, e o próprio arquivo dizia que em
 * produção isso viraria `UPDATE ... SET clicks = clicks + 1`.
 *
 * É exatamente o que `bumpCounters` faz agora, num único statement atômico. Não
 * existe mais fila de escrita, mutex, nem arquivo temporário renomeado.
 */
@Injectable()
export class PostgresTrackingStore implements TrackingStore {
  constructor(
    @InjectRepository(TrackingEvent) private readonly events: Repository<TrackingEvent>,
    @InjectRepository(LinkCounter) private readonly counterRows: Repository<LinkCounter>,
  ) {}

  async append(event: TrackingEventRecord): Promise<void> {
    await this.events.insert({
      type: event.type,
      profileId: event.profileId,
      linkId: event.linkId ?? null,
      channel: event.channel ?? null,
      destinationHost: event.destinationHost ?? null,
      occurredAt: event.occurredAt,
      attribution: event.attribution,
      client: event.client,
    });
  }

  /**
   * Incremento atômico do contador.
   *
   * `INSERT ... ON CONFLICT DO UPDATE` resolve num statement o que era uma
   * corrida: a primeira gravação cria a linha, as seguintes somam sobre o valor
   * que está no banco — nunca sobre um valor lido antes. `GREATEST` no
   * `last_click_at` evita que um clique processado com atraso empurre o carimbo
   * para trás.
   */
  async bumpCounters(
    profileId: string,
    linkId: string,
    patch: Partial<Pick<LinkCounters, "clicks" | "botHits">> & { lastClickAt?: Date },
  ): Promise<void> {
    const clicks = patch.clicks ?? 0;
    const botHits = patch.botHits ?? 0;

    // Tabela qualificada com o schema, mesmo com o `search_path` da conexão já
    // apontando para ele: este é o statement do caminho quente, e depender de
    // configuração de sessão para ele acertar a tabela é uma falha silenciosa
    // esperando por uma troca de pool.
    await this.counterRows.query(
      `
      INSERT INTO "${loadEnv().dbSchema}"."link_counters"
        (profile_id, link_id, clicks, bot_hits, last_click_at)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (profile_id, link_id) DO UPDATE
        SET clicks        = "link_counters".clicks + EXCLUDED.clicks,
            bot_hits      = "link_counters".bot_hits + EXCLUDED.bot_hits,
            last_click_at = GREATEST(
              "link_counters".last_click_at,
              EXCLUDED.last_click_at
            )
      `,
      [profileId, linkId, clicks, botHits, patch.lastClickAt ?? null],
    );
  }

  async counters(profileId: string): Promise<Record<string, LinkCounters>> {
    const rows = await this.counterRows.find({ where: { profileId } });

    const out: Record<string, LinkCounters> = {};
    for (const row of rows) {
      out[row.linkId] = {
        clicks: row.clicks,
        botHits: row.botHits,
        lastClickAt: row.lastClickAt ? row.lastClickAt.toISOString() : undefined,
      };
    }
    return out;
  }

  /**
   * Eventos do perfil na janela.
   *
   * Escopado por perfil **por contrato**, não por disciplina de quem chama — a
   * mesma decisão do domínio original. O índice
   * `(profile_id, occurred_at)` existe para esta consulta.
   */
  async query(profileId: string, range: DateRange): Promise<TrackingEventRecord[]> {
    const rows = await this.events.find({
      where: { profileId, occurredAt: Between(range.from, range.to) },
      order: { occurredAt: "ASC" },
    });

    return rows.map((row) => ({
      type: row.type,
      profileId: row.profileId,
      linkId: row.linkId ?? undefined,
      channel: row.channel ?? undefined,
      destinationHost: row.destinationHost ?? undefined,
      occurredAt: row.occurredAt,
      attribution: row.attribution,
      client: row.client,
    }));
  }
}
