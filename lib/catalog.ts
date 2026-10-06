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

/**
 * Temas da página pública.
 *
 * Os ids ficam gravados em `profiles.theme_id`, então NÃO mudam — "neon-pink"
 * continua sendo o id do tema rosa. O que mudou foram as cores e os nomes: os
 * destaques saturados (rosa #FF3C6E puro, roxo e verde fluorescentes) davam à
 * página cara de neon. Agora são tons mais baixos, que convivem com foto.
 */
export const THEMES: Theme[] = [
  {
    id: "noite",
    label: "Noite",
    bg: "#060913",
    accent: "#c9cede",
    preview: ["#060913", "#c9cede", "#7f8aa8"],
  },
  {
    id: "neon-pink",
    label: "Rosa",
    bg: "#0d0d0d",
    accent: "#e5708f",
    preview: ["#0d0d0d", "#e5708f", "#c45a77"],
  },
  {
    id: "dark-rose",
    label: "Rosé",
    bg: "#0c0a0d",
    accent: "#d99aa5",
    preview: ["#0c0a0d", "#d99aa5", "#b8838c"],
  },
  {
    id: "neon-purple",
    label: "Lavanda",
    bg: "#0a0a12",
    accent: "#a99be8",
    preview: ["#0a0a12", "#a99be8", "#8a7fc4"],
  },
  {
    id: "dark-teal",
    label: "Sálvia",
    bg: "#070d0c",
    accent: "#7fbfaf",
    preview: ["#070d0c", "#7fbfaf", "#5f9a8c"],
  },
  {
    id: "crimson",
    label: "Vinho",
    bg: "#0f0709",
    accent: "#c9606f",
    preview: ["#0f0709", "#c9606f", "#a34c59"],
  },
  {
    id: "onyx",
    label: "Ônix",
    bg: "#080808",
    accent: "#f2f2f2",
    preview: ["#080808", "#f2f2f2", "#888888"],
  },
];
