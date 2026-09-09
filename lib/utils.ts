import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNumber(n: number): string {
  if (n >= 1000000) {
    return (n / 1000000).toFixed(1).replace(/\.0$/, "") + "M";
  }
  if (n >= 1000) {
    return (n / 1000).toFixed(1).replace(/\.0$/, "") + "k";
  }
  return n.toString();
}

export function getPlatformColor(platform: string): string {
  const colors: Record<string, string> = {
    onlyfans: "#00AFF0",
    privacy: "#FF6B6B",
    telegram: "#229ED9",
    whatsapp: "#25D366",
    instagram: "#E1306C",
    tiktok: "#ff0050",
    twitter: "#1DA1F2",
    youtube: "#FF0000",
    site: "#9b6dff",
    custom: "#FF3C6E",
  };
  return colors[platform.toLowerCase()] || "#FF3C6E";
}

export function getPlatformIcon(platform: string): string {
  const icons: Record<string, string> = {
    onlyfans: "💙",
    privacy: "🔒",
    telegram: "✈️",
    whatsapp: "💬",
    instagram: "📸",
    tiktok: "🎵",
    twitter: "🐦",
    youtube: "▶️",
    site: "🌐",
    custom: "⭐",
  };
  return icons[platform.toLowerCase()] || "🔗";
}

/*
 * `generateShortCode` foi removida daqui.
 *
 * O código curto é o ENDEREÇO PÚBLICO do link (`/r/<code>`) e precisa ser único
 * no sistema inteiro. Quem o gera é a API, com `crypto.randomInt` e conferência
 * contra o índice único da tabela. Um cliente que pudesse escolhê-lo poderia
 * tentar colidir com o código de outra criadora — e `Math.random()`, que era o
 * que estava aqui, torna o próximo código previsível a partir do anterior.
 */

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function validateSlug(slug: string): boolean {
  return /^[a-z0-9-]{3,30}$/.test(slug);
}

export function maskUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    const domain = urlObj.hostname.replace("www.", "");
    return `${domain}/...`;
  } catch {
    return "link/...";
  }
}

/*
 * `RESERVED_SLUGS` e `isSlugTaken` foram removidas daqui.
 *
 * A lista reservava nomes de exemplo ("bella", "luna", "demo") e **não**
 * reservava as rotas que o app realmente serve (`links`, `aparencia`,
 * `analytics`, `configuracoes`, `cadastro`, `r`) — então um slug podia ser
 * sombreado pelo dashboard para sempre. Além disso, disponibilidade não é
 * decisão do cliente: só o servidor sabe quais perfis existem.
 *
 * Agora quem responde é `GET /api/v1/public/slug-available`, que confere
 * formato, reservados (a lista de verdade, em `api/src/profiles/reserved-slugs.ts`)
 * e perfil existente, de uma vez.
 */
