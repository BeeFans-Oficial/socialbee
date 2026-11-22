import { type NextRequest } from "next/server";

import {
  COOKIE_DA_CHEGADA,
  VALIDADE_DO_COOKIE_S,
  emitirCookieDaChegada,
  passeValido,
} from "@/lib/passe-chegada";
import { esquemaDe } from "@/lib/site";

export const dynamic = "force-dynamic";

/**
 * Troca o passe da chegada por um cookie e leva à página, no endereço limpo.
 * Ver `lib/passe-chegada.ts`.
 *
 * A resposta é o MESMO 307 para qualquer requisitante e qualquer passe —
 * válido, vencido ou inventado. Só o cookie difere: sem passe válido ele não
 * é gravado, e a página abre com a chegada, como para qualquer visitante.
 *
 * `Location` relativo de propósito: o destino é sempre o domínio por onde a
 * pessoa entrou, sem depender de o servidor adivinhar o host atrás do nginx.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; passe: string }> },
): Promise<Response> {
  const { slug, passe } = await params;
  const caminho = `/${encodeURIComponent(slug)}`;

  const headers = new Headers({
    location: caminho,
    "cache-control": "no-store",
    "referrer-policy": "no-referrer",
    "x-robots-tag": "noindex, nofollow",
  });

  const cookie = passeValido(slug, passe) ? emitirCookieDaChegada(slug) : null;
  if (cookie) {
    const host = request.headers.get("host") ?? "";
    const seguro = esquemaDe(host) === "https" ? "; Secure" : "";
    // Escopado ao caminho da página: passar pela chegada de uma criadora não
    // abre a de outra no mesmo domínio.
    headers.append(
      "set-cookie",
      `${COOKIE_DA_CHEGADA}=${cookie}; Path=${caminho}; Max-Age=${VALIDADE_DO_COOKIE_S}; HttpOnly; SameSite=Lax${seguro}`,
    );
  }

  return new Response(null, { status: 307, headers });
}
