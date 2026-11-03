"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChevronLeft, X } from "lucide-react";

import { useSession } from "@/lib/api/use-session";
import { DURACAO, MOLA, SAIDA, SUAVE } from "@/lib/movimento";
import { cn } from "@/lib/utils";
import { ROTEIROS, roteiroDaRota, type Passo, type Roteiro } from "./roteiros";

/**
 * Tour guiado: um holofote sobre um elemento da tela e um balão explicando.
 *
 * O motor é nosso, e não uma biblioteca, por um motivo só: ritmo. O tour usa
 * os mesmos tokens de `lib/movimento.ts` que o resto do painel — o recorte do
 * holofote DESLIZA de um alvo ao próximo (continuidade espacial), o balão
 * nasce do lado do alvo, a saída é mais rápida que a entrada. Uma biblioteca
 * traria a própria animação e a própria cara.
 *
 * Como funciona:
 *   - Cada tela tem um roteiro (`roteiros.ts`); os alvos são elementos com
 *     `data-tour="..."`. O roteiro começa sozinho na primeira visita à tela
 *     e pode ser revisto pelo menu da conta ("Ver o guia desta tela").
 *   - O alvo é procurado por até 4 s (a tela pode estar carregando); se não
 *     aparece, o passo é pulado. Alvo encontrado é rolado para o centro e
 *     medido de novo a cada scroll e resize, então o holofote acompanha.
 *   - O escurecimento são quatro retângulos com desfoque em volta do recorte
 *     (um `mask` em SVG não anima nem desfoca de forma confiável em todo
 *     navegador). O recorte em si não captura cliques: o alvo continua
 *     clicável durante o passo, para a pessoa poder fazer a ação na hora.
 *   - Regras de UX: Pular sempre visível, Esc sai, Voltar existe, setas do
 *     teclado navegam, o botão Próximo recebe o foco, o passo é anunciado por
 *     `aria-live`. Pulado ou concluído, o roteiro não volta a aparecer
 *     sozinho (guardado por conta, no `localStorage`).
 */

/** Folga entre o alvo e a borda do recorte, em px. */
const FOLGA = 8;
const LARGURA_DO_BALAO = 300;
/** Quanto esperar pelo alvo enquanto a tela ainda carrega (há esqueleto na
 *  tela) e quando já carregou — aí o alvo simplesmente não existe neste
 *  contexto (sem foto de capa, sem links) e o passo é pulado logo. */
const ESPERA_CARREGANDO_MS = 4000;
const ESPERA_PRONTA_MS = 600;
/** Abaixo disto o balão vira folha na base da tela. */
const LARGURA_DE_CELULAR = 640;

interface Contexto {
  /** Começa o roteiro da rota atual (ou o de `id`). */
  iniciar: (id?: string) => void;
  ativo: boolean;
  /** O roteiro que existe para a rota atual, se houver. */
  roteiroDaTela: Roteiro | null;
}

const TourContext = createContext<Contexto>({ iniciar: () => undefined, ativo: false, roteiroDaTela: null });

export function useTour(): Contexto {
  return useContext(TourContext);
}

function chave(userId: string): string {
  return `bee.tour:${userId}`;
}

function vistos(userId: string): Record<string, true> {
  try {
    return JSON.parse(localStorage.getItem(chave(userId)) ?? "{}") as Record<string, true>;
  } catch {
    return {};
  }
}

function marcarVisto(userId: string, roteiroId: string): void {
  try {
    const v = vistos(userId);
    v[roteiroId] = true;
    localStorage.setItem(chave(userId), JSON.stringify(v));
  } catch {
    // Sem localStorage (modo privado estrito), o tour só volta a aparecer.
  }
}

function ehCelular(): boolean {
  return typeof window !== "undefined" && window.innerWidth < 1024;
}

/** O alvo de um passo está na tela agora? */
function alvoExiste(alvo: string): boolean {
  const el = document.querySelector<HTMLElement>(`[data-tour="${alvo}"]`);
  return el !== null && el.getClientRects().length > 0;
}

/** O passo cabe na tela agora: o alvo existe e, se ele é de reserva para o
 *  estado vazio (`exigeAusente`), o outro alvo não está lá. */
function passoDisponivel(p: Passo): boolean {
  return alvoExiste(p.alvo) && (!p.exigeAusente || !alvoExiste(p.exigeAusente));
}

/**
 * A tela ainda mostra esqueleto? Aí um alvo ausente pode só não ter chegado.
 *
 * Procura o marcador dos NOSSOS esqueletos (`data-esqueleto`), e não qualquer
 * `role="status"` da página: extensão do navegador que injete um aviso de
 * "Carregando" faria o tour esperar 4 s por passo achando que a tela não
 * carregou — e "Próximo" pareceria não fazer nada.
 */
function telaCarregando(): boolean {
  return document.querySelector("[data-esqueleto]") !== null;
}

/**
 * O próximo índice com alvo na tela, a partir de `de`, na direção `delta`.
 * Com a tela carregada, passo sem alvo é pulado na hora (página sem links não
 * tem alça de arrastar, por exemplo); carregando, confia na ordem e deixa a
 * busca com espera do passo decidir. Devolve -1 antes do início e
 * `passos.length` depois do fim.
 */
function proximoComAlvo(passos: Passo[], de: number, delta: 1 | -1): number {
  let i = de;
  if (!telaCarregando()) {
    while (i >= 0 && i < passos.length && !passoDisponivel(passos[i])) i += delta;
  }
  return i;
}

interface Andamento {
  roteiro: Roteiro;
  passos: Passo[];
  indice: number;
}

export function TourProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { session } = useSession();
  const userId = session?.user.id ?? null;
  const [andamento, setAndamento] = useState<Andamento | null>(null);

  const iniciar = useCallback(
    (id?: string) => {
      const roteiro = id ? (ROTEIROS.find((r) => r.id === id) ?? null) : roteiroDaRota(pathname);
      if (!roteiro) return;
      const celular = ehCelular();
      const passos = roteiro.passos.filter((p) => !p.so || (p.so === "celular") === celular);
      if (passos.length === 0) return;
      setAndamento({ roteiro, passos, indice: 0 });
    },
    [pathname],
  );

  const encerrar = useCallback(() => {
    setAndamento((atual) => {
      if (atual && userId) marcarVisto(userId, atual.roteiro.id);
      return null;
    });
  }, [userId]);

  const ir = useCallback(
    (delta: 1 | -1) => {
      setAndamento((atual) => {
        if (!atual) return null;
        const proximo = proximoComAlvo(atual.passos, atual.indice + delta, delta);
        if (proximo < 0) return atual;
        if (proximo >= atual.passos.length) {
          if (userId) marcarVisto(userId, atual.roteiro.id);
          return null;
        }
        return { ...atual, indice: proximo };
      });
    },
    [userId],
  );

  // Primeira visita a uma tela com roteiro: começa sozinho, depois que a tela
  // entrou e os dados chegaram (o alvo ainda é procurado por 4 s).
  useEffect(() => {
    setAndamento(null);
    if (!userId) return;
    const roteiro = roteiroDaRota(pathname);
    if (!roteiro || vistos(userId)[roteiro.id]) return;
    const timer = setTimeout(() => iniciar(roteiro.id), 900);
    return () => clearTimeout(timer);
  }, [pathname, userId, iniciar]);

  return (
    <TourContext.Provider value={{ iniciar, ativo: andamento !== null, roteiroDaTela: roteiroDaRota(pathname) }}>
      {children}
      <AnimatePresence>
        {andamento && (
          <TourAtivo
            key={andamento.roteiro.id}
            passos={andamento.passos}
            indice={andamento.indice}
            onProximo={() => ir(1)}
            onVoltar={() => ir(-1)}
            onSair={encerrar}
          />
        )}
      </AnimatePresence>
    </TourContext.Provider>
  );
}

// ── O tour em andamento ───────────────────────────────────────────────────────

interface Caixa {
  x: number;
  y: number;
  w: number;
  h: number;
}

function TourAtivo({
  passos,
  indice,
  onProximo,
  onVoltar,
  onSair,
}: {
  passos: Passo[];
  indice: number;
  onProximo: () => void;
  onVoltar: () => void;
  onSair: () => void;
}) {
  const passo = passos[indice];
  const reduzido = useReducedMotion();
  /** O alvo medido, junto do passo a que pertence: o balão só aparece quando
   *  os dois batem — enquanto o próximo alvo é procurado, o recorte antigo
   *  fica na tela sem balão, em vez de mostrar o texto novo no lugar errado. */
  const [alvo, setAlvo] = useState<{ indice: number; caixa: Caixa } | null>(null);
  const [janela, setJanela] = useState({ w: 0, h: 0 });
  const proximoRef = useRef<HTMLButtonElement>(null);

  useLayoutEffect(() => {
    const medir = () => setJanela({ w: window.innerWidth, h: window.innerHeight });
    medir();
    window.addEventListener("resize", medir);
    return () => window.removeEventListener("resize", medir);
  }, []);

  // Procura o alvo do passo, rola até ele e o acompanha.
  useEffect(() => {
    let cancelado = false;
    let limpar: (() => void) | null = null;
    let raf = 0;
    const inicio = Date.now();

    const procurar = () => {
      if (cancelado) return;
      const el = document.querySelector<HTMLElement>(`[data-tour="${passo.alvo}"]`);
      // Passo de reserva com o alvo "cheio" presente: não é deste contexto.
      if (passo.exigeAusente && alvoExiste(passo.exigeAusente) && !telaCarregando()) {
        onProximo();
        return;
      }
      if (el && el.getClientRects().length > 0) {
        el.scrollIntoView({ block: "center", inline: "nearest", behavior: reduzido ? "auto" : "smooth" });
        const medir = () => {
          if (cancelado) return;
          const r = el.getBoundingClientRect();
          setAlvo({ indice, caixa: { x: r.left, y: r.top, w: r.width, h: r.height } });
        };
        // Depois que a rolagem assenta; enquanto rola, o `scroll` abaixo já
        // vai medindo, então o holofote acompanha o movimento.
        const timer = setTimeout(medir, reduzido ? 0 : 320);
        const ro = new ResizeObserver(medir);
        ro.observe(el);
        window.addEventListener("scroll", medir, true);
        window.addEventListener("resize", medir);
        limpar = () => {
          clearTimeout(timer);
          ro.disconnect();
          window.removeEventListener("scroll", medir, true);
          window.removeEventListener("resize", medir);
        };
        return;
      }
      if (Date.now() - inicio > (telaCarregando() ? ESPERA_CARREGANDO_MS : ESPERA_PRONTA_MS)) {
        // O alvo não existe nesta tela agora (sem foto de capa, por exemplo).
        onProximo();
        return;
      }
      raf = requestAnimationFrame(procurar);
    };
    procurar();

    return () => {
      cancelado = true;
      cancelAnimationFrame(raf);
      limpar?.();
    };
    // `onProximo` é estável o bastante; reagir a ele reiniciaria a busca.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [passo, indice, reduzido]);

  // Teclado: setas navegam, Esc sai. Foco vai para "Próximo" a cada passo.
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") onSair();
      else if (e.key === "ArrowRight") onProximo();
      else if (e.key === "ArrowLeft") onVoltar();
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [onSair, onProximo, onVoltar]);

  const medido = alvo && alvo.indice === indice ? alvo.caixa : null;
  const caixaAtual = alvo?.caixa ?? null;

  useEffect(() => {
    if (medido) proximoRef.current?.focus({ preventScroll: true });
  }, [medido, indice]);

  /** O recorte segue a última caixa medida (deste passo ou do anterior), para
   *  deslizar até o alvo novo; o balão só nasce com a caixa DESTE passo. */
  const recorte: Caixa | null = caixaAtual
    ? { x: caixaAtual.x - FOLGA, y: caixaAtual.y - FOLGA, w: caixaAtual.w + FOLGA * 2, h: caixaAtual.h + FOLGA * 2 }
    : null;
  const recorteDoPasso: Caixa | null = medido
    ? { x: medido.x - FOLGA, y: medido.y - FOLGA, w: medido.w + FOLGA * 2, h: medido.h + FOLGA * 2 }
    : null;
  /**
   * Os passos que EXISTEM nesta tela, agora: numa página sem links o tour de
   * Links é um passo só, e sem cliques o de Analytics não tem a seção de
   * origem. Os pontinhos e o "Entendi" seguem esta lista, não o roteiro
   * inteiro — senão o balão prometia cinco passos e fechava no primeiro.
   * Enquanto a tela carrega, a lista é o roteiro todo (os alvos ainda vêm).
   */
  const alcancaveis = telaCarregando() ? passos : passos.filter(passoDisponivel);
  const posicao = Math.max(0, alcancaveis.indexOf(passo));
  const total = Math.max(1, alcancaveis.length);
  const ultimo = posicao >= total - 1;
  const celular = janela.w > 0 && janela.w < LARGURA_DE_CELULAR;

  return (
    <motion.div
      // `pointer-events-none` na raiz: o que captura clique são os quatro
      // retângulos escuros e o balão. O recorte fica livre, e o alvo
      // continua clicável durante o passo.
      className="fixed inset-0 z-[80] pointer-events-none"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, transition: { duration: DURACAO.base, ease: SUAVE } }}
      exit={{ opacity: 0, transition: { duration: DURACAO.rapida, ease: SAIDA } }}
      aria-hidden={false}
    >
      {/* Anúncio para leitor de tela, fora do balão para não repetir o título. */}
      <span className="sr-only" aria-live="polite">
        Passo {posicao + 1} de {total}: {passo.titulo}
      </span>

      <Holofote recorte={recorte} janela={janela} />

      <AnimatePresence mode="wait">
        {recorteDoPasso && (
          <Balao
            key={indice}
            passo={passo}
            indice={posicao}
            total={total}
            recorte={recorteDoPasso}
            janela={janela}
            celular={celular}
            ultimo={ultimo}
            proximoRef={proximoRef}
            onProximo={onProximo}
            onVoltar={onVoltar}
            onSair={onSair}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/**
 * Quatro retângulos escuros e desfocados em volta do recorte, e um aro no
 * recorte. Animados pela mola: quando o passo muda, o buraco desliza até o
 * alvo novo em vez de sumir e reaparecer.
 */
function Holofote({ recorte, janela }: { recorte: Caixa | null; janela: { w: number; h: number } }) {
  // Sem alvo medido ainda, escurece tudo (recorte de tamanho zero no centro).
  const r = recorte ?? { x: janela.w / 2, y: janela.h / 2, w: 0, h: 0 };
  const pedacos = [
    { left: 0, top: 0, width: janela.w, height: Math.max(0, r.y) },
    { left: 0, top: r.y + r.h, width: janela.w, height: Math.max(0, janela.h - (r.y + r.h)) },
    { left: 0, top: r.y, width: Math.max(0, r.x), height: r.h },
    { left: r.x + r.w, top: r.y, width: Math.max(0, janela.w - (r.x + r.w)), height: r.h },
  ];
  return (
    <>
      {pedacos.map((p, i) => (
        <motion.div
          key={i}
          className="fixed bg-black/60 backdrop-blur-[3px] pointer-events-auto"
          initial={false}
          animate={p}
          transition={MOLA}
        />
      ))}
      <motion.div
        className="fixed rounded-xl border-2 border-white/90 shadow-[0_0_0_4px_rgba(255,60,110,0.3)] pointer-events-none"
        initial={false}
        animate={{ left: r.x, top: r.y, width: r.w, height: r.h, opacity: recorte ? 1 : 0 }}
        transition={MOLA}
      />
    </>
  );
}

function Balao({
  passo,
  indice,
  total,
  recorte,
  janela,
  celular,
  ultimo,
  proximoRef,
  onProximo,
  onVoltar,
  onSair,
}: {
  passo: Passo;
  indice: number;
  total: number;
  recorte: Caixa;
  janela: { w: number; h: number };
  celular: boolean;
  ultimo: boolean;
  proximoRef: React.RefObject<HTMLButtonElement | null>;
  onProximo: () => void;
  onVoltar: () => void;
  onSair: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [altura, setAltura] = useState(160);
  useLayoutEffect(() => {
    if (ref.current) setAltura(ref.current.offsetHeight);
  }, [passo]);

  /**
   * Posição: embaixo do alvo se couber; senão em cima; senão ao lado (direita,
   * depois esquerda) — é o caso da barra lateral, alta demais para sobrar
   * espaço acima ou abaixo. Sempre dentro da janela. No celular, folha na
   * base da tela.
   */
  const margem = 12;
  const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), Math.max(min, max));
  const cabeEmbaixo = recorte.y + recorte.h + margem + altura <= janela.h - margem;
  const cabeEmCima = recorte.y - margem - altura >= margem;
  const cabeADireita = recorte.x + recorte.w + margem + LARGURA_DO_BALAO <= janela.w - margem;
  const cabeAEsquerda = recorte.x - margem - LARGURA_DO_BALAO >= margem;
  const lado: "embaixo" | "emcima" | "direita" | "esquerda" = cabeEmbaixo
    ? "embaixo"
    : cabeEmCima
      ? "emcima"
      : cabeADireita
        ? "direita"
        : cabeAEsquerda
          ? "esquerda"
          : "embaixo";
  const vertical = lado === "embaixo" || lado === "emcima";
  const left = vertical
    ? clamp(recorte.x, margem, janela.w - LARGURA_DO_BALAO - margem)
    : lado === "direita"
      ? recorte.x + recorte.w + margem
      : recorte.x - margem - LARGURA_DO_BALAO;
  const top = vertical
    ? clamp(
        lado === "emcima" ? recorte.y - margem - altura : recorte.y + recorte.h + margem,
        margem,
        janela.h - altura - margem,
      )
    : clamp(recorte.y + recorte.h / 2 - altura / 2, margem, janela.h - altura - margem);
  // A seta aponta para o centro do alvo, dentro dos limites do balão.
  const setaX = clamp(recorte.x + recorte.w / 2 - left, 16, LARGURA_DO_BALAO - 28);
  const setaY = clamp(recorte.y + recorte.h / 2 - top, 16, altura - 28);
  const origem =
    lado === "embaixo" ? `${setaX}px top` : lado === "emcima" ? `${setaX}px bottom` : lado === "direita" ? `left ${setaY}px` : `right ${setaY}px`;
  const deslocamentoInicial = lado === "embaixo" ? { y: -6 } : lado === "emcima" ? { y: 6 } : lado === "direita" ? { x: -6 } : { x: 6 };

  const estilo: React.CSSProperties = celular
    ? { left: margem, right: margem, bottom: `calc(4rem + env(safe-area-inset-bottom) + ${margem}px)` }
    : { left, top, width: LARGURA_DO_BALAO };

  return (
    <motion.div
      ref={ref}
      role="dialog"
      aria-labelledby={`tour-titulo-${indice}`}
      className="fixed z-[81] rounded-2xl border border-white/10 bg-bee-surface p-4 text-white shadow-[0_16px_48px_rgba(0,0,0,0.6)] pointer-events-auto"
      style={{ ...estilo, transformOrigin: celular ? "bottom center" : origem }}
      initial={{ opacity: 0, scale: 0.96, ...(celular ? { y: 12 } : deslocamentoInicial) }}
      animate={{ opacity: 1, scale: 1, x: 0, y: 0, transition: { duration: DURACAO.base, ease: SUAVE, delay: 0.06 } }}
      exit={{ opacity: 0, scale: 0.98, transition: { duration: DURACAO.rapida, ease: SAIDA } }}
    >
      {!celular && (
        <span
          aria-hidden
          className={cn(
            "absolute w-3 h-3 rotate-45 bg-bee-surface border-white/10",
            lado === "embaixo" && "-top-1.5 border-l border-t",
            lado === "emcima" && "-bottom-1.5 border-r border-b",
            lado === "direita" && "-left-1.5 border-l border-b",
            lado === "esquerda" && "-right-1.5 border-r border-t",
          )}
          style={vertical ? { left: setaX - 6 } : { top: setaY - 6 }}
        />
      )}

      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h2 id={`tour-titulo-${indice}`} className="text-sm font-semibold leading-snug">
            {passo.titulo}
          </h2>
          <p className="mt-1 text-[13px] leading-relaxed text-white/70">{passo.texto}</p>
        </div>
        <button
          onClick={onSair}
          aria-label="Pular o guia"
          title="Pular o guia"
          className="-mt-1 -mr-1 w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-lg text-white/50 hover:text-white hover:bg-white/[0.06] transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <div className="flex items-center gap-1.5 mr-auto" aria-hidden>
          {Array.from({ length: total }, (_, i) => (
            <span key={i} className="relative w-1.5 h-1.5 rounded-full bg-white/20">
              {i === indice && (
                <motion.span
                  layoutId="tour-ponto-ativo"
                  transition={MOLA}
                  className="absolute inset-0 rounded-full bg-bee-pink"
                />
              )}
            </span>
          ))}
        </div>
        {indice > 0 && (
          <button
            onClick={onVoltar}
            className="inline-flex items-center gap-1 h-9 px-2.5 rounded-lg text-xs font-medium text-white/70 hover:text-white hover:bg-white/[0.06] transition-colors"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            Voltar
          </button>
        )}
        <button
          ref={proximoRef}
          onClick={onProximo}
          className="h-9 px-4 rounded-lg bg-white text-bee-bg text-xs font-semibold hover:bg-white/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bee-pink focus-visible:ring-offset-2 focus-visible:ring-offset-bee-surface"
        >
          {ultimo ? "Entendi" : "Próximo"}
        </button>
      </div>
    </motion.div>
  );
}
