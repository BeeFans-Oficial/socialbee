import "reflect-metadata";

import { Logger, ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import cookieParser from "cookie-parser";
import helmet from "helmet";

import { AppModule } from "./app.module";
import { loadEnv } from "./config/env";

/**
 * Subida da API.
 *
 * `loadEnv()` é a primeira linha de propósito: falta de segredo derruba o
 * processo aqui, antes de a porta abrir. Uma API que sobe com configuração
 * incompleta e falha na primeira requisição é muito mais difícil de diagnosticar
 * do que uma que não sobe.
 */
async function bootstrap(): Promise<void> {
  const env = loadEnv();
  const logger = new Logger("bootstrap");

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    // O log do Nest já sai pelo Logger; `bufferLogs` evita perder as linhas
    // emitidas antes de o app estar pronto.
    bufferLogs: true,
  });

  app.setGlobalPrefix("v1");

  // `x-powered-by: Express` só serve para anunciar o alvo.
  app.disable("x-powered-by");

  // Atrás do proxy do Next (e de qualquer borda em produção). O IP daqui
  // alimenta filtro de robô e prefixo de rede — nunca autorização, que é a
  // única razão pela qual confiar no cabeçalho é aceitável.
  app.set("trust proxy", true);

  app.use(
    helmet({
      // A API responde JSON, não HTML: a CSP restritiva do helmet não protege
      // nada aqui e complica a página de erro do próprio Nest em
      // desenvolvimento. As demais defesas (nosniff, frameguard, HSTS em
      // produção) continuam ligadas.
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: "same-site" },
    }),
  );

  app.use(cookieParser());

  // O limite padrão do Express é 100 kB — e o MVP ainda não tem upload de
  // arquivo: avatar, capa e miniatura chegam como data URL em base64. Com o
  // padrão, trocar a foto de perfil responderia 413 sem explicação.
  app.useBodyParser("json", { limit: "10mb" });
  app.useBodyParser("urlencoded", { limit: "1mb", extended: true });

  /**
   * CORS por lista explícita.
   *
   * No caminho do navegador ele nem é exercitado: o Next reescreve `/api/v1/*`
   * para cá, então a requisição é same-origin. Fica configurado para o acesso
   * direto (curl, Postman, um app futuro) sem abrir a API para qualquer origem
   * — com `credentials: true`, um `origin: "*"` seria recusado pelo navegador
   * de todo jeito, e sem a lista o cookie de sessão viajaria para quem pedisse.
   */
  app.enableCors({
    origin: env.corsOrigins,
    credentials: true,
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Internal-Secret", "X-Request-Id"],
    exposedHeaders: ["X-Request-Id"],
    maxAge: 600,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      // `whitelist` remove o que não está no DTO; `forbidNonWhitelisted` faz a
      // requisição FALHAR em vez de ignorar em silêncio. A diferença aparece
      // quando alguém tenta mandar `{"profileId": "..."}` num PATCH: com
      // remoção silenciosa o cliente acha que funcionou.
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );

  app.enableShutdownHooks();

  await app.listen(env.port, "0.0.0.0");
  logger.log(`API em http://localhost:${env.port}/v1 (${env.nodeEnv})`);
  logger.log(`Origens permitidas: ${env.corsOrigins.join(", ")}`);
}

bootstrap().catch((error) => {
  // `console.error` e não Logger: se a falha for na própria criação do app, o
  // Logger do Nest pode não existir ainda.
  console.error("[api] falha ao subir:", error instanceof Error ? error.message : error);
  if (error instanceof Error && error.stack) console.error(error.stack);
  process.exit(1);
});
