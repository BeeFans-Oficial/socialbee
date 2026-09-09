import type { INestApplication } from "@nestjs/common";
import type { DataSource } from "typeorm";
import request from "supertest";

/**
 * Ponta a ponta: HTTP + Postgres de verdade.
 *
 * Roda contra o banco do compose, num schema próprio (`socialbee_test`) que é
 * criado e derrubado pelo próprio teste — nunca encosta no schema de
 * desenvolvimento.
 *
 * O que este teste existe para provar é exatamente o que um mock de repositório
 * esconderia:
 *
 *   1. o escopo por perfil chega ao `WHERE` (uma conta não lê nem escreve o
 *      link da outra, e a resposta é 404, não 403);
 *   2. rota nova nasce fechada — sem sessão é 401;
 *   3. logout revoga a sessão no banco, então o token para de valer;
 *   4. o destino do link é validado antes de ser gravado;
 *   5. o perfil público NÃO devolve `destinationUrl`.
 *
 * Pré-requisito: `docker compose up -d db`.
 */

const PG_URL =
  process.env.TEST_DATABASE_URL ?? "postgres://beesocial:beesocial@localhost:5434/beesocial";

let app: INestApplication;
let dataSource: DataSource;
let servidor: ReturnType<typeof request>;

/** Token de cada conta, usado como Bearer. O cookie funciona igual; o Bearer é
 *  o que deixa o teste legível. */
let tokenBella = "";
let tokenLuna = "";
let linkDaBella = "";

const senha = "senha-de-teste-123";

beforeAll(async () => {
  // Precisa acontecer ANTES de qualquer import do código da API: `loadEnv()`
  // roda no import de `data-source.ts` e guarda o resultado em cache.
  process.env.NODE_ENV = "test";
  process.env.DATABASE_URL = PG_URL;
  process.env.DB_SCHEMA = "socialbee_test";
  process.env.JWT_SECRET = "segredo-de-teste-com-mais-de-32-caracteres-ok";
  process.env.INTERNAL_API_SECRET = "segredo-interno-de-teste-24+";
  process.env.SEED_DEMO = "false";
  // Custo mínimo do bcrypt: o teste cria várias contas e não está medindo hash.
  process.env.BCRYPT_ROUNDS = "4";

  const { ensureSchema } = await import("../src/database/ensure-schema");
  await ensureSchema();

  const { Test } = await import("@nestjs/testing");
  const { ValidationPipe } = await import("@nestjs/common");
  const cookieParser = (await import("cookie-parser")).default;
  const { AppModule } = await import("../src/app.module");
  const { AllExceptionsFilter } = await import("../src/common/filters/all-exceptions.filter");
  const { getDataSourceToken } = await import("@nestjs/typeorm");

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();

  app = moduleRef.createNestApplication();
  app.setGlobalPrefix("v1");
  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());
  await app.init();

  dataSource = app.get<DataSource>(getDataSourceToken());
  await dataSource.runMigrations();

  servidor = request(app.getHttpServer());
});

afterAll(async () => {
  if (dataSource?.isInitialized) {
    await dataSource.query(`DROP SCHEMA IF EXISTS "socialbee_test" CASCADE`);
  }
  await app?.close();
});

describe("cadastro e sessão", () => {
  it("cria conta e já devolve sessão", async () => {
    const response = await servidor
      .post("/v1/auth/register")
      .send({
        email: "bella@teste.app",
        password: senha,
        displayName: "Bella",
        slug: "bella-teste",
        ageConfirmed: true,
        isAdult: true,
      })
      .expect(201);

    expect(response.body.user.email).toBe("bella@teste.app");
    expect(response.body.profile.slug).toBe("bella-teste");
    // Hash de senha nunca sai em resposta.
    expect(JSON.stringify(response.body)).not.toContain("$2");
    expect(response.headers["set-cookie"]?.[0]).toContain("beesocial_session");

    tokenBella = response.body.accessToken;
  });

  it("recusa cadastro sem confirmação de maioridade", async () => {
    await servidor
      .post("/v1/auth/register")
      .send({
        email: "menor@teste.app",
        password: senha,
        displayName: "X",
        slug: "menor-teste",
        ageConfirmed: false,
      })
      .expect(401);
  });

  it("recusa email repetido e slug repetido", async () => {
    await servidor
      .post("/v1/auth/register")
      .send({
        email: "bella@teste.app",
        password: senha,
        displayName: "Outra",
        slug: "outra-teste",
        ageConfirmed: true,
      })
      .expect(409);

    await servidor
      .post("/v1/auth/register")
      .send({
        email: "outra@teste.app",
        password: senha,
        displayName: "Outra",
        slug: "bella-teste",
        ageConfirmed: true,
      })
      .expect(409);
  });

  it("recusa slug que é rota do app", async () => {
    // O bug que isto fecha: `RESERVED_SLUGS` do MVP não incluía as rotas reais,
    // então o perfil de quem escolhesse `links` era sombreado pelo dashboard.
    const { body } = await servidor.get("/v1/public/slug-available?slug=links").expect(200);
    expect(body.available).toBe(false);
  });

  it("não diz se o email existe quando a senha está errada", async () => {
    const inexistente = await servidor
      .post("/v1/auth/login")
      .send({ email: "ninguem@teste.app", password: senha })
      .expect(401);
    const senhaErrada = await servidor
      .post("/v1/auth/login")
      .send({ email: "bella@teste.app", password: "outra-coisa" })
      .expect(401);

    expect(inexistente.body.error.message).toBe(senhaErrada.body.error.message);
  });

  it("exige sessão nas rotas do painel", async () => {
    await servidor.get("/v1/me/links").expect(401);
    await servidor.get("/v1/me/profile").expect(401);
    await servidor.get("/v1/me/tracking/report").expect(401);
  });
});

describe("links", () => {
  it("cria link com código curto gerado pelo servidor", async () => {
    const { body } = await servidor
      .post("/v1/me/links")
      .set("authorization", `Bearer ${tokenBella}`)
      .send({
        title: "Meu OnlyFans",
        platform: "onlyfans",
        destinationUrl: "https://onlyfans.com/bella",
        cloakEnabled: true,
      })
      .expect(201);

    expect(body.shortCode).toMatch(/^[A-Za-z0-9]{6}$/);
    expect(body.position).toBe(0);
    expect(body.clicks).toBe(0);
    linkDaBella = body.id;
  });

  it("recusa destino com esquema perigoso ou host interno", async () => {
    for (const destinationUrl of ["javascript:alert(1)", "http://169.254.169.254/"]) {
      const { body } = await servidor
        .post("/v1/me/links")
        .set("authorization", `Bearer ${tokenBella}`)
        .send({ title: "X", destinationUrl })
        .expect(400);
      expect(body.error.code).toBe("invalid_destination");
    }
  });

  it("recusa campo que não existe no contrato", async () => {
    // `forbidNonWhitelisted`: o cliente não pode tentar escolher o perfil.
    await servidor
      .patch("/v1/me/profile")
      .set("authorization", `Bearer ${tokenBella}`)
      .send({ profileId: "outro-perfil", bio: "nova" })
      .expect(400);
  });

  it("exige a ordem completa ao reordenar", async () => {
    await servidor
      .post("/v1/me/links")
      .set("authorization", `Bearer ${tokenBella}`)
      .send({ title: "Telegram", platform: "telegram", destinationUrl: "https://t.me/bella" })
      .expect(201);

    await servidor
      .patch("/v1/me/links/reorder")
      .set("authorization", `Bearer ${tokenBella}`)
      .send({ ids: [linkDaBella] })
      .expect(400);
  });

  it("reordena e renumera de 0 a n-1", async () => {
    const { body: lista } = await servidor
      .get("/v1/me/links")
      .set("authorization", `Bearer ${tokenBella}`)
      .expect(200);

    const invertidos = lista.links.map((l: { id: string }) => l.id).reverse();
    const { body } = await servidor
      .patch("/v1/me/links/reorder")
      .set("authorization", `Bearer ${tokenBella}`)
      .send({ ids: invertidos })
      .expect(200);

    expect(body.links.map((l: { position: number }) => l.position)).toEqual([0, 1]);
    expect(body.links[0].id).toBe(invertidos[0]);
  });
});

describe("isolamento entre contas", () => {
  beforeAll(async () => {
    const { body } = await servidor
      .post("/v1/auth/register")
      .send({
        email: "luna@teste.app",
        password: senha,
        displayName: "Luna",
        slug: "luna-teste",
        ageConfirmed: true,
      })
      .expect(201);
    tokenLuna = body.accessToken;
  });

  it("não mostra os links de outra criadora", async () => {
    const { body } = await servidor
      .get("/v1/me/links")
      .set("authorization", `Bearer ${tokenLuna}`)
      .expect(200);
    expect(body.links).toHaveLength(0);
  });

  it("responde 404 (não 403) ao tocar link de outra conta", async () => {
    // 403 confirmaria que o id existe, o que permite enumerar links alheios.
    await servidor
      .get(`/v1/me/links/${linkDaBella}`)
      .set("authorization", `Bearer ${tokenLuna}`)
      .expect(404);
    await servidor
      .patch(`/v1/me/links/${linkDaBella}`)
      .set("authorization", `Bearer ${tokenLuna}`)
      .send({ title: "invadido" })
      .expect(404);
    await servidor
      .delete(`/v1/me/links/${linkDaBella}`)
      .set("authorization", `Bearer ${tokenLuna}`)
      .expect(404);
  });

  it("escopa o relatório no perfil da sessão", async () => {
    const { body } = await servidor
      .get("/v1/me/tracking/report?days=7")
      .set("authorization", `Bearer ${tokenLuna}`)
      .expect(200);

    expect(body.report.clicks).toBe(0);
    expect(body.report.views).toBe(0);
  });
});

describe("perfil público", () => {
  it("devolve links ativos SEM o destino", async () => {
    const { body } = await servidor.get("/v1/public/profiles/bella-teste").expect(200);

    expect(body.profile.displayName).toBe("Bella");
    expect(body.links.length).toBeGreaterThan(0);
    // O destino nunca chega ao navegador do visitante: é isso que mantém o link
    // fora do HTML e fora do alcance do robô da rede social.
    for (const link of body.links) {
      expect(link).not.toHaveProperty("destinationUrl");
      expect(link.shortCode).toBeDefined();
    }
  });

  it("responde 404 para slug que não existe", async () => {
    await servidor.get("/v1/public/profiles/nao-existe-ninguem").expect(404);
  });
});

describe("rastreamento", () => {
  const segredo = "segredo-interno-de-teste-24+";

  it("recusa registro de clique sem o segredo interno", async () => {
    // Sem esta barreira, qualquer um infla o contador de cliques de qualquer
    // criadora — o código curto é público.
    await servidor.post("/v1/public/tracking/click").send({ code: "abcdef" }).expect(404);
  });

  it("conta clique humano e devolve o destino", async () => {
    const { body: lista } = await servidor
      .get("/v1/me/links")
      .set("authorization", `Bearer ${tokenBella}`)
      .expect(200);
    const link = lista.links[0];

    const { body } = await servidor
      .post("/v1/public/tracking/click")
      .set("x-internal-secret", segredo)
      .set("user-agent", "Mozilla/5.0 (iPhone) Mobile/15E148 Instagram 300.0.0.0")
      .set("accept-language", "pt-BR")
      .set("accept", "text/html")
      .send({
        code: link.shortCode,
        url: `http://localhost:3000/r/${link.shortCode}?utm_source=instagram&utm_campaign=stories`,
      })
      .expect(200);

    expect(body.counted).toBe(true);
    expect(body.destinationUrl).toBe(link.destinationUrl);
  });

  it("não conta clique de robô, mas ainda entrega o destino", async () => {
    const { body: lista } = await servidor
      .get("/v1/me/links")
      .set("authorization", `Bearer ${tokenBella}`);
    const link = lista.links[0];

    const { body } = await servidor
      .post("/v1/public/tracking/click")
      .set("x-internal-secret", segredo)
      .set("user-agent", "facebookexternalhit/1.1")
      .send({ code: link.shortCode })
      .expect(200);

    expect(body.counted).toBe(false);
    expect(body.destinationUrl).toBe(link.destinationUrl);
  });

  it("registra view por slug e monta o relatório", async () => {
    await servidor
      .post("/v1/public/tracking/view")
      .set("user-agent", "Mozilla/5.0 (iPhone) Mobile/15E148 Instagram 300.0.0.0")
      .set("accept-language", "pt-BR")
      .set("accept", "text/html")
      .send({ slug: "bella-teste" })
      .expect(204);

    const { body } = await servidor
      .get("/v1/me/tracking/report?days=7")
      .set("authorization", `Bearer ${tokenBella}`)
      .expect(200);

    expect(body.report.views).toBe(1);
    expect(body.report.clicks).toBe(1);
    expect(body.report.botHits).toBe(1);
    expect(body.report.inAppClicks).toBe(1);
    expect(body.report.bySource[0].key).toBe("instagram");
    expect(body.report.byCampaign[0].key).toBe("stories");
    // Série contínua: todos os dias da janela, inclusive os zerados.
    expect(body.report.daily).toHaveLength(7);
  });

  it("responde 204 para view de perfil inexistente, sem revelar nada", async () => {
    await servidor
      .post("/v1/public/tracking/view")
      .send({ slug: "nao-existe-ninguem" })
      .expect(204);
  });
});

describe("logout", () => {
  it("revoga a sessão no banco: o token para de valer", async () => {
    const { body } = await servidor
      .post("/v1/auth/login")
      .send({ email: "luna@teste.app", password: senha })
      .expect(200);

    const token = body.accessToken;
    await servidor.get("/v1/auth/me").set("authorization", `Bearer ${token}`).expect(200);

    await servidor.post("/v1/auth/logout").set("authorization", `Bearer ${token}`).expect(204);

    // O JWT continua assinado e dentro da validade — e ainda assim é recusado,
    // porque a linha em `sessions` está revogada. Sem isso, logout seria só
    // apagar o cookie do navegador.
    const recusado = await servidor
      .get("/v1/auth/me")
      .set("authorization", `Bearer ${token}`)
      .expect(401);
    expect(recusado.body.error.code).toBe("session_revoked");
  });
});
