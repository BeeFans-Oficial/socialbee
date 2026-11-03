import React from "react";

import { cn } from "@/lib/utils";

/**
 * Moldura de toda tela de lista do painel.
 *
 * Cada tela escolhia a própria largura (3xl, 6xl, 7xl) e as próprias margens
 * (p-8, px-4 py-10...), e o conteúdo pulava de lugar a cada clique na barra
 * lateral. Aqui há duas larguras, e só duas: a normal, para grades e
 * relatório, e a estreita, para listas de linhas que ficariam esticadas.
 */
export function Tela({
  largura = "normal",
  className,
  children,
}: {
  largura?: "normal" | "estreita";
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 lg:py-8",
        largura === "estreita" ? "max-w-3xl" : "max-w-6xl",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Título, uma linha de contexto e as ações da tela, à direita. */
export function CabecalhoDeTela({
  titulo,
  descricao,
  selo,
  acoes,
}: {
  titulo: string;
  descricao?: React.ReactNode;
  /** Algo colado ao título (um selo PRO, por exemplo). */
  selo?: React.ReactNode;
  acoes?: React.ReactNode;
}) {
  return (
    <div className="mb-6 lg:mb-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="flex items-center gap-2 text-2xl lg:text-[28px] font-semibold text-white leading-tight">
          {titulo}
          {selo}
        </h1>
        {descricao && <p className="text-sm text-bee-muted mt-1">{descricao}</p>}
      </div>
      {acoes && <div className="flex items-center gap-2 flex-shrink-0">{acoes}</div>}
    </div>
  );
}
