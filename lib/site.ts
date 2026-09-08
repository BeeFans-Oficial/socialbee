/**
 * Origem pública do app.
 *
 * Existia um `beesocial.app` chumbado em oito lugares — inclusive no link que o
 * botão de copiar entregava. O domínio está no ar, mas serve um site estático
 * (Firebase) que **não é este app**: colar `beesocial.app/r/<código>` no
 * navegador dava 404. A criadora copiava o link dela e recebia página de erro.
 *
 * Agora a origem vem de `NEXT_PUBLIC_SITE_URL`. Em desenvolvimento, sem
 * nenhuma variável configurada, cai em `localhost:3000` — e o link copiado
 * **funciona**, que é o que importa para testar o produto.
 *
 * Nota sobre hidratação: `siteOrigin()` nunca lê `window`, para o HTML do
 * servidor e o do cliente serem idênticos. Quem pode usar `window` é
 * `clientOrigin()`, chamado só de dentro de handler de evento (copiar), onde
 * não existe render para divergir.
 */

const FALLBACK_ORIGIN = "http://localhost:3000";

function normalize(origin: string): string {
  return origin.trim().replace(/\/+$/, "");
}

/** Origem para texto renderizado. Determinística no servidor e no cliente. */
export function siteOrigin(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  return configured ? normalize(configured) : FALLBACK_ORIGIN;
}

/** Origem para ações do cliente (copiar, abrir). Prefere o endereço real de
 *  onde a página foi servida, o que faz o link copiado funcionar mesmo quando
 *  ninguém configurou a variável — inclusive acessando pelo IP da rede local
 *  para testar no celular. */
export function clientOrigin(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) return normalize(configured);
  if (typeof window !== "undefined") return window.location.origin;
  return FALLBACK_ORIGIN;
}

/** Host sem esquema, para exibição: "beesocial.app", "localhost:3000". */
export function siteHost(): string {
  try {
    return new URL(siteOrigin()).host;
  } catch {
    return new URL(FALLBACK_ORIGIN).host;
  }
}

/** URL do redirecionador de um link. */
export function shortLinkUrl(shortCode: string): string {
  return `${clientOrigin()}/r/${shortCode}`;
}

/** URL pública de um perfil. */
export function profileUrl(slug: string): string {
  return `${clientOrigin()}/${slug}`;
}
