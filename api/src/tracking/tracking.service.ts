import { Injectable } from "@nestjs/common";

import { buildClientContext, clientIP, edgeCountry, hostOf, parseAttribution } from "./attribution";
import { detectBot } from "./bots";
import { PostgresTrackingStore } from "./tracking.store";
import type {
  Breakdown,
  DateRange,
  HeaderBag,
  LinkReport,
  ResolvedLink,
  TrackingEventRecord,
  TrackingReport,
  ReportFilters,
  ReportOptions,
} from "./types";

/**
 * Casos de uso do rastreamento.
 *
 * Portado de `lib/tracking/service.ts` sem mudar nenhuma das decisões, que
 * continuam valendo:
 *
 *   - **Robô não vira evento.** Contar sondagem de prévia infla o funil, e num
 *     link na bio a prévia é a maior fonte de requisição não humana.
 *   - **Contador desnormalizado por link, somado no mesmo caminho do evento.**
 *     É o que faz a lista de links e o histórico além do TTL não precisarem
 *     agregar a tabela de eventos.
 *   - **Sem estágio de conversão.** O destino é de terceiro: ninguém nos avisa
 *     quando a venda acontece no OnlyFans. O último estágio observável é o
 *     redirecionamento, e o relatório para nele.
 */

export interface ClickInput {
  link: ResolvedLink;
  /** URL do próprio redirecionador, de onde saem os UTM e os click ids. */
  requestUrl: URL;
  headers: HeaderBag;
  method: string;
  /** Domínio do pool por onde a visita entrou. Ver `arrivalHost` na entidade. */
  arrivalHost?: string;
}

export interface ClickOutcome {
  /** `false` quando o filtro classificou como robô. */
  counted: boolean;
  reason: string;
}

export interface ViewInput {
  profileId: string;
  requestUrl: URL;
  headers: HeaderBag;
  arrivalHost?: string;
}

@Injectable()
export class TrackingService {
  constructor(private readonly store: PostgresTrackingStore) {}

  async recordClick(input: ClickInput): Promise<ClickOutcome> {
    const ip = clientIP(input.headers);
    const verdict = detectBot(botSignalsFrom(input.headers, input.method, ip));

    if (verdict.isBot) {
      // Só o contador de robô sobe. O evento cru não é gravado: sob varredura
      // de crawler isso encheria a tabela de lixo e distorceria toda quebra.
      await this.store.bumpCounters(input.link.profileId, input.link.linkId, { botHits: 1 });
      return { counted: false, reason: verdict.reason };
    }

    const occurredAt = new Date();
    const event: TrackingEventRecord = {
      type: "click",
      profileId: input.link.profileId,
      linkId: input.link.linkId,
      channel: input.link.channel,
      destinationHost: hostOf(input.link.destinationUrl),
      arrivalHost: input.arrivalHost,
      occurredAt,
      attribution: parseAttribution(input.requestUrl, header(input.headers, "referer")),
      client: buildClientContext({
        userAgent: header(input.headers, "user-agent"),
        ip,
        country: edgeCountry(input.headers),
      }),
    };

    await this.store.append(event);
    await this.store.bumpCounters(input.link.profileId, input.link.linkId, {
      clicks: 1,
      lastClickAt: occurredAt,
    });

    return { counted: true, reason: verdict.reason };
  }

  async recordView(input: ViewInput): Promise<void> {
    const ip = clientIP(input.headers);
    // View usa o mesmo filtro. O perfil público é justamente o que os geradores
    // de prévia buscam, então sem isto a taxa de clique nasce diluída por
    // visitas que nunca existiram.
    if (detectBot(botSignalsFrom(input.headers, "GET", ip)).isBot) return;

    await this.store.append({
      type: "view",
      profileId: input.profileId,
      arrivalHost: input.arrivalHost,
      occurredAt: new Date(),
      attribution: parseAttribution(input.requestUrl, header(input.headers, "referer")),
      client: buildClientContext({
        userAgent: header(input.headers, "user-agent"),
        ip,
        country: edgeCountry(input.headers),
      }),
    });
  }

  /**
   * O relatório da janela, com recortes.
   *
   * Os eventos da janela vêm inteiros do banco e os filtros são aplicados
   * aqui: o volume por página é de centenas a poucos milhares de eventos
   * em 90 dias, e contar em memória custa menos que uma consulta por quebra.
   * O dia em que isto pesar, a contagem desce para o SQL com `GROUP BY` sem
   * mudar o contrato.
   *
   * A janela anterior (mesmo tamanho, mesmos filtros) vem junto, para os
   * cartões mostrarem variação medida em vez de "últimos N dias".
   */
  async report(profileId: string, range: DateRange, filters: ReportFilters = {}): Promise<TrackingReport> {
    const tamanho = range.to.getTime() - range.from.getTime();
    const anterior: DateRange = { from: new Date(range.from.getTime() - tamanho - 1), to: new Date(range.from.getTime() - 1) };

    const [eventos, eventosAnteriores, counters] = await Promise.all([
      this.store.query(profileId, range),
      this.store.query(profileId, anterior),
      this.store.counters(profileId),
    ]);

    const options: ReportOptions = {
      links: distintos(eventos, (e) => e.linkId),
      sources: distintos(eventos, origemDe),
      arrivalHosts: distintos(eventos, (e) => e.arrivalHost),
      devices: distintos(eventos, (e) => e.client.device),
      countries: distintos(eventos, (e) => e.client.country),
    };

    const { views, clicks } = separar(aplicarFiltros(eventos, filters), filters);
    const janelaAnterior = separar(aplicarFiltros(eventosAnteriores, filters), filters);

    const botHits = Object.values(counters).reduce((sum, counter) => sum + counter.botHits, 0);
    const inAppClicks = clicks.filter((event) => event.client.inAppBrowser).length;

    return {
      profileId,
      from: range.from.toISOString(),
      to: range.to.toISOString(),
      views: views.length,
      clicks: clicks.length,
      clickRate: views.length ? clicks.length / views.length : 0,
      botHits,
      inAppClicks,
      byChannel: tally(clicks, (event) => event.channel),
      // `(direto)` em vez de omitir: uma quebra que esconde a maior fatia
      // engana mais do que informa.
      bySource: tally(clicks, origemDe),
      byCampaign: tally(clicks, (event) => event.attribution.campaign),
      byLink: tally(clicks, (event) => event.linkId).map((row) => ({
        ...row,
        linkId: row.key,
        channel: clicks.find((event) => event.linkId === row.key)?.channel,
      })),
      byDevice: tally(clicks, (event) => event.client.device),
      byCountry: tally(clicks, (event) => event.client.country),
      byArrivalHost: tally([...views, ...clicks], (event) => event.arrivalHost),
      daily: daily(views, clicks, range),
      previous: {
        from: anterior.from.toISOString(),
        to: anterior.to.toISOString(),
        views: janelaAnterior.views.length,
        clicks: janelaAnterior.clicks.length,
        inAppClicks: janelaAnterior.clicks.filter((event) => event.client.inAppBrowser).length,
        clickRate: janelaAnterior.views.length ? janelaAnterior.clicks.length / janelaAnterior.views.length : 0,
      },
      filters,
      options,
    };
  }

  /** Métricas de um link. Quem chama já conferiu que o link é do perfil. */
  async linkReport(profileId: string, linkId: string, range: DateRange): Promise<LinkReport> {
    const [clicks, counters] = await Promise.all([
      this.store.queryLinkClicks(profileId, linkId, range),
      this.store.counters(profileId),
    ]);
    const contador = counters[linkId];

    return {
      linkId,
      from: range.from.toISOString(),
      to: range.to.toISOString(),
      clicks: clicks.length,
      inAppClicks: clicks.filter((event) => event.client.inAppBrowser).length,
      bySource: tally(
        clicks,
        (event) => event.attribution.source ?? event.attribution.referrerHost ?? "(direto)",
      ),
      byCampaign: tally(clicks, (event) => event.attribution.campaign),
      byDevice: tally(clicks, (event) => event.client.device),
      byCountry: tally(clicks, (event) => event.client.country),
      daily: daily([], clicks, range).map(({ date, clicks: n }) => ({ date, clicks: n })),
      totalClicks: contador?.clicks ?? 0,
      botHits: contador?.botHits ?? 0,
      lastClickAt: contador?.lastClickAt ?? null,
    };
  }

  /** Contadores históricos do perfil. O relatório é a janela; o contador é o
   *  total que sobrevive à expiração do evento cru. */
  async counters(profileId: string) {
    return this.store.counters(profileId);
  }
}

function header(bag: HeaderBag, name: string): string | undefined {
  const raw = bag[name.toLowerCase()];
  return Array.isArray(raw) ? raw[0] : raw;
}

function botSignalsFrom(headers: HeaderBag, method: string, ip?: string) {
  return {
    userAgent: header(headers, "user-agent") ?? "",
    ip,
    method,
    acceptLanguage: header(headers, "accept-language"),
    accept: header(headers, "accept"),
    secChUa: header(headers, "sec-ch-ua"),
    secFetchMode: header(headers, "sec-fetch-mode"),
  };
}

/** Agrupa e ordena por volume. Chave ausente é descartada — linha sem
 *  identidade não ajuda ninguém a decidir nada (é também o que faz um link
 *  apagado desaparecer da quebra sem derrubar o total). */
function tally(
  events: TrackingEventRecord[],
  key: (event: TrackingEventRecord) => string | undefined,
): Breakdown[] {
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
  views: TrackingEventRecord[],
  clicks: TrackingEventRecord[],
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
    const bucket = buckets.get(event.occurredAt.toISOString().slice(0, 10));
    if (bucket) bucket.views += 1;
  }
  for (const event of clicks) {
    const bucket = buckets.get(event.occurredAt.toISOString().slice(0, 10));
    if (bucket) bucket.clicks += 1;
  }

  return [...buckets.entries()].map(([date, value]) => ({ date, ...value }));
}

/** A origem de um evento, como a tela mostra: utm_source, senão o site de
 *  onde veio, senão "(direto)". A mesma chave serve para quebrar e filtrar. */
function origemDe(event: TrackingEventRecord): string {
  return event.attribution.source ?? event.attribution.referrerHost ?? "(direto)";
}

function distintos(events: TrackingEventRecord[], key: (event: TrackingEventRecord) => string | undefined): string[] {
  const vistos = new Set<string>();
  for (const event of events) {
    const value = key(event);
    if (value) vistos.add(value);
  }
  return [...vistos].sort((a, b) => a.localeCompare(b));
}

/** Filtros que valem para visita e clique. O de link fica em `separar`. */
function aplicarFiltros(events: TrackingEventRecord[], f: ReportFilters): TrackingEventRecord[] {
  const sources = f.sources?.length ? new Set(f.sources) : null;
  const hosts = f.arrivalHosts?.length ? new Set(f.arrivalHosts) : null;
  const devices = f.devices?.length ? new Set(f.devices) : null;
  const countries = f.countries?.length ? new Set(f.countries) : null;
  return events.filter((event) => {
    if (sources && !sources.has(origemDe(event))) return false;
    if (hosts && !hosts.has(event.arrivalHost ?? "")) return false;
    if (devices && !devices.has(event.client.device)) return false;
    if (countries && !countries.has(event.client.country ?? "")) return false;
    if (f.inApp === true && !event.client.inAppBrowser) return false;
    if (f.inApp === false && event.client.inAppBrowser) return false;
    return true;
  });
}

/** Visitas e cliques; o filtro de link só corta os cliques. */
function separar(events: TrackingEventRecord[], f: ReportFilters): { views: TrackingEventRecord[]; clicks: TrackingEventRecord[] } {
  const links = f.links?.length ? new Set(f.links) : null;
  return {
    views: events.filter((event) => event.type === "view"),
    clicks: events.filter((event) => event.type === "click" && (!links || links.has(event.linkId ?? ""))),
  };
}
