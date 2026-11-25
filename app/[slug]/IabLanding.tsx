"use client";

import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { motion, useReducedMotion, type Easing } from "framer-motion";
import { ArrowUpRight, ChevronUp, ChevronsDown, ChevronsUp, Lock, MoreHorizontal, Pointer } from "lucide-react";

import { CeuEstrelado } from "@/components/landing/CeuEstrelado";
import { api } from "@/lib/api/client";
import { detectIAB, urlDeSaida, type IABDetection } from "@/lib/cloak";
import { THEMES } from "@/lib/catalog";
import { MOLA, SUAVE } from "@/lib/movimento";
import { cn } from "@/lib/utils";

/**
 * Página de CHEGADA, para quem vem de dentro de um aplicativo.
 *
 * O problema que ela resolve: o navegador embutido do Instagram não tem barra
 * de endereço, não compartilha sessão com o navegador de verdade da pessoa e em
 * vários aparelhos recusa abrir esquemas de outros apps. A fã clica no link da
 * bio, cai numa janela sem saída, e o destino nunca é alcançado.
 *
 * ## É uma sobreposição, não um documento
 *
 * Esta tela NÃO é mais uma página diferente servida pelo servidor a quem se
 * apresenta como navegador embutido. O servidor entrega o MESMO HTML do perfil
 * a todo mundo — fã, robô de prévia, navegador controlado pela Meta — e é o
 * JavaScript, já no aparelho, que decide cobrir o perfil com esta tela.
 *
 * O componente renderiza NADA no servidor e no primeiro render do
 * cliente, e só aparece depois do `useEffect` — o HTML estático é idêntico com
 * ou sem ele. Quem não executa JavaScript fica no perfil comum.
 *
 * ## O escape
 *
 * No Android, `intent://` entrega a URL ao navegador PADRÃO da pessoa. No
 * iPhone, dentro do Instagram, `instagram://extbrowser/` pede ao próprio app
 * que abra no navegador externo (o Instagram ignora o `x-safari-https://`);
 * em outros apps, `x-safari-https://` abre no Safari. Ver `lib/cloak.ts`.
 *
 * ## Só a rolagem revela o botão
 *
 * Clique, toque ou tecla NÃO mostram o botão. O primeiro gesto de rolagem
 * acrescenta 200 px ao fim da tela; o botão existe enquanto a tela está no
 * fim, e some de novo se a pessoa volta para cima. Só a ativação do botão
 * solicita a saída; não há tentativa automática. Depois do pedido, a
 * instrução do menu `•••` fica disponível como alternativa.
 *
 * ## A tela ensina o gesto
 *
 * A dica do gesto vem primeiro, na metade de cima da tela, com o nome e a
 * frase logo abaixo — no rodapé, o polegar e a barra do aplicativo cobriam a
 * instrução. A dica é um dedo que desliza para cima sob três setas (no
 * mouse, um trilho com o ponto descendo), e no pé da tela aparece a alça
 * de uma folha: a borda de algo que continua abaixo. A alça não é o botão;
 * ele segue existindo só no fim da rolagem. Depois de alguns segundos sem
 * toque, a alça dá um empurrão para cima e volta, demonstrando o gesto. Com
 * "reduzir movimento" ligado no sistema, nada disso se mexe.
 *
 * ## Nada do perfil antes da chegada
 *
 * Entre o HTML chegar e o React hidratar, o perfil com os botões ficava
 * visível por alguns segundos. A rota emite um script inline (o mesmo para
 * todo mundo) que esconde o perfil até esta tela assumir; ver
 * `ESTILO_DE_ESPERA`. Quem não executa JavaScript não roda o script e vê o
 * perfil — o HTML continua idêntico.
 */

/** O `<style>` que o script inline da rota injeta no `<head>` antes da
 *  hidratação, para o perfil não aparecer antes desta tela. Removido quando a
 *  tela sai. */
export const ESTILO_DE_ESPERA = "aguardando-chegada";
/** Evento disparado na `window` quando esta tela sai da frente do perfil. O
 *  `ProfileClient` espera por ele para contar a visita: com a chegada por
 *  cima, os links ainda não foram vistos. */
export const EVENTO_CHEGADA_FECHADA = "chegada:fechada";
export const SCRIPT_DE_ESPERA = `(function(){var s=document.createElement("style");s.id="${ESTILO_DE_ESPERA}";s.textContent="[data-perfil]{visibility:hidden}";document.head.appendChild(s)})()`;

/** Imagem de marca usada quando a criadora não escolheu uma imagem de chegada. */
const IMAGEM_PADRAO = "/chegada-padrao.svg";

export interface IabLandingProps {
  slug: string;
  displayName: string;
  themeId: string;
  /** Rota da imagem escolhida pela criadora. Nula, entra a padrão da
   *  plataforma — a página de chegada sem imagem nenhuma é um retângulo de cor
   *  com um botão, e é justamente a tela em que a fã decide se confia. */
  imageUrl: string | null;
  /** Título. Vazio cai no nome de exibição. */
  headline: string | null;
  buttonLabel: string | null;
  /** Prévia no painel: desenha a tela sem olhar o user-agent e sem NUNCA
   *  tentar escapar, senão abrir a prévia sequestraria a aba de quem edita. */
  preview?: boolean;
}

type Plataforma = "android" | "ios" | "other";

function plataformaDe(d: IABDetection): Plataforma {
  return d.isAndroid ? "android" : d.isIOS ? "ios" : "other";
}

export function IabLanding({
  slug,
  displayName,
  themeId,
  imageUrl,
  headline,
  buttonLabel,
  preview = false,
}: IabLandingProps) {
  const theme = THEMES.find((t) => t.id === themeId) ?? THEMES[0];

  /**
   * Decidido no aparelho, depois da hidratação.
   *
   * `null` enquanto não se sabe — é o estado do servidor e do primeiro render
   * do cliente, e nele o componente não desenha nada. Só assim o HTML que o
   * servidor manda é o mesmo para todo mundo.
   */
  const [aparelho, setAparelho] = useState<IABDetection | null>(null);
  /** Num navegador comum, o botão fecha esta tela aqui mesmo: a URL não muda e
   *  o perfil, que já estava no documento, só deixa de estar coberto. */
  const [fechada, setFechada] = useState(false);

  useEffect(() => {
    if (preview) {
      // A prévia usa a apresentação de iPhone, mesmo quando a criadora edita
      // em um computador.
      setAparelho({ isIAB: true, source: "instagram", isAndroid: false, isIOS: true });
      return;
    }
    const d = detectIAB();
    // POR ENQUANTO, a chegada aparece para TODO MUNDO, e não só dentro de um
    // navegador embutido: decisão de produto de 03/11/2026, para a fã sempre
    // passar pela tela de rolagem antes dos botões. A detecção continua sendo
    // feita, porque é ela que escolhe o esquema de saída (intent://,
    // extbrowser) quando a pessoa ESTÁ num app; num navegador comum o botão
    // só segue para a página. Para voltar a mostrar só em app, troque por:
    //   if (d.isIAB) setAparelho(d);
    setAparelho(d);
  }, [preview]);

  // O perfil volta a aparecer só quando a chegada sai de cena.
  useEffect(() => {
    if (fechada) {
      document.getElementById(ESTILO_DE_ESPERA)?.remove();
      window.dispatchEvent(new Event(EVENTO_CHEGADA_FECHADA));
    }
    return () => document.getElementById(ESTILO_DE_ESPERA)?.remove();
  }, [fechada]);

  if (!aparelho || fechada) return null;

  return (
    <Tela
      slug={slug}
      displayName={displayName}
      bg={theme.bg}
      imagem={imageUrl ?? IMAGEM_PADRAO}
      titulo={headline?.trim() || displayName}
      rotulo={buttonLabel?.trim() || `Continuar para ${displayName}`}
      plataforma={plataformaDe(aparelho)}
      app={aparelho.source}
      dentroDeApp={aparelho.isIAB}
      preview={preview}
      onFechar={() => setFechada(true)}
    />
  );
}

/**
 * A tela em si. Chegar ao fim da rolagem revela o botão; só o botão navega.
 */
function Tela({
  slug,
  displayName,
  bg,
  imagem,
  titulo,
  rotulo,
  plataforma,
  app,
  dentroDeApp,
  preview,
  onFechar,
}: {
  slug: string;
  displayName: string;
  bg: string;
  imagem: string;
  titulo: string;
  rotulo: string;
  plataforma: Plataforma;
  app: IABDetection["source"];
  /** Navegador embutido de um app? Decide se o botão tenta sair do app ou
   *  só segue para a página. */
  dentroDeApp: boolean;
  preview: boolean;
  /** Fecha a tela sem navegar (navegador comum). */
  onFechar: () => void;
}) {
  /** A tela está no fim da rolagem. Não trava: subir de volta esconde o botão. */
  const [noFim, setNoFim] = useState(false);
  const [rolagemIniciada, setRolagemIniciada] = useState(false);
  const [progresso, setProgresso] = useState(0);
  const [mostrarInstrucao, setMostrarInstrucao] = useState(false);
  const telaRef = useRef<HTMLDivElement>(null);
  const toque = useRef<{ x: number; y: number; scrollTop: number; rolando: boolean } | null>(null);
  /** Passe que o navegador de fora troca por "já passei pela chegada". Pedido
   *  ANTES do toque, para o botão navegar no mesmo gesto, sem esperar rede. */
  const passe = useRef<string | null>(null);
  // O editor mantém o botão visível e inerte para permitir avaliar o layout.
  const mostrarBotao = preview || noFim;
  const semMovimento = useReducedMotion() ?? false;
  /** Tela de toque? Decide o texto e o sentido da dica: o dedo SOBE, a roda
   *  do mouse desce. Decidido no aparelho, como todo o resto desta tela. */
  const [porToque, setPorToque] = useState(true);
  useEffect(() => {
    setPorToque(window.matchMedia("(pointer: coarse)").matches);
  }, []);

  // A página rola sem barra visível, como no celular — inclusive dentro da
  // moldura de iPhone das prévias do painel.
  useEffect(() => {
    const raiz = document.documentElement;
    raiz.classList.add("sem-barra");
    return () => raiz.classList.remove("sem-barra");
  }, []);

  useEffect(() => {
    const tela = telaRef.current;
    if (!tela || preview) return;

    const iniciarRolagem = () => {
      // A altura só aumenta em resposta ao gesto. O primeiro deslocamento já
      // precisa encontrar o espaço novo, inclusive no WebView do celular.
      flushSync(() => setRolagemIniciada(true));
    };

    const aoRolar = (event: WheelEvent) => {
      if (rolagemIniciada || event.ctrlKey) return;
      if (event.deltaY <= 0 || Math.abs(event.deltaX) > event.deltaY) return;
      event.preventDefault();
      iniciarRolagem();
      const unidade = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? tela.clientHeight : 1;
      tela.scrollTop += event.deltaY * unidade;
    };

    const aoIniciarToque = (event: TouchEvent) => {
      const ponto = event.touches.length === 1 ? event.touches[0] : null;
      toque.current = ponto ? { x: ponto.clientX, y: ponto.clientY, scrollTop: tela.scrollTop, rolando: false } : null;
    };

    const aoMoverToque = (event: TouchEvent) => {
      const inicio = toque.current;
      if (!inicio || event.touches.length !== 1) return;
      const distancia = inicio.y - event.touches[0].clientY;
      if (!inicio.rolando) {
        if (rolagemIniciada || distancia < 8) return;
        if (Math.abs(inicio.x - event.touches[0].clientX) > distancia) return;
        inicio.rolando = true;
        iniciarRolagem();
      }
      // Neste primeiro gesto a tela ainda não era rolável no touchstart.
      // Acompanha o dedo até ele soltar; os próximos gestos usam o scroll nativo.
      if (event.cancelable) event.preventDefault();
      tela.scrollTop = inicio.scrollTop + distancia;
    };

    const aoTerminarToque = () => { toque.current = null; };

    // Teclado rola como o dedo: a primeira tecla de rolagem abre o espaço e o
    // navegador faz o resto. Nenhuma tecla mostra o botão por si.
    const aoTeclar = (event: KeyboardEvent) => {
      if (rolagemIniciada || event.altKey || event.ctrlKey || event.metaKey) return;
      if (!["ArrowDown", "PageDown", "End", " "].includes(event.key)) return;
      iniciarRolagem();
    };

    tela.focus({ preventScroll: true });
    tela.addEventListener("keydown", aoTeclar);
    tela.addEventListener("wheel", aoRolar, { passive: false });
    tela.addEventListener("touchstart", aoIniciarToque, { passive: true });
    tela.addEventListener("touchmove", aoMoverToque, { passive: false });
    tela.addEventListener("touchend", aoTerminarToque);
    tela.addEventListener("touchcancel", aoTerminarToque);
    return () => {
      tela.removeEventListener("keydown", aoTeclar);
      tela.removeEventListener("wheel", aoRolar);
      tela.removeEventListener("touchstart", aoIniciarToque);
      tela.removeEventListener("touchmove", aoMoverToque);
      tela.removeEventListener("touchend", aoTerminarToque);
      tela.removeEventListener("touchcancel", aoTerminarToque);
    };
  }, [preview, rolagemIniciada]);

  // Dentro de um app, a rolagem pede o passe ao servidor e o renova enquanto
  // a tela fica aberta (ele vale 10 minutos). Se o pedido falhar, o botão
  // abre o endereço limpo e a pessoa só vê esta tela de novo lá fora.
  useEffect(() => {
    if (preview || !dentroDeApp || !rolagemIniciada) return;
    let ativo = true;
    const pedir = async () => {
      try {
        const resposta = await fetch(`/${encodeURIComponent(slug)}/p`, { method: "POST" });
        if (!resposta.ok) return;
        const corpo = (await resposta.json()) as { passe?: string | null };
        if (ativo && corpo.passe) passe.current = corpo.passe;
      } catch {
        // Fica com o passe anterior, se houver.
      }
    };
    void pedir();
    const renovacao = setInterval(pedir, 4 * 60 * 1000);
    return () => {
      ativo = false;
      clearInterval(renovacao);
    };
  }, [preview, dentroDeApp, rolagemIniciada, slug]);

  const abrir = () => {
    if (preview) return;
    // Etapa do funil: tocou no botão. Igual dentro e fora de app; `keepalive`
    // na chamada deixa o registro terminar mesmo com a saída do aplicativo.
    api.recordView(slug, "continue");
    // Num navegador comum não há de onde sair: o botão só tira esta tela da
    // frente. Nada de navegação nem de parâmetro na URL — o perfil já está
    // no documento, igual para todo mundo.
    if (!dentroDeApp) {
      onFechar();
      return;
    }
    // Dentro de um app, o pedido parte exclusivamente da ativação explícita
    // do botão. O navegador de fora abre a rota que troca o passe por um
    // cookie e cai no endereço limpo da página, já sem esta tela — a pessoa
    // não repete a rolagem. Ver `lib/passe-chegada.ts`.
    const pagina = `${window.location.origin}/${slug}`;
    const destino = passe.current ? `${pagina}/p/${passe.current}` : pagina;
    window.location.replace(urlDeSaida(destino, plataforma, app));
    setMostrarInstrucao(true);
  };

  const acesso = (
    <>
      {mostrarBotao && (
        <motion.button
          type="button"
          // No fim da rolagem o botão CHEGA (sobe e firma), em vez de piscar
          // na tela. Na prévia do editor ele já está lá, parado.
          initial={preview || semMovimento ? false : { opacity: 0, y: 18, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={MOLA}
          onClick={abrir}
          onKeyDown={(event) => {
            if (event.repeat) event.preventDefault();
          }}
          className="w-full min-w-0 rounded-2xl bg-white px-6 py-5 text-center text-[17px] font-semibold text-black shadow-[0_0_0_6px_rgba(255,255,255,0.08),0_14px_44px_rgba(255,255,255,0.2)] [overflow-wrap:anywhere] transition-transform active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
        >
          {rotulo}
        </motion.button>
      )}
      {mostrarInstrucao && (
        <div className="mt-6 rounded-2xl border border-white/10 bg-black/30 p-4">
          <p className="text-center text-xs text-white/40 mb-3">Não abriu? Faça assim:</p>
          <ol className="space-y-2 text-[13px] text-white/60">
            <li className="flex flex-wrap items-center gap-2">
              <span className="text-white/25">1</span>
              Toque em <MoreHorizontal className="w-4 h-4 text-white/80" /> no canto da tela
            </li>
            <li className="flex flex-wrap items-center gap-2">
              <span className="text-white/25">2</span>
              Escolha
              <span className="text-white/80 inline-flex items-center gap-1">
                “Abrir no navegador” <ArrowUpRight className="w-3.5 h-3.5" />
              </span>
            </li>
          </ol>
        </div>
      )}
    </>
  );

  // Entrada em cascata: foto, título, frase e dica, 70 ms entre cada.
  const entrada = (ordem: number) =>
    semMovimento || preview
      ? {}
      : {
          initial: { opacity: 0, y: 12 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.32, ease: SUAVE, delay: 0.07 * ordem },
        };

  return (
    // Acima de tudo, inclusive da barreira de idade (`z-[9999]`): a fã decide
    // onde abrir antes de qualquer outra pergunta.
    <div
      ref={telaRef}
      // Focável para o teclado rolar; sem anel de foco, porque não é um controle.
      tabIndex={-1}
      className="fixed inset-0 z-[10000] w-full max-w-full overflow-x-hidden overflow-y-auto overscroll-y-contain text-bee-text outline-none"
      style={{ backgroundColor: bg }}
      onScroll={(event) => {
        if (!rolagemIniciada) return;
        const tela = event.currentTarget;
        const limite = tela.scrollHeight - tela.clientHeight;
        if (limite <= 0) return;
        setProgresso(Math.max(0, Math.min(1, tela.scrollTop / limite)));
        // Vale nos dois sentidos: no fim o botão existe, acima dele não.
        setNoFim(Math.ceil(tela.scrollTop) >= limite);
      }}
    >
      <div className={cn("relative h-full w-full min-w-0 flex flex-col overflow-hidden", mostrarInstrucao && !rolagemIniciada && "h-auto min-h-full")}>
        <CeuEstrelado brilho={false} />

        {/* A imagem escolhida pela criadora ocupa o topo. É o que a fã vê
            antes de qualquer texto. */}
        <motion.div {...entrada(0)} className="absolute inset-x-0 top-0 h-[64%] overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element -- a rota serve
              bytes de uma coluna do banco; `next/image` exige loader ou domínio
              configurado e não acrescentaria nada a uma imagem só. */}
          <img src={imagem} alt="" className="w-full h-full object-cover" />
          <div
            className="absolute inset-0"
            // Escurece cedo: a dica do gesto fica sobre a metade de baixo da
            // foto e precisa de contraste mesmo com imagem clara.
            style={{ background: `linear-gradient(to bottom, transparent 25%, ${bg} 88%)` }}
          />
        </motion.div>

        {/* A foto desce até quase dois terços da tela e o bloco fica no
            centro, sobre a parte de baixo dela. */}
        <div
          className="relative z-10 mx-auto flex w-full min-w-0 max-w-lg flex-1 flex-col px-6"
          // Conforme a folha sobe, o que está atrás recua: no fim da rolagem
          // o botão é o protagonista e nada disputa com ele.
          style={{ opacity: rolagemIniciada ? 1 - progresso : 1 }}
        >
          {/* A dica do gesto vem PRIMEIRO, acima do nome: é o que a pessoa
              precisa notar antes de qualquer outra coisa. O nome e a frase
              ficam logo abaixo, como legenda. */}
          {/* O espaço livre é repartido 5 para 2: a dica cai no centro da
              tela, sobre a parte de baixo da foto, e sobra pouco vazio entre
              a frase e a folha. */}
          <div aria-hidden className="min-h-[40px] flex-[5]" />
          <motion.div {...entrada(1)} className="min-h-14">
            {preview ? acesso : <DicaDeRolagem porToque={porToque} semMovimento={semMovimento} />}
          </motion.div>
          <motion.h1
            {...entrada(2)}
            className="mt-8 line-clamp-2 font-bebas text-[clamp(1.5rem,6vw,2.25rem)] leading-none uppercase tracking-wide text-white text-center [overflow-wrap:anywhere]"
          >
            {titulo}
          </motion.h1>
          <motion.p
            {...entrada(3)}
            className="mt-2 line-clamp-2 text-center text-sm text-white/55 [overflow-wrap:anywhere]"
          >
            {displayName} está compartilhando os links dela com você
          </motion.p>
          <div aria-hidden className="min-h-[20px] flex-[2]" />
        </div>

        {/* A alça da folha: a borda do que continua abaixo. Decoração — não é
            o botão e não recebe toque. Parada depois que a rolagem começa. */}
        <motion.div
          aria-hidden
          className="pointer-events-none relative z-10 mx-auto w-full max-w-lg flex-none px-3"
          animate={!preview && !semMovimento && !rolagemIniciada ? { y: [0, -10, 0] } : { y: 0 }}
          transition={
            !preview && !semMovimento && !rolagemIniciada
              ? { duration: 0.9, ease: "easeInOut", delay: 3, repeat: Infinity, repeatDelay: 5 }
              : { duration: 0.2 }
          }
        >
          {/* A folha aparece mais (e diz o que guarda): ocupa o pé da tela em
              vez de deixá-lo vazio. O rótulo não é o botão. */}
          <div className="flex h-[104px] flex-col items-center rounded-t-3xl border border-b-0 border-white/10 bg-white/[0.06] [@media(max-height:640px)]:h-[76px]">
            <div className="mt-2.5 h-1 w-10 flex-none rounded-full bg-white/30" />
            {/* No fim da rolagem o botão fala por si; o rótulo sai. */}
            <div
              className="flex flex-1 items-center gap-2 text-sm font-medium text-white/60 transition-opacity duration-200"
              style={{ opacity: noFim ? 0 : 1 }}
            >
              <Lock className="h-4 w-4" />
              Seu acesso está aqui embaixo
            </div>
          </div>
        </motion.div>
      </div>
      {rolagemIniciada && (
        // Continuação da folha: mesmo fundo e mesmas bordas da alça. Ela sobe
        // até perto do meio da tela e o botão chega NO CENTRO dela — grande,
        // sozinho, com o resto esmaecido atrás. Enquanto a rolagem não
        // termina, o lugar dele mostra quanto falta.
        <div className="mx-auto w-full max-w-lg px-3">
          <div className="flex min-h-[max(240px,36vh)] w-full min-w-0 flex-col justify-center border-x border-white/10 bg-white/[0.06] px-5 py-8 pb-[max(2rem,env(safe-area-inset-bottom))]">
            {noFim ? (
              <>
                <motion.p
                  initial={semMovimento ? false : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.22, ease: SUAVE }}
                  className="mb-4 text-center text-sm font-medium text-white/70"
                >
                  Seu acesso está pronto
                </motion.p>
                {acesso}
              </>
            ) : (
              <div className="flex flex-col items-center gap-3 text-center">
                <p className="text-sm font-medium text-white/70">Continue deslizando</p>
                <div
                  role="progressbar"
                  aria-label="Rolagem até o acesso"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(progresso * 100)}
                  className="h-1.5 w-32 overflow-hidden rounded-full bg-white/15"
                >
                  <div className="h-full origin-left rounded-full bg-white" style={{ transform: `scaleX(${progresso})` }} />
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * A dica do gesto: no toque, um dedo que encosta, desliza para cima e solta
 * (`DedoDeslizando`); no mouse, um trilho com o ponto descendo como a roda
 * (`RodaDoMouse`), e o texto abaixo. É o ÚNICO laço de animação da tela.
 *
 * O bloco inteiro esmaece conforme a pessoa rola (quem cuida é a `Tela`): a
 * dica cumpriu o papel, e o progresso passa a ser mostrado na folha.
 */
function DicaDeRolagem({ porToque, semMovimento }: { porToque: boolean; semMovimento: boolean }) {
  return (
    <div className="relative flex flex-col items-center gap-3 text-center">
      {/* Mancha escura atrás da dica: contraste sobre foto clara, invisível
          sobre o fundo escuro. */}
      <div aria-hidden className="absolute left-1/2 top-1/2 -z-10 h-56 w-56 -translate-x-1/2 -translate-y-1/2 rounded-full bg-black/55 blur-2xl" />
      <div aria-hidden className="drop-shadow-[0_1px_6px_rgba(0,0,0,0.8)]">
        {porToque ? <DedoDeslizando semMovimento={semMovimento} /> : <RodaDoMouse semMovimento={semMovimento} />}
      </div>
      <p className="text-xl font-semibold text-white [text-shadow:0_1px_12px_rgba(0,0,0,0.7)]">
        {porToque ? "Deslize para cima" : "Role para baixo"}
      </p>
    </div>
  );
}

/**
 * Um dedo fazendo o gesto que a tela pede: encosta (encolhe um pouco, como
 * quem pressiona), desliza para cima deixando um rastro, solta e some. Acima
 * dele, três setas acendem em sequência no sentido do gesto. O
 * ciclo tem uma pausa no fim — sem ela o olho não separa um gesto do outro.
 *
 * Com "reduzir movimento": o dedo parado sob uma seta para cima.
 */
function DedoDeslizando({ semMovimento }: { semMovimento: boolean }) {
  if (semMovimento) {
    return (
      <div className="flex h-32 w-20 flex-col items-center justify-center gap-1">
        <ChevronsUp className="h-7 w-7 text-white/90" />
        <Pointer className="h-11 w-11 text-white" fill="rgba(255,255,255,0.14)" strokeWidth={1.75} />
      </div>
    );
  }

  // Aparece e encosta (0–18%), desliza (18–60%), solta e some (60–74%),
  // descansa. O dedo fica na tela em três quartos do ciclo.
  const ciclo = { duration: 2.2, times: [0, 0.18, 0.6, 0.74, 1], repeat: Infinity };
  // Uma curva POR TRECHO, pelo nome. Com quadros-chave, uma lista de quatro
  // números (um cubic-bezier, como `SUAVE`) é lida como uma curva por trecho
  // e o dedo sumia no meio do caminho.
  const CURVAS_DO_GESTO: Easing[] = ["easeOut", "easeInOut", "easeIn", "linear"];
  return (
    <div className="relative h-32 w-20">
      {/* Setas indicando o sentido: acendem uma a uma, de baixo para cima,
          enquanto o dedo sobe — a de cima por último, apontando o destino. */}
      <div className="absolute inset-x-0 top-0 flex flex-col-reverse items-center -space-y-2 space-y-reverse">
        {[0, 1, 2].map((ordem) => (
          <motion.span
            key={ordem}
            className="block"
            animate={{ opacity: [0.3, 0.3, 1, 0.3, 0.3] }}
            transition={{
              duration: ciclo.duration,
              times: [0, 0.2 + ordem * 0.12, 0.32 + ordem * 0.12, 0.56 + ordem * 0.12, 1],
              ease: "easeInOut",
              repeat: Infinity,
            }}
          >
            <ChevronUp className="h-6 w-6 text-white" strokeWidth={2.5} />
          </motion.span>
        ))}
      </div>
      {/* O rastro: cresce de baixo para cima atrás do dedo e apaga com ele. */}
      <motion.span
        className="absolute left-1/2 top-14 h-12 w-1 -translate-x-1/2 origin-bottom rounded-full bg-gradient-to-t from-white/0 to-white/60"
        animate={{ scaleY: [0, 0, 1, 1, 1], opacity: [0, 0.7, 0.7, 0, 0] }}
        transition={{ ...ciclo, ease: CURVAS_DO_GESTO }}
      />
      <motion.span
        // O ícone tem a ponta do indicador um pouco à esquerda do centro:
        // o deslocamento alinha a PONTA ao eixo das setas, não a caixa.
        className="absolute left-1/2 top-[62px] -ml-[18px] block"
        animate={{ y: [30, 26, -6, -6, -6], scale: [1, 0.9, 0.9, 1, 1], opacity: [0, 1, 1, 0, 0] }}
        transition={{ ...ciclo, ease: CURVAS_DO_GESTO }}
      >
        <Pointer className="h-11 w-11 text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.5)]" fill="rgba(255,255,255,0.14)" strokeWidth={1.75} />
      </motion.span>
    </div>
  );
}

/** Para quem usa mouse: o trilho com o ponto descendo, como a roda. */
function RodaDoMouse({ semMovimento }: { semMovimento: boolean }) {
  return (
    <div className="flex h-14 w-8 items-center justify-center rounded-full border border-white/30">
      {semMovimento ? (
        <ChevronsDown className="h-5 w-5 text-white/90" />
      ) : (
        <motion.span
          className="block h-2 w-2 rounded-full bg-white"
          animate={{ y: [-12, 12, 12, 12], opacity: [0, 1, 0, 0] }}
          transition={{ duration: 1.8, times: [0, 0.4, 0.52, 1], ease: ["easeOut", "easeIn", "linear"], repeat: Infinity }}
        />
      )}
    </div>
  );
}
