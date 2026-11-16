import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Dono da página: um agrupamento DENTRO da conta.
 *
 * Uma conta (um login) pode guardar páginas de várias pessoas — quem
 * administra as páginas de várias modelos entra com um email só —, e algumas
 * delas têm mais de uma página. A lista de páginas era plana; aqui nasce o
 * nível do meio: conta → dono → página.
 *
 * ## `page_owners`
 *
 * Uma tabela, e não um texto em `profiles`, porque o nome do dono se escreve
 * num lugar só: renomear é uma linha, e "Julia" e "julia " não viram dois
 * grupos. O nome é único por conta, sem diferenciar maiúsculas.
 *
 * O dono NÃO tem login, senha nem permissão: é organização. Se um dia ele
 * tiver acesso próprio, é esta linha que ganha o vínculo.
 *
 * ## `profiles.owner_id`
 *
 * Opcional. Página sem dono é um estado normal ("Sem dono"), e é como todas
 * as páginas que já existem ficam: não há preenchimento automático, porque
 * não há de onde tirar o nome. Apagar um dono não apaga página nenhuma — o
 * vínculo vira nulo (`ON DELETE SET NULL`).
 *
 * Coluna nova e opcional: o código anterior a esta migration continua
 * funcionando com ela aplicada, então o deploy e o rollback do código não
 * dependem de desfazê-la.
 */
export class DonoDaPagina1791300000000 implements MigrationInterface {
  name = "DonoDaPagina1791300000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "page_owners" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE,
        "name" text NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "page_owners_name_len" CHECK (char_length("name") BETWEEN 1 AND 60)
      )
    `);
    // Único por conta, sem diferenciar maiúsculas. Também serve de índice
    // para "os donos desta conta" (prefixo `user_id`).
    await queryRunner.query(`
      CREATE UNIQUE INDEX "uq_page_owners_user_name" ON "page_owners" ("user_id", lower("name"))
    `);
    await queryRunner.query(`
      ALTER TABLE "profiles"
        ADD COLUMN "owner_id" uuid REFERENCES "page_owners" ("id") ON DELETE SET NULL
    `);
    // Parcial: a maioria das páginas (toda conta de uma pessoa só) não tem dono.
    await queryRunner.query(`
      CREATE INDEX "idx_profiles_owner_id" ON "profiles" ("owner_id") WHERE "owner_id" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_profiles_owner_id"`);
    await queryRunner.query(`ALTER TABLE "profiles" DROP COLUMN IF EXISTS "owner_id"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "page_owners"`);
  }
}
