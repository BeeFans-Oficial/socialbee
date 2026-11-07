"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Activity, Globe, LayoutGrid, Link2, MousePointer2, ShieldAlert, ShieldCheck, Users } from "lucide-react";
import { toast } from "sonner";

import { BotaoAdmin, CabecalhoAdmin, CartaoAdmin, EsqueletoAdmin, StatAdmin, TelaAdmin } from "@/components/admin/Ui";
import { api, ApiError } from "@/lib/api/client";
import type { AdminRevisaoPendente, AdminVisaoGeral } from "@/lib/api/types";
import { ITEM_DA_LISTA, LISTA } from "@/lib/movimento";

/** Visão geral: os números da plataforma e o que pede atenção agora. */
export default function VisaoGeralPage() {
  const [dados, setDados] = useState<AdminVisaoGeral | null>(null);
  const [revisoes, setRevisoes] = useState<AdminRevisaoPendente[]>([]);

  useEffect(() => {
    api.admin
      .visaoGeral()
      .then(setDados)
      .catch((caught) => toast.error(caught instanceof ApiError ? caught.message : "Não foi possível carregar."));
    api.admin.revisoes().then(setRevisoes).catch(() => setRevisoes([]));
  }, []);

  return (
    <TelaAdmin>
      <CabecalhoAdmin titulo="Visão geral" descricao="A plataforma agora." />
      {!dados ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4" role="status" aria-label="Carregando" data-esqueleto>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-[172px] rounded-xl border border-admin-line bg-admin-card p-5 space-y-4">
              <EsqueletoAdmin className="w-10 h-10" />
              <EsqueletoAdmin className="h-8 w-16" />
              <EsqueletoAdmin className="h-3 w-24" />
            </div>
          ))}
        </div>
      ) : (
        <motion.div variants={LISTA} initial="initial" animate="animate" className="space-y-6">
          <motion.div variants={LISTA} className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <motion.div variants={ITEM_DA_LISTA}>
              <StatAdmin icone={Users} rotulo="Contas" valor={dados.contas.total} nota={`${dados.contas.novas7d} nos últimos 7 dias`} />
            </motion.div>
            <motion.div variants={ITEM_DA_LISTA}>
              <StatAdmin icone={ShieldCheck} rotulo="Contas Pro" valor={dados.contas.pro} nota={`${dados.contas.admins} admin${dados.contas.admins === 1 ? "" : "s"}`} />
            </motion.div>
            <motion.div variants={ITEM_DA_LISTA}>
              <StatAdmin icone={LayoutGrid} rotulo="Páginas no ar" valor={dados.paginas.noAr} nota={`${dados.paginas.total} criadas`} />
            </motion.div>
            <motion.div variants={ITEM_DA_LISTA}>
              <StatAdmin icone={Link2} rotulo="Links ativos" valor={dados.links.ativos} nota={`${dados.links.total} criados`} />
            </motion.div>
          </motion.div>

          <motion.div variants={LISTA} className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <motion.div variants={ITEM_DA_LISTA}>
              <StatAdmin icone={ShieldAlert} rotulo="Páginas em vermelho" valor={dados.revisoes?.vermelhas ?? 0} nota="saúde da página" />
            </motion.div>
            <motion.div variants={ITEM_DA_LISTA}>
              <StatAdmin icone={Activity} rotulo="Visitas hoje" valor={dados.hoje.visitas} nota="humanas, sem robô" />
            </motion.div>
            <motion.div variants={ITEM_DA_LISTA}>
              <StatAdmin icone={MousePointer2} rotulo="Cliques hoje" valor={dados.hoje.cliques} nota="humanos, sem robô" />
            </motion.div>
            <motion.div variants={ITEM_DA_LISTA}>
              <StatAdmin
                icone={Globe}
                rotulo="Domínios próprios pendentes"
                valor={dados.dominios.propriosPendentes}
                nota={`${dados.dominios.propriosAtivos} ativos · pool com ${dados.dominios.pool}`}
              />
            </motion.div>
          </motion.div>

          {revisoes.length > 0 && (
            <motion.div variants={ITEM_DA_LISTA}>
              <CartaoAdmin titulo="Saúde das páginas — fora do verde">
                <ul className="divide-y divide-admin-line text-sm">
                  {revisoes.slice(0, 8).map((r) => (
                    <li key={r.profileId} className="flex items-center gap-3 py-2">
                      <span className={r.veredito === "vermelho" ? "w-2 h-2 rounded-full bg-admin-danger" : "w-2 h-2 rounded-full bg-amber-500"} aria-hidden />
                      <span className="font-mono text-[13px] text-admin-ink truncate">{r.host}/{r.slug}</span>
                      <Link href={`/admin/contas/${r.userId}`} className="ml-auto text-xs text-admin-muted underline decoration-dotted underline-offset-2 hover:text-admin-accent truncate max-w-[220px]">
                        {r.email}
                      </Link>
                    </li>
                  ))}
                </ul>
              </CartaoAdmin>
            </motion.div>
          )}

          <motion.div variants={ITEM_DA_LISTA}>
            <CartaoAdmin titulo="Atalhos">
              <div className="flex flex-wrap gap-2">
                <Link href="/admin/contas">
                  <BotaoAdmin secundario>Buscar uma conta</BotaoAdmin>
                </Link>
                <Link href="/admin/dominios">
                  <BotaoAdmin secundario>Domínios do pool</BotaoAdmin>
                </Link>
                <Link href="/admin/auditoria">
                  <BotaoAdmin secundario>Ver a auditoria</BotaoAdmin>
                </Link>
              </div>
            </CartaoAdmin>
          </motion.div>
        </motion.div>
      )}
    </TelaAdmin>
  );
}
