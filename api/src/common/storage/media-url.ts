import { loadEnv } from "../../config/env";

/**
 * Chave do bucket → URL que o navegador usa.
 *
 * Função pura, e não método do `StorageService`, porque quem a chama são as
 * funções de view (`toOwnProfileView`, `toPublicLinkView`...), que são puras e
 * não têm injeção de dependência.
 *
 * Três formatos entram, dois saem intactos:
 *   - chave (`profiles/<id>/avatar-<ts>.webp`)  → `${MEDIA_PUBLIC_URL}/chave`
 *   - data URL (`data:image/...`)               → intacta (formato antigo, até a migração)
 *   - URL http(s)                               → intacta (avatar externo)
 */
export function mediaUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  if (!isMediaKey(value)) return value;
  return `${loadEnv().mediaPublicUrl}/${value}`;
}

/** Chave do bucket, por oposição a data URL e a URL http(s). */
export function isMediaKey(value: string): boolean {
  return !value.startsWith("data:") && !/^https?:\/\//i.test(value);
}

/** Formato antigo: a imagem inteira em base64 dentro da coluna. */
export function isDataUrl(value: string | null | undefined): value is string {
  return typeof value === "string" && value.startsWith("data:");
}
