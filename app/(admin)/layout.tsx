import React from "react";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { Toaster } from "sonner";

import { ShellAdmin } from "@/components/admin/ShellAdmin";
import { SESSION_COOKIE } from "@/lib/session-cookie";

const API_INTERNA = (process.env.API_INTERNAL_URL ?? "http://localhost:3333").replace(/\/+$/, "");

/**
 * O painel admin, dentro do mesmo app.
 *
 * Segunda barreira, depois do `proxy.ts`: este layout roda no servidor e
 * pergunta à API se a sessão é de admin antes de desenhar qualquer coisa.
 * Não é redundância por desconfiança do proxy; é que o proxy pode ser
 * contornado por configuração (matcher errado, rota nova esquecida), e este
 * arquivo cobre todas as rotas do grupo de uma vez. Quem não é admin recebe a
 * página de "não encontrado".
 *
 * Os dados de cada tela continuam vindo de `/v1/admin/*`, que a API protege
 * por conta própria — as duas checagens daqui decidem só o que se desenha.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const jar = await cookies();
  const cookie = jar.get(SESSION_COOKIE);
  if (!cookie) notFound();

  let papel: string | undefined;
  try {
    const resposta = await fetch(`${API_INTERNA}/v1/auth/me`, {
      headers: { cookie: `${SESSION_COOKIE}=${cookie.value}` },
      cache: "no-store",
    });
    if (resposta.ok) papel = ((await resposta.json()) as { user?: { role?: string } }).user?.role;
  } catch {
    papel = undefined;
  }
  if (papel !== "admin") notFound();

  return (
    <>
      <Toaster position="top-center" richColors />
      <ShellAdmin>{children}</ShellAdmin>
    </>
  );
}
