"use client";

import React, { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, X } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { IconeDePlataforma } from "@/components/shared/IconeDePlataforma";
import { api, ApiError } from "@/lib/api/client";
import type { ApiLinkReport } from "@/lib/api/types";
import { PLATFORMS, type Link } from "@/lib/catalog";
import { cn } from "@/lib/utils";

const PERIODOS = [7, 30, 90] as const;

/** Uma série só, uma cor: o rosa da marca (validado contra o fundo escuro). */
const COR_DA_SERIE = "#FF3C6E";

const DISPOSITIVOS: Record<string, string> = {
  mobile: "Celular",
  tablet: "Tablet",
  desktop: "Computador",
  unknown: "Desconhecido",
};

/**
 * Métricas de UM link, num painel que abre pela direita sobre a lista.
 *
 * É o que a lista de Links mostra ao clicar nos cliques de um link. Os números
 * vêm de `GET /me/tracking/links/:id`: os cliques humanos da janela (com
 * origem, dispositivo, país e campanha) e os totais do contador, que não
 * expiram com o evento cru.
 */
export function MetricasDoLink({ link, onFechar }: { link: Link | null; onFechar: () => void }) {
  const [dias, setDias] = useState<(typeof PERIODOS)[number]>(30);
  const [dados, setDados] = useState<ApiLinkReport | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!link) return;
    let cancelado = false;
    setDados(null);
    setErro(null);
    api
      .linkReport(link.id, dias)
      .then((r) => !cancelado && setDados(r.report))
      .catch((caught) => {
        if (!cancelado) setErro(caught instanceof ApiError ? caught.message : "Não foi possível carregar.");
      });
    return () => {
      cancelado = true;
    };
  }, [link, dias]);

  useEffect(() => {
    if (!link) return;
    const aoTeclar = (e: KeyboardEvent) => e.key === "Escape" && onFechar();
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [link, onFechar]);

  const destino = (() => {
    if (!link?.destinationUrl) return "";
    try {
      return new URL(link.destinationUrl).hostname.replace(/^www\./, "");
    } catch {
      return link.destinationUrl;
    }
  })();

  return (
    <AnimatePresence>
      {link && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onFechar}
            className="fixed inset-0 z-40 bg-black/60"
          />
          <motion.aside
            role="dialog"
            aria-label={`Métricas de ${link.title}`}
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 260 }}
            className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-[520px] overflow-y-auto sem-barra bg-[#0a0a0a] border-l border-white/[0.08]"
          >
            {/* Cabeçalho */}
            <div className="sticky top-0 z-10 flex items-center gap-3 px-5 h-16 border-b border-white/[0.06] bg-[#0a0a0a]">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-white/[0.04] border border-white/[0.06]">
                <IconeDePlataforma plataforma={link.platform} className="w-4 h-4 text-white/60" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-white truncate">{link.title}</div>
                <div className="text-xs text-bee-muted truncate">
                  {PLATFORMS.find((p) => p.id === link.platform)?.label ?? link.platform}
                  {destino && ` · ${destino}`}
                </div>
              </div>
              <button onClick={onFechar} aria-label="Fechar" className="p-2 text-white/50 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-6">
              {/* Período */}
              <div className="flex gap-2">
                {PERIODOS.map((p) => (
                  <button
                    key={p}
                    onClick={() => setDias(p)}
                    className={cn(
                      "px-3 py-1 rounded-full text-xs font-medium transition-colors",
                      dias === p ? "bg-white text-bee-bg" : "bg-white/[0.05] text-white/60 hover:text-white",
                    )}
                  >
                    {p} dias
                  </button>
                ))}
              </div>

              {erro ? (
                <p className="text-sm text-bee-muted">{erro}</p>
              ) : !dados ? (
                <div className="flex justify-center py-16 text-bee-muted">
                  <Loader2 className="w-5 h-5 animate-spin" />
                </div>
              ) : (
                <Conteudo dados={dados} dias={dias} />
              )}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

function Conteudo({ dados, dias }: { dados: ApiLinkReport; dias: number }) {
  const parteDentroDeApp = dados.clicks ? Math.round((dados.inAppClicks / dados.clicks) * 100) : 0;
  const serie = dados.daily.map((d) => ({
    ...d,
    rotulo: new Date(`${d.date}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
  }));

  return (
    <>
      {/* Números */}
      <div className="grid grid-cols-2 gap-3">
        <Numero rotulo={`Cliques em ${dias} dias`} valor={dados.clicks.toLocaleString("pt-BR")} destaque />
        <Numero
          rotulo="Vindos de dentro de app"
          valor={`${parteDentroDeApp}%`}
          nota={`${dados.inAppClicks.toLocaleString("pt-BR")} de ${dados.clicks.toLocaleString("pt-BR")}`}
        />
        <Numero rotulo="Total desde o início" valor={dados.totalClicks.toLocaleString("pt-BR")} />
        <Numero
          rotulo="Robôs filtrados"
          valor={dados.botHits.toLocaleString("pt-BR")}
          nota="prévias de link, não contam"
        />
      </div>
      <p className="text-xs text-bee-muted">
        Último clique:{" "}
        <span className="text-white/70">
          {dados.lastClickAt
            ? new Date(dados.lastClickAt).toLocaleString("pt-BR", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })
            : "nenhum ainda"}
        </span>
      </p>

      {/* Cliques por dia — uma série, sem legenda: o título a nomeia. */}
      <section>
        <h3 className="text-sm font-medium text-white mb-3">Cliques por dia</h3>
        {dados.clicks === 0 ? (
          <p className="py-8 text-center text-sm text-bee-muted">Nenhum clique nos últimos {dias} dias.</p>
        ) : (
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={serie} margin={{ top: 4, right: 4, left: -24, bottom: 0 }} barCategoryGap={2}>
                <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.06)" />
                <XAxis
                  dataKey="rotulo"
                  tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  interval="preserveStartEnd"
                  minTickGap={24}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  cursor={{ fill: "rgba(255,255,255,0.04)" }}
                  content={({ active, payload }) =>
                    active && payload?.length ? (
                      <div className="rounded-lg border border-white/10 bg-bee-surface px-3 py-2 text-xs">
                        <div className="text-white/60">{payload[0].payload.rotulo}</div>
                        <div className="text-white font-medium">
                          {payload[0].value} {payload[0].value === 1 ? "clique" : "cliques"}
                        </div>
                      </div>
                    ) : null
                  }
                />
                <Bar dataKey="clicks" fill={COR_DA_SERIE} radius={[4, 4, 0, 0]} maxBarSize={18} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      <Quebra titulo="De onde vieram" linhas={dados.bySource} />
      <Quebra
        titulo="Dispositivo"
        linhas={dados.byDevice}
        rotular={(k) => DISPOSITIVOS[k] ?? k}
      />
      <Quebra titulo="País" linhas={dados.byCountry} />
      {dados.byCampaign.length > 0 && <Quebra titulo="Campanha" linhas={dados.byCampaign} />}
    </>
  );
}

function Numero({
  rotulo,
  valor,
  nota,
  destaque,
}: {
  rotulo: string;
  valor: string;
  nota?: string;
  destaque?: boolean;
}) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-bee-surface p-4">
      <div className="text-xs text-bee-muted">{rotulo}</div>
      <div className={cn("mt-1 font-semibold text-white tabular-nums", destaque ? "text-3xl" : "text-2xl")}>
        {valor}
      </div>
      {nota && <div className="mt-0.5 text-[11px] text-white/35">{nota}</div>}
    </div>
  );
}

/** Uma quebra (origem, dispositivo…): rótulo e número em texto neutro, barra
 *  fina na cor da série mostrando a fatia. */
function Quebra({
  titulo,
  linhas,
  rotular = (k) => k,
}: {
  titulo: string;
  linhas: Array<{ key: string; clicks: number; share: number }>;
  rotular?: (k: string) => string;
}) {
  if (linhas.length === 0) return null;
  return (
    <section>
      <h3 className="text-sm font-medium text-white mb-3">{titulo}</h3>
      <div className="space-y-2.5">
        {linhas.slice(0, 6).map((l) => (
          <div key={l.key}>
            <div className="flex items-center justify-between text-xs">
              <span className="text-white/80 truncate">{rotular(l.key)}</span>
              <span className="text-white/50 tabular-nums">
                {l.clicks.toLocaleString("pt-BR")} · {Math.round(l.share * 100)}%
              </span>
            </div>
            <div className="mt-1 h-1 rounded-full bg-white/[0.05] overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{ width: `${Math.max(2, l.share * 100)}%`, background: COR_DA_SERIE }}
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
