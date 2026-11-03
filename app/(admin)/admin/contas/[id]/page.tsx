"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { toast } from "sonner";

import { CampoDoDialogo, DialogoDeAcao } from "@/components/admin/DialogoDeAcao";
import {
  BotaoAdmin,
  CLASSE_DO_CAMPO_ADMIN,
  CabecalhoAdmin,
  CartaoAdmin,
  EsqueletoAdmin,
  SeloAdmin,
  SeloProAdmin,
  TelaAdmin,
} from "@/components/admin/Ui";
import { api, ApiError } from "@/lib/api/client";
import { useSession } from "@/lib/api/use-session";
import type { AdminContaDetalhe } from "@/lib/api/types";
import { urlDaPagina } from "@/lib/site";
import { cn } from "@/lib/utils";
import { LinhaDeAcao } from "../../auditoria/page";

const data = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—";

type Acao = "liberar" | "rebaixar" | "sessoes" | "promover" | "despromover" | null;

/**
 * Uma conta: o que ela tem e o que o admin pode fazer com ela. Toda ação abre
 * um diálogo que exige motivo, e a lista de ações no fim da tela mostra o
 * rastro na hora.
 */
export default function ContaPage() {
  const { id } = useParams<{ id: string }>();
  const { session } = useSession();
  const [conta, setConta] = useState<AdminContaDetalhe | null>(null);
  const [acao, setAcao] = useState<Acao>(null);
  const [dias, setDias] = useState("30");
  const [ate, setAte] = useState("");

  const carregar = useCallback(() => {
    api.admin
      .conta(id)
      .then(setConta)
      .catch((caught) => toast.error(caught instanceof ApiError ? caught.message : "Não foi possível carregar."));
  }, [id]);
  useEffect(carregar, [carregar]);

  const executar = async (fazer: () => Promise<unknown>, sucesso: string) => {
    try {
      await fazer();
      toast.success(sucesso);
      carregar();
    } catch (caught) {
      throw new Error(caught instanceof ApiError ? caught.message : "Não foi possível concluir.");
    }
  };

  if (!conta) {
    return (
      <TelaAdmin>
        <div role="status" aria-label="Carregando" data-esqueleto>
          <EsqueletoAdmin className="h-8 w-64 mb-2" />
          <EsqueletoAdmin className="h-4 w-40 mb-8" />
          <EsqueletoAdmin className="h-40 w-full rounded-xl mb-4" />
          <EsqueletoAdmin className="h-40 w-full rounded-xl" />
        </div>
      </TelaAdmin>
    );
  }

  const souEu = session?.user.id === conta.id;
  const ehPro = conta.plan.id === "pro";

  return (
    <TelaAdmin>
      <CabecalhoAdmin
        voltar={
          <Link href="/admin/contas" className="inline-flex items-center gap-1.5 text-xs text-admin-muted hover:text-admin-ink mb-3 transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" />
            Contas
          </Link>
        }
        titulo={conta.email}
        selo={conta.role === "admin" ? <SeloAdmin /> : undefined}
        descricao={`Cadastro em ${data(conta.createdAt)} · último login ${data(conta.lastLoginAt)} · ${conta.isAdultConfirmed ? "18+ confirmado" : "18+ não confirmado"}`}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <CartaoAdmin titulo="Plano">
          <div className="flex items-center gap-2 mb-4">
            {ehPro ? (
              <>
                <SeloProAdmin />
                <span className="text-sm text-admin-ink">até {data(conta.plan.proUntil)}</span>
              </>
            ) : (
              <span className="text-sm text-admin-ink">Free{conta.plan.proUntil ? ` · Pro venceu em ${data(conta.plan.proUntil)}` : ""}</span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <BotaoAdmin onClick={() => setAcao("liberar")}>Liberar Pro</BotaoAdmin>
            {ehPro && (
              <BotaoAdmin perigo onClick={() => setAcao("rebaixar")}>
                Tirar o Pro
              </BotaoAdmin>
            )}
          </div>
          {conta.concessoes.length > 0 && (
            <ul className="mt-4 divide-y divide-admin-line text-xs">
              {conta.concessoes.map((c) => (
                <li key={c.id} className="py-2 flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-3">
                  <span className="text-admin-ink tabular-nums">
                    {data(c.startsAt)} → {data(c.endsAt)}
                  </span>
                  <span className="text-admin-faint">{c.source === "manual" ? "manual" : "assinatura"}</span>
                  {c.reason && <span className="text-admin-muted min-w-0 truncate">“{c.reason}”</span>}
                </li>
              ))}
            </ul>
          )}
        </CartaoAdmin>

        <CartaoAdmin titulo="Acesso">
          <p className="text-sm text-admin-ink mb-4">
            {conta.sessoesAtivas} {conta.sessoesAtivas === 1 ? "sessão aberta" : "sessões abertas"}
          </p>
          <div className="flex flex-wrap gap-2">
            <BotaoAdmin perigo onClick={() => setAcao("sessoes")} disabled={conta.sessoesAtivas === 0}>
              Revogar sessões
            </BotaoAdmin>
            {!souEu &&
              (conta.role === "admin" ? (
                <BotaoAdmin perigo onClick={() => setAcao("despromover")}>
                  Tirar o papel de admin
                </BotaoAdmin>
              ) : (
                <BotaoAdmin secundario onClick={() => setAcao("promover")}>
                  Promover a admin
                </BotaoAdmin>
              ))}
          </div>
          {souEu && <p className="mt-3 text-xs text-admin-muted">Você não pode mudar o seu próprio papel.</p>}
        </CartaoAdmin>

        <CartaoAdmin titulo={`Páginas (${conta.paginasLista.length})`} larga>
          {conta.paginasLista.length === 0 ? (
            <p className="text-sm text-admin-muted">Nenhuma página.</p>
          ) : (
            <ul className="divide-y divide-admin-line">
              {conta.paginasLista.map((p) => (
                <li key={p.id} className="py-2.5 flex items-center gap-3 text-sm">
                  <span className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", p.published ? "bg-admin-ok" : "bg-admin-faint")} title={p.published ? "No ar" : "Fora do ar"} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-admin-ink truncate">{p.displayName}</span>
                    <span className="block font-mono text-[11px] text-admin-faint truncate">
                      {p.host ?? "(domínio padrão)"}/{p.slug} · {p.links} {p.links === 1 ? "link" : "links"} · desde {data(p.createdAt)}
                    </span>
                  </span>
                  {p.host && (
                    <a href={urlDaPagina(p.host, p.slug)} target="_blank" rel="noreferrer" title="Abrir a página" className="w-9 h-9 flex items-center justify-center rounded-lg text-admin-faint hover:text-admin-ink hover:bg-admin-hover transition-colors">
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CartaoAdmin>

        {conta.dominiosProprios.length > 0 && (
          <CartaoAdmin titulo="Domínios próprios" larga>
            <ul className="divide-y divide-admin-line text-sm">
              {conta.dominiosProprios.map((d) => (
                <li key={d.id} className="py-2 flex items-center gap-3">
                  <span className="font-mono text-admin-ink">{d.host}</span>
                  <span className={cn("text-xs", d.status === "active" ? "text-admin-ok" : "text-admin-accent")}>
                    {d.status === "active" ? "ativo" : "aguardando ativação"}
                  </span>
                </li>
              ))}
            </ul>
          </CartaoAdmin>
        )}

        <CartaoAdmin titulo="Ações de admin nesta conta" larga>
          {conta.acoes.length === 0 ? (
            <p className="text-sm text-admin-muted">Nenhuma ainda.</p>
          ) : (
            <ul className="divide-y divide-admin-line">
              {conta.acoes.map((a) => (
                <li key={a.id} className="py-2.5">
                  <LinhaDeAcao acao={a} semAlvo />
                </li>
              ))}
            </ul>
          )}
        </CartaoAdmin>
      </div>

      <DialogoDeAcao
        aberto={acao === "liberar"}
        titulo="Liberar o Pro"
        descricao="Dias SOMAM ao que a conta já tem; a data final é até o fim daquele dia. Liberar nunca encurta um plano que já existe."
        rotulo="Liberar"
        onFechar={() => setAcao(null)}
        campos={
          <div className="grid grid-cols-2 gap-3">
            <CampoDoDialogo rotulo="Dias">
              <input value={dias} onChange={(e) => { setDias(e.target.value); if (e.target.value) setAte(""); }} inputMode="numeric" placeholder="30" className={CLASSE_DO_CAMPO_ADMIN} />
            </CampoDoDialogo>
            <CampoDoDialogo rotulo="ou até a data">
              <input type="date" value={ate} onChange={(e) => { setAte(e.target.value); if (e.target.value) setDias(""); }} className={CLASSE_DO_CAMPO_ADMIN} />
            </CampoDoDialogo>
          </div>
        }
        onConfirmar={(motivo) =>
          executar(
            () => api.admin.liberarPro(conta.id, { dias: dias ? Number(dias) : undefined, ate: ate || undefined, motivo }),
            "Pro liberado.",
          )
        }
      />
      <DialogoDeAcao
        aberto={acao === "rebaixar"}
        titulo="Tirar o Pro"
        descricao="A conta volta ao Free agora. Nada é apagado: o que era Pro fica gravado e deixa de valer na página pública."
        rotulo="Tirar o Pro"
        perigo
        onFechar={() => setAcao(null)}
        onConfirmar={(motivo) => executar(() => api.admin.rebaixarPro(conta.id, motivo), "Conta voltou ao Free.")}
      />
      <DialogoDeAcao
        aberto={acao === "sessoes"}
        titulo="Revogar sessões"
        descricao="Encerra toda sessão aberta desta conta. O próximo pedido dela cai no login. Não muda a senha."
        rotulo="Revogar"
        perigo
        onFechar={() => setAcao(null)}
        onConfirmar={(motivo) => executar(() => api.admin.revogarSessoes(conta.id, motivo), "Sessões revogadas.")}
      />
      <DialogoDeAcao
        aberto={acao === "promover"}
        titulo="Promover a admin"
        descricao="A conta passa a ver e operar o painel admin, com todas as contas da plataforma. Ela precisa entrar de novo para a mudança valer na sessão."
        rotulo="Promover"
        onFechar={() => setAcao(null)}
        onConfirmar={(motivo) => executar(() => api.admin.definirPapel(conta.id, "admin", motivo), "Agora é admin.")}
      />
      <DialogoDeAcao
        aberto={acao === "despromover"}
        titulo="Tirar o papel de admin"
        descricao="A conta volta a ser comum e perde o painel admin na próxima requisição."
        rotulo="Tirar o papel"
        perigo
        onFechar={() => setAcao(null)}
        onConfirmar={(motivo) => executar(() => api.admin.definirPapel(conta.id, "creator", motivo), "Deixou de ser admin.")}
      />
    </TelaAdmin>
  );
}
