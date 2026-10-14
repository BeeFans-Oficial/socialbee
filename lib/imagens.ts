import { toast } from "sonner";

import { api } from "@/lib/api/client";

/**
 * Upload de imagem, do lado do navegador.
 *
 * O arquivo vai INTEIRO para a API, em multipart, e é lá que ele é
 * redimensionado (`api/src/common/storage/image-processor.ts`). O limite aqui
 * é o mesmo da API: só poupa a criadora de esperar um upload que seria
 * recusado.
 */

/** 15 MB: cobre qualquer foto de celular. A API aplica o mesmo valor. */
export const LIMITE_DO_UPLOAD = 15 * 1024 * 1024;

export type ImagemDoPerfil = "avatar" | "cover" | "iab";

/** Confere o arquivo escolhido antes de subir. `null` quando está ok. */
export function problemaNoArquivo(arquivo: File): string | null {
  if (!arquivo.type.startsWith("image/")) return "Escolha um arquivo de imagem.";
  if (arquivo.size > LIMITE_DO_UPLOAD) return "Imagem muito grande. Use um arquivo de até 15 MB.";
  return null;
}

/** Lê o arquivo de um `<input type="file">`, confere e limpa o input (para o
 *  mesmo arquivo poder ser escolhido de novo). `null` se não há o que subir. */
export function arquivoDoInput(e: React.ChangeEvent<HTMLInputElement>): File | null {
  const arquivo = e.target.files?.[0] ?? null;
  e.target.value = "";
  if (!arquivo) return null;
  const problema = problemaNoArquivo(arquivo);
  if (problema) {
    toast.error(problema);
    return null;
  }
  return arquivo;
}

/** Sobe uma imagem do perfil e devolve a URL pública. Erros viram toast e
 *  `null`. */
export async function subirImagemDoPerfil(tipo: ImagemDoPerfil, arquivo: File): Promise<string | null> {
  try {
    const { url } = await api.uploadProfileImage(tipo, arquivo);
    return url;
  } catch (caught) {
    toast.error(caught instanceof Error ? caught.message : "Não foi possível enviar a imagem.");
    return null;
  }
}

export async function subirMiniaturaDoLink(linkId: string, arquivo: File): Promise<string | null> {
  try {
    const { url } = await api.uploadLinkImage(linkId, arquivo);
    return url;
  } catch (caught) {
    toast.error(caught instanceof Error ? caught.message : "Não foi possível enviar a imagem.");
    return null;
  }
}
