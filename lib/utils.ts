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

export function generateShortCode(): string {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "";
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

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

const RESERVED_SLUGS = ["bella", "luna", "demo", "admin", "beesocial", "api", "auth", "login", "signup", "dashboard", "settings", "help", "about", "terms", "privacy", "support"];

export function isSlugTaken(slug: string): boolean {
  return RESERVED_SLUGS.includes(slug.toLowerCase());
}
