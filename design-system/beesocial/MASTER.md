# Design System — BeeSocial (painel)

> **Como usar:** ao mexer numa tela, procure primeiro `design-system/beesocial/pages/<tela>.md`.
> Se existir, as regras de lá valem por cima destas. Se não, siga este arquivo.
>
> Gerado com a skill `ui-ux-pro-max` em 02/11/2026 e **ajustado à marca**: a skill sugeriu
> uma paleta clara (azul + roxo) e um padrão de landing page; nenhum dos dois é o produto.
> O que ficou dela são as regras de navegação, toque, contraste e a checklist do fim.

---

**Projeto:** BeeSocial — link na bio para criadoras de conteúdo adulto
**Superfície:** o painel (`app/(painel)`), não a página pública da criadora nem a tela inicial
**Stack:** Next.js 16 (App Router) · React 19 · Tailwind 3.4 · Radix (dialog, switch) · lucide-react
**Modo:** só escuro. Não existe tema claro, e não há plano para um.

---

## Cores

Os tokens vivem em `tailwind.config.ts` (`colors.bee.*`) e são os únicos que uma tela pode usar.
Hex cru em componente é dívida: cada `#0d1119` solto foi uma tela com a sua própria cor.

| Papel | Token | Valor | Onde |
| --- | --- | --- | --- |
| Fundo da aplicação | `bg-bee-bg` | `#0d0d0d` | `body`, conteúdo das listas |
| Casca (barras lateral, inferior e do topo) | `bg-bee-rail` | `#0a0a0a` | um tom abaixo do fundo: o conteúdo fica "sobre" elas |
| Superfície | `bg-bee-surface` | `#151515` | cartões, menus, diálogos |
| Superfície elevada | `bg-bee-surface2` | `#1e1e1e` | campos, chips |
| Painel dos editores | `bg-bee-panel` | `#0d1119` | coluna de configurações de página e link |
| Painel elevado | `bg-bee-panel2` | `#161b26` | balões e menus que abrem sobre o painel |
| Fio | `border-bee-line` | `rgba(255,255,255,0.06)` | toda divisória e borda neutra |
| Marca / ação primária | `bee-pink` | `#FF3C6E` | botão principal, item ativo, foco |
| Marca em hover | `bee-pink-hot` | `#FF1F57` | hover do botão principal |
| Texto | `text-white` | `#FFFFFF` | títulos e valores |
| Texto secundário | `text-bee-muted` | `#888888` | descrições, rótulos de apoio (4,6:1 sobre `bee-bg`) |
| Texto apagado | `text-bee-dim` | `#555555` | **só decorativo**: não passa de 3:1, nunca em texto que precisa ser lido |
| Destrutivo | `red-500` | — | apagar, remover; sempre atrás de confirmação |
| Sucesso / aviso | `emerald-400` / `amber-300` | — | pontos de status ("no ar", "aguardando") |

Opacidades de branco (`text-white/60`, `bg-white/[0.04]`) são aceitas para estados de hover e
hierarquia dentro de um mesmo componente. Abaixo de `white/55` em texto corrido, não.

## Tipografia

- **Fonte do painel:** Poppins (`font-sans`), carregada em `app/layout.tsx`. Inter, Barlow e Bebas
  ficam carregadas porque são opções da **página pública**, não do painel.
- **Escala:** 11 (selos e rótulos de seção, sempre em caixa alta com `tracking-[0.14em]`),
  12/13 (apoio), 14 (corpo do painel), 15 (linhas dos editores), 16 (campos no celular, evita o
  zoom do iOS), 20 (título de seção), 24/28 (título de tela: `text-2xl lg:text-[28px]`).
- **Título de tela** sempre pelo `CabecalhoDeTela`, em caixa normal. Caixa alta em título era o
  visual da Aparência antiga e saiu com ela.
- Números tabulares (`tabular-nums`) em qualquer coluna de contagem.

## Espaçamento e largura

- Ritmo de 4px. Dentro de componente: 8/12/16. Entre blocos: 24/32.
- **Moldura de tela** (`Tela`): `px-4 sm:px-6 lg:px-8 py-6 lg:py-8`, largura `max-w-6xl` (grades,
  relatório) ou `max-w-3xl` (`largura="estreita"`: listas de linhas e formulários). Não há terceira.
- Raio: `rounded-lg` (8px) em botões e campos, `rounded-xl` (12px) em cartões pequenos,
  `rounded-2xl` (16px) em cartões grandes e folhas.

## A casca do painel

Uma só, para listas **e** editores (`components/painel/Shell.tsx`).

| Largura | Navegação principal | Barra do topo |
| --- | --- | --- |
| ≥ 1024px | barra lateral fixa de 240px; nos editores vira trilho de 72px com ícone + rótulo curto | título da tela · seletor de página · plano · menu da conta |
| < 1024px | barra inferior fixa com Páginas, Links, Analytics e Mais (folha com domínio, conta, ver página, sair) | símbolo · seletor de página · plano |

Regras que vieram da skill e valem sempre:

- Item de navegação tem **ícone e texto**, inclusive no trilho (`curto` em `ITENS`).
- A navegação **não some em subfluxo**: os editores ficam dentro da casca.
- **Sair** fica longe da navegação (menu da conta, folha "Mais", Configurações), nunca ao lado de "Links".
- O item ativo se marca por cor **e** fundo, não só por cor.
- Conteúdo reserva a altura das barras fixas (`pb-[calc(4rem+env(safe-area-inset-bottom))]` no `main`).
- Alturas de tela com `dvh`, nunca `vh`.
- Um `Toaster` só, no layout do grupo.

## Editores (página e link)

- Computador: prévia à esquerda (`PreviaDoEditor`), painel de 380px à direita (`CLASSE_DO_PAINEL`),
  os dois grudados abaixo da barra do topo e rolando por dentro.
- Celular: só o painel, em largura total; a prévia abre por cima pelo botão flutuante "Prévia".
  Os filhos da prévia montam uma vez — o `<iframe>` não recarrega ao abrir e fechar.
- Cabeçalho do painel (voltar + nome + indicador de salvando) é `sticky` no celular.
- Cada ajuste salva sozinho; não existe botão "Salvar" para esquecer.

## Movimento

Personalidade **corporativa** da skill de motion design: a animação explica o que mudou e sai
da frente. Os tokens vivem em `lib/movimento.ts` e são os únicos que uma tela pode usar.

| Token | Valor | Uso |
| --- | --- | --- |
| `SUAVE` | cubic-bezier(0.2, 0, 0, 1) | toda entrada e troca de estado (desacelera ao chegar) |
| `SAIDA` | cubic-bezier(0.3, 0, 1, 1) | toda saída (acelera ao ir embora), com ~70% da duração da entrada |
| `DURACAO.rapida` | 150 ms | toque, saída de menu |
| `DURACAO.base` | 220 ms | menu, balão, troca de estado |
| `DURACAO.lenta` | 320 ms | cartão ou seção chegando |
| `DURACAO.pagina` | 300 ms | conteúdo de uma tela nova |
| `MOLA` | spring 380/32 | indicador de item ativo, folhas |

Padrões prontos (variants): `ENTRADA_DA_TELA`, `SURGIR` (menus crescem de 96% a partir do botão
que os abriu), `SURGIR_DE_BAIXO`, `LISTA` + `ITEM_DA_LISTA` (escada de 45 ms, sobe 14 px),
`CARTAO_DA_GRADE`, `CROSSFADE`. Diálogos e folhas, que o Radix controla por `data-state`, usam
os keyframes do `tailwind.config.ts` (`dialogo-entrar` 300 ms de 95%, `folha-entrar` 320 ms).

Regras:

- Só `transform` e `opacity`. Barra que cresce é `scaleX` com `origin-left`, nunca `width`.
- Uma ou duas coisas animadas por tela. Lista em escada conta como uma.
- Esqueleto no lugar de spinner, com a forma do conteúdo, e só depois de 120 ms (`.esqueleto`).
- Número de métrica conta até o valor (`NumeroAnimado`, 0,8 s); gráfico se desenha (900 ms).
- Todo botão encolhe 3% ao toque (regra global em `globals.css`, propriedade `scale`);
  `data-sem-toque` desliga em fundos invisíveis.
- Menu some mais rápido do que aparece; diálogo que fecha mantém o conteúdo até o fim do fade
  (`useUltimo`).
- `prefers-reduced-motion`: o `MotionConfig` da casca troca transformações por fade e o CSS
  desliga keyframes e brilho. Nada depende de `animationend` para ficar certo.

## Tour guiado

Motor próprio em `components/painel/tour/Tour.tsx`; conteúdo em `roteiros.ts`, um roteiro por
tela, de três a sete passos. Alvos são elementos com `data-tour="..."`.

- Holofote: quatro retângulos escuros (60%) e desfocados (3px) em volta do recorte, com 8px de
  folga e aro branco. O recorte **desliza** até o alvo seguinte (`MOLA`); o balão nasce do lado
  do alvo (embaixo, em cima, à direita ou à esquerda, nessa ordem, o primeiro que couber) e vira
  folha na base da tela abaixo de 640px.
- O alvo continua clicável durante o passo. Pular sempre visível, Esc sai, setas navegam, o
  botão Próximo recebe o foco, o passo é anunciado por `aria-live`.
- Começa sozinho na primeira visita à tela, depois que ela carregou. Alvo que não existe no
  contexto (sem foto de capa, sem links) é pulado. Visto ou pulado, não volta sozinho; "Ver o guia
  desta tela" no menu da conta e na folha "Mais" reabre.
- Texto: uma ideia por passo, até duas linhas, dizendo o que a pessoa ganha, não o nome do botão.

## Componentes

- Botão primário: `h-10 px-4 rounded-lg bg-bee-pink hover:bg-bee-pink-hot text-white text-sm font-semibold`.
- Botão secundário: `h-10 px-4 rounded-lg border border-white/15 text-white/80 hover:text-white hover:border-white/30`.
- Botão de ícone: 40×40 no celular, 36×36 a partir de `sm`; sempre com `aria-label` e `title`.
- Exclusão simples: `ConfirmarExclusao`. Exclusão que leva muita coisa junto: digitar o endereço (`ApagarPagina`).
- Ícones: **só lucide-react**, 16px no corpo, 20px na navegação. Emoji nunca é ícone no painel
  (`IconeDePlataforma` substitui o `getPlatformIcon` antigo).
- Foco de teclado: `focus-visible:ring-2 focus-visible:ring-bee-pink`.
- Transições de 150–300ms; respeitar `prefers-reduced-motion` em qualquer animação que não seja
  um fade.

## Anti-padrões

- ❌ Cor crua (`#...`, `rgba(...)`) em componente — crie o token.
- ❌ Título em caixa alta; selos e rótulos de seção podem.
- ❌ `window.confirm` / `alert`.
- ❌ Hover que desloca layout (`scale`, `translate` em cartão).
- ❌ Texto abaixo de 12px, ou `bee-dim` em texto lido.
- ❌ Dois seletores da mesma coisa em lugares diferentes (foi o caso do seletor de página).
- ❌ Coluna fixa em px para conteúdo de lista (`w-16` para "cliques" quebra no celular).

## Checklist antes de entregar uma tela

- [ ] Renderiza em 375, 768, 1024 e 1440 sem rolagem horizontal
- [ ] Nada escondido atrás da barra do topo ou da barra inferior
- [ ] Alvos de toque ≥ 40px no celular; ícone sozinho tem `aria-label`
- [ ] Texto lido ≥ 4,5:1 sobre o fundo em que está
- [ ] Foco visível em tudo que é clicável; `Esc` fecha menus e folhas
- [ ] Nenhum emoji como ícone; nenhum hex fora do `tailwind.config.ts`
- [ ] Estado de carregamento reserva o espaço (esqueleto), não "pisca vazio"
- [ ] Ação destrutiva pede confirmação e fica longe da navegação
