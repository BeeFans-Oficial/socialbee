"use client";

import React from "react";
import { motion, useReducedMotion, type Variants } from "framer-motion";

import { SUAVE } from "@/lib/movimento";

/**
 * A página inicial se constrói enquanto a pessoa desce: cada bloco entra
 * quando chega à tela, uma vez só, de baixo para cima e desfocado para
 * nítido. Listas entram em escada (60 ms entre itens), para o olho ler na
 * ordem. Com "reduzir movimento" no sistema, tudo já está no lugar.
 */

const BLOCO: Variants = {
  escondido: { opacity: 0, y: 28, filter: "blur(6px)" },
  visivel: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.6, ease: SUAVE } },
};

const LISTA: Variants = {
  escondido: {},
  visivel: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
};

export function Revelar({
  children,
  className,
  atraso = 0,
  quanto = 0.35,
  como = "div",
}: {
  children: React.ReactNode;
  className?: string;
  /** Segundos a mais antes de entrar; para escalonar vizinhos à mão. */
  atraso?: number;
  /** Fração do bloco que precisa estar na tela para entrar. */
  quanto?: number;
  como?: "div" | "section" | "li" | "p" | "h1" | "h2";
}) {
  const reduzir = useReducedMotion();
  const Tag = motion[como];
  if (reduzir) {
    const Plano = como;
    return <Plano className={className}>{children}</Plano>;
  }
  return (
    <Tag
      className={className}
      variants={BLOCO}
      initial="escondido"
      whileInView="visivel"
      viewport={{ once: true, amount: quanto, margin: "0px 0px -8% 0px" }}
      transition={{ delay: atraso }}
    >
      {children}
    </Tag>
  );
}

/** Um grupo cujos filhos `RevelarItem` entram em escada. */
export function RevelarLista({ children, className, quanto = 0.25, como = "div" }: { children: React.ReactNode; className?: string; quanto?: number; como?: "div" | "ul" | "ol" }) {
  const reduzir = useReducedMotion();
  const Tag = motion[como];
  if (reduzir) {
    const Plano = como;
    return <Plano className={className}>{children}</Plano>;
  }
  return (
    <Tag className={className} variants={LISTA} initial="escondido" whileInView="visivel" viewport={{ once: true, amount: quanto, margin: "0px 0px -8% 0px" }}>
      {children}
    </Tag>
  );
}

export function RevelarItem({ children, className, como = "div" }: { children: React.ReactNode; className?: string; como?: "div" | "li" }) {
  const Tag = motion[como];
  return (
    <Tag className={className} variants={BLOCO}>
      {children}
    </Tag>
  );
}
