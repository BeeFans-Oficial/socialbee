import { createParamDecorator, type ExecutionContext } from "@nestjs/common";

/** Quem está autenticado na requisição. Preenchido pelo `JwtAuthGuard`. */
export interface AuthContext {
  userId: string;
  /** Perfil ativo da conta. Todo dado de link e de rastreamento é escopado por
   *  ele, e ele **nunca** vem do cliente. */
  profileId: string;
  sessionId: string;
  email: string;
}

/**
 * Injeta o contexto da sessão no handler.
 *
 * Existe para o controller nunca precisar ler `request.auth` na mão — e, mais
 * importante, para nenhum handler ter desculpa para aceitar `profileId` do
 * corpo ou da query. O perfil vem daqui.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthContext => {
    const request = ctx.switchToHttp().getRequest<{ auth?: AuthContext }>();
    if (!request.auth) {
      // Só acontece se alguém usar o decorator numa rota @Public: é erro de
      // programação, e falhar alto é melhor do que devolver undefined e virar
      // uma consulta sem filtro de perfil.
      throw new Error(
        "@CurrentUser() usado em rota sem sessão. Remova o @Public() ou o decorator.",
      );
    }
    return request.auth;
  },
);
