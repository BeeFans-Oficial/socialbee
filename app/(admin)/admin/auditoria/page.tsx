"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";

import { CabecalhoAdmin, EsqueletoDeLinhasAdmin, Paginacao, TelaAdmin } from "@/components/admin/Ui";
import { api, ApiError } from "@/lib/api/client";
import type { AdminAcao, AdminPagina } from "@/lib/api/types";

const NOMES: Record<string, string> = {
  "plano.liberar": "Liberou o Pro",
  "plano.rebaixar": "Tirou o Pro",
  "sessoes.revogar": "Revogou sessões",
  "admin.promover": "Promoveu a admin",
  "admin.rebaixar": "Tirou o papel de admin",
};

export function nomeDaAcao(action: string): string {
  return NOMES[action] ?? action;
}

export function quando(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
}

/** Auditoria: tudo que foi feito como admin, do mais recente ao mais antigo. */
export default function AuditoriaPage() {
  const [pagina, setPagina] = useState(1);
  const [dados, setDados] = useState<AdminPagina<AdminAcao> | null>(null);

  useEffect(() => {
    setDados(null);
    api.admin
      .auditoria(pagina)
      .then(setDados)
      .catch((caught) => toast.error(caught instanceof ApiError ? caught.message : "Não foi possível carregar."));
  }, [pagina]);

  return (
    <TelaAdmin>
      <CabecalhoAdmin titulo="Auditoria" descricao={dados ? `${dados.total} ${dados.total === 1 ? "ação registrada" : "ações registradas"}` : "Carregando…"} />
      {!dados ? (
        <EsqueletoDeLinhasAdmin />
      ) : dados.itens.length === 0 ? (
        <p className="py-16 text-center text-sm text-zinc-500">Nenhuma ação ainda.</p>
      ) : (
        <div className="rounded-xl border border-zinc-300 bg-admin-card shadow-sm overflow-hidden">
          <ul className="divide-y divide-zinc-200">
            {dados.itens.map((a) => (
              <li key={a.id} className="px-4 py-3">
                <LinhaDeAcao acao={a} />
              </li>
            ))}
          </ul>
          <Paginacao pagina={dados.pagina} total={dados.total} porPagina={dados.porPagina} onMudar={setPagina} />
        </div>
      )}
    </TelaAdmin>
  );
}

/** Uma ação: quem, o quê, em quem, por quê. Usada aqui e no detalhe da conta. */
export function LinhaDeAcao({ acao, semAlvo }: { acao: AdminAcao; semAlvo?: boolean }) {
  const detalhes: string[] = [];
  if (typeof acao.details.dias === "number") detalhes.push(`${acao.details.dias} dias`);
  if (typeof acao.details.ate === "string") detalhes.push(`até ${acao.details.ate}`);
  if (typeof acao.details.revogadas === "number") detalhes.push(`${acao.details.revogadas} ${acao.details.revogadas === 1 ? "sessão" : "sessões"}`);
  return (
    <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-4 text-sm">
      <span className="text-xs text-zinc-400 tabular-nums sm:w-28 flex-shrink-0">{quando(acao.createdAt)}</span>
      <span className="min-w-0 flex-1">
        <span className="text-zinc-900 font-medium">{nomeDaAcao(acao.action)}</span>
        {detalhes.length > 0 && <span className="text-zinc-500"> · {detalhes.join(" · ")}</span>}
        {!semAlvo && acao.alvo.email && (
          <>
            <span className="text-zinc-400"> em </span>
            {acao.alvo.id ? (
              <Link href={`/admin/contas/${acao.alvo.id}`} className="text-zinc-800 underline decoration-dotted underline-offset-2 hover:text-amber-700">
                {acao.alvo.email}
              </Link>
            ) : (
              <span className="text-zinc-500">{acao.alvo.email} (conta apagada)</span>
            )}
          </>
        )}
        <span className="block text-xs text-zinc-500 mt-0.5">
          por {acao.admin.email ?? "script"} · “{acao.reason}”
        </span>
      </span>
    </div>
  );
}
