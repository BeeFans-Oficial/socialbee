import { randomUUID } from "node:crypto";

import { buildClientContext, clientIP, edgeCountry, hostOf, parseAttribution } from "./attribution";
import { detectBot } from "./bots";
import type {
  Breakdown,
  DateRange,
  ResolvedLink,
  TrackingEvent,
  TrackingReport,
  TrackingStore,
} from "./types";

/**
 * Casos de uso do rastreamento.
 *
 * Duas regras estruturais herdadas do bee-api-2, e uma abandonada.
 *
 * Herdadas:
 *   - Robô não vira evento. Contar sondagem de prévia infla o funil, e num link
 *     na bio a prévia é a maior fonte de requisição não humana.
 *   - Contador desnormalizado por link, somado no mesmo caminho do evento. É o
 *     que faz a lista de links e o histórico além do TTL não precisarem agregar.
 *
 * Abandonada:
 *   - O funil de compra (start → checkout → purchase). O destino aqui é de
 *     terceiro: ninguém nos avisa quando a venda acontece no OnlyFans. O último
 *     estágio observável é o redirecionamento, e o relatório para nele.
 */

export interface TrackingService {
  recordClick(input: ClickInput): Promise<ClickOutcome>;
  recordView(input: ViewInput): Promise<void>;
  report(profileId: string, range: DateRange): Promise<TrackingReport>;
}

export interface ClickInput {
  link: ResolvedLink;
  /** URL do próprio redirecionador, de onde saem os UTM e os click ids. */
  requestUrl: URL;
  headers: Headers;
  method: string;
}

export interface ClickOutcome {
  /** `false` quando o filtro classificou como robô. O redirecionamento
   *  acontece de todo jeito — só não conta. */
  counted: boolean;
  reason: string;
}

export interface ViewInput {
  profileId: string;
  requestUrl: URL;
  headers: Headers;
}

function botSignalsFrom(headers: Headers, method: string, ip?: string) {
  return {
    userAgent: headers.get("user-agent") ?? "",
    ip,
    method,
    acceptLanguage: headers.get("accept-language") ?? undefined,
    accept: headers.get("accept") ?? undefined,
    secChUa: headers.get("sec-ch-ua") ?? undefined,
    secFetchMode: headers.get("sec-fetch-mode") ?? undefined,
  };
}

export function createTrackingService(store: TrackingStore): TrackingService {
  return {
    async recordClick(input: ClickInput): Promise<ClickOutcome> {
      const ip = clientIP(input.headers);
      const verdict = detectBot(botSignalsFrom(input.headers, input.method, ip));

      if (verdict.isBot) {
        // Só o contador de robô sobe. O evento cru não é gravado: sob varredura
        // de crawler isso encheria o log de lixo e distorceria toda quebra.
        await store.bumpCounters(input.link.profileId, input.link.linkId, { botHits: 1 });
        return { counted: false, reason: verdict.reason };
      }

      const now = new Date();
      const event: TrackingEvent = {
        id: randomUUID(),
        type: "click",
        profileId: input.link.profileId,
        linkId: input.link.linkId,
        channel: input.link.channel,
        destinationHost: hostOf(input.link.destinationUrl),
        occurredAt: now.toISOString(),
        attribution: parseAttribution(input.requestUrl, input.headers.get("referer")),
        client: buildClientContext({
          userAgent: input.headers.get("user-agent"),
          ip,
          country: edgeCountry(input.headers),
        }),
      };

      await store.append(event);
      await store.bumpCounters(input.link.profileId, input.link.linkId, {
        clicks: 1,
        lastClickAt: event.occurredAt,
      });

      return { counted: true, reason: verdict.reason };
    },

    async recordView(input: ViewInput): Promise<void> {
      const ip = clientIP(input.headers);
      // View usa o mesmo filtro. O perfil público é justamente o que os
      // geradores de prévia buscam, então sem isto a taxa de clique nasce
      // diluída por visitas que nunca existiram.
      if (detectBot(botSignalsFrom(input.headers, "GET", ip)).isBot) return;

      const event: TrackingEvent = {
        id: randomUUID(),
        type: "view",
        profileId: input.profileId,
        occurredAt: new Date().toISOString(),
        attribution: parseAttribution(input.requestUrl, input.headers.get("referer")),
        client: buildClientContext({
          userAgent: input.headers.get("user-agent"),
          ip,
          country: edgeCountry(input.headers),
        }),
      };

      await store.append(event);
    },

    async report(profileId: string, range: DateRange): Promise<TrackingReport> {
      const [events, counters] = await Promise.all([
        store.query(profileId, range),
        store.counters(profileId),
      ]);

      const clicks = events.filter((e) => e.type === "click");
      const views = events.filter((e) => e.type === "view");

      const botHits = Object.values(counters).reduce((sum, c) => sum + c.botHits, 0);
      const inAppClicks = clicks.filter((e) => e.client.inAppBrowser).length;

      return {
        profileId,
        from: range.from.toISOString(),
        to: range.to.toISOString(),
        views: views.length,
        clicks: clicks.length,
        clickRate: views.length ? clicks.length / views.length : 0,
        botHits,
        inAppClicks,
        byChannel: tally(clicks, (e) => e.channel),
        // `(direto)` em vez de omitir: uma quebra que esconde a maior fatia
        // engana mais do que informa.
        bySource: tally(clicks, (e) => e.attribution.source ?? e.attribution.referrerHost ?? "(direto)"),
        byCampaign: tally(clicks, (e) => e.attribution.campaign),
        byLink: tally(clicks, (e) => e.linkId).map((row) => ({
          ...row,
          linkId: row.key,
          channel: clicks.find((e) => e.linkId === row.key)?.channel,
        })),
        daily: daily(views, clicks, range),
      };
    },
  };
}

/** Agrupa e ordena por volume. Chave ausente é descartada — linha sem
 *  identidade não ajuda ninguém a decidir nada. */
function tally(events: TrackingEvent[], key: (e: TrackingEvent) => string | undefined): Breakdown[] {
  const counts = new Map<string, number>();
  for (const event of events) {
    const value = key(event);
    if (!value) continue;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  const total = events.length;
  return [...counts.entries()]
    .map(([k, clicks]) => ({ key: k, clicks, share: total ? clicks / total : 0 }))
    .sort((a, b) => b.clicks - a.clicks);
}

/** Série diária contínua.
 *
 *  Todos os dias da janela entram, inclusive os zerados: um gráfico que pula os
 *  dias sem clique comprime o eixo e mente sobre a tendência. */
function daily(
  views: TrackingEvent[],
  clicks: TrackingEvent[],
  range: DateRange,
): TrackingReport["daily"] {
  const buckets = new Map<string, { views: number; clicks: number }>();

  const cursor = new Date(
    Date.UTC(range.from.getUTCFullYear(), range.from.getUTCMonth(), range.from.getUTCDate()),
  );
  const last = Date.UTC(range.to.getUTCFullYear(), range.to.getUTCMonth(), range.to.getUTCDate());
  while (cursor.getTime() <= last) {
    buckets.set(cursor.toISOString().slice(0, 10), { views: 0, clicks: 0 });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  for (const event of views) {
    const bucket = buckets.get(event.occurredAt.slice(0, 10));
    if (bucket) bucket.views += 1;
  }
  for (const event of clicks) {
    const bucket = buckets.get(event.occurredAt.slice(0, 10));
    if (bucket) bucket.clicks += 1;
  }

  return [...buckets.entries()].map(([date, value]) => ({ date, ...value }));
}
