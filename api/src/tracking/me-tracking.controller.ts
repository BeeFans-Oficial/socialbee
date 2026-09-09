import { Controller, Get, Query } from "@nestjs/common";

import { CurrentUser, type AuthContext } from "../common/decorators/current-user.decorator";
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
  constructor(private readonly tracking: TrackingService) {}

  @Get("report")
  async report(@CurrentUser() auth: AuthContext, @Query("days") daysRaw?: string) {
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
