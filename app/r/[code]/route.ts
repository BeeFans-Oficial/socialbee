import { NextResponse, type NextRequest } from "next/server";

import { recordClick, type ClickResult } from "@/lib/api/server";
import { esquemaDe, siteOrigin } from "@/lib/site";

/** Entrada pública: a API resolve o destino, classifica o visitante para o
 * RELATÓRIO e todo mundo — robô ou humano — recebe o mesmo 307.
 *
 * Já entregou uma página ao robô e o salto à fã. Foi um dos três documentos
 * que a Meta comparou em 15/10/2026 antes de derrubar a conta de uma criadora
 * (ver `app/[slug]/page.tsx`): ela seguiu este salto com navegador de verdade
 * e viu o destino que o crawler declarado não via. Resposta diferente por
 * user-agent é cloaking para ela, em qualquer rota. */

// Cada acesso é um registro novo. Cache aqui significaria clique não contado.
export const dynamic = "force-dynamic";

/** Cabeçalhos do salto.
 *
 *  `no-referrer` impede que o destino descubra de qual perfil o visitante veio
 *  — o link é o produto da criadora, e vazar a origem entrega isso de graça a
 *  terceiros. `noindex` mantém o redirecionador fora dos buscadores. */
const HOP_HEADERS = {
  "cache-control": "no-store",
  "referrer-policy": "no-referrer",
  "x-robots-tag": "noindex, nofollow",
} as const;

function notFound(request: NextRequest): NextResponse {
  // Redireciona para a home em vez de mostrar erro: quem chega aqui com código
  // inválido é visitante de um link velho, não desenvolvedor depurando.
  //
  // A home do MESMO domínio por onde ela entrou, e não a de `siteOrigin()`:
  // com o pool, a constante de build atravessaria a fã do domínio em que ela
  // clicou para outro — revelando um endereço do pool que ela não pediu, e
  // possivelmente tirando-a de um domínio que funciona para um que está
  // bloqueado no aplicativo dela.
  return NextResponse.redirect(new URL("/", origemDaRequisicao(request)), {
    status: 307,
    headers: HOP_HEADERS,
  });
}

/** A origem por onde a visitante chegou, a partir do `Host`.
 *
 *  Não sai de `request.url`: no Route Handler o Next normaliza essa URL para o
 *  endereço em que o servidor escuta, devolvendo o mesmo valor para todos os
 *  domínios do pool. Medido com `Host: teste.local` — a URL continuava dizendo
 *  `localhost:3000`. */
function origemDaRequisicao(request: NextRequest): string {
  const host = request.headers.get("host");
  if (!host) return siteOrigin();
  return `${esquemaDe(host)}://${host}`;
}

/** IP do visitante a partir dos cabeçalhos de borda.
 *
 *  Repassado à API para o filtro de robô e para o prefixo de rede do relatório.
 *  Nunca para autorizar nada — `x-forwarded-for` é falsificável quando não há
 *  proxy confiável na frente. */
function clientIp(request: NextRequest): string | undefined {
  const candidates = [
    request.headers.get("cf-connecting-ip"),
    request.headers.get("x-real-ip"),
    request.headers.get("x-forwarded-for")?.split(",")[0],
  ];
  for (const candidate of candidates) {
    const value = candidate?.trim();
    if (value) return value;
  }
  return undefined;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> },
): Promise<NextResponse> {
  // Jitter de 10 a 50 ms no início de cada GET, inclusive nos fallbacks.
  const delay = Math.floor(Math.random() * 41) + 10;
  await new Promise<void>((resolve) => setTimeout(resolve, delay));

  const { code } = await params;

  let result: ClickResult;
  try {
    // Uma chamada resolve o conteúdo, classifica o visitante e registra o acesso.
    result = await recordClick(code, request, clientIp(request));
  } catch (error) {
    // A API fora do ar não pode transformar o link da criadora em página de
    // erro... mas sem ela também não há como saber o destino. A home é o menos
    // pior: a pessoa vê o produto em vez de um 500.
    console.error("[r] falha ao resolver o link", error);
    return notFound(request);
  }

  // `result.isBot` existe, e de propósito não é lido aqui: a diferença entre
  // robô e humano é só o `counted` do relatório, nunca a resposta.
  const destination = result.destinationUrl;
  if (!destination) return notFound(request);

  // Temporário e sem armazenamento: cada acesso volta à classificação.
  return NextResponse.redirect(destination, { status: 307, headers: HOP_HEADERS });
}

/**
 * Sondagem.
 *
 * Responde 200 sem corpo, o que mantém o link válido para quem valida antes de
 * abrir, e de propósito NÃO registra clique nem consulta a API: sondagem não é
 * visita. Sem esta separação, cada compartilhamento em grupo de WhatsApp
 * nasceria com cliques que ninguém deu — é o caminho mais fácil para o número
 * mentir.
 */
export async function HEAD(): Promise<NextResponse> {
  return new NextResponse(null, { status: 200, headers: HOP_HEADERS });
}
