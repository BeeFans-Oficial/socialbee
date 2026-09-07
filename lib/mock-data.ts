export interface SocialLink {
  platform: "instagram" | "twitter" | "tiktok" | "twitch" | "youtube" | "snapchat" | "facebook";
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

export interface User {
  id: string;
  name: string;
  email: string;
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

export interface Analytics {
  totalViews: number;
  totalClicks: number;
  instagramClicks: number;
  conversionRate: number;
  dailyData: Array<{
    date: string;
    views: number;
    clicks: number;
  }>;
}

export const MOCK_USER: User = {
  id: "user_01",
  name: "Bella",
  email: "bella@beesocial.app",
  slug: "bella",
  displayName: "Bella ✨",
  bio: "Conteúdo exclusivo para quem quer mais 🔥 Entre nos meus links abaixo 👇",
  avatarUrl: null,
  coverUrl: null,
  themeId: "neon-pink",
  buttonStyle: "soft",
  isAdult: true,
  joinedAt: "2024-01-15",
};

export const MOCK_LINKS: Link[] = [
  {
    id: "l1",
    title: "Meu OnlyFans 🔥",
    platform: "onlyfans",
    shortCode: "xK9mP1",
    destinationUrl: "https://onlyfans.com/bella",
    isActive: true,
    position: 0,
    clicks: 1842,
    cloakEnabled: true,
  },
  {
    id: "l2",
    title: "Telegram VIP 💎",
    platform: "telegram",
    shortCode: "aB3nQ2",
    destinationUrl: "https://t.me/bellavip",
    isActive: true,
    position: 1,
    clicks: 934,
    cloakEnabled: true,
  },
  {
    id: "l3",
    title: "Instagram 📸",
    platform: "instagram",
    shortCode: "mZ7rL3",
    destinationUrl: "https://instagram.com/bella",
    isActive: true,
    position: 2,
    clicks: 621,
    cloakEnabled: false,
  },
  {
    id: "l4",
    title: "WhatsApp Direto 💬",
    platform: "whatsapp",
    shortCode: "pR2wX4",
    destinationUrl: "https://wa.me/5511999999999",
    isActive: true,
    position: 3,
    clicks: 408,
    cloakEnabled: true,
  },
  {
    id: "l5",
    title: "Pack Especial 👑",
    platform: "privacy",
    shortCode: "tY5nM5",
    destinationUrl: "https://privacy.com.br/bella",
    isActive: false,
    position: 4,
    clicks: 215,
    cloakEnabled: true,
  },
];

export const MOCK_ANALYTICS: Analytics = {
  totalViews: 12480,
  totalClicks: 4020,
  instagramClicks: 2104,
  conversionRate: 32.2,
  dailyData: Array.from({ length: 30 }, (_, i) => ({
    date: new Date(Date.now() - (29 - i) * 86400000).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
    }),
    views: Math.floor(300 + Math.random() * 250),
    clicks: Math.floor(80 + Math.random() * 100),
  })),
};

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
