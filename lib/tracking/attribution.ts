import type { Attribution, ClientContext } from "./types";

/**
 * Extração de atribuição e contexto do visitante a partir da requisição.
 *
 * O projeto de referência fixou `fbp`, `fbc` e `fbclid` como campos do
 * documento, o que amarra o schema à Meta: entrar com TikTok exigiria migração.
 * Aqui os identificadores de clique vão para um mapa aberto, e a lista abaixo é
 * só o que sabemos reconhecer hoje.
 */

/** Identificadores de clique conhecidos, por rede. Chave desconhecida que
 *  termine em `clid` também é capturada (ver `parseAttribution`), então uma rede
 *  nova funciona antes de alguém editar esta lista. */
const KNOWN_CLICK_IDS = [
  "fbclid", // Meta
  "gclid", // Google Ads
  "gbraid",
  "wbraid",
  "ttclid", // TikTok
  "twclid", // X/Twitter
  "msclkid", // Microsoft
  "li_fat_id", // LinkedIn
  "epik", // Pinterest
  "igshid", // Instagram
  "s_kwcid",
  "irclickid",
] as const;

/** Parâmetros UTM padrão. */
const UTM_KEYS = {
  utm_source: "source",
  utm_medium: "medium",
  utm_campaign: "campaign",
  utm_content: "content",
  utm_term: "term",
} as const;

/** Limite por valor guardado. UTM é campo livre na mão de quem monta o anúncio:
 *  sem corte, uma URL absurda entra inteira no armazenamento. */
const MAX_VALUE_LENGTH = 200;

function clean(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, MAX_VALUE_LENGTH);
}

export function parseAttribution(url: URL, referrer?: string | null): Attribution {
  const attribution: Attribution = { clickIds: {} };

  for (const [param, field] of Object.entries(UTM_KEYS) as Array<
    [keyof typeof UTM_KEYS, (typeof UTM_KEYS)[keyof typeof UTM_KEYS]]
  >) {
    const value = clean(url.searchParams.get(param));
    if (value) attribution[field] = value;
  }

  for (const key of KNOWN_CLICK_IDS) {
    const value = clean(url.searchParams.get(key));
    if (value) attribution.clickIds[key] = value;
  }

  // Rede nova: qualquer `*clid` que ainda não foi capturado entra também. É o
  // que evita ter que editar KNOWN_CLICK_IDS a cada plataforma que aparece.
  url.searchParams.forEach((rawValue, key) => {
    const lower = key.toLowerCase();
    if (!lower.endsWith("clid") || attribution.clickIds[lower]) return;
    const value = clean(rawValue);
    if (value) attribution.clickIds[lower] = value;
  });

  // Só o host do referrer. O caminho pode carregar dado pessoal e nenhuma
  // agregação da tela usa mais do que o domínio de origem.
  const host = hostOf(referrer);
  if (host) attribution.referrerHost = host;

  return attribution;
}

export function hostOf(rawUrl?: string | null): string | undefined {
  if (!rawUrl) return undefined;
  try {
    return new URL(rawUrl).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return undefined;
  }
}

/** Navegadores embutidos de app.
 *
 *  A ordem importa: o UA do Instagram também contém `FBAV` (o app é da Meta),
 *  então Instagram tem que ser testado ANTES de Facebook, ou todo tráfego de
 *  Instagram seria contado como Facebook. */
const IN_APP_BROWSERS: Array<[string, RegExp]> = [
  ["instagram", /Instagram/i],
  ["facebook", /FBAN|FBAV|FB_IAB/i],
  ["tiktok", /BytedanceWebview|musical_ly|TikTok/i],
  ["twitter", /Twitter/i],
  ["snapchat", /Snapchat/i],
  ["linkedin", /LinkedInApp/i],
  ["pinterest", /Pinterest/i],
  ["line", /\bLine\//i],
  ["telegram", /TelegramWebview/i],
  ["kakao", /KAKAOTALK/i],
  ["wechat", /MicroMessenger/i],
];

export function detectInAppBrowser(userAgent: string): string | undefined {
  for (const [name, pattern] of IN_APP_BROWSERS) {
    if (pattern.test(userAgent)) return name;
  }
  return undefined;
}

function detectDevice(userAgent: string): ClientContext["device"] {
  if (!userAgent) return "unknown";
  if (/iPad|Tablet|PlayBook|Silk|(Android(?!.*Mobile))/i.test(userAgent)) return "tablet";
  if (/Mobi|Android|iPhone|iPod|Windows Phone/i.test(userAgent)) return "mobile";
  if (/Macintosh|Windows|Linux|CrOS/i.test(userAgent)) return "desktop";
  return "unknown";
}

function detectOS(userAgent: string): string | undefined {
  if (/iPhone|iPad|iPod/i.test(userAgent)) return "iOS";
  if (/Android/i.test(userAgent)) return "Android";
  if (/Macintosh|Mac OS X/i.test(userAgent)) return "macOS";
  if (/Windows/i.test(userAgent)) return "Windows";
  if (/CrOS/i.test(userAgent)) return "ChromeOS";
  if (/Linux/i.test(userAgent)) return "Linux";
  return undefined;
}

/** Reduz o IP à faixa que o relatório usa: /24 em IPv4, /48 em IPv6.
 *
 *  Guardar o IP completo seria dado pessoal sem finalidade — a decisão de robô
 *  acontece antes da gravação, e a tela nunca desce abaixo de país. */
export function ipPrefix(ip?: string | null): string | undefined {
  if (!ip) return undefined;
  const value = ip.trim().toLowerCase();
  if (!value) return undefined;

  // Loopback e rede privada não são prefixo útil: é a própria máquina ou a LAN.
  // Sem esta guarda, `::1` virava "1::/48", que passa por prefixo real e
  // poluiria o relatório com uma faixa que não existe.
  if (value === "::1" || value === "127.0.0.1" || value.startsWith("127.")) return undefined;

  if (value.includes(":")) {
    // Expande a notação comprimida antes de cortar. `::1` tem um grupo só
    // escrito e sete implícitos — fatiar a string crua produz lixo.
    const [head, tail = ""] = value.split("::");
    const headGroups = head ? head.split(":").filter(Boolean) : [];
    const tailGroups = tail ? tail.split(":").filter(Boolean) : [];
    const missing = 8 - headGroups.length - tailGroups.length;
    if (missing < 0) return undefined;
    const groups = value.includes("::")
      ? [...headGroups, ...Array(missing).fill("0"), ...tailGroups]
      : headGroups;
    if (groups.length !== 8) return undefined;
    return `${groups.slice(0, 3).join(":")}::/48`;
  }

  const parts = value.split(".");
  if (parts.length !== 4) return undefined;
  if (parts[0] === "10" || (parts[0] === "192" && parts[1] === "168")) return undefined;
  return `${parts[0]}.${parts[1]}.${parts[2]}.0/24`;
}

export interface ClientContextInput {
  userAgent?: string | null;
  ip?: string | null;
  country?: string | null;
}

export function buildClientContext(input: ClientContextInput): ClientContext {
  const userAgent = (input.userAgent || "").slice(0, 400);
  const context: ClientContext = { device: detectDevice(userAgent) };

  const os = detectOS(userAgent);
  if (os) context.os = os;

  const inApp = detectInAppBrowser(userAgent);
  if (inApp) context.inAppBrowser = inApp;

  const country = clean(input.country);
  if (country) context.country = country.toUpperCase().slice(0, 2);

  const prefix = ipPrefix(input.ip);
  if (prefix) context.ipPrefix = prefix;

  if (userAgent) context.userAgent = userAgent;

  return context;
}

/**
 * IP do cliente a partir dos cabeçalhos de proxy.
 *
 * Ordem de confiança copiada do projeto de referência: a borda que TERMINA a
 * conexão vem primeiro, porque é a única que o cliente não consegue forjar.
 * `x-forwarded-for` é lista e só o primeiro salto interessa — mas ele é
 * falsificável quando não há proxy confiável na frente, e é por isso que o IP
 * aqui só alimenta filtro de robô e prefixo de rede, nunca autorização.
 */
export function clientIP(headers: Headers): string | undefined {
  const candidates = [
    headers.get("cf-connecting-ip"),
    headers.get("x-real-ip"),
    headers.get("x-forwarded-for")?.split(",")[0],
  ];
  for (const candidate of candidates) {
    const value = candidate?.trim();
    if (value) return value;
  }
  return undefined;
}

/** País informado pela borda. Nomes usados por Cloudflare, Vercel e Fastly. */
export function edgeCountry(headers: Headers): string | undefined {
  return (
    headers.get("cf-ipcountry") ||
    headers.get("x-vercel-ip-country") ||
    headers.get("x-country-code") ||
    undefined
  );
}
