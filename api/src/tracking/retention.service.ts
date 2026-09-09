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
}
