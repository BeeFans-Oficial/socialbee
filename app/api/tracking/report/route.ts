import { NextResponse, type NextRequest } from "next/server";

import { MOCK_USER } from "@/lib/mock-data";
import { tracking, trackingStore } from "@/lib/tracking";

/**
 * Relatório de rastreamento do perfil.
 *
 * ATENÇÃO — dívida conhecida: o projeto não tem autenticação (ver README), e
 * por isso o perfil aqui é fixo em `MOCK_USER.id`. Quando entrar sessão, o
 * `profileId` sai dela e NUNCA da query string: aceitar o perfil do cliente
 * transformaria este endpoint em leitura livre do analytics de qualquer
 * criadora.
 */

export const dynamic = "force-dynamic";

/** Janelas oferecidas pelo dashboard. Lista fechada de propósito: `days` livre
 *  na query permitiria varrer o log inteiro numa requisição. */
const ALLOWED_DAYS = [7, 30, 90] as const;

export async function GET(request: NextRequest): Promise<NextResponse> {
  const requested = Number(request.nextUrl.searchParams.get("days") ?? 30);
  const days = (ALLOWED_DAYS as readonly number[]).includes(requested) ? requested : 30;

  const to = new Date();
  const from = new Date(to.getTime() - (days - 1) * 86_400_000);

  const profileId = MOCK_USER.id;

  try {
    const [report, counters] = await Promise.all([
      tracking.report(profileId, { from, to }),
      trackingStore.counters(profileId),
    ]);

    // Os contadores acompanham o relatório porque respondem a outra pergunta:
    // o relatório é a janela, o contador é o total histórico do link — que
    // sobrevive à expiração do evento cru.
    return NextResponse.json({ days, report, counters });
  } catch (error) {
    console.error("[tracking] falha ao montar relatório", error);
    return NextResponse.json({ error: "falha ao montar relatório" }, { status: 500 });
  }
}
