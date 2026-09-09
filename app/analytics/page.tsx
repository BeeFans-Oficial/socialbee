"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, MousePointer2, ShieldCheck, Smartphone, TrendingUp } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { api, ApiError } from "@/lib/api/client";
import type { ReportResponse } from "@/lib/api/types";
import { cn, formatNumber, getPlatformColor, getPlatformIcon } from "@/lib/utils";

/**
 * Analytics.
 *
 * Lê `GET /me/tracking/report` na API — o que foi de fato registrado pelo
 * redirecionador, escopado no perfil da SESSÃO.
 *
 * O escopo é a mudança que importa nesta tela: a versão anterior chamava uma
 * rota do próprio Next que fixava o perfil em `MOCK_USER.id` porque não havia
 * login. Com mais de uma criadora no ar, aquilo era leitura livre do analytics
 * de qualquer uma delas. Agora o `profileId` sai da sessão e não existe
 * parâmetro de perfil na rota.
 *
 * Os títulos dos links também vêm da API. Antes vinham de `MOCK_LINKS`, então
 * a tabela "por link" mostrava o id cru para qualquer link real. Os números inventados que estavam aqui antes
 * (`+18% vs mês anterior`, `instagramClicks`, origens fixas em código) foram
 * removidos: comparar com o período anterior exige buscar o período anterior, e
 * enquanto isso não existir é mais honesto mostrar um dado real no lugar do
 * delta do que estampar um número que ninguém mediu.
 */

type Period = "7d" | "30d" | "90d";

const PERIOD_DAYS: Record<Period, number> = { "7d": 7, "30d": 30, "90d": 90 };

/** Paleta de reserva para chaves de origem que não são plataforma conhecida
 *  (um domínio de referrer qualquer, uma utm_source nova). Índice por hash do
 *  nome: a mesma origem recebe sempre a mesma cor entre recarregamentos. */
const FALLBACK_COLORS = ["#9b6dff", "#00d4aa", "#ff9f43", "#4ade80", "#5b8def", "#888888"];

function colorForKey(key: string): string {
  if (key === "(direto)") return "#888888";
  const known = getPlatformColor(key);
  if (known !== "#FF3C6E" || key === "custom") return known;
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  return FALLBACK_COLORS[hash % FALLBACK_COLORS.length];
}

/** `2026-09-07` → `07/09`, o formato que o eixo do gráfico já usava. */
function shortDate(iso: string): string {
  const [, month, day] = iso.split("-");
  return `${day}/${month}`;
}

export default function AnalyticsPage() {
  const router = useRouter();
  const [period, setPeriod] = useState<Period>("30d");
  const [data, setData] = useState<ReportResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  /** Título por id de link, para a tabela "por link" não mostrar UUID cru. */
  const [linkTitles, setLinkTitles] = useState<Map<string, string>>(new Map());

  const load = useCallback(
    async (days: number) => {
      setLoading(true);
      setError(null);
      try {
        // Relatório e títulos juntos: são duas leituras independentes e a
        // tabela precisa das duas para significar algo.
        const [report, links] = await Promise.all([api.report(days), api.links()]);
        setData(report);
        setLinkTitles(new Map(links.map((link) => [link.id, link.title])));
      } catch (caught) {
        if (caught instanceof ApiError && caught.isUnauthorized) {
          router.replace("/login?de=/analytics");
          return;
        }
        setError(caught instanceof ApiError ? caught.message : "falha desconhecida");
      } finally {
        setLoading(false);
      }
    },
    [router],
  );

  useEffect(() => {
    void load(PERIOD_DAYS[period]);
  }, [period, load]);

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div
        className="rounded-lg p-3 shadow-xl"
        style={{ backgroundColor: "#1e1e1e", border: "1px solid rgba(255, 60, 110, 0.3)" }}
      >
        <p className="text-xs text-white font-medium mb-1">{payload[0].payload.label}</p>
        <p className="text-xs text-bee-muted">
          Visualizações: <span className="text-white">{payload[0].value}</span>
        </p>
        <p className="text-xs text-bee-muted">
          Cliques: <span className="text-bee-pink">{payload[1].value}</span>
        </p>
      </div>
    );
  };

  if (loading && !data) {
    return (
      <div className="min-h-screen p-8">
        <div className="max-w-7xl mx-auto space-y-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-32 bg-bee-surface rounded-xl animate-pulse" />
            ))}
          </div>
          <div className="h-96 bg-bee-surface rounded-xl animate-pulse" />
          <div className="h-64 bg-bee-surface rounded-xl animate-pulse" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen p-8">
        <div className="max-w-md mx-auto text-center py-20">
          <h1 className="font-bebas text-3xl uppercase text-white mb-2">Analytics indisponível</h1>
          <p className="text-sm text-bee-muted mb-6">
            Não foi possível carregar o relatório{error ? `: ${error}` : "."}
          </p>
          <button
            onClick={() => void load(PERIOD_DAYS[period])}
            className="px-5 py-2.5 rounded-full bg-bee-pink text-white text-sm font-bold uppercase tracking-wider glow-pink-sm"
          >
            Tentar de novo
          </button>
        </div>
      </div>
    );
  }

  const { report, counters } = data;
  const chartData = report.daily.map((day) => ({ ...day, label: shortDate(day.date) }));
  const inAppShare = report.clicks ? Math.round((report.inAppClicks / report.clicks) * 100) : 0;
  const hasTraffic = report.clicks > 0 || report.views > 0;

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Métricas */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatsCard
            icon={Eye}
            iconBg="rgba(255, 60, 110, 0.15)"
            label="Visualizações"
            value={formatNumber(report.views)}
            change={`últimos ${data.days} dias`}
            changeType="neutral"
          />
          <StatsCard
            icon={MousePointer2}
            iconBg="rgba(255, 160, 60, 0.15)"
            label="Cliques"
            value={formatNumber(report.clicks)}
            change={`últimos ${data.days} dias`}
            changeType="neutral"
          />
          {/* Agnóstico de propósito: mede tráfego preso em QUALQUER navegador
              embutido, não só Instagram. É o número que justifica o escape. */}
          <StatsCard
            icon={Smartphone}
            iconBg="rgba(225, 48, 108, 0.15)"
            label="Dentro de app"
            value={formatNumber(report.inAppClicks)}
            change={`${inAppShare}% dos cliques`}
            changeType="neutral"
          />
          <StatsCard
            icon={TrendingUp}
            iconBg="rgba(100, 220, 100, 0.15)"
            label="Cliques por visita"
            value={report.views ? report.clickRate.toFixed(2) : "—"}
            change={report.views ? `${report.clicks} / ${report.views}` : "sem visitas"}
            changeType="neutral"
          />
        </div>

        {/* Robôs filtrados — fica visível para o número baixo não parecer perda
            de tráfego. */}
        {report.botHits > 0 && (
          <div className="flex items-center gap-3 rounded-xl border border-white/5 bg-bee-surface px-5 py-4">
            <ShieldCheck className="w-5 h-5 text-bee-muted flex-shrink-0" />
            <p className="text-xs text-bee-muted">
              <span className="text-white font-medium">{formatNumber(report.botHits)}</span>{" "}
              requisições de robô foram redirecionadas mas não contadas — prévias de link do
              WhatsApp, Telegram, Discord e crawlers de busca. Total histórico, não só da janela.
            </p>
          </div>
        )}

        {/* Gráfico */}
        <section className="bg-bee-surface rounded-xl p-6 border border-white/5">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-bebas text-2xl uppercase text-white">
              Performance {data.days} dias
            </h2>
            <div className="flex gap-2">
              {(Object.keys(PERIOD_DAYS) as Period[]).map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  disabled={loading}
                  className={cn(
                    "px-3 py-1 rounded-full text-xs font-medium transition-all disabled:opacity-50",
                    period === p ? "bg-bee-pink text-white" : "bg-bee-bg text-bee-muted hover:text-white",
                  )}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.05)" />
              <XAxis dataKey="label" stroke="#555" tick={{ fontSize: 11 }} tickLine={false} />
              <YAxis stroke="#555" tick={{ fontSize: 11 }} tickLine={false} allowDecimals={false} />
              <Tooltip content={<CustomTooltip />} />
              <Line type="monotone" dataKey="views" stroke="#555" strokeWidth={2} dot={false} name="Visualizações" />
              <Line
                type="monotone"
                dataKey="clicks"
                stroke="#FF3C6E"
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 4, fill: "#FF3C6E" }}
                name="Cliques"
              />
            </LineChart>
          </ResponsiveContainer>

          <div className="flex items-center justify-center gap-6 mt-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-[#555]" />
              <span className="text-xs text-bee-muted">Visualizações</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-bee-pink" />
              <span className="text-xs text-bee-muted">Cliques</span>
            </div>
          </div>
        </section>

        {!hasTraffic && (
          <div className="rounded-xl border border-bee-border bg-bee-surface px-6 py-10 text-center">
            <h3 className="font-bebas text-2xl uppercase text-white mb-2">Nenhum clique ainda</h3>
            <p className="text-sm text-bee-muted max-w-md mx-auto">
              O rastreamento está ativo. Abra{" "}
              <span className="text-bee-pink">/bella</span> e toque em um link — o clique aparece
              aqui na hora.
            </p>
          </div>
        )}

        {/* Top links */}
        {report.byLink.length > 0 && (
          <section className="bg-bee-surface rounded-xl p-6 border border-white/5">
            <h2 className="font-bebas text-2xl uppercase text-white mb-6">Top links</h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/5">
                    <th className="text-left text-xs font-medium text-bee-muted pb-3">Link</th>
                    <th className="text-right text-xs font-medium text-bee-muted pb-3">Cliques</th>
                    <th className="text-right text-xs font-medium text-bee-muted pb-3">% Total</th>
                    <th className="text-right text-xs font-medium text-bee-muted pb-3">Histórico</th>
                    <th className="w-32 pb-3" />
                  </tr>
                </thead>
                <tbody>
                  {report.byLink.map((row, index) => {
                    const share = (row.share * 100).toFixed(1);
                    return (
                      <tr
                        key={row.linkId}
                        className={cn("border-b border-white/5", index % 2 === 1 && "bg-white/[0.02]")}
                      >
                        <td className="py-3 pr-4">
                          <div className="flex items-center gap-2">
                            <span className="text-sm">{getPlatformIcon(row.channel ?? "")}</span>
                            <span className="text-sm text-white truncate max-w-[220px]">
                              {linkTitles.get(row.linkId) ?? row.linkId}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 text-right text-sm text-white">
                          {formatNumber(row.clicks)}
                        </td>
                        <td className="py-3 text-right">
                          <span
                            className="inline-block px-2 py-0.5 rounded-full text-xs font-medium"
                            style={{ backgroundColor: "rgba(255, 60, 110, 0.1)", color: "#FF3C6E" }}
                          >
                            {share}%
                          </span>
                        </td>
                        {/* Contador desnormalizado: sobrevive à expiração do
                            evento cru, então é o total de sempre. */}
                        <td className="py-3 text-right text-sm text-bee-muted">
                          {formatNumber(counters[row.linkId]?.clicks ?? 0)}
                        </td>
                        <td className="py-3 pl-4">
                          <div className="w-full h-2 bg-bee-bg rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${share}%`,
                                background: "linear-gradient(90deg, #FF3C6E, #FF1F57)",
                              }}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Origem dos cliques — quebras montadas a partir do que foi medido, não
            de uma lista fixa de plataformas. */}
        {report.bySource.length > 0 && (
          <section>
            <h2 className="font-bebas text-2xl uppercase text-white mb-6">Origem dos cliques</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {report.bySource.slice(0, 10).map((source) => {
                const color = colorForKey(source.key);
                const percentage = Math.round(source.share * 100);
                return (
                  <div
                    key={source.key}
                    className="bg-bee-surface rounded-xl p-4 border border-white/5"
                  >
                    <div className="text-2xl mb-3">{getPlatformIcon(source.key)}</div>
                    <div className="font-bebas text-2xl text-white mb-1">
                      {formatNumber(source.clicks)}
                    </div>
                    <div className="text-xs text-bee-muted mb-3 truncate" title={source.key}>
                      {source.key}
                    </div>
                    <div className="w-full h-1.5 bg-bee-bg rounded-full overflow-hidden mb-2">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${percentage}%`, backgroundColor: color }}
                      />
                    </div>
                    <div className="text-xs font-medium" style={{ color }}>
                      {percentage}%
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Campanhas — só aparece quando existe UTM medido. */}
        {report.byCampaign.length > 0 && (
          <section>
            <h2 className="font-bebas text-2xl uppercase text-white mb-6">Campanhas</h2>
            <div className="bg-bee-surface rounded-xl border border-white/5 divide-y divide-white/5">
              {report.byCampaign.slice(0, 10).map((campaign) => (
                <div key={campaign.key} className="flex items-center justify-between px-5 py-3">
                  <span className="text-sm text-white truncate">{campaign.key}</span>
                  <span className="text-sm text-bee-muted">
                    {formatNumber(campaign.clicks)}{" "}
                    <span className="text-bee-dim">({Math.round(campaign.share * 100)}%)</span>
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
