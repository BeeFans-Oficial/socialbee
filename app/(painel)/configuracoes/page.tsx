"use client";

import React from "react";
import { LogOut } from "lucide-react";

import { CabecalhoDeTela, Tela } from "@/components/painel/Tela";
import { SeloPro } from "@/components/shared/SeloPro";
import { sairDoPainel, useSession } from "@/lib/api/use-session";

/**
 * Configurações da CONTA (email, plano, sair).
 *
 * Era um placeholder com o título em caixa alta e nada embaixo. Continua
 * curta — troca de senha e assinatura ainda não existem (ver README) — mas
 * agora mostra o que já se sabe da conta e é o segundo lugar de onde se sai
 * do painel, além do menu da conta na barra do topo.
 */
export default function ConfiguracoesPage() {
  const { session, loading } = useSession();
  const plano = session?.user.plan ?? null;
  const vence = plano?.proUntil ? new Date(plano.proUntil).toLocaleDateString("pt-BR") : null;

  return (
    <Tela largura="estreita">
      <CabecalhoDeTela titulo="Configurações" descricao="A sua conta na BeeSocial." />

      <section className="rounded-2xl border border-bee-line bg-bee-surface divide-y divide-bee-line">
        <Linha rotulo="E-mail">
          <span className="flex flex-col items-end gap-0.5 min-w-0">
            <span className="text-sm text-white truncate">{loading ? "…" : session?.user.email ?? "—"}</span>
            {session && (
              <span className={session.user.isEmailConfirmed ? "text-xs text-emerald-400" : "text-xs text-bee-muted"}>
                {session.user.isEmailConfirmed ? "confirmado" : "não confirmado"}
              </span>
            )}
          </span>
        </Linha>
        <Linha rotulo="Plano">
          {plano ? (
            <span className="flex items-center gap-2 text-sm text-white">
              {plano.id === "pro" ? (
                <>
                  <SeloPro />
                  {vence && <span className="text-bee-muted">até {vence}</span>}
                </>
              ) : (
                <>
                  Free
                  {vence && <span className="text-bee-muted">· Pro venceu em {vence}</span>}
                </>
              )}
            </span>
          ) : (
            <span className="text-sm text-bee-muted">…</span>
          )}
        </Linha>
      </section>

      {plano?.id === "free" && (
        <p className="mt-3 text-xs text-bee-muted">
          O Pro libera páginas e links sem limite, todos os modelos, a escolha do domínio e o
          relatório de cliques. A liberação é feita pela equipe.
        </p>
      )}

      <section className="mt-8">
        <h2 className="text-[11px] font-semibold tracking-[0.14em] uppercase text-white/40 mb-3">Sessão</h2>
        <button
          onClick={() => void sairDoPainel()}
          className="inline-flex items-center gap-2 h-10 px-4 rounded-lg border border-white/15 text-sm text-white/80 hover:text-white hover:border-white/30 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Sair da conta
        </button>
      </section>
    </Tela>
  );
}

function Linha({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 px-5 py-4">
      <span className="text-sm text-bee-muted">{rotulo}</span>
      <span className="min-w-0 text-right">{children}</span>
    </div>
  );
}
