import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { InjectRepository } from "@nestjs/typeorm";
import { LessThan, Repository } from "typeorm";

import { loadEnv } from "../config/env";
import { TrackingEvent } from "./entities/tracking-event.entity";

/**
 * Expurgo do evento cru.
 *
 * A janela de 90 dias é a mesma escolha do projeto de referência e cobre com
 * folga a janela de atribuição das redes. Passado isso, o evento vai embora e
 * o número **continua** em `link_counters` — é a razão de o contador existir.
 *
 * Roda de madrugada porque é um `DELETE` de volume, e roda pela aplicação em
 * vez de por `pg_cron` para o comportamento ser o mesmo em qualquer Postgres,
 * inclusive o do compose local.
 *
 * O mesmo DML está disponível como script (`npm run retention`), para quem
 * precisar rodar à mão sem esperar o horário.
 */
@Injectable()
export class RetentionService {
  private readonly logger = new Logger(RetentionService.name);

  constructor(
    @InjectRepository(TrackingEvent) private readonly events: Repository<TrackingEvent>,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_4AM)
  async purgeExpiredEvents(): Promise<number> {
    const days = loadEnv().trackingEventTtlDays;
    const cutoff = new Date(Date.now() - days * 86_400_000);

    const result = await this.events.delete({ occurredAt: LessThan(cutoff) });
    const removed = result.affected ?? 0;

    if (removed > 0) {
      this.logger.log(`${removed} evento(s) anteriores a ${cutoff.toISOString()} expurgados`);
    }
    return removed;
  }

  /** Tokens de e-mail vencidos ou usados há mais de 7 dias. Pequeno, mas
   *  cresce um por cadastro e um por "reenviar", para sempre, sem isto. */
  @Cron(CronExpression.EVERY_DAY_AT_4AM)
  async purgeEmailTokens(): Promise<void> {
    await this.events.manager.query(
      `DELETE FROM email_tokens WHERE coalesce(used_at, expires_at) < now() - interval '7 days'`,
    );
  }

  /**
   * Conta criada e nunca confirmada em 7 dias: apagada, para o e-mail e o
   * endereço da página voltarem a ficar livres. Conta aberta pelo admin
   * (há `conta.criar` na auditoria) fica — foi a equipe que a quis.
   */
  @Cron(CronExpression.EVERY_DAY_AT_4AM)
  async purgeUnconfirmedAccounts(): Promise<void> {
    await this.events.manager.query(SQL_EXPURGO_DE_NAO_CONFIRMADAS);
  }
}

export const SQL_EXPURGO_DE_NAO_CONFIRMADAS = `
  DELETE FROM users u
   WHERE u.email_confirmed_at IS NULL
     AND u.role = 'creator'
     AND u.created_at < now() - interval '7 days'
     AND NOT EXISTS (
       SELECT 1 FROM admin_actions a
        WHERE a.target_user_id = u.id AND a.action = 'conta.criar'
     )
`;
