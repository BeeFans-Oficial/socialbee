"use client";

import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, CheckCircle2, CircleHelp, ShieldAlert } from "lucide-react";

import { DURACAO, MOLA, SAIDA, SUAVE } from "@/lib/movimento";
import { cn } from "@/lib/utils";

/**
 * O selo de saúde da página, com o movimento que diz o que está
 * acontecendo:
 *
 *   - **revisando**: um anel tracejado gira (o único lugar onde linear é
 *     certo: é um spinner) e o selo pulsa de leve; a pessoa vê que há
 *     trabalho em curso sem barra de progresso falsa.
 *   - **resultado**: o ícone novo entra com mola (leve ultrapassagem, como
 *     um carimbo) e um anel na cor do veredito se expande uma vez e some —
 *     o "pop" de sucesso ou alerta, 400 ms, sem exagero.
 *   - **nenhuma**: cinza, parado.
 *
 * Arquétipo do painel (Corporate): curva padrão, 200–450 ms, nada salta
 * mais de 1/3 do próprio tamanho. Com "reduzir movimento" no sistema, o
 * `MotionConfig` da casca troca tudo por fade.
 */
export type EstadoDeSaude = "nenhuma" | "revisando" | "verde" | "amarelo" | "vermelho";

export function SeloDeSaude({ estado, tamanho = 56, className }: { estado: EstadoDeSaude; tamanho?: number; className?: string }) {
  const Icone = ICONE[estado];
  const cor = COR[estado];
  return (
    <span className={cn("relative inline-flex items-center justify-center flex-shrink-0", className)} style={{ width: tamanho, height: tamanho }} role="img" aria-label={ROTULO[estado]}>
      {/* Anel tracejado que gira enquanto revisa. */}
      <AnimatePresence>
        {estado === "revisando" && (
          <motion.span
            key="anel"
            className="absolute inset-0 rounded-full border-2 border-dashed border-white/35"
            initial={{ opacity: 0, rotate: 0 }}
            animate={{ opacity: 1, rotate: 360, transition: { opacity: { duration: DURACAO.base }, rotate: { duration: 2.4, ease: "linear", repeat: Infinity } } }}
            exit={{ opacity: 0, transition: { duration: DURACAO.rapida, ease: SAIDA } }}
            aria-hidden
          />
        )}
      </AnimatePresence>

      {/* Onda que se expande uma vez quando chega o resultado. */}
      <AnimatePresence>
        {(estado === "verde" || estado === "amarelo" || estado === "vermelho") && (
          <motion.span
            key={`onda-${estado}`}
            className={cn("absolute inset-0 rounded-full border-2", cor.anel)}
            initial={{ scale: 0.9, opacity: 0.7 }}
            animate={{ scale: 1.7, opacity: 0, transition: { duration: 0.55, ease: SUAVE } }}
            aria-hidden
          />
        )}
      </AnimatePresence>

      {/* O disco, pulsando de leve só enquanto revisa. */}
      <motion.span
        className={cn("absolute inset-0 rounded-full border", cor.disco)}
        animate={estado === "revisando" ? { scale: [1, 1.04, 1], transition: { duration: 1.6, ease: "easeInOut", repeat: Infinity } } : { scale: 1 }}
        aria-hidden
      />

      {/* O ícone: troca com carimbo (mola), o anterior sai rápido. */}
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={estado}
          className={cn("relative", cor.icone)}
          initial={{ scale: 0.4, opacity: 0 }}
          animate={{ scale: 1, opacity: 1, transition: { ...MOLA, opacity: { duration: DURACAO.rapida } } }}
          exit={{ scale: 0.6, opacity: 0, transition: { duration: DURACAO.rapida, ease: SAIDA } }}
        >
          <Icone style={{ width: tamanho * 0.46, height: tamanho * 0.46 }} aria-hidden />
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

const ICONE = { nenhuma: CircleHelp, revisando: CircleHelp, verde: CheckCircle2, amarelo: AlertTriangle, vermelho: ShieldAlert } as const;
const ROTULO: Record<EstadoDeSaude, string> = {
  nenhuma: "Ainda sem checagem",
  revisando: "Checando",
  verde: "Verde",
  amarelo: "Amarelo",
  vermelho: "Vermelho",
};
const COR: Record<EstadoDeSaude, { disco: string; icone: string; anel: string }> = {
  nenhuma: { disco: "border-white/10 bg-white/[0.03]", icone: "text-bee-dim", anel: "border-white/20" },
  revisando: { disco: "border-white/15 bg-white/[0.04]", icone: "text-white/60", anel: "border-white/20" },
  verde: { disco: "border-emerald-400/40 bg-emerald-500/10", icone: "text-emerald-400", anel: "border-emerald-400" },
  amarelo: { disco: "border-amber-400/40 bg-amber-500/10", icone: "text-amber-400", anel: "border-amber-400" },
  vermelho: { disco: "border-red-400/40 bg-red-500/10", icone: "text-red-400", anel: "border-red-400" },
};
