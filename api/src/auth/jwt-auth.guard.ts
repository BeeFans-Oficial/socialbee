import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";

import { IS_PUBLIC_KEY } from "../common/decorators/public.decorator";
import type { AuthContext } from "../common/decorators/current-user.decorator";
import { readSessionCookie } from "./cookies";
import { AuthService } from "./auth.service";

/**
 * Guard de sessão, registrado **globalmente** (ver `app.module.ts`).
 *
 * Ordem de leitura do token: cookie primeiro, `Authorization: Bearer` depois.
 * O cookie vem antes porque é o caminho do navegador e o único que o produto
 * usa de verdade; o Bearer existe para curl, teste automatizado e chamada
 * servidor-a-servidor.
 *
 * Rota sem `@Public()` exige sessão. É o inverso do costume, e é de propósito:
 * o erro de esquecer o decorator resulta em 401, não em dado exposto.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authService: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<
      Request & { auth?: AuthContext; cookies?: Record<string, string> }
    >();

    const token = readSessionCookie(request.cookies) ?? bearerToken(request);
    if (!token) {
      throw new UnauthorizedException({ code: "no_session", message: "Sessão necessária." });
    }

    const session = await this.authService.resolveSession(token);
    request.auth = {
      userId: session.userId,
      profileId: session.profileId,
      sessionId: session.sessionId,
      email: session.email,
    };
    return true;
  }
}

function bearerToken(request: Request): string | undefined {
  const header = request.headers.authorization;
  if (!header) return undefined;
  const [scheme, value] = header.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !value) return undefined;
  return value.trim();
}
