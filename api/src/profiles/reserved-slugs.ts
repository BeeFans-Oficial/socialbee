/**
 * Slugs que não podem ser de ninguém.
 *
 * Isto conserta um bug real do MVP: `RESERVED_SLUGS` em `lib/utils.ts` reservava
 * nomes de exemplo ("bella", "luna", "demo") mas **deixava de fora as rotas que
 * o app realmente serve** — `links`, `aparencia`, `analytics`, `configuracoes`,
 * `cadastro`, `r`. Quem se cadastrasse com o slug `links` teria um perfil
 * público que o dashboard sombreia: `/links` abre o painel, não a página dela.
 *
 * A lista é a verdade sobre a árvore de rotas do Next (ver `app/`), mais o que
 * um produto normalmente guarda para si. Ao criar uma rota nova no front,
 * acrescente aqui — é uma linha, e o custo de esquecer é um perfil inacessível.
 */
export const RESERVED_SLUGS = new Set([
  // Rotas que existem hoje em app/
  "api",
  "r",
  "login",
  "cadastro",
  "links",
  "aparencia",
  "analytics",
  "configuracoes",
  "dashboard",
  // Reservas de produto e de operação
  "admin",
  "administrador",
  "beesocial",
  "beefans",
  "app",
  "auth",
  "signup",
  "signin",
  "logout",
  "sobre",
  "about",
  "ajuda",
  "help",
  "suporte",
  "support",
  "termos",
  "terms",
  "privacidade",
  "privacy",
  "settings",
  "config",
  "static",
  "public",
  "assets",
  "docs",
  "blog",
  "status",
  "www",
  "mail",
  "cdn",
]);

export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUGS.has(slug.trim().toLowerCase());
}
