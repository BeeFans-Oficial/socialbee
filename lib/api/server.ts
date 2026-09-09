import "server-only";

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
    "content-type": "application/json",
    "x-internal-secret": secret,
  };

  // Cabeçalhos que alimentam o filtro de robô e a atribuição. Lista fechada:
  // repassar tudo mandaria também o cookie de sessão de quem estiver logado
  // para uma rota que não precisa dele.
  for (const name of [
    "user-agent",
    "accept",
    "accept-language",
    "referer",
    "sec-ch-ua",
    "sec-fetch-mode",
    "cf-ipcountry",
    "x-vercel-ip-country",
  ]) {
    const value = request.headers.get(name);
    if (value) forwarded[name] = value;
  }
  if (clientIp) forwarded["x-forwarded-for"] = clientIp;

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
