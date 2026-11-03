import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from "@nestjs/common";

import { CurrentUser, type AuthContext } from "../common/decorators/current-user.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { AdminService } from "./admin.service";

/**
 * `/v1/admin/*`: a API do painel de operação.
 *
 * `@Roles("admin")` no controller inteiro: nenhuma rota aqui existe para uma
 * conta comum. A sessão vem do `JwtAuthGuard` global, o papel do `RolesGuard`
 * global — este arquivo não tem como esquecer de proteger uma rota.
 *
 * Nenhuma ação aceita o id do admin pelo corpo: ele sai da sessão, e é ele
 * que vai para `admin_actions`.
 */
@Controller("admin")
@Roles("admin")
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get("visao-geral")
  visaoGeral() {
    return this.admin.visaoGeral();
  }

  @Get("contas")
  contas(@Query("q") q = "", @Query("pagina") pagina = "1") {
    return this.admin.contas(q, paginaValida(pagina));
  }

  @Get("contas/:id")
  conta(@Param("id", ParseUUIDPipe) id: string) {
    return this.admin.conta(id);
  }

  @Post("contas/:id/plano/liberar")
  liberarPro(
    @CurrentUser() auth: AuthContext,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: { dias?: number; ate?: string; motivo: string },
  ) {
    return this.admin.liberarPro(auth.userId, id, {
      dias: body.dias !== undefined && body.dias !== null ? Number(body.dias) : undefined,
      ate: body.ate || undefined,
      motivo: body.motivo,
    });
  }

  @Post("contas/:id/plano/rebaixar")
  rebaixarPro(@CurrentUser() auth: AuthContext, @Param("id", ParseUUIDPipe) id: string, @Body() body: { motivo: string }) {
    return this.admin.rebaixarPro(auth.userId, id, body.motivo);
  }

  @Post("contas/:id/sessoes/revogar")
  revogarSessoes(@CurrentUser() auth: AuthContext, @Param("id", ParseUUIDPipe) id: string, @Body() body: { motivo: string }) {
    return this.admin.revogarSessoes(auth.userId, id, body.motivo);
  }

  @Post("contas/:id/papel")
  definirPapel(
    @CurrentUser() auth: AuthContext,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: { papel: "creator" | "admin"; motivo: string },
  ) {
    const papel = body.papel === "admin" ? "admin" : "creator";
    return this.admin.definirPapel(auth.userId, id, papel, body.motivo);
  }

  @Get("auditoria")
  auditoria(@Query("pagina") pagina = "1") {
    return this.admin.auditoria(paginaValida(pagina));
  }
}

function paginaValida(valor: string): number {
  const n = Number.parseInt(valor, 10);
  return Number.isFinite(n) && n >= 1 ? Math.min(n, 10000) : 1;
}
