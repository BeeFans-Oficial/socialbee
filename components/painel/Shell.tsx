"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { MotionConfig, motion } from "framer-motion";

import { BarraDoTopo } from "@/components/painel/BarraDoTopo";
import { BarraInferior, Sidebar, ehRotaDeEditor } from "@/components/painel/Navegacao";
import { ENTRADA_DA_TELA, SUAVE } from "@/lib/movimento";
import { cn } from "@/lib/utils";

/** Largura da barra lateral aberta e encolhida (em px). As classes abaixo
 *  precisam bater com as da `Sidebar`. */
export const LARGURA_DA_SIDEBAR = 240;
export const LARGURA_DO_TRILHO = 72;

/**
 * A casca do painel.
 *
 * Computador (≥1024px): barra lateral fixa à esquerda, barra do topo
 * grudada, conteúdo ao lado. Nas rotas de editor a barra lateral vira um
 * trilho de ícones, e o conteúdo ganha a largura para a prévia e o painel.
 *
 * Celular: barra do topo compacta, conteúdo, e a barra inferior fixa com as
 * quatro entradas principais. O conteúdo reserva a altura dela embaixo
 * (`pb-*`), senão o fim de cada lista ficaria escondido atrás.
 *
 * Movimento: o `MotionConfig` fixa a curva padrão de `lib/movimento.ts` para
 * todo `motion.*` da casca para baixo e, com `reducedMotion="user"`, troca
 * transformações por fade para quem pediu menos movimento no sistema. A
 * troca de tela é uma entrada só (o conteúdo novo sobe 12 px e aparece): no
 * App Router a tela antiga já foi embora quando a nova monta, e fingir uma
 * saída seguraria a navegação.
 */
export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const editor = ehRotaDeEditor(pathname);

  return (
    <MotionConfig reducedMotion="user" transition={{ ease: SUAVE }}>
      <div className="min-h-dvh bg-bee-bg">
        <Sidebar compacta={editor} />
        <div
          className={cn(
            "flex min-h-dvh flex-col transition-[padding] duration-200 ease-[cubic-bezier(0.2,0,0,1)]",
            editor ? "lg:pl-[72px]" : "lg:pl-[240px]",
          )}
        >
          <BarraDoTopo />
          <main className="flex-1 pb-[calc(4rem+env(safe-area-inset-bottom))] lg:pb-0">
            {/* `key` pela rota: cada tela nova entra animada. */}
            <motion.div
              key={pathname}
              initial={ENTRADA_DA_TELA.initial}
              animate={ENTRADA_DA_TELA.animate}
              transition={ENTRADA_DA_TELA.transition}
              className="flex-1"
            >
              {children}
            </motion.div>
          </main>
        </div>
        <BarraInferior />
      </div>
    </MotionConfig>
  );
}
