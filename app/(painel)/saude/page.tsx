"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronRight, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { EsqueletoDeLinhas } from "@/components/painel/Esqueleto";
import { NumeroAnimado } from "@/components/painel/NumeroAnimado";
import { COR_DO_TEXTO, NOME_DO_VEREDITO, acaoDaChecagem, quando, resumoDaChecagem } from "@/components/painel/saude/Pecas";
import { SeloDeSaude, type EstadoDeSaude } from "@/components/painel/saude/SeloDeSaude";
import { CabecalhoDeTela, Tela } from "@/components/painel/Tela";
import { api, ApiError } from "@/lib/api/client";
import type { ApiSaudeDaPagina } from "@/lib/api/types";
import { ITEM_DA_LISTA, LISTA, TOQUE } from "@/lib/movimento";
import { cn } from "@/lib/utils";

/**
 * Saúde: todas as páginas da conta, cada uma com a última checagem — o que
 * a Meta faz quando o link entra na bio, feito antes de colar. Quem pede
 * ação vem primeiro (vermelhas, amarelas, nunca checadas); clicar na linha
 * abre a página com as quatro camadas e o histórico.
 *
 * Verde não é aprovação da Meta, e o cabeçalho diz isso.
 */
export default function SaudePage() {
  const router = useRouter();
  const [paginas, setPaginas] = useState<ApiSaudeDaPagina[] | null>(null);
  /** As páginas sendo checadas agora, para o selo girar só nelas. */
  const [checando, setChecando] = useState<Set<string>>(new Set());
  const [checandoTodas, setChecandoTodas] = useState(false);

  useEffect(() => {
    api
      .saude()
      .then((r) => setPaginas(r.paginas))
      .catch((caught) => {
        if (caught instanceof ApiError && caught.isUnauthorized) {
          router.replace("/login?de=/saude");
          return;
        }
        toast.error("Não foi possível carregar a saúde das páginas.");
        setPaginas([]);
      });
  }, [router]);

  const checarUma = async (pagina: ApiSaudeDaPagina) => {
    setChecando((s) => new Set(s).add(pagina.id));
    try {
      const r = await api.checarPagina(pagina.id);
      setPaginas((atuais) => atuais?.map((p) => (p.id === pagina.id ? { ...p, revisao: r } : p)) ?? null);
      toast[r.veredito === "verde" ? "success" : "warning"](
        r.veredito === "verde" ? `${pagina.displayName}: saúde verde.` : `${pagina.displayName}: a checagem encontrou o que corrigir.`,
      );
    } catch (caught) {
      toast.error(caught instanceof ApiError && caught.status === 429 ? "Já checamos há pouco. Espere alguns minutos." : "Não foi possível checar agora.");
    } finally {
      setChecando((s) => {
        const n = new Set(s);
        n.delete(pagina.id);
        return n;
      });
    }
  };

  const checarTodas = async () => {
    if (!paginas?.length) return;
    setChecandoTodas(true);
    setChecando(new Set(paginas.map((p) => p.id)));
    try {
      const r = await api.checarTodas();
      setPaginas(r.paginas);
      const vermelhas = r.paginas.filter((p) => p.revisao?.veredito === "vermelho").length;
      toast[vermelhas ? "warning" : "success"](vermelhas ? `${vermelhas} ${vermelhas === 1 ? "página pede" : "páginas pedem"} correção.` : "Todas as páginas verdes.");
    } catch (caught) {
      toast.error(caught instanceof ApiError && caught.status === 429 ? "Já checamos todas há pouco. Espere alguns minutos." : "Não foi possível checar agora.");
    } finally {
      setChecandoTodas(false);
      setChecando(new Set());
    }
  };

  const verdes = paginas?.filter((p) => p.revisao?.veredito === "verde").length ?? 0;
  const corrigir = paginas?.filter((p) => p.revisao && p.revisao.veredito !== "verde").length ?? 0;
  const semChecagem = paginas?.filter((p) => !p.revisao).length ?? 0;

  return (
    <Tela>
      <CabecalhoDeTela
        titulo="Saúde da página"
        descricao='Suas páginas, conferidas antes de ir para a bio. Verde é "nenhum sinal do que derruba contas", não aprovação da Meta.'
        acoes={
          <motion.button
            type="button"
            data-tour="checar-todas"
            onClick={() => void checarTodas()}
            disabled={checandoTodas || !paginas?.length}
            whileTap={TOQUE.whileTap}
            transition={TOQUE.transition}
            className="inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-white text-bee-bg text-sm font-semibold hover:bg-white/90 disabled:opacity-60 transition-colors"
          >
            {checandoTodas ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            {checandoTodas ? "Checando…" : "Checar todas"}
          </motion.button>
        }
      />

      {/* Resumo */}
      <div data-tour="resumo-da-saude" className="grid grid-cols-3 gap-3 sm:gap-4 mb-6">
        <Contador rotulo="Verdes" valor={verdes} cor="text-emerald-400" />
        <Contador rotulo="Para corrigir" valor={corrigir} cor="text-red-400" destaque={corrigir > 0} />
        <Contador rotulo="Sem checagem" valor={semChecagem} cor="text-white/70" />
      </div>

      {/* Lista */}
      {paginas === null ? (
        <EsqueletoDeLinhas linhas={3} />
      ) : paginas.length === 0 ? (
        <p className="rounded-xl border border-bee-line bg-bee-surface px-5 py-8 text-center text-sm text-bee-muted">
          Você ainda não tem páginas. <Link href="/paginas?nova=1" className="text-bee-pink hover:underline">Crie a primeira</Link> e cheque antes de colar na bio.
        </p>
      ) : (
        <motion.ol data-tour="lista-da-saude" variants={LISTA} initial="initial" animate="animate" className="rounded-2xl border border-bee-line bg-bee-surface divide-y divide-bee-line overflow-hidden">
          <li className="hidden md:grid grid-cols-[minmax(0,1.3fr)_minmax(0,0.9fr)_minmax(0,1.4fr)_auto] gap-4 px-5 py-2.5 text-[10px] font-semibold tracking-[0.14em] uppercase text-white/35">
            <span>Página</span>
            <span>Última checagem</span>
            <span>O que falta</span>
            <span className="w-20" />
          </li>
          <AnimatePresence initial={false}>
            {paginas.map((p) => (
              <Linha key={p.id} pagina={p} checando={checando.has(p.id)} onChecar={() => void checarUma(p)} />
            ))}
          </AnimatePresence>
        </motion.ol>
      )}

      <p className="mt-4 text-xs text-bee-dim">
        A checagem automática roda todo dia às 5h nas páginas no ar. Quando uma fica vermelha, você recebe um e-mail.
      </p>
    </Tela>
  );
}

function Contador({ rotulo, valor, cor, destaque }: { rotulo: string; valor: number; cor: string; destaque?: boolean }) {
  return (
    <div className={cn("rounded-xl border px-4 py-3 bg-bee-surface", destaque ? "border-red-400/35 bg-red-500/[0.06]" : "border-bee-line")}>
      <div className="text-[10px] font-semibold tracking-[0.12em] uppercase text-white/45">{rotulo}</div>
      <div className={cn("text-2xl font-semibold tabular-nums", cor)}>
        <NumeroAnimado valor={valor} />
      </div>
    </div>
  );
}

function Linha({ pagina, checando, onChecar }: { pagina: ApiSaudeDaPagina; checando: boolean; onChecar: () => void }) {
  const r = pagina.revisao;
  const estado: EstadoDeSaude = checando ? "revisando" : r ? r.veredito : "nenhuma";
  const acao = r ? acaoDaChecagem(r) : null;
  return (
    <motion.li layout variants={ITEM_DA_LISTA} exit={{ opacity: 0 }} className={cn("relative", r?.veredito === "vermelho" && "bg-red-500/[0.04]")}>
      <Link
        href={`/saude/${pagina.id}`}
        className="grid grid-cols-[auto_minmax(0,1fr)_auto] md:grid-cols-[minmax(0,1.3fr)_minmax(0,0.9fr)_minmax(0,1.4fr)_auto] items-center gap-3 md:gap-4 px-4 md:px-5 py-4 hover:bg-white/[0.02] transition-colors"
      >
        {/* Página */}
        <span className="contents md:flex md:items-center md:gap-3 md:min-w-0">
          <SeloDeSaude estado={estado} tamanho={40} />
          <span className="min-w-0">
            <span className="block text-[15px] font-medium text-white truncate">{pagina.displayName}</span>
            <span className="block font-mono text-xs text-bee-muted truncate">
              {pagina.host}/{pagina.slug}
              {!pagina.published && <span className="text-bee-dim"> · fora do ar</span>}
            </span>
            {/* No celular, o veredito e o que falta vêm aqui embaixo. */}
            <span className="md:hidden block mt-1 text-xs text-white/70">
              <Veredito pagina={pagina} />
              {r && r.veredito !== "verde" && <span className="block mt-0.5">{resumoDaChecagem(r)}</span>}
            </span>
          </span>
        </span>

        {/* Última checagem */}
        <span className="hidden md:block min-w-0">
          <Veredito pagina={pagina} />
        </span>

        {/* O que falta */}
        <span className="hidden md:block min-w-0 text-sm text-white/75 leading-snug">
          {r ? (
            <>
              {resumoDaChecagem(r)}
              {acao && <span className={cn("block text-xs mt-0.5", r.veredito === "vermelho" ? "text-red-300" : "text-amber-300")}>{acao}</span>}
            </>
          ) : (
            <span className="text-bee-muted">Cheque antes de colar o link na bio.</span>
          )}
        </span>

        {/* Ação */}
        <span className="flex items-center gap-2 justify-self-end">
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onChecar();
            }}
            disabled={checando}
            className={cn(
              "h-8 px-3 rounded-full text-xs font-semibold transition-colors disabled:opacity-60",
              r ? "border border-white/15 text-white/85 hover:border-white/35" : "bg-bee-pink text-white hover:bg-bee-pink-hot",
            )}
          >
            {checando ? "Checando…" : r ? "Checar" : "Checar agora"}
          </button>
          <ChevronRight className="w-4 h-4 text-bee-dim hidden sm:block" aria-hidden />
        </span>
      </Link>
    </motion.li>
  );
}

function Veredito({ pagina }: { pagina: ApiSaudeDaPagina }) {
  const r = pagina.revisao;
  if (!r) {
    return (
      <>
        <span className="block text-sm text-white/60">Sem checagem</span>
        <span className="block text-xs text-bee-muted">criada {quando(pagina.createdAt)}</span>
      </>
    );
  }
  return (
    <>
      <span className={cn("block text-sm font-semibold", COR_DO_TEXTO[r.veredito])}>{NOME_DO_VEREDITO[r.veredito]}</span>
      <span className="block text-xs text-bee-muted">
        {r.trigger === "cron" ? "automática" : "manual"} · {quando(r.ranAt)}
      </span>
    </>
  );
}
