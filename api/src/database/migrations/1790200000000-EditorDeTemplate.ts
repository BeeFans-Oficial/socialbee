import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Editor de template: o que a criadora passa a poder mudar na página dela.
 *
 * Até aqui a aparência eram três botões — tema (só `bg` e `accent`), estilo de
 * botão e ajustes por link. O LAYOUT era chumbado: fundo hexagonal, faixa de
 * capa de 128px, avatar redondo centralizado, lista de uma coluna. Toda
 * criadora tinha exatamente a mesma estrutura.
 *
 * Estas colunas abrem os eixos que faltavam. Duas observações sobre o desenho:
 *
 * **`template_id` é texto livre**, como `theme_id` — e pelo mesmo motivo já
 * escrito em `profile.entity.ts`: o catálogo de templates é apresentação, vive
 * no front, e template novo não pode ser migração de banco.
 *
 * **As cores personalizadas convivem com o tema, não o substituem.** `theme_id`
 * continua sendo o preset escolhido; `bg_color` e `accent_color` são a exceção
 * que a criadora fez por cima dele. Nulas, vale o preset. Assim trocar de tema
 * não apaga silenciosamente uma cor que ela escolheu a dedo, e voltar ao preset
 * é apagar a exceção — não adivinhar qual era o valor de antes.
 *
 * A imagem de fundo NÃO ganha coluna nova: é `cover_url`, que existe desde o
 * schema inicial, tem upload funcionando no painel e nunca foi renderizada em
 * lugar nenhum (`profiles.service.ts` devolve `coverUrl: null` na visão
 * pública, com um comentário dizendo "quando for, segue o mesmo caminho"). É
 * agora. O que falta a ela é enquadramento, e é o que as duas colunas de
 * posição resolvem.
 */
export class EditorDeTemplate1790200000000 implements MigrationInterface {
  name = "EditorDeTemplate1790200000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "profiles"
        ADD COLUMN "template_id"    text    NOT NULL DEFAULT 'classico',
        ADD COLUMN "bg_color"       text,
        ADD COLUMN "accent_color"   text,
        ADD COLUMN "font_id"        text,
        ADD COLUMN "cover_pos_x"    smallint NOT NULL DEFAULT 50,
        ADD COLUMN "cover_pos_y"    smallint NOT NULL DEFAULT 50,
        ADD COLUMN "cover_overlay"  smallint NOT NULL DEFAULT 55
    `);

    // Cor é `#rrggbb`, validado no banco e não só no DTO: o valor entra direto
    // num `style` inline da página pública, então lixo aqui é lixo renderizado.
    await queryRunner.query(`
      ALTER TABLE "profiles"
        ADD CONSTRAINT "profiles_cores_hex"
        CHECK (
          ("bg_color"     IS NULL OR "bg_color"     ~* '^#[0-9a-f]{6}$') AND
          ("accent_color" IS NULL OR "accent_color" ~* '^#[0-9a-f]{6}$')
        )
    `);

    // Posição é porcentagem do enquadramento (`object-position`), e o
    // escurecimento é a camada preta por cima da foto. Os dois só fazem sentido
    // de 0 a 100 — fora disso a imagem some da tela ou o texto some na foto.
    await queryRunner.query(`
      ALTER TABLE "profiles"
        ADD CONSTRAINT "profiles_enquadramento_0_100"
        CHECK (
          "cover_pos_x"   BETWEEN 0 AND 100 AND
          "cover_pos_y"   BETWEEN 0 AND 100 AND
          "cover_overlay" BETWEEN 0 AND 100
        )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "profiles"
        DROP CONSTRAINT IF EXISTS "profiles_enquadramento_0_100",
        DROP CONSTRAINT IF EXISTS "profiles_cores_hex",
        DROP COLUMN IF EXISTS "cover_overlay",
        DROP COLUMN IF EXISTS "cover_pos_y",
        DROP COLUMN IF EXISTS "cover_pos_x",
        DROP COLUMN IF EXISTS "font_id",
        DROP COLUMN IF EXISTS "accent_color",
        DROP COLUMN IF EXISTS "bg_color",
        DROP COLUMN IF EXISTS "template_id"
    `);
  }
}
