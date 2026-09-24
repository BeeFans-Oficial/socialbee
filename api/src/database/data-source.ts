import { DataSource, type DataSourceOptions } from "typeorm";

import { loadEnv } from "../config/env";
import { Session } from "../auth/entities/session.entity";
import { User } from "../auth/entities/user.entity";
import { Link } from "../links/entities/link.entity";
import { SafePage } from "../links/entities/safe-page.entity";
import { SafePageSocialLink } from "../links/entities/safe-page-social-link.entity";
import { Profile } from "../profiles/entities/profile.entity";
import { LinkCounter } from "../tracking/entities/link-counter.entity";
import { TrackingEvent } from "../tracking/entities/tracking-event.entity";
import { InitialSchema1788912000000 } from "./migrations/1788912000000-InitialSchema";
import { IabLandingNoPerfil1790121600000 } from "./migrations/1790121600000-IabLandingNoPerfil";
import { EditorDeTemplate1790200000000 } from "./migrations/1790200000000-EditorDeTemplate";
import { PaginaNoAr1790300000000 } from "./migrations/1790300000000-PaginaNoAr";

/**
 * Conexão e lista de migrations.
 *
 * Três decisões que valem registro:
 *
 * 1. **`synchronize: false`, sempre.** O schema é criado pelas migrations, com
 *    SQL escrito à mão. `synchronize: true` compara entidade com banco e
 *    "conserta" a diferença — em produção isso é `DROP COLUMN` silencioso na
 *    primeira vez que alguém renomeia um campo.
 * 2. **Entidades e migrations importadas, não por glob.** O mesmo arquivo roda
 *    como `.ts` (CLI e testes) e como `.js` (container). Glob depende da
 *    extensão e falha exatamente em um dos dois.
 * 3. **Schema dedicado.** Nada em `public`. E o `search_path` da conexão é
 *    fixado no schema: o TypeORM qualifica as tabelas que ele mesmo gera, mas
 *    **não** mexe no `search_path` — sem isto, todo SQL escrito à mão (as
 *    migrations, o incremento de contador) criaria e leria tabela em `public`,
 *    e o sintoma seria "a tabela existe e a API não acha".
 */

export function buildDataSourceOptions(): DataSourceOptions {
  const env = loadEnv();

  return {
    type: "postgres",
    url: env.databaseUrl,
    schema: env.dbSchema,
    ssl: env.dbSsl ? { rejectUnauthorized: false } : false,
    extra: {
      // Parâmetro de inicialização do Postgres, repassado pelo driver `pg`.
      // `public` fica no fim para `gen_random_uuid()` e afins continuarem
      // visíveis sem qualificação.
      options: `-c search_path=${env.dbSchema},public`,
    },
    entities: [
      User,
      Session,
      Profile,
      Link,
      SafePage,
      SafePageSocialLink,
      TrackingEvent,
      LinkCounter,
    ],
    migrations: [
      InitialSchema1788912000000,
      IabLandingNoPerfil1790121600000,
      EditorDeTemplate1790200000000,
      PaginaNoAr1790300000000,
    ],
    migrationsTableName: "migrations",
    synchronize: false,
    // Em produção o log de query é ruído com dado de usuário dentro; em
    // desenvolvimento é a única forma de ver o SQL que o ORM realmente manda.
    logging: env.isProduction ? ["error", "warn", "migration"] : ["error", "warn", "migration"],
  };
}

/** Usado pelo CLI do TypeORM (`npm run migration:run`). */
const dataSource = new DataSource(buildDataSourceOptions());
export default dataSource;
