import { NextResponse, type NextRequest } from "next/server";

/**
 * Proxy da API, no servidor do Next.
 *
 * O navegador chama `/api/v1/*` na PRÓPRIA origem e este handler repassa para a
 * API. É o que faz o cookie de sessão ser same-site (funciona com
 * `SameSite=Lax`, sem `SameSite=None`, que abriria a sessão para requisição de
 * terceiro), dispensa preflight de CORS em toda chamada do produto, mantém o
 * token fora do `localStorage` — que é legível por qualquer script da página — e
 * esconde o endereço interno da API.
 *
 * **Por que um Route Handler e não `rewrites` no next.config.js:** `rewrites()`
 * é avaliado no BUILD, e o destino vai congelado para o `routes-manifest`. Com
 * isso a imagem Docker carregava `http://localhost:3333` — o valor que existia
 * na máquina de build — e dentro do container não havia nada nesse endereço: o
 * painel respondia 500 em toda chamada. Aqui `API_INTERNAL_URL` é lido a cada
 * requisição, então a mesma imagem serve qualquer ambiente.
 */

// Sessão e rastreamento não podem ser cacheados em nenhum ponto.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function apiBase(): string {
  return (process.env.API_INTERNAL_URL ?? "http://localhost:3333").replace(/\/+$/, "");
}

/** Cabeçalhos que NÃO são repassados adiante.
 *
 *  `host` e `connection` descrevem a conexão com o Next, não com a API — mandar
 *  o `host` do navegador faria a API ver um host que não é o dela. Os
 *  `content-length`/`transfer-encoding` são recalculados pelo fetch a partir do
 *  corpo que realmente vai. */
const CABECALHOS_IGNORADOS = new Set([
  "host",
  "connection",
  "content-length",
  "transfer-encoding",
  "keep-alive",
  "upgrade",
  "expect",
]);

/** Cabeçalhos de resposta que pertencem à conexão e não devem ser copiados. */
const RESPOSTA_IGNORADOS = new Set([
  "content-encoding",
  "content-length",
  "transfer-encoding",
  "connection",
  "keep-alive",
]);

async function encaminhar(request: NextRequest, caminho: string[]): Promise<NextResponse> {
  const destino = `${apiBase()}/v1/${caminho.map(encodeURIComponent).join("/")}${request.nextUrl.search}`;

  const headers = new Headers();
  request.headers.forEach((value, name) => {
    if (!CABECALHOS_IGNORADOS.has(name.toLowerCase())) headers.set(name, value);
  });

  // O IP do visitante, para a API decidir robô e montar o prefixo de rede. Só
  // acrescenta quando ainda não veio de uma borda na frente.
  if (!headers.has("x-forwarded-for")) {
    const ip = request.headers.get("x-real-ip") ?? request.headers.get("cf-connecting-ip");
    if (ip) headers.set("x-forwarded-for", ip);
  }

  const temCorpo = !["GET", "HEAD"].includes(request.method);

  let resposta: Response;
  try {
    resposta = await fetch(destino, {
      method: request.method,
      headers,
      body: temCorpo ? await request.arrayBuffer() : undefined,
      // `manual`: se a API responder redirecionamento, quem decide o que fazer
      // é o navegador — não este proxy seguindo em nome dele.
      redirect: "manual",
      cache: "no-store",
    });
  } catch (error) {
    console.error("[proxy] API inacessível:", error instanceof Error ? error.message : error);
    return NextResponse.json(
      {
        error: {
          code: "api_unreachable",
          message: "Serviço temporariamente indisponível. Tente de novo em instantes.",
        },
      },
      { status: 502 },
    );
  }

  const respostaHeaders = new Headers();
  resposta.headers.forEach((value, name) => {
    if (!RESPOSTA_IGNORADOS.has(name.toLowerCase()) && name.toLowerCase() !== "set-cookie") {
      respostaHeaders.set(name, value);
    }
  });

  // `set-cookie` pode vir repetido e um `Headers.set` colapsaria os valores num
  // só — o que quebraria o login no dia em que a API mandar dois cookies.
  for (const cookie of resposta.headers.getSetCookie?.() ?? []) {
    respostaHeaders.append("set-cookie", cookie);
  }

  const corpo = resposta.status === 204 || resposta.status === 304 ? null : await resposta.arrayBuffer();

  return new NextResponse(corpo, { status: resposta.status, headers: respostaHeaders });
}

type Contexto = { params: Promise<{ path: string[] }> };

async function handler(request: NextRequest, { params }: Contexto): Promise<NextResponse> {
  const { path } = await params;
  return encaminhar(request, path ?? []);
}

export const GET = handler;
export const POST = handler;
export const PATCH = handler;
export const PUT = handler;
export const DELETE = handler;
export const HEAD = handler;
