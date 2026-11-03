import { Client } from "pg";

import { loadEnv } from "../../config/env";

/**
 * Dá ou tira o papel de admin de uma conta, à mão.
 *
 *     npm run admin:promover -- --email equipe@beesocial.bio
 *     npm run admin:promover -- --email equipe@beesocial.bio --rebaixar
 *
 * Em produção, dentro do container: `node dist/database/seeds/promover-admin.js …`.
 *
 * É o ÚNICO caminho para o primeiro admin: ninguém vira admin pelo cadastro,
 * e o painel só promove quem já é admin. Toda promoção, por aqui ou pelo
 * painel, fica em `admin_actions`; por aqui, `admin_user_id` é nulo e o
 * motivo diz "script".
 */

interface Args {
  email: string;
  rebaixar: boolean;
}

function lerArgs(argv: string[]): Args {
  const valor = (nome: string) => {
    const i = argv.indexOf(`--${nome}`);
    return i >= 0 ? argv[i + 1]?.trim() : undefined;
  };
  const email = valor("email")?.toLowerCase();
  if (!email) {
    console.error("Uso: npm run admin:promover -- --email ana@x.com [--rebaixar]");
    process.exit(2);
  }
  return { email, rebaixar: argv.includes("--rebaixar") };
}

async function main() {
  const args = lerArgs(process.argv.slice(2));
  const env = loadEnv();
  const client = new Client({ connectionString: env.databaseUrl });
  await client.connect();
  try {
    await client.query(`SET search_path TO "${env.dbSchema}"`);
    const { rows } = await client.query<{ id: string; role: string }>(
      `SELECT id, role FROM users WHERE email = $1`,
      [args.email],
    );
    const user = rows[0];
    if (!user) {
      console.error(`Nenhuma conta com o e-mail ${args.email}.`);
      process.exit(1);
    }
    const novo = args.rebaixar ? "creator" : "admin";
    if (user.role === novo) {
      console.log(`${args.email} já é ${novo === "admin" ? "admin" : "conta comum"}. Nada a fazer.`);
      return;
    }
    await client.query("BEGIN");
    await client.query(`UPDATE users SET role = $2 WHERE id = $1`, [user.id, novo]);
    await client.query(
      `INSERT INTO admin_actions (admin_user_id, action, target_user_id, reason, details)
       VALUES (NULL, $1, $2, $3, $4::jsonb)`,
      [
        args.rebaixar ? "admin.rebaixar" : "admin.promover",
        user.id,
        "script admin:promover",
        JSON.stringify({ email: args.email, de: user.role, para: novo }),
      ],
    );
    await client.query("COMMIT");
    console.log(
      args.rebaixar
        ? `${args.email} deixou de ser admin.`
        : `${args.email} agora é admin. Entre de novo no painel para o papel valer na sessão.`,
    );
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
