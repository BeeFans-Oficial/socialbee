import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";

import type { Papel } from "../../admin/entities/admin-action.entity";
import type { AuthContext } from "../decorators/current-user.decorator";
import { ROLES_KEY } from "../decorators/roles.decorator";

/**
 * Guard de papel, registrado **globalmente** depois do `JwtAuthGuard`.
 *
 * É a regra de verdade do painel admin. O app também olha o papel para
 * decidir qual tela desenhar (`proxy.ts`), mas isso é experiência de
 * navegação: quem manda é esta recusa, em toda rota `/v1/admin/*`.
 *
 * Responde 403 com `code: "papel_necessario"`. O app traduz em 404 nas rotas
 * de admin, para elas nem existirem para quem não é — mas na API o 403 é o
 * código certo, e é o que um teste automatizado espera.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const exigidos = this.reflector.getAllAndOverride<Papel[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!exigidos || exigidos.length === 0) return true;

    const request = context.switchToHttp().getRequest<{ auth?: AuthContext }>();
    const papel = request.auth?.role;
    if (papel && exigidos.includes(papel)) return true;

    throw new ForbiddenException({
      code: "papel_necessario",
      message: "Esta ação é só para a equipe da plataforma.",
    });
  }
}
