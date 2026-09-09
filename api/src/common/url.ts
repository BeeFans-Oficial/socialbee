/**
 * Validação de destino de link.
 *
 * Portado de `safeDestination` em `lib/tracking/resolver.ts`, com uma trava a
 * mais: além de exigir http/https (um `javascript:` gravado no cadastro viraria
 * XSS na hora do salto), recusa host de rede interna.
 *
 * O motivo do endurecimento é o destino ter virado dado gravado por qualquer
 * pessoa que se cadastre. Um link para `169.254.169.254` (metadados de nuvem)
 * ou `10.0.0.5` não leva o visitante a lugar útil, mas coloca o produto no
 * papel de encaminhar tráfego para dentro de rede privada — e é assim que um
 * redirecionador aberto vira ferramenta de varredura de infra alheia.
 */

const PRIVATE_HOST_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^0\./,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^169\.254\./, // link-local, inclui o endpoint de metadados das nuvens
  /^::1$/,
  /^\[?::1\]?$/,
  /^f[cd][0-9a-f]{2}:/i, // fc00::/7, rede privada IPv6
  /^fe80:/i,
  /\.local$/i,
  /\.internal$/i,
];

export interface DestinationCheck {
  url: URL | null;
  reason?: "malformada" | "esquema" | "host_interno";
}

export function checkDestination(rawUrl: string): DestinationCheck {
  if (!rawUrl?.trim()) return { url: null, reason: "malformada" };

  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    return { url: null, reason: "malformada" };
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { url: null, reason: "esquema" };
  }

  const host = url.hostname.toLowerCase();
  if (PRIVATE_HOST_PATTERNS.some((pattern) => pattern.test(host))) {
    return { url: null, reason: "host_interno" };
  }

  return { url };
}

/** `null` quando o destino não pode ser servido. Mesma assinatura da versão do
 *  MVP, para o redirecionador continuar simples. */
export function safeDestination(rawUrl: string): URL | null {
  return checkDestination(rawUrl).url;
}

/** Mensagem exibível para o formulário da criadora. */
export function destinationErrorMessage(reason: DestinationCheck["reason"]): string {
  switch (reason) {
    case "esquema":
      return "O link precisa começar com http:// ou https://.";
    case "host_interno":
      return "Esse endereço aponta para uma rede interna e não funcionaria para suas visitantes.";
    default:
      return "Endereço de destino inválido.";
  }
}
