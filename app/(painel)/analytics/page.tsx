"use client";

import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUpRight, ChevronLeft, ChevronRight, DoorOpen, Eye, LogOut, MousePointer2, ShieldCheck, Smartphone, TrendingUp, Users } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { BarraDeFiltros, type Periodo } from "@/components/painel/analytics/BarraDeFiltros";
import { Funil } from "@/components/painel/analytics/Funil";
import { Horarios, Indicadores } from "@/components/painel/analytics/Indicadores";
import { ETAPA, nomeDaPlataforma } from "@/components/painel/analytics/rotulos";
import { Esqueleto } from "@/components/painel/Esqueleto";
import { StatsCard } from "@/components/painel/StatsCard";
import { CabecalhoDeTela, Tela } from "@/components/painel/Tela";
import { IconeDePlataforma } from "@/components/shared/IconeDePlataforma";
import { SeloPro } from "@/components/shared/SeloPro";
import { api, ApiError } from "@/lib/api/client";
import { usePlano, useSession } from "@/lib/api/use-session";
import type { Etapa, ReportEvent, ReportParams, ReportResponse } from "@/lib/api/types";
import { CROSSFADE, ITEM_DA_LISTA, LISTA, MOLA, SUAVE } from "@/lib/movimento";
import { cn, formatNumber, getPlatformColor } from "@/lib/utils";

/**
 * Analytics.
 *
 * Lê `GET /me/tracking/report` na API — o que foi de fato registrado pelo
 * redirecionador, escopado no perfil da SESSÃO. O `profileId` sai da sessão e
 * não existe parâmetro de perfil na rota.
 *
 * ## Filtros
 *
 * Janela (7, 30, 90 dias ou duas datas) e recortes por link, origem, endereço
 * de chegada, aparelho, país e dentro de app. Tudo vive na URL: a criadora
 * volta e encontra o mesmo recorte, e consegue mandar o link para alguém.
 * As opções de cada filtro vêm do relatório (`options`), montadas ANTES dos
 * filtros — uma origem que sumiu do recorte continua escolhível.
 *
 * Os cartões comparam com a janela anterior de mesmo tamanho, que a API
 * devolve junto (`previous`), com os mesmos filtros. É variação medida; antes
 * aqui havia só "últimos N dias" porque comparar exigia buscar o período
 * anterior, e não existia.
 */

type Period = Periodo;

const PERIOD_DAYS: Record<Exclude<Period, "custom">, number> = { "7d": 7, "30d": 30, "90d": 90 };

/** O estado da tela, que é também a query string. */
interface Filtros {
  periodo: Period;
  de: string;
  ate: string;
  link: string;
  origem: string;
  chegada: string;
  aparelho: string;
  pais: string;
  app: "" | "sim" | "nao";
}

const SEM_FILTROS: Filtros = { periodo: "30d", de: "", ate: "", link: "", origem: "", chegada: "", aparelho: "", pais: "", app: "" };

const NOME_DO_APARELHO: Record<string, string> = { mobile: "Celular", tablet: "Tablet", desktop: "Computador", unknown: "Não identificado" };

const NOME_DO_APP: Record<string, string> = {
  instagram: "Instagram", facebook: "Facebook", tiktok: "TikTok", twitter: "X", snapchat: "Snapchat",
  linkedin: "LinkedIn", pinterest: "Pinterest", telegram: "Telegram", line: "Line", kakao: "Kakao", wechat: "WeChat",
};

/** "Clicou em Telegram VIP", "…em A e B", "…em A e mais 2": em QUAL link, que
 *  é o que distingue quem foi ao Telegram de quem foi ao OnlyFans. */
function ondeClicou(ids: string[], titulo: (id: string) => string): string {
  if (ids.length === 0) return ETAPA.click.parou;
  const [primeiro, segundo] = ids.map(titulo);
  if (ids.length === 1) return `Clicou em ${primeiro}`;
  if (ids.length === 2) return `Clicou em ${primeiro} e ${segundo}`;
  return `Clicou em ${primeiro} e mais ${ids.length - 1}`;
}

/** `BR` → `Brasil`. O navegador conhece os nomes; sem suporte, fica o código. */
function nomeDoPais(codigo: string): string {
  try {
    return new Intl.DisplayNames(["pt-BR"], { type: "region" }).of(codigo) ?? codigo;
  } catch {
    return codigo;
  }
}

/** `22/11 17:10:02`, no fuso de quem está olhando. */
function dataEHora(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

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

function hojeIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function diasAtrasIso(dias: number): string {
  return new Date(Date.now() - dias * 86_400_000).toISOString().slice(0, 10);
}

function filtrosDaUrl(params: URLSearchParams): Filtros {
  const periodo = params.get("periodo");
  const de = params.get("de") ?? "";
  const ate = params.get("ate") ?? "";
  const app = params.get("app");
  return {
    periodo: periodo === "7d" || periodo === "90d" ? periodo : periodo === "custom" || (de && ate) ? "custom" : "30d",
    de,
    ate,
    link: params.get("link") ?? "",
    origem: params.get("origem") ?? "",
    chegada: params.get("chegada") ?? "",
    aparelho: params.get("aparelho") ?? "",
    pais: params.get("pais") ?? "",
    app: app === "sim" || app === "nao" ? app : "",
  };
}

function urlDosFiltros(f: Filtros): string {
  const q = new URLSearchParams();
  if (f.periodo !== "30d") q.set("periodo", f.periodo);
  if (f.periodo === "custom") {
    if (f.de) q.set("de", f.de);
    if (f.ate) q.set("ate", f.ate);
  }
  for (const chave of ["link", "origem", "chegada", "aparelho", "pais", "app"] as const) {
    if (f[chave]) q.set(chave, f[chave]);
  }
  const s = q.toString();
  return s ? `/analytics?${s}` : "/analytics";
}

function paramsDaApi(f: Filtros): ReportParams | null {
  const base: ReportParams = {
    link: f.link || undefined,
    origem: f.origem || undefined,
    chegada: f.chegada || undefined,
    aparelho: f.aparelho || undefined,
    pais: f.pais || undefined,
    app: f.app || undefined,
  };
  if (f.periodo === "custom") {
    // Só pede quando as duas datas estão preenchidas e em ordem.
    if (!f.de || !f.ate || f.de > f.ate) return null;
    return { ...base, de: f.de, ate: f.ate };
  }
  return { ...base, days: PERIOD_DAYS[f.periodo] };
}

/** A variação de um cartão contra a janela anterior. Sem base, diz isso. */
function variacao(atual: number, anterior: number): { texto: string; tipo: "positive" | "negative" | "neutral" } {
  if (anterior === 0) return { texto: atual > 0 ? "sem base anterior" : "igual ao anterior", tipo: "neutral" };
  const pct = Math.round(((atual - anterior) / anterior) * 100);
  if (pct === 0) return { texto: "igual ao anterior", tipo: "neutral" };
  return { texto: `${pct > 0 ? "+" : ""}${pct}% vs anterior`, tipo: pct > 0 ? "positive" : "negative" };
}

export default function AnalyticsPage() {
  // `useSearchParams` exige fronteira de Suspense no App Router.
  return (
    <Suspense fallback={<Carregando />}>
      <Analytics />
    </Suspense>
  );
}

function Carregando() {
  return (
    <Tela>
      <CabecalhoDeTela titulo="Analytics" descricao="Carregando…" />
      <div className="space-y-8">
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-[180px] rounded-xl border border-bee-line bg-bee-surface p-5 space-y-4">
              <Esqueleto className="w-10 h-10" />
              <Esqueleto className="h-8 w-16" />
              <Esqueleto className="h-3 w-24" />
            </div>
          ))}
        </div>
        <Esqueleto className="h-96 rounded-xl" />
        <Esqueleto className="h-64 rounded-xl" />
      </div>
    </Tela>
  );
}

function Analytics() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const filtros = useMemo(() => filtrosDaUrl(searchParams), [searchParams]);
  const { plano } = usePlano();
  const { session } = useSession();
  const [data, setData] = useState<ReportResponse | null>(null);
  /** O Free não tem relatório. Vem do plano quando a sessão já carregou, ou da
   *  recusa da API quando a página abriu antes dela. */
  const [recusadoPeloPlano, setRecusadoPeloPlano] = useState(false);
  const semRelatorio = recusadoPeloPlano || plano?.limits.relatorio === false;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  /** Título por id de link, para a tabela "por link" não mostrar UUID cru. */
  const [linkTitles, setLinkTitles] = useState<Map<string, string>>(new Map());
  /** Datas digitadas antes de valerem: só vão para a URL quando as duas existem. */
  const [datas, setDatas] = useState({ de: filtros.de, ate: filtros.ate });

  const params = useMemo(() => paramsDaApi(filtros), [filtros]);

  const load = useCallback(
    async (p: ReportParams) => {
      setLoading(true);
      setError(null);
      try {
        // Relatório e títulos juntos: são duas leituras independentes e a
        // tabela precisa das duas para significar algo.
        const [report, links] = await Promise.all([api.report(p), api.links()]);
        setData(report);
        setLinkTitles(new Map(links.map((link) => [link.id, link.title])));
      } catch (caught) {
        if (caught instanceof ApiError && caught.isUnauthorized) {
          router.replace("/login?de=/analytics");
          return;
        }
        if (caught instanceof ApiError && caught.code === "plano_pro_necessario") {
          setRecusadoPeloPlano(true);
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
    if (semRelatorio || !params) return;
    void load(params);
  }, [params, load, semRelatorio]);

  useEffect(() => {
    setDatas({ de: filtros.de, ate: filtros.ate });
  }, [filtros.de, filtros.ate]);

  const aplicar = useCallback(
    (mudanca: Partial<Filtros>) => {
      router.replace(urlDosFiltros({ ...filtros, ...mudanca }), { scroll: false });
    },
    [filtros, router],
  );

  const escolherPeriodo = (periodo: Period) => {
    if (periodo === "custom") {
      // Entra já com uma janela válida: os últimos 30 dias, para editar.
      const de = datas.de || diasAtrasIso(29);
      const ate = datas.ate || hojeIso();
      aplicar({ periodo, de, ate });
      return;
    }
    aplicar({ periodo, de: "", ate: "" });
  };

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

  if (semRelatorio) {
    return (
      <Tela>
        <CabecalhoDeTela titulo="Analytics" selo={<SeloPro />} />
        <div className="max-w-md mx-auto text-center py-16">
          <p className="text-sm text-bee-muted">
            O relatório de visitas e cliques é do plano Pro. Fale com a equipe para liberar
            na sua conta.
          </p>
        </div>
      </Tela>
    );
  }

  if (loading && !data) return <Carregando />;

  if (error || !data) {
    return (
      <Tela>
        <CabecalhoDeTela titulo="Analytics" />
        <div className="max-w-md mx-auto text-center py-16">
          <h2 className="text-xl text-white mb-2 font-semibold">Relatório indisponível</h2>
          <p className="text-sm text-bee-muted mb-6">
            Não foi possível carregar o relatório{error ? `: ${error}` : "."}
          </p>
          <button
            onClick={() => params && void load(params)}
            className="h-10 px-5 rounded-lg bg-bee-pink hover:bg-bee-pink-hot text-white text-sm font-semibold transition-colors"
          >
            Tentar de novo
          </button>
        </div>
      </Tela>
    );
  }

  const { report, counters } = data;
  const chartData = report.daily.map((day) => ({ ...day, label: shortDate(day.date) }));
  const inAppShare = report.clicks ? Math.round((report.inAppClicks / report.clicks) * 100) : 0;
  const hasTraffic = report.clicks > 0 || report.views > 0;
  const filtrosAtivos = (["link", "origem", "chegada", "aparelho", "pais", "app"] as const).filter((c) => filtros[c]).length;
  const descricaoDaJanela =
    filtros.periodo === "custom" ? `de ${shortDate(data.de)} a ${shortDate(data.ate)}` : `dos últimos ${data.days} dias`;
  const vViews = variacao(report.views, report.previous.views);
  const vVisitantes = variacao(report.visitors, report.previous.visitors);
  const vClicks = variacao(report.clicks, report.previous.clicks);
  const vInApp = variacao(report.inAppClicks, report.previous.inAppClicks);
  const vTaxa = variacao(Math.round(report.clickRate * 100), Math.round(report.previous.clickRate * 100));

  return (
    <Tela>
      {/* De qual página são estes números está na barra do topo. */}
      <CabecalhoDeTela titulo="Analytics" descricao={`Visitas e cliques ${descricaoDaJanela}`} />

      {/* Filtros: a janela e os recortes. Cada mudança vai para a URL. */}
      <div className="mb-8">
        <BarraDeFiltros
          periodo={filtros.periodo}
          de={datas.de}
          ate={datas.ate}
          minimo={diasAtrasIso(89)}
          maximo={hojeIso()}
          carregando={loading}
          aviso={filtros.link ? "Com um link escolhido: os cliques, a última etapa do funil e o passo a passo ficam só com quem clicou nele. As visitas seguem inteiras." : null}
          onPeriodo={escolherPeriodo}
          onDatas={(de, ate) => {
            setDatas({ de, ate });
            if (de && ate && de <= ate) aplicar({ de, ate });
          }}
          onFiltro={(chave, valor) => aplicar({ [chave]: valor } as Partial<Filtros>)}
          onLimpar={() => router.replace("/analytics", { scroll: false })}
          filtros={[
            { chave: "link", rotulo: "Link", valor: filtros.link, nomeDoValor: filtros.link ? linkTitles.get(filtros.link) : undefined,
              opcoes: report.options.links.map((id) => ({ valor: id, nome: linkTitles.get(id) ?? id })) },
            { chave: "origem", rotulo: "Origem", valor: filtros.origem, opcoes: report.options.sources.map((v) => ({ valor: v, nome: v })) },
            { chave: "chegada", rotulo: "Endereço", valor: filtros.chegada, opcoes: report.options.arrivalHosts.map((v) => ({ valor: v, nome: v })) },
            { chave: "aparelho", rotulo: "Aparelho", valor: filtros.aparelho, opcoes: report.options.devices.map((v) => ({ valor: v, nome: NOME_DO_APARELHO[v] ?? v })) },
            { chave: "pais", rotulo: "País", valor: filtros.pais, nomeDoValor: filtros.pais ? nomeDoPais(filtros.pais) : undefined,
              opcoes: report.options.countries.map((v) => ({ valor: v, nome: nomeDoPais(v) })) },
            { chave: "app", rotulo: "Navegador", valor: filtros.app, opcoes: [{ valor: "sim", nome: "Dentro de app" }, { valor: "nao", nome: "Navegador comum" }] },
          ]}
        />
      </div>

      {/* Coreografia do relatório, como a skill recomenda para painéis: os
          cartões de métrica chegam primeiro, em escada, com os números
          contando; o gráfico desenha em seguida; as tabelas por último. */}
      {/* Trocar um filtro busca de novo: uma linha corre no topo do relatório
          enquanto os números antigos esperam, apagados, pelos novos. */}
      <div className="relative h-0.5 -mt-4 mb-4 overflow-hidden rounded-full" aria-hidden>
        <AnimatePresence>
          {loading && (
            <motion.div key="buscando" variants={CROSSFADE} initial="initial" animate="animate" exit="exit" className="absolute inset-0 bg-white/[0.04]">
              <motion.div
                className="absolute inset-y-0 w-1/3 rounded-full bg-gradient-to-r from-transparent via-bee-pink to-transparent"
                initial={{ x: "-100%" }}
                animate={{ x: "300%" }}
                transition={{ duration: 1.1, ease: "easeInOut", repeat: Infinity }}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <motion.div variants={LISTA} initial="initial" animate="animate" className={cn("space-y-8 transition-opacity duration-200", loading && "opacity-60")}>
        {/* Métricas, comparadas com a janela anterior de mesmo tamanho. */}
        <motion.div variants={LISTA} data-tour="metricas" className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <motion.div variants={ITEM_DA_LISTA} whileHover={{ y: -3 }} transition={MOLA}>
            <StatsCard
              icon={Eye}
              iconBg="rgba(255, 60, 110, 0.15)"
              label="Visualizações"
              value={report.views}
              formatar={(n) => formatNumber(Math.round(n))}
              change={vViews.texto}
              changeType={vViews.tipo}
            />
          </motion.div>
          {/* Pessoas, e não eventos: a mesma pessoa abrindo a página três vezes
              no dia são três visualizações e um visitante. Contado por dia —
              quem volta amanhã soma de novo. */}
          <motion.div variants={ITEM_DA_LISTA} whileHover={{ y: -3 }} transition={MOLA}>
            <StatsCard
              icon={Users}
              iconBg="rgba(91, 141, 239, 0.15)"
              label="Visitantes únicos"
              value={report.visitors}
              formatar={(n) => formatNumber(Math.round(n))}
              change={vVisitantes.texto}
              changeType={vVisitantes.tipo}
            />
          </motion.div>
          <motion.div variants={ITEM_DA_LISTA} whileHover={{ y: -3 }} transition={MOLA}>
            <StatsCard
              icon={MousePointer2}
              iconBg="rgba(255, 160, 60, 0.15)"
              label="Cliques"
              value={report.clicks}
              formatar={(n) => formatNumber(Math.round(n))}
              change={vClicks.texto}
              changeType={vClicks.tipo}
            />
          </motion.div>
          {/* Agnóstico de propósito: mede tráfego preso em QUALQUER navegador
              embutido, não só Instagram. É o número que justifica o escape. */}
          <motion.div variants={ITEM_DA_LISTA} whileHover={{ y: -3 }} transition={MOLA}>
            <StatsCard
              icon={Smartphone}
              iconBg="rgba(225, 48, 108, 0.15)"
              label="Dentro de app"
              value={report.inAppClicks}
              formatar={(n) => formatNumber(Math.round(n))}
              change={`${inAppShare}% dos cliques · ${vInApp.texto}`}
              changeType={vInApp.tipo}
            />
          </motion.div>
          <motion.div variants={ITEM_DA_LISTA} whileHover={{ y: -3 }} transition={MOLA}>
            <StatsCard
              icon={TrendingUp}
              iconBg="rgba(100, 220, 100, 0.15)"
              label="Cliques por visita"
              value={report.views ? report.clickRate : "—"}
              formatar={(n) => n.toFixed(2)}
              change={report.views ? `${report.clicks} / ${report.views} · ${vTaxa.texto}` : "sem visitas"}
              changeType={report.views ? vTaxa.tipo : "neutral"}
            />
          </motion.div>
        </motion.div>

        {/* Indicadores: a leitura pronta, antes do detalhe. */}
        {hasTraffic && (
          <motion.div variants={ITEM_DA_LISTA}>
            <Indicadores kpis={report.kpis} />
          </motion.div>
        )}

        {/* Funil: até onde as pessoas foram. */}
        {report.funnel.length > 0 && (
          <motion.div variants={ITEM_DA_LISTA}>
            <Funil
              etapas={report.funnel}
              titulo={(id) => linkTitles.get(id) ?? "Link removido"}
              linkAtivo={filtros.link}
              onLink={(id) => aplicar({ link: filtros.link === id ? "" : id })}
            />
          </motion.div>
        )}

        {/* Robôs filtrados — fica visível para o número baixo não parecer perda
            de tráfego. */}
        {report.botHits > 0 && (
          <motion.div variants={ITEM_DA_LISTA} className="flex items-center gap-3 rounded-xl border border-white/5 bg-bee-surface px-5 py-4">
            <ShieldCheck className="w-5 h-5 text-bee-muted flex-shrink-0" />
            <p className="text-xs text-bee-muted">
              <span className="text-white font-medium">{formatNumber(report.botHits)}</span>{" "}
              requisições de robô foram redirecionadas mas não contadas — prévias de link do
              WhatsApp, Telegram, Discord e crawlers de busca. Total histórico, não só da janela.
            </p>
          </motion.div>
        )}

        {/* Gráfico */}
        <motion.section variants={ITEM_DA_LISTA} data-tour="grafico" className="bg-bee-surface rounded-xl p-6 border border-white/5">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl text-white font-semibold">
              Desempenho {filtros.periodo === "custom" ? descricaoDaJanela : `em ${data.days} dias`}
            </h2>
            <span className="text-xs text-bee-muted">
              anterior: {formatNumber(report.previous.views)} visitas · {formatNumber(report.previous.clicks)} cliques
            </span>
          </div>

          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.05)" />
              <XAxis dataKey="label" stroke="#555" tick={{ fontSize: 11 }} tickLine={false} />
              <YAxis stroke="#555" tick={{ fontSize: 11 }} tickLine={false} allowDecimals={false} />
              <Tooltip content={<CustomTooltip />} />
              {/* As linhas se DESENHAM da esquerda para a direita; os cliques
                  (a série que importa) começam 150 ms depois das visualizações,
                  para o olho ler uma e depois a outra. */}
              <Line
                type="monotone"
                dataKey="views"
                stroke="#555"
                strokeWidth={2}
                dot={false}
                name="Visualizações"
                isAnimationActive
                animationBegin={150}
                animationDuration={900}
                animationEasing="ease-out"
              />
              <Line
                type="monotone"
                dataKey="clicks"
                stroke="#FF3C6E"
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 4, fill: "#FF3C6E" }}
                name="Cliques"
                isAnimationActive
                animationBegin={300}
                animationDuration={900}
                animationEasing="ease-out"
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
        </motion.section>

        {hasTraffic && (
          <motion.div variants={ITEM_DA_LISTA}>
            <Horarios porHora={report.kpis.byHour} />
          </motion.div>
        )}

        {!hasTraffic && (
          <motion.div variants={ITEM_DA_LISTA} data-tour="sem-trafego" className="rounded-xl border border-bee-border bg-bee-surface px-6 py-10 text-center">
            <h3 className="text-2xl text-white mb-2 font-semibold">{filtrosAtivos > 0 ? "Nada com esse recorte" : "Nenhum clique ainda"}</h3>
            <p className="text-sm text-bee-muted max-w-md mx-auto">
              {filtrosAtivos > 0 ? (
                "Afrouxe um filtro ou limpe todos para voltar ao total da janela."
              ) : (
                <>
                  O rastreamento está ativo. Abra{" "}
                  <span className="text-bee-pink">/{session?.profile?.slug ?? "sua-pagina"}</span> e toque
                  em um link — o clique aparece aqui na hora.
                </>
              )}
            </p>
          </motion.div>
        )}

        {/* Top links */}
        {report.byLink.length > 0 && (
          <motion.section variants={ITEM_DA_LISTA} className="bg-bee-surface rounded-xl p-6 border border-white/5">
            <h2 className="text-xl text-white mb-6 font-semibold">Links mais clicados</h2>
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
                          <button
                            type="button"
                            onClick={() => aplicar({ link: filtros.link === row.linkId ? "" : row.linkId })}
                            title="Filtrar por este link"
                            className="flex items-center gap-2 text-left hover:text-bee-pink transition-colors"
                          >
                            <IconeDePlataforma plataforma={row.channel ?? ""} className="w-4 h-4 text-white/50 flex-shrink-0" />
                            <span className="text-sm text-white truncate max-w-[220px]">
                              {linkTitles.get(row.linkId) ?? row.linkId}
                            </span>
                          </button>
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
                            {/* A barra cresce até a fatia dela: `scaleX` a partir
                                da esquerda, que não recalcula layout. */}
                            <motion.div
                              className="h-full rounded-full origin-left"
                              initial={{ scaleX: 0 }}
                              animate={{ scaleX: 1 }}
                              transition={{ duration: 0.6, delay: 0.1 + index * 0.05 }}
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
          </motion.section>
        )}

        {/* Origem dos cliques — quebras montadas a partir do que foi medido, não
            de uma lista fixa de plataformas. Clicar numa origem filtra por ela. */}
        {report.bySource.length > 0 && (
          <motion.section variants={ITEM_DA_LISTA} data-tour="origem">
            <h2 className="text-xl text-white mb-6 font-semibold">Origem dos cliques</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {report.bySource.slice(0, 10).map((source) => {
                const color = colorForKey(source.key);
                const percentage = Math.round(source.share * 100);
                return (
                  <button
                    type="button"
                    key={source.key}
                    onClick={() => aplicar({ origem: filtros.origem === source.key ? "" : source.key })}
                    title="Filtrar por esta origem"
                    className={cn(
                      "bg-bee-surface rounded-xl p-4 border text-left transition-colors",
                      filtros.origem === source.key ? "border-bee-pink/60" : "border-white/5 hover:border-white/15",
                    )}
                  >
                    <div className="w-9 h-9 mb-3 rounded-lg flex items-center justify-center" style={{ background: `${color}22` }}>
                      <IconeDePlataforma plataforma={source.key} className="w-4 h-4" />
                    </div>
                    <div className="text-2xl text-white mb-1 font-semibold">
                      {formatNumber(source.clicks)}
                    </div>
                    <div className="text-xs text-bee-muted mb-3 truncate" title={source.key}>
                      {source.key}
                    </div>
                    <div className="w-full h-1.5 bg-bee-bg rounded-full overflow-hidden mb-2">
                      <motion.div
                        className="h-full rounded-full origin-left"
                        initial={{ scaleX: 0 }}
                        animate={{ scaleX: 1 }}
                        transition={{ duration: 0.6, delay: 0.2 }}
                        style={{ width: `${percentage}%`, backgroundColor: color }}
                      />
                    </div>
                    <div className="text-xs font-medium" style={{ color }}>
                      {percentage}%
                    </div>
                  </button>
                );
              })}
            </div>
          </motion.section>
        )}

        {/* Aparelhos e endereços de chegada: listas curtas, só quando há dado. */}
        {(report.byDevice.length > 0 || report.byArrivalHost.length > 0) && (
          <motion.div variants={ITEM_DA_LISTA} className="grid md:grid-cols-2 gap-6">
            {report.byDevice.length > 0 && (
              <ListaDeQuebra
                titulo="Aparelhos"
                itens={report.byDevice.map((d) => ({ ...d, nome: NOME_DO_APARELHO[d.key] ?? d.key }))}
                ativo={filtros.aparelho}
                onEscolher={(v) => aplicar({ aparelho: filtros.aparelho === v ? "" : v })}
              />
            )}
            {report.byArrivalHost.length > 0 && (
              <ListaDeQuebra
                titulo="Endereço de chegada"
                nota="visitas e cliques"
                itens={report.byArrivalHost.map((h) => ({ ...h, nome: h.key }))}
                ativo={filtros.chegada}
                onEscolher={(v) => aplicar({ chegada: filtros.chegada === v ? "" : v })}
              />
            )}
          </motion.div>
        )}

        {/* Campanhas — só aparece quando existe UTM medido. */}
        {report.byCampaign.length > 0 && (
          <motion.section variants={ITEM_DA_LISTA}>
            <h2 className="text-xl text-white mb-6 font-semibold">Campanhas</h2>
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
          </motion.section>
        )}

        {/* Evento por evento. Não diz QUEM é — a página não sabe, e ninguém
            que toca num link está identificado —, mas mostra tudo o que foi
            medido de cada visita e clique. */}
        {report.events.length > 0 && (
          <motion.div variants={ITEM_DA_LISTA}>
            <PassoAPasso eventos={report.events} total={report.eventsTotal} titulo={(id) => linkTitles.get(id)} />
          </motion.div>
        )}
      </motion.div>
    </Tela>
  );
}

/**
 * O passo a passo, linha por linha.
 *
 * Passar o mouse numa linha acende todas as linhas da mesma pessoa: é o jeito
 * de ler o caminho dela no meio dos outros. Tocar no código do visitante fixa
 * o destaque (no celular não existe hover) e tocar de novo solta.
 *
 * As primeiras linhas chegam em cascata de 20 ms quando a tabela entra na
 * tela; o resto já nasce no lugar — animar a página inteira seria ruído, e a
 * escada passaria de meio segundo.
 *
 * ## Paginação
 *
 * 25 passos por página. A API manda de uma vez os passos mais recentes do
 * recorte (até 1000), e a troca de página acontece aqui, sem nova busca: é
 * instantânea e o destaque de um visitante continua valendo de uma página
 * para a outra. Trocar um filtro volta à primeira página. Quando o recorte
 * tem mais passos do que vieram, o cabeçalho diz quantos ficaram de fora.
 */
const PASSOS_POR_PAGINA = 25;

function PassoAPasso({ eventos, total, titulo }: { eventos: ReportEvent[]; total: number; titulo: (linkId: string) => string | undefined }) {
  const [sobre, setSobre] = useState<string | null>(null);
  const [fixado, setFixado] = useState<string | null>(null);
  const emFoco = sobre ?? fixado;
  const secao = useRef<HTMLElement>(null);

  const paginas = Math.max(1, Math.ceil(eventos.length / PASSOS_POR_PAGINA));
  const [pagina, setPagina] = useState(1);
  // Recorte novo, lista nova: a página 7 de antes pode nem existir mais.
  useEffect(() => setPagina(1), [eventos]);
  const atual = Math.min(pagina, paginas);
  const inicio = (atual - 1) * PASSOS_POR_PAGINA;
  const daPagina = eventos.slice(inicio, inicio + PASSOS_POR_PAGINA);

  const irPara = (n: number) => {
    setPagina(Math.min(Math.max(n, 1), paginas));
    // Quem trocou de página no rodapé volta ao topo da tabela.
    const topo = secao.current?.getBoundingClientRect().top ?? 0;
    if (topo < 0) secao.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <section ref={secao} data-tour="passo-a-passo" className="scroll-mt-24 bg-bee-surface rounded-xl p-6 border border-bee-line">
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-2">
        <h2 className="text-xl text-white font-semibold">Passo a passo de cada visitante</h2>
        <span className="text-xs text-bee-muted">
          {total > eventos.length
            ? `os ${formatNumber(eventos.length)} mais recentes de ${formatNumber(total)} passos`
            : `${formatNumber(eventos.length)} ${eventos.length === 1 ? "passo" : "passos"} no recorte`}
        </span>
      </div>
      <p className="text-xs text-bee-muted mb-5 max-w-2xl">
        Cada linha é um passo. O código em Visitante repete nas linhas da mesma pessoa no mesmo dia,
        e embaixo dele está até onde ela foi. Toque no código para destacar o caminho dela. Ele não
        identifica ninguém: nome, perfil e telefone de quem visita nunca chegam à página.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px]">
          <thead>
            <tr className="border-b border-white/5">
              {["Quando", "Evento", "Origem", "Aparelho", "País", "Rede", "Visitante"].map((coluna) => (
                <th key={coluna} className="text-left text-xs font-medium text-bee-muted pb-3 pr-4 first:pl-2">{coluna}</th>
              ))}
            </tr>
          </thead>
          {/* A chave troca com a página: as linhas novas entram em cascata. */}
          <tbody key={atual} onMouseLeave={() => setSobre(null)}>
            {daPagina.map((evento, index) => (
              <LinhaDeEvento
                key={`${evento.at}-${evento.type}-${inicio + index}`}
                evento={evento}
                titulo={evento.linkId ? titulo(evento.linkId) : undefined}
                ateOnde={
                  evento.reached === "click"
                    ? ondeClicou(evento.reachedLinks, (id) => titulo(id) ?? "link removido")
                    : ETAPA[evento.reached].parou
                }
                indice={index}
                destaque={emFoco === null ? "nenhum" : emFoco === evento.visitor ? "esta" : "outra"}
                fixada={fixado === evento.visitor}
                onSobre={() => setSobre(evento.visitor)}
                onFixar={() => setFixado((atual) => (atual === evento.visitor ? null : evento.visitor))}
              />
            ))}
          </tbody>
        </table>
      </div>

      {paginas > 1 && (
        <nav aria-label="Páginas do passo a passo" className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-bee-muted tabular-nums" aria-live="polite">
            {formatNumber(inicio + 1)}–{formatNumber(inicio + daPagina.length)} de {formatNumber(eventos.length)}
          </p>
          <div className="flex items-center gap-1">
            <BotaoDePagina rotulo="Página anterior" desligado={atual === 1} onClick={() => irPara(atual - 1)}>
              <ChevronLeft className="w-4 h-4" aria-hidden />
            </BotaoDePagina>
            {janelaDePaginas(atual, paginas).map((n, i) =>
              n === null ? (
                <span key={`salto-${i}`} className="w-6 text-center text-xs text-bee-muted" aria-hidden>…</span>
              ) : (
                <BotaoDePagina key={n} rotulo={`Página ${n}`} ativo={n === atual} onClick={() => irPara(n)}>
                  {n}
                </BotaoDePagina>
              ),
            )}
            <BotaoDePagina rotulo="Próxima página" desligado={atual === paginas} onClick={() => irPara(atual + 1)}>
              <ChevronRight className="w-4 h-4" aria-hidden />
            </BotaoDePagina>
          </div>
        </nav>
      )}
    </section>
  );
}

/** As páginas que o rodapé mostra: a primeira, a última e as vizinhas da
 *  atual; `null` é o salto ("…"). Até sete páginas, todas. */
function janelaDePaginas(atual: number, paginas: number): Array<number | null> {
  if (paginas <= 7) return Array.from({ length: paginas }, (_, i) => i + 1);
  const meio = [atual - 1, atual, atual + 1].filter((n) => n > 1 && n < paginas);
  return [1, ...(meio[0] > 2 ? [null] : []), ...meio, ...(meio[meio.length - 1] < paginas - 1 ? [null] : []), paginas];
}

function BotaoDePagina({
  rotulo,
  ativo,
  desligado,
  onClick,
  children,
}: {
  rotulo: string;
  ativo?: boolean;
  desligado?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={desligado}
      aria-label={rotulo}
      aria-current={ativo ? "page" : undefined}
      className={cn(
        "min-w-9 h-9 px-2 rounded-lg text-sm tabular-nums flex items-center justify-center transition-colors active:scale-95",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-bee-pink disabled:opacity-30 disabled:pointer-events-none",
        ativo ? "bg-bee-pink text-white font-semibold" : "text-bee-muted hover:text-white hover:bg-white/[0.06]",
      )}
    >
      {children}
    </button>
  );
}

/** Quantas linhas entram em cascata; as demais já nascem no lugar. */
const LINHAS_EM_CASCATA = 14;

function LinhaDeEvento({
  evento,
  titulo,
  ateOnde,
  indice,
  destaque,
  fixada,
  onSobre,
  onFixar,
}: {
  evento: ReportEvent;
  titulo?: string;
  ateOnde: string;
  indice: number;
  destaque: "nenhum" | "esta" | "outra";
  fixada: boolean;
  onSobre: () => void;
  onFixar: () => void;
}) {
  const destino = [nomeDaPlataforma(evento.channel), evento.destinationHost].filter(Boolean).join(" · ");
  const clique = evento.type === "click";
  const saida = evento.type === "leave";
  const Icone = clique ? MousePointer2 : saida ? LogOut : evento.type === "view" ? Eye : evento.type === "arrival" ? DoorOpen : ArrowUpRight;
  const aparelho = [NOME_DO_APARELHO[evento.device] ?? evento.device, evento.os, evento.browser].filter(Boolean).join(" · ");
  const campanha = [evento.medium, evento.campaign].filter(Boolean).join(" · ");
  const emCascata = indice < LINHAS_EM_CASCATA;
  return (
    <motion.tr
      // A entrada (só nas primeiras linhas) é do `motion`; apagar e acender
      // no destaque é CSS, para as duas coisas não disputarem a opacidade.
      initial={emCascata ? { y: 8 } : false}
      whileInView={{ y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.24, ease: SUAVE, delay: emCascata ? indice * 0.02 : 0 }}
      onMouseEnter={onSobre}
      className={cn(
        "border-b border-white/5 align-top transition-[opacity,background-color] duration-150",
        destaque === "outra" && "opacity-45",
        destaque === "esta" ? "bg-bee-pink/[0.07]" : indice % 2 === 1 && "bg-white/[0.02]",
      )}
    >
      <td className={cn("py-3 pr-4 pl-2 text-sm text-white/80 whitespace-nowrap tabular-nums border-l-2 transition-colors duration-150", destaque === "esta" ? "border-bee-pink" : "border-transparent")}>
        {dataEHora(evento.at)}
      </td>
      <td className="py-3 pr-4">
        <div className="flex items-center gap-2 text-sm text-white">
          <Icone className={cn("w-3.5 h-3.5 flex-shrink-0", clique ? "text-bee-pink" : "text-white/40")} />
          <span className="truncate max-w-[200px]">{clique ? (titulo ?? "Link removido") : saida ? "Saiu da página" : ETAPA[evento.type as Etapa].fez}</span>
        </div>
        {clique && destino && (
          <div className="mt-0.5 pl-[22px] text-xs text-bee-muted truncate max-w-[220px]">{destino}</div>
        )}
      </td>
      <td className="py-3 pr-4">
        <div className="text-sm text-white truncate max-w-[160px]" title={evento.source}>{evento.source}</div>
        {campanha && <div className="mt-0.5 text-xs text-bee-muted truncate max-w-[160px]" title={campanha}>{campanha}</div>}
        {evento.clickIds.length > 0 && (
          <div className="mt-0.5 text-xs text-bee-muted truncate max-w-[160px]" title="Identificador de anúncio presente no link">
            {evento.clickIds.join(", ")}
          </div>
        )}
      </td>
      <td className="py-3 pr-4">
        <div className="text-sm text-white/80 whitespace-nowrap">{aparelho}</div>
        {evento.inApp && (
          <div className="mt-0.5 text-xs text-bee-pink/90">dentro do {NOME_DO_APP[evento.inApp] ?? evento.inApp}</div>
        )}
      </td>
      <td className="py-3 pr-4 text-sm text-white/80 whitespace-nowrap">{evento.country ? nomeDoPais(evento.country) : "—"}</td>
      <td className="py-3 pr-4 text-xs text-bee-muted font-mono whitespace-nowrap">{evento.network ?? "—"}</td>
      <td className="py-3 whitespace-nowrap">
        <button
          type="button"
          onClick={onFixar}
          aria-pressed={fixada}
          title={fixada ? "Soltar o destaque" : "Destacar o caminho desta pessoa"}
          className={cn(
            "-mx-1.5 px-1.5 py-1 rounded text-xs font-mono transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-bee-pink",
            fixada ? "bg-bee-pink/20 text-white" : "text-bee-muted hover:text-white hover:bg-white/[0.06]",
          )}
        >
          {evento.visitor}
        </button>
        <div
          className={cn("mt-0.5 text-xs truncate max-w-[170px]", evento.reached === "click" ? "text-bee-pink/90" : "text-bee-muted")}
          title={ateOnde}
        >
          {ateOnde}
        </div>
      </td>
    </motion.tr>
  );
}

function ListaDeQuebra({
  titulo,
  nota,
  itens,
  ativo,
  onEscolher,
}: {
  titulo: string;
  nota?: string;
  itens: { key: string; nome: string; clicks: number; share: number }[];
  ativo: string;
  onEscolher: (valor: string) => void;
}) {
  return (
    <section>
      <h2 className="text-xl text-white mb-4 font-semibold">
        {titulo}
        {nota && <span className="ml-2 text-xs font-normal text-bee-dim">{nota}</span>}
      </h2>
      <div className="bg-bee-surface rounded-xl border border-white/5 divide-y divide-white/5">
        {itens.slice(0, 8).map((item) => (
          <button
            type="button"
            key={item.key}
            onClick={() => onEscolher(item.key)}
            className={cn(
              "w-full flex items-center justify-between px-5 py-3 text-left transition-colors hover:bg-white/[0.03]",
              ativo === item.key && "bg-bee-pink/10",
            )}
          >
            <span className="text-sm text-white truncate">{item.nome}</span>
            <span className="text-sm text-bee-muted">
              {formatNumber(item.clicks)} <span className="text-bee-dim">({Math.round(item.share * 100)}%)</span>
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
