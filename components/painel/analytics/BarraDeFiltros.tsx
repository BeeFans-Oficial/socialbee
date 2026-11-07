"use client";

import React, { useEffect, useId, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown, SlidersHorizontal, X } from "lucide-react";

import { DURACAO, MOLA, SAIDA, SUAVE, SURGIR, TOQUE } from "@/lib/movimento";
import { cn } from "@/lib/utils";

/**
 * A barra de filtros do Analytics.
 *
 * Controles de painel, não formulário: período como controle segmentado com
 * o destaque deslizando (`layoutId`), cada recorte como um botão-chip que
 * abre uma lista própria, e os filtros ativos repetidos numa linha de chips
 * removíveis — a pessoa vê o recorte inteiro de uma vez e tira um sem abrir
 * nada. Nada de `<select>` nativo: cada navegador desenha um, o desabilitado
 * vira cinza morto, e nenhum deles responde ao tema.
 *
 * Movimento no arquétipo do painel (`lib/movimento.ts`): curva padrão, 150 a
 * 220 ms, entrada mais longa que saída, nada de pulo. Quem pede menos
 * movimento no sistema recebe só fade (`MotionConfig` da casca).
 */

export type Periodo = "7d" | "30d" | "90d" | "custom";

export interface OpcaoDeFiltro {
  valor: string;
  nome: string;
}

export interface DefinicaoDeFiltro {
  chave: string;
  rotulo: string;
  valor: string;
  opcoes: OpcaoDeFiltro[];
  /** Texto do chip ativo e da lista de ativos; cai no nome da opção. */
  nomeDoValor?: string;
}

export function BarraDeFiltros({
  periodo,
  de,
  ate,
  minimo,
  maximo,
  filtros,
  carregando,
  aviso,
  onPeriodo,
  onDatas,
  onFiltro,
  onLimpar,
}: {
  periodo: Periodo;
  de: string;
  ate: string;
  minimo: string;
  maximo: string;
  filtros: DefinicaoDeFiltro[];
  carregando?: boolean;
  /** Uma linha curta, por exemplo "visitas não têm link". */
  aviso?: string | null;
  onPeriodo: (p: Periodo) => void;
  onDatas: (de: string, ate: string) => void;
  onFiltro: (chave: string, valor: string) => void;
  onLimpar: () => void;
}) {
  const ativos = filtros.filter((f) => f.valor);
  const haRecorte = ativos.length > 0 || periodo === "custom";

  return (
    <section
      data-tour="filtros"
      aria-label="Filtros do relatório"
      className={cn("rounded-2xl border border-bee-line bg-bee-surface p-3 sm:p-4 transition-opacity", carregando && "opacity-80")}
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <SeletorDePeriodo periodo={periodo} onPeriodo={onPeriodo} />
        <AnimatePresence initial={false}>
          {periodo === "custom" && (
            <motion.div
              key="datas"
              variants={SURGIR}
              initial="initial"
              animate="animate"
              exit="exit"
              className="flex items-center gap-2"
            >
              <CampoDeData valor={de} minimo={minimo} maximo={ate || maximo} rotulo="Data inicial" onChange={(v) => onDatas(v, ate)} />
              <span className="text-xs text-bee-muted">até</span>
              <CampoDeData valor={ate} minimo={de || minimo} maximo={maximo} rotulo="Data final" onChange={(v) => onDatas(de, v)} />
            </motion.div>
          )}
        </AnimatePresence>

        <div className="hidden sm:block h-6 w-px bg-bee-line" aria-hidden />

        <div className="flex flex-wrap items-center gap-2">
          {filtros.map((f) => (
            <MenuDeFiltro key={f.chave} filtro={f} onEscolher={(v) => onFiltro(f.chave, v)} />
          ))}
        </div>
      </div>

      <AnimatePresence initial={false}>
        {haRecorte && (
          <motion.div
            key="ativos"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto", transition: { duration: DURACAO.base, ease: SUAVE } }}
            exit={{ opacity: 0, height: 0, transition: { duration: DURACAO.rapida, ease: SAIDA } }}
            className="overflow-hidden"
          >
            <div className="mt-3 pt-3 border-t border-bee-line flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-bee-dim mr-1">
                <SlidersHorizontal className="w-3 h-3" />
                Recorte
              </span>
              <AnimatePresence initial={false}>
                {periodo === "custom" && de && ate && (
                  <ChipAtivo key="periodo" rotulo="Período" valor={`${curta(de)} a ${curta(ate)}`} onRemover={() => onPeriodo("30d")} />
                )}
                {ativos.map((f) => (
                  <ChipAtivo
                    key={f.chave}
                    rotulo={f.rotulo}
                    valor={f.nomeDoValor ?? f.opcoes.find((o) => o.valor === f.valor)?.nome ?? f.valor}
                    onRemover={() => onFiltro(f.chave, "")}
                  />
                ))}
              </AnimatePresence>
              {aviso && <span className="text-xs text-bee-muted">{aviso}</span>}
              <button
                type="button"
                onClick={onLimpar}
                className="ml-auto inline-flex items-center gap-1 h-8 px-2.5 rounded-md text-xs text-bee-muted hover:text-white hover:bg-white/[0.05] transition-colors"
              >
                <X className="w-3.5 h-3.5" />
                Limpar tudo
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

const PERIODOS: { valor: Periodo; nome: string }[] = [
  { valor: "7d", nome: "7 dias" },
  { valor: "30d", nome: "30 dias" },
  { valor: "90d", nome: "90 dias" },
  { valor: "custom", nome: "Datas" },
];

/** Controle segmentado: o destaque rosa desliza entre as opções. */
function SeletorDePeriodo({ periodo, onPeriodo }: { periodo: Periodo; onPeriodo: (p: Periodo) => void }) {
  const id = useId();
  return (
    <div role="radiogroup" aria-label="Período" className="inline-flex items-center p-1 rounded-lg bg-bee-bg border border-bee-line">
      {PERIODOS.map((p) => {
        const ativo = p.valor === periodo;
        return (
          <button
            key={p.valor}
            type="button"
            role="radio"
            aria-checked={ativo}
            onClick={() => onPeriodo(p.valor)}
            className={cn(
              "relative h-8 px-3 rounded-md text-xs font-medium transition-colors",
              ativo ? "text-white" : "text-bee-muted hover:text-white",
            )}
          >
            {ativo && (
              <motion.span
                layoutId={`periodo-${id}`}
                className="absolute inset-0 rounded-md bg-bee-pink"
                transition={MOLA}
                aria-hidden
              />
            )}
            <span className="relative">{p.nome}</span>
          </button>
        );
      })}
    </div>
  );
}

function CampoDeData({
  valor,
  minimo,
  maximo,
  rotulo,
  onChange,
}: {
  valor: string;
  minimo: string;
  maximo: string;
  rotulo: string;
  onChange: (v: string) => void;
}) {
  return (
    <input
      type="date"
      value={valor}
      min={minimo}
      max={maximo}
      aria-label={rotulo}
      onChange={(e) => onChange(e.target.value)}
      className="h-9 px-2.5 rounded-lg bg-bee-bg border border-bee-line text-xs text-white focus:outline-none focus:border-bee-pink focus:ring-2 focus:ring-bee-pink/15 [color-scheme:dark]"
    />
  );
}

/**
 * Um recorte: botão-chip que abre a lista. Teclado: setas movem, Enter
 * escolhe, Escape fecha; clique fora fecha. Sem opções na janela, o chip
 * continua legível, só diz que não há o que escolher.
 */
function MenuDeFiltro({ filtro, onEscolher }: { filtro: DefinicaoDeFiltro; onEscolher: (valor: string) => void }) {
  const [aberto, setAberto] = useState(false);
  const [foco, setFoco] = useState(0);
  const raiz = useRef<HTMLDivElement>(null);
  const id = useId();

  // O valor escolhido pode não estar nas opções da janela atual (veio da
  // URL, ou a janela mudou): continua listado para a pessoa ver e tirar.
  const opcoes =
    filtro.valor && !filtro.opcoes.some((o) => o.valor === filtro.valor)
      ? [{ valor: filtro.valor, nome: filtro.nomeDoValor ?? filtro.valor }, ...filtro.opcoes]
      : filtro.opcoes;
  const lista: OpcaoDeFiltro[] = [{ valor: "", nome: "Todos" }, ...opcoes];
  const vazio = filtro.opcoes.length === 0 && !filtro.valor;
  const ativo = Boolean(filtro.valor);
  const nomeAtual = ativo ? (filtro.nomeDoValor ?? opcoes.find((o) => o.valor === filtro.valor)?.nome ?? filtro.valor) : "Todos";

  useEffect(() => {
    if (!aberto) return;
    setFoco(Math.max(0, lista.findIndex((o) => o.valor === filtro.valor)));
    const fora = (e: MouseEvent) => {
      if (raiz.current && !raiz.current.contains(e.target as Node)) setAberto(false);
    };
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAberto(false);
    };
    document.addEventListener("mousedown", fora);
    document.addEventListener("keydown", tecla);
    return () => {
      document.removeEventListener("mousedown", fora);
      document.removeEventListener("keydown", tecla);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto]);

  const escolher = (valor: string) => {
    onEscolher(valor);
    setAberto(false);
  };

  const noTeclado = (e: React.KeyboardEvent) => {
    if (!aberto && (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      setAberto(true);
      return;
    }
    if (!aberto) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setFoco((f) => Math.min(lista.length - 1, f + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setFoco((f) => Math.max(0, f - 1));
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      escolher(lista[foco]?.valor ?? "");
    } else if (e.key === "Tab") {
      setAberto(false);
    }
  };

  return (
    <div ref={raiz} className="relative">
      <motion.button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={aberto}
        aria-controls={`${id}-lista`}
        disabled={vazio}
        onClick={() => setAberto((v) => !v)}
        onKeyDown={noTeclado}
        whileTap={TOQUE.whileTap}
        transition={TOQUE.transition}
        title={vazio ? "Nada para escolher nesta janela" : undefined}
        className={cn(
          "inline-flex items-center gap-1.5 h-9 pl-3 pr-2 rounded-lg border text-xs transition-colors max-w-[220px]",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-bee-pink/40",
          vazio
            ? "border-bee-line/60 bg-transparent text-bee-dim cursor-not-allowed"
            : ativo
              ? "border-bee-pink/60 bg-bee-pink/10 text-white"
              : "border-bee-line bg-bee-bg text-bee-muted hover:text-white hover:border-white/20",
          aberto && !ativo && "border-white/25 text-white",
        )}
      >
        <span className={cn("shrink-0", ativo ? "text-bee-pink" : "text-bee-dim")}>{filtro.rotulo}</span>
        <span className="truncate font-medium">{vazio ? "sem dados" : nomeAtual}</span>
        <ChevronDown className={cn("w-3.5 h-3.5 shrink-0 transition-transform duration-200", aberto && "rotate-180")} aria-hidden />
      </motion.button>

      <AnimatePresence>
        {aberto && (
          <motion.ul
            id={`${id}-lista`}
            role="listbox"
            aria-label={filtro.rotulo}
            variants={SURGIR}
            initial="initial"
            animate="animate"
            exit="exit"
            style={{ transformOrigin: "top left" }}
            className="absolute left-0 top-full mt-1.5 z-30 min-w-[200px] max-w-[280px] max-h-72 overflow-y-auto rounded-xl border border-bee-line bg-bee-surface p-1 shadow-2xl shadow-black/50"
          >
            {lista.map((o, i) => {
              const escolhido = o.valor === filtro.valor;
              return (
                <li
                  key={o.valor || "__todos"}
                  role="option"
                  aria-selected={escolhido}
                  onMouseEnter={() => setFoco(i)}
                  onClick={() => escolher(o.valor)}
                  className={cn(
                    "flex items-center justify-between gap-3 px-2.5 h-9 rounded-lg text-sm cursor-pointer select-none",
                    foco === i ? "bg-white/[0.06] text-white" : "text-white/80",
                    escolhido && "text-white",
                  )}
                >
                  <span className="truncate">{o.nome}</span>
                  {escolhido && <Check className="w-4 h-4 text-bee-pink shrink-0" aria-hidden />}
                </li>
              );
            })}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}

function ChipAtivo({ rotulo, valor, onRemover }: { rotulo: string; valor: string; onRemover: () => void }) {
  return (
    <motion.span
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1, transition: { duration: DURACAO.base, ease: SUAVE } }}
      exit={{ opacity: 0, scale: 0.9, transition: { duration: DURACAO.rapida, ease: SAIDA } }}
      className="inline-flex items-center gap-1 h-7 pl-2.5 pr-1 rounded-full bg-bee-pink/12 border border-bee-pink/30 text-xs text-white"
    >
      <span className="text-bee-pink">{rotulo}</span>
      <span className="font-medium max-w-[160px] truncate">{valor}</span>
      <button
        type="button"
        onClick={onRemover}
        aria-label={`Tirar o filtro ${rotulo}: ${valor}`}
        className="ml-0.5 w-5 h-5 rounded-full inline-flex items-center justify-center text-white/70 hover:text-white hover:bg-bee-pink/30 transition-colors"
      >
        <X className="w-3 h-3" />
      </button>
    </motion.span>
  );
}

function curta(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}
