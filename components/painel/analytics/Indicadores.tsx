"use client";

import React, { useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Clock, DoorOpen, Hourglass, Layers, type LucideIcon, Target, TrendingDown } from "lucide-react";

import { NumeroAnimado } from "@/components/painel/NumeroAnimado";
import type { ReportKpis } from "@/lib/api/types";
import { ITEM_DA_LISTA, LISTA, MOLA, SUAVE } from "@/lib/movimento";
import { cn, formatNumber } from "@/lib/utils";
import { duracao, ETAPA } from "./rotulos";

/**
 * Os indicadores do recorte: seis leituras prontas, tiradas do mesmo caminho
 * do funil, para a criadora saber em dez segundos se a página está
 * convertendo e onde ela perde gente.
 *
 * A grade tem sempre seis cartões (a conversão ocupa duas linhas e a maior
 * perda duas colunas: são as duas leituras que pedem ação). O que não tem base mostra "—" e diz o que
 * falta, em vez de sumir: sumir mexeria na grade a cada filtro, e um zero
 * passaria por medida.
 *
 * Movimento: os cartões chegam em escada (45 ms), o anel da conversão se
 * desenha e os números contam. No hover o cartão sobe 3 px. Tudo `transform`
 * e `opacity`; com movimento reduzido, o `MotionConfig` da casca troca por
 * fade e o anel já nasce desenhado.
 */
export function Indicadores({ kpis }: { kpis: ReportKpis }) {
  const { conversion, biggestDrop, timeToClick, timeBeforeLeaving, appExit, linksPerClicker } = kpis;
  const pct = Math.round(conversion.rate * 100);
  // Diferença em pontos percentuais: "+5 p.p." não se confunde com "+5%".
  const pontos = conversion.previousRate === null ? null : Math.round((conversion.rate - conversion.previousRate) * 100);

  return (
    <section data-tour="indicadores" aria-label="Indicadores do período">
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-4">
        <h2 className="text-xl text-white font-semibold">Indicadores</h2>
        <span className="text-xs text-bee-muted">contam pessoas, não toques</span>
      </div>

      <motion.div variants={LISTA} className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* O herói: a conversão, com o anel. */}
        <Cartao className="col-span-2 lg:col-span-1 lg:row-span-2 flex flex-col">
          <Rotulo icone={Target} cor="#FF3C6E">Conversão</Rotulo>
          <div className="flex flex-1 items-center gap-5 lg:flex-col lg:justify-center lg:gap-4 lg:text-center">
            <Anel fracao={conversion.rate}>
              <span className="text-[28px] leading-none font-semibold text-white tabular-nums">
                <NumeroAnimado valor={pct} />
                <span className="text-base text-white/70">%</span>
              </span>
            </Anel>
            <div className="min-w-0">
              <p className="text-sm text-white">
                {conversion.visitors
                  ? `${formatNumber(conversion.clickers)} de ${formatNumber(conversion.visitors)} ${conversion.visitors === 1 ? "pessoa clicou" : "pessoas clicaram"} em algum link`
                  : "Ninguém passou pela página neste recorte"}
              </p>
              <p
                className={cn(
                  "mt-2 inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium",
                  pontos === null || pontos === 0 ? "bg-white/[0.06] text-bee-muted" : pontos > 0 ? "bg-emerald-400/15 text-emerald-400" : "bg-red-500/15 text-red-400",
                )}
              >
                {pontos === null ? "sem base anterior" : pontos === 0 ? "igual ao período anterior" : `${pontos > 0 ? "+" : ""}${pontos} p.p. vs anterior`}
              </p>
            </div>
          </div>
        </Cartao>

        <Cartao className="col-span-2">
          <Rotulo icone={TrendingDown} cor="#fbbf24">Onde mais perde</Rotulo>
          {biggestDrop ? (
            <>
              <Valor className="text-amber-200">
                <NumeroAnimado valor={Math.round(biggestDrop.share * 100)} />%
              </Valor>
              <Nota>
                <span className="text-white">{ETAPA[biggestDrop.stage].lugar}</span>: {formatNumber(biggestDrop.stopped)}{" "}
                {biggestDrop.stopped === 1 ? "pessoa parou" : "pessoas pararam"} aqui
              </Nota>
            </>
          ) : (
            <Vazio>Ninguém parou no caminho</Vazio>
          )}
        </Cartao>

        <Cartao>
          <Rotulo icone={Clock} cor="#5b8def">Tempo até o clique</Rotulo>
          {timeToClick ? (
            <>
              <Valor>{duracao(timeToClick.medianMs)}</Valor>
              <Nota>
                tempo típico entre abrir a página e clicar ({formatNumber(timeToClick.sample)}{" "}
                {timeToClick.sample === 1 ? "pessoa" : "pessoas"})
              </Nota>
            </>
          ) : (
            <Vazio>Aparece com o primeiro clique</Vazio>
          )}
        </Cartao>

        <Cartao>
          <Rotulo icone={Hourglass} cor="#9b6dff">Ficou sem clicar</Rotulo>
          {timeBeforeLeaving ? (
            <>
              <Valor>{duracao(timeBeforeLeaving.medianMs)}</Valor>
              <Nota>
                tempo típico na página de quem saiu sem clicar ({formatNumber(timeBeforeLeaving.sample)}{" "}
                {timeBeforeLeaving.sample === 1 ? "pessoa" : "pessoas"})
              </Nota>
            </>
          ) : (
            <Vazio>Aparece quando alguém sair sem clicar</Vazio>
          )}
        </Cartao>

        <Cartao>
          <Rotulo icone={DoorOpen} cor="#00d4aa">Saída do aplicativo</Rotulo>
          {appExit ? (
            <>
              <Valor>
                <NumeroAnimado valor={Math.round(appExit.rate * 100)} />%
              </Valor>
              <Nota>
                {formatNumber(appExit.continued)} de {formatNumber(appExit.arrived)} que abriram dentro de um app tocaram em continuar
              </Nota>
            </>
          ) : (
            <Vazio>Ninguém passou pela tela de saída do app</Vazio>
          )}
        </Cartao>

        <Cartao>
          <Rotulo icone={Layers} cor="#ff9f43">Links por pessoa</Rotulo>
          {linksPerClicker > 0 ? (
            <>
              <Valor>
                <NumeroAnimado valor={linksPerClicker} formatar={(n) => n.toFixed(1).replace(".", ",")} />
              </Valor>
              <Nota>em quantos links diferentes clica, em média, quem clica</Nota>
            </>
          ) : (
            <Vazio>Aparece com o primeiro clique</Vazio>
          )}
        </Cartao>
      </motion.div>
    </section>
  );
}

function Cartao({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div
      variants={ITEM_DA_LISTA}
      whileHover={{ y: -3 }}
      transition={MOLA}
      className={cn("bg-bee-surface rounded-xl p-5 border border-bee-line transition-colors hover:border-bee-pink/20", className)}
    >
      {children}
    </motion.div>
  );
}

function Rotulo({ icone: Icone, cor, children }: { icone: LucideIcon; cor: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${cor}26` }}>
        <Icone className="w-3.5 h-3.5" style={{ color: cor }} aria-hidden />
      </span>
      <span className="text-xs text-bee-muted">{children}</span>
    </div>
  );
}

function Valor({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("text-[26px] leading-tight font-semibold text-white tabular-nums", className)}>{children}</div>;
}

function Nota({ children }: { children: React.ReactNode }) {
  return <p className="mt-1 text-xs leading-snug text-bee-muted">{children}</p>;
}

function Vazio({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Valor className="text-white/40">—</Valor>
      <Nota>{children}</Nota>
    </>
  );
}

/** O anel da conversão: o traço rosa se desenha até a fração. */
function Anel({ fracao, children }: { fracao: number; children: React.ReactNode }) {
  const reduzido = useReducedMotion();
  const alvo = Math.min(Math.max(fracao, 0), 1);
  return (
    <div className="relative w-[112px] h-[112px] flex-shrink-0">
      <svg viewBox="0 0 112 112" className="w-full h-full -rotate-90" aria-hidden>
        <defs>
          <linearGradient id="anel-da-conversao" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#FF3C6E" />
            <stop offset="100%" stopColor="#ff9f43" />
          </linearGradient>
        </defs>
        <circle cx="56" cy="56" r="48" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="9" />
        {alvo > 0 && (
          <motion.circle
            cx="56"
            cy="56"
            r="48"
            fill="none"
            stroke="url(#anel-da-conversao)"
            strokeWidth="9"
            strokeLinecap="round"
            initial={{ pathLength: reduzido ? alvo : 0 }}
            animate={{ pathLength: alvo }}
            transition={{ duration: 0.9, ease: SUAVE, delay: 0.15 }}
          />
        )}
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
    </div>
  );
}

/**
 * A que horas o público aparece: 24 barras, cliques em rosa sobre as visitas
 * em cinza. A API manda as horas em UTC; aqui elas giram para o fuso de quem
 * está olhando (fusos de meia hora arredondam para a hora cheia).
 *
 * As barras sobem em onda de 18 ms (a onda inteira cabe em 430 ms). Passar o
 * mouse, tocar ou focar uma barra mostra os números daquela hora na legenda —
 * a mesma informação para mouse, toque e teclado.
 */
export function Horarios({ porHora }: { porHora: ReportKpis["byHour"] }) {
  const horas = useMemo(() => {
    const desvio = Math.round(-new Date().getTimezoneOffset() / 60);
    return Array.from({ length: 24 }, (_, local) => {
      const utc = (((local - desvio) % 24) + 24) % 24;
      return { hora: local, views: porHora.views[utc] ?? 0, clicks: porHora.clicks[utc] ?? 0 };
    });
  }, [porHora]);
  const [emFoco, setEmFoco] = useState<number | null>(null);

  const teto = Math.max(1, ...horas.map((h) => Math.max(h.views, h.clicks)));
  const temCliques = horas.some((h) => h.clicks > 0);
  // O pico é dos cliques; sem cliques, das visitas.
  const pico = horas.reduce((melhor, h) => ((temCliques ? h.clicks > melhor.clicks : h.views > melhor.views) ? h : melhor), horas[0]);
  const mostrada = emFoco === null ? pico : horas[emFoco];
  const faixa = (h: number) => `${String(h).padStart(2, "0")}h–${String((h + 1) % 24).padStart(2, "0")}h`;

  return (
    <section data-tour="horarios" className="bg-bee-surface rounded-xl p-6 border border-bee-line">
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-1">
        <h2 className="text-xl text-white font-semibold">A que horas o público aparece</h2>
        <span className="text-xs text-bee-muted">no seu fuso horário</span>
      </div>
      <p className="text-xs text-bee-muted mb-5" aria-live="polite">
        {emFoco === null ? (temCliques ? "Pico de cliques" : "Pico de visitas") : "Nesta hora"}:{" "}
        <span className="text-white font-medium">{faixa(mostrada.hora)}</span> · {formatNumber(mostrada.views)}{" "}
        {mostrada.views === 1 ? "visita" : "visitas"} · <span className="text-bee-pink">{formatNumber(mostrada.clicks)} {mostrada.clicks === 1 ? "clique" : "cliques"}</span>
      </p>

      <div className="flex items-end gap-[3px] sm:gap-1.5 h-28" onMouseLeave={() => setEmFoco(null)}>
        {horas.map((h, i) => (
          <button
            type="button"
            key={h.hora}
            aria-label={`${faixa(h.hora)}: ${h.views} visitas, ${h.clicks} cliques`}
            onMouseEnter={() => setEmFoco(i)}
            onFocus={() => setEmFoco(i)}
            onBlur={() => setEmFoco(null)}
            onClick={() => setEmFoco(i)}
            className="group relative flex-1 h-full rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-bee-pink"
          >
            <span
              className={cn(
                "absolute inset-0 rounded-sm transition-colors duration-100",
                emFoco === i ? "bg-white/[0.06]" : "bg-transparent",
              )}
            />
            <motion.span
              className="absolute inset-x-0 bottom-0 rounded-t-sm bg-white/15 origin-bottom"
              style={{ height: `${Math.max((h.views / teto) * 100, h.views ? 4 : 0)}%` }}
              initial={{ scaleY: 0 }}
              whileInView={{ scaleY: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.45, ease: SUAVE, delay: i * 0.018 }}
            />
            <motion.span
              className={cn("absolute inset-x-[18%] bottom-0 rounded-t-sm origin-bottom", h.hora === pico.hora && temCliques ? "bg-bee-pink" : "bg-bee-pink/60")}
              style={{ height: `${Math.max((h.clicks / teto) * 100, h.clicks ? 4 : 0)}%` }}
              initial={{ scaleY: 0 }}
              whileInView={{ scaleY: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.45, ease: SUAVE, delay: 0.12 + i * 0.018 }}
            />
          </button>
        ))}
      </div>
      <div className="flex justify-between mt-2 text-[11px] text-bee-muted tabular-nums" aria-hidden>
        {["00h", "06h", "12h", "18h", "23h"].map((marca) => (
          <span key={marca}>{marca}</span>
        ))}
      </div>
      <div className="flex items-center gap-5 mt-4">
        <span className="flex items-center gap-2 text-xs text-bee-muted">
          <span className="w-3 h-3 rounded-sm bg-white/15" /> Visitas
        </span>
        <span className="flex items-center gap-2 text-xs text-bee-muted">
          <span className="w-3 h-3 rounded-sm bg-bee-pink" /> Cliques
        </span>
      </div>
    </section>
  );
}
