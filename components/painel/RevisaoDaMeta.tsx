"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, ChevronRight, CircleHelp, ShieldAlert } from "lucide-react";

import { api } from "@/lib/api/client";
import type { ApiItemDaRevisao, ApiRevisao, EstadoDaRevisao } from "@/lib/api/types";
import { cn } from "@/lib/utils";

/**
 * As peças da revisão da Meta que aparecem fora da tela de histórico
 * (`app/(painel)/paginas/[id]/revisao/page.tsx`): o selo de estado, a linha
 * compacta do editor e o mini-fluxo das quatro etapas.
 *
 * O selo é clicável onde aparece: leva ao histórico, que é onde a rodada
 * inteira — data, hora, veredito, etapas — vive.
 */

/** A última revisão da página. `undefined` enquanto carrega, `null` se nunca houve. */
export function useUltimaRevisao(profileId: string): { revisao: ApiRevisao | null | undefined; setRevisao: (r: ApiRevisao | null) => void } {
  const [revisao, setRevisao] = useState<ApiRevisao | null | undefined>(undefined);
  useEffect(() => {
    let cancelado = false;
    api.ultimaRevisao(profileId)
      .then((r) => !cancelado && setRevisao(r.revisao))
      .catch(() => !cancelado && setRevisao(null));
    return () => {
      cancelado = true;
    };
  }, [profileId]);
  return { revisao, setRevisao };
}

/** No editor da página: estado, quando, e o caminho para o histórico. */
export function LinhaDaRevisao({ profileId }: { profileId: string }) {
  const { revisao } = useUltimaRevisao(profileId);
  return (
    <Link
      href={`/paginas/${profileId}/revisao`}
      className="group inline-flex items-center gap-2 max-w-full text-sm text-white hover:text-bee-pink transition-colors"
      title="Ver o histórico da revisão da Meta"
    >
      <Selo revisao={revisao} />
      <span className="truncate">
        {revisao === undefined ? "…" : revisao ? NOME_DO_VEREDITO[revisao.veredito] : "Não revisada"}
        {revisao && <span className="text-bee-muted"> · {quando(revisao.ranAt)}</span>}
      </span>
      <ChevronRight className="w-4 h-4 text-bee-dim group-hover:text-bee-pink flex-shrink-0" aria-hidden />
    </Link>
  );
}

export function Selo({ revisao, grande }: { revisao: ApiRevisao | null | undefined; grande?: boolean }) {
  const estado: EstadoDaRevisao | "nenhuma" = revisao ? revisao.veredito : "nenhuma";
  const Icone = estado === "nenhuma" ? CircleHelp : ICONE_DO_ESTADO[estado];
  return (
    <span
      title={revisao ? `Revisão da Meta: ${NOME_DO_VEREDITO[revisao.veredito]} · ${quando(revisao.ranAt)}` : "Revisão da Meta: ainda não revisada"}
      className={cn(
        "inline-flex items-center justify-center rounded-full border flex-shrink-0 transition-colors",
        grande ? "w-10 h-10" : "w-7 h-7",
        estado === "nenhuma" ? "border-white/10 text-bee-dim hover:border-white/25" : COR_DO_SELO[estado],
      )}
    >
      <Icone className={grande ? "w-5 h-5" : "w-3.5 h-3.5"} aria-hidden />
      <span className="sr-only">{revisao ? NOME_DO_VEREDITO[revisao.veredito] : "não revisada"}</span>
    </span>
  );
}

/** As quatro etapas numa linha: 1 2 3 4, cada uma na cor do estado. */
export function Etapas({ itens }: { itens: ApiItemDaRevisao[] }) {
  return (
    <ol className="flex items-center gap-1 flex-shrink-0" aria-label="Etapas">
      {itens.map((item, i) => {
        const Icone = ICONE_DO_ESTADO[item.estado];
        return (
          <li key={item.chave} className="flex items-center gap-1" title={`${i + 1}. ${item.titulo}`}>
            {i > 0 && <span className="w-2 h-px bg-white/15" aria-hidden />}
            <span className={cn("w-6 h-6 rounded-full border flex items-center justify-center", COR_DO_SELO[item.estado])}>
              <Icone className="w-3 h-3" aria-hidden />
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export const ICONE_DO_ESTADO = { verde: CheckCircle2, amarelo: AlertTriangle, vermelho: ShieldAlert, neutro: CircleHelp } as const;
export const COR_DO_TEXTO: Record<EstadoDaRevisao, string> = {
  verde: "text-emerald-400",
  amarelo: "text-amber-400",
  vermelho: "text-red-400",
  neutro: "text-bee-dim",
};
export const COR_DO_SELO: Record<EstadoDaRevisao, string> = {
  verde: "border-emerald-400/40 bg-emerald-500/10 text-emerald-400",
  amarelo: "border-amber-400/40 bg-amber-500/10 text-amber-400",
  vermelho: "border-red-400/40 bg-red-500/10 text-red-400",
  neutro: "border-white/10 text-bee-dim",
};
const NOME_DO_VEREDITO = { verde: "Verde", amarelo: "Amarelo", vermelho: "Vermelho" } as const;

function quando(iso: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  if (diff < 60_000) return "agora";
  if (diff < 3_600_000) return `há ${Math.round(diff / 60_000)} min`;
  if (diff < 86_400_000) return `há ${Math.round(diff / 3_600_000)} h`;
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}
