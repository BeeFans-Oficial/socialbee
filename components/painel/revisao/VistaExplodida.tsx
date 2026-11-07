"use client";

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Loader2, ShieldCheck, X } from "lucide-react";

import { COR_DO_TEXTO, ICONE_DO_ESTADO } from "@/components/painel/RevisaoDaMeta";
import type { ApiItemDaRevisao, EstadoDaRevisao } from "@/lib/api/types";
import { DURACAO, SAIDA, SUAVE } from "@/lib/movimento";
import { cn } from "@/lib/utils";

/**
 * A rodada como vista explodida, no padrão do `/breakdown` das animation
 * skills: um objeto em camadas num estúdio escuro, que se abre camada a
 * camada (a de cima sai primeiro), com uma linha-guia de cada parte até
 * uma etiqueta numerada na coluna da direita, e um giro lento de mesa.
 *
 * O objeto aqui é a página como a Meta a vê, de cima para baixo:
 *
 *   01  Identidades — o documento que cada identidade recebeu
 *   02  Destinos    — os botões e para onde levam
 *   03  Barreira 18+ — o que fica entre a Meta e os botões
 *   04  Domínio     — o endereço que serve tudo isso
 *
 * ## Imersão
 *
 * Clicar numa placa (ou na etiqueta) mergulha nela: a pilha vira de frente
 * para a câmera e avança, as camadas de cima passam pela câmera, as de
 * baixo ficam ao fundo, e a camada escolhida se abre num painel com tudo o
 * que o simulador viu ali — as cinco identidades e o que cada uma recebeu,
 * cada botão com a cadeia de saltos, a barreira e o que ela protege, o
 * domínio com os números. Setas trocam de camada sem sair; Esc volta à
 * vista explodida, que se remonta no caminho inverso.
 *
 * É CSS 3D (`perspective` + `translateZ`), sem three.js: quatro placas não
 * pedem WebGL. A linha-guia sai de `getBoundingClientRect()` de uma âncora
 * dentro da placa, que já devolve a posição projetada na tela; um `rAF`
 * acompanha a explosão e o giro.
 */

const NOME_CURTO: Record<ApiItemDaRevisao["chave"], string> = {
  consistencia: "Identidades",
  destinos: "Destinos",
  barreira: "Barreira 18+",
  dominio: "Domínio",
};

const O_QUE_A_META_FAZ: Record<ApiItemDaRevisao["chave"], string> = {
  consistencia: "No segundo em que o link entra na bio, a Meta abre a página com várias identidades ao mesmo tempo e compara o que cada uma recebeu. Documento diferente por identidade é o que ela chama de cloaking.",
  destinos: "Com um navegador de verdade, ela clica em cada botão e segue os redirecionamentos até o fim. O que decide é onde a cadeia termina, não a plataforma escolhida no ícone.",
  barreira: "Quando encontra a confirmação de idade na frente dos botões, ela não clica. Foi a única diferença entre a conta que ficou no ar e as que caíram em 15/10.",
  dominio: "Ela também abre a raiz do domínio e lembra dele: um endereço marcado derruba qualquer página que passe por ele. O tráfego de dentro do Instagram é a única pista de que isso aconteceu.",
};

const ACENTO = "#FF3C6E";
const ESPACO_FECHADO = 7;
const ESPACO_ABERTO = 54;

export function VistaExplodida({
  itens,
  host,
  slug,
  animar = true,
  onLigarBarreira,
}: {
  itens: ApiItemDaRevisao[];
  host?: string;
  slug?: string;
  animar?: boolean;
  onLigarBarreira?: () => Promise<void>;
}) {
  const [selecionada, setSelecionada] = useState<ApiItemDaRevisao["chave"]>(
    () => itens.find((i) => i.estado === "vermelho" || i.estado === "amarelo")?.chave ?? itens[0]?.chave ?? "consistencia",
  );
  const [aberta, setAberta] = useState(!animar);
  const [imersa, setImersa] = useState(false);
  const palco = useRef<HTMLDivElement>(null);
  const ancoras = useRef<(HTMLSpanElement | null)[]>([]);
  const etiquetas = useRef<(HTMLElement | null)[]>([]);
  const [guias, setGuias] = useState<{ x: number; y: number; ex: number; ey: number }[]>([]);
  const [largo, setLargo] = useState(true);

  const total = itens.length;
  const indiceSel = Math.max(0, itens.findIndex((i) => i.chave === selecionada));
  const alturaDe = (i: number, explodida: boolean) => (total - 1 - i) * (explodida ? ESPACO_ABERTO : ESPACO_FECHADO);

  useEffect(() => {
    const t = setTimeout(() => setAberta(true), animar ? 450 : 0);
    return () => clearTimeout(t);
  }, [animar]);

  useLayoutEffect(() => {
    const el = palco.current;
    if (!el) return;
    const medir = () => setLargo(el.clientWidth >= 520);
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Linhas-guia: da âncora projetada de cada placa até a etiqueta.
  useEffect(() => {
    if (!largo || imersa) return;
    let vivo = true;
    let quadro = 0;
    const medir = () => {
      const base = palco.current?.getBoundingClientRect();
      if (!base) return;
      const novas = itens.map((_, i) => {
        const a = ancoras.current[i]?.getBoundingClientRect();
        const e = etiquetas.current[i]?.getBoundingClientRect();
        if (!a || !e) return { x: 0, y: 0, ex: 0, ey: 0 };
        return { x: a.left + a.width / 2 - base.left, y: a.top + a.height / 2 - base.top, ex: e.left - base.left - 10, ey: e.top + 18 - base.top };
      });
      setGuias((antigas) =>
        antigas.length === novas.length && antigas.every((g, i) => Math.abs(g.x - novas[i].x) < 0.5 && Math.abs(g.y - novas[i].y) < 0.5 && Math.abs(g.ey - novas[i].ey) < 0.5)
          ? antigas
          : novas,
      );
    };
    const laco = () => {
      if (!vivo) return;
      medir();
      quadro = requestAnimationFrame(laco);
    };
    laco();
    return () => {
      vivo = false;
      cancelAnimationFrame(quadro);
    };
  }, [itens, largo, aberta, imersa]);

  const mergulhar = (chave: ApiItemDaRevisao["chave"]) => {
    setSelecionada(chave);
    setImersa(true);
  };
  const mover = useCallback(
    (delta: number) => {
      const proximo = itens[(indiceSel + delta + total) % total];
      if (proximo) setSelecionada(proximo.chave);
    },
    [itens, indiceSel, total],
  );

  // Teclado na imersão: setas trocam de camada, Esc sai.
  useEffect(() => {
    if (!imersa) return;
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") setImersa(false);
      else if (e.key === "ArrowRight" || e.key === "ArrowDown") mover(1);
      else if (e.key === "ArrowLeft" || e.key === "ArrowUp") mover(-1);
    };
    document.addEventListener("keydown", tecla);
    return () => document.removeEventListener("keydown", tecla);
  }, [imersa, mover]);

  const atual = itens[indiceSel] ?? itens[0];

  return (
    <div className="vista-explodida">
      <div
        ref={palco}
        className="relative overflow-hidden rounded-xl transition-[min-height] duration-500 ease-[cubic-bezier(0.2,0,0,1)]"
        style={{
          background: "radial-gradient(ellipse 80% 60% at 38% 46%, #2a2d33 0%, #16181b 55%, #0a0b0d 100%)",
          // Na imersão o palco cresce para o painel respirar; fora dela, volta.
          minHeight: imersa ? (largo ? 540 : 560) : largo ? 400 : 340,
        }}
      >
        {/* Cabeçalho em mono, como no template. */}
        <div className="absolute left-4 sm:left-5 right-12 top-4 font-mono text-[11px] tracking-[0.16em] text-[#7d828a] select-none z-10 whitespace-nowrap overflow-hidden text-ellipsis">
          <span className="text-[#e9e6e1]">{(host && slug ? `${host}/${slug}` : "PÁGINA").toUpperCase()}</span>
          {" / "}
          <AnimatePresence mode="wait" initial={false}>
            <motion.span key={imersa ? "dentro" : "fora"} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: DURACAO.rapida }}>
              {imersa ? `CAMADA ${String(indiceSel + 1).padStart(2, "0")} · ${NOME_CURTO[atual.chave].toUpperCase()}` : "VISTA EXPLODIDA"}
            </motion.span>
          </AnimatePresence>
        </div>

        {/* O palco 3D. Na imersão ele vira de frente e avança. */}
        <div
          className="absolute"
          style={{
            left: largo ? "33%" : "50%",
            top: largo ? "60%" : 180,
            transform: `translate(-50%, -50%) scale(${largo ? 1 : 0.82})`,
            perspective: 1100,
            width: 250,
            height: 170,
          }}
        >
          <motion.div
            className="absolute inset-0"
            style={{ transformStyle: "preserve-3d" }}
            initial={{ rotateX: 62, rotateZ: -34, y: 0, scale: 1 }}
            animate={
              imersa
                ? { rotateX: 0, rotateZ: 0, y: 0, scale: 1.55 }
                : { rotateX: 62, rotateZ: aberta ? [-34, -24] : -34, y: [0, -4, 0], scale: 1 }
            }
            transition={
              imersa
                ? { duration: 0.7, ease: [0.65, 0, 0.35, 1] }
                : {
                    rotateX: { duration: 0.6, ease: SUAVE },
                    scale: { duration: 0.6, ease: SUAVE },
                    rotateZ: { duration: 9, ease: "easeInOut", repeat: Infinity, repeatType: "mirror" },
                    y: { duration: 3.2, ease: "easeInOut", repeat: Infinity },
                  }
            }
          >
            {itens.map((item, i) => (
              <Placa
                key={item.chave}
                indice={i}
                item={item}
                z={imersa ? (i < indiceSel ? 560 : i === indiceSel ? 0 : -140 * (i - indiceSel)) : alturaDe(i, aberta)}
                opacidade={imersa ? (i < indiceSel ? 0 : i === indiceSel ? 0 : 0.35) : 1}
                atraso={imersa ? 0 : aberta ? i * 0.07 : 0}
                duracao={imersa ? 0.7 : 1.25}
                selecionada={item.chave === selecionada}
                onEscolher={() => mergulhar(item.chave)}
                ancora={(el) => {
                  ancoras.current[i] = el;
                }}
                host={host}
              />
            ))}
            <div
              aria-hidden
              className="absolute inset-0 rounded-[14px]"
              style={{ transform: "translateZ(-14px)", background: "radial-gradient(ellipse at 50% 50%, rgba(0,0,0,0.55), rgba(0,0,0,0) 70%)", filter: "blur(10px)" }}
            />
          </motion.div>
        </div>

        {/* Linhas-guia, só fora da imersão. */}
        {largo && (
          <motion.svg className="absolute inset-0 w-full h-full pointer-events-none" aria-hidden animate={{ opacity: imersa ? 0 : 1 }} transition={{ duration: DURACAO.rapida }}>
            {guias.map((g, i) => {
              const mx = Math.max(g.x + 36, g.ex - 70);
              return (
                <g key={itens[i].chave}>
                  <motion.polyline
                    points={`${g.x},${g.y} ${mx},${g.ey} ${g.ex},${g.ey}`}
                    fill="none"
                    stroke="#c9ccd1"
                    strokeWidth="1.5"
                    initial={{ pathLength: 0, opacity: 0 }}
                    animate={aberta ? { pathLength: 1, opacity: 0.85 } : { pathLength: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: SUAVE, delay: animar ? 1.05 + i * 0.13 : 0 }}
                  />
                  <motion.circle
                    cx={g.x}
                    cy={g.y}
                    r="4"
                    fill={ACENTO}
                    initial={{ opacity: 0, scale: 0 }}
                    animate={aberta ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0 }}
                    transition={{ duration: 0.25, ease: SUAVE, delay: animar ? 1.05 + i * 0.13 : 0 }}
                    style={{ transformOrigin: `${g.x}px ${g.y}px` }}
                  />
                </g>
              );
            })}
          </motion.svg>
        )}

        {/* Etiquetas à direita (ou abaixo, no celular). Somem na imersão. */}
        <motion.div
          className={cn("flex flex-col gap-3", largo ? "absolute right-5 top-14 w-[210px]" : "relative px-4 pt-[296px] pb-4")}
          role="tablist"
          aria-label="Camadas da revisão"
          animate={{ opacity: imersa ? 0 : 1, pointerEvents: imersa ? "none" : "auto" }}
          transition={{ duration: DURACAO.rapida }}
        >
          {itens.map((item, i) => (
            <motion.button
              key={item.chave}
              type="button"
              role="tab"
              aria-selected={item.chave === selecionada}
              onClick={() => mergulhar(item.chave)}
              ref={(el) => {
                etiquetas.current[i] = el;
              }}
              initial={{ opacity: 0, x: 18 }}
              animate={aberta ? { opacity: 1, x: 0 } : { opacity: 0, x: 18 }}
              transition={{ duration: 0.3, ease: SUAVE, delay: animar ? 1.23 + i * 0.13 : 0 }}
              className={cn(
                "text-left rounded-lg px-2.5 py-1.5 -mx-2.5 transition-colors",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-bee-pink/50",
                item.chave === selecionada ? "bg-white/[0.06]" : "hover:bg-white/[0.04]",
              )}
            >
              <span className="block font-mono text-[11px] tracking-[0.06em]" style={{ color: ACENTO }}>
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="block text-[15px] font-semibold leading-tight text-[#f3f1ed] tracking-[-0.01em]">{NOME_CURTO[item.chave]}</span>
              <span className={cn("block mt-0.5 font-mono text-[11px] leading-tight", COR_DO_TEXTO[item.estado])}>{NOTA[item.estado]}</span>
            </motion.button>
          ))}
        </motion.div>

        {/* A imersão: o painel da camada, por cima do palco. */}
        <AnimatePresence>
          {imersa && atual && (
            <motion.div
              key="imersao"
              role="dialog"
              aria-label={`Camada ${indiceSel + 1}: ${NOME_CURTO[atual.chave]}`}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1, transition: { duration: 0.4, ease: SUAVE, delay: 0.3 } }}
              exit={{ opacity: 0, scale: 0.94, transition: { duration: DURACAO.rapida, ease: SAIDA } }}
              className={cn("absolute inset-x-3 sm:inset-x-5 top-11 bottom-3 sm:bottom-4 flex flex-col rounded-xl border backdrop-blur-md overflow-hidden", COR_DA_PLACA[atual.estado].borda)}
              style={{ background: "rgba(10, 12, 15, 0.82)", boxShadow: `0 30px 80px -30px ${COR_DA_PLACA[atual.estado].sombra}` }}
            >
              <Imersao
                item={atual}
                indice={indiceSel}
                total={total}
                host={host}
                onAnterior={() => mover(-1)}
                onProxima={() => mover(1)}
                onIr={(i) => setSelecionada(itens[i].chave)}
                onSair={() => setImersa(false)}
                itens={itens}
                onLigarBarreira={atual.chave === "barreira" && atual.estado === "vermelho" ? onLigarBarreira : undefined}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Fora da imersão, o resumo da camada escolhida fica abaixo do palco. */}
      <AnimatePresence mode="wait" initial={false}>
        {!imersa && atual && (
          <motion.div
            key={atual.chave}
            role="tabpanel"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0, transition: { duration: DURACAO.base, ease: SUAVE } }}
            exit={{ opacity: 0, y: -4, transition: { duration: DURACAO.rapida, ease: SAIDA } }}
            className="mt-3 rounded-xl border border-white/[0.08] bg-bee-bg/40 px-4 py-3"
          >
            <Resumo item={atual} onLigarBarreira={atual.chave === "barreira" && atual.estado === "vermelho" ? onLigarBarreira : undefined} />
            <button type="button" onClick={() => mergulhar(atual.chave)} className="mt-2 text-xs text-bee-pink hover:text-white transition-colors">
              Entrar nesta camada →
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Uma camada. A âncora é um ponto na borda direita, de onde a linha-guia sai. */
function Placa({
  indice,
  item,
  z,
  opacidade,
  atraso,
  duracao,
  selecionada,
  onEscolher,
  ancora,
  host,
}: {
  indice: number;
  item: ApiItemDaRevisao;
  z: number;
  opacidade: number;
  atraso: number;
  duracao: number;
  selecionada: boolean;
  onEscolher: () => void;
  ancora: (el: HTMLSpanElement | null) => void;
  host?: string;
}) {
  const cor = COR_DA_PLACA[item.estado];
  return (
    <motion.button
      type="button"
      onClick={onEscolher}
      aria-label={`${indice + 1}. ${NOME_CURTO[item.chave]}: ${item.titulo}. Entrar na camada.`}
      initial={{ z: 0, opacity: 1 }}
      animate={{ z, opacity: opacidade }}
      transition={{ duration: duracao, ease: [0.65, 0, 0.35, 1], delay: atraso }}
      whileHover={{ scale: 1.02 }}
      className={cn("absolute inset-0 rounded-[14px] border text-left focus:outline-none", cor.fundo, selecionada ? "border-white/70" : cor.borda)}
      style={{
        transformStyle: "preserve-3d",
        boxShadow: selecionada ? `0 0 0 1px rgba(255,255,255,0.35), 0 18px 40px -16px ${cor.sombra}` : `0 18px 40px -18px ${cor.sombra}`,
        backdropFilter: "blur(2px)",
        pointerEvents: opacidade === 0 ? "none" : "auto",
      }}
    >
      <span className="absolute inset-0 p-3 flex flex-col justify-between" style={{ transform: "translateZ(1px)" }}>
        <span className="font-mono text-[9px] tracking-[0.14em] text-white/55 uppercase">{NOME_CURTO[item.chave]}</span>
        <Conteudo chave={item.chave} estado={item.estado} host={host} />
      </span>
      <span ref={ancora} aria-hidden className="absolute right-0 top-1/2 w-px h-px" />
    </motion.button>
  );
}

/** O desenho dentro de cada placa. */
function Conteudo({ chave, estado, host }: { chave: ApiItemDaRevisao["chave"]; estado: EstadoDaRevisao; host?: string }) {
  const tinta = COR_DA_PLACA[estado].tinta;
  if (chave === "consistencia") {
    return (
      <span className="flex items-end gap-1.5">
        {[0, 1, 2, 3, 4].map((i) => (
          <span key={i} className={cn("block w-7 h-9 rounded-[3px] border", tinta)} style={{ opacity: 0.55 + i * 0.09 }} />
        ))}
      </span>
    );
  }
  if (chave === "destinos") {
    return (
      <span className="flex flex-col gap-1.5">
        {[0, 1, 2].map((i) => (
          <span key={i} className={cn("block h-5 rounded-full border", tinta)} style={{ width: `${78 - i * 14}%`, opacity: 0.85 - i * 0.2 }} />
        ))}
      </span>
    );
  }
  if (chave === "barreira") {
    return (
      <span className="flex items-center justify-center">
        <span className={cn("inline-flex items-center justify-center w-14 h-14 rounded-full border-2 font-semibold text-sm", tinta)}>18+</span>
      </span>
    );
  }
  return <span className={cn("font-mono text-[11px] truncate px-2 py-1 rounded border self-start max-w-full", tinta)}>{host ?? "domínio"}</span>;
}

/** Dentro da camada: navegação, o veredito e tudo o que o simulador viu ali. */
function Imersao({
  item,
  itens,
  indice,
  total,
  host,
  onAnterior,
  onProxima,
  onIr,
  onSair,
  onLigarBarreira,
}: {
  item: ApiItemDaRevisao;
  itens: ApiItemDaRevisao[];
  indice: number;
  total: number;
  host?: string;
  onAnterior: () => void;
  onProxima: () => void;
  onIr: (i: number) => void;
  onSair: () => void;
  onLigarBarreira?: () => Promise<void>;
}) {
  const Icone = ICONE_DO_ESTADO[item.estado];
  return (
    <>
      {/* Barra: posição, chips das camadas, sair. */}
      <div className="flex items-center gap-2 px-3 sm:px-4 py-2.5 border-b border-white/[0.08]">
        <button type="button" onClick={onAnterior} aria-label="Camada anterior" className="w-8 h-8 rounded-md border border-white/15 text-white/70 hover:text-white hover:border-white/30 flex items-center justify-center transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <ol className="flex items-center gap-1" aria-label="Camadas">
          {itens.map((it, i) => (
            <li key={it.chave}>
              <button
                type="button"
                onClick={() => onIr(i)}
                aria-current={i === indice ? "step" : undefined}
                title={NOME_CURTO[it.chave]}
                className={cn(
                  "h-8 px-2 rounded-md font-mono text-[11px] tracking-[0.06em] border transition-colors",
                  i === indice ? "border-white/60 text-white bg-white/[0.08]" : cn("border-transparent hover:bg-white/[0.05]", COR_DO_TEXTO[it.estado]),
                )}
              >
                {String(i + 1).padStart(2, "0")}
              </button>
            </li>
          ))}
        </ol>
        <button type="button" onClick={onProxima} aria-label="Próxima camada" className="w-8 h-8 rounded-md border border-white/15 text-white/70 hover:text-white hover:border-white/30 flex items-center justify-center transition-colors">
          <ArrowRight className="w-4 h-4" />
        </button>
        <span className="ml-auto hidden sm:inline font-mono text-[10px] text-bee-dim">← → trocam · Esc sai</span>
        <button type="button" onClick={onSair} aria-label="Sair da camada" className="w-8 h-8 rounded-md border border-white/15 text-white/70 hover:text-white hover:border-white/30 flex items-center justify-center transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Corpo: troca com crossfade ao navegar. */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={item.chave}
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0, transition: { duration: DURACAO.base, ease: SUAVE } }}
            exit={{ opacity: 0, x: -12, transition: { duration: DURACAO.rapida, ease: SAIDA } }}
            className="px-3 sm:px-4 py-3 space-y-4"
          >
            <div>
              <p className="font-mono text-[11px] tracking-[0.06em]" style={{ color: ACENTO }}>
                {String(indice + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
              </p>
              <h3 className="mt-0.5 text-lg font-semibold text-[#f3f1ed] tracking-[-0.01em] flex items-center gap-2">
                {NOME_CURTO[item.chave]}
                <Icone className={cn("w-4 h-4", COR_DO_TEXTO[item.estado])} aria-hidden />
                <span className={cn("font-mono text-[11px] font-normal", COR_DO_TEXTO[item.estado])}>{NOTA[item.estado]}</span>
              </h3>
              <p className="mt-1 text-xs text-bee-muted leading-relaxed">{O_QUE_A_META_FAZ[item.chave]}</p>
            </div>

            <Bloco titulo="O que o simulador encontrou">
              <p className="text-sm text-white">{item.titulo}</p>
              <p className="mt-1 text-xs text-bee-muted leading-relaxed">{item.detalhe}</p>
              {item.acao && <AcaoDaCamada item={item} onLigarBarreira={onLigarBarreira} />}
            </Bloco>

            <Fatos item={item} host={host} />
          </motion.div>
        </AnimatePresence>
      </div>
    </>
  );
}

/** Os fatos crus de cada camada, do `dados` do item. */
function Fatos({ item, host }: { item: ApiItemDaRevisao; host?: string }) {
  const d = (item.dados ?? {}) as Record<string, unknown>;

  if (item.chave === "consistencia") {
    const identidades = (d.identidades as { nome: string; status: number; bytes: number }[] | undefined) ?? [];
    const grupos = d.grupos as string[] | undefined;
    return (
      <Bloco titulo="As identidades e o que receberam">
        {identidades.length === 0 ? (
          <p className="text-xs text-bee-muted">Nenhuma identidade conseguiu abrir a página.</p>
        ) : (
          <ul className="divide-y divide-white/[0.06]">
            {identidades.map((id) => (
              <li key={id.nome} className="flex items-center gap-3 py-1.5 text-xs">
                <span className="text-white/90 flex-1">{id.nome}</span>
                <span className={cn("font-mono", id.status >= 200 && id.status < 300 ? "text-emerald-300" : "text-red-300")}>{id.status}</span>
                <span className="font-mono text-bee-dim w-14 text-right">{(id.bytes / 1024).toFixed(0)} KB</span>
              </li>
            ))}
          </ul>
        )}
        {grupos && grupos.length > 1 && (
          <p className="mt-2 text-xs text-red-300">
            Documentos diferentes: {grupos.map((g, i) => `grupo ${i + 1} (${g})`).join(" · ")}.
          </p>
        )}
        <p className="mt-2 text-[11px] text-bee-dim">Comparação feita no documento sem scripts, comentários e nonces; tamanhos diferentes por poucos bytes são normais.</p>
      </Bloco>
    );
  }

  if (item.chave === "destinos") {
    const links = (d.links as { titulo: string; destino: string; classe: string; saltos: string[]; erro: string | null; observacao?: string | null }[] | undefined) ?? [];
    return (
      <Bloco titulo="Cada botão, até o fim da cadeia">
        {links.length === 0 ? (
          <p className="text-xs text-bee-muted">A página não tem links ativos.</p>
        ) : (
          <ul className="space-y-3">
            {links.map((l) => (
              <li key={l.titulo + l.destino}>
                <div className="flex items-center gap-2 text-sm text-white">
                  <span className="truncate">{l.titulo}</span>
                  <span className={cn("ml-auto font-mono text-[10px] px-1.5 py-0.5 rounded border", l.erro ? "border-red-400/40 text-red-300" : CLASSE_COR[l.classe] ?? "border-white/20 text-white/60")}>
                    {l.erro ? "não chega" : NOME_DA_CLASSE[l.classe] ?? l.classe}
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-1 font-mono text-[11px]">
                  <span className="px-1.5 py-0.5 rounded bg-white/[0.06] text-white/60">/r/…</span>
                  {l.saltos.map((h, i) => (
                    <React.Fragment key={h + i}>
                      <span className="text-bee-dim">→</span>
                      <span className={cn("px-1.5 py-0.5 rounded bg-white/[0.06]", i === l.saltos.length - 1 ? "text-white" : "text-white/60")}>{h}</span>
                    </React.Fragment>
                  ))}
                </div>
                {(l.erro || l.observacao) && <p className={cn("mt-1 text-[11px]", l.erro ? "text-red-300" : "text-bee-dim")}>{l.erro ?? l.observacao}</p>}
              </li>
            ))}
          </ul>
        )}
      </Bloco>
    );
  }

  if (item.chave === "barreira") {
    const ligada = d.ligada === true;
    const adultos = (d.destinosAdultos as string[] | undefined) ?? [];
    const vazaram = (d.vazaram as string[] | undefined) ?? [];
    return (
      <Bloco titulo="A barreira e o que ela protege">
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-xs">
          <dt className="text-bee-muted">Confirmação de 18+</dt>
          <dd className={ligada ? "text-emerald-300" : "text-red-300"}>{ligada ? "ligada" : "desligada"}</dd>
          <dt className="text-bee-muted">Destinos adultos</dt>
          <dd className="text-white/90">{adultos.length ? adultos.join(", ") : "nenhum"}</dd>
          <dt className="text-bee-muted">Botões no documento</dt>
          <dd className={vazaram.length ? "text-red-300" : "text-white/90"}>{vazaram.length ? vazaram.join(", ") : ligada ? "nenhum antes da confirmação" : "todos (sem barreira)"}</dd>
        </dl>
      </Bloco>
    );
  }

  const visitas = d.visitasDoInstagram as { ultimos7: number; anteriores7: number } | undefined;
  const termos = (d.termosNaHome as string[] | undefined) ?? [];
  const maior = Math.max(visitas?.ultimos7 ?? 0, visitas?.anteriores7 ?? 0, 1);
  return (
    <Bloco titulo="O endereço e o que a Meta lembra dele">
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-xs">
        <dt className="text-bee-muted">Host</dt>
        <dd className="font-mono text-white/90">{(d.host as string) ?? host ?? "—"}</dd>
        <dt className="text-bee-muted">Resposta</dt>
        <dd className={cn("font-mono", typeof d.status === "number" && d.status >= 200 && d.status < 400 ? "text-emerald-300" : "text-red-300")}>{typeof d.status === "number" ? (d.status === 0 ? "sem resposta" : d.status) : "—"}</dd>
        <dt className="text-bee-muted">No pool</dt>
        <dd className={d.dominioPausado ? "text-amber-300" : "text-white/90"}>{d.dominioPausado ? "pausado pela equipe" : "ativo"}</dd>
        <dt className="text-bee-muted">Home</dt>
        <dd className={termos.length ? "text-amber-300" : "text-white/90"}>{termos.length ? `diz "${termos.join('", "')}"` : "sem os termos de 15/10"}</dd>
      </dl>
      {visitas && (
        <div className="mt-3">
          <p className="text-[11px] text-bee-muted mb-1.5">Visitas de dentro do Instagram por este endereço</p>
          {[
            ["últimos 7 dias", visitas.ultimos7],
            ["7 anteriores", visitas.anteriores7],
          ].map(([rotulo, n]) => (
            <div key={rotulo as string} className="flex items-center gap-2 text-[11px] mb-1">
              <span className="w-24 text-bee-dim">{rotulo}</span>
              <span className="flex-1 h-2 rounded-full bg-white/[0.06] overflow-hidden">
                <motion.span className="block h-full rounded-full" style={{ background: ACENTO }} initial={{ width: 0 }} animate={{ width: `${((n as number) / maior) * 100}%` }} transition={{ duration: 0.6, ease: SUAVE, delay: 0.2 }} />
              </span>
              <span className="w-8 text-right font-mono text-white/80">{n as number}</span>
            </div>
          ))}
          {visitas.anteriores7 < 20 && <p className="mt-1 text-[11px] text-bee-dim">Ainda sem volume para medir tendência (precisa de 20 na semana anterior).</p>}
        </div>
      )}
    </Bloco>
  );
}

function Bloco({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2.5">
      <h4 className="text-[10px] font-semibold tracking-[0.14em] uppercase text-white/45 mb-1.5">{titulo}</h4>
      {children}
    </section>
  );
}

function AcaoDaCamada({ item, onLigarBarreira }: { item: ApiItemDaRevisao; onLigarBarreira?: () => Promise<void> }) {
  const [ligando, setLigando] = useState(false);
  return (
    <div className="mt-2 flex flex-wrap items-center gap-3">
      <p className={cn("text-xs", COR_DO_TEXTO[item.estado])}>{item.acao}</p>
      {onLigarBarreira && (
        <button
          type="button"
          disabled={ligando}
          onClick={async () => {
            setLigando(true);
            try {
              await onLigarBarreira();
            } finally {
              setLigando(false);
            }
          }}
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-emerald-500/15 border border-emerald-400/30 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/25 disabled:opacity-60 transition-colors"
        >
          {ligando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
          Ligar a barreira 18+
        </button>
      )}
    </div>
  );
}

/** O resumo curto abaixo do palco, fora da imersão. */
function Resumo({ item, onLigarBarreira }: { item: ApiItemDaRevisao; onLigarBarreira?: () => Promise<void> }) {
  const Icone = ICONE_DO_ESTADO[item.estado];
  return (
    <div className="space-y-1.5">
      <p className="flex items-start gap-2 text-sm text-white">
        <Icone className={cn("w-4 h-4 mt-0.5 flex-shrink-0", COR_DO_TEXTO[item.estado])} aria-hidden />
        <span>{item.titulo}</span>
      </p>
      <p className="text-xs text-bee-muted leading-relaxed">{item.detalhe}</p>
      {item.acao && <AcaoDaCamada item={item} onLigarBarreira={onLigarBarreira} />}
    </div>
  );
}

const NOTA: Record<EstadoDaRevisao, string> = { verde: "ok", amarelo: "atenção", vermelho: "corrigir", neutro: "não se aplica" };
const NOME_DA_CLASSE: Record<string, string> = { checkout_adulto: "checkout adulto", mensageiro: "mensageiro", rede_social: "rede social", plataforma: "BeeSocial", desconhecido: "site" };
const CLASSE_COR: Record<string, string> = {
  checkout_adulto: "border-red-400/40 text-red-300",
  mensageiro: "border-emerald-400/40 text-emerald-300",
  rede_social: "border-sky-400/40 text-sky-300",
  plataforma: "border-amber-400/40 text-amber-300",
  desconhecido: "border-white/20 text-white/60",
};
const COR_DA_PLACA: Record<EstadoDaRevisao, { fundo: string; borda: string; tinta: string; sombra: string }> = {
  verde: { fundo: "bg-emerald-500/[0.12]", borda: "border-emerald-400/50", tinta: "border-emerald-300/70 text-emerald-200", sombra: "rgba(52,211,153,0.45)" },
  amarelo: { fundo: "bg-amber-500/[0.12]", borda: "border-amber-400/50", tinta: "border-amber-300/70 text-amber-200", sombra: "rgba(251,191,36,0.45)" },
  vermelho: { fundo: "bg-red-500/[0.14]", borda: "border-red-400/55", tinta: "border-red-300/70 text-red-200", sombra: "rgba(248,113,113,0.5)" },
  neutro: { fundo: "bg-white/[0.06]", borda: "border-white/20", tinta: "border-white/30 text-white/60", sombra: "rgba(255,255,255,0.15)" },
};
