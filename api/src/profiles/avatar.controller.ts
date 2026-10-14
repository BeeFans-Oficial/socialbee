import { Controller, Get, Header, Param, Res } from "@nestjs/common";
import type { Response } from "express";

import { Public } from "../common/decorators/public.decorator";
import { ProfilesService } from "./profiles.service";

/**
 * Serve como IMAGEM os perfis que AINDA guardam a foto em base64.
 *
 * Caminho de transição. O upload novo grava no bucket (ver
 * `ProfileImagesController`) e a página pública aponta direto para a URL do
 * MinIO; estas rotas só são usadas por perfil criado antes disso e ainda não
 * migrado — `publicProfile` escolhe o ramo pelo prefixo `data:` da coluna.
 *
 * Quando `npm run imagens:migrar` tiver rodado em produção e nenhuma coluna
 * começar com `data:`, este arquivo, `decodeDataUrl` e os três métodos
 * `*Bytes` do serviço podem sair.
 */
@Controller("public/profiles")
export class AvatarController {
  constructor(private readonly profilesService: ProfilesService) {}

  @Public()
  @Get(":slug/avatar")
  // Cinco minutos no navegador: o suficiente para a navegação da visitante não
  // rebaixar a mesma imagem, e curto o bastante para a criadora ver a troca de
  // foto sem esperar.
  @Header("cache-control", "public, max-age=300")
  async avatar(@Param("slug") slug: string, @Res() response: Response): Promise<void> {
    const imagem = await this.profilesService.avatarBytes(slug);

    if (!imagem) {
      // 404 e não imagem placeholder: quem decide o que mostrar sem avatar é a
      // interface, que já desenha as iniciais.
      response.status(404).end();
      return;
    }

    response.setHeader("content-type", imagem.contentType);
    response.setHeader("etag", imagem.etag);
    response.end(imagem.bytes);
  }

  /**
   * Imagem de fundo do template.
   *
   * É a maior das três — ocupa a tela inteira em alguns templates — e a que
   * mais se beneficia de sair do documento: numa audiência que chega por
   * celular e dados móveis, base64 no HTML é a diferença entre a visitante
   * esperar e desistir.
   */
  @Public()
  @Get(":slug/cover")
  @Header("cache-control", "public, max-age=300")
  async cover(@Param("slug") slug: string, @Res() response: Response): Promise<void> {
    const imagem = await this.profilesService.coverBytes(slug);

    if (!imagem) {
      response.status(404).end();
      return;
    }

    response.setHeader("content-type", imagem.contentType);
    response.setHeader("etag", imagem.etag);
    response.end(imagem.bytes);
  }

  /**
   * Imagem da página de chegada (IAB).
   *
   * Cache mais longo que o do avatar: esta imagem é escolhida uma vez e quase
   * nunca trocada, e é o único peso do primeiro documento que a fã recebe —
   * dentro de um aplicativo, em rede móvel. O `etag` sai de `updated_at`, então
   * trocar a imagem continua invalidando na hora.
   */
  @Public()
  @Get(":slug/iab-image")
  @Header("cache-control", "public, max-age=3600")
  async iabImage(@Param("slug") slug: string, @Res() response: Response): Promise<void> {
    const imagem = await this.profilesService.iabImageBytes(slug);

    if (!imagem) {
      response.status(404).end();
      return;
    }

    response.setHeader("content-type", imagem.contentType);
    response.setHeader("etag", imagem.etag);
    response.end(imagem.bytes);
  }
}
