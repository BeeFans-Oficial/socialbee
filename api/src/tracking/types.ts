/**
 * Domínio de rastreamento de links.
 *
 * Portado de `lib/tracking/types.ts` do MVP, sem mudança de decisão: `channel`
 * segue string aberta, o destino segue qualquer URL http(s), o funil segue
 * terminando no redirecionamento (o destino é de terceiro e ninguém nos avisa
 * quando a venda acontece lá), e **toda leitura e escrita segue escopada por
 * `profileId`** — multi-perfil sem isso é vazamento de dados entre criadoras.
 *
 * O que muda ao virar API: `TrackingStore` deixa de ser arquivo e passa a ser
 * Postgres. A interface foi mantida porque é ela que permite testar o serviço
 * sem banco, e porque o contrato já estava certo.
 *
 * A representação de cabeçalhos mudou de `Headers` (web) para `HeaderBag` (a
 * forma do Node/Express). É a única concessão do porte.
 */

export type TrackingEventType = "view" | "click" | (string & {});

/** Cabeçalhos como o Node os entrega: chaves em minúsculas, valor podendo ser
 *  lista (o caso de `set-cookie` e de cabeçalhos repetidos). */
export type HeaderBag = Record<string, string | string[] | undefined>;

export function header(bag: HeaderBag, name: string): string | undefined {
  const raw = bag[name.toLowerCase()];
  if (Array.isArray(raw)) return raw[0];
  return raw ?? undefined;
}

/** Atribuição capturada no momento do evento.
 *
 *  Os `clickIds` ficam num mapa aberto — `fbclid`, `gclid`, `ttclid`, `twclid`,
 *  `msclkid` e o que vier depois — em vez de virarem colunas, que foi o
 *  acoplamento do projeto de referência. */
export interface Attribution {
  source?: string;
  medium?: string;
  campaign?: string;
  content?: string;
  term?: string;
  /** Host do referrer, não a URL inteira: o caminho pode conter dado pessoal e
   *  não serve para nenhuma agregação que a tela faça. */
  referrerHost?: string;
  clickIds: Record<string, string>;
}

/** Contexto técnico do visitante. Só o que alimenta relatório ou filtro de
 *  robô — nada aqui existe para identificar pessoa. */
export interface ClientContext {
  device: "mobile" | "tablet" | "desktop" | "unknown";
  os?: string;
  /** Navegador embutido de app ("instagram", "facebook", "tiktok"…). É o dado
   *  mais valioso do produto: mede quanto do tráfego chega preso dentro do app
   *  e justifica o escape. */
  inAppBrowser?: string;
  /** ISO 3166-1 alfa-2, quando a borda informa. */
  country?: string;
  /** Prefixo /24 do IPv4 (ou /48 do IPv6). O IP inteiro seria dado pessoal sem
   *  uso: a tela nunca desce abaixo de país, e o filtro de robô decide ANTES de
   *  o evento ser gravado. */
  ipPrefix?: string;
  userAgent?: string;
}

export interface BotVerdict {
  isBot: boolean;
  /** Quanto maior, mais certeza. >= 1000 é bloqueio direto (robô declarado). */
  score: number;
  reason: string;
}

/** Um evento gravado. Fluxo único para view e click. */
export interface TrackingEventRecord {
  type: TrackingEventType;
  profileId: string;
  /** Ausente em `view` (o evento é do perfil, não de um link). */
  linkId?: string;
  channel?: string;
  destinationHost?: string;
  occurredAt: Date;
  attribution: Attribution;
  client: ClientContext;
}

/** Contadores desnormalizados por link.
 *
 *  Evento cru é volume e tem TTL; contador é histórico e é para sempre. */
export interface LinkCounters {
  clicks: number;
  /** Requisições descartadas pelo filtro de robô. Fica visível de propósito:
   *  sem isso a criadora acha que perdeu tráfego. */
  botHits: number;
  lastClickAt?: string;
}

export interface Breakdown {
  key: string;
  clicks: number;
  share: number;
}

/** Relatório do dashboard, já escopado num perfil. */
export interface TrackingReport {
  profileId: string;
  from: string;
  to: string;
  views: number;
  clicks: number;
  /** clicks / views. 0 quando não houve view — nunca divisão por zero. */
  clickRate: number;
  botHits: number;
  inAppClicks: number;
  byChannel: Breakdown[];
  bySource: Breakdown[];
  byCampaign: Breakdown[];
  byLink: Array<Breakdown & { linkId: string; channel?: string }>;
  daily: Array<{ date: string; views: number; clicks: number }>;
}

/** Link resolvido a partir do código curto. */
export interface ResolvedLink {
  linkId: string;
  profileId: string;
  channel: string;
  destinationUrl: string;
  isActive: boolean;
}

export interface DateRange {
  from: Date;
  to: Date;
}

/** Persistência. Pequena de propósito: é a superfície que o Postgres cobre e
 *  que um duplo de teste consegue implementar em dez linhas. */
export interface TrackingStore {
  append(event: TrackingEventRecord): Promise<void>;
  /** Soma nos contadores do link. `patch` é parcial para o chamador incrementar
   *  só o que aconteceu (um clique OU um hit de robô). */
  bumpCounters(
    profileId: string,
    linkId: string,
    patch: Partial<Pick<LinkCounters, "clicks" | "botHits">> & { lastClickAt?: Date },
  ): Promise<void>;
  counters(profileId: string): Promise<Record<string, LinkCounters>>;
  query(profileId: string, range: DateRange): Promise<TrackingEventRecord[]>;
}
