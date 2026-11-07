import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Histórico do simulador da revisão da Meta.
 *
 * Uma linha por rodada: manual (a criadora clicou em "revisar") ou do cron
 * da madrugada. Guarda o veredito e os itens inteiros em JSON: a tela mostra
 * a última, o admin lista as vermelhas, e o e-mail de "piorou" compara a
 * atual com a anterior. Nada aqui é fonte de verdade de nada — é registro
 * do que foi observado naquela hora, e expira em 90 dias (`retention`).
 */
export class RevisaoDaMeta1791200000000 implements MigrationInterface {
  name = "RevisaoDaMeta1791200000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "page_reviews" (
        "id"         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
        "profile_id" uuid        NOT NULL REFERENCES "profiles"("id") ON DELETE CASCADE,
        -- 'verde', 'amarelo' ou 'vermelho'. Texto, como os outros estados.
        "verdict"    text        NOT NULL,
        -- 'manual' (a criadora) ou 'cron' (a madrugada).
        "trigger"    text        NOT NULL,
        -- Os itens verificados, com estado, título, detalhe e ação.
        "items"      jsonb       NOT NULL DEFAULT '[]'::jsonb,
        "ran_at"     timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_page_reviews_profile_ran" ON "page_reviews" ("profile_id", "ran_at" DESC)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "page_reviews"`);
  }
}
