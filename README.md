# BeeSocial

Link na bio para criadoras de conteúdo adulto. O diferencial pretendido é o
**cloaking**: escapar do navegador interno do Instagram e servir uma página
limpa aos robôs da rede, para que links de OnlyFans/Privacy/Telegram não sejam
bloqueados.

> **Estado: MVP com API.** Autenticação por email e senha, perfil, links e
> rastreamento vivem em Postgres, atrás de uma API própria (`api/`). O que
> continua faltando está listado em [O que ainda não existe](#o-que-ainda-não-existe).

## Rodar

Tudo — banco, API e app — com um comando:

```bash
cp .env.example .env      # gere seus próprios segredos antes de qualquer deploy
docker compose up
```

App em `http://localhost:3000`, API em `http://localhost:3333/v1`.

Conta de demonstração: `bella@beesocial.app` / `123456` (perfil `/bella`).

> Portas 3000, 3333 ou 5433 ocupadas? Ajuste `WEB_PORT`, `API_PORT` e
> `POSTGRES_PORT` no `.env`.

## Desenvolvimento

No dia a dia, só o **banco** roda em container. API e app sobem na mão, cada um
no seu terminal, com recarga automática:

```bash
cp .env.example .env                 # uma vez
cp api/.env.example api/.env         # uma vez
npm install && npm --prefix api install

npm run dev:db                       # sobe só o Postgres (porta 5433)
npm --prefix api run migration:run   # uma vez, ou quando houver migration nova
npm --prefix api run seed            # conta de demonstração (opcional)

npm run dev:api                      # terminal 2 — API em :3333, com watch
npm run dev                          # terminal 3 — app em :3000, com watch
```

O app fala com a API por `/api/v1/*` na própria origem (o proxy em
`app/api/v1/[...path]/route.ts` repassa para `API_INTERNAL_URL`, que em
desenvolvimento tem default `http://localhost:3333`). Não é preciso configurar
CORS nem mexer em porta.

**Uma armadilha que vale saber:** `JWT_SECRET` e `INTERNAL_API_SECRET` existem
nos dois arquivos (`.env` e `api/.env`) e precisam ter o **mesmo valor**. Se
divergirem, o cookie de sessão assinado por um não vale no outro (você fica
deslogado sem explicação) e o redirecionador para de contar clique — a API
responde 404 no registro, o visitante é redirecionado normalmente, e nada avisa.

Para parar o banco: `npm run dev:db:stop`. Os dados ficam no volume; só
`docker compose down -v` os apaga.

Rodar tudo em container continua sendo `docker compose up` — é assim que se
verifica a imagem antes de subir para algum lugar.

## Deploy

No ar em **https://beesocial.bio**, numa VPS: banco, API e front em containers
publicados só no loopback, com nginx nativo do host terminando o TLS. O
procedimento de deploy — enviar o código, subir, conferir, e o que fazer quando
algo quebra — está em **[deploy/README.md](deploy/README.md)**, junto com a
instalação do zero, a operação e o backup.

```bash
rsync -az --delete --exclude node_modules --exclude .next --exclude .git \
  --exclude dist --exclude .env --exclude .data ./ root@<vps>:/opt/beesocial/
ssh root@<vps> 'cd /opt/beesocial && docker compose -f docker-compose.prod.yml up -d --build'
```

O `--exclude .env` não é opcional: sem ele o `.env` de desenvolvimento
sobrescreve o de produção.

## Stack

**App:** Next.js 16 (App Router, Turbopack) · React 19 · TypeScript strict ·
Tailwind 3.4 · framer-motion · @dnd-kit · recharts · sonner · Radix
(dialog, switch, slot).

**API** (`api/`, documentada em [api/README.md](api/README.md)): NestJS ·
Postgres 16 · TypeORM com migrations de SQL escrito à mão · JWT em cookie
`httpOnly`.

**Infra:** `docker compose` com três serviços — `db`, `api`, `web`.

## Rotas

| Rota | Estado |
| --- | --- |
| `/` | Landing completa |
| `/login` · `/cadastro` | Autenticação real contra a API |
| `/links` | Dashboard principal: drag & drop, CRUD, modal com abas Link/Aparência/Perfil |
| `/aparencia` | Perfil, temas, estilos de botão, preview em celular |
| `/analytics` | Métricas e gráficos sobre dados **reais** do rastreamento |
| `/configuracoes` | Placeholder |
| `/api/v1/*` | Proxy para a API, no servidor do Next (é o que mantém o cookie de sessão same-origin) |
| `/dashboard` | Existe, mas a Sidebar não aponta para lá |
| `/[slug]` | Perfil público de qualquer criadora cadastrada. Barreira de idade + registro de visualização |
| `/r/[code]` | Redirecionador real: registra o clique e faz 302 para o destino |

## Arquitetura

```
navegador ──► app Next (3000) ──► API Nest (3333) ──► Postgres (schema socialbee)
                   │
                   └─ /api/v1/*  proxy no servidor: o navegador só fala com a
                      própria origem, então o cookie de sessão é same-site, o
                      token nunca passa por localStorage e não há CORS no
                      caminho do produto
```

O app não fala com o banco. Toda leitura e escrita passa pela API, e o
`profileId` sai **sempre** da sessão — nunca da query string.

Duas peças do app rodam no servidor e falam com a API por dentro, com o segredo
interno:

- `app/api/v1/[...path]/route.ts` — o proxy acima. É Route Handler e não
  `rewrites` porque `rewrites()` é avaliado no build: o destino iria congelado
  para dentro da imagem Docker, apontando para o `localhost` da máquina que
  buildou.
- `app/r/[code]/route.ts` — o redirecionador. Pede à API o destino, repassando
  os cabeçalhos do visitante (é com eles que a API decide se o acesso é humano),
  e faz o 302. O destino nunca chega ao navegador.

## Rastreamento de links

Vive na API, em `api/src/tracking/`. O núcleo (`bots.ts`, `attribution.ts`,
`service.ts`) foi portado de `lib/tracking/` sem mudar nenhuma decisão de
domínio; só a persistência mudou — era arquivo em `.data/tracking/` com mutex em
memória, servindo um processo só, e agora é Postgres com
`INSERT ... ON CONFLICT DO UPDATE SET clicks = clicks + 1`.

Três decisões que valem saber:

- **Robô não vira clique.** Cada link colado em WhatsApp, Telegram ou Discord
  gera requisição de prévia. Sem o filtro, um link compartilhado em grupo grande
  nasce com dezenas de cliques que ninguém deu. Requisições de robô são
  redirecionadas normalmente e contadas em separado (`botHits`), visíveis no
  relatório — sem isso a criadora acha que perdeu tráfego.
- **`HEAD` não conta.** Sondagem não é visita.
- **Contador desnormalizado por link.** O evento cru tem TTL de 90 dias e é
  volume; o contador não expira e é o histórico.

Nada ali conhece "onlyfans" ou "telegram": `channel` é string opaca, o destino é
qualquer URL http(s), e o funil termina no redirecionamento — o destino é de
terceiro e ninguém nos avisa quando a venda acontece lá.

O diretório `.data/tracking/` do protótipo ficou obsoleto e **não** é migrado:
os eventos gravados nele não vão para o banco.

## O que ainda não existe

- **Recuperação de senha.** A tela "Esqueci minha senha" não aponta para nada.
- **Upload de arquivo.** Avatar, capa e miniatura são data URL em base64 e vão
  para colunas de texto. O certo é armazenamento de objeto com URL assinada.
- **Cloaking no servidor.** `lib/cloak.ts` faz escape de in-app browser no
  cliente (intent URL no Android, redirect + fallback no iOS) e isso funciona. A
  safe page agora é **persistida**, mas nenhuma rota serve conteúdo diferente a
  crawler. Decisão de produto em aberto: servir conteúdo diferente ao robô da
  Meta viola o ToS deles.
- **`/configuracoes`.** Continua placeholder; sair está na Sidebar.
- **`/dashboard`.** Existe e nenhuma navegação aponta para lá.
- **ESLint.** Não há config, e `npm run lint` quebra: `next lint` foi removido no
  Next 16.
- **CI.** A API tem 49 testes (unitários + ponta a ponta com Postgres real) e
  eles passam; nada os roda automaticamente. O app não tem teste.

## Limites conhecidos

- **Reordenar exige a lista completa de links.** É de propósito (ordem parcial
  deixaria dois links na mesma posição), mas significa que arrastar enquanto
  existe um link em rascunho — escolhido no seletor e ainda sem destino — só
  reordena na tela; a ordem é gravada no arraste seguinte.
- **A sessão dura 7 dias e não tem refresh.** Expirada, a primeira requisição
  responde 401 e a tela manda para o login.
- **O IP do visitante chega por `x-forwarded-for`**, que qualquer salto
  intermediário pode reescrever. Por isso ele alimenta só o filtro de robô e o
  prefixo de rede do relatório — nunca autorização — e bater numa faixa de
  datacenter **pontua** em vez de descartar direto (um proxy mal configurado na
  frente apagaria todo clique humano em silêncio).
