import { BadRequestException, Controller, Get, Param, ParseUUIDPipe, Query } from "@nestjs/common";

import { CurrentUser, type AuthContext } from "../common/decorators/current-user.decorator";
import { PLANOS, exigirPro } from "../plans/plans";
import { LinksService } from "../links/links.service";
import { TrackingService } from "./tracking.service";
import type { DateRange, ReportFilters } from "./types";

/** Atalhos de janela. `days` livre na query permitiria varrer a tabela
 *  inteira numa requisição; a janela por datas (`de`/`ate`) tem o mesmo teto
 *  de 90 dias, em `janelaDe`. */
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

  /**
   * O relatório, com janela e recortes pela query string:
   *
   *   days=7|30|90                      atalho (default 30)
   *   de=AAAA-MM-DD&ate=AAAA-MM-DD      janela livre, até 90 dias, dentro
   *                                     da retenção do evento cru
   *   link=id,id  origem=a,b  chegada=host  aparelho=mobile  pais=BR  app=sim|nao
   */
  @Get("report")
  async report(@CurrentUser() auth: AuthContext, @Query() q: Record<string, string | undefined>) {
    // Antes de qualquer consulta: o Free não tem relatório, e a recusa não
    // deve custar a agregação inteira.
    if (!PLANOS[auth.plano].relatorio) exigirPro(auth.plano, "relatorio");

    const { days, range } = janelaDe(q);
    const filters = filtrosDe(q);

    const [report, counters] = await Promise.all([
      this.tracking.report(auth.profileId, range, filters),
      this.tracking.counters(auth.profileId),
    ]);

    // Os contadores acompanham o relatório porque respondem a outra pergunta: o
    // relatório é a janela, o contador é o total histórico do link — que
    // sobrevive à expiração do evento cru.
    return { days, de: diaIso(range.from), ate: diaIso(range.to), report, counters };
  }
}

const DIA = 86_400_000;
const JANELA_MAXIMA_EM_DIAS = 90;

/** `days` ou `de`+`ate`. Dia em UTC, como a série diária do relatório. */
function janelaDe(q: Record<string, string | undefined>): { days: number; range: DateRange } {
  if (q.de || q.ate) {
    const formato = /^\d{4}-\d{2}-\d{2}$/;
    if (!q.de || !q.ate || !formato.test(q.de) || !formato.test(q.ate)) {
      throw new BadRequestException({ code: "periodo_invalido", message: "Informe as duas datas no formato AAAA-MM-DD." });
    }
    const from = new Date(`${q.de}T00:00:00.000Z`);
    const fimDoDia = new Date(`${q.ate}T23:59:59.999Z`);
    if (Number.isNaN(from.getTime()) || Number.isNaN(fimDoDia.getTime()) || from > fimDoDia) {
      throw new BadRequestException({ code: "periodo_invalido", message: "A data inicial precisa vir antes da final." });
    }
    const to = fimDoDia.getTime() > Date.now() ? new Date() : fimDoDia;
    const days = Math.floor((fimDoDia.getTime() - from.getTime()) / DIA) + 1;
    if (days > JANELA_MAXIMA_EM_DIAS) {
      throw new BadRequestException({
        code: "periodo_invalido",
        message: `O relatório cobre no máximo ${JANELA_MAXIMA_EM_DIAS} dias de cada vez.`,
      });
    }
    return { days, range: { from, to } };
  }
  const requested = Number(q.days ?? 30);
  const days = (ALLOWED_DAYS as readonly number[]).includes(requested) ? requested : 30;
  const to = new Date();
  const from = new Date(to.getTime() - (days - 1) * DIA);
  return { days, range: { from, to } };
}

function filtrosDe(q: Record<string, string | undefined>): ReportFilters {
  const lista = (valor: string | undefined): string[] | undefined => {
    const itens = (valor ?? "")
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean)
      .slice(0, 20);
    return itens.length ? itens : undefined;
  };
  return {
    links: lista(q.link),
    sources: lista(q.origem),
    arrivalHosts: lista(q.chegada),
    devices: lista(q.aparelho),
    countries: lista(q.pais),
    inApp: q.app === "sim" ? true : q.app === "nao" ? false : undefined,
  };
}

function diaIso(data: Date): string {
  return data.toISOString().slice(0, 10);
}
