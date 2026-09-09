import { NextResponse, type NextRequest } from "next/server";

import { recordClick } from "@/lib/api/server";
import { siteOrigin } from "@/lib/site";

/**
 * Redirecionador de link.
 *
 * Continua sendo um Route Handler, e não uma página, pelos mesmos três motivos
 * de antes: a resposta é exatamente o que escrevemos (sem layout raiz por
 * cima), o salto não paga o custo de montar o app, e **o destino nunca aparece
 * no HTML entregue ao visitante**.
 *
 * O que mudou com a API: quem resolve o código e registra o clique agora é ela.
 * Este handler ficou sendo o que sempre devia ser — a borda pública que fala com
 * o navegador, faz o 302 e não conhece banco nenhum.
 *
 * Por que o registro não acontece direto do navegador: a rota de clique na API
 * exige segredo interno. Sem isso, qualquer pessoa com o código curto de um
 * link — que é público, está na bio dela — dispararia a rota em laço e inflaria
 * o contador de cliques da criadora, que é o número que ela usa para negociar
 * valor.
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
  return NextResponse.redirect(new URL("/", siteOrigin()), {
    status: 302,
    headers: HOP_HEADERS,
  });
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
  const { code } = await params;

  let destination: string | null = null;
  try {
    // Uma chamada faz as duas coisas: resolve o destino e registra o clique. É
    // do lado da API que o filtro de robô decide se o acesso conta — e o robô é
    // redirecionado normalmente de todo jeito, só não entra na estatística.
    ({ destinationUrl: destination } = await recordClick(code, request, clientIp(request)));
  } catch (error) {
    // A API fora do ar não pode transformar o link da criadora em página de
    // erro... mas sem ela também não há como saber o destino. A home é o menos
    // pior: a pessoa vê o produto em vez de um 500.
    console.error("[r] falha ao resolver o link", error);
    return notFound();
  }

  if (!destination) return notFound();

  // 302, não 301: um permanente fica no cache do navegador e todos os cliques
  // seguintes daquele visitante deixariam de passar por aqui.
  return NextResponse.redirect(destination, { status: 302, headers: HOP_HEADERS });
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
