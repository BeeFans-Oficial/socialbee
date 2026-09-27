import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Pool de domínios: a página escolhe em qual endereço é servida.
 *
 * O produto vive de links colados na bio do Instagram, e domínio de link na
 * bio de criadora adulta é consumível — uma hora é bloqueado. Quando isso
 * acontece, todas as criadoras naquele domínio somem de uma vez, e sem uma
 * saída de autoatendimento a resposta vira fila no suporte.
 *
 * O catálogo mora no BANCO e não no código de propósito: domínio novo entra
 * sem deploy, e um domínio queimado se desativa na hora — que é exatamente o
 * momento em que ninguém quer esperar por um build.
 *
 * ## O que esta migration NÃO faz
 *
 * Não cadastra domínio nenhum. `profiles.domain_id` nasce nulo e nulo significa
 * "o domínio padrão da instalação" (`PUBLIC_SITE_URL`) — que é o comportamento
 * de hoje, byte a byte. Cadastrar um domínio é decisão de operação e exige DNS
 * e certificado antes; um `INSERT` aqui prometeria um endereço que ainda não
 * responde.
 *
 * ## `ON DELETE SET NULL`, e não CASCADE
 *
 * Apagar um domínio **não pode** apagar as páginas servidas por ele. Elas caem
 * no domínio padrão e continuam no ar. O contrário seria a operação mais
 * destrutiva do sistema disfarçada de limpeza de catálogo.
 */
export class PoolDeDominios1790400000000 implements MigrationInterface {
  name = "PoolDeDominios1790400000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "domains" (
        "id"         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
        -- Só o host: sem esquema, sem barra, sem porta. É o que entra no
        -- server_name do nginx e o que a página usa para montar a URL.
        "host"       text        NOT NULL,
        -- Nome curto para a criadora escolher por aparência, não por técnica.
        "label"      text,
        -- Desligar é o gesto de emergência: o domínio some das opções na hora,
        -- sem derrubar as páginas que já estão nele.
        "active"     boolean     NOT NULL DEFAULT true,
        "position"   integer     NOT NULL DEFAULT 0,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        -- Formato de host, em minúsculas. O valor vira parte de uma URL
        -- pública: lixo aqui é link quebrado na bio de alguém.
        CONSTRAINT "domains_host_formato"
          CHECK ("host" ~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$')
      )
    `);

    await queryRunner.query(`CREATE UNIQUE INDEX "uq_domains_host" ON "domains" ("host")`);
    await queryRunner.query(`
      CREATE INDEX "idx_domains_active" ON "domains" ("active", "position")
    `);
    await queryRunner.query(`
      CREATE TRIGGER "trg_domains_updated_at" BEFORE UPDATE ON "domains"
      FOR EACH ROW EXECUTE FUNCTION set_updated_at()
    `);

    // `SET NULL`: domínio apagado devolve a página ao endereço padrão, nunca
    // apaga a página.
    await queryRunner.query(`
      ALTER TABLE "profiles"
        ADD COLUMN "domain_id" uuid REFERENCES "domains"("id") ON DELETE SET NULL
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_profiles_domain_id" ON "profiles" ("domain_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_profiles_domain_id"`);
    await queryRunner.query(`ALTER TABLE "profiles" DROP COLUMN IF EXISTS "domain_id"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "domains"`);
  }
}
