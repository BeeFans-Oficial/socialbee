import { Client } from "pg";

import { loadEnv } from "../../config/env";

/**
 * Domínios próprios, do lado da equipe.
 *
 *     npm run dominio:ativar -- --listar
 *     npm run dominio:ativar -- --host links.marca.com
 *
 * Em produção, dentro do container: `node dist/database/seeds/ativar-dominio.js …`.
 *
 * `--listar` mostra os pendentes, de quem são e há quanto tempo esperam.
 *
 * `--host` ATIVA: a partir daí o domínio aparece no seletor das páginas da
 * dona. **Rode só depois** de o domínio responder em HTTPS — registro A
 * apontando para a VPS, `server_name` no nginx (ver `deploy/nginx/dominios/`)
 * e certificado emitido. Ativar antes oferece à criadora um endereço que
 * responde com erro de TLS, e ela descobre pelas fãs.
 */
async function main(argv: string[]): Promise<void> {
  const env = loadEnv();
  const client = new Client({
    connectionString: env.databaseUrl,
    ssl: env.dbSsl ? { rejectUnauthorized: false } : undefined,
  });
  await client.connect();

  try {
    await client.query(`SET search_path TO "${env.dbSchema}", public`);

    if (argv.includes("--listar")) {
      const { rows } = await client.query<{ host: string; email: string; desde: Date }>(
        `SELECT d.host, u.email, d.created_at AS desde
           FROM domains d JOIN users u ON u.id = d.owner_user_id
          WHERE d.status = 'pending'
          ORDER BY d.created_at`,
      );
      if (rows.length === 0) console.log("[dominio] nenhum domínio pendente.");
      for (const r of rows) {
        console.log(`[dominio] ${r.host}  (${r.email}, desde ${r.desde.toISOString().slice(0, 10)})`);
      }
      return;
    }

    const i = argv.indexOf("--host");
    const host = i >= 0 ? argv[i + 1]?.trim().toLowerCase() : undefined;
    if (!host) throw new Error("informe --host <domínio> ou --listar");

    const { rows } = await client.query<{ host: string; status: string }>(
      `UPDATE domains SET status = 'active'
        WHERE host = $1 AND owner_user_id IS NOT NULL
        RETURNING host, status`,
      [host],
    );
    if (rows.length === 0) throw new Error(`nenhum domínio próprio com o host ${host}`);
    console.log(`[dominio] ${host} ativo. Já aparece no seletor de domínio das páginas da dona.`);
  } finally {
    await client.end();
  }
}

main(process.argv.slice(2))
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("[dominio] falhou:", error instanceof Error ? error.message : error);
    process.exit(1);
  });
