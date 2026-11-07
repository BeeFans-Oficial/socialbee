# BeeSocial

Link na bio para criadoras de conteúdo adulto. O diferencial é a **página de
chegada**: quem abre o link de dentro do Instagram vê uma tela que leva ao
navegador do celular, onde login e pagamento funcionam.

> **Uma página só, para todo mundo.** O servidor entrega o mesmo HTML a fã,
> crawler e navegador da Meta; a página de chegada é uma sobreposição decidida
> no aparelho, e o redirecionador dá o mesmo 307 a qualquer um. Servir
> documento diferente por user-agent é o que a Meta chama de cloaking — em
> 15/10/2026 ela comparou três versões de um perfil nosso e derrubou a conta
> da criadora no mesmo segundo em que o link entrou na bio. O raciocínio
> completo está em `app/[slug]/page.tsx`.

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
git archive HEAD | ssh root@<vps> 'tar -x -C /opt/beesocial'
ssh root@<vps> 'cd /opt/beesocial && docker compose -f docker-compose.prod.yml up -d --build'
```

Sobe o **commit**, não o diretório: o que não está versionado — a começar pelo
seu `.env.local` — nunca chega ao servidor. Commite antes.

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
| `/` | Tela inicial, com busca de endereço que leva ao cadastro |
| `/login` · `/cadastro` | Autenticação real contra a API |
| `/paginas` | As páginas da conta, em cartões; porta de entrada do painel. `?nova=1` abre a criação |
| `/paginas/[id]` | Editor da página: prévia em iPhone e painel com nome, foto de perfil, bio, domínio, endereço, proteção, tema, modelo, cores, fonte, botões, capa e página de chegada |
| `/links` | Links da página ativa: arrastar para reordenar, ativar, copiar, apagar; clicar nos cliques abre as métricas do link |
| `/links/[id]` · `/links/novo` | Editor de um link, com a prévia do botão |
| `/analytics` | Métricas e gráficos sobre dados **reais** do rastreamento (Pro) |
| `/dominios` | Domínio próprio (Pro) |
| `/configuracoes` | A conta: email, plano e sair |
| `/admin` · `/admin/contas` · `/admin/contas/[id]` · `/admin/auditoria` | Painel de operação, só para contas com `role = 'admin'`. Para as outras a rota responde 404 |
| `/api/v1/*` | Proxy para a API, no servidor do Next (é o que mantém o cookie de sessão same-origin) |
| `/[slug]` | Perfil público de qualquer criadora cadastrada. Barreira de idade + registro de visualização |
| `/r/[code]` | Redirecionador real: registra o clique e faz 302 para o destino |

### A casca do painel

Tudo em `app/(painel)` — listas **e** editores — renderiza dentro da mesma casca
(`components/painel/Shell.tsx`): barra lateral de 240px no computador, que vira um
trilho de 72px nos editores para a prévia caber; barra inferior fixa no celular
(Páginas, Links, Analytics, Mais); e a barra do topo com o **seletor de página**,
que é o único lugar do painel que troca a página em edição. As telas de lista usam
`Tela` e `CabecalhoDeTela` (`components/painel/Tela.tsx`), que fixam largura,
margens e o título — cada tela escolhia as suas. As regras visuais estão em
`design-system/beesocial/MASTER.md`, inclusive os tokens de movimento
(`lib/movimento.ts`, com framer-motion) que toda animação do painel usa. O tour
guiado de cada tela (`components/painel/tour/`) aponta para elementos marcados
com `data-tour` e começa sozinho na primeira visita.

## Painel admin

Mesmo app, mesma API. A diferença está no papel da conta: `users.role` é
`creator` (padrão) ou `admin`. Ninguém vira admin pelo cadastro; o primeiro é
promovido por script, e os seguintes pelo próprio painel, com registro:

```bash
npm --prefix api run admin:promover -- --email equipe@beesocial.bio
npm --prefix api run admin:promover -- --email equipe@beesocial.bio --rebaixar
# produção, dentro do container da API:
node dist/database/seeds/promover-admin.js --email equipe@beesocial.bio
```

Quem decide o que a pessoa vê é a **API**: `proxy.ts` pergunta `/v1/auth/me`
antes de servir qualquer rota `/admin/*` e devolve 404 a quem não é admin, e o
layout `app/(admin)` repete a pergunta no servidor. Os dados vêm de
`/v1/admin/*`, que o `RolesGuard` (`@Roles("admin")`) protege por conta
própria — as duas checagens do app só decidem o que desenhar.

O que o painel faz hoje: visão geral da plataforma, busca e detalhe de contas,
criar contas (só o e-mail: a pessoa recebe um convite e cria a própria senha
pelo link, que vale 7 dias; o admin reenvia o convite se precisar), editar e
apagar contas, liberar e tirar o Pro (substitui `plano:liberar`), revogar
sessões, promover e rebaixar admins, e o pool de domínios (`/admin/dominios`): listar com páginas e visitas da semana,
adicionar, pausar e reativar, renomear. Domínio novo nasce pausado — a linha no
banco é o último passo, depois do DNS, do nginx e do certificado — e o admin
ativa quando ele já abre em HTTPS. Pausar tira do sorteio e do seletor sem
derrubar as páginas que já estão nele. Toda ação exige motivo e fica em `admin_actions`, visível na
tela Auditoria. O que ainda não faz está em
`01 - Produto/Painel admin — funcionalidades` no vault do produto.

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

## E-mail

Um e-mail só, no cadastro: boas-vindas com o botão de confirmar o endereço
(`api/src/common/email/modelos/boas-vindas.ts`). O envio é pelo Resend, fora
da transação e fora da resposta do cadastro — o provedor fora do ar não impede
ninguém de criar conta. Sem `RESEND_API_KEY` (dev e teste) a mensagem vai para
o log da API, com o link dentro; em produção a chave é obrigatória.

**O cadastro não abre sessão.** A conta é gravada (e-mail e endereço da página
ficam reservados), a tela diz "confira seu e-mail", e o login recusa com
`email_nao_confirmado` até o clique no link — a tela de login então mostra
"reenviar". Conta que não confirma em 7 dias é apagada de madrugada
(`RetentionService.purgeUnconfirmedAccounts`), exceto as abertas pelo admin.
As contas anteriores à migration `1791100000000` entraram pela regra antiga e
foram marcadas como confirmadas com a data de criação.

O link vale 24 horas; reenviar invalida o anterior; o segundo clique num link
já usado responde sucesso, não erro. Tokens vão hasheados para `email_tokens`.
O reenvio é público, por e-mail, e responde igual exista a conta ou não.

**Conta aberta pelo admin** nasce sem senha (`password_hash` nulo) e recebe um
convite (`modelos/convite.ts`) com o link de `/definir-senha`, token com
`purpose = 'set_password'` e 7 dias de validade. Criar a senha pelo link
confirma o e-mail e abre a sessão. Sem senha o login falha como senha errada,
de propósito. É o mesmo mecanismo que a recuperação de senha vai usar.

Remetente `EMAIL_FROM` (default `BeeSocial <links@beesocial.bio>`, domínio
verificado no Resend em 06/11/2026) e `EMAIL_REPLY_TO` opcional.

## Analytics

`GET /me/tracking/report` aceita a janela (`days=7|30|90` ou `de`+`ate`, até
90 dias) e recortes por `link`, `origem`, `chegada` (domínio do pool),
`aparelho`, `pais` e `app=sim|nao`. Os filtros são aplicados em memória sobre
os eventos da janela (`api/src/tracking/tracking.service.ts`); o volume por
página é pequeno, e o dia em que pesar a contagem desce para o SQL sem mudar o
contrato. A resposta traz a janela anterior de mesmo tamanho (`previous`), com
os mesmos filtros, e as opções de cada filtro (`options`) montadas antes dos
filtros. Na tela, o recorte vive na URL.

## Planos Free e Pro

As regras ficam em `api/src/plans/plans.ts`. Uma conta é Pro enquanto
`users.pro_until` estiver no futuro. Vencida a data, ela volta a ser Free sozinha.

| | Free | Pro |
|---|---|---|
| Páginas por conta | 1 | sem limite |
| Links por página | 5 | sem limite |
| Modelo, cores e fonte | só o Clássico e os temas prontos | todos |
| Saída do app ao tocar num link (`cloakEnabled`) | não | sim |
| Escolher o domínio | não (fica com o sorteado) | sim |
| Relatório de visitas e cliques | não | sim (7, 30 ou 90 dias) |

O "sair do app" (página de chegada) e o sorteio de domínio no cadastro valem
para todos, de propósito.

Quando a conta volta ao Free, **nada é apagado**. O que era Pro fica gravado e
deixa de valer na página pública. Links e páginas acima do limite continuam no
ar, e só não é possível criar novos.

Para liberar ou tirar o Pro manualmente (cada mudança fica registrada em
`plan_grants`):

```bash
npm --prefix api run plano:liberar -- --email ana@x.com --dias 30 --motivo "parceria"
npm --prefix api run plano:liberar -- --email ana@x.com --ate 2026-12-31 --motivo "cortesia"
npm --prefix api run plano:liberar -- --email ana@x.com --rebaixar --motivo "fim da parceria"
# ou pelo painel admin, em /admin/contas, com o mesmo registro em plan_grants
# produção, dentro do container da API:
node dist/database/seeds/liberar-pro.js --email ana@x.com --dias 30 --motivo "parceria"
```

O `--rebaixar` volta a conta ao Free na hora. As concessões ativas não são
apagadas: elas terminam naquele momento e recebem o motivo anotado.

A assinatura paga (Pix) ainda não existe.

## Domínio próprio

Recurso do Pro, com 3 vagas por conta (`dominiosProprios` em
`api/src/plans/plans.ts`). Fica na tabela `domains`, ao lado do pool, com dona
(`owner_user_id`) e status (`pending` ou `active`).

1. A criadora cadastra o domínio em `/dominios`, e ele fica `pending`.
2. Ela cria um registro A apontando para a VPS e confere o DNS pelo painel.
   O IP vem de `SERVER_PUBLIC_IP` na API; sem essa variável, o painel pede
   para ela falar com a equipe.
3. A equipe configura o domínio no nginx e emite o certificado, como num
   domínio do pool (`deploy/nginx/dominios/`). Depois ativa:

```bash
npm --prefix api run dominio:ativar -- --listar
npm --prefix api run dominio:ativar -- --host links.marca.com
# produção, dentro do container da API:
node dist/database/seeds/ativar-dominio.js --host links.marca.com
```

Depois de ativo, o domínio aparece no seletor "Domínio" das páginas da dona, e
só dela. Domínio próprio nunca entra no sorteio do cadastro.

## O que ainda não existe

- **Recuperação de senha.** A tela "Esqueci minha senha" não aponta para nada.
  A base já existe: o envio de e-mail (`api/src/common/email/`, Resend) e a
  tabela `email_tokens`, com `purpose` pronto para `reset_password`.
- **Upload de arquivo.** Feito: avatar, capa, foto da página de chegada e
  miniatura sobem em multipart (`POST /me/profile/images/:tipo`,
  `POST /me/links/:id/image`), são redimensionadas pelo `sharp` e vão para um
  bucket S3 — Cloudflare R2 em produção, RustFS no compose de dev; a coluna
  guarda a chave (`varchar(255)` desde a migration `1790900000000`) e a página
  pública aponta para `MEDIA_PUBLIC_URL` (`/media/` do site, nginx com cache na
  frente do R2). O caminho antigo de base64 foi removido; `npm run
  imagens:migrar` só serve a um backup anterior a 14/10/2026.
- **Safe Page sem efeito público.** O editor de link ainda grava as redes da
  Safe Page (`safe_pages`), mas desde 15/10/2026 nenhuma rota as serve: robô
  recebe o mesmo perfil e o mesmo redirecionamento que a fã (ver o aviso no
  topo). Decisão em aberto: tirar o campo do editor ou dar a ele outro uso.
- **`/configuracoes`.** Mostra email e plano e permite sair; troca de senha e
  assinatura ainda não existem.
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
