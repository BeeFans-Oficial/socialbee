import type { CookieOptions, Response } from "express";

import { loadEnv } from "../config/env";

/**
 * Cookie de sessão.
 *
 * A escolha de guardar o token em cookie `httpOnly` em vez de `localStorage` é
 * a decisão de segurança mais consequente do módulo: `localStorage` é legível
 * por qualquer script da página, então um XSS em qualquer canto do dashboard
 * entrega a sessão inteira. O cookie `httpOnly` não é.
 *
 * `sameSite: "lax"` é suficiente porque o navegador fala com a MESMA origem: o
 * Next reescreve `/api/v1/*` para a API (ver `next.config.js`). Porta diferente
 * não muda o "site" para efeito de cookie, e em produção o par
 * `beesocial.app` / `api.beesocial.app` também é same-site. Nada de
 * `sameSite: "none"`, que abriria o cookie para requisição de terceiro.
 *
 * A API também aceita `Authorization: Bearer`, para teste por curl e para
 * consumo servidor-a-servidor — mas o navegador não usa esse caminho.
 */

function baseOptions(): CookieOptions {
  const env = loadEnv();
  return {
    httpOnly: true,
    sameSite: "lax",
    // Em produção o cookie só viaja por HTTPS. Em desenvolvimento não pode ser
    // `secure`, ou o navegador o descarta em `http://localhost` e o login
    // "funciona" sem nunca autenticar a próxima requisição.
    secure: env.cookieSecure,
    domain: env.cookieDomain,
    path: "/",
  };
}

export function setSessionCookie(response: Response, token: string, expiresAt: Date): void {
  response.cookie(loadEnv().cookieName, token, { ...baseOptions(), expires: expiresAt });
}

export function clearSessionCookie(response: Response): void {
  // `clearCookie` só apaga se os atributos casarem com os da escrita —
  // `path` e `domain` diferentes deixam o cookie no navegador e o logout não
  // acontece de verdade.
  response.clearCookie(loadEnv().cookieName, baseOptions());
}

export function readSessionCookie(cookies: Record<string, string> | undefined): string | undefined {
  return cookies?.[loadEnv().cookieName];
}
