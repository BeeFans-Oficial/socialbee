"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { toast } from "sonner";

import {
  CLASSE_DO_CAMPO_ADMIN,
  CabecalhoAdmin,
  EsqueletoDeLinhasAdmin,
  Paginacao,
  SeloAdmin,
  SeloProAdmin,
  TelaAdmin,
} from "@/components/admin/Ui";
import { api, ApiError } from "@/lib/api/client";
import type { AdminContaResumo, AdminPagina } from "@/lib/api/types";

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

  return (
    <TelaAdmin>
      <CabecalhoAdmin
        titulo="Contas"
        descricao={dados ? `${dados.total} ${dados.total === 1 ? "conta" : "contas"}${termo ? ` para "${termo}"` : ""}` : "Carregando…"}
        acoes={
          <label className="relative block w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-admin-faint" />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="e-mail, nome ou endereço"
              autoFocus
              className={`${CLASSE_DO_CAMPO_ADMIN} h-10 pl-9`}
            />
          </label>
        }
      />

      {!dados ? (
        <EsqueletoDeLinhasAdmin />
      ) : dados.itens.length === 0 ? (
        <p className="py-16 text-center text-sm text-admin-muted">Nenhuma conta com esse termo.</p>
      ) : (
        <div className="rounded-xl border border-admin-line bg-admin-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-admin-muted border-b border-admin-line bg-admin-hover/50">
                <th className="px-4 py-3 font-medium">Conta</th>
                <th className="px-4 py-3 font-medium hidden md:table-cell">Página</th>
                <th className="px-4 py-3 font-medium">Plano</th>
                <th className="px-4 py-3 font-medium hidden sm:table-cell text-right">Páginas</th>
                <th className="px-4 py-3 font-medium hidden lg:table-cell">Cadastro</th>
                <th className="px-4 py-3 font-medium hidden lg:table-cell">Último login</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-admin-line">
              {dados.itens.map((c) => (
                <tr key={c.id} className="hover:bg-admin-hover/60 transition-colors">
                  <td className="px-4 py-3">
                    <Link href={`/admin/contas/${c.id}`} className="block min-w-0">
                      <span className="flex items-center gap-2 text-admin-ink font-medium truncate">
                        {c.email}
                        {c.role === "admin" && <SeloAdmin />}
                      </span>
                      <span className="block md:hidden text-xs text-admin-muted truncate">{c.displayName ?? "—"}</span>
                    </Link>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-admin-ink/85">
                    <span className="block truncate">{c.displayName ?? "—"}</span>
                    {c.slug && <span className="block font-mono text-[11px] text-admin-faint">/{c.slug}</span>}
                  </td>
                  <td className="px-4 py-3">
                    {c.plan.id === "pro" ? (
                      <span className="inline-flex items-center gap-1.5">
                        <SeloProAdmin />
                        <span className="text-xs text-admin-muted">até {data(c.plan.proUntil)}</span>
                      </span>
                    ) : (
                      <span className="text-xs text-admin-muted">Free{c.plan.proUntil ? ` · venceu ${data(c.plan.proUntil)}` : ""}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell text-right tabular-nums text-admin-ink/85">{c.paginas}</td>
                  <td className="px-4 py-3 hidden lg:table-cell text-admin-muted">{data(c.createdAt)}</td>
                  <td className="px-4 py-3 hidden lg:table-cell text-admin-muted">{data(c.lastLoginAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <Paginacao pagina={dados.pagina} total={dados.total} porPagina={dados.porPagina} onMudar={setPagina} />
        </div>
      )}
    </TelaAdmin>
  );
}
