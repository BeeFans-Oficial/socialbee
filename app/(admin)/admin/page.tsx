"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Activity, Globe, LayoutGrid, Link2, MousePointer2, ShieldCheck, Users } from "lucide-react";
import { toast } from "sonner";

import { Esqueleto } from "@/components/painel/Esqueleto";
import { StatsCard } from "@/components/painel/StatsCard";
import { CabecalhoDeTela, Tela } from "@/components/painel/Tela";
import { api, ApiError } from "@/lib/api/client";
import type { AdminVisaoGeral } from "@/lib/api/types";
import { ITEM_DA_LISTA, LISTA } from "@/lib/movimento";

/** Visão geral: os números da plataforma e o que pede atenção agora. */
export default function VisaoGeralPage() {
  const [dados, setDados] = useState<AdminVisaoGeral | null>(null);

  useEffect(() => {
    api.admin
      .visaoGeral()
      .then(setDados)
      .catch((caught) => toast.error(caught instanceof ApiError ? caught.message : "Não foi possível carregar."));
  }, []);

  return (
    <Tela>
      <CabecalhoDeTela titulo="Visão geral" descricao="A plataforma agora." />
      {!dados ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-[180px] rounded-xl border border-bee-line bg-bee-surface p-5 space-y-4">
              <Esqueleto className="w-10 h-10" />
              <Esqueleto className="h-8 w-16" />
              <Esqueleto className="h-3 w-24" />
            </div>
          ))}
        </div>
      ) : (
        <motion.div variants={LISTA} initial="initial" animate="animate" className="space-y-8">
          <motion.div variants={LISTA} className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <motion.div variants={ITEM_DA_LISTA}>
              <StatsCard icon={Users} iconBg="rgba(251, 191, 36, 0.15)" label="Contas" value={dados.contas.total} change={`${dados.contas.novas7d} nos últimos 7 dias`} changeType="neutral" />
            </motion.div>
            <motion.div variants={ITEM_DA_LISTA}>
              <StatsCard icon={ShieldCheck} iconBg="rgba(255, 60, 110, 0.15)" label="Contas Pro" value={dados.contas.pro} change={`${dados.contas.admins} admin${dados.contas.admins === 1 ? "" : "s"}`} changeType="neutral" />
            </motion.div>
            <motion.div variants={ITEM_DA_LISTA}>
              <StatsCard icon={LayoutGrid} iconBg="rgba(100, 220, 100, 0.15)" label="Páginas no ar" value={dados.paginas.noAr} change={`${dados.paginas.total} criadas`} changeType="neutral" />
            </motion.div>
            <motion.div variants={ITEM_DA_LISTA}>
              <StatsCard icon={Link2} iconBg="rgba(91, 141, 239, 0.15)" label="Links ativos" value={dados.links.ativos} change={`${dados.links.total} criados`} changeType="neutral" />
            </motion.div>
          </motion.div>

          <motion.div variants={LISTA} className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <motion.div variants={ITEM_DA_LISTA}>
              <StatsCard icon={Activity} iconBg="rgba(255, 60, 110, 0.15)" label="Visitas hoje" value={dados.hoje.visitas} change="humanas, sem robô" changeType="neutral" />
            </motion.div>
            <motion.div variants={ITEM_DA_LISTA}>
              <StatsCard icon={MousePointer2} iconBg="rgba(255, 160, 60, 0.15)" label="Cliques hoje" value={dados.hoje.cliques} change="humanos, sem robô" changeType="neutral" />
            </motion.div>
            <motion.div variants={ITEM_DA_LISTA}>
              <StatsCard
                icon={Globe}
                iconBg="rgba(0, 212, 170, 0.15)"
                label="Domínios próprios pendentes"
                value={dados.dominios.propriosPendentes}
                change={`${dados.dominios.propriosAtivos} ativos · pool com ${dados.dominios.pool}`}
                changeType="neutral"
              />
            </motion.div>
          </motion.div>

          <motion.section variants={ITEM_DA_LISTA} className="rounded-xl border border-bee-line bg-bee-surface p-5">
            <h2 className="text-sm font-semibold text-white mb-3">Atalhos</h2>
            <div className="flex flex-wrap gap-2">
              <Link href="/admin/contas" className="h-10 px-4 inline-flex items-center rounded-lg border border-white/15 text-sm text-white/85 hover:text-white hover:border-white/30 transition-colors">
                Buscar uma conta
              </Link>
              <Link href="/admin/auditoria" className="h-10 px-4 inline-flex items-center rounded-lg border border-white/15 text-sm text-white/85 hover:text-white hover:border-white/30 transition-colors">
                Ver a auditoria
              </Link>
            </div>
          </motion.section>
        </motion.div>
      )}
    </Tela>
  );
}
