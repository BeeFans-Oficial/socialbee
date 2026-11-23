"use client";

import React, { useState } from "react";
import { motion, useReducedMotion, type Variants } from "framer-motion";

import { NumeroAnimado } from "@/components/painel/NumeroAnimado";
import { IconeDePlataforma } from "@/components/shared/IconeDePlataforma";
import type { FunnelStage } from "@/lib/api/types";
import { SUAVE } from "@/lib/movimento";
import { cn, formatNumber } from "@/lib/utils";
import { ETAPA, nomeDaPlataforma } from "./rotulos";

/**
 * O funil, em forma de funil: cada etapa é uma faixa que estreita até a
 * largura da seguinte, e ao lado dela os três números que respondem "onde a
 * página perde gente" —
 *
 *   Acessaram   quantas pessoas chegaram à etapa;
 *   Pararam     quantas chegaram e não foram adiante;
 *   Fecharam    das que pararam, quantas saíram da página ali.
 *
 * "Fecharam" vem do evento de saída (a página deixou de estar na tela). O
 * navegador não separa fechar a aba de voltar ao aplicativo ou trocar de aba,
 * então o número junta os três. A diferença para "Pararam" é quem parou sem
 * saída registrada: página ainda aberta, ou visita anterior a esse registro.
 *
 * ## Movimento
 *
 * A animação conta a mesma história do dado: as pessoas ENTRAM por cima e
 * descem. Quando o funil entra na tela, as faixas se formam de cima para baixo
 * (90 ms entre uma e outra, a escada inteira em menos de meio segundo), cada
 * uma crescendo a partir do topo; os números contam junto; os links da última
 * etapa chegam por último, deslizando da esquerda. Depois, um brilho lento
 * desce pelas faixas — a camada ambiente, que diz "isto é um fluxo" sem pedir
 * atenção. Passar o mouse (ou focar) numa etapa a acende e apaga as outras.
 *
 * Só `transform`, `opacity` e `filter`. Com movimento reduzido não há brilho,
 * e o `MotionConfig` da casca troca as entradas por fade.
 */

const FAIXA: Variants = {
  initial: { opacity: 0, scaleY: 0.4, y: -10 },
  animate: (i: number) => ({ opacity: 1, scaleY: 1, y: 0, transition: { duration: 0.45, ease: SUAVE, delay: 0.05 + i * 0.09 } }),
};

const NUMEROS: Variants = {
  initial: { opacity: 0, x: 8 },
  animate: (i: number) => ({ opacity: 1, x: 0, transition: { duration: 0.3, ease: SUAVE, delay: 0.18 + i * 0.09 } }),
};

const LINK: Variants = {
  initial: { opacity: 0, x: -10 },
  animate: (i: number) => ({ opacity: 1, x: 0, transition: { duration: 0.28, ease: SUAVE, delay: 0.5 + Math.min(i, 6) * 0.05 } }),
};

export function Funil({
  etapas,
  titulo,
  linkAtivo,
  onLink,
}: {
  etapas: FunnelStage[];
  titulo: (linkId: string) => string;
  linkAtivo: string;
  onLink: (linkId: string) => void;
}) {
  const reduzido = useReducedMotion();
  const [emFoco, setEmFoco] = useState<number | null>(null);

  const total = etapas[0]?.visitors ?? 0;
  /** Quem viu os links: a base certa para "de cada 10 que viram, quantos
   *  foram a este link". */
  const viram = etapas.find((e) => e.stage === "view")?.visitors ?? 0;
  /** Largura da faixa, em % da primeira. O piso mantém a ponta do funil
   *  visível quando sobra pouca gente. */
  const largura = (visitantes: number) => (total ? Math.max((visitantes / total) * 100, 10) : 10);
  /** A etapa que mais perde gente ganha o selo. Empate fica com a primeira. */
  const maiorPerda = etapas.reduce((pior, e, i) => (e.stopped > (etapas[pior]?.stopped ?? 0) ? i : pior), -1);

  return (
    <motion.section
      data-tour="funil"
      initial="initial"
      whileInView="animate"
      viewport={{ once: true, amount: 0.15 }}
      className="bg-bee-surface rounded-xl p-6 border border-bee-line"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-1">
        <h2 className="text-xl text-white font-semibold">Até onde as pessoas foram</h2>
        <span className="text-xs text-bee-muted">visitantes únicos, por dia</span>
      </div>
      <p className="text-xs text-bee-muted mb-6 max-w-2xl">
        Em cada etapa: quantas pessoas chegaram, quantas pararam nela e, dessas, quantas fecharam ou
        saíram da página ali.
      </p>

      {/* Cabeçalho das colunas, só onde elas ficam lado a lado. */}
      <div className="hidden md:grid grid-cols-[minmax(0,1fr)_repeat(3,104px)] gap-x-3 mb-2 text-[11px] uppercase tracking-[0.08em] text-bee-muted">
        <span />
        <span className="text-right">Acessaram</span>
        <span className="text-right">Pararam aqui</span>
        <span className="text-right">Fecharam a página</span>
      </div>

      <ol onMouseLeave={() => setEmFoco(null)}>
        {etapas.map((etapa, i) => {
          const ultima = i === etapas.length - 1;
          const topo = largura(etapa.visitors);
          const base = ultima ? topo : largura(etapas[i + 1].visitors);
          // Do cinza ao rosa: a cor acompanha o caminho até o clique.
          const forca = etapas.length > 1 ? i / (etapas.length - 1) : 1;
          const semSaida = etapa.stopped - etapa.left;
          const apagada = emFoco !== null && emFoco !== i;
          const recorte = `polygon(${50 - topo / 2}% 0, ${50 + topo / 2}% 0, ${50 + base / 2}% 100%, ${50 - base / 2}% 100%)`;
          return (
            <li
              key={etapa.stage}
              tabIndex={0}
              onMouseEnter={() => setEmFoco(i)}
              onFocus={() => setEmFoco(i)}
              onBlur={() => setEmFoco(null)}
              aria-label={`${ETAPA[etapa.stage].fez}: ${etapa.visitors} acessaram${ultima ? "" : `, ${etapa.stopped} pararam aqui, ${etapa.left} fecharam a página`}`}
              className={cn(
                "rounded-lg outline-none transition-opacity duration-200 focus-visible:ring-2 focus-visible:ring-bee-pink/60",
                "md:grid md:grid-cols-[minmax(0,1fr)_repeat(3,104px)] md:gap-x-3 md:items-center",
                apagada && "opacity-45",
              )}
            >
              <div className="relative h-[68px]">
                <motion.div
                  className="absolute inset-0 origin-top overflow-hidden"
                  variants={FAIXA}
                  custom={i}
                  style={{
                    clipPath: recorte,
                    background: `linear-gradient(180deg, rgba(255, 60, 110, ${0.22 + forca * 0.6}), rgba(255, 60, 110, ${0.16 + forca * 0.6}))`,
                    filter: emFoco === i ? "brightness(1.25)" : "brightness(1)",
                    transition: "filter 150ms",
                  }}
                >
                  {/* Camada ambiente: um brilho que desce, defasado por etapa,
                      para o olho ler as faixas como um fluxo só. */}
                  {!reduzido && (
                    <motion.div
                      aria-hidden
                      className="absolute inset-x-0 h-full"
                      style={{ background: "linear-gradient(180deg, transparent, rgba(255,255,255,0.14), transparent)" }}
                      initial={{ y: "-100%" }}
                      animate={{ y: "100%" }}
                      transition={{ duration: 2.4, ease: "easeInOut", repeat: Infinity, repeatDelay: 2.6, delay: 1.2 + i * 0.35 }}
                    />
                  )}
                </motion.div>
                {/* O texto fica fora do recorte: numa faixa estreita ele passa
                    das bordas e continua legível sobre o fundo. */}
                <motion.div
                  variants={NUMEROS}
                  custom={i}
                  className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none"
                >
                  <span className="text-sm text-white font-medium [text-shadow:0_1px_2px_rgba(0,0,0,0.6)]">{ETAPA[etapa.stage].fez}</span>
                  <span className="text-xs text-white/80 tabular-nums [text-shadow:0_1px_2px_rgba(0,0,0,0.6)]">
                    <NumeroAnimado valor={etapa.visitors} formatar={(n) => formatNumber(Math.round(n))} /> ·{" "}
                    {total ? Math.round((etapa.visitors / total) * 100) : 0}%
                  </span>
                </motion.div>
              </div>

              {/* Os três números. No celular, em linha, embaixo da faixa. */}
              <motion.div variants={NUMEROS} custom={i} className="grid grid-cols-3 gap-2 py-2 md:contents">
                <Numero rotulo="Acessaram" valor={etapa.visitors} />
                <Numero
                  rotulo="Pararam"
                  valor={ultima ? null : etapa.stopped}
                  nota={!ultima && etapa.visitors > 0 && etapa.stopped > 0 ? `${Math.round((etapa.stopped / etapa.visitors) * 100)}% da etapa` : undefined}
                  alerta={!ultima && etapa.stopped > 0}
                  selo={i === maiorPerda ? "maior perda" : undefined}
                />
                <Numero
                  rotulo="Fecharam"
                  valor={ultima ? null : etapa.left}
                  nota={!ultima && semSaida > 0 ? `${formatNumber(semSaida)} sem saída registrada` : undefined}
                />
              </motion.div>

              {/* A última etapa, link a link: em QUAL link clicaram. Tocar numa
                  linha recorta o relatório por ele. */}
              {etapa.links && etapa.links.length > 0 && (
                <ul data-tour="funil-links" className="md:col-span-4 mt-3 pl-4 border-l border-white/10 space-y-1">
                  {etapa.links.map((link, n) => {
                    const dosQueViram = viram ? Math.round((link.visitors / viram) * 100) : 0;
                    return (
                      <motion.li key={link.linkId} variants={LINK} custom={n}>
                        <button
                          type="button"
                          onClick={() => onLink(link.linkId)}
                          title={linkAtivo === link.linkId ? "Tirar o filtro deste link" : "Filtrar por este link"}
                          aria-pressed={linkAtivo === link.linkId}
                          className={cn(
                            "relative w-full overflow-hidden flex items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-white/[0.04] active:scale-[0.99] focus-visible:outline focus-visible:outline-2 focus-visible:outline-bee-pink",
                            linkAtivo === link.linkId && "bg-bee-pink/10",
                          )}
                        >
                          {/* A fatia deste link entre quem viu os links, como
                              barra de fundo que cresce da esquerda. */}
                          <motion.span
                            aria-hidden
                            className="absolute inset-y-0 left-0 origin-left bg-bee-pink/[0.07]"
                            style={{ width: `${Math.min(dosQueViram, 100)}%` }}
                            variants={{ initial: { scaleX: 0 }, animate: { scaleX: 1, transition: { duration: 0.6, ease: SUAVE, delay: 0.6 + Math.min(n, 6) * 0.05 } } }}
                          />
                          <IconeDePlataforma plataforma={link.channel ?? ""} className="relative w-4 h-4 text-white/50 flex-shrink-0" />
                          <span className="relative min-w-0 flex-1">
                            <span className="block text-sm text-white truncate">{titulo(link.linkId)}</span>
                            <span className="block text-xs text-bee-muted">
                              {[nomeDaPlataforma(link.channel), `${formatNumber(link.clicks)} ${link.clicks === 1 ? "toque" : "toques"}`]
                                .filter(Boolean)
                                .join(" · ")}
                            </span>
                          </span>
                          <span className="relative text-sm text-white tabular-nums whitespace-nowrap text-right flex-shrink-0">
                            {formatNumber(link.visitors)} {link.visitors === 1 ? "pessoa" : "pessoas"}
                            <span className="block sm:inline sm:ml-2 text-xs text-bee-muted">{dosQueViram}% de quem viu</span>
                          </span>
                        </button>
                      </motion.li>
                    );
                  })}
                </ul>
              )}
            </li>
          );
        })}
      </ol>

      <p className="mt-5 text-xs text-bee-muted max-w-2xl">
        "Fecharam a página" junta fechar a aba, voltar ao aplicativo e trocar de aba: o navegador não diz qual
        foi. Só existe nas visitas a partir de 22/11/2026.
      </p>
    </motion.section>
  );
}

/** Um número do funil. No computador o rótulo está no cabeçalho da coluna.
 *  `null` é "não se aplica" (a última etapa não tem quem parou). */
function Numero({ rotulo, valor, nota, alerta, selo }: { rotulo: string; valor: number | null; nota?: string; alerta?: boolean; selo?: string }) {
  return (
    <div className="md:text-right">
      <div className="md:hidden text-[10px] uppercase tracking-[0.06em] text-bee-muted">{rotulo}</div>
      <div className={cn("text-lg font-semibold tabular-nums", alerta ? "text-amber-200" : "text-white")}>
        {valor === null ? "—" : <NumeroAnimado valor={valor} formatar={(n) => formatNumber(Math.round(n))} />}
      </div>
      {selo && (
        <div className="inline-flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.06em] text-amber-300">
          <span className="relative flex w-1.5 h-1.5">
            <span className="absolute inline-flex h-full w-full rounded-full bg-amber-300 opacity-60 motion-safe:animate-ping" />
            <span className="relative inline-flex w-1.5 h-1.5 rounded-full bg-amber-300" />
          </span>
          {selo}
        </div>
      )}
      {nota && <div className="text-[11px] leading-tight text-bee-muted">{nota}</div>}
    </div>
  );
}
