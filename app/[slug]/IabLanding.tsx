"use client";

import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { ArrowUpRight, ChevronsDown, MoreHorizontal } from "lucide-react";

import { CeuEstrelado } from "@/components/landing/CeuEstrelado";
import { detectIAB, urlDeSaida, type IABDetection } from "@/lib/cloak";
import { THEMES } from "@/lib/catalog";
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
 * O primeiro clique/toque ou uso de Tab/Enter/Espaço revela o botão. Para quem
 * rola, o gesto inicial acrescenta 200 px ao fim da tela e o botão aparece ao
 * chegar lá. Só uma nova ativação do botão solicita a saída; não há tentativa
 * automática. Esses gestos indicam interação, não comprovam humanidade.
 * Depois do pedido, a instrução do menu `•••` fica disponível como alternativa.
 */

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
  /** `?fora=1`: a pessoa já saiu do aplicativo e voltou para cá. Sem isto ela
   *  cairia nesta tela de novo, em laço. */
  escapou: boolean;
  /** Prévia no painel: desenha a tela sem olhar o user-agent e sem NUNCA
   *  tentar escapar, senão abrir a prévia sequestraria a aba de quem edita. */
  preview?: boolean;
}

/** Destino do escape: a própria página, pedindo o perfil completo.
 *
 *  `?fora=1` é o que diz a esta tela "já estou num navegador de verdade" — sem
 *  ele a pessoa voltaria para esta mesma tela, em laço. */
const PARAM_ESCAPE = "fora";

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
  escapou,
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

  useEffect(() => {
    if (preview) {
      // A prévia usa a apresentação de iPhone, mesmo quando a criadora edita
      // em um computador.
      setAparelho({ isIAB: true, source: "instagram", isAndroid: false, isIOS: true });
      return;
    }
    if (escapou) return;
    const d = detectIAB();
    if (d.isIAB) setAparelho(d);
  }, [preview, escapou]);

  if (!aparelho) return null;

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
      preview={preview}
    />
  );
}

/**
 * A tela em si. A interação que revela o botão não solicita navegação.
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
  preview,
}: {
  slug: string;
  displayName: string;
  bg: string;
  imagem: string;
  titulo: string;
  rotulo: string;
  plataforma: Plataforma;
  app: IABDetection["source"];
  preview: boolean;
}) {
  const [interagiu, setInteragiu] = useState(false);
  const [rolagemIniciada, setRolagemIniciada] = useState(false);
  const [progresso, setProgresso] = useState(0);
  const [mostrarInstrucao, setMostrarInstrucao] = useState(false);
  const telaRef = useRef<HTMLDivElement>(null);
  const botaoRef = useRef<HTMLButtonElement>(null);
  const focarBotao = useRef(false);
  const toque = useRef<{ x: number; y: number; scrollTop: number; rolando: boolean } | null>(null);
  // O editor mantém o botão visível e inerte para permitir avaliar o layout.
  const mostrarBotao = preview || interagiu;

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
      if (rolagemIniciada || mostrarBotao || event.ctrlKey) return;
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
        if (rolagemIniciada || mostrarBotao || distancia < 8) return;
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
    tela.addEventListener("wheel", aoRolar, { passive: false });
    tela.addEventListener("touchstart", aoIniciarToque, { passive: true });
    tela.addEventListener("touchmove", aoMoverToque, { passive: false });
    tela.addEventListener("touchend", aoTerminarToque);
    tela.addEventListener("touchcancel", aoTerminarToque);
    return () => {
      tela.removeEventListener("wheel", aoRolar);
      tela.removeEventListener("touchstart", aoIniciarToque);
      tela.removeEventListener("touchmove", aoMoverToque);
      tela.removeEventListener("touchend", aoTerminarToque);
      tela.removeEventListener("touchcancel", aoTerminarToque);
    };
  }, [mostrarBotao, preview, rolagemIniciada]);

  useEffect(() => {
    if (mostrarBotao) return;

    const revelarPeloTeclado = (event: KeyboardEvent) => {
      if (event.repeat || event.altKey || event.ctrlKey || event.metaKey) return;
      if (!["Tab", "Enter", " "].includes(event.key)) return;

      // O primeiro gesto apenas revela o botão e não ativa controles do perfil
      // que está atrás da sobreposição. O foco acompanha o botão recém-criado.
      event.preventDefault();
      event.stopPropagation();
      focarBotao.current = true;
      setInteragiu(true);
    };

    document.addEventListener("keydown", revelarPeloTeclado, true);
    return () => document.removeEventListener("keydown", revelarPeloTeclado, true);
  }, [mostrarBotao]);

  useEffect(() => {
    if (!mostrarBotao || !focarBotao.current) return;
    focarBotao.current = false;
    botaoRef.current?.focus();
  }, [mostrarBotao]);

  const abrir = () => {
    if (preview) return;
    const destino = `${window.location.origin}/${slug}?${PARAM_ESCAPE}=1`;
    // O pedido parte exclusivamente da ativação explícita do botão.
    window.location.replace(urlDeSaida(destino, plataforma, app));
    setMostrarInstrucao(true);
  };

  const acesso = (
    <>
      {mostrarBotao && (
        <button
          ref={botaoRef}
          type="button"
          onClick={abrir}
          onKeyDown={(event) => {
            if (event.repeat) event.preventDefault();
          }}
          className="w-full min-w-0 rounded-2xl bg-white px-6 py-4 text-center text-[15px] font-semibold text-black [overflow-wrap:anywhere] transition-transform active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
        >
          {rotulo}
        </button>
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

  return (
    // Acima de tudo, inclusive da barreira de idade (`z-[9999]`): a fã decide
    // onde abrir antes de qualquer outra pergunta.
    <div
      ref={telaRef}
      className="fixed inset-0 z-[10000] w-full max-w-full overflow-x-hidden overflow-y-auto overscroll-y-contain text-bee-text"
      style={{ backgroundColor: bg }}
      onClick={() => {
        if (!rolagemIniciada) setInteragiu(true);
      }}
      onScroll={(event) => {
        if (!rolagemIniciada) return;
        const tela = event.currentTarget;
        const limite = tela.scrollHeight - tela.clientHeight;
        if (limite <= 0) return;
        setProgresso(Math.max(0, Math.min(1, tela.scrollTop / limite)));
        if (Math.ceil(tela.scrollTop) >= limite) setInteragiu(true);
      }}
    >
      <div className={cn("relative h-full w-full min-w-0 flex flex-col overflow-hidden", mostrarInstrucao && !rolagemIniciada && "h-auto min-h-full")}>
        <CeuEstrelado brilho={false} />

        {/* A imagem escolhida pela criadora ocupa o topo inteiro. É o que a fã
            vê antes de qualquer texto. */}
        <div className="absolute inset-x-0 top-0 h-[55%] overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element -- a rota serve
              bytes de uma coluna do banco; `next/image` exige loader ou domínio
              configurado e não acrescentaria nada a uma imagem só. */}
          <img src={imagem} alt="" className="w-full h-full object-cover" />
          <div
            className="absolute inset-0"
            style={{ background: `linear-gradient(to bottom, transparent 30%, ${bg} 95%)` }}
          />
        </div>

        <div className="relative z-10 mx-auto flex w-full min-w-0 max-w-lg flex-1 flex-col justify-end px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-6">
          <h1 className="line-clamp-2 font-bebas text-[clamp(1.5rem,6vw,2.5rem)] leading-none uppercase tracking-wide text-white text-center [overflow-wrap:anywhere]">
            {titulo}
          </h1>
          <p className="mt-2 line-clamp-2 text-center text-sm text-white/50 [overflow-wrap:anywhere]">
            {displayName} está compartilhando os links dela com você
          </p>

          <div className="mt-6 min-h-14">
            {mostrarBotao && !rolagemIniciada ? acesso : (
              <div className="flex flex-col items-center gap-2 text-center">
                <ChevronsDown aria-hidden className="h-6 w-6 text-white/80 motion-safe:animate-bounce" />
                <p className="text-sm font-medium text-white/90">
                  {mostrarBotao ? "Seu acesso está logo abaixo" : "Role até embaixo para continuar"}
                </p>
                {!rolagemIniciada && <p className="text-xs text-white/50">Ou toque na tela para mostrar o botão</p>}
                {rolagemIniciada && (
                  <div
                    role="progressbar"
                    aria-label="Rolagem até o acesso"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(progresso * 100)}
                    className="h-1 w-24 overflow-hidden rounded-full bg-white/15"
                  >
                    <div className="h-full origin-left rounded-full bg-white" style={{ transform: `scaleX(${progresso})` }} />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
      {rolagemIniciada && (
        <div className="mx-auto flex min-h-[200px] w-full min-w-0 max-w-lg flex-col justify-center px-6 py-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          {acesso}
        </div>
      )}
    </div>
  );
}
