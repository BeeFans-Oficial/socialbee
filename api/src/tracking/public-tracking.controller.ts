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
        arrivalHost: arrivalHost(request),
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
      const requestUrl = dto.url ? parseUrlOr(dto.url, request) : originalUrl(request);
      const outcome = await this.tracking.recordClick({
        link,
        requestUrl,
        headers: request.headers,
        method: dto.method ?? "GET",
        // A URL do redirecionador já carrega o domínio por onde a fã entrou —
        // serve de segunda fonte quando o cabeçalho não veio.
        arrivalHost: arrivalHost(request, requestUrl),
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

/**
 * Por qual endereço a visita chegou.
 *
 * **Nunca sai de `request.headers.host`**: quem fala com esta API é sempre o
 * servidor do Next, então esse cabeçalho descreve a conexão interna
 * (`api:3333`) e não o domínio que a fã digitou. Quem conhece o domínio real é
 * a camada do Next, que o informa em `x-arrival-host` — o proxy o injeta porque
 * descarta o `host` original de propósito (ver `app/api/v1/[...path]/route.ts`).
 *
 * `fallback` existe para o clique: a URL do redirecionador já vem com o domínio
 * dentro, e usá-la evita perder o dado se o cabeçalho faltar.
 *
 * Valor ausente vira `undefined` e o evento é gravado assim mesmo. Campo de
 * análise não derruba registro de clique.
 *
 * **O valor é falsificável, e isso é aceito.** O registro de visualização é
 * rota pública: quem chamar a API direto pode inventar um `x-arrival-host` e
 * sujar a contagem por domínio. É a mesma natureza do `x-forwarded-for` (ver a
 * nota em `deploy/nginx/api.beesocial.bio.conf`) e a mesma consequência: este
 * campo alimenta ANÁLISE, nunca autorização nem roteamento.
 *
 * Importa saber disso na Fase D: o sinal de "queda de tráfego neste domínio"
 * pode, em tese, ser mascarado por tráfego forjado. Por isso o veredito de
 * bloqueio é humano e cruza mais de um sinal, em vez de confiar num número só.
 */
function arrivalHost(request: Request, fallback?: URL): string | undefined {
  const bruto = request.headers["x-arrival-host"];
  const cabecalho = (Array.isArray(bruto) ? bruto[0] : bruto)?.trim();
  const host = cabecalho || fallback?.host;
  return host ? host.toLowerCase() : undefined;
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
