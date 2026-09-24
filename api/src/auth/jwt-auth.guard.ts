import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";

import { IS_PUBLIC_KEY } from "../common/decorators/public.decorator";
import type { AuthContext } from "../common/decorators/current-user.decorator";
import { readSessionCookie } from "./cookies";
import { AuthService } from "./auth.service";
import { ProfilesService } from "../profiles/profiles.service";

/** Cabeçalho que diz QUAL página da conta a requisição edita. */
export const PROFILE_HEADER = "x-profile-id";

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
    private readonly profilesService: ProfilesService,
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

    /**
     * Qual PÁGINA da conta esta requisição está editando.
     *
     * Uma conta tem várias, e a sessão não pode escolher por ela: o token
     * carrega apenas a página padrão (a primeira, do cadastro). O painel diz a
     * página no cabeçalho, e aqui ela é **verificada contra o dono da sessão**.
     *
     * Essa verificação é o que torna o cabeçalho aceitável. O valor vem do
     * cliente — mas um id de outra criadora não passa daqui, e o pedido cai
     * para a página padrão em vez de vazar dado alheio. A recusa é silenciosa e
     * não um 403 de propósito: o painel de quem tem uma página só nunca manda o
     * cabeçalho, e um 403 transformaria o caso comum em erro.
     *
     * Quando o cabeçalho é igual ao do token — a conta de uma página só — não
     * há consulta nenhuma: a verificação é a própria igualdade.
     */
    const pedida = headerValue(request, PROFILE_HEADER);
    let profileId = session.profileId;

    if (pedida && pedida !== session.profileId) {
      const eDela = await this.profilesService.belongsToUser(session.userId, pedida);
      if (eDela) profileId = pedida;
    }

    request.auth = {
      userId: session.userId,
      profileId,
      sessionId: session.sessionId,
      email: session.email,
    };
    return true;
  }
}

function headerValue(request: Request, name: string): string | undefined {
  const raw = request.headers[name];
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value?.trim() || undefined;
}

function bearerToken(request: Request): string | undefined {
  const header = request.headers.authorization;
  if (!header) return undefined;
  const [scheme, value] = header.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !value) return undefined;
  return value.trim();
}
