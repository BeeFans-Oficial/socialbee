import { NextResponse, type NextRequest } from "next/server";

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
 */

const COOKIE_NAME = process.env.COOKIE_NAME || "beesocial_session";

export function proxy(request: NextRequest): NextResponse {
  const hasSession = request.cookies.has(COOKIE_NAME);
  if (hasSession) return NextResponse.next();

  const login = new URL("/login", request.url);
  // Guarda para onde a pessoa ia, para o login devolvê-la ao lugar certo.
  login.searchParams.set("de", request.nextUrl.pathname);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/links", "/aparencia", "/analytics", "/configuracoes", "/dashboard"],
};
