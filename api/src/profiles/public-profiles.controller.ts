import { Controller, Get, Param, Query, Req } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import type { Request } from "express";

import { Public } from "../common/decorators/public.decorator";
import { isInternalRequest } from "../common/guards/internal-secret.guard";
import { clientIP } from "../tracking/attribution";
import { detectBot } from "../tracking/bots";
import { ProfilesService } from "./profiles.service";

/**
 * Leitura pública.
 *
 * `slug-available` é o que substitui a lista chumbada de `isSlugTaken` em
 * `lib/utils.ts` — que reservava "bella" e "luna" mas não reservava as rotas do
 * próprio app. O limite de requisição existe porque o formulário chama a rota a
 * cada tecla (com debounce), e sem teto ela também serve para varrer quais
 * slugs existem.
 */
@Controller("public")
export class PublicProfilesController {
  constructor(private readonly profilesService: ProfilesService) {}

  @Public()
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Get("slug-available")
  async slugAvailable(@Query("slug") slug?: string) {
    const value = (slug ?? "").trim().toLowerCase();
    return { slug: value, available: value ? await this.profilesService.isSlugAvailable(value) : false };
  }

  /**
   * Perfil público.
   *
   * A resposta ganha um campo `requester` com o veredito do filtro de robô
   * **apenas** quando quem chama é o nosso próprio servidor (segredo interno).
   * Três razões para ser aqui e não numa rota separada:
   *
   *   1. o servidor do Next já faz esta chamada para renderizar a página, e uma
   *      segunda ida à API dobraria a latência do caminho quente;
   *   2. o detector continua existindo em UM lugar só — a página não reimplementa
   *      heurística de robô, que é como as duas versões divergem com o tempo;
   *   3. a resposta para o visitante comum não muda em nada, então o contrato
   *      público continua o mesmo.
   *
   * Os cabeçalhos julgados são os do VISITANTE, repassados pelo servidor do
   * Next — não os da conexão entre os dois serviços.
   */
  @Public()
  @Get("profiles/:slug")
  async profile(@Param("slug") slug: string, @Req() request: Request) {
    const view = await this.profilesService.publicProfile(slug);
    if (!isInternalRequest(request.headers)) return view;

    const verdict = detectBot({
      userAgent: header(request, "user-agent") ?? "",
      ip: clientIP(request.headers),
      method: header(request, "x-original-method") ?? "GET",
      acceptLanguage: header(request, "accept-language"),
      accept: header(request, "accept"),
      secChUa: header(request, "sec-ch-ua"),
      secFetchMode: header(request, "sec-fetch-mode"),
    });

    return {
      ...view,
      requester: { isBot: verdict.isBot, score: verdict.score, reason: verdict.reason },
    };
  }
}

function header(request: Request, name: string): string | undefined {
  const raw = request.headers[name];
  return Array.isArray(raw) ? raw[0] : raw;
}
