import {
  BadRequestException,
  Controller,
  Delete,
  HttpCode,
  Param,
  Post,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";

import { CurrentUser, type AuthContext } from "../common/decorators/current-user.decorator";
import { chaveDaImagem, processarImagem, type UsoDaImagem } from "../common/storage/image-processor";
import { StorageService } from "../common/storage/storage.service";
import { ImagemEnviada, exigirArquivo, type ArquivoEnviado } from "../common/storage/upload";
import { ProfilesService, type ImagemDoPerfil } from "./profiles.service";

/** `:tipo` da URL → coluna do perfil + tamanho de saída. */
const TIPOS: Record<string, { campo: ImagemDoPerfil; uso: UsoDaImagem }> = {
  avatar: { campo: "avatarUrl", uso: "avatar" },
  cover: { campo: "coverUrl", uso: "cover" },
  iab: { campo: "iabImageUrl", uso: "iab" },
};

/**
 * Upload das imagens do perfil: avatar, capa e foto da página de chegada.
 *
 * Substitui o data URL em base64 que ia dentro do `PATCH /me/profile`. O
 * arquivo chega em multipart, é redimensionado pelo `sharp` e gravado no
 * bucket; a coluna recebe a chave e a resposta devolve a URL pública.
 *
 * Ordem das operações, e por quê: grava o objeto novo, depois atualiza a
 * coluna, e SÓ ENTÃO apaga o antigo. Se o apagar falhar, sobra um órfão no
 * bucket (barato). Se a ordem fosse inversa e o `UPDATE` falhasse, o perfil
 * apontaria para um objeto que não existe mais (a criadora sem foto).
 *
 * Sem id na rota: o perfil editável é sempre o da sessão (`x-profile-id`,
 * conferido pelo guard), como no `PATCH`.
 */
@Controller("me/profile/images")
export class ProfileImagesController {
  constructor(
    private readonly profilesService: ProfilesService,
    private readonly storage: StorageService,
  ) {}

  @Post(":tipo")
  @UseInterceptors(ImagemEnviada())
  async upload(
    @CurrentUser() auth: AuthContext,
    @Param("tipo") tipo: string,
    @UploadedFile() file: ArquivoEnviado | undefined,
  ): Promise<{ url: string }> {
    const alvo = tipoDaImagem(tipo);
    const arquivo = exigirArquivo(file);

    const imagem = await processarImagem(arquivo.buffer, alvo.uso);
    const chave = chaveDaImagem(`profiles/${auth.profileId}`, alvo.uso);
    await this.storage.put(chave, imagem.bytes, imagem.contentType);

    const anterior = await this.profilesService.setImage(auth.profileId, alvo.campo, chave);
    await this.storage.deleteQuietly(anterior);

    return { url: this.storage.publicUrlFor(chave) as string };
  }

  @Delete(":tipo")
  @HttpCode(204)
  async remove(@CurrentUser() auth: AuthContext, @Param("tipo") tipo: string): Promise<void> {
    const alvo = tipoDaImagem(tipo);
    const anterior = await this.profilesService.setImage(auth.profileId, alvo.campo, null);
    await this.storage.deleteQuietly(anterior);
  }
}

function tipoDaImagem(tipo: string): { campo: ImagemDoPerfil; uso: UsoDaImagem } {
  const alvo = TIPOS[tipo];
  if (!alvo) {
    throw new BadRequestException({
      code: "tipo_invalido",
      message: `Tipo de imagem desconhecido. Use ${Object.keys(TIPOS).join(", ")}.`,
    });
  }
  return alvo;
}
