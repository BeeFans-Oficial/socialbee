import { createHash } from "node:crypto";

import { Injectable } from "@nestjs/common";

import { loadEnv } from "../config/env";
import {
  buildClientContext,
  chavesDoVisitante,
  clientIP,
  detectBrowser,
  edgeCountry,
  hostOf,
  mesmoHost,
  parseAttribution,
} from "./attribution";
import { detectBot } from "./bots";
import { countryOfIp } from "./geo";
import { PostgresTrackingStore } from "./tracking.store";
import { ETAPAS, SAIDA } from "./types";
import type {
  Breakdown,
  DateRange,
  Etapa,
  FunnelStage,
  HeaderBag,
  LinkReport,
  ReportEvent,
  ReportKpis,
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
  /** A etapa (ver `ETAPAS`). Só `view` é a visita contada. */
  type?: Exclude<Etapa, "click"> | "leave";
  /** URL da PÁGINA, informada pelo navegador: é dela que saem UTM e click ids.
   *  A URL da requisição é a da API e nunca carrega nada disso. */
  requestUrl: URL;
  /** `document.referrer` da página. `undefined` quando o cliente não informou
   *  (versão antiga em cache): aí vale o cabeçalho, com o próprio domínio
   *  descartado. */
  referrer?: string;
  headers: HeaderBag;
  arrivalHost?: string;
}

/** Quantas linhas a lista de eventos do relatório devolve. */
export const MAX_EVENTOS_NA_LISTA = 1000;

/** Por quanto tempo um evento sem origem herda a do mesmo visitante. */
const JANELA_DA_SESSAO_MS = 30 * 60_000;

/** Até quanto tempo depois de uma chegada dentro de app uma visita "direta" da
 *  mesma rede é tratada como a mesma pessoa, já no navegador do celular. */
const JANELA_DA_SAIDA_DO_APP_MS = 10 * 60_000;

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
      // O `Referer` do clique é a própria página: descartado aqui, e a origem
      // vem da chegada do mesmo visitante, no relatório (ver `resolver`).
      attribution: parseAttribution(input.requestUrl, header(input.headers, "referer"), input.arrivalHost),
      client: this.contexto(input.link.profileId, input.headers, ip, occurredAt),
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

    const occurredAt = new Date();
    await this.store.append({
      type: input.type ?? "view",
      profileId: input.profileId,
      arrivalHost: input.arrivalHost,
      occurredAt,
      attribution: parseAttribution(
        input.requestUrl,
        input.referrer ?? header(input.headers, "referer"),
        input.arrivalHost,
      ),
      client: this.contexto(input.profileId, input.headers, ip, occurredAt),
    });
  }

  /** Contexto do visitante: aparelho, país e as chaves diárias. */
  private contexto(profileId: string, headers: HeaderBag, ip: string | undefined, when: Date) {
    const userAgent = header(headers, "user-agent");
    return buildClientContext({
      userAgent,
      ip,
      // A borda primeiro, quando existe; sem ela, a base de IP embutida.
      country: edgeCountry(headers) ?? countryOfIp(ip),
      chaves: chavesDoVisitante({ secret: loadEnv().jwtSecret, profileId, ip, userAgent, when }),
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

    const resolvidos = resolver(eventos);
    // As opções saem de visitas e cliques — a chegada não é contada em lugar
    // nenhum, então uma origem que só ela tem não recortaria nada.
    const contados = resolvidos.filter((r) => r.event.type === "view" || r.event.type === "click");

    const options: ReportOptions = {
      links: distintos(contados, (r) => r.event.linkId),
      sources: distintos(contados, (r) => r.origem),
      arrivalHosts: distintos(contados, (r) => r.event.arrivalHost),
      devices: distintos(contados, (r) => r.event.client.device),
      countries: distintos(contados, (r) => r.event.client.country),
    };

    const filtrados = aplicarFiltros(resolvidos, filters);
    const { views, clicks, passos } = caminho(filtrados, filters);
    const alcance = alcancePorVisitante(passos);
    const saidas = filtrados.filter((r) => r.event.type === SAIDA);
    const sairam = quemSaiuOndeParou(passos, saidas, alcance);
    const clicados = linksPorVisitante(clicks);
    // Com filtro de link, a lista vira o caminho de quem clicou NELE: os
    // passos de todo mundo continuam no funil (é o que mostra de quantos
    // visitantes esses cliques saíram), mas "um a um" interessa só quem chegou
    // ao link escolhido.
    const comSaidas = [...passos, ...saidas];
    const passosDaLista = filters.links?.length ? comSaidas.filter((r) => clicados.has(r.visitante)) : comSaidas;
    const janelaAnterior = caminho(aplicarFiltros(resolver(eventosAnteriores), filters), filters);
    const etapas = funil(passos, alcance, clicks, sairam);

    const botHits = Object.values(counters).reduce((sum, counter) => sum + counter.botHits, 0);
    const emApp = (lista: Resolvido[]) => lista.filter((r) => r.event.client.inAppBrowser).length;

    return {
      profileId,
      from: range.from.toISOString(),
      to: range.to.toISOString(),
      views: views.length,
      visitors: visitantes(views),
      clicks: clicks.length,
      clickRate: views.length ? clicks.length / views.length : 0,
      botHits,
      inAppClicks: emApp(clicks),
      byChannel: tally(clicks, (r) => r.event.channel),
      // `(direto)` em vez de omitir: uma quebra que esconde a maior fatia
      // engana mais do que informa.
      bySource: tally(clicks, (r) => r.origem),
      byCampaign: tally(clicks, (r) => r.campanha),
      byLink: tally(clicks, (r) => r.event.linkId).map((row) => ({
        ...row,
        linkId: row.key,
        channel: clicks.find((r) => r.event.linkId === row.key)?.event.channel,
      })),
      byDevice: tally(clicks, (r) => r.event.client.device),
      byCountry: tally(clicks, (r) => r.event.client.country),
      byArrivalHost: tally([...views, ...clicks], (r) => r.event.arrivalHost),
      daily: daily(views, clicks, range),
      previous: {
        from: anterior.from.toISOString(),
        to: anterior.to.toISOString(),
        views: janelaAnterior.views.length,
        visitors: visitantes(janelaAnterior.views),
        clicks: janelaAnterior.clicks.length,
        inAppClicks: emApp(janelaAnterior.clicks),
        clickRate: janelaAnterior.views.length ? janelaAnterior.clicks.length / janelaAnterior.views.length : 0,
      },
      funnel: etapas,
      kpis: indicadores({ etapas, passos, views, clicks, saidas, alcance, clicados, anterior: alcancePorVisitante(janelaAnterior.passos) }),
      eventsTotal: passosDaLista.length,
      events: [...passosDaLista]
        .sort((x, y) => y.event.occurredAt.getTime() - x.event.occurredAt.getTime())
        .slice(0, MAX_EVENTOS_NA_LISTA)
        .map((r) => linhaDaLista(r, alcance, clicados)),
      filters,
      options,
    };
  }

  /** Métricas de um link. Quem chama já conferiu que o link é do perfil. */
  async linkReport(profileId: string, linkId: string, range: DateRange): Promise<LinkReport> {
    // Os eventos da PÁGINA inteira, e não só os cliques do link: a origem de
    // um clique vem da chegada do mesmo visitante, que não tem link.
    const [eventos, counters] = await Promise.all([
      this.store.query(profileId, range),
      this.store.counters(profileId),
    ]);
    const clicks = resolver(eventos).filter((r) => r.event.type === "click" && r.event.linkId === linkId);
    const contador = counters[linkId];

    return {
      linkId,
      from: range.from.toISOString(),
      to: range.to.toISOString(),
      clicks: clicks.length,
      inAppClicks: clicks.filter((r) => r.event.client.inAppBrowser).length,
      bySource: tally(clicks, (r) => r.origem),
      byCampaign: tally(clicks, (r) => r.campanha),
      byDevice: tally(clicks, (r) => r.event.client.device),
      byCountry: tally(clicks, (r) => r.event.client.country),
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

/**
 * Um evento com o que o relatório deduz dele: de onde veio e de quem é.
 *
 * Nada disto é gravado. A origem de um clique depende da chegada que veio
 * antes, e a regra de quem herda de quem precisa poder mudar sem migrar dado.
 */
export interface Resolvido {
  event: TrackingEventRecord;
  /** `utm_source`, app, site de origem ou "(direto)". É a chave do filtro. */
  origem: string;
  campanha?: string;
  /** Chave do visitante, já unificada entre o app e o navegador do celular. */
  visitante: string;
}

/**
 * Resolve origem e visitante de cada evento, em ordem de tempo.
 *
 * A origem própria de um evento, na ordem em que vale:
 *
 *   1. `utm_source` — a criadora disse de onde é.
 *   2. o aplicativo em que a página abriu (`instagram`, `tiktok`…) — é o que o
 *      user-agent prova, e é mais legível que `l.instagram.com`.
 *   3. o site de onde a pessoa veio, se não for a própria página.
 *
 * Sem origem própria, o evento HERDA:
 *
 *   4. do mesmo visitante, até 30 minutos antes. É assim que o clique ganha
 *      origem: o `Referer` dele é sempre a própria página.
 *   5. de uma chegada dentro de app, na mesma rede, até 10 minutos antes. É a
 *      saída do aplicativo: a pessoa abre no Instagram, toca em "continuar" e
 *      reaparece no navegador do celular com outro user-agent, sem referrer e
 *      com a URL limpa — de propósito, a página não marca por onde ela passou
 *      (ver `app/[slug]/IabLanding.tsx`). Aqui as duas metades viram um
 *      visitante só.
 *
 * O passo 5 é uma inferência: duas pessoas na mesma rede em dez minutos, uma
 * no Instagram e outra entrando direto, seriam costuradas. Numa página de
 * criadora isso é raro, e errar para o lado do aplicativo — de onde quase todo
 * o tráfego vem — custa menos do que chamar de "(direto)" tudo o que saiu dele.
 *
 * Evento que ficou fora da janela consultada não é visto: uma chegada um
 * minuto antes do início do período não empresta origem a ninguém.
 */
export function resolver(eventos: TrackingEventRecord[]): Resolvido[] {
  const emOrdem = [...eventos].sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());

  const porVisitante = new Map<string, { origem: string; campanha?: string; em: number }>();
  const appPorRede = new Map<string, { origem: string; campanha?: string; visitante: string; em: number }>();
  /** Visitante do navegador de fora → o visitante que ele era dentro do app. */
  const mesmaPessoa = new Map<string, string>();

  return emOrdem.map((event, indice) => {
    const em = event.occurredAt.getTime();
    const bruta = chaveDoVisitante(event) ?? `sem-chave:${indice}`;
    let visitante = mesmaPessoa.get(bruta) ?? bruta;
    const rede = chaveDaRede(event);

    let origem = origemPropria(event);
    let campanha = event.attribution.campaign;

    if (!origem) {
      const antes = porVisitante.get(visitante);
      if (antes && em - antes.em <= JANELA_DA_SESSAO_MS) {
        origem = antes.origem;
        campanha ??= antes.campanha;
      } else if (rede && !event.client.inAppBrowser) {
        const app = appPorRede.get(rede);
        if (app && em - app.em <= JANELA_DA_SAIDA_DO_APP_MS) {
          origem = app.origem;
          campanha ??= app.campanha;
          mesmaPessoa.set(bruta, app.visitante);
          visitante = app.visitante;
        }
      }
    }

    // Mesma pessoa, mesma origem, sem campanha neste evento: vale a da sessão.
    // Sem isto, um passo sem UTM (o toque em "continuar" dentro do app, cuja
    // origem é o próprio aplicativo) apagava a campanha que a chegada trouxe.
    if (origem && !campanha) {
      const antes = porVisitante.get(visitante);
      if (antes && antes.origem === origem && em - antes.em <= JANELA_DA_SESSAO_MS) campanha = antes.campanha;
    }

    if (origem) {
      porVisitante.set(visitante, { origem, campanha, em });
      if (event.client.inAppBrowser && rede) appPorRede.set(rede, { origem, campanha, visitante, em });
    }

    return { event, origem: origem ?? "(direto)", campanha, visitante };
  });
}

function origemPropria(event: TrackingEventRecord): string | undefined {
  if (event.attribution.source) return event.attribution.source;
  if (event.client.inAppBrowser) return event.client.inAppBrowser;
  // Eventos antigos gravaram a própria página como referrer (ver
  // `parseAttribution`); a comparação aqui conserta o histórico na leitura.
  const referrer = event.attribution.referrerHost;
  if (referrer && !mesmoHost(referrer, event.arrivalHost)) return referrer;
  return undefined;
}

/** A chave gravada; nos eventos anteriores a ela, rede aproximada + navegador
 *  + dia, que é o mais perto que o dado antigo chega. */
function chaveDoVisitante(event: TrackingEventRecord): string | undefined {
  if (event.client.visitor) return event.client.visitor;
  const { ipPrefix, userAgent } = event.client;
  if (!ipPrefix && !userAgent) return undefined;
  return `${event.occurredAt.toISOString().slice(0, 10)}|${ipPrefix ?? ""}|${userAgent ?? ""}`;
}

function chaveDaRede(event: TrackingEventRecord): string | undefined {
  if (event.client.net) return event.client.net;
  const { ipPrefix } = event.client;
  return ipPrefix ? `${event.occurredAt.toISOString().slice(0, 10)}|${ipPrefix}` : undefined;
}

/** Visitantes diferentes numa lista de eventos. */
function visitantes(lista: Resolvido[]): number {
  return new Set(lista.map((r) => r.visitante)).size;
}

/** Rótulo curto e estável do visitante para a tela: a chave em si nunca sai
 *  da API (a de eventos antigos carrega o user-agent inteiro). */
function rotuloDoVisitante(chave: string): string {
  return createHash("sha256").update(chave).digest("hex").slice(0, 6).toUpperCase();
}

function etapaDe(r: Resolvido): number | undefined {
  const i = (ETAPAS as readonly string[]).indexOf(r.event.type);
  return i >= 0 ? i : undefined;
}

/** A etapa mais adiantada de cada visitante. */
function alcancePorVisitante(passos: Resolvido[]): Map<string, number> {
  const alcance = new Map<string, number>();
  for (const r of passos) {
    const etapa = etapaDe(r);
    if (etapa === undefined) continue;
    if (etapa > (alcance.get(r.visitante) ?? -1)) alcance.set(r.visitante, etapa);
  }
  return alcance;
}

/**
 * O funil: quantos visitantes chegaram a cada etapa.
 *
 * Conta PESSOAS (a chave diária do visitante, já costurada entre o app e o
 * navegador do celular), não eventos. Quem tem evento numa etapa conta em
 * todas as anteriores — os links não aparecem sem a pessoa ter aberto a
 * página, mesmo que o evento da abertura não exista (histórico anterior à
 * chegada ser gravada, requisição perdida). É o que mantém o funil sempre
 * decrescente.
 *
 * `continue` e `age` só entram quando há evento delas no recorte: página sem
 * tela de chegada ou sem barreira de idade não tem essas etapas, e mostrá-las
 * com o número da etapa seguinte inventaria um passo que não existiu.
 */
function funil(
  passos: Resolvido[],
  alcance: Map<string, number>,
  clicks: Resolvido[],
  sairam: Set<string>,
): FunnelStage[] {
  if (alcance.size === 0) return [];
  const presentes = new Set(passos.map((r) => r.event.type));
  const etapas = ETAPAS.map((stage, i) => ({ stage, i })).filter(
    ({ stage }) => (stage !== "continue" && stage !== "age") || presentes.has(stage),
  );
  return etapas.map(({ stage, i }, posicao) => {
    // Quem parou AQUI: chegou a esta etapa e não à próxima MOSTRADA. Uma etapa
    // omitida (página sem barreira de idade) não pode esconder gente entre
    // duas barras.
    const proxima = etapas[posicao + 1]?.i;
    const pararam = proxima === undefined ? [] : [...alcance].filter(([, n]) => n >= i && n < proxima);
    return {
      stage,
      visitors: [...alcance.values()].filter((n) => n >= i).length,
      stopped: pararam.length,
      left: pararam.filter(([visitante]) => sairam.has(visitante)).length,
      ...(stage === "click" ? { links: visitantesPorLink(clicks) } : {}),
    };
  });
}

/**
 * Os indicadores do recorte (ver `ReportKpis`).
 *
 * Saem do que o funil já montou: nenhuma leitura nova, nenhum evento novo. A
 * conversão é "de quem abriu, quantos clicaram", em pessoas — diferente de
 * "cliques por visita", que divide eventos e passa de 1 quando alguém toca em
 * três links.
 */
function indicadores(dados: {
  etapas: FunnelStage[];
  passos: Resolvido[];
  views: Resolvido[];
  clicks: Resolvido[];
  saidas: Resolvido[];
  alcance: Map<string, number>;
  clicados: Map<string, string[]>;
  /** O alcance por visitante da janela anterior, para comparar a conversão. */
  anterior: Map<string, number>;
}): ReportKpis {
  const { etapas, passos, views, clicks, saidas, alcance, clicados, anterior } = dados;
  const CLIQUE = ETAPAS.indexOf("click");
  const taxa = (mapa: Map<string, number>) => {
    const clicaram = [...mapa.values()].filter((n) => n >= CLIQUE).length;
    return { visitors: mapa.size, clickers: clicaram, rate: mapa.size ? clicaram / mapa.size : 0 };
  };
  const agora = taxa(alcance);

  // Empate fica com a etapa mais cedo: é a primeira que vale consertar.
  const pior = etapas.reduce<FunnelStage | null>((p, e) => (e.stopped > (p?.stopped ?? 0) ? e : p), null);

  const primeiroPasso = new Map<string, number>();
  const primeiroClique = new Map<string, number>();
  for (const r of passos) {
    const em = r.event.occurredAt.getTime();
    if (em < (primeiroPasso.get(r.visitante) ?? Infinity)) primeiroPasso.set(r.visitante, em);
    if (r.event.type === "click" && em < (primeiroClique.get(r.visitante) ?? Infinity)) primeiroClique.set(r.visitante, em);
  }
  const ateOClique = [...primeiroClique].map(([v, em]) => em - (primeiroPasso.get(v) ?? em));

  const ultimaSaida = new Map<string, number>();
  for (const r of saidas) {
    const em = r.event.occurredAt.getTime();
    if (em > (ultimaSaida.get(r.visitante) ?? -Infinity)) ultimaSaida.set(r.visitante, em);
  }
  const antesDeSair = [...ultimaSaida]
    .filter(([v]) => primeiroPasso.has(v) && !primeiroClique.has(v))
    .map(([v, em]) => em - primeiroPasso.get(v)!)
    .filter((ms) => ms >= 0);

  const chegaramNoApp = new Set(passos.filter((r) => r.event.type === "arrival" && r.event.client.inAppBrowser).map((r) => r.visitante));
  const continuaram = new Set(passos.filter((r) => r.event.type === "continue").map((r) => r.visitante));
  // Quem continuou esteve no app, mesmo que a chegada dela não tenha sido gravada.
  const noApp = new Set([...chegaramNoApp, ...continuaram]);

  const porHora = (lista: Resolvido[]) => {
    const horas = new Array<number>(24).fill(0);
    for (const r of lista) horas[r.event.occurredAt.getUTCHours()] += 1;
    return horas;
  };

  const links = [...clicados.values()].map((l) => l.length);

  return {
    conversion: { ...agora, previousRate: anterior.size ? taxa(anterior).rate : null },
    biggestDrop: pior && agora.visitors ? { stage: pior.stage, stopped: pior.stopped, share: pior.stopped / agora.visitors } : null,
    timeToClick: ateOClique.length ? { medianMs: mediana(ateOClique), sample: ateOClique.length } : null,
    timeBeforeLeaving: antesDeSair.length ? { medianMs: mediana(antesDeSair), sample: antesDeSair.length } : null,
    appExit: continuaram.size ? { arrived: noApp.size, continued: continuaram.size, rate: continuaram.size / noApp.size } : null,
    linksPerClicker: links.length ? links.reduce((a, b) => a + b, 0) / links.length : 0,
    byHour: { views: porHora(views), clicks: porHora(clicks) },
  };
}

function mediana(valores: number[]): number {
  const v = [...valores].sort((a, b) => a - b);
  const meio = Math.floor(v.length / 2);
  return v.length % 2 ? v[meio] : Math.round((v[meio - 1] + v[meio]) / 2);
}

/**
 * Quem saiu da página na etapa em que parou.
 *
 * Vale a saída registrada DEPOIS de a pessoa chegar à etapa mais adiantada
 * dela. Saída anterior não conta: quem trocou de aba na tela de chegada,
 * voltou e seguiu até os links não "saiu na chegada" — e é também o que faz a
 * saída do aplicativo (a página some no Instagram e a pessoa reaparece no
 * navegador do celular) não virar abandono.
 */
function quemSaiuOndeParou(passos: Resolvido[], saidas: Resolvido[], alcance: Map<string, number>): Set<string> {
  const chegouEm = new Map<string, number>();
  for (const r of passos) {
    if (etapaDe(r) !== alcance.get(r.visitante)) continue;
    const em = r.event.occurredAt.getTime();
    if (em < (chegouEm.get(r.visitante) ?? Infinity)) chegouEm.set(r.visitante, em);
  }
  const sairam = new Set<string>();
  for (const r of saidas) {
    const desde = chegouEm.get(r.visitante);
    if (desde !== undefined && r.event.occurredAt.getTime() >= desde) sairam.add(r.visitante);
  }
  return sairam;
}

/**
 * A última etapa, aberta por link: "clicou em um link" não diz em QUAL, e uma
 * página com Telegram, Instagram e OnlyFans tem três respostas diferentes.
 *
 * Conta visitantes, como o resto do funil — quem tocou três vezes no mesmo
 * link é uma pessoa; os toques ficam em `clicks`. Quem clicou em dois links
 * conta nos dois. Clique em link já apagado não tem `linkId` e fica de fora.
 */
function visitantesPorLink(clicks: Resolvido[]): NonNullable<FunnelStage["links"]> {
  const porLink = new Map<string, { channel?: string; visitantes: Set<string>; clicks: number }>();
  for (const r of clicks) {
    const id = r.event.linkId;
    if (!id) continue;
    const linha = porLink.get(id) ?? { channel: r.event.channel, visitantes: new Set<string>(), clicks: 0 };
    linha.visitantes.add(r.visitante);
    linha.clicks += 1;
    porLink.set(id, linha);
  }
  return [...porLink.entries()]
    .map(([linkId, l]) => ({ linkId, channel: l.channel, visitors: l.visitantes.size, clicks: l.clicks }))
    .sort((a, b) => b.visitors - a.visitors || b.clicks - a.clicks);
}

/** Os links em que cada visitante clicou, na ordem do primeiro clique. */
function linksPorVisitante(clicks: Resolvido[]): Map<string, string[]> {
  const mapa = new Map<string, string[]>();
  const emOrdem = [...clicks].sort((a, b) => a.event.occurredAt.getTime() - b.event.occurredAt.getTime());
  for (const r of emOrdem) {
    const id = r.event.linkId;
    if (!id) continue;
    const lista = mapa.get(r.visitante) ?? [];
    if (!lista.includes(id)) lista.push(id);
    mapa.set(r.visitante, lista);
  }
  return mapa;
}

function linhaDaLista(r: Resolvido, alcance: Map<string, number>, clicados: Map<string, string[]>): ReportEvent {
  const { event } = r;
  return {
    type: event.type === SAIDA ? SAIDA : ETAPAS[etapaDe(r) ?? 0],
    reached: ETAPAS[alcance.get(r.visitante) ?? etapaDe(r) ?? 0],
    reachedLinks: clicados.get(r.visitante) ?? [],
    at: event.occurredAt.toISOString(),
    linkId: event.linkId,
    channel: event.channel,
    destinationHost: event.destinationHost,
    arrivalHost: event.arrivalHost,
    source: r.origem,
    medium: event.attribution.medium,
    campaign: r.campanha,
    clickIds: Object.keys(event.attribution.clickIds ?? {}),
    device: event.client.device,
    os: event.client.os,
    browser: event.client.browser ?? detectBrowser(event.client.userAgent ?? ""),
    inApp: event.client.inAppBrowser,
    country: event.client.country,
    network: event.client.ipPrefix,
    visitor: rotuloDoVisitante(r.visitante),
  };
}

/** Agrupa e ordena por volume. Chave ausente é descartada — linha sem
 *  identidade não ajuda ninguém a decidir nada (é também o que faz um link
 *  apagado desaparecer da quebra sem derrubar o total). */
function tally(events: Resolvido[], key: (r: Resolvido) => string | undefined): Breakdown[] {
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
function daily(views: Resolvido[], clicks: Resolvido[], range: DateRange): TrackingReport["daily"] {
  const buckets = new Map<string, { views: number; clicks: number }>();

  const cursor = new Date(
    Date.UTC(range.from.getUTCFullYear(), range.from.getUTCMonth(), range.from.getUTCDate()),
  );
  const last = Date.UTC(range.to.getUTCFullYear(), range.to.getUTCMonth(), range.to.getUTCDate());
  while (cursor.getTime() <= last) {
    buckets.set(cursor.toISOString().slice(0, 10), { views: 0, clicks: 0 });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  for (const { event } of views) {
    const bucket = buckets.get(event.occurredAt.toISOString().slice(0, 10));
    if (bucket) bucket.views += 1;
  }
  for (const { event } of clicks) {
    const bucket = buckets.get(event.occurredAt.toISOString().slice(0, 10));
    if (bucket) bucket.clicks += 1;
  }

  return [...buckets.entries()].map(([date, value]) => ({ date, ...value }));
}

function distintos(lista: Resolvido[], key: (r: Resolvido) => string | undefined): string[] {
  const vistos = new Set<string>();
  for (const r of lista) {
    const value = key(r);
    if (value) vistos.add(value);
  }
  return [...vistos].sort((a, b) => a.localeCompare(b));
}

/** Filtros que valem para visita e clique. O de link fica em `separar`. */
function aplicarFiltros(lista: Resolvido[], f: ReportFilters): Resolvido[] {
  const sources = f.sources?.length ? new Set(f.sources) : null;
  const hosts = f.arrivalHosts?.length ? new Set(f.arrivalHosts) : null;
  const devices = f.devices?.length ? new Set(f.devices) : null;
  const countries = f.countries?.length ? new Set(f.countries) : null;
  return lista.filter(({ event, origem }) => {
    if (sources && !sources.has(origem)) return false;
    if (hosts && !hosts.has(event.arrivalHost ?? "")) return false;
    if (devices && !devices.has(event.client.device)) return false;
    if (countries && !countries.has(event.client.country ?? "")) return false;
    if (f.inApp === true && !event.client.inAppBrowser) return false;
    if (f.inApp === false && event.client.inAppBrowser) return false;
    return true;
  });
}

/**
 * O caminho inteiro de um recorte já filtrado: as visitas e os cliques (que
 * contam nos totais) e, em `passos`, eles mais as etapas que não contam
 * (chegada, continuar, 18+). A saída fica de fora: não é etapa.
 */
function caminho(filtrados: Resolvido[], f: ReportFilters): { views: Resolvido[]; clicks: Resolvido[]; passos: Resolvido[] } {
  const { views, clicks } = separar(filtrados, f);
  const outras = filtrados.filter((r) => !["view", "click"].includes(r.event.type) && etapaDe(r) !== undefined);
  return { views, clicks, passos: [...outras, ...views, ...clicks] };
}

/** Visitas e cliques; o filtro de link só corta os cliques. A chegada
 *  (`arrival`) não entra em nenhum dos dois. */
function separar(lista: Resolvido[], f: ReportFilters): { views: Resolvido[]; clicks: Resolvido[] } {
  const links = f.links?.length ? new Set(f.links) : null;
  return {
    views: lista.filter((r) => r.event.type === "view"),
    clicks: lista.filter((r) => r.event.type === "click" && (!links || links.has(r.event.linkId ?? ""))),
  };
}
