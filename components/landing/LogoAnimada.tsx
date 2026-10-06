"use client";

import { motion, useReducedMotion } from "framer-motion";

/**
 * A logo no topo da tela inicial, com entrada animada.
 *
 * Sequência: a logo surge desfocada e pequena e assenta no lugar; dois anéis
 * rosa se expandem uma vez a partir dela; depois ela fica flutuando devagar,
 * com um halo que respira atrás.
 *
 * Com "reduzir movimento" ligado no sistema, só a entrada acontece, sem a
 * flutuação nem os anéis — movimento contínuo é justamente o que essa
 * preferência pede para evitar.
 */

/** `public/logo-bee.png` é 1536x1024 com a gota no meio e muita margem
 *  transparente. Recortado em quadrado e ampliado, a gota ocupa a caixa. */
const AMPLIACAO = 1.6;

export function LogoAnimada({ className }: { className?: string }) {
  const reduzir = useReducedMotion();

  return (
    <div className={className}>
      <div className="relative mx-auto w-[150px] h-[150px] sm:w-[190px] sm:h-[190px]">
        {/* Halo que respira atrás da logo. */}
        <motion.div
          aria-hidden
          className="absolute inset-[-30%] rounded-full"
          style={{
            background: "radial-gradient(circle, rgba(255,60,110,0.35), rgba(255,60,110,0) 65%)",
          }}
          initial={{ opacity: 0, scale: 0.6 }}
          animate={
            reduzir
              ? { opacity: 0.8, scale: 1 }
              : { opacity: [0, 0.9, 0.6, 0.9], scale: [0.6, 1.05, 1, 1.05] }
          }
          transition={
            reduzir
              ? { duration: 0.6 }
              : { duration: 6, times: [0, 0.15, 0.6, 1], repeat: Infinity, repeatType: "mirror" }
          }
        />

        {/* Dois anéis que se abrem uma vez, logo depois da entrada. */}
        {!reduzir &&
          [0, 0.25].map((atraso) => (
            <motion.span
              key={atraso}
              aria-hidden
              className="absolute inset-[12%] rounded-full border border-bee-pink/60"
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: [0, 0.7, 0], scale: [0.7, 1.9] }}
              transition={{ duration: 1.6, delay: 0.5 + atraso, ease: "easeOut" }}
            />
          ))}

        {/* A logo: entra, depois flutua. */}
        <motion.div
          className="relative w-full h-full"
          initial={{ opacity: 0, scale: 0.55, y: 24, filter: "blur(14px)" }}
          animate={{ opacity: 1, scale: 1, y: 0, filter: "blur(0px)" }}
          transition={{ type: "spring", stiffness: 90, damping: 14, mass: 0.9 }}
        >
          <motion.div
            className="w-full h-full"
            animate={reduzir ? undefined : { y: [0, -10, 0] }}
            transition={{ duration: 5, delay: 1.2, repeat: Infinity, ease: "easeInOut" }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- PNG estático da marca */}
            <img
              src="/logo-bee.png?v=2"
              alt="BeeSocial"
              className="w-full h-full object-cover drop-shadow-[0_0_24px_rgba(255,60,110,0.45)]"
              style={{ transform: `scale(${AMPLIACAO})` }}
              fetchPriority="high"
            />
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}
