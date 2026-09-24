"use client";

import React, { useEffect, useRef, useState } from "react";
import { Check, ChevronsUpDown, Plus, X } from "lucide-react";
import { toast } from "sonner";

import { api, ApiError, definirPaginaAtiva, paginaAtiva } from "@/lib/api/client";
import { invalidateSession } from "@/lib/api/use-session";
import { TEMPLATES } from "@/lib/templates";
import { slugify } from "@/lib/utils";
import { siteHost } from "@/lib/site";
import type { ApiProfile } from "@/lib/api/types";
import { cn } from "@/lib/utils";

/**
 * Troca de PÁGINA, na Sidebar.
 *
 * Uma conta pode ter várias páginas — cada uma com seu endereço, seu modelo,
 * seus links e seu relatório. Este é o único lugar do painel que responde "qual
 * delas estou editando", e por isso ele fica no topo, junto do nome: todas as
 * outras telas mostram o conteúdo da página escolhida aqui, e não saber qual é
 * transformaria cada edição num palpite.
 *
 * **Trocar recarrega a página do painel.** É deliberado e não preguiça: links,
 * relatório, aparência e prévia já estão carregados em memória com os dados da
 * página anterior, e um recarregamento garante que nada sobre. O caminho
 * elegante seria invalidar cada cache, e cada um esquecido seria dado de uma
 * página aparecendo dentro de outra.
 */

interface SeletorDePaginaProps {
  /** Slug da página ativa, como a Sidebar já conhece. */
  slugAtual: string;
}

export function SeletorDePagina({ slugAtual }: SeletorDePaginaProps) {
  const [aberto, setAberto] = useState(false);
  const [paginas, setPaginas] = useState<ApiProfile[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [criando, setCriando] = useState(false);
  const [nome, setNome] = useState("");
  const [slug, setSlug] = useState("");
  const [templateId, setTemplateId] = useState(TEMPLATES[0].id);
  const [salvando, setSalvando] = useState(false);
  const caixaRef = useRef<HTMLDivElement>(null);

  // Carrega a lista só quando abre: a Sidebar existe em toda tela do painel, e
  // buscar as páginas em todas elas seria uma requisição por navegação.
  useEffect(() => {
    if (!aberto || paginas.length > 0) return;
    setCarregando(true);
    api
      .profiles()
      .then(setPaginas)
      .catch((caught) => {
        if (!(caught instanceof ApiError && caught.isUnauthorized)) {
          toast.error("Não foi possível carregar suas páginas.");
        }
      })
      .finally(() => setCarregando(false));
  }, [aberto, paginas.length]);

  // Fecha ao clicar fora. Sem isso o painel fica aberto por cima da navegação.
  useEffect(() => {
    if (!aberto) return;
    const aoClicar = (e: MouseEvent) => {
      if (caixaRef.current && !caixaRef.current.contains(e.target as Node)) {
        setAberto(false);
        setCriando(false);
      }
    };
    document.addEventListener("mousedown", aoClicar);
    return () => document.removeEventListener("mousedown", aoClicar);
  }, [aberto]);

  const trocar = (profileId: string) => {
    if (profileId === paginaAtiva()) {
      setAberto(false);
      return;
    }
    definirPaginaAtiva(profileId);
    invalidateSession();
    window.location.reload();
  };

  const criar = async () => {
    const limpo = slug.trim() || slugify(nome);
    if (!nome.trim() || limpo.length < 3) {
      toast.error("Dê um nome e um endereço de pelo menos 3 letras.");
      return;
    }
    setSalvando(true);
    try {
      const nova = await api.createProfile({
        displayName: nome.trim(),
        slug: limpo,
        templateId,
      });
      // Já entra editando a página recém-criada: criar e continuar na antiga
      // seria a resposta errada para "criei uma página".
      definirPaginaAtiva(nova.id);
      invalidateSession();
      window.location.reload();
    } catch (caught) {
      toast.error(
        caught instanceof ApiError ? caught.message : "Não foi possível criar a página.",
      );
      setSalvando(false);
    }
  };

  return (
    <div className="relative" ref={caixaRef}>
      <button
        onClick={() => setAberto((v) => !v)}
        className="flex items-center gap-1.5 w-full text-left group"
        title="Trocar de página"
      >
        <span className="text-xs text-bee-pink truncate">
          {siteHost()}/{slugAtual}
        </span>
        <ChevronsUpDown className="w-3 h-3 text-white/25 group-hover:text-white/50 flex-shrink-0" />
      </button>

      {aberto && (
        <div className="absolute z-50 left-0 right-0 mt-2 rounded-xl border border-white/10 bg-bee-surface shadow-2xl overflow-hidden">
          {criando ? (
            <div className="p-3 space-y-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] uppercase tracking-wider text-white/40">
                  Nova página
                </span>
                <button
                  onClick={() => setCriando(false)}
                  className="text-white/30 hover:text-white/70"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <input
                value={nome}
                onChange={(e) => {
                  setNome(e.target.value);
                  // O endereço acompanha o nome até a criadora mexer nele —
                  // depois disso ela manda, senão digitar o slug seria inútil.
                  if (!slug || slug === slugify(nome)) setSlug(slugify(e.target.value));
                }}
                placeholder="Nome da página"
                className="w-full px-2.5 py-2 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-bee-pink/40"
              />

              <div className="flex items-center gap-1 px-2.5 py-2 rounded-lg bg-white/[0.04] border border-white/10">
                <span className="text-[11px] text-white/30 flex-shrink-0">{siteHost()}/</span>
                <input
                  value={slug}
                  onChange={(e) => setSlug(slugify(e.target.value))}
                  placeholder="endereco"
                  className="flex-1 min-w-0 bg-transparent text-sm text-white placeholder:text-white/25 focus:outline-none"
                />
              </div>

              <select
                value={templateId}
                onChange={(e) => setTemplateId(e.target.value)}
                className="w-full px-2.5 py-2 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-white focus:outline-none focus:border-bee-pink/40"
              >
                {TEMPLATES.map((t) => (
                  <option key={t.id} value={t.id} className="bg-bee-surface">
                    Modelo: {t.label}
                  </option>
                ))}
              </select>

              <button
                onClick={criar}
                disabled={salvando}
                className="w-full py-2 rounded-lg bg-bee-pink text-white text-xs font-semibold hover:opacity-90 disabled:opacity-40"
              >
                {salvando ? "Criando…" : "Criar página"}
              </button>
            </div>
          ) : (
            <>
              <div className="max-h-64 overflow-y-auto py-1">
                {carregando && (
                  <div className="px-3 py-3 text-xs text-white/30">Carregando…</div>
                )}
                {paginas.map((p) => {
                  const ativa = p.slug === slugAtual;
                  return (
                    <button
                      key={p.id}
                      onClick={() => trocar(p.id)}
                      className={cn(
                        "flex items-center gap-2 w-full px-3 py-2.5 text-left hover:bg-white/[0.04] transition-colors",
                        ativa && "bg-white/[0.03]",
                      )}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-white truncate">{p.displayName}</div>
                        <div className="text-[11px] text-white/35 truncate">
                          /{p.slug} · {TEMPLATES.find((t) => t.id === p.template?.templateId)?.label ?? "Clássico"}
                        </div>
                      </div>
                      {ativa && <Check className="w-3.5 h-3.5 text-bee-pink flex-shrink-0" />}
                    </button>
                  );
                })}
              </div>

              <button
                onClick={() => setCriando(true)}
                className="flex items-center gap-2 w-full px-3 py-2.5 border-t border-white/[0.06] text-xs text-white/60 hover:text-white hover:bg-white/[0.04] transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Nova página
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
