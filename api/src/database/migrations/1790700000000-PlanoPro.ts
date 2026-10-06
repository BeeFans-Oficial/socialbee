import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Planos Free e Pro.
 *
 * ## Por que uma data e não um booleano
 *
 * `users.pro_until` diz ATÉ QUANDO a conta é Pro. Vencida a data, ela é Free —
 * sem job, sem webhook de cancelamento, sem ninguém lembrar de desligar. Um
 * booleano `is_pro` exigiria alguém (ou algo) para virá-lo de volta, e o dia em
 * que esse algo falhar é o dia em que a conta fica Pro para sempre de graça.
 *
 * ## Por que uma tabela de concessões
 *
 * `pro_until` é só a cópia do maior `ends_at` em `plan_grants`, para a leitura
 * do plano não precisar de agregação a cada requisição. A tabela é o registro:
 * quem liberou, por quê, por qual caminho (manual ou assinatura). Sem ela, a
 * pergunta "por que esta conta é Pro?" não tem resposta.
 *
 * ## Transição das contas existentes
 *
 * Até aqui toda conta tinha tudo. Virar Free no dia da publicação tiraria de
 * uma vez modelo, cores e cloaking de quem já usa — sem aviso. Cada conta que
 * existe ganha **30 dias de Pro**, registrados como concessão manual, para dar
 * tempo de a criadora decidir.
 */
export class PlanoPro1790700000000 implements MigrationInterface {
  name = "PlanoPro1790700000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users" ADD COLUMN "pro_until" timestamptz
    `);

    await queryRunner.query(`
      CREATE TABLE "plan_grants" (
        "id"         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id"    uuid        NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        -- 'manual': a equipe liberou. 'subscription': veio de um pagamento.
        "source"     text        NOT NULL,
        "starts_at"  timestamptz NOT NULL,
        "ends_at"    timestamptz NOT NULL,
        -- Texto livre de quem liberou. Obrigatório no script, opcional aqui
        -- porque a assinatura não tem um "motivo" além do próprio pagamento.
        "reason"     text,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "plan_grants_source" CHECK ("source" IN ('manual', 'subscription')),
        CONSTRAINT "plan_grants_periodo" CHECK ("ends_at" > "starts_at")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_plan_grants_user_id" ON "plan_grants" ("user_id")
    `);

    await queryRunner.query(`
      INSERT INTO "plan_grants" ("user_id", "source", "starts_at", "ends_at", "reason")
      SELECT "id", 'manual', now(), now() + interval '30 days',
             'Transição para os planos: 30 dias de Pro para contas existentes.'
        FROM "users"
    `);
    await queryRunner.query(`
      UPDATE "users" SET "pro_until" = now() + interval '30 days'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "plan_grants"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "pro_until"`);
  }
}
