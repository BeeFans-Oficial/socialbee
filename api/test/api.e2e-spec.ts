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
  /**
   * Conexão do teste.
   *
   * Sai do `.env` do próprio pacote, não de um valor chumbado aqui: a primeira
   * versão deste arquivo trazia `localhost:5434` — a porta que eu estava usando
   * naquele dia por colisão com outro serviço — e o dia em que o compose voltou
   * para 5433 os 22 testes quebraram com `AggregateError` sem mensagem, que não
   * diz nada sobre porta. `TEST_DATABASE_URL` continua tendo a última palavra,
   * para apontar para um banco separado quando fizer sentido.
   */
  const { config: loadDotenv } = await import("dotenv");
  loadDotenv({ path: process.env.ENV_FILE ?? ".env" });

  const pgUrl =
    process.env.TEST_DATABASE_URL ??
    process.env.DATABASE_URL ??
    "postgres://beesocial:beesocial@localhost:5433/beesocial";

  // Precisa acontecer ANTES de qualquer import do código da API: `loadEnv()`
  // roda no import de `data-source.ts` e guarda o resultado em cache.
  process.env.NODE_ENV = "test";
  process.env.DATABASE_URL = pgUrl;
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

/**
 * Põe a conta no Pro direto no banco, como o script de liberação faria.
 *
 * As suítes abaixo testam link, cloaking e página — recursos que agora têm
 * limite no Free. Elas não estão testando o plano; a suíte "planos" está.
 */
async function tornarPro(email: string): Promise<void> {
  await dataSource.query(
    `UPDATE "socialbee_test"."users" SET pro_until = now() + interval '1 day' WHERE email = $1`,
    [email],
  );
}

describe("links", () => {
  beforeAll(() => tornarPro("bella@teste.app"));

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
    // O relatório é do Pro; aqui o que se testa é o escopo, não o plano.
    await tornarPro("luna@teste.app");
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

  it("entrega as redes da Safe Page dos links ativos protegidos no perfil", async () => {
    const socialLinks = [{ platform: "instagram", url: "https://www.instagram.com/perfil/", title: "Instagram" }];
    await servidor.patch(`/v1/me/links/${linkDaBella}`)
      .set("authorization", `Bearer ${tokenBella}`)
      .send({ cloakEnabled: true, safePage: { socialLinks } }).expect(200);
    const { body } = await servidor.get("/v1/public/profiles/bella-teste")
      .set("x-internal-secret", "segredo-interno-de-teste-24+")
      .set("user-agent", "InstagramBot").expect(200);
    expect(body.requester.isBot).toBe(true);
    expect(body.safePageLinks).toEqual(socialLinks);
    expect(body.links[0]).not.toHaveProperty("destinationUrl");
    await servidor.patch(`/v1/me/links/${linkDaBella}`)
      .set("authorization", `Bearer ${tokenBella}`)
      .send({ cloakEnabled: false }).expect(200);
    const unprotected = await servidor.get("/v1/public/profiles/bella-teste").expect(200);
    expect(unprotected.body.safePageLinks).toEqual([]);
    await servidor.patch(`/v1/me/links/${linkDaBella}`)
      .set("authorization", `Bearer ${tokenBella}`)
      .send({ cloakEnabled: true }).expect(200);
  });

  it("responde 404 para slug que não existe", async () => {
    await servidor.get("/v1/public/profiles/nao-existe-ninguem").expect(404);
  });

  it("não devolve veredito de robô para quem não é o nosso servidor", async () => {
    // O campo só existe para o servidor do Next, que renderiza a página. Se
    // saísse na resposta pública, qualquer um saberia exatamente quais
    // cabeçalhos passam pelo filtro — é entregar o gabarito.
    const { body } = await servidor
      .get("/v1/public/profiles/bella-teste")
      .set("user-agent", "facebookexternalhit/1.1")
      .expect(200);

    expect(body.requester).toBeUndefined();
  });

  it("classifica o requisitante quando o servidor do Next pergunta", async () => {
    const segredo = "segredo-interno-de-teste-24+";

    const robo = await servidor
      .get("/v1/public/profiles/bella-teste")
      .set("x-internal-secret", segredo)
      .set("user-agent", "facebookexternalhit/1.1")
      .expect(200);
    expect(robo.body.requester.isBot).toBe(true);

    const humano = await servidor
      .get("/v1/public/profiles/bella-teste")
      .set("x-internal-secret", segredo)
      .set("user-agent", "Mozilla/5.0 (iPhone) Mobile/15E148 Instagram 300.0.0.0")
      .set("accept-language", "pt-BR")
      .set("accept", "text/html")
      .expect(200);
    expect(humano.body.requester.isBot).toBe(false);
  });

  it("serve o avatar como imagem, não como base64 no documento", async () => {
    // Um data URL de 1,8 MB entrava duas a três vezes no HTML do perfil (o
    // payload RSC carrega a mesma árvore), e a página passava de 2,9 MB.
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==",
      "base64",
    );
    await servidor
      .patch("/v1/me/profile")
      .set("authorization", `Bearer ${tokenBella}`)
      .send({ avatarUrl: `data:image/png;base64,${png.toString("base64")}` })
      .expect(200);

    const publico = await servidor.get("/v1/public/profiles/bella-teste").expect(200);
    expect(publico.body.profile.avatarUrl).toBe(
      "/api/v1/public/profiles/bella-teste/avatar",
    );

    const imagem = await servidor
      .get("/v1/public/profiles/bella-teste/avatar")
      .expect(200);
    expect(imagem.headers["content-type"]).toContain("image/png");
    expect(imagem.headers["cache-control"]).toContain("max-age");
    expect(imagem.headers["etag"]).toBeDefined();
    expect(imagem.body.length).toBe(png.length);
  });

  it("responde 404 no avatar de quem não tem foto", async () => {
    await servidor.get("/v1/public/profiles/luna-teste/avatar").expect(404);
  });

  it("o dono continua recebendo o data URL, para o editor", async () => {
    const { body } = await servidor
      .get("/v1/me/profile")
      .set("authorization", `Bearer ${tokenBella}`)
      .expect(200);
    expect(body.avatarUrl).toMatch(/^data:image\/png;base64,/);
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

  it("não conta clique de robô e entrega a safe page", async () => {
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
    expect(body.destinationUrl).toBeNull();
    expect(body.isBot).toBe(true);
    expect(body.safePage.socialLinks).toEqual((link.safePage?.socialLinks ?? []).map(({ platform, url, title }: { platform: string; url: string; title: string }) => ({ platform, url, title })));
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

  it("mostra as métricas de um link só, e recusa link de outra conta", async () => {
    const { body: lista } = await servidor
      .get("/v1/me/links")
      .set("authorization", `Bearer ${tokenBella}`)
      .expect(200);
    const link = lista.links[0];

    const { body } = await servidor
      .get(`/v1/me/tracking/links/${link.id}?days=7`)
      .set("authorization", `Bearer ${tokenBella}`)
      .expect(200);
    expect(body.days).toBe(7);
    expect(body.report.linkId).toBe(link.id);
    expect(body.report.clicks).toBe(1);
    expect(body.report.inAppClicks).toBe(1);
    expect(body.report.bySource[0].key).toBe("instagram");
    expect(body.report.totalClicks).toBe(1);
    expect(body.report.botHits).toBe(1);
    expect(body.report.daily).toHaveLength(7);

    // Link da Bella pedido pela Luna: 404, sem nenhum número.
    await tornarPro("luna@teste.app");
    await servidor
      .get(`/v1/me/tracking/links/${link.id}`)
      .set("authorization", `Bearer ${tokenLuna}`)
      .expect(404);
  });

  it("responde 204 para view de perfil inexistente, sem revelar nada", async () => {
    await servidor
      .post("/v1/public/tracking/view")
      .send({ slug: "nao-existe-ninguem" })
      .expect(204);
  });
});

describe("planos", () => {
  // A Luna não tem link e volta ao Free logo abaixo: serve de conta Free
  // sem cadastrar outra — o cadastro tem teto de 5 por minuto, e a suíte já
  // usa os cinco.
  const emailFree = "luna@teste.app";
  const slugFree = "luna-teste";

  const comoFree = (req: request.Test) => req.set("authorization", `Bearer ${tokenLuna}`);

  // A suíte de isolamento pôs a Luna no Pro para ler o relatório.
  beforeAll(() =>
    dataSource.query(`UPDATE "socialbee_test"."users" SET pro_until = NULL WHERE email = $1`, [
      emailFree,
    ]),
  );

  it("conta nova nasce Free, e /auth/me diz isso com os limites", async () => {
    const { body } = await comoFree(servidor.get("/v1/auth/me")).expect(200);
    expect(body.user.plan.id).toBe("free");
    expect(body.user.plan.proUntil).toBeNull();
    expect(body.user.plan.limits).toEqual({
      paginas: 1,
      linksPorPagina: 5,
      relatorio: false,
      dominiosProprios: 0,
    });
  });

  it("recusa ligar o cloaking no Free, dizendo qual recurso", async () => {
    const { body } = await comoFree(servidor.post("/v1/me/links"))
      .send({ title: "X", destinationUrl: "https://t.me/free", cloakEnabled: true })
      .expect(403);
    expect(body.error.code).toBe("plano_pro_necessario");
    expect(body.error.details).toEqual({ recurso: "cloaking" });
  });

  it("aceita até 5 links no Free e recusa o sexto", async () => {
    for (let i = 0; i < 5; i++) {
      await comoFree(servidor.post("/v1/me/links"))
        .send({ title: `Link ${i}`, destinationUrl: `https://t.me/free${i}` })
        .expect(201);
    }
    const { body } = await comoFree(servidor.post("/v1/me/links"))
      .send({ title: "Sexto", destinationUrl: "https://t.me/free6" })
      .expect(403);
    expect(body.error.details).toEqual({ recurso: "links" });
  });

  it("recusa a segunda página no Free", async () => {
    const { body } = await comoFree(servidor.post("/v1/me/profiles"))
      .send({ slug: "free-segunda", displayName: "Segunda" })
      .expect(403);
    expect(body.error.details).toEqual({ recurso: "paginas" });
  });

  it("recusa outro modelo e cor própria no Free, mas aceita o Clássico", async () => {
    const capa = await comoFree(servidor.patch("/v1/me/profile"))
      .send({ templateId: "capa" })
      .expect(403);
    expect(capa.body.error.details).toEqual({ recurso: "aparencia" });

    await comoFree(servidor.patch("/v1/me/profile")).send({ bgColor: "#000000" }).expect(403);
    await comoFree(servidor.patch("/v1/me/profile"))
      .send({ templateId: "classico", bgColor: null })
      .expect(200);
  });

  it("recusa o relatório no Free", async () => {
    const { body } = await comoFree(servidor.get("/v1/me/tracking/report?days=7")).expect(403);
    expect(body.error.details).toEqual({ recurso: "relatorio" });
  });

  it("quando o Pro vence, a página pública ignora o que era Pro sem apagar nada", async () => {
    await tornarPro(emailFree);

    const link = await comoFree(servidor.post("/v1/me/links"))
      .send({ title: "Com cloak", destinationUrl: "https://t.me/cloak", cloakEnabled: true })
      .expect(201);
    await comoFree(servidor.patch("/v1/me/profile"))
      .send({ templateId: "capa", accentColor: "#123456" })
      .expect(200);

    const noPro = await servidor.get(`/v1/public/profiles/${slugFree}`).expect(200);
    expect(noPro.body.profile.template.templateId).toBe("capa");

    await dataSource.query(
      `UPDATE "socialbee_test"."users" SET pro_until = now() - interval '1 minute' WHERE email = $1`,
      [emailFree],
    );

    const publico = await servidor.get(`/v1/public/profiles/${slugFree}`).expect(200);
    expect(publico.body.profile.template.templateId).toBe("classico");
    expect(publico.body.profile.template.accentColor).toBeNull();
    const cloak = publico.body.links.find((l: { id: string }) => l.id === link.body.id);
    expect(cloak.cloakEnabled).toBe(false);
    // Não vaza nada da conta além do necessário.
    expect(JSON.stringify(publico.body)).not.toContain("proUntil");

    // O dono continua vendo o que gravou, e editar outra coisa não é recusado
    // só porque o painel reenvia o modelo Pro que já estava lá.
    const proprio = await comoFree(servidor.get("/v1/me/profile")).expect(200);
    expect(proprio.body.template.templateId).toBe("capa");
    await comoFree(servidor.patch("/v1/me/profile"))
      .send({ bio: "nova bio", templateId: "capa", accentColor: "#123456" })
      .expect(200);
    await comoFree(servidor.patch(`/v1/me/links/${link.body.id}`))
      .send({ title: "Novo título", cloakEnabled: true })
      .expect(200);
  });
});

describe("domínio próprio", () => {
  const comoBella = (req: request.Test) => req.set("authorization", `Bearer ${tokenBella}`);
  const comoLuna = (req: request.Test) => req.set("authorization", `Bearer ${tokenLuna}`);
  let idDoDominio = "";

  it("é do Pro: a conta Free é recusada", async () => {
    const { body } = await comoLuna(servidor.post("/v1/me/custom-domains"))
      .send({ host: "luna.com" })
      .expect(403);
    expect(body.error.details).toEqual({ recurso: "dominioProprio" });
  });

  it("normaliza o que a criadora digitou e nasce pendente", async () => {
    await tornarPro("bella@teste.app");
    const { body } = await comoBella(servidor.post("/v1/me/custom-domains"))
      .send({ host: "https://Links.Bella-Teste.com/ana" })
      .expect(201);
    expect(body.host).toBe("links.bella-teste.com");
    expect(body.status).toBe("pending");
    idDoDominio = body.id;
  });

  it("recusa formato inválido e domínio repetido", async () => {
    await comoBella(servidor.post("/v1/me/custom-domains")).send({ host: "sem-ponto" }).expect(400);
    const { body } = await comoBella(servidor.post("/v1/me/custom-domains"))
      .send({ host: "links.bella-teste.com" })
      .expect(409);
    expect(body.error.code).toBe("dominio_em_uso");
  });

  it("respeita as 3 vagas do Pro", async () => {
    await comoBella(servidor.post("/v1/me/custom-domains")).send({ host: "b.bella-teste.com" }).expect(201);
    await comoBella(servidor.post("/v1/me/custom-domains")).send({ host: "c.bella-teste.com" }).expect(201);
    const { body } = await comoBella(servidor.post("/v1/me/custom-domains"))
      .send({ host: "d.bella-teste.com" })
      .expect(409);
    expect(body.error.code).toBe("vagas_esgotadas");

    const lista = await comoBella(servidor.get("/v1/me/custom-domains")).expect(200);
    expect(lista.body.vagas).toBe(3);
    expect(lista.body.domains).toHaveLength(3);
  });

  it("pendente não é oferecido; ativo aparece só para a dona", async () => {
    const pendente = await comoBella(servidor.get("/v1/me/domains")).expect(200);
    expect(pendente.body.domains.map((d: { id: string }) => d.id)).not.toContain(idDoDominio);

    // O que `npm run dominio:ativar` faz.
    await dataSource.query(
      `UPDATE "socialbee_test"."domains" SET status = 'active' WHERE id = $1`,
      [idDoDominio],
    );

    const ativo = await comoBella(servidor.get("/v1/me/domains")).expect(200);
    const proprio = ativo.body.domains.find((d: { id: string }) => d.id === idDoDominio);
    expect(proprio).toMatchObject({ host: "links.bella-teste.com", proprio: true });

    const outraConta = await comoLuna(servidor.get("/v1/me/domains")).expect(200);
    expect(outraConta.body.domains.map((d: { id: string }) => d.id)).not.toContain(idDoDominio);
  });

  it("a dona serve uma página por ele; outra conta não consegue", async () => {
    const { body } = await comoBella(servidor.patch("/v1/me/profile"))
      .send({ domainId: idDoDominio })
      .expect(200);
    expect(body.host).toBe("links.bella-teste.com");

    await tornarPro("luna@teste.app");
    const recusado = await comoLuna(servidor.patch("/v1/me/profile"))
      .send({ domainId: idDoDominio })
      .expect(409);
    expect(recusado.body.error.code).toBe("dominio_indisponivel");
  });

  it("remover devolve a página ao domínio padrão; de outra conta é 404", async () => {
    await comoLuna(servidor.delete(`/v1/me/custom-domains/${idDoDominio}`)).expect(404);
    await comoBella(servidor.delete(`/v1/me/custom-domains/${idDoDominio}`)).expect(204);
    const { body } = await comoBella(servidor.get("/v1/me/profile")).expect(200);
    expect(body.domainId).toBeNull();
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
