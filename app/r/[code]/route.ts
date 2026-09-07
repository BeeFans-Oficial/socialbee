import { NextResponse, type NextRequest } from "next/server";

import { linkResolver, safeDestination, tracking } from "@/lib/tracking";

/**
 * Redirecionador de link.
 *
 * É um Route Handler, e não uma página — a decisão vem do bee-api-2 e vale por
 * três motivos: a resposta é exatamente o que escrevemos (sem layout raiz por
 * cima), o salto não paga o custo de montar o app, e o destino nunca aparece no
 * HTML entregue ao visitante.
 *
 * O que a versão anterior fazia: `alert()` com o título do link e volta para
 * `/bella`. Nenhum clique chegava ao destino e nada era registrado.
 */

// Cada acesso é um registro novo. Cache aqui significaria clique não contado.
export const dynamic = "force-dynamic";

/** Cabeçalhos do salto.
 *
 *  `no-referrer` impede que o destino descubra de qual perfil o visitante veio
 *  — o link é o produto da criadora, e vazar a origem entrega isso de graça a
 *  terceiros. `noindex` mantém o redirecionador fora dos buscadores. */
const HOP_HEADERS = {
  "cache-control": "no-store, no-cache, must-revalidate",
  "referrer-policy": "no-referrer",
  "x-robots-tag": "noindex, nofollow",
} as const;

function notFound(): NextResponse {
  // Redireciona para a home em vez de mostrar erro: quem chega aqui com código
  // inválido é visitante de um link velho, não desenvolvedor depurando.
  return NextResponse.redirect(new URL("/", process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"), {
    status: 302,
    headers: HOP_HEADERS,
  });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> },
): Promise<NextResponse> {
  const { code } = await params;

  const link = await linkResolver.resolve(code);
  if (!link || !link.isActive) return notFound();

  const destination = safeDestination(link.destinationUrl);
  if (!destination) return notFound();

  // O registro não pode derrubar o salto: se a gravação falhar, o visitante
  // ainda tem que chegar ao destino. Perder um clique do relatório é bem menos
  // grave do que perder a visita.
  try {
    await tracking.recordClick({
      link,
      requestUrl: new URL(request.url),
      headers: request.headers,
      method: request.method,
    });
  } catch (error) {
    console.error("[tracking] falha ao registrar clique", error);
  }

  // 302, não 301: um permanente fica no cache do navegador e todos os cliques
  // seguintes daquele visitante deixariam de passar por aqui.
  return NextResponse.redirect(destination, { status: 302, headers: HOP_HEADERS });
}

/**
 * Sondagem.
 *
 * Responder 200 sem corpo mantém o link válido para quem valida antes de abrir,
 * e de propósito NÃO registra clique: sondagem não é visita. Sem esta separação
 * cada compartilhamento em grupo de WhatsApp nasceria com cliques que ninguém
 * deu — é o caminho mais fácil para o número mentir.
 */
export async function HEAD(): Promise<NextResponse> {
  return new NextResponse(null, { status: 200, headers: HOP_HEADERS });
}
