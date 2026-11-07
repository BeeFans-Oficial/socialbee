"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Pause, Pencil, Play, Plus } from "lucide-react";
import { toast } from "sonner";

import { CampoDoDialogo, DialogoDeAcao } from "@/components/admin/DialogoDeAcao";
import {
  BotaoAdmin,
  CLASSE_DO_CAMPO_ADMIN,
  CabecalhoAdmin,
  EsqueletoDeLinhasAdmin,
  TelaAdmin,
} from "@/components/admin/Ui";
import { api, ApiError } from "@/lib/api/client";
import type { AdminDominioDoPool } from "@/lib/api/types";
import { cn } from "@/lib/utils";

const data = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });

type Acao = { tipo: "adicionar" } | { tipo: "pausar" | "ativar" | "editar"; dominio: AdminDominioDoPool } | null;

/**
 * Pool de domínios: os endereços da plataforma pelos quais as páginas são
 * servidas. Domínio de link na bio é consumível — o Instagram bloqueia uma
 * hora — e é aqui que a equipe vê qual esfriou, pausa sem derrubar ninguém e
 * põe um novo em circulação.
 */
export default function DominiosPage() {
  const [dominios, setDominios] = useState<AdminDominioDoPool[] | null>(null);
  const [acao, setAcao] = useState<Acao>(null);
  const [novo, setNovo] = useState({ host: "", label: "" });
  const [label, setLabel] = useState("");

  const carregar = useCallback(() => {
    api.admin
      .dominios()
      .then(setDominios)
      .catch((caught) => toast.error(caught instanceof ApiError ? caught.message : "Não foi possível carregar."));
  }, []);

  useEffect(carregar, [carregar]);

  const ativos = dominios?.filter((d) => d.active).length ?? 0;
  const mensagem = (caught: unknown, padrao: string) => new Error(caught instanceof ApiError ? caught.message : padrao);

  return (
    <TelaAdmin>
      <CabecalhoAdmin
        titulo="Domínios"
        descricao={
          dominios
            ? `Pool da plataforma: ${ativos} ${ativos === 1 ? "ativo" : "ativos"} no sorteio${dominios.length > ativos ? `, ${dominios.length - ativos} em pausa` : ""}.`
            : "Carregando…"
        }
        acoes={
          <BotaoAdmin onClick={() => setAcao({ tipo: "adicionar" })} className="h-10">
            <Plus className="w-4 h-4" />
            Novo domínio
          </BotaoAdmin>
        }
      />

      {!dominios ? (
        <EsqueletoDeLinhasAdmin linhas={4} />
      ) : dominios.length === 0 ? (
        <p className="py-16 text-center text-sm text-admin-muted">
          Nenhum domínio no pool. Sem pool, toda página nasce no endereço padrão da instalação.
        </p>
      ) : (
        <div className="rounded-xl border border-admin-line bg-admin-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-admin-muted border-b border-admin-line bg-admin-hover/50">
                <th className="px-4 py-3 font-medium">Domínio</th>
                <th className="px-4 py-3 font-medium">Situação</th>
                <th className="px-4 py-3 font-medium text-right">Páginas</th>
                <th className="px-4 py-3 font-medium text-right hidden sm:table-cell">Visitas · 7 dias</th>
                <th className="px-4 py-3 font-medium hidden lg:table-cell">Desde</th>
                <th className="px-4 py-3 font-medium text-right">
                  <span className="sr-only">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-admin-line">
              {dominios.map((d) => (
                <tr key={d.id} className={cn("transition-colors hover:bg-admin-hover/60", !d.active && "text-admin-muted")}>
                  <td className="px-4 py-3 min-w-0">
                    <span className="block font-mono text-[13px] text-admin-ink truncate">{d.host}</span>
                    <span className="block text-xs text-admin-muted truncate">{d.label ?? "sem nome"}</span>
                  </td>
                  <td className="px-4 py-3">
                    <Situacao dominio={d} />
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-admin-ink/85">
                    {d.paginas}
                    {d.paginas > 0 && d.paginasNoAr !== d.paginas && (
                      <span className="block text-[11px] text-admin-muted">{d.paginasNoAr} no ar</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-admin-ink/85 hidden sm:table-cell">{d.visitas7d}</td>
                  <td className="px-4 py-3 text-admin-muted hidden lg:table-cell">{data(d.createdAt)}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1.5">
                      <BotaoAdmin
                        secundario
                        className="h-8 px-2.5"
                        onClick={() => {
                          setLabel(d.label ?? "");
                          setAcao({ tipo: "editar", dominio: d });
                        }}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        <span className="hidden md:inline">Nome</span>
                      </BotaoAdmin>
                      {d.active ? (
                        <BotaoAdmin perigo className="h-8 px-2.5" onClick={() => setAcao({ tipo: "pausar", dominio: d })}>
                          <Pause className="w-3.5 h-3.5" />
                          Pausar
                        </BotaoAdmin>
                      ) : (
                        <BotaoAdmin className="h-8 px-2.5" onClick={() => setAcao({ tipo: "ativar", dominio: d })}>
                          <Play className="w-3.5 h-3.5" />
                          Ativar
                        </BotaoAdmin>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-4 text-xs text-admin-muted max-w-2xl">
        Pausar tira o domínio do sorteio e do seletor das criadoras; as páginas que já estão nele continuam no ar.
        Para tirar do ar de verdade, o domínio precisa sair do nginx da VPS.
      </p>

      <DialogoDeAcao
        aberto={acao?.tipo === "adicionar"}
        titulo="Novo domínio no pool"
        descricao="Só a linha no banco. O domínio nasce pausado: antes de ativar, confira que o registro A aponta para a VPS, que o nginx atende por esse nome e que o certificado foi emitido — ou seja, que ele já abre em HTTPS."
        rotulo="Adicionar pausado"
        onFechar={() => setAcao(null)}
        campos={
          <>
            <CampoDoDialogo rotulo="Domínio (só o host, sem https://)">
              <input
                value={novo.host}
                onChange={(e) => setNovo({ ...novo, host: e.target.value })}
                placeholder="vemaqui.site"
                className={`${CLASSE_DO_CAMPO_ADMIN} font-mono`}
                autoComplete="off"
                spellCheck={false}
              />
            </CampoDoDialogo>
            <CampoDoDialogo rotulo="Nome curto (o que a criadora vê no seletor, opcional)">
              <input
                value={novo.label}
                onChange={(e) => setNovo({ ...novo, label: e.target.value })}
                placeholder="Vem aqui"
                maxLength={40}
                className={CLASSE_DO_CAMPO_ADMIN}
                autoComplete="off"
              />
            </CampoDoDialogo>
          </>
        }
        onConfirmar={async (motivo) => {
          try {
            await api.admin.adicionarDominio({ host: novo.host, label: novo.label.trim() || null, motivo });
            toast.success("Domínio adicionado, em pausa.");
            setNovo({ host: "", label: "" });
            carregar();
          } catch (caught) {
            throw mensagem(caught, "Não foi possível adicionar.");
          }
        }}
      />

      <DialogoDeAcao
        aberto={acao?.tipo === "pausar"}
        titulo={acao?.tipo === "pausar" ? `Pausar ${acao.dominio.host}` : ""}
        descricao={
          acao?.tipo === "pausar"
            ? `Sai do sorteio e do seletor agora. ${acao.dominio.paginas === 0 ? "Nenhuma página está nele." : `${acao.dominio.paginas === 1 ? "A página que está nele continua" : `As ${acao.dominio.paginas} páginas que estão nele continuam`} no ar; a criadora troca de endereço quando quiser.`}`
            : ""
        }
        rotulo="Pausar"
        perigo
        onFechar={() => setAcao(null)}
        onConfirmar={async (motivo) => {
          if (acao?.tipo !== "pausar") return;
          try {
            await api.admin.pausarDominio(acao.dominio.id, motivo);
            toast.success("Domínio pausado.");
            carregar();
          } catch (caught) {
            throw mensagem(caught, "Não foi possível pausar.");
          }
        }}
      />

      <DialogoDeAcao
        aberto={acao?.tipo === "ativar"}
        titulo={acao?.tipo === "ativar" ? `Ativar ${acao.dominio.host}` : ""}
        descricao="Entra no sorteio das contas novas e no seletor das criadoras Pro. Ative só se o endereço já abre em HTTPS; ativar antes entrega às criadoras um endereço que responde com erro de certificado."
        rotulo="Ativar"
        onFechar={() => setAcao(null)}
        onConfirmar={async (motivo) => {
          if (acao?.tipo !== "ativar") return;
          try {
            await api.admin.ativarDominio(acao.dominio.id, motivo);
            toast.success("Domínio ativo.");
            carregar();
          } catch (caught) {
            throw mensagem(caught, "Não foi possível ativar.");
          }
        }}
      />

      <DialogoDeAcao
        aberto={acao?.tipo === "editar"}
        titulo={acao?.tipo === "editar" ? `Nome de ${acao.dominio.host}` : ""}
        descricao="O nome curto é o que a criadora vê no seletor de endereço. Vazio, ela vê o próprio domínio."
        rotulo="Salvar"
        onFechar={() => setAcao(null)}
        campos={
          <CampoDoDialogo rotulo="Nome curto">
            <input value={label} onChange={(e) => setLabel(e.target.value)} maxLength={40} className={CLASSE_DO_CAMPO_ADMIN} autoComplete="off" />
          </CampoDoDialogo>
        }
        onConfirmar={async (motivo) => {
          if (acao?.tipo !== "editar") return;
          try {
            await api.admin.editarDominio(acao.dominio.id, { label: label.trim() || null, motivo });
            toast.success("Nome salvo.");
            carregar();
          } catch (caught) {
            throw mensagem(caught, "Não foi possível salvar.");
          }
        }}
      />
    </TelaAdmin>
  );
}

const SETE_DIAS = 7 * 24 * 60 * 60 * 1000;

/** Ativo, pausado, ou ativo mas frio: há mais de 7 dias no pool, com página
 *  no ar e nenhuma visita na semana é o sinal de domínio bloqueado — e o
 *  motivo de a tela existir. Domínio novo ainda não teve tempo de esquentar. */
function Situacao({ dominio }: { dominio: AdminDominioDoPool }) {
  if (!dominio.active) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-admin-muted whitespace-nowrap">
        <span className="w-1.5 h-1.5 rounded-full bg-admin-faint" />
        Pausado
      </span>
    );
  }
  const frio = dominio.paginasNoAr > 0 && dominio.visitas7d === 0 && Date.now() - new Date(dominio.createdAt).getTime() > SETE_DIAS;
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs whitespace-nowrap", frio ? "text-admin-danger" : "text-admin-ok")}>
      <span className={cn("w-1.5 h-1.5 rounded-full", frio ? "bg-admin-danger" : "bg-admin-ok")} />
      {frio ? "Ativo, sem visitas" : "Ativo"}
    </span>
  );
}
