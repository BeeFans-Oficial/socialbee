"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown, Plus } from "lucide-react";
import { toast } from "sonner";

import { SeloPro, avisarPro } from "@/components/shared/SeloPro";
import { api, ApiError, definirPaginaAtiva, paginaAtiva } from "@/lib/api/client";
import { invalidateSession, usePlano, useSession } from "@/lib/api/use-session";
import type { ApiProfile } from "@/lib/api/types";
import { SURGIR } from "@/lib/movimento";
import { cn } from "@/lib/utils";

/**
 * Qual página o painel está editando — e a troca.
 *
 * Uma conta pode ter várias páginas, cada uma com seu endereço, seu modelo,
 * seus links e seu relatório. Links, Analytics e os editores mostram a página
 * ATIVA (`x-profile-id`), e este é o único lugar que diz qual é. Havia dois
 * seletores — um na barra lateral, outro no cabeçalho de Links e Analytics —
 * cada um com a sua lista; ficou um, na barra do topo, em toda tela.
 *
 * A lista é buscada só quando abre: o seletor existe em toda tela do painel,
 * e buscar as páginas a cada navegação seria uma requisição a mais por tela.
 * Fechado, mostra a página da sessão, que já está em memória.
 *
 * **Trocar recarrega.** Links, relatório e prévia já estão em memória com os
 * dados da página anterior; recarregar é o que garante que nada sobre. Num
 * editor, a troca leva ao editor da página nova (ou à lista de links), porque
 * o editor de página torna ativa a página DELE ao montar — recarregar no
 * mesmo endereço desfaria a escolha.
 */
export function EscolhaDePagina({ className }: { className?: string }) {
  const pathname = usePathname();
  const { session } = useSession();
  const { plano, ehPro } = usePlano();
  const [paginas, setPaginas] = useState<ApiProfile[] | null>(null);
  const [aberto, setAberto] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberto || paginas !== null) return;
    api
      .profiles()
      .then(setPaginas)
      .catch((caught) => {
        setPaginas([]);
        if (!(caught instanceof ApiError && caught.isUnauthorized)) {
          toast.error("Não foi possível carregar suas páginas.");
        }
      });
  }, [aberto, paginas]);

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

  const atual = session?.profile ?? null;
  if (!atual) return null;

  const idAtiva = paginaAtiva() ?? atual.id;
  const limite = plano?.limits.paginas ?? null;
  const noLimite = limite !== null && (paginas?.length ?? 1) >= limite;

  const escolher = (id: string) => {
    setAberto(false);
    if (id === idAtiva) return;
    definirPaginaAtiva(id);
    invalidateSession();
    if (pathname.startsWith("/paginas/")) {
      window.location.href = `/paginas/${id}`;
    } else if (pathname.startsWith("/links/")) {
      window.location.href = "/links";
    } else {
      window.location.reload();
    }
  };

  return (
    <div ref={caixa} className={cn("relative min-w-0", className)}>
      <button
        data-tour="seletor-de-pagina"
        onClick={() => setAberto((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={aberto}
        title={`${atual.host}/${atual.slug}`}
        className="flex items-center gap-2 h-9 lg:h-10 pl-1.5 pr-2.5 rounded-lg border border-white/10 bg-white/[0.03] hover:border-white/20 transition-colors max-w-[180px] sm:max-w-[260px]"
      >
        <Avatar pagina={atual} />
        <span className="min-w-0 text-left">
          <span className="block text-sm font-medium text-white truncate">{atual.displayName}</span>
          <span className="hidden lg:block font-mono text-[11px] text-white/40 truncate leading-none">
            {atual.host}/{atual.slug}
          </span>
        </span>
        <ChevronDown
          className={cn(
            "w-4 h-4 text-white/50 flex-shrink-0 transition-transform duration-200 ease-[cubic-bezier(0.2,0,0,1)]",
            aberto && "rotate-180",
          )}
        />
      </button>

      <AnimatePresence>
        {aberto && (
        <motion.div
          role="listbox"
          variants={SURGIR}
          initial="initial"
          animate="animate"
          exit="exit"
          style={{ transformOrigin: "top right" }}
          className="absolute right-0 z-40 mt-2 w-[calc(100vw-2rem)] max-w-xs rounded-xl border border-white/10 bg-bee-surface shadow-2xl overflow-hidden"
        >
          <div className="px-3 pt-3 pb-1.5 text-[10px] font-semibold tracking-[0.14em] text-white/40">
            SUAS PÁGINAS
          </div>
          <div className="max-h-72 overflow-y-auto sem-barra pb-1">
            {paginas === null && <div className="px-3 py-3 text-xs text-white/30">Carregando…</div>}
            {paginas?.map((p) => (
              <button
                key={p.id}
                role="option"
                aria-selected={p.id === idAtiva}
                onClick={() => escolher(p.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2 text-left transition-colors",
                  p.id === idAtiva ? "bg-white/[0.05]" : "hover:bg-white/[0.04]",
                )}
              >
                <Avatar pagina={p} />
                <span className="flex-1 min-w-0">
                  <span className="block text-sm text-white truncate">{p.displayName}</span>
                  <span className="block font-mono text-[11px] text-white/40 truncate">
                    {p.host}/{p.slug}
                    {!p.published && " · fora do ar"}
                  </span>
                </span>
                {p.id === idAtiva && <Check className="w-4 h-4 text-bee-pink flex-shrink-0" />}
              </button>
            ))}
          </div>
          <div className="border-t border-bee-line">
            {noLimite && !ehPro ? (
              <button
                onClick={() => avisarPro("Mais de uma página")}
                className="flex items-center gap-2 w-full px-3 py-2.5 text-xs text-white/50 hover:text-white transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Nova página
                <SeloPro className="ml-auto" />
              </button>
            ) : (
              <Link
                href="/paginas?nova=1"
                onClick={() => setAberto(false)}
                className="flex items-center gap-2 px-3 py-2.5 text-xs text-white/70 hover:text-white transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Nova página
              </Link>
            )}
            <Link
              href="/paginas"
              onClick={() => setAberto(false)}
              className="block px-3 pb-2.5 text-xs text-white/50 hover:text-white transition-colors"
            >
              Gerenciar páginas
            </Link>
          </div>
        </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Avatar({ pagina }: { pagina: Pick<ApiProfile, "avatarUrl" | "displayName"> }) {
  return (
    <span className="w-7 h-7 rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center bg-gradient-to-br from-bee-pink to-bee-pink-hot text-[11px] font-semibold text-white">
      {pagina.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- imagem do próprio perfil
        <img src={pagina.avatarUrl} alt="" className="w-full h-full object-cover" />
      ) : (
        pagina.displayName.slice(0, 1).toUpperCase()
      )}
    </span>
  );
}
