"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Check, ChevronDown } from "lucide-react";

import { api, definirPaginaAtiva, paginaAtiva } from "@/lib/api/client";
import { invalidateSession, useSession } from "@/lib/api/use-session";
import type { ApiProfile } from "@/lib/api/types";
import { cn } from "@/lib/utils";

/**
 * Qual página esta tela está mostrando — e a troca, ali mesmo.
 *
 * Links, cliques e aparência são de UMA página por vez: a ativa do painel
 * (`x-profile-id`). Antes, trocar só era possível pelo seletor pequeno da
 * barra lateral; quem tinha várias páginas não via, na própria tela, de qual
 * eram os links listados.
 *
 * Com uma página só, não aparece: não há o que escolher.
 *
 * Trocar recarrega a tela, como o seletor da barra lateral: a barra lateral e
 * o topo guardam a sessão em memória, e recarregar é o que garante que tudo
 * passe a falar da página nova ao mesmo tempo.
 */
export function EscolhaDePagina({ className }: { className?: string }) {
  const { session } = useSession();
  const [paginas, setPaginas] = useState<ApiProfile[] | null>(null);
  const [aberto, setAberto] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api
      .profiles()
      .then(setPaginas)
      .catch(() => setPaginas([]));
  }, []);

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

  if (!paginas || paginas.length < 2) return null;

  const idAtiva = paginaAtiva() ?? session?.profile.id ?? null;
  const atual = paginas.find((p) => p.id === idAtiva) ?? paginas[0];

  const escolher = (id: string) => {
    setAberto(false);
    if (id === atual.id) return;
    definirPaginaAtiva(id);
    invalidateSession();
    window.location.reload();
  };

  return (
    <div ref={caixa} className={cn("relative", className)}>
      <button
        onClick={() => setAberto((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={aberto}
        className="flex items-center gap-2.5 h-10 pl-1.5 pr-3 rounded-lg border border-white/10 bg-white/[0.03] hover:border-white/20 transition-colors max-w-[260px]"
      >
        <Avatar pagina={atual} />
        <span className="min-w-0 text-left">
          <span className="block text-sm font-medium text-white truncate">{atual.displayName}</span>
        </span>
        <ChevronDown className={cn("w-4 h-4 text-white/50 flex-shrink-0 transition-transform", aberto && "rotate-180")} />
      </button>

      {aberto && (
        <div
          role="listbox"
          className="absolute right-0 z-40 mt-2 w-72 rounded-xl border border-white/10 bg-[#141414] shadow-2xl overflow-hidden"
        >
          <div className="px-3 pt-3 pb-1.5 text-[10px] font-semibold tracking-[0.14em] text-white/40">
            SUAS PÁGINAS
          </div>
          <div className="max-h-72 overflow-y-auto sem-barra pb-1">
            {paginas.map((p) => (
              <button
                key={p.id}
                role="option"
                aria-selected={p.id === atual.id}
                onClick={() => escolher(p.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2 text-left transition-colors",
                  p.id === atual.id ? "bg-white/[0.05]" : "hover:bg-white/[0.04]",
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
                {p.id === atual.id && <Check className="w-4 h-4 text-white flex-shrink-0" />}
              </button>
            ))}
          </div>
          <Link
            href="/paginas"
            className="block px-3 py-2.5 border-t border-white/[0.06] text-xs text-white/50 hover:text-white transition-colors"
          >
            Gerenciar páginas
          </Link>
        </div>
      )}
    </div>
  );
}

function Avatar({ pagina }: { pagina: ApiProfile }) {
  return (
    <span className="w-7 h-7 rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center bg-white/10 text-[11px] font-semibold text-white">
      {pagina.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- data URL do próprio perfil
        <img src={pagina.avatarUrl} alt="" className="w-full h-full object-cover" />
      ) : (
        pagina.displayName.slice(0, 1).toUpperCase()
      )}
    </span>
  );
}
