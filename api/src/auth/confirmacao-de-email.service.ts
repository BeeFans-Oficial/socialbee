import { createHash, randomBytes } from "node:crypto";

import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import { DataSource } from "typeorm";

import { EmailService } from "../common/email/email.service";
import { boasVindas } from "../common/email/modelos/boas-vindas";
import { convite } from "../common/email/modelos/convite";
import { loadEnv } from "../config/env";

/** Quanto tempo o link de confirmação vale. */
export const VALIDADE_EM_HORAS = 24;
/** O convite espera mais: a parceira pode abrir o e-mail dias depois. */
export const VALIDADE_DO_CONVITE_EM_DIAS = 7;

const PROPOSITO = "confirm_email";
/** Criar a senha pelo convite — e, no futuro, redefinir pelo "esqueci". */
const PROPOSITO_SENHA = "set_password";

/**
 * Confirmação do e-mail da conta: emitir o token, mandar o e-mail, consumir
 * o token.
 *
 * O token cru (32 bytes aleatórios) só existe no link. A tabela guarda o
 * SHA-256 dele; para confirmar, o hash do que veio na URL é procurado pela
 * chave única. Emitir um token novo invalida os anteriores da conta, então
 * "reenviar" nunca deixa dois links válidos ao mesmo tempo.
 *
 * O envio é **fora** da transação do cadastro e **fora** do caminho da
 * resposta (`enviarBoasVindas` não é aguardado): o Resend fora do ar não
 * pode impedir ninguém de criar conta.
 */
@Injectable()
export class ConfirmacaoDeEmailService {
  private readonly logger = new Logger(ConfirmacaoDeEmailService.name);

  constructor(
    @InjectDataSource() private readonly db: DataSource,
    private readonly emails: EmailService,
  ) {}

  /** Dispara e esquece. Qualquer falha vai para o log, nunca para quem chamou. */
  enviarBoasVindas(user: { id: string; email: string }, nome: string | null): void {
    void this.emitirEEnviar(user, nome).catch((error) => {
      this.logger.error(`boas-vindas para ${user.email} falhou: ${error instanceof Error ? error.message : String(error)}`);
    });
  }

  /** "Reenviar" por e-mail, sem sessão. Silencioso para e-mail desconhecido
   *  ou já confirmado: a resposta é a mesma, e nada vaza. */
  async reenviarPorEmail(emailBruto: string): Promise<void> {
    const email = (emailBruto ?? "").trim().toLowerCase();
    if (!email) return;
    const [user] = await this.db.query<
      { id: string; email: string; email_confirmed_at: Date | null; password_hash: string | null; nome: string | null }[]
    >(
      `
      SELECT u.id, u.email, u.email_confirmed_at, u.password_hash,
             (SELECT p.display_name FROM profiles p WHERE p.user_id = u.id ORDER BY p.created_at LIMIT 1) AS nome
        FROM users u
       WHERE u.email = $1
      `,
      [email],
    );
    if (!user) return;
    // Conta aberta pelo admin, ainda sem senha: o que falta é o convite.
    if (user.password_hash === null) {
      await this.enviarConviteAgora({ id: user.id, email: user.email });
      return;
    }
    if (user.email_confirmed_at) return;
    await this.emitirEEnviar({ id: user.id, email: user.email }, user.nome);
  }

  /** Convite da conta aberta pelo admin: "crie a sua senha". Dispara e esquece. */
  enviarConvite(user: { id: string; email: string }): void {
    void this.enviarConviteAgora(user).catch((error) => {
      this.logger.error(`convite para ${user.email} falhou: ${error instanceof Error ? error.message : String(error)}`);
    });
  }

  async enviarConviteAgora(user: { id: string; email: string }): Promise<void> {
    const token = await this.emitirToken(user.id, PROPOSITO_SENHA, VALIDADE_DO_CONVITE_EM_DIAS * 24);
    const env = loadEnv();
    await this.emails.enviar(
      convite({
        para: user.email,
        linkParaCriarSenha: `${env.publicSiteUrl}/definir-senha?token=${token}`,
        siteUrl: env.publicSiteUrl,
        validadeEmDias: VALIDADE_DO_CONVITE_EM_DIAS,
      }),
    );
  }

  /** Só olha, não consome: a tela de criar senha pergunta antes de mostrar
   *  o formulário, para um link morto não virar "digite a senha… ah, não". */
  async tokenDeSenhaValido(tokenCru: string): Promise<boolean> {
    const limpo = (tokenCru ?? "").trim();
    if (!/^[A-Za-z0-9_-]{32,64}$/.test(limpo)) return false;
    const [linha] = await this.db.query<{ ok: boolean }[]>(
      `SELECT (used_at IS NULL AND expires_at > now()) AS ok FROM email_tokens WHERE token_hash = $1 AND purpose = $2`,
      [sha256(limpo), PROPOSITO_SENHA],
    );
    return Boolean(linha?.ok);
  }

  /**
   * Consome o token de senha (convite ou, no futuro, "esqueci"). Ao contrário
   * do de confirmação, usado é usado: o link que já criou uma senha não pode
   * criar outra.
   */
  async consumirTokenDeSenha(tokenCru: string): Promise<{ userId: string; email: string }> {
    const limpo = (tokenCru ?? "").trim();
    if (!/^[A-Za-z0-9_-]{32,64}$/.test(limpo)) {
      throw new BadRequestException({ code: "token_invalido", message: "Esse link não é válido." });
    }
    const [linha] = await this.db.query<{ id: string; user_id: string; expires_at: Date; used_at: Date | null; email: string }[]>(
      `
      SELECT t.id, t.user_id, t.expires_at, t.used_at, u.email
        FROM email_tokens t
        JOIN users u ON u.id = t.user_id
       WHERE t.token_hash = $1 AND t.purpose = $2
      `,
      [sha256(limpo), PROPOSITO_SENHA],
    );
    if (!linha) throw new BadRequestException({ code: "token_invalido", message: "Esse link não é válido." });
    if (linha.used_at || new Date(linha.expires_at).getTime() <= Date.now()) {
      throw new BadRequestException({ code: "token_expirado", message: "Esse link venceu ou já foi usado. Peça outro à equipe." });
    }
    await this.db.query(`UPDATE email_tokens SET used_at = now() WHERE id = $1`, [linha.id]);
    return { userId: linha.user_id, email: linha.email };
  }

  /**
   * Consome o token do link.
   *
   * Link clicado pela segunda vez (o Gmail pré-carrega, a pessoa reabre o
   * e-mail) responde sucesso se a conta já está confirmada: o que ela queria
   * já aconteceu, e "link inválido" nessa hora só assusta.
   */
  async confirmar(tokenCru: string): Promise<{ email: string; jaConfirmado: boolean }> {
    const limpo = (tokenCru ?? "").trim();
    if (!/^[A-Za-z0-9_-]{32,64}$/.test(limpo)) {
      throw new BadRequestException({ code: "token_invalido", message: "Esse link não é válido." });
    }
    const hash = sha256(limpo);
    const [linha] = await this.db.query<
      { id: string; user_id: string; expires_at: Date; used_at: Date | null; email: string; email_confirmed_at: Date | null }[]
    >(
      `
      SELECT t.id, t.user_id, t.expires_at, t.used_at, u.email, u.email_confirmed_at
        FROM email_tokens t
        JOIN users u ON u.id = t.user_id
       WHERE t.token_hash = $1 AND t.purpose = $2
      `,
      [hash, PROPOSITO],
    );
    if (!linha) {
      throw new BadRequestException({ code: "token_invalido", message: "Esse link não é válido." });
    }
    if (linha.used_at || new Date(linha.expires_at).getTime() <= Date.now()) {
      if (linha.email_confirmed_at) return { email: linha.email, jaConfirmado: true };
      throw new BadRequestException({
        code: "token_expirado",
        message: "Esse link venceu. Peça outro em Configurações, dentro do painel.",
      });
    }

    await this.db.transaction(async (tx) => {
      await tx.query(`UPDATE email_tokens SET used_at = now() WHERE id = $1`, [linha.id]);
      await tx.query(`UPDATE users SET email_confirmed_at = coalesce(email_confirmed_at, now()) WHERE id = $1`, [linha.user_id]);
    });
    this.logger.log(`e-mail confirmado: ${linha.user_id}`);
    return { email: linha.email, jaConfirmado: Boolean(linha.email_confirmed_at) };
  }

  private async emitirEEnviar(user: { id: string; email: string }, nome: string | null): Promise<void> {
    const token = await this.emitirToken(user.id);
    const env = loadEnv();
    const mensagem = boasVindas({
      para: user.email,
      nome,
      linkDeConfirmacao: `${env.publicSiteUrl}/confirmar-email?token=${token}`,
      siteUrl: env.publicSiteUrl,
      validadeEmHoras: VALIDADE_EM_HORAS,
    });
    await this.emails.enviar(mensagem);
  }

  /** Um token válido por conta e propósito: os anteriores não usados são encerrados. */
  private async emitirToken(userId: string, purpose: string = PROPOSITO, validadeEmHoras: number = VALIDADE_EM_HORAS): Promise<string> {
    const token = randomBytes(32).toString("base64url");
    await this.db.transaction(async (tx) => {
      await tx.query(`UPDATE email_tokens SET used_at = now() WHERE user_id = $1 AND purpose = $2 AND used_at IS NULL`, [userId, purpose]);
      await tx.query(
        `INSERT INTO email_tokens (user_id, purpose, token_hash, expires_at) VALUES ($1, $2, $3, now() + make_interval(hours => $4))`,
        [userId, purpose, sha256(token), validadeEmHoras],
      );
    });
    return token;
  }
}

function sha256(valor: string): string {
  return createHash("sha256").update(valor).digest("hex");
}
