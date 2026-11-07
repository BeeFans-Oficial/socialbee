import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Confirmação do e-mail da conta.
 *
 * ## `users.email_confirmed_at`
 *
 * Nulo até a pessoa clicar no link que recebeu. Data, e não booleano, pelo
 * mesmo motivo de `age_confirmed_at`: é registro de um fato, e "quando" faz
 * parte dele.
 *
 * O login recusa conta não confirmada (`AuthService.login`). Por isso as
 * contas que já existiam antes desta migration recebem `created_at` como
 * data: elas entraram pela regra antiga e trancá-las para fora no deploy
 * não é opção. O valor diz "aceita antes da confirmação existir".
 *
 * ## `users.password_hash` nulo
 *
 * Conta criada pelo admin fica sem senha até a pessoa escolher a dela pelo
 * convite. Senha definida pelo admin era senha conhecida por duas pessoas.
 *
 * ## `email_tokens`
 *
 * Um token por e-mail enviado (`purpose`: `confirm_email` no cadastro,
 * `set_password` no convite e, depois, na recuperação de senha). Guarda o SHA-256 do token, nunca o token: um
 * vazamento desta tabela não confirma conta nenhuma. `purpose` é texto para a
 * recuperação de senha reaproveitar a tabela sem migration. `used_at` marca o
 * consumo; o link clicado duas vezes é reconhecido, não recusado.
 */
export class ConfirmacaoDeEmail1791100000000 implements MigrationInterface {
  name = "ConfirmacaoDeEmail1791100000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
        ADD COLUMN "email_confirmed_at" timestamptz
    `);
    await queryRunner.query(`
      UPDATE "users" SET "email_confirmed_at" = "created_at"
    `);

    // Conta aberta pelo admin nasce SEM senha: a pessoa cria a dela pelo
    // link do convite (`/definir-senha`). Até lá, o login não entra — a
    // comparação contra o hash de descarte falha como senha errada.
    await queryRunner.query(`
      ALTER TABLE "users" ALTER COLUMN "password_hash" DROP NOT NULL
    `);

    await queryRunner.query(`
      CREATE TABLE "email_tokens" (
        "id"         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id"    uuid        NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        -- 'confirm_email' hoje; 'reset_password' quando existir.
        "purpose"    text        NOT NULL,
        -- SHA-256 (hex) do token que foi no link. O token cru não é guardado.
        "token_hash" text        NOT NULL,
        "expires_at" timestamptz NOT NULL,
        "used_at"    timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "uq_email_tokens_token_hash" UNIQUE ("token_hash")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_email_tokens_user_purpose" ON "email_tokens" ("user_id", "purpose")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "email_tokens"`);
    await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "password_hash" SET NOT NULL`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "email_confirmed_at"`);
  }
}
