"use client";

import React, { useEffect, useState } from "react";
import { AlertTriangle, Check, Info as InfoIcon } from "lucide-react";

import { Switch } from "@/components/ui/switch";

import { cn } from "@/lib/utils";

/**
 * Peças do painel lateral dos editores (página e link): seções com título,
 * linhas "rótulo — controle", opções com marca de escolhida e campos que salvam
 * sozinhos ao sair deles. Os dois editores usam as mesmas para parecerem uma
 * coisa só.
 */

/** Fundo do painel lateral dos editores: grafite com um toque de azul. */
export const FUNDO_DO_PAINEL = "bg-[#0d1119]";

export function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="px-4 pt-6 pb-2">
      <div className="flex items-center gap-3 mb-3">
        <span className="text-[11px] font-semibold tracking-[0.16em] text-white/50 uppercase">
          {titulo}
        </span>
        <span className="flex-1 h-px bg-white/[0.07]" />
      </div>
      {children}
    </section>
  );
}

export function Linha({
  rotulo,
  compacta,
  children,
}: {
  rotulo: string;
  compacta?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("flex items-center justify-between gap-3 px-2", compacta ? "py-2" : "py-3")}>
      <span className="text-[15px] text-white/85">{rotulo}</span>
      {children}
    </div>
  );
}

/** Ícone ⓘ com a explicação no `title` — o detalhe fica a um passar de mouse,
 *  e o painel não vira manual. */
export function Info({ texto }: { texto: string }) {
  return (
    <span title={texto} aria-label={texto} className="text-white/35 hover:text-white/70 cursor-help">
      <InfoIcon className="w-3.5 h-3.5" />
    </span>
  );
}

export function Grupo({
  titulo,
  nota,
  info,
  children,
}: {
  titulo: string;
  nota?: string;
  info?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="pt-1 pb-4">
      <div className="flex items-center justify-between px-1 mb-2">
        <span className="text-[15px] font-semibold text-white">{titulo}</span>
        {info && <Info texto={info} />}
      </div>
      <div className="space-y-1">{children}</div>
      {nota && <p className="px-1 mt-2 text-xs leading-relaxed text-white/45">{nota}</p>}
    </div>
  );
}

/** Quadradinho com ícone, à esquerda das opções e dos interruptores. */
function Icone({ children }: { children: React.ReactNode }) {
  return (
    <span className="w-7 h-7 rounded-md bg-white/[0.06] flex items-center justify-center flex-shrink-0">
      {children}
    </span>
  );
}

/** Opção de uma lista de escolha única. A escolhida ganha caixa e ✓ — neutros,
 *  sem cor: a cor fica para o ícone de cada opção. */
export function Opcao({
  icone,
  rotulo,
  ativa,
  onClick,
}: {
  icone: React.ReactNode;
  rotulo: string;
  ativa: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left text-[15px] transition-colors",
        ativa
          ? "border-white/15 bg-black/35 text-white"
          : "border-transparent text-white/70 hover:bg-white/[0.03]",
      )}
    >
      <Icone>{icone}</Icone>
      <span className="flex-1">{rotulo}</span>
      {ativa && <Check className="w-4 h-4 text-white" />}
    </button>
  );
}

/**
 * Linha com ícone, rótulo e interruptor. Ligada, ganha a mesma caixa da opção
 * escolhida — o estado se lê de longe, sem precisar achar o interruptor.
 */
export function OpcaoLigavel({
  icone,
  rotulo,
  ligada,
  extra,
  onMudar,
}: {
  icone: React.ReactNode;
  rotulo: string;
  ligada: boolean;
  /** Algo ao lado do interruptor (um selo PRO, por exemplo). */
  extra?: React.ReactNode;
  onMudar: (v: boolean) => void;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 px-3 py-2.5 rounded-xl border text-[15px] transition-colors",
        ligada ? "border-white/15 bg-black/35 text-white" : "border-transparent text-white/70",
      )}
    >
      <Icone>{icone}</Icone>
      <span className="flex-1">{rotulo}</span>
      {extra}
      <Switch checked={ligada} onCheckedChange={onMudar} />
    </div>
  );
}

/** Campo que salva ao sair dele ou no Enter, e volta ao valor salvo se a API
 *  recusar. */
export function CampoDeTexto({
  rotulo,
  valor,
  placeholder,
  maxLength,
  onSalvar,
}: {
  rotulo: string;
  valor: string;
  placeholder?: string;
  maxLength: number;
  onSalvar: (v: string) => Promise<boolean>;
}) {
  const [rascunho, setRascunho] = useState(valor);
  useEffect(() => setRascunho(valor), [valor]);

  const confirmar = async () => {
    if (rascunho === valor) return;
    if (!(await onSalvar(rascunho))) setRascunho(valor);
  };

  return (
    <label className="flex items-center justify-between gap-3 px-2 py-3">
      <span className="text-[15px] text-white/85 flex-shrink-0">{rotulo}</span>
      <input
        value={rascunho}
        placeholder={placeholder}
        maxLength={maxLength}
        onChange={(e) => setRascunho(e.target.value)}
        onBlur={confirmar}
        onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
        className="min-w-0 flex-1 bg-transparent text-right text-[15px] text-white placeholder:text-white/30 focus:outline-none"
      />
    </label>
  );
}

export function Aviso({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-2 flex gap-1.5 text-[11px] leading-relaxed text-amber-200/80">
      <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-px" />
      {children}
    </p>
  );
}

/**
 * Moldura de iPhone 17 Pro Max para as prévias dos editores.
 *
 * iPhone, e não um celular genérico: a maior parte das fãs chega pelo
 * Instagram no iPhone, e é nele que a página de chegada mostra a instrução do
 * menu. Proporção da tela do 17 Pro Max (440×956 pontos), Dynamic Island,
 * botões laterais e o indicador de início.
 *
 * O tamanho vem da ALTURA da janela (até 900 px), e a largura sai da
 * proporção: assim o aparelho fica o maior possível sem cortar embaixo.
 */
export function MolduraDeCelular({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative z-10 mt-6 h-[min(calc(100vh-130px),900px)] min-h-[560px] aspect-[440/956] max-w-full">
      {/* Botões laterais: ação e volume à esquerda, power à direita. */}
      <span className="absolute -left-[4px] top-[16%] w-[4px] h-[4%] rounded-l-sm bg-[#2c2c2e]" />
      <span className="absolute -left-[4px] top-[23%] w-[4px] h-[7.5%] rounded-l-sm bg-[#2c2c2e]" />
      <span className="absolute -left-[4px] top-[32%] w-[4px] h-[7.5%] rounded-l-sm bg-[#2c2c2e]" />
      <span className="absolute -right-[4px] top-[27%] w-[4px] h-[11%] rounded-r-sm bg-[#2c2c2e]" />

      <div className="absolute inset-0 rounded-[68px] bg-[#1c1c1e] ring-1 ring-[#3a3a3c] p-[12px] shadow-[0_30px_80px_rgba(0,0,0,0.6)]">
        <div className="relative w-full h-full rounded-[56px] overflow-hidden bg-black">
          <div className="absolute top-[12px] left-1/2 -translate-x-1/2 w-[30%] h-[34px] rounded-full bg-black z-20 pointer-events-none" />
          {children}
          <div className="absolute bottom-[9px] left-1/2 -translate-x-1/2 w-[34%] h-[5px] rounded-full bg-white/60 z-20 pointer-events-none" />
        </div>
      </div>
    </div>
  );
}
