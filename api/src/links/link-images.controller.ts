import {
  Controller,
  Delete,
  HttpCode,
  Param,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";

import { CurrentUser, type AuthContext } from "../common/decorators/current-user.decorator";
import { chaveDaImagem, processarImagem } from "../common/storage/image-processor";
import { StorageService } from "../common/storage/storage.service";
import { ImagemEnviada, exigirArquivo, type ArquivoEnviado } from "../common/storage/upload";
import { LinkOwnerGuard } from "./link-owner.guard";
import { LinksService } from "./links.service";

/**
 * Miniatura do link. Mesma mecânica das imagens do perfil
 * (`ProfileImagesController`): multipart → `sharp` → bucket → chave na coluna.
 */
@Controller("me/links")
export class LinkImagesController {
  constructor(
    private readonly linksService: LinksService,
    private readonly storage: StorageService,
  ) {}

  @UseGuards(LinkOwnerGuard)
  @Post(":id/image")
  @UseInterceptors(ImagemEnviada())
  async upload(
    @CurrentUser() auth: AuthContext,
    @Param("id") id: string,
    @UploadedFile() file: ArquivoEnviado | undefined,
  ): Promise<{ url: string }> {
    const arquivo = exigirArquivo(file);
    const imagem = await processarImagem(arquivo.buffer, "thumb");
    const chave = chaveDaImagem(`links/${id}`, "thumb");
    await this.storage.put(chave, imagem.bytes, imagem.contentType);

    const anterior = await this.linksService.setThumbnail(auth.profileId, id, chave);
    await this.storage.deleteQuietly(anterior);

    return { url: this.storage.publicUrlFor(chave) as string };
  }

  @UseGuards(LinkOwnerGuard)
  @Delete(":id/image")
  @HttpCode(204)
  async remove(@CurrentUser() auth: AuthContext, @Param("id") id: string): Promise<void> {
    const anterior = await this.linksService.setThumbnail(auth.profileId, id, null);
    await this.storage.deleteQuietly(anterior);
  }
}
