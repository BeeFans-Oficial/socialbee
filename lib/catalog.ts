/**
 * Catálogo de apresentação e tipos do domínio.
 *
 * Este arquivo se chamava `mock-data.ts` e era a fonte de verdade do produto:
 * perfil, links e métricas viviam aqui, em memória, e se perdiam no refresh.
 * Agora esse dado mora na API (Postgres) e o que sobra aqui é o que sempre foi
 * decisão de DESIGN, não dado de usuário:
 *
 *   - `THEMES` e `PLATFORMS`: paletas e rótulos que o front sabe desenhar. A
 *     API guarda apenas o id escolhido (`themeId`, `platform`) como texto
 *     aberto, de propósito — um tema ou canal novo é uma entrada nesta lista,
 *     não uma migração de banco.
 *   - Os tipos do domínio, importados por praticamente todo componente.
 *
 * O nome mudou junto: manter "mock" no caminho depois de o mock ter ido embora
 * é o tipo de pista falsa que faz alguém procurar dado de teste onde ele não
 * existe mais.
 */

export interface SocialLink {
  /** Id da rede em `SAFE_PLATFORMS` (ver `SafePageBuilder`).
   *
   *  Era uma união fechada de sete literais. Virou `string` porque agora o dado
   *  vem da API, que guarda canal como texto aberto de propósito — o mesmo
   *  motivo de `Link.platform`: rede nova é uma entrada na lista do front, não
   *  uma migração de banco. Quem restringe a escolha é o seletor da interface. */
  platform: string;
  url: string;
  title: string;
}

export interface SafePage {
  id: string;
  socialLinks: SocialLink[];
  createdAt: string;
}

export type LinkButtonStyle = "soft" | "filled" | "outlined" | "glass" | "pill";

export interface LinkAppearance {
  style: LinkButtonStyle;
  color: string;
  useGradient: boolean;
  gradientTo: string;
  glow: boolean;
  showIcon: boolean;
  showArrow: boolean;
  themePresetId?: string;
}

export const DEFAULT_LINK_APPEARANCE: LinkAppearance = {
  style: "soft",
  color: "#FF3C6E",
  useGradient: false,
  gradientTo: "#FF1F57",
  glow: false,
  showIcon: true,
  showArrow: true,
};

export interface Link {
  id: string;
  title: string;
  subtitle?: string;
  thumbnailUrl?: string | null;
  platform: string;
  shortCode: string;
  destinationUrl?: string;
  isActive: boolean;
  position: number;
  clicks: number;
  cloakEnabled: boolean;
  safePage?: SafePage | null;
  appearance?: LinkAppearance;
}

export interface Theme {
  id: string;
  label: string;
  bg: string;
  accent: string;
  preview: string[];
}

export interface Platform {
  id: string;
  label: string;
  color: string;
  icon: string;
}

/**
 * Perfil público como as telas o consomem.
 *
 * Espelha `ApiProfile` (`lib/api/types.ts`) e é o que `ProfileHeader`,
 * `PhoneMockup` e a Sidebar recebem. `name` e `email` saíram: o email é da
 * CONTA e não do perfil (a API os separa em duas tabelas justamente para
 * nenhuma consulta de página pública precisar tocar o email de ninguém), e
 * `name` nunca era exibido — `displayName` sempre foi.
 */
export interface User {
  id: string;
  slug: string;
  displayName: string;
  bio: string;
  avatarUrl: string | null;
  coverUrl: string | null;
  themeId: string;
  buttonStyle: string;
  isAdult: boolean;
  joinedAt: string;
}

export const PLATFORMS: Platform[] = [
  { id: "onlyfans", label: "OnlyFans", color: "#00AFF0", icon: "💙" },
  { id: "privacy", label: "Privacy.com.br", color: "#FF6B6B", icon: "🔒" },
  { id: "telegram", label: "Telegram", color: "#229ED9", icon: "✈️" },
  { id: "whatsapp", label: "WhatsApp", color: "#25D366", icon: "💬" },
  { id: "instagram", label: "Instagram", color: "#E1306C", icon: "📸" },
  { id: "tiktok", label: "TikTok", color: "#ff0050", icon: "🎵" },
  { id: "twitter", label: "Twitter/X", color: "#1DA1F2", icon: "🐦" },
  { id: "youtube", label: "YouTube", color: "#FF0000", icon: "▶️" },
  { id: "site", label: "Site próprio", color: "#9b6dff", icon: "🌐" },
  { id: "custom", label: "Personalizado", color: "#FF3C6E", icon: "⭐" },
];

export const THEMES: Theme[] = [
  {
    id: "neon-pink",
    label: "Neon Pink",
    bg: "#0d0d0d",
    accent: "#FF3C6E",
    preview: ["#0d0d0d", "#FF3C6E", "#FF1F57"],
  },
  {
    id: "dark-rose",
    label: "Dark Rose",
    bg: "#0a0a0f",
    accent: "#e8607a",
    preview: ["#0a0a0f", "#e8607a", "#ff9f43"],
  },
  {
    id: "neon-purple",
    label: "Neon Purple",
    bg: "#08080f",
    accent: "#9b6dff",
    preview: ["#08080f", "#9b6dff", "#FF3C6E"],
  },
  {
    id: "dark-teal",
    label: "Dark Teal",
    bg: "#050f0f",
    accent: "#00d4aa",
    preview: ["#050f0f", "#00d4aa", "#FF3C6E"],
  },
  {
    id: "crimson",
    label: "Crimson",
    bg: "#0f0508",
    accent: "#ff2d55",
    preview: ["#0f0508", "#ff2d55", "#ff9f43"],
  },
  {
    id: "onyx",
    label: "Onyx",
    bg: "#080808",
    accent: "#ffffff",
    preview: ["#080808", "#ffffff", "#888888"],
  },
];
