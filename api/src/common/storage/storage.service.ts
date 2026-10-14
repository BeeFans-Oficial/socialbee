import { Injectable, Logger } from "@nestjs/common";
import { DeleteObjectCommand, PutObjectCommand, type S3Client } from "@aws-sdk/client-s3";

import { loadEnv } from "../../config/env";
import { isMediaKey, mediaUrl } from "./media-url";
import { criarClienteS3 } from "./s3-client";

/**
 * Armazenamento de objetos para as imagens das criadoras.
 *
 * Fala S3. Em produção o outro lado é o Cloudflare R2; em dev e no CI, um
 * RustFS no compose. O código não sabe qual é e não precisa — trocar é mudar
 * as variáveis `S3_*` (ver `s3-client.ts`).
 *
 * O bucket é de LEITURA pública: no R2 pelo domínio público do bucket, em dev
 * pela política aplicada por `s3-init`. Por isso não há URL assinada: a imagem
 * de uma criadora é pública por natureza, ela está na página pública. O que
 * estas credenciais protegem é a ESCRITA.
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
    this.bucket = loadEnv().s3Bucket;
    this.client = criarClienteS3();
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
