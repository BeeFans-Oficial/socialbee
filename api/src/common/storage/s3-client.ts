import { S3Client } from "@aws-sdk/client-s3";

import { loadEnv } from "../../config/env";

/**
 * O cliente S3 da aplicação, num lugar só: o `StorageService` e o script de
 * migração usam a mesma configuração.
 *
 * Em produção o outro lado é o Cloudflare R2; em dev e no CI, um RustFS no
 * compose. Nenhum dos dois é a Amazon, e duas opções existem por isso:
 *
 * - `forcePathStyle`: o bucket vai no caminho (`/bucket/chave`), não no
 *   subdomínio. O R2 aceita os dois; o servidor local só o caminho.
 * - `*ChecksumCalculation: WHEN_REQUIRED`: desde a versão 3.729 o SDK manda
 *   um checksum CRC32 em todo `PutObject` por padrão, e o R2 responde erro
 *   para ele. "Quando exigido" é o comportamento antigo: só quando a operação
 *   pede (nenhuma das nossas pede).
 */
export function criarClienteS3(): S3Client {
  const env = loadEnv();
  return new S3Client({
    endpoint: env.s3Endpoint,
    region: env.s3Region,
    credentials: { accessKeyId: env.s3AccessKey, secretAccessKey: env.s3SecretKey },
    forcePathStyle: env.s3ForcePathStyle,
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
}
