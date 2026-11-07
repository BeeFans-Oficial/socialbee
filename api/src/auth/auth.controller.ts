import { Body, Controller, Get, HttpCode, Post, Req, Res } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import type { Request, Response } from "express";

import { CurrentUser, type AuthContext } from "../common/decorators/current-user.decorator";
import { SemPagina } from "../common/decorators/sem-pagina.decorator";
import { Public } from "../common/decorators/public.decorator";
import { loadEnv } from "../config/env";
import { clientIP } from "../tracking/attribution";
import { AuthService, type SessionMeta } from "./auth.service";
import { ConfirmacaoDeEmailService } from "./confirmacao-de-email.service";
import { clearSessionCookie, setSessionCookie } from "./cookies";
import { DefinirSenhaDto } from "./dto/definir-senha.dto";
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
/**
 * Teto das rotas de credencial. No teste de ponta a ponta a suíte inteira
 * roda em segundos e entra dezenas de vezes do mesmo IP; o limite real
 * derrubaria o teste, não um ataque. `loadEnv()` já foi chamado antes de
 * este módulo carregar (é por isso que o teste importa o `AppModule` tarde).
 */
const LIMITE_DE_AUTH = loadEnv().nodeEnv === "test" ? 1000 : 5;

@Controller("auth")
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly confirmacao: ConfirmacaoDeEmailService,
  ) {}

  /** Cria a conta e manda o e-mail. Não devolve sessão nem cookie: a pessoa
   *  entra pelo login depois de confirmar o e-mail. */
  @Public()
  @Throttle({ default: { limit: LIMITE_DE_AUTH, ttl: 60_000 } })
  @Post("register")
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Public()
  @Throttle({ default: { limit: LIMITE_DE_AUTH, ttl: 60_000 } })
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
  @SemPagina()
  async logout(
    @CurrentUser() auth: AuthContext,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.authService.logout(auth.sessionId);
    clearSessionCookie(response);
  }

  /**
   * O clique no link do e-mail. Pública: quem clica pode não estar logada
   * (outro aparelho, outro navegador). Limite apertado porque o token é
   * adivinhável só em teoria — 32 bytes — e nem assim vale deixar tentar.
   */
  @Public()
  @Throttle({ default: { limit: LIMITE_DE_AUTH * 2, ttl: 60_000 } })
  @Post("email/confirmar")
  @HttpCode(200)
  confirmarEmail(@Body() body: { token?: string }) {
    return this.confirmacao.confirmar(body?.token ?? "");
  }

  /**
   * "Reenviar" das telas de cadastro e login, por e-mail, sem sessão (quem
   * não confirmou não consegue entrar). Responde 200 sempre — e-mail que não
   * existe ou já confirmado também — para não virar oráculo de quem tem
   * conta. Três por dez minutos por IP.
   */
  @Public()
  @Throttle({ default: { limit: loadEnv().nodeEnv === "test" ? 1000 : 3, ttl: 600_000 } })
  @Post("email/reenviar")
  @HttpCode(200)
  async reenviarConfirmacao(@Body() body: { email?: string }) {
    await this.confirmacao.reenviarPorEmail(body?.email ?? "");
    return { enviado: true };
  }

  /** A tela de criar senha pergunta se o link ainda vale antes de mostrar o
   *  formulário. Não consome o token. */
  @Public()
  @Throttle({ default: { limit: LIMITE_DE_AUTH * 2, ttl: 60_000 } })
  @Post("senha/verificar")
  @HttpCode(200)
  async verificarLinkDeSenha(@Body() body: { token?: string }) {
    return { valido: await this.confirmacao.tokenDeSenhaValido(body?.token ?? "") };
  }

  /** O link do convite: cria a senha e já entra. Pública, com o teto das
   *  rotas de credencial. */
  @Public()
  @Throttle({ default: { limit: LIMITE_DE_AUTH, ttl: 60_000 } })
  @Post("senha/definir")
  @HttpCode(200)
  async definirSenha(@Body() dto: DefinirSenhaDto, @Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const result = await this.authService.definirSenhaPeloLink(dto, metaFrom(request));
    setSessionCookie(response, result.accessToken, result.expiresAt);
    return {
      user: result.user,
      profile: result.profile,
      accessToken: result.accessToken,
      expiresAt: result.expiresAt.toISOString(),
    };
  }

  @Get("me")
  @SemPagina()
  async me(@CurrentUser() auth: AuthContext) {
    return this.authService.me(auth.userId, auth.profileId || null);
  }
}

function metaFrom(request: Request): SessionMeta {
  return {
    userAgent: request.headers["user-agent"],
    ip: clientIP(request.headers) ?? request.ip,
  };
}
