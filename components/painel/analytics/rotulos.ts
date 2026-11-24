import type { Etapa } from "@/lib/api/types";
import { PLATFORMS } from "@/lib/catalog";

/**
 * Como o relatório chama cada etapa do caminho de uma visitante: o que ela
 * fez, como dizer que parou ali, e o nome curto do LUGAR em que parou (para o
 * indicador "onde mais perde").
 */
export const ETAPA: Record<Etapa, { fez: string; parou: string; lugar: string }> = {
  arrival: { fez: "Abriu a página", parou: "Só abriu a página", lugar: "Ao abrir a página" },
  continue: { fez: "Tocou em continuar", parou: "Parou depois de continuar", lugar: "Depois de continuar" },
  age: { fez: "Passou pela barreira 18+", parou: "Parou depois da barreira 18+", lugar: "Depois da barreira 18+" },
  view: { fez: "Viu os links", parou: "Viu os links e não clicou", lugar: "Diante dos links" },
  click: { fez: "Clicou em um link", parou: "Clicou em um link", lugar: "No clique" },
};

/** `telegram` → `Telegram`. Canal fora do catálogo (ou "custom") fica sem nome. */
export function nomeDaPlataforma(canal?: string): string | undefined {
  if (!canal || canal === "custom") return undefined;
  return PLATFORMS.find((p) => p.id === canal)?.label;
}

/** `45 s`, `2 min 05 s`, `1 h 12 min`: o tempo como alguém diria em voz alta. */
export function duracao(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s} s`;
  const min = Math.floor(s / 60);
  if (min < 60) return s % 60 ? `${min} min ${String(s % 60).padStart(2, "0")} s` : `${min} min`;
  const h = Math.floor(min / 60);
  return min % 60 ? `${h} h ${min % 60} min` : `${h} h`;
}

export const NOME_DO_APARELHO: Record<string, string> = { mobile: "Celular", tablet: "Tablet", desktop: "Computador", unknown: "Não identificado" };

export const NOME_DO_APP: Record<string, string> = {
  instagram: "Instagram", facebook: "Facebook", tiktok: "TikTok", twitter: "X", snapchat: "Snapchat",
  linkedin: "LinkedIn", pinterest: "Pinterest", telegram: "Telegram", line: "Line", kakao: "Kakao", wechat: "WeChat",
};

/** "Clicou em Telegram VIP", "…em A e B", "…em A e mais 2": em QUAL link, que
 *  é o que distingue quem foi ao Telegram de quem foi ao OnlyFans. */
export function ondeClicou(ids: string[], titulo: (id: string) => string): string {
  if (ids.length === 0) return ETAPA.click.parou;
  const [primeiro, segundo] = ids.map(titulo);
  if (ids.length === 1) return `Clicou em ${primeiro}`;
  if (ids.length === 2) return `Clicou em ${primeiro} e ${segundo}`;
  return `Clicou em ${primeiro} e mais ${ids.length - 1}`;
}

/** `BR` → `Brasil`. O navegador conhece os nomes; sem suporte, fica o código. */
export function nomeDoPais(codigo: string): string {
  try {
    return new Intl.DisplayNames(["pt-BR"], { type: "region" }).of(codigo) ?? codigo;
  } catch {
    return codigo;
  }
}

/** `22/11 17:10:02`, no fuso de quem está olhando. */
export function dataEHora(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
}
