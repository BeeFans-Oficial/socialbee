import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Passe da página de chegada: como o servidor fica sabendo que a fã JÁ passou
 * pela tela de rolagem dentro de um aplicativo.
 *
 * ## O problema
 *
 * O navegador embutido do Instagram e o navegador de verdade do aparelho não
 * compartilham cookie nem armazenamento. A fã rolava, tocava no botão, saía
 * do app — e o navegador de fora, sem ter como saber disso, mostrava a mesma
 * tela de rolagem de novo. Duas vezes o mesmo gesto para chegar aos links.
 *
 * ## Como funciona
 *
 * 1. A chegada, dentro do app, pede um PASSE (`POST /<slug>/p`) quando a
 *    rolagem começa.
 * 2. O botão abre `/<slug>/p/<passe>` no navegador de fora.
 * 3. Essa rota confere o passe, grava um cookie `HttpOnly` e responde 307
 *    para `/<slug>`, o endereço limpo.
 * 4. A página, ao renderizar, vê o cookie e não inclui a chegada.
 *
 * ## Sem estado
 *
 * Passe e cookie são só "validade + assinatura" (HMAC com o segredo do
 * servidor). Nada é guardado nem queimado: abrir o link várias vezes gera
 * vários passes, todos válidos ao mesmo tempo, e trocar qualquer um deles só
 * grava o mesmo cookie. Não há sessão para perder.
 *
 * ## Mesma resposta para todo mundo
 *
 * Nenhuma dessas rotas olha user-agent nem IP. Qualquer requisitante recebe
 * um passe ao pedir, e a troca responde o MESMO 307 com passe válido, vencido
 * ou inventado — só o cookie muda. Quem chega a `/<slug>` sem cookie (fã de
 * primeira visita, robô, navegador da Meta) recebe o documento de sempre.
 */

/** Intervalo entre o toque no botão e o navegador de fora abrir. Folgado, para
 *  quem demora no aviso "Open / Cancel" do Instagram. */
export const VALIDADE_DO_PASSE_S = 10 * 60;

/** Por quanto tempo a página abre sem a chegada depois da troca. Curto de
 *  propósito: quem volta outro dia passa pela tela de novo. */
export const VALIDADE_DO_COOKIE_S = 30 * 60;

export const COOKIE_DA_CHEGADA = "chegada";

type Uso = "passe" | "cookie";

function segredo(): string | null {
  return process.env.INTERNAL_API_SECRET || null;
}

function agora(): number {
  return Math.floor(Date.now() / 1000);
}

/** O `uso` entra na assinatura: um passe não serve de cookie nem o contrário. */
function assinar(chave: string, uso: Uso, slug: string, expira: number): string {
  return createHmac("sha256", chave)
    .update(`chegada:${uso}:${slug.toLowerCase()}:${expira}`)
    .digest("base64url")
    .slice(0, 22);
}

function emitir(uso: Uso, slug: string, validade: number): string | null {
  const chave = segredo();
  if (!chave) return null;
  const expira = agora() + validade;
  return `${expira.toString(36)}.${assinar(chave, uso, slug, expira)}`;
}

function conferir(uso: Uso, slug: string, valor: string | undefined | null): boolean {
  const chave = segredo();
  if (!chave || !valor) return false;
  const [expiraTexto, assinatura, ...resto] = valor.split(".");
  if (!expiraTexto || !assinatura || resto.length > 0) return false;
  const expira = parseInt(expiraTexto, 36);
  if (!Number.isSafeInteger(expira) || expira < agora()) return false;
  const esperada = Buffer.from(assinar(chave, uso, slug, expira));
  const recebida = Buffer.from(assinatura);
  return esperada.length === recebida.length && timingSafeEqual(esperada, recebida);
}

/** `null` sem segredo configurado: a chegada segue como antes (repete fora do
 *  app), em vez de aceitar passes que qualquer um poderia forjar. */
export function emitirPasse(slug: string): string | null {
  return emitir("passe", slug, VALIDADE_DO_PASSE_S);
}

export function passeValido(slug: string, passe: string): boolean {
  return conferir("passe", slug, passe);
}

export function emitirCookieDaChegada(slug: string): string | null {
  return emitir("cookie", slug, VALIDADE_DO_COOKIE_S);
}

export function cookieDaChegadaValido(slug: string, valor: string | undefined): boolean {
  return conferir("cookie", slug, valor);
}
