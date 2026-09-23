import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Página de chegada para navegador embutido (IAB), no perfil.
 *
 * O produto passa a ter dois documentos na mesma URL `/{slug}`: a **página de
 * chegada**, servida a quem vem do navegador embutido de um aplicativo e a
 * robôs, e o **perfil completo**, servido a todo o resto. A criadora escolhe a
 * imagem e o texto da primeira — o ponto é que ela possa pôr ali algo que passe
 * por qualquer revisão automática, enquanto a página real continua sendo dela.
 *
 * **Por que colunas no perfil e não uma tabela nova.** Já existe `safe_pages`,
 * mas ela pende de LINK (uma página neutra por destino, montada no modal). Esta
 * é uma por PERFIL, com quatro campos escalares e sem coleção — uma tabela
 * daria um JOIN a mais em todo carregamento de perfil, que é o caminho mais
 * quente do sistema, para guardar o que cabe em quatro colunas.
 *
 * Nenhuma coluna é obrigatória e `iab_enabled` nasce `false`: perfil existente
 * continua servindo a mesma página de hoje até a criadora ligar isto.
 */
export class IabLandingNoPerfil1790121600000 implements MigrationInterface {
  name = "IabLandingNoPerfil1790121600000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "profiles"
        ADD COLUMN "iab_enabled"      boolean NOT NULL DEFAULT false,
        ADD COLUMN "iab_image_url"    text,
        ADD COLUMN "iab_headline"     text,
        ADD COLUMN "iab_button_label" text
    `);

    // Mesmo teto do avatar e pelo mesmo motivo: enquanto não há upload de
    // arquivo, a imagem chega como data URL em base64 numa coluna de texto. O
    // `CHECK` é a barreira que sobrevive a escrita que não passou pela API.
    await queryRunner.query(`
      ALTER TABLE "profiles"
        ADD CONSTRAINT "profiles_iab_image_size"
        CHECK ("iab_image_url" IS NULL OR length("iab_image_url") <= 2000000)
    `);

    // Texto curto: é um título dentro de um celular, não um campo de expressão.
    // Cortar aqui evita que a página de chegada quebre o layout em telas
    // pequenas — que são todas, já que ela só aparece em aplicativo.
    await queryRunner.query(`
      ALTER TABLE "profiles"
        ADD CONSTRAINT "profiles_iab_texto_curto"
        CHECK (
          ("iab_headline"     IS NULL OR length("iab_headline")     <= 60) AND
          ("iab_button_label" IS NULL OR length("iab_button_label") <= 40)
        )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "profiles"
        DROP CONSTRAINT IF EXISTS "profiles_iab_texto_curto",
        DROP CONSTRAINT IF EXISTS "profiles_iab_image_size",
        DROP COLUMN IF EXISTS "iab_button_label",
        DROP COLUMN IF EXISTS "iab_headline",
        DROP COLUMN IF EXISTS "iab_image_url",
        DROP COLUMN IF EXISTS "iab_enabled"
    `);
  }
}
