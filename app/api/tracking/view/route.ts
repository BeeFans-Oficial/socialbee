import { NextResponse, type NextRequest } from "next/server";

import { resolveProfileBySlug, tracking } from "@/lib/tracking";

/**
 * Registro de visualização de perfil.
 *
 * A view existe para a taxa de clique ter denominador. Sem ela o dashboard
 * mostra cliques absolutos, que não dizem se o perfil converte — só se ele tem
 * tráfego.
 *
 * É POST e não GET porque escreve, e recebe **slug**, nunca `profileId`: o
 * cliente não escolhe em qual perfil grava. O slug é traduzido aqui.
 */

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest): Promise<NextResponse> {
  let slug: unknown;
  try {
    ({ slug } = await request.json());
  } catch {
    return NextResponse.json({ error: "corpo inválido" }, { status: 400 });
  }

  if (typeof slug !== "string" || !slug.trim()) {
    return NextResponse.json({ error: "slug obrigatório" }, { status: 400 });
  }

  const profileId = await resolveProfileBySlug(slug.trim());
  // 204 e não 404: o navegador não precisa saber se o perfil existe, e um erro
  // aqui não muda nada na página que o visitante está vendo.
  if (!profileId) return new NextResponse(null, { status: 204 });

  try {
    await tracking.recordView({
      profileId,
      requestUrl: new URL(request.url),
      headers: request.headers,
    });
  } catch (error) {
    console.error("[tracking] falha ao registrar view", error);
  }

  return new NextResponse(null, { status: 204 });
}
