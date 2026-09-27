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

/*
 * `shortLinkUrl` foi removida daqui.
 *
 * Ela montava `host/r/<código curto>` e era o que o botão de copiar do cartão
 * entregava. Mas esse endereço é o redirecionador que a PÁGINA da criadora usa
 * por dentro para contar o clique — não um link de bio. Copiado para a bio, ele
 * leva a um destino só, sem a página, sem os outros links e sem a barreira de
 * idade. O que ela divulga é `host/<slug>`, e é isso que `profileUrl` devolve.
 *
 * Quem precisa montar o endereço do redirecionador hoje é a própria página
 * pública, e ela o faz a partir de `window.location.origin` para casar com o
 * `lib/cloak.ts` — que precisa da MESMA origem de onde a página foi servida
 * para o escape de navegador embutido funcionar.
 */

/** URL pública de um perfil, na origem de onde o painel foi servido.
 *
 *  Continua existindo para o caminho em que o host da página ainda não é
 *  conhecido. Quando ele for — e com o pool de domínios ele quase sempre é —
 *  use `urlDaPagina`, que respeita o domínio escolhido. */
export function profileUrl(slug: string): string {
  return `${clientOrigin()}/${slug}`;
}

/**
 * URL pública de uma página, NO DOMÍNIO DELA.
 *
 * Com um domínio só, montar o endereço a partir de `siteHost()` funcionava: o
 * valor de build era o único endereço que existia. Com o pool, ele passa a
 * estar errado para toda página que escolheu outro — e o erro só aparece
 * depois, quando a criadora cola na bio um link que não é o dela.
 *
 * O `host` vem resolvido pela API (`profile.host`), que é quem sabe qual
 * domínio a página usa.
 *
 * O esquema é deduzido do próprio host: endereço local fala http, domínio de
 * verdade fala https. Guardar o esquema junto do host no banco seria convidar a
 * concatenação errada, e em produção ele nunca varia.
 */
export function urlDaPagina(host: string, slug: string): string {
  return `${esquemaDe(host)}://${host}/${slug}`;
}

export function esquemaDe(host: string): "http" | "https" {
  return /^(localhost|127\.0\.0\.1|\[::1\])(:|$)/.test(host) ? "http" : "https";
}
