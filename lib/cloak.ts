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

/**
 * Android: entrega a URL ao navegador PADRÃO da pessoa.
 *
 * Era `package=com.android.chrome`, que forçava o Chrome mesmo para quem usa
 * outro navegador. Sem `package`, o sistema resolve a ação VIEW de https pelo
 * navegador padrão. `browser_fallback_url` cobre o caso de nada atender.
 */
export function buildIntentUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return (
      `intent://${parsed.host}${parsed.pathname}${parsed.search}` +
      `#Intent;scheme=${parsed.protocol.replace(":", "")};action=android.intent.action.VIEW;` +
      `category=android.intent.category.BROWSABLE;` +
      `S.browser_fallback_url=${encodeURIComponent(url)};end`
    );
  } catch (error) {
    console.error("Error building intent URL:", error);
    return url;
  }
}

/**
 * iPhone: abre a URL no Safari, saindo do navegador embutido do aplicativo.
 *
 * `x-safari-https://…` é um esquema do próprio iOS (a partir do 17): o sistema
 * entrega o endereço ao Safari mesmo de dentro do WebView do Instagram. No iOS
 * não há esquema para "o navegador padrão" — o do Safari é o que existe em
 * todo iPhone. Em iOS mais antigo o esquema não é reconhecido e nada acontece;
 * por isso quem chama sempre tem um plano B (a instrução do menu •••).
 */
export function buildSafariUrl(url: string): string {
  return /^https?:\/\//i.test(url) ? `x-safari-${url}` : url;
}

/** O endereço que tira a pessoa do aplicativo, conforme o sistema. */
export function urlDeSaida(url: string, plataforma: "ios" | "android" | "other"): string {
  if (plataforma === "ios") return buildSafariUrl(url);
  if (plataforma === "android") return buildIntentUrl(url);
  return url;
}

export function escapeIAB(
  destinationUrl: string,
  onFallback?: () => void
): void {
  const device = detectIAB();
  const plataforma = device.isAndroid ? "android" : device.isIOS ? "ios" : "other";

  if (plataforma === "other") {
    window.location.href = destinationUrl;
    return;
  }

  window.location.href = urlDeSaida(destinationUrl, plataforma);

  // Se o navegador abriu, o aplicativo foi para segundo plano e esta página
  // deixou de estar visível — não há o que fazer. Se continua visível, a
  // saída não funcionou (iOS antigo, aplicativo que bloqueia): abre o destino
  // aqui mesmo, para o link ao menos funcionar, e mostra a instrução do menu.
  // Abrir SEMPRE os dois contaria o clique duas vezes.
  setTimeout(() => {
    if (document.visibilityState === "visible") {
      window.location.href = destinationUrl;
    }
    onFallback?.();
  }, 1800);
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
