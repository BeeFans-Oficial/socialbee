"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ChevronDown, CircleHelp, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { Esqueleto } from "@/components/painel/Esqueleto";
import { COR_DO_TEXTO, Etapas } from "@/components/painel/saude/Pecas";
import { SeloDeSaude } from "@/components/painel/saude/SeloDeSaude";
import { VistaExplodida } from "@/components/painel/saude/VistaExplodida";
import { CabecalhoDeTela, Tela } from "@/components/painel/Tela";
import { api, ApiError, definirPaginaAtiva } from "@/lib/api/client";
import type { ApiProfile, ApiRevisao } from "@/lib/api/types";
import { DURACAO, SAIDA, SUAVE, TOQUE } from "@/lib/movimento";
import { cn } from "@/lib/utils";

/**
 * A saúde de uma página: toda checagem, manual ou da madrugada, com data e
 * hora, veredito e as quatro camadas de cada uma. A mais recente no topo,
 * aberta na vista explodida; as outras fechadas, para a linha do tempo
 * caber numa tela.
 *
 * Verde não é aprovação da Meta, e o rodapé de cada rodada diz o que o
 * simulador não cobre.
 */
export default function SaudeDaPaginaPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [pagina, setPagina] = useState<ApiProfile | null>(null);
  const [revisoes, setRevisoes] = useState<ApiRevisao[] | null>(null);
  const [rodando, setRodando] = useState(false);
  const [aberta, setAberta] = useState<string | null>(null);
  /** A rodada criada nesta visita, que ganha a cascata ao aparecer. */
  const [recemChegada, setRecemChegada] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    try {
      // A página pedida vira a ativa do painel: `api.profile()` e o "ligar a
      // barreira" agem sobre ela.
      definirPaginaAtiva(id);
      const [p, h] = await Promise.all([api.profile(), api.historicoDeChecagens(id)]);
      setPagina(p);
      setRevisoes(h.revisoes);
      setAberta((atual) => atual ?? h.revisoes[0]?.id ?? null);
      setRecemChegada((atual) => atual ?? h.revisoes[0]?.id ?? null);
    } catch (caught) {
      if (caught instanceof ApiError && caught.isUnauthorized) {
        router.replace(`/login?de=/saude/${id}`);
        return;
      }
      toast.error(caught instanceof ApiError ? caught.message : "Não foi possível carregar.");
      setRevisoes([]);
    }
  }, [id, router]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const checar = async () => {
    setRodando(true);
    try {
      const r = await api.checarPagina(id);
      setRevisoes((atuais) => [r, ...(atuais ?? [])]);
      setRecemChegada(r.id);
      setAberta(r.id);
      toast[r.veredito === "verde" ? "success" : "warning"](
        r.veredito === "verde" ? "Saúde verde: nenhum sinal do que derruba contas." : "A checagem encontrou o que corrigir.",
      );
    } catch (caught) {
      toast.error(caught instanceof ApiError && caught.status === 429 ? "Já checamos há pouco. Espere alguns minutos." : "Não foi possível checar agora.");
    } finally {
      setRodando(false);
    }
  };

  const ligarBarreira = async () => {
    try {
      await api.updateProfile({ isAdult: true });
      toast.success("Barreira 18+ ligada. Cheque de novo para confirmar.");
      setPagina((p) => (p ? { ...p, isAdult: true } : p));
    } catch {
      toast.error("Não foi possível ligar a barreira.");
    }
  };

  const ultima = revisoes?.[0] ?? null;

  return (
    <Tela largura="estreita">
      <Link href="/saude" className="inline-flex items-center gap-1.5 text-sm text-bee-muted hover:text-white mb-4 transition-colors">
        <ArrowLeft className="w-4 h-4" />
        Saúde
      </Link>
      <CabecalhoDeTela
        titulo={pagina?.displayName ?? "Saúde da página"}
        descricao={pagina ? `${pagina.host}/${pagina.slug} · o que a Meta faz quando o link entra na bio, feito antes de você colar.` : "Carregando…"}
      />

      {/* Estado atual e o botão. */}
      <div className="rounded-2xl border border-bee-line bg-bee-surface p-4 sm:p-5 flex flex-wrap items-center gap-4">
        <SeloDeSaude estado={rodando ? "revisando" : ultima ? ultima.veredito : "nenhuma"} />
        <div className="min-w-0 flex-1 basis-48">
          <p className="text-sm text-white">
            {revisoes === null ? "Carregando…" : ultima ? resumo(ultima) : "Esta página ainda não foi checada."}
          </p>
          <p className="text-xs text-bee-muted">
            {ultima ? `${ultima.trigger === "cron" ? "Checagem automática" : "Checagem manual"} · ${quando(ultima.ranAt)}` : "A primeira checagem leva alguns segundos."}
          </p>
        </div>
        <motion.button
          type="button"
          onClick={() => void checar()}
          disabled={rodando}
          whileTap={TOQUE.whileTap}
          transition={TOQUE.transition}
          className="inline-flex items-center justify-center gap-1.5 h-10 px-4 rounded-lg bg-white text-bee-bg text-sm font-semibold hover:bg-white/90 disabled:opacity-60 transition-colors w-full sm:w-auto"
        >
          {rodando ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          {rodando ? "Checando…" : "Checar agora"}
        </motion.button>
      </div>

      {/* Linha do tempo. */}
      <h2 className="mt-8 mb-3 text-[11px] font-semibold tracking-[0.14em] uppercase text-white/40">Histórico</h2>
      {revisoes === null ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Esqueleto key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      ) : revisoes.length === 0 ? (
        <p className="rounded-xl border border-bee-line bg-bee-surface px-5 py-8 text-center text-sm text-bee-muted">
          Nenhuma checagem ainda. Clique em "Checar agora".
        </p>
      ) : (
        <ol className="relative border-l border-bee-line ml-3 space-y-3">
          <AnimatePresence initial={false}>
            {revisoes.map((r, i) => (
              <Rodada
                key={r.id}
                revisao={r}
                anterior={revisoes[i + 1] ?? null}
                aberta={aberta === r.id}
                recemChegada={r.id === recemChegada}
                host={pagina?.host}
                slug={pagina?.slug}
                onAbrir={() => setAberta(aberta === r.id ? null : r.id)}
                onLigarBarreira={pagina && !pagina.isAdult ? ligarBarreira : undefined}
              />
            ))}
          </AnimatePresence>
        </ol>
      )}
    </Tela>
  );
}

function Rodada({
  revisao,
  anterior,
  aberta,
  recemChegada,
  host,
  slug,
  onAbrir,
  onLigarBarreira,
}: {
  revisao: ApiRevisao;
  anterior: ApiRevisao | null;
  aberta: boolean;
  /** Acabou de ser criada nesta visita: o fluxo se desenha em cascata. */
  recemChegada: boolean;
  host?: string;
  slug?: string;
  onAbrir: () => void;
  onLigarBarreira?: () => Promise<void>;
}) {
  const mudou = anterior && anterior.veredito !== revisao.veredito;
  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0, transition: { duration: DURACAO.base, ease: SUAVE } }}
      className="relative pl-6"
    >
      {/* O ponto na linha, na cor do veredito. */}
      <span className={cn("absolute -left-[5px] top-4 w-2.5 h-2.5 rounded-full ring-4 ring-bee-bg", PONTO[revisao.veredito])} aria-hidden />
      <div className={cn("rounded-xl border bg-bee-surface overflow-hidden", aberta ? "border-white/15" : "border-bee-line")}>
        <button type="button" onClick={onAbrir} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/[0.02] transition-colors">
          <div className="min-w-0 flex-1">
            <p className="text-sm text-white">
              <span className={cn("font-semibold", COR_DO_TEXTO[revisao.veredito])}>{NOME[revisao.veredito]}</span>
              <span className="text-bee-muted"> · {revisao.trigger === "cron" ? "automática" : "manual"}</span>
              {mudou && <span className="text-xs text-bee-dim"> · mudou de {NOME[anterior!.veredito].toLowerCase()}</span>}
            </p>
            <p className="text-xs text-bee-muted tabular-nums">{dataHora(revisao.ranAt)}</p>
          </div>
          <span className="hidden sm:block">
            <Etapas itens={revisao.itens} />
          </span>
          <ChevronDown className={cn("w-4 h-4 text-bee-dim flex-shrink-0 transition-transform duration-200", aberta && "rotate-180")} aria-hidden />
        </button>
        <AnimatePresence initial={false}>
          {aberta && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto", transition: { duration: DURACAO.base, ease: SUAVE } }}
              exit={{ opacity: 0, height: 0, transition: { duration: DURACAO.rapida, ease: SAIDA } }}
              className="overflow-hidden"
            >
              <div className="border-t border-bee-line p-3">
                <VistaExplodida itens={revisao.itens} host={host} slug={slug} animar={recemChegada} onLigarBarreira={onLigarBarreira} />
              </div>
              <details className="group border-t border-bee-line px-4 py-2.5">
                <summary className="flex items-center gap-1.5 text-[11px] text-bee-dim cursor-pointer select-none list-none">
                  <CircleHelp className="w-3.5 h-3.5" />
                  O que a checagem não vê
                  <ChevronDown className="w-3 h-3 ml-auto transition-transform group-open:rotate-180" />
                </summary>
                <ul className="mt-2 space-y-1 text-[11px] text-bee-muted list-disc pl-4">
                  {revisao.limites.map((l) => (
                    <li key={l}>{l}</li>
                  ))}
                </ul>
              </details>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.li>
  );
}

const NOME = { verde: "Verde", amarelo: "Amarelo", vermelho: "Vermelho" } as const;
const PONTO = { verde: "bg-emerald-400", amarelo: "bg-amber-400", vermelho: "bg-red-400" } as const;

function resumo(r: ApiRevisao): string {
  if (r.veredito === "verde") return "Verde: nenhum sinal do que derruba contas.";
  const ruins = r.itens.filter((i) => i.estado === "vermelho").length;
  if (r.veredito === "vermelho") return `Vermelho: ${ruins === 1 ? "um item" : `${ruins} itens`} com o que derruba contas.`;
  return "Amarelo: responde, mas com sinal de alerta.";
}

function dataHora(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function quando(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return "agora";
  if (diff < 3_600_000) return `há ${Math.round(diff / 60_000)} min`;
  if (diff < 86_400_000) return `há ${Math.round(diff / 3_600_000)} h`;
  return dataHora(iso);
}
