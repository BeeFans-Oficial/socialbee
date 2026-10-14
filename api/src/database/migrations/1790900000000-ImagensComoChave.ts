import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * As colunas de imagem passam de `text` para `varchar(255)`.
 *
 * Até 14/10/2026 elas guardavam a imagem inteira em base64 (até 8 MB por
 * linha). Agora guardam a chave do objeto no bucket
 * (`profiles/<id>/avatar-<ts>.webp`, ~70 caracteres), e `npm run
 * imagens:migrar` já moveu tudo em produção. O tipo estreito é o que impede
 * uma regressão silenciosa: um PATCH ou um seed que tentasse gravar base64 de
 * novo falharia no banco, em vez de voltar a inflar a tabela.
 *
 * Trava de segurança: se ainda existir valor acima de 255 caracteres, a
 * migration PARA com mensagem, em vez de deixar o `ALTER` falhar com um erro
 * genérico do Postgres. Rodar `imagens:migrar` e tentar de novo.
 */
export class ImagensComoChave1790900000000 implements MigrationInterface {
  name = "ImagensComoChave1790900000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    const [{ n }] = (await queryRunner.query(`
      SELECT (
        (SELECT count(*) FROM "profiles" WHERE length("avatar_url") > 255 OR length("cover_url") > 255 OR length("iab_image_url") > 255)
        + (SELECT count(*) FROM "links" WHERE length("thumbnail_url") > 255)
      )::int AS n
    `)) as Array<{ n: number }>;
    if (n > 0) {
      throw new Error(
        `${n} imagem(ns) ainda em base64 nas colunas. Rode \`npm run imagens:migrar\` antes desta migration.`,
      );
    }

    await queryRunner.query(`
      ALTER TABLE "profiles"
        ALTER COLUMN "avatar_url" TYPE varchar(255),
        ALTER COLUMN "cover_url" TYPE varchar(255),
        ALTER COLUMN "iab_image_url" TYPE varchar(255)
    `);
    await queryRunner.query(`ALTER TABLE "links" ALTER COLUMN "thumbnail_url" TYPE varchar(255)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "profiles"
        ALTER COLUMN "avatar_url" TYPE text,
        ALTER COLUMN "cover_url" TYPE text,
        ALTER COLUMN "iab_image_url" TYPE text
    `);
    await queryRunner.query(`ALTER TABLE "links" ALTER COLUMN "thumbnail_url" TYPE text`);
  }
}
