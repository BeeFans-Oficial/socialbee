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

/**
 * `arrival` é a CHEGADA: todo carregamento da página, antes da barreira de
 * idade. Não entra em nenhum total — existe para o relatório saber de onde a
 * pessoa veio. Numa página adulta aberta dentro do Instagram, a visita (`view`)
 * só acontece depois, já no navegador do celular, onde não sobra referrer nem
 * user-agent do aplicativo; sem a chegada, essa origem nunca seria vista.
 */
export type TrackingEventType = "view" | "click" | "arrival" | "continue" | "age" | (string & {});

/**
 * As etapas do caminho de uma visitante, na ordem em que acontecem.
 *
 *   arrival   abriu a página
 *   continue  tocou no botão da tela de chegada (dentro de um app, é o que a
 *             leva ao navegador do celular)
 *   age       passou pela barreira de 18+
 *   view      os links apareceram — é a visita contada
 *   click     tocou num link
 *
 * `continue` e `age` só existem em página com tela de chegada ou barreira de
 * idade, e só nos eventos posteriores a esta lista existir. Só `view` e
 * `click` entram nos totais; as outras servem ao funil e à origem.
 */
export const ETAPAS = ["arrival", "continue", "age", "view", "click"] as const;
export type Etapa = (typeof ETAPAS)[number];

/** Uma etapa do funil: quantos visitantes chegaram até ela. */
export interface FunnelStage {
  stage: Etapa;
  visitors: number;
  /** Só na etapa `click`: quantos visitantes clicaram em CADA link. Quem
   *  clicou em dois links conta nos dois, então a soma pode passar do total
   *  da etapa. */
  links?: Array<{ linkId: string; channel?: string; visitors: number; clicks: number }>;
}

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
  /** ISO 3166-1 alfa-2: da borda, quando ela informa, senão da base de IP
   *  embutida (`geo.ts`). */
  country?: string;
  /** Prefixo /24 do IPv4 (ou /48 do IPv6). O IP inteiro seria dado pessoal sem
   *  uso: a lista de eventos mostra a rede, nunca o endereço, e o filtro de
   *  robô decide ANTES de o evento ser gravado. */
  ipPrefix?: string;
  userAgent?: string;
  /** "Chrome", "Safari"… Ausente nos eventos antigos: o relatório deduz do
   *  `userAgent` nesses casos. */
  browser?: string;
  /** Chave diária do visitante (rede + navegador). Ver `chavesDoVisitante`. */
  visitor?: string;
  /** Chave diária da rede, sem o navegador. Ver `chavesDoVisitante`. */
  net?: string;
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
  /** Domínio do pool por onde a visita entrou. Ver a coluna na entidade. */
  arrivalHost?: string;
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
/** Métricas de UM link: os cliques da janela e o total histórico dele. */
export interface LinkReport {
  linkId: string;
  from: string;
  to: string;
  /** Cliques humanos na janela. */
  clicks: number;
  inAppClicks: number;
  bySource: Breakdown[];
  byCampaign: Breakdown[];
  byDevice: Breakdown[];
  byCountry: Breakdown[];
  daily: Array<{ date: string; clicks: number }>;
  /** Totais do contador, que não expiram com o evento cru. */
  totalClicks: number;
  botHits: number;
  lastClickAt: string | null;
}

/**
 * Recortes do relatório. Cada lista é "um destes"; listas vazias ou
 * ausentes não filtram. `links` só se aplica a cliques: visita não tem
 * link, e o relatório diz isso em vez de zerar as visitas.
 */
/** Uma linha da lista de eventos da tela: um passo de uma visitante. */
export interface ReportEvent {
  type: Etapa;
  /** A etapa mais adiantada a que ESTE visitante chegou no recorte. */
  reached: Etapa;
  /** Os links em que este visitante clicou no recorte, na ordem do primeiro
   *  clique em cada um. Vazio para quem não clicou. */
  reachedLinks: string[];
  at: string;
  linkId?: string;
  channel?: string;
  destinationHost?: string;
  arrivalHost?: string;
  /** A origem RESOLVIDA (ver `resolver`), a mesma chave do filtro. */
  source: string;
  medium?: string;
  campaign?: string;
  /** Nomes dos identificadores de anúncio presentes (`fbclid`…), sem o valor. */
  clickIds: string[];
  device: string;
  os?: string;
  browser?: string;
  inApp?: string;
  country?: string;
  /** Rede aproximada (prefixo do IP). */
  network?: string;
  /** Rótulo curto do visitante: repete nas linhas da mesma pessoa no dia. */
  visitor: string;
}

export interface ReportFilters {
  links?: string[];
  /** `utm_source`, ou o host do referrer, ou "(direto)". */
  sources?: string[];
  /** Domínio do pool por onde a visita entrou. */
  arrivalHosts?: string[];
  devices?: string[];
  countries?: string[];
  /** `true`: só de dentro de app; `false`: só navegador comum. */
  inApp?: boolean;
}

/** O que existe para filtrar na janela, ANTES dos filtros: a tela monta as
 *  opções daqui, e uma origem que sumiu do recorte continua escolhível. */
export interface ReportOptions {
  links: string[];
  sources: string[];
  arrivalHosts: string[];
  devices: string[];
  countries: string[];
}

export interface TrackingReport {
  profileId: string;
  from: string;
  to: string;
  views: number;
  /** Visitantes diferentes entre as visitas. Contado POR DIA: a chave do
   *  visitante troca à meia-noite UTC, então quem volta em outro dia soma de
   *  novo. */
  visitors: number;
  clicks: number;
  /** clicks / views. 0 quando não houve view — nunca divisão por zero. */
  clickRate: number;
  botHits: number;
  inAppClicks: number;
  byChannel: Breakdown[];
  bySource: Breakdown[];
  byCampaign: Breakdown[];
  byLink: Array<Breakdown & { linkId: string; channel?: string }>;
  byDevice: Breakdown[];
  byCountry: Breakdown[];
  /** Por domínio de chegada, contando visitas e cliques juntos. */
  byArrivalHost: Breakdown[];
  daily: Array<{ date: string; views: number; clicks: number }>;
  /** A janela anterior de mesmo tamanho, com os mesmos filtros. */
  previous: { from: string; to: string; views: number; visitors: number; clicks: number; inAppClicks: number; clickRate: number };
  /** Quantos visitantes chegaram a cada etapa. Quem aparece numa etapa conta
   *  em todas as anteriores; `continue` e `age` só entram quando há evento
   *  delas no recorte. Vazio quando não houve ninguém. */
  funnel: FunnelStage[];
  /** Os passos mais recentes do recorte (todas as etapas), do mais novo para o
   *  mais antigo, até `MAX_EVENTOS_NA_LISTA`. Com filtro de link, só os passos
   *  de quem clicou num dos links escolhidos. */
  events: ReportEvent[];
  filters: ReportFilters;
  options: ReportOptions;
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
