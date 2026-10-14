import { Injectable, Logger } from "@nestjs/common";
import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

import { loadEnv } from "../../config/env";
import { isMediaKey, mediaUrl } from "./media-url";

/**
 * Armazenamento de objetos para as imagens das criadoras.
 *
 * Fala S3. Em dev e em produção o outro lado é o MinIO do compose; o código não
 * sabe disso e não precisa — Amazon S3 ou Cloudflare R2 entram trocando as
 * variáveis `S3_*`, nenhuma linha aqui.
 *
 * O bucket é de LEITURA pública (ver `minio-init` no compose). Por isso não há
 * URL assinada: a imagem de uma criadora é pública por natureza, ela está na
 * página pública. O que estas credenciais protegem é a ESCRITA.
 *
 * ## Chave, não URL
 *
 * As colunas `avatar_url`, `cover_url`, `iab_image_url` e `thumbnail_url`
 * guardam a CHAVE do objeto (`profiles/<id>/avatar-<ts>.webp`), e a URL
 * completa é montada na leitura com `MEDIA_PUBLIC_URL`. Trocar de domínio ou
 * de provedor é mudar uma variável, não um `UPDATE` em massa.
 *
 * Durante a transição as mesmas colunas ainda podem conter o formato antigo
 * (data URL em base64). `isKey` é o que distingue os dois.
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor() {
    const env = loadEnv();
    this.bucket = env.s3Bucket;
    this.client = new S3Client({
      endpoint: env.s3Endpoint,
      region: env.s3Region,
      credentials: { accessKeyId: env.s3AccessKey, secretAccessKey: env.s3SecretKey },
      // MinIO serve o bucket no caminho (`/bucket/chave`), não no subdomínio
      // como a Amazon. Sem isto o SDK tenta `bucket.minio:9000` e falha na
      // resolução de nome.
      forcePathStyle: env.s3ForcePathStyle,
    });
  }

  async put(key: string, bytes: Buffer, contentType: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: bytes,
        ContentType: contentType,
        // A chave carrega carimbo de tempo e nunca é sobrescrita, então o
        // navegador pode guardar para sempre. Quem serve em produção é o
        // nginx, que repete este cabeçalho; em dev o MinIO o devolve direto.
        CacheControl: "public, max-age=2592000, immutable",
      }),
    );
  }

  /**
   * Apaga sem falhar o chamador: a imagem nova já foi gravada e a coluna já
   * aponta para ela quando este método roda. Um objeto órfão no bucket custa
   * centenas de KB; uma troca de foto que "falha" depois de ter dado certo
   * custa a confiança da criadora.
   */
  async deleteQuietly(key: string | null | undefined): Promise<void> {
    if (!key || !StorageService.isKey(key)) return;
    try {
      await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
    } catch (error) {
      this.logger.warn(`não apagou ${key}: ${error instanceof Error ? error.message : error}`);
    }
  }

  /** URL que o navegador usa. Ver `mediaUrl`. */
  publicUrlFor(value: string | null): string | null {
    return mediaUrl(value);
  }

  static isKey(value: string): boolean {
    return isMediaKey(value);
  }
}
