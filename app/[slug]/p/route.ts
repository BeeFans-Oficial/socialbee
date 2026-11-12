import { emitirPasse } from "@/lib/passe-chegada";

// Cada passe tem validade própria; resposta em cache seria passe vencido.
export const dynamic = "force-dynamic";

/**
 * Emite um passe da chegada para esta página. Ver `lib/passe-chegada.ts`.
 *
 * Qualquer requisitante recebe um: pedir o passe equivale a rolar a tela, e
 * ele só serve para abrir a página sem a tela de rolagem. `POST` para que
 * pré-carregamento e robô de prévia não o peçam sem querer.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
): Promise<Response> {
  const { slug } = await params;
  return Response.json(
    { passe: emitirPasse(slug) },
    { headers: { "cache-control": "no-store", "x-robots-tag": "noindex, nofollow" } },
  );
}
