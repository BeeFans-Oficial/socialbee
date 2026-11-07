import { Injectable, Logger } from "@nestjs/common";
import { Resend } from "resend";

import { loadEnv } from "../../config/env";

export interface Mensagem {
  para: string;
  assunto: string;
  html: string;
  texto: string;
}

/** Quem leva a mensagem. Resend em produção; em dev e teste, o log. */
export interface TransporteDeEmail {
  readonly nome: string;
  enviar(mensagem: Mensagem, remetente: { from: string; replyTo?: string }): Promise<void>;
}

/**
 * E-mail transacional.
 *
 * Um método só, `enviar`, e uma regra: **nunca lança**. Quem chama é o
 * cadastro, e cadastro não pode falhar porque o provedor de e-mail está
 * fora. O erro vai para o log com o destinatário e o assunto; a pessoa
 * tem o botão "reenviar" no painel.
 *
 * Sem `RESEND_API_KEY` (dev e teste) o transporte é o de log: a mensagem
 * é escrita no console e guardada em memória, de onde o teste de ponta a
 * ponta lê o link de confirmação. Em produção a chave é obrigatória
 * (`config/env.ts`), pela mesma regra dos outros segredos.
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly transporte: TransporteDeEmail;
  private readonly remetente: { from: string; replyTo?: string };

  constructor() {
    const env = loadEnv();
    this.remetente = { from: env.emailFrom, replyTo: env.emailReplyTo };
    this.transporte = env.resendApiKey ? new TransporteResend(env.resendApiKey) : new TransporteDeLog(this.logger);
    this.logger.log(`transporte de e-mail: ${this.transporte.nome}, de ${env.emailFrom}`);
  }

  /** `true` se o transporte aceitou. `false` já foi registrado no log. */
  async enviar(mensagem: Mensagem): Promise<boolean> {
    try {
      await this.transporte.enviar(mensagem, this.remetente);
      return true;
    } catch (error) {
      this.logger.error(
        `falha ao enviar "${mensagem.assunto}" para ${mensagem.para}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return false;
    }
  }

  /** Só o transporte de log tem isto: as mensagens que "enviou", mais
   *  recente por último. Para o teste de ponta a ponta. */
  get enviados(): Mensagem[] {
    return this.transporte instanceof TransporteDeLog ? this.transporte.mensagens : [];
  }
}

class TransporteResend implements TransporteDeEmail {
  readonly nome = "resend";
  private readonly resend: Resend;

  constructor(apiKey: string) {
    this.resend = new Resend(apiKey);
  }

  async enviar(mensagem: Mensagem, remetente: { from: string; replyTo?: string }): Promise<void> {
    const { error } = await this.resend.emails.send({
      from: remetente.from,
      to: [mensagem.para],
      replyTo: remetente.replyTo,
      subject: mensagem.assunto,
      html: mensagem.html,
      text: mensagem.texto,
    });
    // O SDK devolve o erro em vez de lançar; aqui vira exceção para o
    // `EmailService` tratar num lugar só.
    if (error) throw new Error(`${error.name}: ${error.message}`);
  }
}

class TransporteDeLog implements TransporteDeEmail {
  readonly nome = "log (sem RESEND_API_KEY)";
  readonly mensagens: Mensagem[] = [];

  constructor(private readonly logger: Logger) {}

  async enviar(mensagem: Mensagem): Promise<void> {
    this.mensagens.push(mensagem);
    if (this.mensagens.length > 50) this.mensagens.shift();
    this.logger.log(`[e-mail não enviado] para ${mensagem.para} · "${mensagem.assunto}"\n${mensagem.texto}`);
  }
}
