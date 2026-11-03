import type { Transition, Variants } from "framer-motion";

/**
 * Identidade de movimento do painel — os tokens que TODA animação usa.
 *
 * Uma curva para quase tudo, três durações, um jeito de entrar. É o que faz
 * duas telas animadas por pessoas diferentes parecerem o mesmo produto. A
 * personalidade é a "corporativa" da skill de motion design (200/300/450 ms,
 * sem sobressalto), que é a certa para um painel que a criadora abre todo
 * dia: a animação explica o que mudou e sai da frente.
 *
 * Regras que estes tokens carregam:
 *   - entrada desacelera (`SUAVE`), saída acelera (`SAIDA`) e dura ~70% da entrada;
 *   - só `transform` e `opacity` — nada de animar altura, largura ou posição
 *     no fluxo, que recalculam o layout a cada quadro;
 *   - listas entram em escada de 40–50 ms por item, e a escada inteira cabe
 *     em meio segundo;
 *   - `prefers-reduced-motion` é respeitado pelo `MotionConfig` da casca
 *     (`reducedMotion="user"`), que troca transformações por fade.
 */

/** Durações, em segundos (o Motion usa segundos). */
export const DURACAO = {
  /** Resposta a toque, saída de menu. */
  rapida: 0.15,
  /** Menus, balões, trocas de estado. */
  base: 0.22,
  /** Cartões e seções chegando. */
  lenta: 0.32,
  /** Conteúdo de uma tela nova. */
  pagina: 0.3,
} as const;

/** Curva padrão (MD3 standard): desacelera ao chegar. */
export const SUAVE = [0.2, 0, 0, 1] as const;
/** Curva de saída (MD3 accelerate): acelera ao ir embora. */
export const SAIDA = [0.3, 0, 1, 1] as const;

/** Mola firme, sem quique: para indicador de aba e folhas. */
export const MOLA: Transition = { type: "spring", stiffness: 380, damping: 32 };
/** Mola do toque: responde em menos de 150 ms. */
export const MOLA_DO_TOQUE: Transition = { type: "spring", stiffness: 520, damping: 32 };

/** O conteúdo de uma tela chegando: sobe 12 px e aparece. */
export const ENTRADA_DA_TELA = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: DURACAO.pagina, ease: SUAVE },
} as const;

/** Menu, balão ou barra que surge perto de quem a abriu: cresce de 96% e
 *  desce 4 px. Some mais rápido do que chega. */
export const SURGIR: Variants = {
  initial: { opacity: 0, scale: 0.96, y: -4 },
  animate: { opacity: 1, scale: 1, y: 0, transition: { duration: DURACAO.base, ease: SUAVE } },
  exit: { opacity: 0, scale: 0.98, y: -2, transition: { duration: DURACAO.rapida, ease: SAIDA } },
};

/** O mesmo, para o que surge de BAIXO (barra de ajuste, folha). */
export const SURGIR_DE_BAIXO: Variants = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: DURACAO.lenta, ease: SUAVE } },
  exit: { opacity: 0, y: 12, transition: { duration: DURACAO.rapida, ease: SAIDA } },
};

/** Lista ou grade: o contêiner escalona os filhos. */
export const LISTA: Variants = {
  initial: {},
  animate: { transition: { staggerChildren: 0.045, delayChildren: 0.03 } },
};

/** Um item da lista: sobe 14 px e aparece. */
export const ITEM_DA_LISTA: Variants = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.24, ease: SUAVE } },
};

/** Um cartão de grade: cresce de 97% e aparece. */
export const CARTAO_DA_GRADE: Variants = {
  initial: { opacity: 0, scale: 0.97, y: 10 },
  animate: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.28, ease: SUAVE } },
};

/** Troca de conteúdo no mesmo lugar (esqueleto → dados): só fade. */
export const CROSSFADE: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: DURACAO.base, ease: SUAVE } },
  exit: { opacity: 0, transition: { duration: DURACAO.rapida, ease: SAIDA } },
};

/** Props de toque para um `motion.button`: encolhe 3% enquanto pressionado. */
export const TOQUE = {
  whileTap: { scale: 0.97 },
  transition: MOLA_DO_TOQUE,
} as const;
