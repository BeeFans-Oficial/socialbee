"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { toast } from "sonner";

import { EsqueletoDeLinhas } from "@/components/painel/Esqueleto";
import { CabecalhoDeTela, Tela } from "@/components/painel/Tela";
import { SeloPro } from "@/components/shared/SeloPro";
import { api, ApiError } from "@/lib/api/client";
import type { AdminContaResumo, AdminPagina } from "@/lib/api/types";
import { cn } from "@/lib/utils";

const data = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" }) : "—";

/** Contas: busca por e-mail, nome ou endereço, e a lista das mais novas. */
export default function ContasPage() {
  const [busca, setBusca] = useState("");
  const [termo, setTermo] = useState("");
  const [pagina, setPagina] = useState(1);
  const [dados, setDados] = useState<AdminPagina<AdminContaResumo> | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setTermo(busca.trim());
      setPagina(1);
    }, 300);
    return () => clearTimeout(t);
  }, [busca]);

  useEffect(() => {
    let cancelado = false;
    setDados(null);
    api.admin
      .contas(termo, pagina)
      .then((r) => !cancelado && setDados(r))
      .catch((caught) => toast.error(caught instanceof ApiError ? caught.message : "Não foi possível carregar."));
    return () => {
      cancelado = true;
    };
  }, [termo, pagina]);

  const totalDePaginas = dados ? Math.max(1, Math.ceil(dados.total / dados.porPagina)) : 1;

  return (
    <Tela>
      <CabecalhoDeTela
        titulo="Contas"
        descricao={dados ? `${dados.total} ${dados.total === 1 ? "conta" : "contas"}${termo ? ` para "${termo}"` : ""}` : "Carregando…"}
        acoes={
          <label className="relative block w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="e-mail, nome ou endereço"
              autoFocus
              className="w-full h-10 pl-9 pr-3 rounded-lg bg-bee-surface border border-white/10 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-amber-400/50"
            />
          </label>
        }
      />

      {!dados ? (
        <EsqueletoDeLinhas linhas={6} />
      ) : dados.itens.length === 0 ? (
        <p className="py-16 text-center text-sm text-bee-muted">Nenhuma conta com esse termo.</p>
      ) : (
        <div className="rounded-xl border border-bee-line bg-bee-surface overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-bee-muted border-b border-bee-line">
                <th className="px-4 py-3 font-medium">Conta</th>
                <th className="px-4 py-3 font-medium hidden md:table-cell">Página</th>
                <th className="px-4 py-3 font-medium">Plano</th>
                <th className="px-4 py-3 font-medium hidden sm:table-cell text-right">Páginas</th>
                <th className="px-4 py-3 font-medium hidden lg:table-cell">Cadastro</th>
                <th className="px-4 py-3 font-medium hidden lg:table-cell">Último login</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-bee-line">
              {dados.itens.map((c) => (
                <tr key={c.id} className="hover:bg-white/[0.03] transition-colors">
                  <td className="px-4 py-3">
                    <Link href={`/admin/contas/${c.id}`} className="block min-w-0">
                      <span className="flex items-center gap-2 text-white truncate">
                        {c.email}
                        {c.role === "admin" && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wider bg-amber-400/15 text-amber-300 border border-amber-400/30">
                            ADMIN
                          </span>
                        )}
                      </span>
                      <span className="block md:hidden text-xs text-bee-muted truncate">{c.displayName ?? "—"}</span>
                    </Link>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-white/80">
                    <span className="block truncate">{c.displayName ?? "—"}</span>
                    {c.slug && <span className="block font-mono text-[11px] text-white/40">/{c.slug}</span>}
                  </td>
                  <td className="px-4 py-3">
                    {c.plan.id === "pro" ? (
                      <span className="inline-flex items-center gap-1.5">
                        <SeloPro />
                        <span className="text-xs text-white/50">até {data(c.plan.proUntil)}</span>
                      </span>
                    ) : (
                      <span className={cn("text-xs", c.plan.proUntil ? "text-white/50" : "text-white/40")}>
                        Free{c.plan.proUntil ? ` · venceu ${data(c.plan.proUntil)}` : ""}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell text-right tabular-nums text-white/80">{c.paginas}</td>
                  <td className="px-4 py-3 hidden lg:table-cell text-white/60">{data(c.createdAt)}</td>
                  <td className="px-4 py-3 hidden lg:table-cell text-white/60">{data(c.lastLoginAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {totalDePaginas > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-bee-line text-xs text-bee-muted">
              <span>
                Página {dados.pagina} de {totalDePaginas}
              </span>
              <span className="flex gap-2">
                <button onClick={() => setPagina((p) => Math.max(1, p - 1))} disabled={pagina <= 1} className="h-8 px-3 rounded-lg border border-white/15 text-white/80 disabled:opacity-40">
                  Anterior
                </button>
                <button onClick={() => setPagina((p) => Math.min(totalDePaginas, p + 1))} disabled={pagina >= totalDePaginas} className="h-8 px-3 rounded-lg border border-white/15 text-white/80 disabled:opacity-40">
                  Próxima
                </button>
              </span>
            </div>
          )}
        </div>
      )}
    </Tela>
  );
}
