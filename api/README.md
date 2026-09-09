# BeeSocial API

Serviço que passou a ser dono de **identidade, perfil, links e rastreamento** do
BeeSocial. Antes disso, o app (Next.js, na raiz deste repositório) mantinha tudo
em `useState` sobre um arquivo de mock: perfil, links e aparência se perdiam no
refresh, o login comparava strings no navegador, e o relatório de cliques era
escopado num perfil fixo porque não havia sessão.

NestJS · TypeScript · Postgres 16 · TypeORM (migrations de SQL escrito à mão) ·
JWT em cookie `httpOnly`.

## Subir

Junto com o app e o banco, da raiz do repositório:

```bash
cp .env.example .env      # gere seus próprios segredos antes de qualquer deploy
docker compose up
```

App em `http://localhost:3000`, API em `http://localhost:3333/v1`.

Conta de demonstração criada pelo seed: `bella@beesocial.app` / `123456`
(perfil `/bella`, com os cinco links do protótipo e os mesmos códigos curtos —
qualquer `/r/xK9mP1` que já exista num print continua resolvendo).

> Se as portas 3000, 3333 ou 5433 já estiverem ocupadas na sua máquina, ajuste
> `WEB_PORT`, `API_PORT` e `POSTGRES_PORT` no `.env`.

Só a API, contra um Postgres avulso:

```bash
cd api
cp .env.example .env
npm install
npm run migration:run
npm run seed
npm run start:dev
```

## Comandos

| Comando | O que faz |
| --- | --- |
| `npm run start:dev` | API em modo watch |
| `npm run build` · `npm start` | build e execução de produção |
| `npm run migration:run` | cria o schema e aplica as migrations pendentes |
| `npm run migration:revert` | desfaz a última migration |
| `npm run seed` | conta e links de demonstração (idempotente) |
| `npm run retention` | expurga o evento cru além do TTL, à mão |
| `npm test` | unitários (filtro de robô, atribuição, validação de destino) |
| `npm run test:e2e` | ponta a ponta: HTTP + Postgres real, em schema próprio |
| `npm run typecheck` | `tsc --noEmit` |

`npm run test:e2e` precisa do banco no ar (`docker compose up -d db`). Ele cria e
derruba o schema `socialbee_test` e nunca encosta no de desenvolvimento.

## Rotas

Todas sob `/v1`. Erro sempre com o mesmo formato:
`{ "error": { "code", "message", "details?", "requestId?" } }`.

### Público

| Rota | Papel |
| --- | --- |
| `GET /health` | liveness; toca o banco (é o `HEALTHCHECK` do container) |
| `POST /auth/register` | `{ email, password, displayName, slug, ageConfirmed, isAdult? }` → cria conta + perfil e já autentica |
| `POST /auth/login` | `{ email, password }` → cookie de sessão + `accessToken` no corpo |
| `GET /public/slug-available?slug=` | formato + reservados + já existente, numa resposta |
| `GET /public/profiles/:slug` | perfil e links ativos — **sem** `destinationUrl` |
| `POST /public/tracking/view` | `{ slug }`; o servidor traduz para o perfil |
| `POST /public/tracking/click` | `{ code, url?, method? }` → `{ destinationUrl, counted, reason }`. Exige `x-internal-secret` |

### Com sessão

| Rota | Papel |
| --- | --- |
| `GET /auth/me` | conta + perfil da sessão |
| `POST /auth/logout` | revoga a sessão no banco e limpa o cookie |
| `GET` · `PATCH /me/profile` | nome, bio, slug, avatar, capa, tema, estilo de botão, +18 |
| `GET` · `POST /me/links` | listar e criar |
| `PATCH` · `DELETE /me/links/:id` | editar e remover |
| `PATCH /me/links/reorder` | `{ ids: [...] }` na ordem final, lista completa |
| `GET /me/tracking/report?days=7\|30\|90` | `{ days, report, counters }` |

Nenhuma rota aceita `profileId` do cliente. O perfil sai **sempre** da sessão.

## Decisões que valem saber

**O guard de sessão é global.** Rota nova nasce fechada; abrir exige o decorator
`@Public()`. O erro de esquecer o decorator dá 401, não dado exposto.

**Posse de recurso responde 404, não 403.** Um 403 confirmaria que o id existe, e
com isso alguém enumera os links de outra criadora só lendo o código de resposta.
A checagem acontece em dois lugares de propósito: o guard é a política (declarada
na rota) e o `WHERE ... AND profile_id = $sessão` no serviço é o escopo, que
protege quem chamar o serviço de fora do HTTP.

**Logout revoga de verdade.** Cada token emitido tem uma linha em `sessions`, e o
guard a confere em toda requisição. Sem isso, sair seria apagar o cookie do
navegador enquanto o token segue valendo para quem o copiou.

**O destino do link nunca chega ao navegador do visitante.** `GET
/public/profiles/:slug` devolve o código curto, não a URL. É isso que mantém o
link do OnlyFans fora do HTML e fora do alcance do robô da rede social — o
produto inteiro depende dessa assimetria.

**O registro de clique é servidor-a-servidor.** O código curto é público (está na
bio dela). Se a rota que grava o clique fosse aberta, qualquer pessoa a chamaria
em laço e inflaria o contador — que é o número que a criadora usa para negociar
valor. Quem chama é o redirecionador do Next, com o segredo interno.

**Robô não vira clique, mas é redirecionado.** Cada link colado em WhatsApp,
Telegram ou Discord gera requisição de prévia; sem filtro, um link compartilhado
em grupo grande nasce com dezenas de cliques que ninguém deu. Requisições de robô
contam em separado (`botHits`), visíveis no relatório — sem isso a criadora acha
que perdeu tráfego. `HEAD` não conta: sondagem não é visita.

**Evento cru tem TTL, contador não.** `tracking_events` é volume e expira em 90
dias; `link_counters` é histórico e é para sempre, atualizado com
`INSERT ... ON CONFLICT DO UPDATE SET clicks = clicks + 1` no mesmo caminho do
evento. É o que permite a lista de links mostrar número sem agregar a tabela de
eventos.

**Migrations são SQL escrito à mão, com `synchronize: false`.** O schema é o
contrato mais duradouro do sistema, e o que um gerador não expressa está lá:
`CHECK` de formato em slug, email, código curto e esquema do destino; `ON DELETE`
escolhido caso a caso com o motivo escrito junto; gatilho de `updated_at`.
`synchronize: true` compara entidade com banco e "conserta" a diferença — em
produção isso é `DROP COLUMN` silencioso.

**`users` e `profiles` são tabelas separadas.** Ali mora o que autentica; aqui, o
que o público vê. Nenhuma consulta de perfil público toca a tabela de contas, o
que torna difícil vazar email de criadora num `SELECT *`. E o rastreamento já era
escopado por perfil desde o protótipo, com multi-perfil no contrato.

**`ON DELETE` do rastreamento é assimétrico de propósito.** Apagar um link põe
`tracking_events.link_id` em `NULL` (o total de cliques do período não pode cair)
e apaga o `link_counters` dele em cascata (um contador órfão viraria linha de
relatório sem título que ninguém sabe interpretar).

## Schema `socialbee`

| Tabela | Papel |
| --- | --- |
| `users` | email, hash de senha, data da declaração de maioridade |
| `sessions` | uma linha por token emitido — é o que faz logout revogar |
| `profiles` | slug, nome, bio, avatar, capa, tema, estilo de botão, +18 |
| `links` | título, canal, código curto, destino, posição, cloaking, aparência (`jsonb`) |
| `safe_pages` · `safe_page_social_links` | a página limpa do cloaking, que o modal montava e descartava |
| `tracking_events` | clique e visualização crus, com atribuição e contexto (`jsonb`) |
| `link_counters` | total histórico por link: cliques, hits de robô, último clique |

## Estrutura

```
src/
├── main.ts                 helmet, CORS por lista, cookie-parser, ValidationPipe
├── app.module.ts           ordem dos guards globais (throttle → sessão)
├── config/env.ts           ambiente; falta de segredo derruba a subida
├── common/                 @Public, @CurrentUser, filtro de erro, log com request-id,
│                           guard de segredo interno, validação de destino
├── database/               data-source, migrations (SQL), seed e expurgo (DML)
├── auth/                   registro, login, logout, sessão, JwtAuthGuard
├── profiles/               perfil da sessão, perfil público, slugs reservados
├── links/                  CRUD, reordenação transacional, guard de posse
└── tracking/               porte de bots/attribution/service + store Postgres
```

O núcleo de `tracking/` (`bots.ts`, `attribution.ts`, `service.ts`) veio de
`lib/tracking/` do app, sem mudar nenhuma decisão de domínio. Só a persistência
mudou: era arquivo com mutex em memória, servindo um processo só; agora é
Postgres.

## O que não existe ainda

- **Recuperação de senha.** `POST /auth/login` é o único caminho de entrada; a
  tela "Esqueci minha senha" não aponta para nada.
- **Refresh token.** A sessão dura `JWT_TTL` (7 dias) e o logout revoga. Não há
  rotação nem tela de "dispositivos conectados" — os dados para ela já são
  gravados em `sessions` (user agent, prefixo de IP).
- **Upload de arquivo.** Avatar, capa e miniatura chegam como data URL em base64
  e vão para colunas `text` (por isso o limite de corpo é 10 MB). O certo é
  armazenamento de objeto com URL assinada.
- **Cloaking no servidor.** A safe page agora é persistida, mas nenhuma rota
  serve conteúdo diferente a crawler. Continua sendo decisão de produto em
  aberto: servir conteúdo diferente ao robô da Meta viola o ToS deles.
- **CI.** Os testes existem e passam; nada os roda automaticamente.
