import { Body, Controller, Get, HttpCode, Post, Req, Res } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import type { Request, Response } from "express";

import { CurrentUser, type AuthContext } from "../common/decorators/current-user.decorator";
import { Public } from "../common/decorators/public.decorator";
import { clientIP } from "../tracking/attribution";
import { AuthService, type SessionMeta } from "./auth.service";
import { clearSessionCookie, setSessionCookie } from "./cookies";
import { LoginDto } from "./dto/login.dto";
import { RegisterDto } from "./dto/register.dto";

/**
 * Autenticação por email e senha.
 *
 * O limite de tentativas é bem mais apertado aqui do que no resto da API: é o
 * único lugar onde alguém pode testar credencial em laço. Cinco tentativas por
 * minuto não incomoda quem errou a senha e inviabiliza lista de senhas comuns.
 *
 * O `@Throttle` sobrescreve o teto global (240/min) apenas nestes handlers — é
 * assim que se aperta uma rota sem apertar o dashboard inteiro.
 */
@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post("register")
  async register(
    @Body() dto: RegisterDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.register(dto, metaFrom(request));
    setSessionCookie(response, result.accessToken, result.expiresAt);
    return {
      user: result.user,
      profile: result.profile,
      accessToken: result.accessToken,
      expiresAt: result.expiresAt.toISOString(),
    };
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post("login")
  @HttpCode(200)
  async login(
    @Body() dto: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.login(dto, metaFrom(request));
    setSessionCookie(response, result.accessToken, result.expiresAt);
    return {
      user: result.user,
      profile: result.profile,
      accessToken: result.accessToken,
      expiresAt: result.expiresAt.toISOString(),
    };
  }

  /**
   * Sair.
   *
   * Revoga a linha em `sessions` **e** apaga o cookie. Só apagar o cookie
   * deixaria o token válido para quem o tivesse copiado.
   */
  @Post("logout")
  @HttpCode(204)
  async logout(
    @CurrentUser() auth: AuthContext,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.authService.logout(auth.sessionId);
    clearSessionCookie(response);
  }

  @Get("me")
  async me(@CurrentUser() auth: AuthContext) {
    return this.authService.me(auth.profileId);
  }
}

function metaFrom(request: Request): SessionMeta {
  return {
    userAgent: request.headers["user-agent"],
    ip: clientIP(request.headers) ?? request.ip,
  };
}
