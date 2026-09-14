import { Controller, Get, Header, Param, Res } from "@nestjs/common";
import type { Response } from "express";

import { Public } from "../common/decorators/public.decorator";
import { ProfilesService } from "./profiles.service";

/**
 * Avatar do perfil, servido como IMAGEM.
 *
 * Existe por uma razão medida: enquanto não há upload de arquivo, o avatar é
 * gravado como data URL em base64 numa coluna de texto — 1,8 MB para uma foto
 * de celular. Com a página de perfil renderizada no servidor, esse data URL
 * entrava **duas a três vezes** no mesmo documento (HTML + payload RSC, que
 * carregam a mesma árvore), e o perfil da criadora passava de 2,9 MB de HTML
 * antes de qualquer imagem ser otimizada. Numa audiência que chega por celular
 * e dados móveis, isso é a diferença entre a visitante esperar e desistir.
 *
 * Aqui o documento passa a carregar uma URL curta, e a imagem vira uma
 * requisição própria — cacheável pelo navegador, paralela ao HTML e fora do
 * payload de hidratação.
 *
 * Não é a solução final: o certo é armazenamento de objeto com URL assinada. É
 * a solução que cabe sem mudar a infraestrutura, e o dia em que o upload
 * existir, só esta rota muda.
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
}
