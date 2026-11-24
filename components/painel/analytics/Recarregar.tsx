"use client";

import { RefreshCw } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Busca o relatório de novo, sem recarregar a página.
 *
 * Ao lado, a hora em que os números da tela chegaram: é o que diz se vale a
 * pena apertar. O ícone gira enquanto a busca corre (parado para quem pede
 * menos movimento) e o botão não aceita um segundo toque nesse meio tempo.
 */
export function Recarregar({
  carregando,
  atualizadoEm,
  onRecarregar,
}: {
  carregando: boolean;
  atualizadoEm: Date | null;
  onRecarregar: () => void;
}) {
  const hora = atualizadoEm?.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  return (
    <div data-tour="recarregar" className="flex items-center gap-3">
      {hora && (
        <span className="text-xs text-bee-muted tabular-nums" aria-live="polite">
          {carregando ? "atualizando…" : `atualizado às ${hora}`}
        </span>
      )}
      <button
        type="button"
        onClick={onRecarregar}
        disabled={carregando}
        aria-label="Atualizar os dados do relatório"
        className={cn(
          "inline-flex h-9 items-center gap-2 rounded-lg border border-bee-line bg-bee-surface px-3 text-xs font-medium text-white",
          "transition-colors hover:bg-white/[0.06] active:scale-95 disabled:opacity-60 disabled:pointer-events-none",
          "focus-visible:outline focus-visible:outline-2 focus-visible:outline-bee-pink",
        )}
      >
        <RefreshCw className={cn("h-3.5 w-3.5", carregando && "animate-spin motion-reduce:animate-none")} aria-hidden />
        Atualizar
      </button>
    </div>
  );
}
