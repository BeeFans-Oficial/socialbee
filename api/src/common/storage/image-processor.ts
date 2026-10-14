import { BadRequestException } from "@nestjs/common";
import sharp from "sharp";

/**
 * Redimensiona a imagem que a criadora subiu para o tamanho que a tela usa.
 *
 * É isto, e não o bucket, que resolve o "Imagem muito grande": uma foto de
 * celular de 6 MB vira um WebP de 100 a 400 KB antes de ser guardada. O
 * original nunca é armazenado.
 *
 * Por que no servidor e não no navegador: o servidor é o único lugar que
 * garante o limite — qualquer cliente pode mandar o que quiser para a API.
 */

export type UsoDaImagem = "avatar" | "cover" | "iab" | "thumb";

/** Tamanhos por uso. Todos com folga para tela Retina (2x). */
const TAMANHOS: Record<UsoDaImagem, { width: number; height?: number; fit: "cover" | "inside" }> = {
  // Nunca aparece maior que 160 px na tela; 512 cobre 2x com sobra. Recorte
  // central, porque a interface mostra o avatar redondo.
  avatar: { width: 512, height: 512, fit: "cover" },
  // Fundo de tela inteira em alguns modelos.
  cover: { width: 1920, fit: "inside" },
  // Primeiro documento que a fã recebe, dentro de um aplicativo, em rede
  // móvel: menor é melhor.
  iab: { width: 1200, fit: "inside" },
  // Miniatura ao lado do link, ~56 px na tela.
  thumb: { width: 256, height: 256, fit: "cover" },
};

/** Acima disto a API recusa antes de processar. 15 MB cobre qualquer foto de
 *  celular; o `FileInterceptor` aplica o mesmo valor. */
export const TAMANHO_MAXIMO_DO_UPLOAD = 15 * 1024 * 1024;

export const FORMATO_DE_SAIDA = { contentType: "image/webp", extension: "webp" } as const;

export interface ImagemProcessada {
  bytes: Buffer;
  contentType: string;
  width: number;
  height: number;
}

export async function processarImagem(entrada: Buffer, uso: UsoDaImagem): Promise<ImagemProcessada> {
  const { width, height, fit } = TAMANHOS[uso];
  try {
    const { data, info } = await sharp(entrada, { failOn: "error" })
      // Sem argumento, lê a orientação EXIF da foto de celular e corrige. Sem
      // isto, foto tirada em pé aparece deitada.
      .rotate()
      // `withoutEnlargement`: foto menor que o alvo fica do tamanho que é.
      .resize({ width, height, fit, withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer({ resolveWithObject: true });
    return { bytes: data, contentType: FORMATO_DE_SAIDA.contentType, width: info.width, height: info.height };
  } catch {
    // `sharp` não reconheceu como imagem: arquivo corrompido, PDF renomeado,
    // ou HEIC — o formato padrão da câmera do iPhone, que o binário do sharp
    // na imagem Alpine NÃO decodifica (precisaria de libheif compilada). O
    // Safari costuma converter HEIC para JPEG ao subir por `<input type=file>`,
    // mas não sempre; daí a dica na mensagem.
    throw new BadRequestException({
      code: "imagem_invalida",
      message:
        "Arquivo não é uma imagem válida ou está em HEIC. Use JPG, PNG ou WebP " +
        "(no iPhone: Ajustes › Câmera › Formatos › Mais compatível).",
    });
  }
}

/** Chave única por troca: o carimbo de tempo é o que torna a URL imutável e o
 *  cache do navegador seguro. */
export function chaveDaImagem(prefixo: string, uso: UsoDaImagem): string {
  return `${prefixo}/${uso}-${Date.now()}.${FORMATO_DE_SAIDA.extension}`;
}
