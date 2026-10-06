import { Controller, Get, Param, ParseUUIDPipe, Query } from "@nestjs/common";

import { CurrentUser, type AuthContext } from "../common/decorators/current-user.decorator";
import { PLANOS, exigirPro } from "../plans/plans";
import { LinksService } from "../links/links.service";
import { TrackingService } from "./tracking.service";

/** Janelas que o dashboard oferece. Lista fechada de propósito: `days` livre na
 *  query permitiria varrer a tabela inteira numa requisição. */
const ALLOWED_DAYS = [7, 30, 90] as const;

/**
 * Relatório do perfil da sessão.
 *
 * Aqui está fechada a dívida que o MVP registrava em
 * `app/api/tracking/report/route.ts`: "o projeto não tem autenticação, e por
 * isso o perfil aqui é fixo em `MOCK_USER.id`. Quando entrar sessão, o
 * `profileId` sai dela e NUNCA da query string". É o que acontece agora — não
 * existe parâmetro de perfil nesta rota.
 */
@Controller("me/tracking")
export class MeTrackingController {
  constructor(
    private readonly tracking: TrackingService,
    private readonly links: LinksService,
  ) {}

  /** Janela pedida → intervalo. Lista fechada pelo mesmo motivo do relatório. */
  private janela(daysRaw?: string) {
    const requested = Number(daysRaw ?? 30);
    const days = (ALLOWED_DAYS as readonly number[]).includes(requested) ? requested : 30;
    const to = new Date();
    const from = new Date(to.getTime() - (days - 1) * 86_400_000);
    return { days, range: { from, to } };
  }

  /**
   * Métricas de UM link — o que a lista de Links mostra ao clicar nos cliques.
   *
   * Do Pro, como o relatório da página: o Free não tem relatório nenhum.
   * `findOwned` responde 404 para link de outra página antes de qualquer
   * consulta de evento.
   */
  @Get("links/:id")
  async linkReport(
    @CurrentUser() auth: AuthContext,
    @Param("id", ParseUUIDPipe) id: string,
    @Query("days") daysRaw?: string,
  ) {
    if (!PLANOS[auth.plano].relatorio) exigirPro(auth.plano, "relatorio");
    await this.links.findOwned(auth.profileId, id);
    const { days, range } = this.janela(daysRaw);
    return { days, report: await this.tracking.linkReport(auth.profileId, id, range) };
  }

  @Get("report")
  async report(@CurrentUser() auth: AuthContext, @Query("days") daysRaw?: string) {
    // Antes de qualquer consulta: o Free não tem relatório, e a recusa não
    // deve custar a agregação inteira.
    if (!PLANOS[auth.plano].relatorio) exigirPro(auth.plano, "relatorio");

    const requested = Number(daysRaw ?? 30);
    const days = (ALLOWED_DAYS as readonly number[]).includes(requested) ? requested : 30;

    const to = new Date();
    const from = new Date(to.getTime() - (days - 1) * 86_400_000);

    const [report, counters] = await Promise.all([
      this.tracking.report(auth.profileId, { from, to }),
      this.tracking.counters(auth.profileId),
    ]);

    // Os contadores acompanham o relatório porque respondem a outra pergunta: o
    // relatório é a janela, o contador é o total histórico do link — que
    // sobrevive à expiração do evento cru.
    return { days, report, counters };
  }
}
