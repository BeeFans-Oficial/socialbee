"use client";

import React, { useEffect, useRef, useState } from "react";
import { motion, useInView, useReducedMotion } from "framer-motion";
import { CheckCircle2 } from "lucide-react";

import { SUAVE } from "@/lib/movimento";
import { cn } from "@/lib/utils";

/**
 * "Como funciona", com as camadas da vista explodida do painel.
 *
 * Nada preso na tela: o palco está no fluxo da página e se monta quando
 * chega à vista. As quatro placas sobem do fundo uma a uma até a posição
 * explodida, na ordem de leitura (01 Identidades primeiro), e a cada placa
 * que assenta a linha-guia dela se desenha e a etiqueta numerada entra. Ao
 * lado, os quatro textos chegam na mesma ordem. No fim, o selo verde.
 * Depois disso o palco só gira devagar.
 *
 * O vocabulário é o da página inicial: o que a fã ganha em cada camada.
 * Nada de "sair do app", "página segura", "domínio reserva" ou nomes de
 * plataforma de revisão (ver `app/page.tsx`).
 */

const CAMADAS = [
  { chave: "consistencia", nome: "Identidades", nota: "mesmo documento", titulo: "A mesma página para todo mundo", texto: "Fã, prévia do WhatsApp, prévia do Instagram: todos recebem o mesmo documento, com o seu nome e os seus botões. Sem versão escondida, sem surpresa." },
  { chave: "destinos", nome: "Destinos", nota: "caminho verificado", titulo: "Cada botão leva onde promete", texto: "Do toque ao destino final, o caminho é um só e é verificado. Link quebrado ou desvio no meio aparece antes de a fã encontrar." },
  { chave: "barreira", nome: "Barreira 18+", nota: "confirmação antes", titulo: "Confirmação de idade antes dos links", texto: "Quem abre a página vê primeiro a confirmação de 18+. Os botões só entram depois do toque. Quem não confirma, não vê." },
  { chave: "dominio", nome: "Domínio", nota: "seu endereço", titulo: "Seu endereço, seu nome", texto: "Escolha o nome da página e, no Pro, o domínio entre os disponíveis. O endereço responde em HTTPS e continua levando até você." },
] as const;

const ACENTO = "#FF3C6E";
const ESPACO = 54;
/** Ordem de montagem: a de cima primeiro, na ordem de leitura (01 → 04);
 *  cada placa sobe do fundo até a altura dela. */
const ORDEM = [0, 1, 2, 3];
const PASSO = 0.42;
const INICIO = 0.2;
const quando = (indice: number) => INICIO + ORDEM.indexOf(indice) * PASSO;
const FIM = INICIO + ORDEM.length * PASSO + 0.3;

export function CamadasDaPagina() {
  const reduzir = useReducedMotion();
  const raiz = useRef<HTMLDivElement>(null);
  const emVista = useInView(raiz, { once: true, amount: 0.35 });
  const montar = reduzir || emVista;

  return (
    <div ref={raiz} className="mt-14 grid gap-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] lg:gap-12 items-center">
      <Palco montar={montar} semMovimento={Boolean(reduzir)} />

      {/* Os textos chegam na ordem das camadas, de cima para baixo. */}
      <ol className="space-y-6 lg:space-y-7">
        {CAMADAS.map((c, i) => (
          <motion.li
            key={c.chave}
            initial={reduzir ? false : { opacity: 0, x: 24 }}
            animate={montar ? { opacity: 1, x: 0 } : undefined}
            transition={{ duration: 0.5, ease: SUAVE, delay: reduzir ? 0 : quando(i) + 0.25 }}
            className="flex gap-4"
          >
            <span className="mt-0.5 font-mono text-[12px] tracking-[0.06em] flex-shrink-0" style={{ color: ACENTO }}>
              {String(i + 1).padStart(2, "0")}
            </span>
            <div>
              <h3 className="font-semibold text-xl sm:text-[22px] leading-tight">{c.titulo}</h3>
              <p className="mt-1.5 text-[15px] leading-relaxed text-white/60">{c.texto}</p>
            </div>
          </motion.li>
        ))}
        <motion.li
          initial={reduzir ? false : { opacity: 0, x: 24 }}
          animate={montar ? { opacity: 1, x: 0 } : undefined}
          transition={{ duration: 0.5, ease: SUAVE, delay: reduzir ? 0 : FIM + 0.1 }}
          className="flex items-center gap-3 pt-2"
        >
          <span className="inline-flex items-center justify-center w-9 h-9 rounded-full border border-emerald-400/40 bg-emerald-500/10 text-emerald-400">
            <CheckCircle2 className="w-5 h-5" />
          </span>
          <p className="text-[15px] text-white/80">
            <span className="font-semibold text-white">Revisada antes de ir para a bio.</span> Com um toque, as quatro camadas são conferidas e você vê o que ajustar.
          </p>
        </motion.li>
      </ol>
    </div>
  );
}

function Palco({ montar, semMovimento }: { montar: boolean; semMovimento: boolean }) {
  const palco = useRef<HTMLDivElement>(null);
  const ancoras = useRef<(HTMLSpanElement | null)[]>([]);
  const etiquetas = useRef<(HTMLElement | null)[]>([]);
  const [guias, setGuias] = useState<{ x: number; y: number; ex: number; ey: number }[]>([]);
  const [largo, setLargo] = useState(true);

  useEffect(() => {
    const el = palco.current;
    if (!el) return;
    const medir = () => setLargo(el.clientWidth >= 520);
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Linhas-guia medidas a cada quadro enquanto o palco está na tela.
  useEffect(() => {
    if (!largo) return;
    let vivo = true;
    let visivel = false;
    let id = 0;
    const io = new IntersectionObserver(([ent]) => {
      visivel = ent.isIntersecting;
    });
    if (palco.current) io.observe(palco.current);
    const medir = () => {
      const base = palco.current?.getBoundingClientRect();
      if (!base) return;
      const novas = CAMADAS.map((_, i) => {
        const a = ancoras.current[i]?.getBoundingClientRect();
        const e = etiquetas.current[i]?.getBoundingClientRect();
        if (!a || !e) return { x: 0, y: 0, ex: 0, ey: 0 };
        return { x: a.left + a.width / 2 - base.left, y: a.top + a.height / 2 - base.top, ex: e.left - base.left - 10, ey: e.top + 18 - base.top };
      });
      setGuias((antigas) =>
        antigas.length === novas.length && antigas.every((g, i) => Math.abs(g.x - novas[i].x) < 0.5 && Math.abs(g.y - novas[i].y) < 0.5 && Math.abs(g.ey - novas[i].ey) < 0.5) ? antigas : novas,
      );
    };
    const laco = () => {
      if (!vivo) return;
      if (visivel) medir();
      id = requestAnimationFrame(laco);
    };
    laco();
    return () => {
      vivo = false;
      cancelAnimationFrame(id);
      io.disconnect();
    };
  }, [largo]);

  return (
    <div
      ref={palco}
      className="relative w-full overflow-hidden rounded-2xl border border-white/[0.06]"
      style={{ background: "radial-gradient(ellipse 80% 60% at 38% 46%, #2a2d33 0%, #16181b 55%, #0a0b0d 100%)", height: largo ? 460 : 360 }}
    >
      <motion.div
        className={cn("absolute left-4 sm:left-5 top-4 font-mono text-[11px] tracking-[0.16em] text-[#7d828a] select-none whitespace-nowrap overflow-hidden text-ellipsis", largo ? "right-5" : "right-40")}
        initial={semMovimento ? false : { opacity: 0 }}
        animate={montar ? { opacity: 1 } : undefined}
        transition={{ duration: 0.4 }}
      >
        <span className="text-[#e9e6e1]">SUA PÁGINA</span> / EM CAMADAS
      </motion.div>

      <div
        className="absolute"
        style={{ left: largo ? "40%" : "50%", top: largo ? "56%" : "46%", transform: `translate(-50%, -50%) scale(${largo ? 1.02 : 0.78})`, perspective: 1100, width: 250, height: 170 }}
      >
        <motion.div
          className="absolute inset-0"
          style={{ transformStyle: "preserve-3d" }}
          initial={{ rotateX: 62, rotateZ: -34 }}
          animate={montar && !semMovimento ? { rotateX: 62, rotateZ: [-34, -22] } : { rotateX: 62, rotateZ: -34 }}
          transition={{ rotateZ: { duration: 10, ease: "easeInOut", repeat: Infinity, repeatType: "mirror", delay: FIM } }}
        >
          {CAMADAS.map((c, i) => (
            <Placa key={c.chave} indice={i} nome={c.nome} montar={montar} semMovimento={semMovimento} ancora={(el) => { ancoras.current[i] = el; }} />
          ))}
          <div aria-hidden className="absolute inset-0 rounded-[14px]" style={{ transform: "translateZ(-14px)", background: "radial-gradient(ellipse at 50% 50%, rgba(0,0,0,0.55), rgba(0,0,0,0) 70%)", filter: "blur(10px)" }} />
        </motion.div>
      </div>

      {largo && (
        <svg className="absolute inset-0 w-full h-full pointer-events-none" aria-hidden>
          {guias.map((g, i) => {
            const mx = Math.max(g.x + 36, g.ex - 70);
            return (
              <g key={CAMADAS[i].chave}>
                <motion.polyline
                  points={`${g.x},${g.y} ${mx},${g.ey} ${g.ex},${g.ey}`}
                  fill="none"
                  stroke="#c9ccd1"
                  strokeWidth="1.5"
                  initial={semMovimento ? false : { pathLength: 0, opacity: 0 }}
                  animate={montar ? { pathLength: 1, opacity: 0.85 } : undefined}
                  transition={{ duration: 0.35, ease: SUAVE, delay: semMovimento ? 0 : quando(i) + 0.32 }}
                />
                <motion.circle cx={g.x} cy={g.y} r="4" fill={ACENTO} initial={semMovimento ? false : { opacity: 0 }} animate={montar ? { opacity: 1 } : undefined} transition={{ duration: 0.2, delay: semMovimento ? 0 : quando(i) + 0.3 }} />
              </g>
            );
          })}
        </svg>
      )}

      <div className={cn("flex flex-col gap-3", largo ? "absolute right-5 top-14 w-[190px]" : "absolute right-3 bottom-3 left-3 flex-row flex-wrap gap-x-4 gap-y-1")}>
        {CAMADAS.map((c, i) => (
          <motion.div
            key={c.chave}
            ref={(el) => { etiquetas.current[i] = el; }}
            initial={semMovimento ? false : { opacity: 0, x: largo ? 16 : 0, y: largo ? 0 : 8 }}
            animate={montar ? { opacity: 1, x: 0, y: 0 } : undefined}
            transition={{ duration: 0.35, ease: SUAVE, delay: semMovimento ? 0 : quando(i) + 0.45 }}
            className={cn(!largo && "flex items-baseline gap-1.5")}
          >
            <span className="block font-mono text-[11px] tracking-[0.06em]" style={{ color: ACENTO }}>{String(i + 1).padStart(2, "0")}</span>
            <span className={cn("block font-semibold leading-tight text-[#f3f1ed] tracking-[-0.01em]", largo ? "text-[15px]" : "text-[13px]")}>{c.nome}</span>
            {largo && <span className="block mt-0.5 font-mono text-[11px] leading-tight text-emerald-300">{c.nota}</span>}
          </motion.div>
        ))}
      </div>

      {/* O selo, quando a última placa assentou. */}
      <motion.div
        aria-hidden
        className={cn("absolute flex items-center gap-3", largo ? "left-5 bottom-5" : "right-3 top-3 scale-90 origin-top-right")}
        initial={semMovimento ? false : { opacity: 0, scale: 0.7 }}
        animate={montar ? { opacity: 1, scale: 1 } : undefined}
        transition={{ type: "spring", stiffness: 300, damping: 22, delay: semMovimento ? 0 : FIM }}
      >
        <span className="relative inline-flex items-center justify-center w-11 h-11">
          <motion.span
            className="absolute inset-0 rounded-full border-2 border-emerald-400"
            initial={semMovimento ? false : { scale: 0.9, opacity: 0.7 }}
            animate={montar ? { scale: 1.9, opacity: 0 } : undefined}
            transition={{ duration: 0.7, ease: SUAVE, delay: semMovimento ? 0 : FIM + 0.1 }}
          />
          <span className="absolute inset-0 rounded-full border border-emerald-400/40 bg-emerald-500/10" />
          <CheckCircle2 className="relative w-5 h-5 text-emerald-400" />
        </span>
        <span>
          <span className="block text-sm text-white font-medium">Verde</span>
          <span className="block font-mono text-[11px] text-emerald-300">quatro camadas ok</span>
        </span>
      </motion.div>
    </div>
  );
}

function Placa({ indice, nome, montar, semMovimento, ancora }: { indice: number; nome: string; montar: boolean; semMovimento: boolean; ancora: (el: HTMLSpanElement | null) => void }) {
  const z = (3 - indice) * ESPACO;
  return (
    <motion.div
      className="absolute inset-0 rounded-[14px] border border-emerald-400/55"
      style={{ transformStyle: "preserve-3d", background: "rgba(16,185,129,0.12)", boxShadow: "0 18px 44px -14px rgba(52,211,153,0.45)", backdropFilter: "blur(2px)" }}
      // Cada placa sobe do fundo, desfocada, até a altura dela na pilha explodida.
      initial={semMovimento ? { z, opacity: 1 } : { z: z - 260, opacity: 0, filter: "blur(8px)" }}
      animate={montar ? { z, opacity: 1, filter: "blur(0px)" } : undefined}
      transition={{ duration: 0.7, ease: [0.2, 0, 0, 1], delay: semMovimento ? 0 : quando(indice) }}
    >
      <span className="absolute inset-0 p-3 flex flex-col justify-between" style={{ transform: "translateZ(1px)" }}>
        <span className="font-mono text-[9px] tracking-[0.14em] text-white/55 uppercase">{nome}</span>
        <Conteudo indice={indice} />
      </span>
      <span ref={ancora} aria-hidden className="absolute right-0 top-1/2 w-px h-px" />
    </motion.div>
  );
}

function Conteudo({ indice }: { indice: number }) {
  const tinta = "border-emerald-300/70 text-emerald-200";
  if (indice === 0) {
    return (
      <span className="flex items-end gap-1.5">
        {[0, 1, 2, 3, 4].map((i) => (
          <span key={i} className={cn("block w-7 h-9 rounded-[3px] border", tinta)} style={{ opacity: 0.55 + i * 0.09 }} />
        ))}
      </span>
    );
  }
  if (indice === 1) {
    return (
      <span className="flex flex-col gap-1.5">
        {[0, 1, 2].map((i) => (
          <span key={i} className={cn("block h-5 rounded-full border", tinta)} style={{ width: `${78 - i * 14}%`, opacity: 0.85 - i * 0.2 }} />
        ))}
      </span>
    );
  }
  if (indice === 2) {
    return (
      <span className="flex items-center justify-center">
        <span className={cn("inline-flex items-center justify-center w-14 h-14 rounded-full border-2 font-semibold text-sm", tinta)}>18+</span>
      </span>
    );
  }
  return <span className={cn("font-mono text-[11px] truncate px-2 py-1 rounded border self-start max-w-full", tinta)}>seunome.bio/você</span>;
}
