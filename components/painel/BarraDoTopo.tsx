"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { LogOut, Settings } from "lucide-react";

import { Logo } from "@/components/shared/Logo";
import { EscolhaDePagina } from "@/components/painel/EscolhaDePagina";
import { tituloDaRota } from "@/components/painel/Navegacao";
import type { ApiPlan } from "@/lib/api/types";
import { sairDoPainel, useSession } from "@/lib/api/use-session";
import { SURGIR } from "@/lib/movimento";
import { cn } from "@/lib/utils";

/**
 * Barra do topo, em toda tela do painel.
 *
 * Responde três perguntas de uma vez: onde estou (título, no computador),
 * QUAL página estou editando (o seletor, que é o único lugar do painel que
 * troca de página) e qual é o meu plano. No celular o título sai — a própria
 * tela tem o seu — e entra o símbolo da marca.
 *
 * Sair mora no menu da conta, longe da navegação: ação destrutiva não fica
 * ao lado de "Links".
 */
export function BarraDoTopo() {
  const pathname = usePathname();
  const { session } = useSession();
  const plano = session?.user.plan ?? null;

  return (
    <header className="sticky top-0 z-30 h-14 lg:h-16 flex items-center gap-3 px-4 lg:px-8 border-b border-bee-line bg-bee-bg/85 backdrop-blur">
      <Link href="/paginas" aria-label="Páginas" className="lg:hidden flex-shrink-0">
        <Logo variant="icon" size="sm" />
      </Link>
      <span className="hidden lg:block text-sm font-medium text-white">{tituloDaRota(pathname)}</span>

      <div className="ml-auto flex items-center gap-2 lg:gap-3 min-w-0">
        <EscolhaDePagina />
        {plano && <SeloDoPlano plano={plano} />}
        <MenuDaConta />
      </div>
    </header>
  );
}

function SeloDoPlano({ plano }: { plano: ApiPlan }) {
  const legenda = legendaDoPlano(plano);
  return (
    <span
      title={legenda}
      className={cn(
        "inline-flex items-center h-8 px-2.5 lg:px-3 rounded-full text-[11px] font-bold tracking-[0.14em] border flex-shrink-0",
        plano.id === "pro"
          ? "bg-bee-pink/10 text-bee-pink border-bee-pink/40"
          : "bg-white/[0.04] text-white/55 border-white/15",
      )}
    >
      {plano.id === "pro" ? "PRO" : "FREE"}
      {legenda && (
        <span className="hidden lg:inline ml-2 font-medium tracking-normal opacity-80">{legenda}</span>
      )}
    </span>
  );
}

/** "até 05/11" no Pro; no Free, se já foi Pro, quando venceu. */
function legendaDoPlano(plano: ApiPlan): string {
  const fim = plano.proUntil ? new Date(plano.proUntil) : null;
  // O ano só aparece quando não é o atual: "até 06/10" num plano que vai até
  // 2037 parece vencer hoje.
  const data = fim
    ? fim.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        ...(fim.getFullYear() !== new Date().getFullYear() ? { year: "numeric" } : {}),
      })
    : null;
  if (plano.id === "pro") return data ? `até ${data}` : "";
  return data ? `Pro venceu em ${data}` : "plano gratuito";
}

/** Avatar da conta (inicial do email) que abre email, configurações e sair.
 *  Só no computador: no celular isso vive na folha "Mais". */
function MenuDaConta() {
  const { session } = useSession();
  const email = session?.user.email ?? "";
  const [aberto, setAberto] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => {
      if (caixa.current && !caixa.current.contains(e.target as Node)) setAberto(false);
    };
    const tecla = (e: KeyboardEvent) => e.key === "Escape" && setAberto(false);
    document.addEventListener("mousedown", fora);
    document.addEventListener("keydown", tecla);
    return () => {
      document.removeEventListener("mousedown", fora);
      document.removeEventListener("keydown", tecla);
    };
  }, [aberto]);

  if (!email) return null;

  return (
    <div ref={caixa} className="relative hidden lg:block">
      <button
        onClick={() => setAberto((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={aberto}
        aria-label="Menu da conta"
        title={email}
        className="w-8 h-8 rounded-full border border-white/15 flex items-center justify-center text-xs font-semibold text-white/80 uppercase hover:border-white/40 transition-colors"
      >
        {email[0]}
      </button>
      <AnimatePresence>
        {aberto && (
        <motion.div
          role="menu"
          variants={SURGIR}
          initial="initial"
          animate="animate"
          exit="exit"
          style={{ transformOrigin: "top right" }}
          className="absolute right-0 z-40 mt-2 w-64 rounded-xl border border-white/10 bg-bee-surface shadow-2xl overflow-hidden"
        >
          <div className="px-3 py-3 border-b border-bee-line">
            <div className="text-xs text-white/40">Conta</div>
            <div className="text-sm text-white truncate" title={email}>
              {email}
            </div>
          </div>
          <Link
            href="/configuracoes"
            role="menuitem"
            onClick={() => setAberto(false)}
            className="flex items-center gap-2.5 px-3 py-2.5 text-sm text-white/80 hover:bg-white/[0.04] hover:text-white transition-colors"
          >
            <Settings className="w-4 h-4" />
            Configurações
          </Link>
          <button
            role="menuitem"
            onClick={() => void sairDoPainel()}
            className="flex items-center gap-2.5 w-full px-3 py-2.5 border-t border-bee-line text-sm text-white/60 hover:bg-white/[0.04] hover:text-white transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sair
          </button>
        </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
