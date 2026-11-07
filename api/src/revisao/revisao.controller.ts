import { Controller, Get, HttpCode, Param, ParseUUIDPipe, Post } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";

import { CurrentUser, type AuthContext } from "../common/decorators/current-user.decorator";
import { SemPagina } from "../common/decorators/sem-pagina.decorator";
import { loadEnv } from "../config/env";
import { RevisaoService } from "./revisao.service";

/**
 * O simulador da revisão da Meta, por página.
 *
 * Para todos os planos: proteger a conta não é vantagem do Pro, é o
 * mínimo. Uma rodada custa de 10 a 30 requisições feitas pela API contra o
 * próprio site; três por dez minutos por IP já cobre "corrigi, revisa de
 * novo" sem abrir espaço para alguém usar a API como ferramenta de carga.
 */
@Controller("me/profiles/:id/revisao")
// O id da página vai no caminho; a posse é conferida no serviço.
@SemPagina()
export class RevisaoController {
  constructor(private readonly revisao: RevisaoService) {}

  @Post()
  @HttpCode(200)
  @Throttle({ default: { limit: loadEnv().nodeEnv === "test" ? 1000 : 3, ttl: 600_000 } })
  revisar(@CurrentUser() auth: AuthContext, @Param("id", ParseUUIDPipe) id: string) {
    return this.revisao.revisar(auth.userId, id, "manual");
  }

  @Get()
  async ultima(@CurrentUser() auth: AuthContext, @Param("id", ParseUUIDPipe) id: string) {
    return { revisao: await this.revisao.ultima(auth.userId, id) };
  }

  @Get("historico")
  async historico(@CurrentUser() auth: AuthContext, @Param("id", ParseUUIDPipe) id: string) {
    return { revisoes: await this.revisao.historico(auth.userId, id) };
  }
}

/** "Verificar destino" de um link, na tela de Links. Instantâneo, sem gravar. */
@Controller("me/links/:id/verificar")
@SemPagina()
export class VerificacaoDeLinkController {
  constructor(private readonly revisao: RevisaoService) {}

  @Post()
  @HttpCode(200)
  @Throttle({ default: { limit: loadEnv().nodeEnv === "test" ? 1000 : 10, ttl: 60_000 } })
  verificar(@CurrentUser() auth: AuthContext, @Param("id", ParseUUIDPipe) id: string) {
    return this.revisao.verificarLink(auth.userId, id);
  }
}
