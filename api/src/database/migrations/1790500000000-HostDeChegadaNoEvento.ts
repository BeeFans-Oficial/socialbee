import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Por qual endereço a visita chegou.
 *
 * O evento guarda `profile_id`, e com o pool de domínios o endereço só seria
 * alcançável por junção: evento → perfil → domínio. Essa junção devolve o
 * domínio **de agora**, não o da época do evento.
 *
 * A consequência aparece no pior momento possível. Uma criadora é bloqueada no
 * domínio A e migra para o B. No instante da migração todo o histórico dela
 * passa a contar como tráfego do B: o domínio A perde a queda que provava o
 * bloqueio, e o B ganha uma linha de base que nunca viveu. O sinal que serviria
 * para detectar o próximo bloqueio se apaga exatamente quando seria usado.
 *
 * Por isso a coluna entra ANTES de o pool existir: dado que não se coleta hoje
 * não existe amanhã, e uma linha de base precisa de história.
 *
 * Nula para todo evento anterior a esta migration, e nula continua sendo válido
 * — é o que o `retention.service.ts` vai apagar sozinho em 90 dias.
 */
export class HostDeChegadaNoEvento1790500000000 implements MigrationInterface {
  name = "HostDeChegadaNoEvento1790500000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "tracking_events" ADD COLUMN "arrival_host" text
    `);

    // A consulta da Fase D é sempre "quanto tráfego este domínio recebeu neste
    // período". Sem o índice ela varre a tabela inteira de eventos, que é a
    // maior do sistema e cresce com o produto.
    await queryRunner.query(`
      CREATE INDEX "idx_tracking_events_arrival_occurred"
        ON "tracking_events" ("arrival_host", "occurred_at")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_tracking_events_arrival_occurred"`);
    await queryRunner.query(`ALTER TABLE "tracking_events" DROP COLUMN IF EXISTS "arrival_host"`);
  }
}
