import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Tirar uma página do ar sem destruí-la.
 *
 * Faltava o gesto reversível. Até aqui uma página existia ou não existia, e
 * quem quisesse suspendê-la — campanha que acabou, perfil em pausa, endereço
 * que vazou no lugar errado — só tinha a opção de apagar. Apagar leva junto os
 * links e todo o histórico de cliques (as três tabelas têm `ON DELETE
 * CASCADE`), que é o número que a criadora usa para negociar valor.
 *
 * `published = false` esconde a página do público e preserva tudo: os links, os
 * códigos curtos, o relatório. Voltar ao ar é uma tecla.
 *
 * Nasce `true` para toda página existente — ninguém sai do ar por causa desta
 * migration.
 *
 * O redirecionador `/r/<código>` **continua funcionando** com a página fora do
 * ar, e isso é decisão, não esquecimento: aqueles códigos estão impressos em
 * prints e bios que continuam circulando, e quebrá-los manda a fã para um erro
 * em vez do destino. Quem quiser derrubar também os links desativa cada um —
 * `links.is_active` já existe para isso.
 */
export class PaginaNoAr1790300000000 implements MigrationInterface {
  name = "PaginaNoAr1790300000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "profiles"
        ADD COLUMN "published" boolean NOT NULL DEFAULT true
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "profiles" DROP COLUMN IF EXISTS "published"`);
  }
}
