import { BadRequestException, PayloadTooLargeException } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";

import { TAMANHO_MAXIMO_DO_UPLOAD } from "./image-processor";

/** O arquivo como o multer o entrega: em memória, porque o próximo passo é o
 *  `sharp`, que lê de buffer. Nunca toca o disco do container. */
export interface ArquivoEnviado {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
}

/**
 * Interceptor de upload de UMA imagem, no campo `file` do multipart.
 *
 * O limite de tamanho é aplicado pelo multer ANTES de o corpo inteiro ser
 * lido: um arquivo de 200 MB é cortado nos primeiros 15 MB. O filtro de tipo
 * olha só o `Content-Type` declarado pelo navegador; quem decide de verdade se
 * é imagem é o `sharp`, em `processarImagem`.
 */
export function ImagemEnviada() {
  return FileInterceptor("file", {
    limits: { fileSize: TAMANHO_MAXIMO_DO_UPLOAD, files: 1 },
    fileFilter: (_req, file, cb) => {
      if (!file.mimetype.startsWith("image/")) {
        cb(new BadRequestException({ code: "imagem_invalida", message: "Envie um arquivo de imagem." }), false);
        return;
      }
      cb(null, true);
    },
  });
}

/** O que o handler confere depois do interceptor: o campo veio? */
export function exigirArquivo(file: ArquivoEnviado | undefined): ArquivoEnviado {
  if (!file) {
    throw new BadRequestException({ code: "arquivo_ausente", message: "Envie a imagem no campo `file`." });
  }
  if (file.size > TAMANHO_MAXIMO_DO_UPLOAD) {
    throw new PayloadTooLargeException({ code: "imagem_grande", message: "Imagem muito grande. Use um arquivo de até 15 MB." });
  }
  return file;
}
