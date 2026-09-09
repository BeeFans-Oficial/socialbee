import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Schema inicial do BeeSocial.
 *
 * O SQL é escrito à mão, statement por statement, e não gerado a partir das
 * entidades. Isso é deliberado: o schema é o contrato mais duradouro do
 * sistema, e coisa que um gerador não expressa está aqui —
 *
 *   - `CHECK` de formato em slug, email, código curto e esquema do destino, para
 *     o dado ser válido mesmo quando a escrita não passa pela API (seed, script,
 *     psql na madrugada);
 *   - `ON DELETE` escolhido caso a caso, com o motivo escrito junto;
 *   - gatilho de `updated_at`, para o carimbo não depender de quem escreveu;
 *   - índices nomeados iguais aos declarados nas entidades, para não haver
 *     índice duplicado quando alguém rodar um diff no futuro.
 *
 * `gen_random_uuid()` é nativo do Postgres 13+; não precisa de `pgcrypto`.
 */
export class InitialSchema1788912000000 implements MigrationInterface {
  name = "InitialSchema1788912000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Carimbo de alteração no banco, não na aplicação: o seed e qualquer script
    // que faça UPDATE também precisam de `updated_at` correto.
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
      BEGIN
        NEW.updated_at = now();
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);

    // ---------------------------------------------------------------- users
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id"               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
        "email"            text        NOT NULL,
        "password_hash"    text        NOT NULL,
        "age_confirmed_at" timestamptz,
        "last_login_at"    timestamptz,
        "created_at"       timestamptz NOT NULL DEFAULT now(),
        "updated_at"       timestamptz NOT NULL DEFAULT now(),
        -- Unicidade é do endereço, não da capitalização digitada. Guardar
        -- sempre em minúsculas é o que faz o índice único valer de verdade.
        CONSTRAINT "users_email_lowercase" CHECK ("email" = lower("email")),
        CONSTRAINT "users_email_format"
          CHECK ("email" ~ '^[^@[:space:]]+@[^@[:space:]]+\\.[^@[:space:]]+$'),
        -- Nunca uma senha em claro: hash de bcrypt tem 60 caracteres.
        CONSTRAINT "users_password_hash_len" CHECK (length("password_hash") >= 20)
      )
    `);
    await queryRunner.query(`CREATE UNIQUE INDEX "uq_users_email" ON "users" ("email")`);
    await queryRunner.query(`
      CREATE TRIGGER "trg_users_updated_at" BEFORE UPDATE ON "users"
      FOR EACH ROW EXECUTE FUNCTION set_updated_at()
    `);

    // ------------------------------------------------------------- sessions
    await queryRunner.query(`
      CREATE TABLE "sessions" (
        "id"         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id"    uuid        NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "expires_at" timestamptz NOT NULL,
        "revoked_at" timestamptz,
        "user_agent" text,
        "ip_prefix"  text,
        "created_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`CREATE INDEX "idx_sessions_user_id" ON "sessions" ("user_id")`);

    // ------------------------------------------------------------- profiles
    await queryRunner.query(`
      CREATE TABLE "profiles" (
        "id"           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id"      uuid        NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "slug"         text        NOT NULL,
        "display_name" text        NOT NULL,
        "bio"          text        NOT NULL DEFAULT '',
        "avatar_url"   text,
        "cover_url"    text,
        "theme_id"     text        NOT NULL DEFAULT 'neon-pink',
        "button_style" text        NOT NULL DEFAULT 'soft',
        "is_adult"     boolean     NOT NULL DEFAULT false,
        "created_at"   timestamptz NOT NULL DEFAULT now(),
        "updated_at"   timestamptz NOT NULL DEFAULT now(),
        -- Mesmo formato que o front valida em validateSlug(). Aqui vale para
        -- qualquer caminho de escrita, não só para o formulário.
        CONSTRAINT "profiles_slug_format" CHECK ("slug" ~ '^[a-z0-9-]{3,30}$'),
        CONSTRAINT "profiles_display_name_not_blank" CHECK (btrim("display_name") <> '')
      )
    `);
    await queryRunner.query(`CREATE UNIQUE INDEX "uq_profiles_slug" ON "profiles" ("slug")`);
    await queryRunner.query(`CREATE INDEX "idx_profiles_user_id" ON "profiles" ("user_id")`);
    await queryRunner.query(`
      CREATE TRIGGER "trg_profiles_updated_at" BEFORE UPDATE ON "profiles"
      FOR EACH ROW EXECUTE FUNCTION set_updated_at()
    `);

    // ---------------------------------------------------------------- links
    await queryRunner.query(`
      CREATE TABLE "links" (
        "id"              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
        "profile_id"      uuid        NOT NULL REFERENCES "profiles"("id") ON DELETE CASCADE,
        "title"           text        NOT NULL,
        "subtitle"        text,
        "thumbnail_url"   text,
        "platform"        text        NOT NULL DEFAULT 'custom',
        "short_code"      text        NOT NULL,
        "destination_url" text        NOT NULL,
        "is_active"       boolean     NOT NULL DEFAULT true,
        "position"        integer     NOT NULL DEFAULT 0,
        "cloak_enabled"   boolean     NOT NULL DEFAULT false,
        "appearance"      jsonb       NOT NULL DEFAULT '{}'::jsonb,
        "created_at"      timestamptz NOT NULL DEFAULT now(),
        "updated_at"      timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "links_title_not_blank" CHECK (btrim("title") <> ''),
        -- Um javascript: gravado no cadastro viraria XSS na hora do salto.
        -- A API valida no DTO; o banco garante para os outros caminhos.
        CONSTRAINT "links_destination_scheme" CHECK ("destination_url" ~* '^https?://'),
        CONSTRAINT "links_short_code_format" CHECK ("short_code" ~ '^[A-Za-z0-9]{4,32}$'),
        CONSTRAINT "links_position_non_negative" CHECK ("position" >= 0)
      )
    `);
    // Único no sistema inteiro, não por perfil: o código curto é endereço
    // público (`/r/<code>`) e não tem namespace.
    await queryRunner.query(`CREATE UNIQUE INDEX "uq_links_short_code" ON "links" ("short_code")`);
    await queryRunner.query(
      `CREATE INDEX "idx_links_profile_position" ON "links" ("profile_id", "position")`,
    );
    await queryRunner.query(`
      CREATE TRIGGER "trg_links_updated_at" BEFORE UPDATE ON "links"
      FOR EACH ROW EXECUTE FUNCTION set_updated_at()
    `);

    // ----------------------------------------------------------- safe_pages
    await queryRunner.query(`
      CREATE TABLE "safe_pages" (
        "id"         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
        "link_id"    uuid        NOT NULL UNIQUE REFERENCES "links"("id") ON DELETE CASCADE,
        "created_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "safe_page_social_links" (
        "id"           uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
        "safe_page_id" uuid    NOT NULL REFERENCES "safe_pages"("id") ON DELETE CASCADE,
        "platform"     text    NOT NULL,
        "url"          text    NOT NULL,
        "title"        text    NOT NULL DEFAULT '',
        "position"     integer NOT NULL DEFAULT 0,
        CONSTRAINT "safe_page_social_links_url_scheme" CHECK ("url" ~* '^https?://')
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_safe_page_social_links_page"
        ON "safe_page_social_links" ("safe_page_id", "position")
    `);

    // ------------------------------------------------------- tracking_events
    await queryRunner.query(`
      CREATE TABLE "tracking_events" (
        "id"               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
        "type"             text        NOT NULL,
        "profile_id"       uuid        NOT NULL REFERENCES "profiles"("id") ON DELETE CASCADE,
        -- SET NULL, não CASCADE: apagar um link não pode derrubar o total de
        -- cliques do período. A quebra por link perde a linha; o total fica.
        "link_id"          uuid        REFERENCES "links"("id") ON DELETE SET NULL,
        "channel"          text,
        "destination_host" text,
        "occurred_at"      timestamptz NOT NULL DEFAULT now(),
        "attribution"      jsonb       NOT NULL DEFAULT '{}'::jsonb,
        "client"           jsonb       NOT NULL DEFAULT '{}'::jsonb
      )
    `);
    // O relatório sempre filtra por perfil E janela de tempo — nesta ordem.
    await queryRunner.query(`
      CREATE INDEX "idx_tracking_events_profile_occurred"
        ON "tracking_events" ("profile_id", "occurred_at")
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_tracking_events_link" ON "tracking_events" ("link_id")`,
    );

    // --------------------------------------------------------- link_counters
    await queryRunner.query(`
      CREATE TABLE "link_counters" (
        "profile_id"    uuid   NOT NULL REFERENCES "profiles"("id") ON DELETE CASCADE,
        -- CASCADE aqui: o contador é daquele link. Órfão viraria linha de
        -- relatório sem título que ninguém sabe interpretar.
        "link_id"       uuid   NOT NULL REFERENCES "links"("id") ON DELETE CASCADE,
        "clicks"        bigint NOT NULL DEFAULT 0,
        "bot_hits"      bigint NOT NULL DEFAULT 0,
        "last_click_at" timestamptz,
        PRIMARY KEY ("profile_id", "link_id"),
        CONSTRAINT "link_counters_non_negative" CHECK ("clicks" >= 0 AND "bot_hits" >= 0)
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "link_counters"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "tracking_events"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "safe_page_social_links"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "safe_pages"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "links"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "profiles"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "sessions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "users"`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS set_updated_at()`);
  }
}
