import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * A página de chegada passa a ser o padrão.
 *
 * O produto existe para o link da criadora não morrer dentro do Instagram. A
 * peça que faz isso — a página de chegada — estava pronta e **desligada em
 * todos os perfis**, porque nasceu como recurso a ser ativado. Na prática, a fã
 * percorria o caminho inteiro presa na janelinha do aplicativo, inclusive ao
 * chegar no destino.
 *
 * Recurso que resolve o problema central do produto não deveria depender de
 * alguém descobrir uma chave no painel. Vira padrão, e quem não quiser desliga.
 *
 * ## O que muda para quem visita
 *
 * Só para quem chega **de dentro de um aplicativo** (e para robôs, que recebem
 * o mesmo documento de propósito — é o que evita servir conteúdo diferente por
 * user-agent). Navegador comum, no celular ou no desktop, continua indo direto
 * ao perfil: a bifurcação em `app/[slug]/page.tsx` já era assim.
 *
 * ## Os dois lados
 *
 * No Android a página tenta sozinha entregar o endereço ao Chrome. No iOS ela
 * mostra a instrução do menu `•••`, que é o único caminho que existe — nenhum
 * site consegue tirar o usuário do navegador embutido no iPhone, e prometer o
 * contrário é o que o código antigo fazia.
 */
export class SairDoAppPorPadrao1790600000000 implements MigrationInterface {
  name = "SairDoAppPorPadrao1790600000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Perfis que já existem também passam a sair do aplicativo. Não é um opt-in
    // retroativo silencioso: é o comportamento que o produto sempre prometeu, e
    // quem quiser voltar tem a chave no painel.
    await queryRunner.query(`UPDATE "profiles" SET "iab_enabled" = true`);

    await queryRunner.query(`
      ALTER TABLE "profiles" ALTER COLUMN "iab_enabled" SET DEFAULT true
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "profiles" ALTER COLUMN "iab_enabled" SET DEFAULT false
    `);
    // O `UPDATE` não é revertido: desligar para todos no rollback apagaria a
    // escolha de quem tiver ligado conscientemente depois desta migration.
  }
}
