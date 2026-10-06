import { Client } from "pg";

import { loadEnv } from "../../config/env";

/**
 * Liga ou desliga o plano Pro de uma conta, à mão.
 *
 *     npm run plano:liberar -- --email ana@x.com --dias 30 --motivo "parceria"
 *     npm run plano:liberar -- --email ana@x.com --ate 2026-12-31 --motivo "cortesia"
 *     npm run plano:liberar -- --email ana@x.com --rebaixar --motivo "fim da parceria"
 *
 * Em produção, dentro do container: `node dist/database/seeds/liberar-pro.js …`.
 *
 * Script e não tela de administração porque essa tela não existe — o pool de
 * domínios também é operado assim. Se liberar virar rotina, o próximo passo é
 * uma rota interna, não mais SQL à mão.
 *
 * ## As duas formas de dizer o prazo
 *
 * `--dias` SOMA ao que a conta já tem: quem é Pro até dia 10 e ganha 30 dias
 * fica Pro até dia 40, não até hoje + 30. Liberar não pode encurtar um plano
 * que já existe.
 *
 * `--ate` é a data final exata, até o fim do dia no horário de Brasília. Se a
 * conta já é Pro até depois dela, nada encurta: `pro_until` é sempre o MAIOR
 * fim entre as concessões.
 *
 * `--rebaixar` volta a conta ao Free NA HORA. As concessões ativas não são
 * apagadas: terminam agora, e o motivo é anotado nelas. Apagar deixaria sem
 * resposta a pergunta "ela já foi Pro?" — e o painel usa o fim da última
 * concessão para dizer "Pro venceu em".
 *
 * `--motivo` é obrigatório. É a única resposta para "por que esta conta é Pro?"
 * daqui a seis meses.
 */

interface Args {
  email: string;
  dias?: number;
  ate?: string;
  rebaixar?: boolean;
  motivo: string;
}

function lerArgs(argv: string[]): Args {
  const valor = (nome: string) => {
    const i = argv.indexOf(`--${nome}`);
    return i >= 0 ? argv[i + 1]?.trim() : undefined;
  };

  const email = valor("email")?.toLowerCase();
  const diasRaw = valor("dias");
  const ate = valor("ate");
  const motivo = valor("motivo");

  if (!email) throw new Error("informe --email");
  if (!motivo) throw new Error("informe --motivo");

  if (argv.includes("--rebaixar")) {
    if (diasRaw || ate) throw new Error("--rebaixar não combina com --dias nem --ate");
    return { email, rebaixar: true, motivo };
  }

  if (Boolean(diasRaw) === Boolean(ate)) {
    throw new Error("informe --dias OU --ate (um dos dois), ou --rebaixar");
  }

  if (diasRaw) {
    const dias = Number(diasRaw);
    if (!Number.isInteger(dias) || dias < 1 || dias > 3660) {
      throw new Error("--dias precisa ser um inteiro entre 1 e 3660");
    }
    return { email, dias, motivo };
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(ate!)) throw new Error("--ate no formato AAAA-MM-DD");
  return { email, ate, motivo };
}

async function liberar(args: Args): Promise<void> {
  const env = loadEnv();
  const client = new Client({
    connectionString: env.databaseUrl,
    ssl: env.dbSsl ? { rejectUnauthorized: false } : undefined,
  });
  await client.connect();

  try {
    await client.query(`SET search_path TO "${env.dbSchema}", public`);
    await client.query("BEGIN");

    // `FOR UPDATE`: duas liberações simultâneas para a mesma conta calculariam
    // o início a partir do mesmo `pro_until` e uma delas se perderia.
    const conta = await client.query<{ id: string; pro_until: Date | null }>(
      `SELECT id, pro_until FROM users WHERE email = $1 FOR UPDATE`,
      [args.email],
    );
    const user = conta.rows[0];
    if (!user) throw new Error(`nenhuma conta com o email ${args.email}`);

    if (args.rebaixar) {
      // Toda concessão que ainda vale termina agora — inclusive a que só
      // começaria no futuro (uma extensão por `--dias`), senão ela devolveria o
      // Pro quando chegasse a hora. `starts_at` recua um segundo nesses casos
      // para respeitar o `CHECK (ends_at > starts_at)`.
      const encerradas = await client.query(
        `
        UPDATE plan_grants
           SET starts_at = least(starts_at, now() - interval '1 second'),
               ends_at = now(),
               reason = concat_ws(' | ', reason, 'Encerrada: ' || $2)
         WHERE user_id = $1 AND ends_at > now()
        `,
        [user.id, args.motivo],
      );
      await client.query(
        `UPDATE users
            SET pro_until = (SELECT max(ends_at) FROM plan_grants WHERE user_id = $1)
          WHERE id = $1`,
        [user.id],
      );
      await client.query("COMMIT");
      console.log(
        `[plano] ${args.email}: agora é Free. ${encerradas.rowCount ?? 0} concessão(ões) encerrada(s).`,
      );
      return;
    }

    const concessao = await client.query<{ starts_at: Date; ends_at: Date }>(
      args.dias
        ? `
          INSERT INTO plan_grants (user_id, source, starts_at, ends_at, reason)
          SELECT $1, 'manual', inicio, inicio + make_interval(days => $2), $3
            FROM (SELECT greatest(now(), coalesce($4::timestamptz, now())) AS inicio) i
          RETURNING starts_at, ends_at
          `
        : `
          INSERT INTO plan_grants (user_id, source, starts_at, ends_at, reason)
          VALUES ($1, 'manual', now(),
                  ($2::date + 1)::timestamp AT TIME ZONE 'America/Sao_Paulo', $3)
          RETURNING starts_at, ends_at
          `,
      args.dias
        ? [user.id, args.dias, args.motivo, user.pro_until]
        : [user.id, args.ate, args.motivo],
    );

    const atualizado = await client.query<{ pro_until: Date }>(
      `
      UPDATE users
         SET pro_until = (SELECT max(ends_at) FROM plan_grants WHERE user_id = $1)
       WHERE id = $1
      RETURNING pro_until
      `,
      [user.id],
    );

    await client.query("COMMIT");

    const { starts_at, ends_at } = concessao.rows[0];
    console.log(
      `[plano] ${args.email}: concessão de ${starts_at.toISOString()} a ${ends_at.toISOString()}. ` +
        `Pro até ${atualizado.rows[0].pro_until.toISOString()}.`,
    );
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    await client.end();
  }
}

if (require.main === module) {
  Promise.resolve()
    .then(() => liberar(lerArgs(process.argv.slice(2))))
    .then(() => process.exit(0))
    .catch((error) => {
      console.error("[plano] falhou:", error instanceof Error ? error.message : error);
      process.exit(1);
    });
}
