/**
 * Ambiente da API.
 *
 * Uma decisão só, e é ela que justifica o arquivo: **falta de segredo derruba a
 * subida**. A alternativa comum — `process.env.JWT_SECRET ?? "dev-secret"` — é
 * como uma API vai para produção assinando token com segredo público sem que
 * ninguém perceba, porque nada quebra. Aqui quebra na primeira linha, antes de
 * a porta abrir.
 *
 * O módulo é lido por três entradas diferentes (a aplicação Nest, o CLI de
 * migration e o script de seed), então não pode depender do container de
 * injeção do Nest.
 */

import { config as loadDotenv } from "dotenv";

export type NodeEnv = "development" | "test" | "production";

export interface Env {
  nodeEnv: NodeEnv;
  isProduction: boolean;
  port: number;

  databaseUrl: string;
  dbSchema: string;
  dbSsl: boolean;

  jwtSecret: string;
  jwtTtl: string;
  bcryptRounds: number;

  cookieName: string;
  cookieDomain?: string;
  cookieSecure: boolean;

  corsOrigins: string[];
  internalApiSecret: string;

  publicSiteUrl: string;
  trackingEventTtlDays: number;

  /** IP público da VPS — o valor do registro `A` que a criadora cria para
   *  conectar o domínio próprio. Opcional: sem ele, o painel não mostra a
   *  instrução nem confere o DNS, e diz para falar com a equipe. */
  serverPublicIp: string | null;

  /** Armazenamento das imagens (S3 ou compatível: MinIO, R2). Ver
   *  `common/storage/storage.service.ts`. */
  s3Endpoint: string;
  s3Region: string;
  s3Bucket: string;
  s3AccessKey: string;
  s3SecretKey: string;
  s3ForcePathStyle: boolean;
  /** Endereço que o NAVEGADOR usa para ler o bucket, sem barra no fim. Em
   *  produção é `${SITE_URL}/media` (nginx → MinIO); em dev, o MinIO publicado
   *  no host. */
  mediaPublicUrl: string;
}

class MissingEnvError extends Error {
  constructor(missing: string[]) {
    super(
      [
        "Variáveis de ambiente obrigatórias ausentes ou inválidas:",
        ...missing.map((m) => `  - ${m}`),
        "",
        "Copie api/.env.example para api/.env e preencha. Nenhuma delas tem",
        "default: um segredo com valor de fábrica é um segredo público.",
      ].join("\n"),
    );
    this.name = "MissingEnvError";
  }
}

function optional(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

function bool(name: string, fallback: boolean): boolean {
  const value = optional(name)?.toLowerCase();
  if (value === undefined) return fallback;
  return value === "true" || value === "1" || value === "yes";
}

function int(name: string, fallback: number): number {
  const value = optional(name);
  if (value === undefined) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : fallback;
}

/** Monta a URL de conexão a partir das partes, quando `DATABASE_URL` não vem.
 *  O compose passa as partes; um provedor gerenciado normalmente passa a URL. */
function databaseUrlFrom(parts: {
  host?: string;
  port?: string;
  user?: string;
  password?: string;
  database?: string;
}): string | undefined {
  if (!parts.host || !parts.user || !parts.database) return undefined;
  const auth = parts.password
    ? `${encodeURIComponent(parts.user)}:${encodeURIComponent(parts.password)}`
    : encodeURIComponent(parts.user);
  return `postgres://${auth}@${parts.host}:${parts.port ?? "5432"}/${parts.database}`;
}

let cached: Env | null = null;

export function loadEnv(): Env {
  if (cached) return cached;

  // Lido aqui, e não por um módulo do Nest: três entradas diferentes chamam
  // esta função (a aplicação, o CLI de migration e o seed), e só uma delas tem
  // container de injeção. `override: false` mantém a precedência correta — o
  // que o Docker injeta no ambiente ganha do arquivo.
  loadDotenv({ path: process.env.ENV_FILE ?? ".env", override: false });

  const missing: string[] = [];

  const nodeEnv = (optional("NODE_ENV") ?? "development") as NodeEnv;
  const isProduction = nodeEnv === "production";

  const databaseUrl =
    optional("DATABASE_URL") ??
    databaseUrlFrom({
      host: optional("POSTGRES_HOST"),
      port: optional("POSTGRES_PORT"),
      user: optional("POSTGRES_USER"),
      password: optional("POSTGRES_PASSWORD"),
      database: optional("POSTGRES_DB"),
    });
  if (!databaseUrl) {
    missing.push("DATABASE_URL (ou POSTGRES_HOST + POSTGRES_USER + POSTGRES_DB)");
  }

  const jwtSecret = optional("JWT_SECRET");
  if (!jwtSecret) {
    missing.push("JWT_SECRET");
  } else if (jwtSecret.length < 32) {
    // 32 caracteres não é cerimônia: HS256 com segredo curto é força-bruta
    // offline a partir de um único token vazado.
    missing.push("JWT_SECRET (mínimo de 32 caracteres)");
  }

  const internalApiSecret = optional("INTERNAL_API_SECRET");
  if (!internalApiSecret) {
    missing.push("INTERNAL_API_SECRET");
  } else if (internalApiSecret.length < 24) {
    missing.push("INTERNAL_API_SECRET (mínimo de 24 caracteres)");
  }

  // Imagens. Em produção faltar credencial derruba a subida, pelo mesmo motivo
  // dos segredos acima. Em dev e teste os defaults batem com o MinIO do
  // compose (`docker-compose.yml`), que é o único lugar onde eles valem.
  const s3AccessKey = optional("S3_ACCESS_KEY") ?? (isProduction ? undefined : "beesocial");
  const s3SecretKey = optional("S3_SECRET_KEY") ?? (isProduction ? undefined : "beesocial-dev");
  if (!s3AccessKey) missing.push("S3_ACCESS_KEY");
  if (!s3SecretKey) missing.push("S3_SECRET_KEY");

  if (missing.length > 0) throw new MissingEnvError(missing);

  cached = Object.freeze({
    nodeEnv,
    isProduction,
    port: int("PORT", 3333),

    databaseUrl: databaseUrl as string,
    dbSchema: optional("DB_SCHEMA") ?? "socialbee",
    dbSsl: bool("DB_SSL", false),

    jwtSecret: jwtSecret as string,
    jwtTtl: optional("JWT_TTL") ?? "7d",
    bcryptRounds: int("BCRYPT_ROUNDS", 12),

    cookieName: optional("COOKIE_NAME") ?? "beesocial_session",
    cookieDomain: optional("COOKIE_DOMAIN"),
    cookieSecure: bool("COOKIE_SECURE", isProduction),

    corsOrigins: (optional("CORS_ORIGINS") ?? "http://localhost:3000")
      .split(",")
      .map((o) => o.trim().replace(/\/+$/, ""))
      .filter(Boolean),
    internalApiSecret: internalApiSecret as string,

    publicSiteUrl: (optional("PUBLIC_SITE_URL") ?? "http://localhost:3000").replace(/\/+$/, ""),
    trackingEventTtlDays: int("TRACKING_EVENT_TTL_DAYS", 90),

    serverPublicIp: optional("SERVER_PUBLIC_IP") ?? null,

    s3Endpoint: (optional("S3_ENDPOINT") ?? "http://localhost:9000").replace(/\/+$/, ""),
    s3Region: optional("S3_REGION") ?? "us-east-1",
    s3Bucket: optional("S3_BUCKET") ?? "beesocial",
    s3AccessKey: s3AccessKey as string,
    s3SecretKey: s3SecretKey as string,
    s3ForcePathStyle: bool("S3_FORCE_PATH_STYLE", true),
    mediaPublicUrl: (optional("MEDIA_PUBLIC_URL") ?? "http://localhost:9000/beesocial").replace(/\/+$/, ""),
  });

  return cached;
}

/** Só para o teste, que troca o ambiente entre casos. */
export function resetEnvCache(): void {
  cached = null;
}
