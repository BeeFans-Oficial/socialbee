import { MOCK_LINKS, MOCK_USER } from "@/lib/mock-data";
import type { LinkResolver, ResolvedLink } from "./types";

/**
 * Resolução de código curto → link.
 *
 * A única peça do rastreamento que sabe onde os links moram. Hoje lê
 * `lib/mock-data.ts`; quando existir banco, troca-se esta implementação e
 * nada mais no módulo muda.
 *
 * Multi-perfil já está no contrato: `ResolvedLink` carrega `profileId`, e o
 * dado mockado só tem um perfil porque é mock — não porque o núcleo assuma um.
 */

/** Índice em memória por código curto.
 *
 *  Existe porque o redirecionador é caminho quente: varrer o array a cada
 *  requisição é O(n) por clique. Num banco, isto é um índice único em
 *  `short_code`. */
const byShortCode = new Map<string, ResolvedLink>(
  MOCK_LINKS.map((link) => [
    link.shortCode,
    {
      linkId: link.id,
      profileId: MOCK_USER.id,
      channel: link.platform,
      destinationUrl: link.destinationUrl ?? "",
      isActive: link.isActive,
    },
  ]),
);

export const mockLinkResolver: LinkResolver = {
  async resolve(shortCode: string): Promise<ResolvedLink | null> {
    return byShortCode.get(shortCode) ?? null;
  },
};

/** Perfis por slug.
 *
 *  Existe para o registro de view nunca aceitar um `profileId` vindo do
 *  cliente: o navegador manda o slug público, o servidor traduz. Sem isso
 *  qualquer um postaria views em qualquer perfil. */
const byProfileSlug = new Map<string, string>([[MOCK_USER.slug, MOCK_USER.id]]);

export async function resolveProfileBySlug(slug: string): Promise<string | null> {
  return byProfileSlug.get(slug.toLowerCase()) ?? null;
}

/**
 * Valida o destino antes de redirecionar.
 *
 * O destino vem do nosso próprio armazenamento, então não há redirecionamento
 * aberto aqui — mas ele é digitado pela criadora, e um `javascript:` ou `data:`
 * gravado no cadastro viraria XSS na hora do salto. Só http e https passam.
 */
export function safeDestination(rawUrl: string): URL | null {
  if (!rawUrl) return null;
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  return url;
}
