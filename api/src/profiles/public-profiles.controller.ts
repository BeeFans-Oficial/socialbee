import { Controller, Get, Param, Query } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";

import { Public } from "../common/decorators/public.decorator";
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

  @Public()
  @Get("profiles/:slug")
  async profile(@Param("slug") slug: string) {
    return this.profilesService.publicProfile(slug);
  }
}
