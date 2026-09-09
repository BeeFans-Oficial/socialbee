import { Client } from "pg";

import { loadEnv } from "../../config/env";

/**
 * Expurgo manual do evento cru.
 *
 * O mesmo DML que `tracking/retention.service.ts` roda de madrugada, disponível
 * como comando (`npm run retention`) para quem precisar limpar sem esperar o
 * horário — ou para um cron externo, se um dia a aplicação deixar de agendar.
 *
 * Os contadores não são tocados: eles são o histórico.
 */
async function purge(): Promise<void> {
  const env = loadEnv();
  const client = new Client({
    connectionString: env.databaseUrl,
    ssl: env.dbSsl ? { rejectUnauthorized: false } : undefined,
  });

  await client.connect();
  try {
    await client.query(`SET search_path TO "${env.dbSchema}", public`);
    const result = await client.query(
      `DELETE FROM tracking_events
        WHERE occurred_at < now() - ($1 || ' days')::interval`,
      [env.trackingEventTtlDays],
    );
    console.log(
      `[retention] ${result.rowCount ?? 0} evento(s) com mais de ${env.trackingEventTtlDays} dias removidos.`,
    );
  } finally {
    await client.end();
  }
}

purge()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("[retention] falhou:", error instanceof Error ? error.message : error);
    process.exit(1);
  });
