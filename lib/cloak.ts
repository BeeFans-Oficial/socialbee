"use client";

export interface IABDetection {
  isIAB: boolean;
  source: "instagram" | "facebook" | "other" | null;
  isAndroid: boolean;
  isIOS: boolean;
}

export function detectIAB(): IABDetection {
  if (typeof window === "undefined") {
    return { isIAB: false, source: null, isAndroid: false, isIOS: false };
  }

  const userAgent = navigator.userAgent;

  // Detectar plataforma
  const isAndroid = /Android/i.test(userAgent);
  const isIOS = /iPhone|iPad|iPod/i.test(userAgent);

  // Detectar in-app browsers
  const isInstagram = /Instagram/i.test(userAgent);
  const isFacebook = /FBAN|FBAV/i.test(userAgent);
  const isOtherIAB = /Line|Twitter|Snapchat|TikTok/i.test(userAgent);

  let source: "instagram" | "facebook" | "other" | null = null;
  let isIAB = false;

  if (isInstagram) {
    isIAB = true;
    source = "instagram";
  } else if (isFacebook) {
    isIAB = true;
    source = "facebook";
  } else if (isOtherIAB) {
    isIAB = true;
    source = "other";
  }

  return {
    isIAB,
    source,
    isAndroid,
    isIOS,
  };
}

export function buildIntentUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return `intent://${parsed.hostname}${parsed.pathname}${parsed.search}#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(url)};end`;
  } catch (error) {
    console.error("Error building intent URL:", error);
    return url;
  }
}

export function escapeIAB(
  destinationUrl: string,
  onFallback?: () => void
): void {
  const device = detectIAB();

  if (device.isAndroid) {
    // Android: usar intent URL para forçar Chrome
    const intentUrl = buildIntentUrl(destinationUrl);
    window.location.href = intentUrl;

    // Fallback caso o intent não funcione
    setTimeout(() => {
      window.location.href = destinationUrl;
    }, 2500);
  } else if (device.isIOS) {
    // iOS: tentar abrir diretamente
    window.location.href = destinationUrl;

    // Callback para mostrar botão manual se não funcionar
    setTimeout(() => {
      onFallback?.();
    }, 1500);
  } else {
    // Não é IAB, abrir normalmente
    window.location.href = destinationUrl;
  }
}

export function handleLinkClick(
  shortCode: string,
  cloakEnabled: boolean,
  onFallback?: () => void
): void {
  // URL de redirect (mock - em produção seria a route real)
  const redirectUrl = `${window.location.origin}/r/${shortCode}`;

  // Se cloaking não está habilitado, abrir diretamente
  if (!cloakEnabled) {
    window.location.href = redirectUrl;
    return;
  }

  // Detectar in-app browser
  const device = detectIAB();

  // Se está em IAB, tentar escapar
  if (device.isIAB) {
    console.log(`🔓 Cloaking ativado - Escapando de ${device.source} IAB`);
    escapeIAB(redirectUrl, onFallback);
  } else {
    // Navegador normal, abrir diretamente
    window.location.href = redirectUrl;
  }
}

// Função auxiliar para detectar crawlers (server-side)
export function detectCrawler(userAgent: string): boolean {
  const crawlerPatterns = [
    /bot/i,
    /crawl/i,
    /spider/i,
    /slurp/i,
    /mediapartners/i,
    /facebookexternalhit/i,
    /whatsapp/i,
    /telegram/i,
    /discordbot/i,
    /twitterbot/i,
    /linkedinbot/i,
    /pinterest/i,
    /slackbot/i,
    /telegrambot/i,
    /bingbot/i,
    /googlebot/i,
    /yandex/i,
    /baiduspider/i,
  ];

  return crawlerPatterns.some((pattern) => pattern.test(userAgent));
}

// Função para obter conteúdo "limpo" para crawlers (server-side)
export function getCloakedContent(user: any, links: any[]) {
  return {
    title: `${user.displayName} - BeeSocial`,
    description: user.bio.slice(0, 160),
    links: links.filter((link) => link.isActive).map((link) => link.url),
  };
}
