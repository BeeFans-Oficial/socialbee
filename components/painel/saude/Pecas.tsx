"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, ChevronRight, CircleHelp, ShieldAlert } from "lucide-react";

import { api } from "@/lib/api/client";
import type { ApiItemDaRevisao, ApiRevisao, EstadoDaRevisao } from "@/lib/api/types";
import { cn } from "@/lib/utils";

/**
 * As peças da saúde da página que aparecem fora da tela Saúde
 * (`app/(painel)/saude/[id]/page.tsx`): a pastilha do cartão, a linha do
 * editor e o mini-fluxo das quatro camadas.
 *
 * Toda peça é clicável onde aparece: leva à saúde daquela página, que é
 * onde a checagem inteira — data, hora, veredito, camadas — vive.
 */

/** A última checagem da página. `undefined` enquanto carrega, `null` se nunca houve. */
export function useUltimaChecagem(profileId: string): { revisao: ApiRevisao | null | undefined; setRevisao: (r: ApiRevisao | null) => void } {
  const [revisao, setRevisao] = useState<ApiRevisao | null | undefined>(undefined);
  useEffect(() => {
    let cancelado = false;
    api.ultimaChecagem(profileId)
      .then((r) => !cancelado && setRevisao(r.revisao))
      .catch(() => !cancelado && setRevisao(null));
    return () => {
      cancelado = true;
    };
  }, [profileId]);
  return { revisao, setRevisao };
}

/** No editor da página: estado, quando, e o caminho para a saúde. */
export function LinhaDeSaude({ profileId }: { profileId: string }) {
  const { revisao } = useUltimaChecagem(profileId);
  return (
    <Link
      href={`/saude/${profileId}`}
      className="group inline-flex items-center gap-2 max-w-full text-sm text-white hover:text-bee-pink transition-colors"
      title="Ver a saúde desta página"
    >
      <Selo revisao={revisao} />
      <span className="truncate">
        {revisao === undefined ? "…" : revisao ? `Saúde ${SAUDE[revisao.veredito]}` : "Sem checagem"}
        {revisao && <span className="text-bee-muted"> · {quando(revisao.ranAt)}</span>}
      </span>
      <ChevronRight className="w-4 h-4 text-bee-dim group-hover:text-bee-pink flex-shrink-0" aria-hidden />
    </Link>
  );
}

/**
 * A pastilha do cartão da página: cor cheia, veredito em palavras e quando.
 * Substitui o ícone de 28 px que ninguém via. Sem checagem, vira o convite
 * "Checar agora", que já leva para a tela certa.
 */
export function Pastilha({ profileId, revisao }: { profileId: string; revisao: ApiRevisao | null | undefined }) {
  if (revisao === undefined) {
    return <span className="inline-flex h-8 w-28 rounded-full bg-white/[0.04] animate-pulse" aria-label="Carregando a saúde" />;
  }
  if (revisao === null) {
    return (
      <Link
        href={`/saude/${profileId}`}
        className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full border border-dashed border-white/20 text-xs text-white/70 hover:text-white hover:border-white/40 transition-colors"
      >
        <CircleHelp className="w-3.5 h-3.5" aria-hidden />
        Sem checagem
        <span className="text-bee-pink font-semibold">· Checar agora</span>
      </Link>
    );
  }
  const Icone = ICONE_DO_ESTADO[revisao.veredito];
  const ruins = revisao.itens.filter((i) => i.estado === "vermelho").length;
  return (
    <Link
      href={`/saude/${profileId}`}
      title="Ver a saúde desta página"
      className={cn(
        "inline-flex items-center gap-1.5 h-8 px-3 rounded-full border text-xs font-semibold transition-colors hover:brightness-110",
        COR_DA_PASTILHA[revisao.veredito],
      )}
    >
      <Icone className="w-3.5 h-3.5" aria-hidden />
      Saúde {SAUDE[revisao.veredito]}
      <span className="font-normal opacity-80">
        · {revisao.veredito === "vermelho" && ruins > 0 ? `${ruins} ${ruins === 1 ? "item" : "itens"}` : quando(revisao.ranAt)}
      </span>
    </Link>
  );
}

export function Selo({ revisao, grande }: { revisao: ApiRevisao | null | undefined; grande?: boolean }) {
  const estado: EstadoDaRevisao | "nenhuma" = revisao ? revisao.veredito : "nenhuma";
  const Icone = estado === "nenhuma" ? CircleHelp : ICONE_DO_ESTADO[estado];
  return (
    <span
      title={revisao ? `Saúde ${SAUDE[revisao.veredito]} · ${quando(revisao.ranAt)}` : "Ainda sem checagem"}
      className={cn(
        "inline-flex items-center justify-center rounded-full border flex-shrink-0 transition-colors",
        grande ? "w-10 h-10" : "w-7 h-7",
        estado === "nenhuma" ? "border-white/10 text-bee-dim hover:border-white/25" : COR_DO_SELO[estado],
      )}
    >
      <Icone className={grande ? "w-5 h-5" : "w-3.5 h-3.5"} aria-hidden />
      <span className="sr-only">{revisao ? NOME_DO_VEREDITO[revisao.veredito] : "sem checagem"}</span>
    </span>
  );
}

/** As quatro camadas numa linha: 1 2 3 4, cada uma na cor do estado. */
export function Etapas({ itens }: { itens: ApiItemDaRevisao[] }) {
  return (
    <ol className="flex items-center gap-1 flex-shrink-0" aria-label="Camadas">
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

/** Uma frase sobre a checagem, para listas e cabeçalhos. */
export function resumoDaChecagem(r: ApiRevisao): string {
  if (r.veredito === "verde") return "Nada. Quatro camadas ok.";
  const ruins = r.itens.filter((i) => i.estado === "vermelho");
  if (r.veredito === "vermelho") return ruins.map((i) => i.titulo).join(" · ") || "Um item com o que já derrubou contas.";
  const alerta = r.itens.find((i) => i.estado === "amarelo");
  return alerta?.titulo ?? "Responde, mas com sinal de alerta.";
}

/** A primeira ação a tomar, se houver. */
export function acaoDaChecagem(r: ApiRevisao): string | null {
  return r.itens.find((i) => i.estado === "vermelho")?.acao ?? r.itens.find((i) => i.estado === "amarelo")?.acao ?? null;
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
/** Pastilha: fundo mais cheio que o selo, para ler de longe. */
const COR_DA_PASTILHA: Record<ApiRevisao["veredito"], string> = {
  verde: "border-emerald-400/50 bg-emerald-500/20 text-emerald-200",
  amarelo: "border-amber-400/50 bg-amber-500/20 text-amber-200",
  vermelho: "border-red-400/60 bg-red-500/25 text-red-100",
};
export const NOME_DO_VEREDITO = { verde: "Verde", amarelo: "Amarelo", vermelho: "Vermelho" } as const;
/** Concordando com "saúde": saúde verde, amarela, vermelha. */
const SAUDE = { verde: "verde", amarelo: "amarela", vermelho: "vermelha" } as const;

export function quando(iso: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  if (diff < 60_000) return "agora";
  if (diff < 3_600_000) return `há ${Math.round(diff / 60_000)} min`;
  if (diff < 86_400_000) return `há ${Math.round(diff / 3_600_000)} h`;
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}
