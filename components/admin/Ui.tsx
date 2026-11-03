"use client";

import React from "react";
import type { LucideIcon } from "lucide-react";

import { NumeroAnimado } from "@/components/painel/NumeroAnimado";
import { cn } from "@/lib/utils";

/**
 * Kit do painel admin: TEMA CLARO, de propósito.
 *
 * O painel da criadora é escuro e sempre será. O admin é branco para a
 * diferença saltar aos olhos antes de qualquer texto: ninguém libera plano
 * ou revoga sessão achando que está na própria conta. Os tokens `bee-*` são
 * escuros fixos, então o admin tem o próprio vocabulário aqui — cinzas do
 * Tailwind, âmbar de destaque, mesmo ritmo e mesmos raios do resto.
 */

export function TelaAdmin({
  largura = "normal",
  children,
}: {
  largura?: "normal" | "estreita";
  children: React.ReactNode;
}) {
  return (
    <div className={cn("mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 lg:py-8", largura === "estreita" ? "max-w-3xl" : "max-w-6xl")}>
      {children}
    </div>
  );
}

export function CabecalhoAdmin({
  titulo,
  descricao,
  selo,
  acoes,
  voltar,
}: {
  titulo: string;
  descricao?: React.ReactNode;
  selo?: React.ReactNode;
  acoes?: React.ReactNode;
  voltar?: React.ReactNode;
}) {
  return (
    <div className="mb-6 lg:mb-8">
      {voltar}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 text-2xl lg:text-[28px] font-semibold text-admin-ink leading-tight break-all">
            {titulo}
            {selo}
          </h1>
          {descricao && <p className="text-sm text-admin-muted mt-1">{descricao}</p>}
        </div>
        {acoes && <div className="flex items-center gap-2 flex-shrink-0">{acoes}</div>}
      </div>
    </div>
  );
}

export function CartaoAdmin({
  titulo,
  larga,
  className,
  children,
}: {
  titulo?: string;
  larga?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={cn("rounded-xl border border-admin-line bg-admin-card p-5", larga && "lg:col-span-2", className)}>
      {titulo && <h2 className="text-[11px] font-semibold tracking-[0.14em] uppercase text-admin-faint mb-3">{titulo}</h2>}
      {children}
    </section>
  );
}

export function StatAdmin({
  icone: Icone,
  rotulo,
  valor,
  nota,
}: {
  icone: LucideIcon;
  rotulo: string;
  valor: number;
  nota?: string;
}) {
  return (
    <div className="rounded-xl border border-admin-line bg-admin-card p-5">
      <div className="w-10 h-10 rounded-lg bg-admin-accent-soft text-admin-accent flex items-center justify-center mb-4">
        <Icone className="w-5 h-5" />
      </div>
      <div className="text-[32px] leading-none font-semibold text-admin-ink tabular-nums">
        <NumeroAnimado valor={valor} />
      </div>
      <div className="text-xs text-admin-muted mt-1">{rotulo}</div>
      {nota && <div className="inline-block mt-2 px-2 py-0.5 rounded bg-admin-hover text-[10px] font-medium text-admin-muted">{nota}</div>}
    </div>
  );
}

/** Bloco de esqueleto claro. O brilho do painel escuro some no branco. */
export function EsqueletoAdmin({ className }: { className?: string }) {
  return <div aria-hidden className={cn("rounded-lg bg-admin-line/80 animate-pulse", className)} />;
}

export function EsqueletoDeLinhasAdmin({ linhas = 6 }: { linhas?: number }) {
  return (
    <div className="rounded-xl border border-admin-line bg-admin-card divide-y divide-admin-line" role="status" aria-label="Carregando" data-esqueleto>
      {Array.from({ length: linhas }, (_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3.5">
          <EsqueletoAdmin className="h-3.5 w-1/3" />
          <EsqueletoAdmin className="h-3.5 w-1/5" />
          <EsqueletoAdmin className="h-3.5 w-16 ml-auto" />
        </div>
      ))}
    </div>
  );
}

export function BotaoAdmin({
  perigo,
  secundario,
  disabled,
  onClick,
  type = "button",
  className,
  children,
}: {
  perigo?: boolean;
  secundario?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  type?: "button" | "submit";
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex items-center justify-center gap-2 h-9 px-3.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-40",
        perigo
          ? "border border-admin-danger-line text-admin-danger hover:bg-admin-danger-soft"
          : secundario
            ? "border border-admin-line text-admin-ink/85 hover:bg-admin-hover"
            : "bg-admin-primary text-white hover:bg-admin-primary-hover",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function Paginacao({
  pagina,
  total,
  porPagina,
  onMudar,
}: {
  pagina: number;
  total: number;
  porPagina: number;
  onMudar: (p: number) => void;
}) {
  const totalDePaginas = Math.max(1, Math.ceil(total / porPagina));
  if (totalDePaginas <= 1) return null;
  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-admin-line text-xs text-admin-muted">
      <span>
        Página {pagina} de {totalDePaginas}
      </span>
      <span className="flex gap-2">
        <BotaoAdmin secundario disabled={pagina <= 1} onClick={() => onMudar(Math.max(1, pagina - 1))}>
          Anterior
        </BotaoAdmin>
        <BotaoAdmin secundario disabled={pagina >= totalDePaginas} onClick={() => onMudar(Math.min(totalDePaginas, pagina + 1))}>
          Próxima
        </BotaoAdmin>
      </span>
    </div>
  );
}

export function SeloAdmin() {
  return (
    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wider bg-admin-accent-soft text-admin-accent-ink border border-admin-accent-line">
      ADMIN
    </span>
  );
}

export function SeloProAdmin() {
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[9px] font-bold tracking-wider bg-admin-pro-soft text-admin-pro border border-admin-pro/25">
      PRO
    </span>
  );
}

export const CLASSE_DO_CAMPO_ADMIN =
  "w-full h-11 px-3 rounded-lg bg-admin-card border border-admin-line text-sm text-admin-ink placeholder:text-admin-faint focus:outline-none focus:border-admin-accent focus:ring-2 focus:ring-admin-accent/20";
