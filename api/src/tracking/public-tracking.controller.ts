import { Body, Controller, HttpCode, Post, Req, UseGuards } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { IsOptional, IsString, Matches, MaxLength } from "class-validator";
import type { Request } from "express";

import { Public } from "../common/decorators/public.decorator";
import { InternalSecretGuard } from "../common/guards/internal-secret.guard";
import { safeDestination } from "../common/url";
import { LinksService } from "../links/links.service";
import { ProfilesService } from "../profiles/profiles.service";
import { TrackingService } from "./tracking.service";

class RecordViewDto {
  @IsString()
  @Matches(/^[a-z0-9-]{3,30}$/)
  slug: string;
}

class RecordClickDto {
  @IsString()
  @Matches(/^[A-Za-z0-9]{4,32}$/)
  code: string;

  /** URL original do redirecionador, com os UTM e click ids que o visitante
   *  trouxe. Vem do servidor do Next, que a recebeu do navegador. */
  @IsOptional()
  @IsString()
  @MaxLength(4096)
  url?: string;

  /** Método da requisição original. Chega para o filtro de robô continuar
   *  vendo `HEAD` como sondagem. */
  @IsOptional()
  @IsString()
  @MaxLength(10)
  method?: string;
}

/**
 * Rastreamento do lado público.
 *
 * `view` é aberto e recebe **slug**, nunca `profileId`: o cliente não escolhe
 * em qual perfil grava.
 *
 * `click` é servidor-a-servidor, atrás de segredo interno. Quem chama é o
 * redirecionador do Next (`app/r/[code]/route.ts`), que roda no servidor,
 * repassa os cabeçalhos do visitante e recebe o destino de volta. O destino
 * nunca passa pelo navegador — é isso que mantém o link fora do HTML e fora do
 * alcance do robô da rede social.
 */
@Controller("public/tracking")
export class PublicTrackingController {
  constructor(
    private readonly tracking: TrackingService,
    private readonly profiles: ProfilesService,
    private readonly links: LinksService,
  ) {}

  @Public()
  // Uma visualização por segundo por origem é folgado para gente e apertado
  // para script: sem teto, este endpoint aberto é um inflador de métrica.
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Post("view")
  @HttpCode(204)
  async view(@Body() dto: RecordViewDto, @Req() request: Request): Promise<void> {
    const profileId = await this.profiles.profileIdBySlug(dto.slug);
    // 204 mesmo quando o perfil não existe: o navegador não precisa saber, e um
    // erro aqui não muda nada na página que o visitante está vendo. Também
    // impede que a rota sirva para descobrir quais slugs existem.
    if (!profileId) return;

    try {
      await this.tracking.recordView({
        profileId,
        requestUrl: originalUrl(request),
        headers: request.headers,
      });
    } catch (error) {
      // Falha de rastreamento nunca afeta a experiência do visitante.
      console.error("[tracking] falha ao registrar view", error);
    }
  }

  @Public()
  @UseGuards(InternalSecretGuard)
  @Post("click")
  @HttpCode(200)
  async click(@Body() dto: RecordClickDto, @Req() request: Request) {
    const link = await this.links.resolveByShortCode(dto.code);
    if (!link || !link.isActive) return { destinationUrl: null, counted: false };

    const destination = safeDestination(link.destinationUrl);
    if (!destination) return { destinationUrl: null, counted: false };

    let counted = false;
    let reason = "";
    try {
      const outcome = await this.tracking.recordClick({
        link,
        requestUrl: dto.url ? parseUrlOr(dto.url, request) : originalUrl(request),
        headers: request.headers,
        method: dto.method ?? "GET",
      });
      counted = outcome.counted;
      reason = outcome.reason;
    } catch (error) {
      // O registro não pode derrubar o salto: perder um clique do relatório é
      // muito menos grave do que perder a visita.
      console.error("[tracking] falha ao registrar clique", error);
    }

    // `reason` acompanha a resposta para o chamador poder registrar POR QUE um
    // clique não contou. Sem isso, "cliquei e não apareceu no analytics" é
    // impossível de investigar — e o filtro de robô é justamente a peça em que
    // um falso positivo apaga clique humano em silêncio.
    return { destinationUrl: destination.toString(), counted, reason };
  }
}

function originalUrl(request: Request): URL {
  return new URL(request.originalUrl, `http://${request.headers.host ?? "localhost"}`);
}

function parseUrlOr(raw: string, request: Request): URL {
  try {
    return new URL(raw);
  } catch {
    return originalUrl(request);
  }
}
