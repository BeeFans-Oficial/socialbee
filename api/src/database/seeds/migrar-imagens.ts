import { Client } from "pg";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

import { loadEnv } from "../../config/env";
import { chaveDaImagem, processarImagem, type UsoDaImagem } from "../../common/storage/image-processor";

/**
 * Move para o bucket as imagens que ainda estão em base64 nas colunas.
 *
 *     npm run imagens:migrar -- --dry-run     só conta
 *     npm run imagens:migrar                  migra
 *
 * Em produção, dentro do container: `node dist/database/seeds/migrar-imagens.js`.
 *
 * Idempotente: só pega coluna que começa com `data:`, então rodar de novo não
 * faz nada. Cada imagem passa pelo MESMO redimensionamento do upload, para o
 * banco terminar uniforme. Um perfil (ou link) que falhar é registrado e
 * pulado; os outros seguem. A linha só é atualizada depois de o objeto estar
 * no bucket, e a coluna antiga nunca é apagada antes disso — o pior caso de
 * uma falha no meio é a imagem existir nos dois lugares.
 *
 * Depois que este script devolver "0 pendentes" em produção, o caminho de
 * fallback (`AvatarController`, `decodeDataUrl`) pode ser removido.
 */

interface Alvo {
  tabela: "profiles" | "links";
  coluna: string;
  uso: UsoDaImagem;
  prefixo: (id: string) => string;
}

const ALVOS: Alvo[] = [
  { tabela: "profiles", coluna: "avatar_url", uso: "avatar", prefixo: (id) => `profiles/${id}` },
  { tabela: "profiles", coluna: "cover_url", uso: "cover", prefixo: (id) => `profiles/${id}` },
  { tabela: "profiles", coluna: "iab_image_url", uso: "iab", prefixo: (id) => `profiles/${id}` },
  { tabela: "links", coluna: "thumbnail_url", uso: "thumb", prefixo: (id) => `links/${id}` },
];

const LOTE = 50;

function decodeDataUrl(value: string): Buffer | null {
  const match = /^data:([\w/+.-]+);base64,(.*)$/s.exec(value);
  return match ? Buffer.from(match[2], "base64") : null;
}

async function main(argv: string[]): Promise<void> {
  const dryRun = argv.includes("--dry-run");
  const env = loadEnv();

  const client = new Client({
    connectionString: env.databaseUrl,
    ssl: env.dbSsl ? { rejectUnauthorized: false } : undefined,
  });
  await client.connect();
  const s3 = new S3Client({
    endpoint: env.s3Endpoint,
    region: env.s3Region,
    credentials: { accessKeyId: env.s3AccessKey, secretAccessKey: env.s3SecretKey },
    forcePathStyle: env.s3ForcePathStyle,
  });

  let migradas = 0;
  let falhas = 0;

  try {
    await client.query(`SET search_path TO "${env.dbSchema}", public`);

    for (const alvo of ALVOS) {
      const { rows: contagem } = await client.query<{ n: string }>(
        `SELECT count(*) AS n FROM ${alvo.tabela} WHERE ${alvo.coluna} LIKE 'data:%'`,
      );
      const pendentes = Number(contagem[0].n);
      console.log(`[imagens] ${alvo.tabela}.${alvo.coluna}: ${pendentes} pendente(s)`);
      if (dryRun || pendentes === 0) continue;

      // Lotes pela própria condição: cada linha migrada sai do `WHERE`, então
      // o laço anda sem precisar de cursor. Uma linha que falhar fica no
      // conjunto — por isso o `NOT IN` com as que já falharam.
      const comFalha: string[] = [];
      for (;;) {
        const { rows } = await client.query<{ id: string; valor: string }>(
          `SELECT id, ${alvo.coluna} AS valor FROM ${alvo.tabela}
            WHERE ${alvo.coluna} LIKE 'data:%'
              AND NOT (id = ANY($1::uuid[]))
            ORDER BY id LIMIT ${LOTE}`,
          [comFalha],
        );
        if (rows.length === 0) break;

        for (const row of rows) {
          try {
            const bytes = decodeDataUrl(row.valor);
            if (!bytes) throw new Error("data URL malformado");
            const imagem = await processarImagem(bytes, alvo.uso);
            const chave = chaveDaImagem(alvo.prefixo(row.id), alvo.uso);
            await s3.send(
              new PutObjectCommand({
                Bucket: env.s3Bucket,
                Key: chave,
                Body: imagem.bytes,
                ContentType: imagem.contentType,
                CacheControl: "public, max-age=2592000, immutable",
              }),
            );
            await client.query(`UPDATE ${alvo.tabela} SET ${alvo.coluna} = $1 WHERE id = $2`, [chave, row.id]);
            migradas += 1;
          } catch (error) {
            falhas += 1;
            comFalha.push(row.id);
            console.error(
              `[imagens] FALHA ${alvo.tabela} ${row.id} ${alvo.coluna}: ${error instanceof Error ? error.message : error}`,
            );
          }
        }
        console.log(`[imagens]   ${alvo.tabela}.${alvo.coluna}: ${migradas} migrada(s) até agora`);
      }
    }
  } finally {
    await client.end();
    s3.destroy();
  }

  if (dryRun) {
    console.log("[imagens] --dry-run: nada foi alterado.");
  } else {
    console.log(`[imagens] concluído: ${migradas} migrada(s), ${falhas} falha(s).`);
    if (falhas > 0) process.exitCode = 1;
  }
}

main(process.argv.slice(2)).catch((error) => {
  console.error(error);
  process.exit(1);
});
