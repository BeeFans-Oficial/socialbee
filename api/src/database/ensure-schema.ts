import { Client } from "pg";

import { loadEnv } from "../config/env";

/**
 * Cria o schema antes de qualquer migration.
 *
 * O TypeORM cria a tabela `migrations` DENTRO do schema configurado — e falha
 * se o schema não existe. Como o schema é próprio (`socialbee`, nunca
 * `public`), alguém tem que criá-lo primeiro, e esse alguém não pode ser uma
 * migration: ela já roda com o schema no `search_path`.
 *
 * Roda com o driver cru de propósito, sem TypeORM no caminho.
 */
export async function ensureSchema(): Promise<string> {
  const env = loadEnv();
  const client = new Client({
    connectionString: env.databaseUrl,
    ssl: env.dbSsl ? { rejectUnauthorized: false } : undefined,
  });

  await client.connect();
  try {
    // Identificador não pode ser parametrizado; por isso a lista branca de
    // caracteres. `DB_SCHEMA` vem do ambiente, não de requisição, mas o dia em
    // que vier de outro lugar esta linha é a diferença entre um nome inválido e
    // SQL injetado.
    if (!/^[a-z_][a-z0-9_]{0,62}$/.test(env.dbSchema)) {
      throw new Error(
        `DB_SCHEMA inválido: "${env.dbSchema}". Use letras minúsculas, dígitos e _.`,
      );
    }
    await client.query(`CREATE SCHEMA IF NOT EXISTS "${env.dbSchema}"`);
    return env.dbSchema;
  } finally {
    await client.end();
  }
}

if (require.main === module) {
  ensureSchema()
    .then((schema) => {
      console.log(`[db] schema "${schema}" pronto`);
      process.exit(0);
    })
    .catch((error) => {
      console.error("[db] falha ao garantir o schema:", error instanceof Error ? error.message : error);
      process.exit(1);
    });
}
