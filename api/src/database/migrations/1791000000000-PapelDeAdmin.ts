import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Papel na conta e auditoria das ações de admin.
 *
 * ## `users.role`
 *
 * Dois valores para começar: `creator` (padrão, toda conta que existe) e
 * `admin`. É uma coluna na própria conta, e não uma tabela de permissões,
 * porque o painel admin tem um nível só: ou a pessoa opera a plataforma, ou
 * não. O dia em que houver "suporte" e "financeiro" com telas diferentes é o
 * dia de uma tabela.
 *
 * O papel é lido do banco a cada requisição, junto com a sessão (ver
 * `AuthService.resolveSession`), nunca só do token: rebaixar um admin vale na
 * hora, sem esperar o token vencer.
 *
 * Ninguém vira admin pelo cadastro. O primeiro é promovido por script
 * (`npm run admin:promover`), e os seguintes, pelo painel, com registro.
 *
 * ## `admin_actions`
 *
 * Toda ação feita como admin — liberar ou tirar o Pro, revogar sessões,
 * promover alguém — fica aqui: quem, quando, o quê, em qual conta, com o
 * motivo. Nada é apagado desta tabela; `target_user_id` vira nulo se a conta
 * alvo for apagada, mas a linha fica. Sem isto, "por que esta conta é Pro?"
 * e "quem revogou minha sessão?" não têm resposta.
 */
export class PapelDeAdmin1791000000000 implements MigrationInterface {
  name = "PapelDeAdmin1791000000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
        ADD COLUMN "role" text NOT NULL DEFAULT 'creator'
    `);
    await queryRunner.query(`
      ALTER TABLE "users"
        ADD CONSTRAINT "users_role" CHECK ("role" IN ('creator', 'admin'))
    `);

    await queryRunner.query(`
      CREATE TABLE "admin_actions" (
        "id"                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
        -- Quem fez. Conta de admin apagada: a linha fica, com o id nulo.
        "admin_user_id"     uuid        REFERENCES "users"("id") ON DELETE SET NULL,
        -- O que fez: 'plano.liberar', 'plano.rebaixar', 'sessoes.revogar',
        -- 'admin.promover', 'admin.rebaixar'... Texto, não enum: ação nova
        -- não pode exigir migration.
        "action"            text        NOT NULL,
        -- Em qual conta, quando a ação é sobre uma conta.
        "target_user_id"    uuid        REFERENCES "users"("id") ON DELETE SET NULL,
        -- Em qual página, quando a ação é sobre uma página.
        "target_profile_id" uuid,
        -- O motivo, escrito por quem fez. Obrigatório em toda ação.
        "reason"            text        NOT NULL,
        -- O que mais importar para reconstruir a ação (dias liberados, data
        -- final, e-mail do alvo no momento, para sobreviver à exclusão).
        "details"           jsonb       NOT NULL DEFAULT '{}'::jsonb,
        "created_at"        timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_admin_actions_created_at" ON "admin_actions" ("created_at" DESC)
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_admin_actions_target_user_id" ON "admin_actions" ("target_user_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "admin_actions"`);
    await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "users_role"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "role"`);
  }
}
