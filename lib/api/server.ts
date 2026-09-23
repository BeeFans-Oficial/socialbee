import "server-only";

import type { ApiProfile, ApiPublicLink } from "./types";

/**
 * Cliente da API para o SERVIDOR do Next.
 *
 * Separado do cliente do navegador por dois motivos concretos:
 *
 *   1. O endereço é o interno (`API_INTERNAL_URL`, `http://api:3333` dentro do
 *      compose). Ele nunca deve chegar ao navegador.
 *   2. Ele carrega o segredo interno (`INTERNAL_API_SECRET`), que autoriza o
 *      registro de clique. Esse segredo não pode existir em código de cliente —
 *      o `import "server-only"` acima faz o build FALHAR se alguém importar
 *      este arquivo de um componente com "use client", em vez de o segredo
 *      viajar no bundle e ninguém notar.
 */

const INTERNAL_BASE = (process.env.API_INTERNAL_URL ?? "http://localhost:3333").replace(/\/+$/, "");

/** Cabeçalhos do visitante que a API precisa para julgar se o acesso é humano e
 *  para montar a atribuição. Lista fechada: repassar tudo mandaria também o
 *  cookie de sessão de quem estiver logado para rotas que não precisam dele. */
const CABECALHOS_DO_VISITANTE = [
  "user-agent",
  "accept",
  "accept-language",
  "referer",
  "sec-ch-ua",
  "sec-ch-ua-mobile",
  "sec-ch-ua-platform",
  "sec-fetch-mode",
  "sec-fetch-dest",
  "sec-fetch-site",
  "upgrade-insecure-requests",
  "cf-ipcountry",
  "x-vercel-ip-country",
] as const;

/** Qualquer fonte de cabeçalho: `request.headers` no Route Handler,
 *  `await headers()` no componente de servidor. */
type FonteDeCabecalho = { get(name: string): string | null };

function repassarCabecalhos(fonte: FonteDeCabecalho, ip?: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const name of CABECALHOS_DO_VISITANTE) {
    const value = fonte.get(name);
    if (value) out[name] = value;
  }
  if (ip) out["x-forwarded-for"] = ip;
  return out;
}

/** IP do visitante a partir dos cabeçalhos de borda. Alimenta filtro de robô e
 *  prefixo de rede — nunca autorização: `x-forwarded-for` é falsificável quando
 *  não há proxy confiável na frente. */
export function clientIp(fonte: FonteDeCabecalho): string | undefined {
  const candidates = [
    fonte.get("cf-connecting-ip"),
    fonte.get("x-real-ip"),
    fonte.get("x-forwarded-for")?.split(",")[0],
  ];
  for (const candidate of candidates) {
    const value = candidate?.trim();
    if (value) return value;
  }
  return undefined;
}

export interface ClickResult {
  destinationUrl: string | null;
  counted: boolean;
  /** Por que o clique contou ou não. É o que torna "cliquei e não apareceu no
   *  analytics" investigável: o filtro de robô é a peça em que um falso
   *  positivo apaga clique humano sem deixar rastro. */
  reason?: string;
}

/**
 * Registra o clique e devolve o destino.
 *
 * Repassa os cabeçalhos do visitante — user agent, idioma, referrer, IP — porque
 * é com eles que a API decide se o acesso é humano e monta a atribuição. Sem
 * repassar, todo clique pareceria vir do servidor do Next: mesmo IP, sem
 * idioma, sem referrer. O filtro de robô descartaria tudo.
 */
export async function recordClick(
  code: string,
  request: Request,
  clientIp: string | undefined,
): Promise<ClickResult> {
  const secret = process.env.INTERNAL_API_SECRET;
  if (!secret) {
    // Sem segredo a API responde 404 e o visitante cairia na home sem
    // explicação. Falhar com log claro é o mínimo.
    console.error("[api] INTERNAL_API_SECRET não configurado — clique não registrado");
    return { destinationUrl: null, counted: false };
  }

  const forwarded: Record<string, string> = {
    ...repassarCabecalhos(request.headers, clientIp),
    "content-type": "application/json",
    "x-internal-secret": secret,
  };

  const response = await fetch(`${INTERNAL_BASE}/v1/public/tracking/click`, {
    method: "POST",
    headers: forwarded,
    body: JSON.stringify({ code, url: request.url, method: request.method }),
    cache: "no-store",
  });

  if (!response.ok) {
    console.error(`[api] registro de clique falhou: ${response.status}`);
    return { destinationUrl: null, counted: false };
  }

  const result = (await response.json()) as ClickResult;

  if (!result.counted && result.destinationUrl) {
    // O visitante segue para o destino de todo jeito; o registro é que foi
    // descartado. Fica no log do servidor, com o motivo.
    console.warn(`[r] clique em ${code} não contado: ${result.reason ?? "sem motivo"}`);
  }

  return result;
}


/** Perfil público como o SERVIDOR o busca, para renderizar `/[slug]`.
 *
 *  A resposta traz `requester` — o veredito do filtro de robô sobre o VISITANTE,
 *  calculado pela API a partir dos cabeçalhos repassados aqui. A detecção não é
 *  reimplementada no app de propósito: duas heurísticas de robô em dois lugares
 *  divergem, e a que fica errada é sempre a que ninguém está olhando.
 *
 *  `cache: "no-store"` porque a resposta depende de quem pediu. Uma página de
 *  perfil cacheada entregaria ao visitante seguinte o veredito do anterior. */
export interface PublicProfileForRender {
  profile: ApiProfile;
  links: ApiPublicLink[];
  /**
   * Veredito sobre QUEM pediu, preenchido só para o nosso próprio servidor.
   *
   * `isBot` e `isInAppBrowser` são excludentes por construção na API: sendo
   * robô, o segundo vem `false`. A página usa os dois para escolher entre três
   * documentos — chegada, perfil do robô e perfil completo.
   */
  requester?: {
    isBot: boolean;
    score: number;
    reason: string;
    isInAppBrowser: boolean;
    inAppSource: "instagram" | "facebook" | "tiktok" | "other" | null;
    platform: "android" | "ios" | "other";
  };
}

export async function fetchPublicProfile(
  slug: string,
  fonte: FonteDeCabecalho,
): Promise<PublicProfileForRender | null> {
  const secret = process.env.INTERNAL_API_SECRET;
  const headers: Record<string, string> = repassarCabecalhos(fonte, clientIp(fonte));
  // Sem segredo a API responde o perfil, só sem o veredito — a página ainda
  // renderiza, tratando o visitante como humano. Degradar assim é melhor do que
  // derrubar o perfil da criadora por configuração ausente.
  if (secret) headers["x-internal-secret"] = secret;

  const response = await fetch(
    `${INTERNAL_BASE}/v1/public/profiles/${encodeURIComponent(slug)}`,
    { headers, cache: "no-store" },
  );

  if (response.status === 404) return null;
  if (!response.ok) {
    console.error(`[perfil] API respondeu ${response.status} para /${slug}`);
    return null;
  }

  return (await response.json()) as PublicProfileForRender;
}
