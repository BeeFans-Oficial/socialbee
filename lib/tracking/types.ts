/**
 * Domínio de rastreamento de links.
 *
 * O projeto de referência (bee-api-2) resolve o mesmo problema amarrado a um
 * caso só: um bot do Telegram por produto, funil terminando em compra, pixel da
 * Meta embutido. Aqui o requisito é o oposto — **vários perfis** apontando para
 * **vários canais de terceiros** — então três amarras foram deliberadamente
 * cortadas:
 *
 *   1. `channel` é string aberta, nunca enum. Quem conhece "onlyfans" ou
 *      "telegram" é a camada de apresentação (`lib/mock-data.ts`); o núcleo só
 *      guarda o rótulo. Adicionar um canal não toca em nenhum arquivo daqui.
 *   2. O destino é qualquer URL http(s). Não existe deep link, payload de
 *      /start nem formato de provedor no núcleo.
 *   3. O funil termina no redirecionamento. O destino é de terceiros: não há
 *      callback de compra, e inventar um estágio "conversão" que ninguém pode
 *      confirmar seria número falso.
 *
 * A amarra que foi MANTIDA de propósito: toda leitura e escrita é escopada por
 * `profileId`. Multi-perfil sem isso é vazamento de dados entre criadoras.
 */

/** Tipos de evento do núcleo. String aberta: um canal novo pode registrar o
 *  próprio evento (ex.: "subscribe") sem migração de schema. */
export type TrackingEventType = "view" | "click" | (string & {});

/** Atribuição capturada no momento do evento.
 *
 *  Os `clickIds` são os identificadores que as redes anexam à URL de destino.
 *  Ficam num mapa aberto — `fbclid`, `gclid`, `ttclid`, `twclid`, `msclkid` e o
 *  que vier depois — em vez de virarem colunas, que foi o acoplamento do
 *  projeto de referência (campos FBP/FBC/FBCLID fixos no documento). */
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
  /** Família do dispositivo, derivada do user agent. */
  device: "mobile" | "tablet" | "desktop" | "unknown";
  os?: string;
  /** Navegador embutido de app, quando detectado ("instagram", "facebook",
   *  "tiktok"…). É o dado mais valioso do produto: mede quanto do tráfego chega
   *  preso dentro do app e justifica o escape. */
  inAppBrowser?: string;
  /** ISO 3166-1 alfa-2, quando a borda informa (cf-ipcountry e afins). */
  country?: string;
  /** Prefixo /24 do IPv4 (ou /48 do IPv6). Guardar o IP inteiro seria dado
   *  pessoal sem uso: a granularidade que o relatório usa é geográfica, e o
   *  filtro de robô decide ANTES de o evento ser gravado. */
  ipPrefix?: string;
  userAgent?: string;
}

/** Veredito do filtro de robô. */
export interface BotVerdict {
  isBot: boolean;
  /** Quanto maior, mais certeza. >= 1000 é bloqueio direto (robô declarado). */
  score: number;
  /** Legível por humano — é o que a tela de diagnóstico mostra. */
  reason: string;
}

/** Um evento gravado. Fluxo único para view e click: unificar deixa a
 *  extensão barata e o relatório com uma passada só sobre a mesma coleção. */
export interface TrackingEvent {
  id: string;
  type: TrackingEventType;
  profileId: string;
  /** Ausente em `view` (o evento é do perfil, não de um link). */
  linkId?: string;
  channel?: string;
  /** Host do destino, para saber para onde o tráfego saiu sem guardar a URL
   *  completa (que pode ter token de afiliado). */
  destinationHost?: string;
  /** ISO 8601 UTC. */
  occurredAt: string;
  attribution: Attribution;
  client: ClientContext;
}

/** Contadores desnormalizados por link.
 *
 *  Lição direta do projeto de referência: a lista de links e o histórico
 *  precisam de número sem agregar a coleção de eventos, e precisam SOBREVIVER à
 *  expiração dos eventos crus. Evento cru é volume e tem TTL; contador é
 *  histórico e é para sempre. */
export interface LinkCounters {
  clicks: number;
  /** Requisições descartadas pelo filtro de robô. Fica visível de propósito:
   *  sem isso a criadora acha que perdeu tráfego. */
  botHits: number;
  lastClickAt?: string;
}

/** Uma linha de quebra do relatório (por canal, por origem, por campanha…). */
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
  /** Cliques que chegaram de dentro de um navegador embutido de app. */
  inAppClicks: number;
  byChannel: Breakdown[];
  bySource: Breakdown[];
  byCampaign: Breakdown[];
  byLink: Array<Breakdown & { linkId: string; channel?: string }>;
  daily: Array<{ date: string; views: number; clicks: number }>;
}

/** Link resolvido a partir do código curto.
 *
 *  É o contrato que desacopla o rastreamento de onde os links moram. Hoje a
 *  implementação lê `lib/mock-data.ts`; amanhã lê o banco. O núcleo não sabe a
 *  diferença. */
export interface ResolvedLink {
  linkId: string;
  profileId: string;
  /** Rótulo do canal. Opaco para o núcleo. */
  channel: string;
  destinationUrl: string;
  isActive: boolean;
}

/** Onde os links moram. */
export interface LinkResolver {
  /** `null` quando o código não existe — o chamador decide o que fazer. */
  resolve(shortCode: string): Promise<ResolvedLink | null>;
}

/** Janela de tempo de uma consulta. */
export interface DateRange {
  from: Date;
  to: Date;
}

/** Persistência.
 *
 *  Mantido pequeno de propósito: é a superfície que uma implementação real
 *  (Mongo, Postgres) precisa cobrir. As três operações de escrita são as do
 *  caminho quente; as de leitura servem só ao relatório. */
export interface TrackingStore {
  append(event: TrackingEvent): Promise<void>;
  /** Soma nos contadores do link. `patch` é parcial para o chamador incrementar
   *  só o que aconteceu (um clique OU um hit de robô). */
  bumpCounters(
    profileId: string,
    linkId: string,
    patch: Partial<Pick<LinkCounters, "clicks" | "botHits">> & { lastClickAt?: string },
  ): Promise<void>;
  counters(profileId: string): Promise<Record<string, LinkCounters>>;
  /** Eventos do perfil na janela. Escopado por perfil por contrato, não por
   *  disciplina de quem chama. */
  query(profileId: string, range: DateRange): Promise<TrackingEvent[]>;
}
