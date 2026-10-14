import { loadEnv } from "../../config/env";

/**
 * Chave do bucket → URL que o navegador usa.
 *
 * Função pura, e não método do `StorageService`, porque quem a chama são as
 * funções de view (`toOwnProfileView`, `toPublicLinkView`...), que são puras e
 * não têm injeção de dependência.
 *
 * Dois formatos entram, um sai intacto:
 *   - chave (`profiles/<id>/avatar-<ts>.webp`)  → `${MEDIA_PUBLIC_URL}/chave`
 *   - URL http(s)                               → intacta (avatar externo, legado)
 *
 * Data URL em base64 não existe mais nas colunas desde a migration
 * `1790900000000` (varchar(255)); `isMediaKey` ainda a exclui por segurança.
 */
export function mediaUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  if (!isMediaKey(value)) return value;
  return `${loadEnv().mediaPublicUrl}/${value}`;
}

/** Chave do bucket, por oposição a URL http(s) (e a data URL, por segurança). */
export function isMediaKey(value: string): boolean {
  return !value.startsWith("data:") && !/^https?:\/\//i.test(value);
}
