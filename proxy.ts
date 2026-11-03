import { NextResponse, type NextRequest } from "next/server";

import { SESSION_COOKIE } from "@/lib/session-cookie";

/**
 * Barreira das rotas do painel.
 *
 * Arquivo `proxy.ts` e não `middleware.ts`: no Next 16 a convenção antiga está
 * depreciada e avisa isso em todo build.
 *
 * O que ela faz: se não existe cookie de sessão, manda para `/login` antes de o
 * dashboard renderizar. Sem isso, quem não está logado vê o painel montar,
 * piscar e só então as requisições falharem com 401 — e a sensação é de app
 * quebrado, não de "faça login".
 *
 * O que ela NÃO faz: **autorizar**. Este arquivo não valida a assinatura do
 * token nem consulta o banco; ele só olha se o cookie existe. Quem decide se a
 * sessão é válida é a API, em toda requisição (`JwtAuthGuard` + a linha em
 * `sessions`). Isto aqui é experiência de navegação, e tratá-lo como segurança
 * seria confiar num cookie que o próprio visitante pode escrever.
 *
 * É também por isso que a validade não é checada aqui: um cookie expirado
 * ainda existe, então a pessoa entra no painel e o primeiro 401 a leva ao
 * login — o caminho correto, já implementado nas telas.
 *
 * ## `/admin`
 *
 * Para as rotas do painel admin a decisão de QUAL tela existe vem da API: o
 * proxy pergunta `/v1/auth/me` (com o cookie da pessoa) e só deixa passar se
 * o papel for `admin`. Quem não é recebe **404**, não 403 — a rota não existe
 * para uma conta comum, e não há o que descobrir. Continua sendo experiência
 * de navegação: cada dado do painel admin sai de `/v1/admin/*`, que a API
 * protege por conta própria (`RolesGuard`).
 */

const API_INTERNA = (process.env.API_INTERNAL_URL ?? "http://localhost:3333").replace(/\/+$/, "");

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const hasSession = request.cookies.has(SESSION_COOKIE);
  if (!hasSession) {
    const login = new URL("/login", request.url);
    // Guarda para onde a pessoa ia, para o login devolvê-la ao lugar certo.
    login.searchParams.set("de", request.nextUrl.pathname);
    return NextResponse.redirect(login);
  }

  if (request.nextUrl.pathname === "/admin" || request.nextUrl.pathname.startsWith("/admin/")) {
    if (!(await ehAdmin(request))) {
      // Caminho que não existe: o Next desenha a página de "não encontrado"
      // (`app/not-found.tsx`), com 404. Dois segmentos de propósito: um só
      // cairia na rota `[slug]` do perfil público, que responde 200.
      return NextResponse.rewrite(new URL("/_/nao-encontrado", request.url));
    }
  }

  return NextResponse.next();
}

/** Pergunta à API, com o cookie da pessoa, se a sessão é de admin. Qualquer
 *  falha (API fora, sessão vencida) conta como "não": o 401 das telas, ou o
 *  404 daqui, cuidam do resto. */
async function ehAdmin(request: NextRequest): Promise<boolean> {
  try {
    const resposta = await fetch(`${API_INTERNA}/v1/auth/me`, {
      headers: { cookie: request.headers.get("cookie") ?? "" },
      cache: "no-store",
    });
    if (!resposta.ok) return false;
    const corpo = (await resposta.json()) as { user?: { role?: string } };
    return corpo.user?.role === "admin";
  } catch {
    return false;
  }
}

export const config = {
  matcher: [
    "/paginas",
    "/paginas/:path*",
    "/dominios",
    "/links",
    "/links/:path*",
    "/analytics",
    "/configuracoes",
    "/admin",
    "/admin/:path*",
  ],
};
