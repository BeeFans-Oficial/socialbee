"use client";

export interface IABDetection {
  isIAB: boolean;
  source: "instagram" | "threads" | "facebook" | "other" | null;
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
  // Threads antes do Instagram: o navegador do Threads também se apresenta com
  // pedaços do Instagram, e a saída de cada um é um esquema diferente.
  const isThreads = /Barcelona|Threads/i.test(userAgent);
  const isInstagram = /Instagram/i.test(userAgent);
  const isFacebook = /FBAN|FBAV/i.test(userAgent);
  const isOtherIAB = /Line|Twitter|Snapchat|TikTok/i.test(userAgent);

  let source: IABDetection["source"] = null;
  let isIAB = false;

  if (isThreads) {
    isIAB = true;
    source = "threads";
  } else if (isInstagram) {
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
 * iPhone, fora do Instagram e do Threads: abre a URL no Safari.
 *
 * `x-safari-https://…` é um esquema do iOS (a partir do 17) que entrega o
 * endereço ao Safari a partir do WebView de apps como Facebook, WhatsApp e
 * TikTok. O Instagram IGNORA este esquema — por isso ele tem saída própria,
 * abaixo. Em iOS mais antigo nada acontece; quem chama tem o plano B (a
 * instrução do menu •••).
 */
export function buildSafariUrl(url: string): string {
  return /^https?:\/\//i.test(url) ? `x-safari-${url}` : url;
}

/**
 * Instagram e Threads: o esquema do PRÓPRIO app que abre no navegador externo.
 *
 * `instagram://extbrowser/?url=…` pede ao Instagram que entregue o endereço ao
 * navegador padrão do aparelho; ele mostra o aviso "This web page is trying to
 * open an app outside of Instagram", e "Open" leva para fora. O Threads tem o
 * equivalente em `barcelona://` (nome interno do app).
 */
export function buildExtBrowserUrl(url: string, app: "instagram" | "threads"): string {
  const esquema = app === "threads" ? "barcelona" : "instagram";
  return `${esquema}://extbrowser/?url=${encodeURIComponent(url)}`;
}

/**
 * O endereço que tira a pessoa do aplicativo.
 *
 * - Android: `intent://`, para o navegador padrão (vale para todos os apps).
 * - iPhone no Instagram ou no Threads: o `extbrowser` do próprio app.
 * - iPhone em outros apps: o Safari, por `x-safari-https://`.
 *
 * `app` vem do user-agent do navegador (`detectIAB().source`).
 */
export function urlDeSaida(
  url: string,
  plataforma: "ios" | "android" | "other",
  app: IABDetection["source"] = null,
): string {
  if (plataforma === "android") return buildIntentUrl(url);
  if (plataforma === "ios") {
    if (app === "instagram" || app === "threads") return buildExtBrowserUrl(url, app);
    return buildSafariUrl(url);
  }
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

  // `replace` para o esquema de saída: o pedido de "abrir fora" não vira
  // entrada no histórico. Os demais `href` deste arquivo ficam como estão de
  // propósito: partem do PERFIL da criadora (não de uma página-ponte), e com
  // `replace` o "voltar" pularia o perfil em vez de retornar aos links dele.
  window.location.replace(urlDeSaida(destinationUrl, plataforma, device.source));

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
