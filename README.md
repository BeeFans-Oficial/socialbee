# BeeSocial

Link na bio para criadoras de conteúdo adulto. O diferencial pretendido é o
**cloaking**: escapar do navegador interno do Instagram e servir uma página
limpa aos robôs da rede, para que links de OnlyFans/Privacy/Telegram não sejam
bloqueados.

> **Estado: protótipo de frontend.** Não há backend, banco, autenticação nem
> persistência. Todo estado vive em `useState` sobre `lib/mock-data.ts` e se
> perde no refresh.

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
| `/analytics` | Métricas e gráficos sobre dados mockados |
| `/configuracoes` | Placeholder |
| `/dashboard` | Existe, mas a Sidebar não aponta para lá |
| `/[slug]` | Perfil público. Só `bella` e `demo` resolvem |
| `/r/[code]` | Redirect **mockado** — não leva ao destino real |

## O que ainda não existe

- **Backend, persistência, autenticação real.** Nenhum `fetch`, nenhuma
  `app/api/`, nenhum banco.
- **Cloaking no servidor.** `lib/cloak.ts` faz escape de in-app browser no
  cliente (intent URL no Android, redirect + fallback no iOS) e isso funciona.
  Mas não há `middleware.ts` e nenhuma rota serve conteúdo diferente a crawler.
  A `SafePage` é montada no `LinkModal` e descartada.
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
- `lib/mock-data.ts:172` — `Math.random()` no escopo do módulo, risco de
  hydration mismatch se `/analytics` deixar de ser client component.
