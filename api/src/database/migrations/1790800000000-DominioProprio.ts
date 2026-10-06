import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Domínio próprio: a criadora conecta um domínio dela.
 *
 * Reaproveita a tabela `domains` do pool em vez de criar outra: um domínio
 * próprio é servido exatamente como um do pool (mesmo `server_name`, mesmo
 * certificado, mesma coluna `profiles.domain_id`). O que muda é de quem ele é e
 * se já está pronto.
 *
 * - `owner_user_id`: `NULL` é domínio do pool, de todo mundo. Preenchido, só a
 *   dona o vê e escolhe. Apagar a conta apaga o domínio dela, e as páginas que
 *   o usavam voltam ao padrão (`profiles.domain_id` é `ON DELETE SET NULL`).
 * - `status`: `pending` enquanto a equipe não configurou nginx e certificado;
 *   `active` depois de `npm run dominio:ativar`. Os domínios do pool já
 *   existentes nascem `active`.
 */
export class DominioProprio1790800000000 implements MigrationInterface {
  name = "DominioProprio1790800000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "domains"
        ADD COLUMN "owner_user_id" uuid REFERENCES "users"("id") ON DELETE CASCADE,
        ADD COLUMN "status" text NOT NULL DEFAULT 'active',
        ADD CONSTRAINT "domains_status" CHECK ("status" IN ('pending', 'active'))
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_domains_owner" ON "domains" ("owner_user_id")
        WHERE "owner_user_id" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_domains_owner"`);
    await queryRunner.query(`ALTER TABLE "domains" DROP CONSTRAINT IF EXISTS "domains_status"`);
    await queryRunner.query(`ALTER TABLE "domains" DROP COLUMN IF EXISTS "status"`);
    await queryRunner.query(`ALTER TABLE "domains" DROP COLUMN IF EXISTS "owner_user_id"`);
  }
}
