"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { toast } from "sonner";

import { CLASSE_DO_CAMPO, CampoDoDialogo, DialogoDeAcao } from "@/components/admin/DialogoDeAcao";
import { Esqueleto } from "@/components/painel/Esqueleto";
import { CabecalhoDeTela, Tela } from "@/components/painel/Tela";
import { SeloPro } from "@/components/shared/SeloPro";
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
      <Tela>
        <Esqueleto className="h-8 w-64 mb-2" />
        <Esqueleto className="h-4 w-40 mb-8" />
        <Esqueleto className="h-40 w-full rounded-xl mb-4" />
        <Esqueleto className="h-40 w-full rounded-xl" />
      </Tela>
    );
  }

  const souEu = session?.user.id === conta.id;
  const ehPro = conta.plan.id === "pro";

  return (
    <Tela>
      <Link href="/admin/contas" className="inline-flex items-center gap-1.5 text-xs text-white/50 hover:text-white mb-3 transition-colors">
        <ArrowLeft className="w-3.5 h-3.5" />
        Contas
      </Link>
      <CabecalhoDeTela
        titulo={conta.email}
        selo={conta.role === "admin" ? <span className="px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wider bg-amber-400/15 text-amber-300 border border-amber-400/30">ADMIN</span> : undefined}
        descricao={`Cadastro em ${data(conta.createdAt)} · último login ${data(conta.lastLoginAt)} · ${conta.isAdultConfirmed ? "18+ confirmado" : "18+ não confirmado"}`}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Plano */}
        <Secao titulo="Plano">
          <div className="flex items-center gap-2 mb-4">
            {ehPro ? (
              <>
                <SeloPro />
                <span className="text-sm text-white">até {data(conta.plan.proUntil)}</span>
              </>
            ) : (
              <span className="text-sm text-white">Free{conta.plan.proUntil ? ` · Pro venceu em ${data(conta.plan.proUntil)}` : ""}</span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Botao onClick={() => setAcao("liberar")}>Liberar Pro</Botao>
            {ehPro && (
              <Botao perigo onClick={() => setAcao("rebaixar")}>
                Tirar o Pro
              </Botao>
            )}
          </div>
          {conta.concessoes.length > 0 && (
            <ul className="mt-4 divide-y divide-bee-line text-xs">
              {conta.concessoes.map((c) => (
                <li key={c.id} className="py-2 flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-3">
                  <span className="text-white/80 tabular-nums">
                    {data(c.startsAt)} → {data(c.endsAt)}
                  </span>
                  <span className="text-white/40">{c.source === "manual" ? "manual" : "assinatura"}</span>
                  {c.reason && <span className="text-white/55 min-w-0 truncate">“{c.reason}”</span>}
                </li>
              ))}
            </ul>
          )}
        </Secao>

        {/* Sessões e papel */}
        <Secao titulo="Acesso">
          <p className="text-sm text-white mb-4">
            {conta.sessoesAtivas} {conta.sessoesAtivas === 1 ? "sessão aberta" : "sessões abertas"}
          </p>
          <div className="flex flex-wrap gap-2">
            <Botao perigo onClick={() => setAcao("sessoes")} disabled={conta.sessoesAtivas === 0}>
              Revogar sessões
            </Botao>
            {!souEu &&
              (conta.role === "admin" ? (
                <Botao perigo onClick={() => setAcao("despromover")}>
                  Tirar o papel de admin
                </Botao>
              ) : (
                <Botao onClick={() => setAcao("promover")}>Promover a admin</Botao>
              ))}
          </div>
          {souEu && <p className="mt-3 text-xs text-bee-muted">Você não pode mudar o seu próprio papel.</p>}
        </Secao>

        {/* Páginas */}
        <Secao titulo={`Páginas (${conta.paginasLista.length})`} larga>
          {conta.paginasLista.length === 0 ? (
            <p className="text-sm text-bee-muted">Nenhuma página.</p>
          ) : (
            <ul className="divide-y divide-bee-line">
              {conta.paginasLista.map((p) => (
                <li key={p.id} className="py-2.5 flex items-center gap-3 text-sm">
                  <span className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", p.published ? "bg-emerald-400" : "bg-white/30")} title={p.published ? "No ar" : "Fora do ar"} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-white truncate">{p.displayName}</span>
                    <span className="block font-mono text-[11px] text-white/40 truncate">
                      {p.host ?? "(domínio padrão)"}/{p.slug} · {p.links} {p.links === 1 ? "link" : "links"} · desde {data(p.createdAt)}
                    </span>
                  </span>
                  {p.host && (
                    <a href={urlDaPagina(p.host, p.slug)} target="_blank" rel="noreferrer" title="Abrir a página" className="w-9 h-9 flex items-center justify-center rounded-lg text-white/50 hover:text-white hover:bg-white/[0.06] transition-colors">
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Secao>

        {/* Domínios próprios */}
        {conta.dominiosProprios.length > 0 && (
          <Secao titulo="Domínios próprios" larga>
            <ul className="divide-y divide-bee-line text-sm">
              {conta.dominiosProprios.map((d) => (
                <li key={d.id} className="py-2 flex items-center gap-3">
                  <span className="font-mono text-white">{d.host}</span>
                  <span className={cn("text-xs", d.status === "active" ? "text-emerald-400/90" : "text-amber-300/90")}>
                    {d.status === "active" ? "ativo" : "aguardando ativação"}
                  </span>
                </li>
              ))}
            </ul>
          </Secao>
        )}

        {/* Ações nesta conta */}
        <Secao titulo="Ações de admin nesta conta" larga>
          {conta.acoes.length === 0 ? (
            <p className="text-sm text-bee-muted">Nenhuma ainda.</p>
          ) : (
            <ul className="divide-y divide-bee-line">
              {conta.acoes.map((a) => (
                <li key={a.id} className="py-2.5">
                  <LinhaDeAcao acao={a} semAlvo />
                </li>
              ))}
            </ul>
          )}
        </Secao>
      </div>

      {/* Diálogos */}
      <DialogoDeAcao
        aberto={acao === "liberar"}
        titulo="Liberar o Pro"
        descricao="Dias SOMAM ao que a conta já tem; a data final é até o fim daquele dia. Liberar nunca encurta um plano que já existe."
        rotulo="Liberar"
        onFechar={() => setAcao(null)}
        campos={
          <div className="grid grid-cols-2 gap-3">
            <CampoDoDialogo rotulo="Dias">
              <input value={dias} onChange={(e) => { setDias(e.target.value); if (e.target.value) setAte(""); }} inputMode="numeric" placeholder="30" className={CLASSE_DO_CAMPO} />
            </CampoDoDialogo>
            <CampoDoDialogo rotulo="ou até a data">
              <input type="date" value={ate} onChange={(e) => { setAte(e.target.value); if (e.target.value) setDias(""); }} className={CLASSE_DO_CAMPO} />
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
    </Tela>
  );
}

function Secao({ titulo, larga, children }: { titulo: string; larga?: boolean; children: React.ReactNode }) {
  return (
    <section className={cn("rounded-xl border border-bee-line bg-bee-surface p-5", larga && "lg:col-span-2")}>
      <h2 className="text-[11px] font-semibold tracking-[0.14em] uppercase text-white/40 mb-3">{titulo}</h2>
      {children}
    </section>
  );
}

function Botao({ perigo, disabled, onClick, children }: { perigo?: boolean; disabled?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "h-9 px-3.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-40",
        perigo ? "border border-red-400/30 text-red-300 hover:bg-red-500/10" : "bg-amber-400 text-bee-bg hover:bg-amber-300",
      )}
    >
      {children}
    </button>
  );
}
