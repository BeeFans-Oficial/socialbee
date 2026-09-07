# BeeSocial

Link na bio para criadoras de conteúdo adulto. O diferencial pretendido é o
**cloaking**: escapar do navegador interno do Instagram e servir uma página
limpa aos robôs da rede, para que links de OnlyFans/Privacy/Telegram não sejam
bloqueados.

> **Estado: protótipo.** O rastreamento de links é real e persiste em disco
> (ver abaixo). O resto — perfil, links, aparência — vive em `useState` sobre
> `lib/mock-data.ts` e se perde no refresh. Não há autenticação nem banco.

## Rodar

```bash
npm install
npm run dev      # http://localhost:3000
npm run build
```

Login mockado: `bella@beesocial.app` / `123456`.

## Stack

Next.js 16 (App Router, Turbopack) · React 19 · TypeScript strict ·
Tailwind 3.4 · framer-motion · @dnd-kit · recharts · sonner · Radix
(dialog, switch, slot).

## Rotas

| Rota | Estado |
| --- | --- |
| `/` | Landing completa |
| `/login` · `/cadastro` | UI completa, autenticação falsa |
| `/links` | Dashboard principal: drag & drop, CRUD, modal com abas Link/Aparência/Perfil |
| `/aparencia` | Perfil, temas, estilos de botão, preview em celular |
| `/analytics` | Métricas e gráficos sobre dados **reais** do rastreamento |
| `/configuracoes` | Placeholder |
| `/dashboard` | Existe, mas a Sidebar não aponta para lá |
| `/[slug]` | Perfil público (só `bella` e `demo` resolvem). Registra visualização |
| `/r/[code]` | Redirecionador real: registra o clique e faz 302 para o destino |

## Rastreamento de links

Registra clique e visualização de verdade, escopado por perfil e agnóstico de
canal. Vive em `lib/tracking/`.

| Arquivo | Papel |
| --- | --- |
| `types.ts` | Domínio e as interfaces trocáveis (`TrackingStore`, `LinkResolver`) |
| `bots.ts` | Filtro de robô: user agent, faixas de datacenter, heurística de cabeçalho |
| `attribution.ts` | UTM, click ids, referrer, dispositivo, navegador embutido, prefixo de IP |
| `store-file.ts` | Persistência em `.data/tracking/` (evento append-only + contador) |
| `resolver.ts` | Código curto → link. Hoje lê `mock-data.ts`; é o ponto de troca para o banco |
| `service.ts` | Casos de uso: `recordClick`, `recordView`, `report` |

Endpoints: `GET /r/[code]` (redireciona e conta), `POST /api/tracking/view`,
`GET /api/tracking/report?days=7|30|90`.

Três decisões que valem saber:

- **Robô não vira clique.** Cada link colado em WhatsApp, Telegram ou Discord
  gera requisição de prévia. Sem o filtro, um link compartilhado em grupo grande
  nasce com dezenas de cliques que ninguém deu. Requisições de robô são
  redirecionadas normalmente e contadas em separado (`botHits`).
- **`HEAD` não conta.** Sondagem não é visita.
- **Contador desnormalizado por link.** O evento cru tem TTL de 90 dias e é
  volume; o contador não expira e é o histórico. Essa separação vem do
  `bee-api-2` e é o que a troca por banco deve reproduzir.

Nada aqui conhece "onlyfans" ou "telegram": `channel` é string opaca, o destino
é qualquer URL http(s), e o funil termina no redirecionamento — o destino é de
terceiro e ninguém nos avisa quando a venda acontece lá.

**Limites da implementação atual:** o store em arquivo serve um processo só (o
contador faz ler-modificar-gravar sob mutex em memória); em produção isso vira
`UPDATE ... SET clicks = clicks + 1`. E `/api/tracking/report` fixa o perfil em
`MOCK_USER.id` porque não há autenticação — quando houver sessão, o `profileId`
sai dela e nunca da query string.

## O que ainda não existe

- **Autenticação.** Não há sessão, e por isso o relatório é escopado num perfil
  fixo.
- **Banco.** O rastreamento grava em arquivo (ver acima); o resto do app segue
  em `useState` sobre `lib/mock-data.ts`.
- **Cloaking no servidor.** `lib/cloak.ts` faz escape de in-app browser no
  cliente (intent URL no Android, redirect + fallback no iOS) e isso funciona.
  Mas nenhuma rota serve conteúdo diferente a crawler — a `SafePage` é montada
  no `LinkModal` e descartada. Decisão de produto em aberto: servir conteúdo
  diferente ao robô da Meta viola o ToS deles.
- **Age gate ligado.** `components/profile/AgeGate.tsx` está pronto e
  **não é importado por ninguém** — `/bella` abre conteúdo +18 direto.
- **Tipografia da marca.** `font-bebas` e `font-barlow` são usados em 56 lugares
  e não existem em `tailwind.config.ts` (falta `fontFamily`). Tudo renderiza em
  Inter.
- **ESLint.** Não há config, e `npm run lint` quebra: `next lint` foi removido
  no Next 16.
- **Testes e CI.**

## Bugs conhecidos

- `app/links/page.tsx` — `handleSaveLink` descarta payload sem `id`, então o
  primeiro link criado a partir do estado vazio some, e o toast diz "Link salvo".
- `app/aparencia/page.tsx` — o `<PhoneMockup>` não recebe `links`, e o preview
  ao vivo fica sempre em "Nenhum link ativo".
- `lib/utils.ts` — `RESERVED_SLUGS` não inclui as rotas reais (`links`,
  `aparencia`, `analytics`, `configuracoes`, `cadastro`, `r`), então um slug
  pode ser sombreado pelo dashboard.
- `lib/mock-data.ts:172` — `Math.random()` no escopo do módulo. Já não afeta
  `/analytics` (que agora lê dados reais), mas ainda é risco de hydration
  mismatch para quem consumir `MOCK_ANALYTICS` no servidor.
