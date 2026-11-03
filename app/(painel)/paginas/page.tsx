"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Copy, ExternalLink, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useUltimo } from "@/components/painel/ConfirmarExclusao";
import { EsqueletoDeCartoes } from "@/components/painel/Esqueleto";
import { CabecalhoDeTela, Tela } from "@/components/painel/Tela";
import { SeloPro, avisarPro } from "@/components/shared/SeloPro";
import { api, ApiError, definirPaginaAtiva, paginaAtiva } from "@/lib/api/client";
import { invalidateSession, usePlano, useSession } from "@/lib/api/use-session";
import type { ApiProfile } from "@/lib/api/types";
import { CARTAO_DA_GRADE, LISTA } from "@/lib/movimento";
import { urlDaPagina } from "@/lib/site";
import { TEMPLATE_DO_FREE, resolverVisual } from "@/lib/templates";
import { cn, slugify, validateSlug } from "@/lib/utils";

/**
 * Páginas: todas as páginas da conta, em cartões.
 *
 * É a porta de entrada do painel. Cada cartão mostra uma miniatura com as
 * cores da página, o endereço completo e as ações. Clicar abre o editor da
 * página (`/paginas/[id]`).
 */
export default function PaginasPage() {
  const router = useRouter();
  const { session } = useSession();
  const { plano, ehPro } = usePlano();
  const [paginas, setPaginas] = useState<ApiProfile[] | null>(null);
  const [criando, setCriando] = useState(false);
  const [apagando, setApagando] = useState<ApiProfile | null>(null);

  // `/paginas?nova=1` abre direto a criação — é o que o seletor da barra do
  // topo manda. Lido de `window.location` para a tela continuar estática.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("nova") === "1") setCriando(true);
  }, []);

  useEffect(() => {
    api
      .profiles()
      .then(setPaginas)
      .catch((caught) => {
        if (caught instanceof ApiError && caught.isUnauthorized) {
          router.replace("/login?de=/paginas");
          return;
        }
        toast.error("Não foi possível carregar suas páginas.");
        setPaginas([]);
      });
  }, [router]);

  // A ativa é a do cabeçalho `x-profile-id`; sem ele, a que a sessão abriu.
  const idAtiva = paginaAtiva() ?? session?.profile.id ?? null;
  const limite = plano?.limits.paginas ?? null;
  const total = paginas?.length ?? 0;
  const noLimite = limite !== null && total >= limite;

  // O editor da página é quem a torna a ativa do painel, ao abrir.
  const editar = (pagina: ApiProfile) => router.push(`/paginas/${pagina.id}`);

  const copiar = async (pagina: ApiProfile) => {
    try {
      await navigator.clipboard.writeText(urlDaPagina(pagina.host, pagina.slug));
      toast.success("Link copiado.");
    } catch {
      toast.error("Não foi possível copiar.");
    }
  };

  return (
    <Tela>
      <CabecalhoDeTela
        titulo="Páginas"
        descricao={
          paginas === null
            ? "Carregando…"
            : limite === null
              ? `${total} ${total === 1 ? "página" : "páginas"}`
              : `${total} de ${limite} ${limite === 1 ? "página" : "páginas"}`
        }
        acoes={
          <button
            onClick={() => (noLimite ? avisarPro("Mais de uma página") : setCriando(true))}
            className="flex items-center gap-2 h-10 px-4 rounded-lg bg-bee-pink hover:bg-bee-pink-hot text-white text-sm font-semibold transition-colors"
          >
            <Plus className="w-4 h-4" />
            Nova página
            {noLimite && <SeloPro className="bg-white/20 text-white border-white/30" />}
          </button>
        }
      />

      {paginas === null ? (
        <EsqueletoDeCartoes />
      ) : (
        <motion.div variants={LISTA} initial="initial" animate="animate" className="grid gap-5 md:grid-cols-2">
          {paginas.map((pagina) => (
            <motion.div key={pagina.id} variants={CARTAO_DA_GRADE}>
              <CartaoDePagina
                pagina={pagina}
                ativa={pagina.id === idAtiva}
                onEditar={() => editar(pagina)}
                onCopiar={() => copiar(pagina)}
                onApagar={() => setApagando(pagina)}
              />
            </motion.div>
          ))}
        </motion.div>
      )}

      <NovaPagina
        aberto={criando}
        ehPro={ehPro}
        onFechar={() => setCriando(false)}
        onCriada={(nova) => editar(nova)}
      />
      <ApagarPagina
        pagina={apagando}
        onFechar={() => setApagando(null)}
        onApagada={(id) => {
          setPaginas((atual) => atual?.filter((p) => p.id !== id) ?? null);
          // Apagou a ativa: volta para a da sessão, senão o painel inteiro
          // passaria a mandar o id de uma página que não existe mais.
          if (id === paginaAtiva()) {
            definirPaginaAtiva(null);
            invalidateSession();
          }
        }}
      />
    </Tela>
  );
}

function CartaoDePagina({
  pagina,
  ativa,
  onEditar,
  onCopiar,
  onApagar,
}: {
  pagina: ApiProfile;
  ativa: boolean;
  onEditar: () => void;
  onCopiar: () => void;
  onApagar: () => void;
}) {
  // A miniatura usa as mesmas regras de cor da página pública.
  const visual = useMemo(
    () =>
      resolverVisual({
        templateId: pagina.template?.templateId,
        themeId: pagina.themeId,
        buttonStyle: pagina.buttonStyle,
        bgColor: pagina.template?.bgColor,
        accentColor: pagina.template?.accentColor,
        fontId: pagina.template?.fontId,
      }),
    [pagina],
  );

  return (
    <div
      className={cn(
        "h-full rounded-2xl border overflow-hidden bg-bee-surface transition-[border-color,transform,box-shadow] duration-200 ease-[cubic-bezier(0.2,0,0,1)]",
        "hover:-translate-y-0.5 hover:shadow-[0_12px_32px_rgba(0,0,0,0.35)]",
        ativa ? "border-bee-pink/50" : "border-white/[0.08] hover:border-white/20",
      )}
    >
      {/* Miniatura */}
      <button
        onClick={onEditar}
        className="relative block w-full h-44 px-8 pt-8 text-center"
        style={{ background: visual.bg }}
        aria-label={`Editar ${pagina.displayName}`}
      >
        <div className="text-sm font-semibold text-white truncate">{pagina.displayName}</div>
        <div className="mt-5 space-y-2.5">
          {[0.55, 0.35, 0.22].map((opacidade) => (
            <div
              key={opacidade}
              className="h-6 rounded-md"
              style={{ background: visual.accent, opacity: opacidade }}
            />
          ))}
        </div>
        {ativa && (
          <span className="absolute top-3 left-3 px-2 py-0.5 rounded-md text-[10px] font-semibold tracking-wider bg-black/40 text-white border border-white/15">
            EDITANDO
          </span>
        )}
      </button>

      {/* Dados e ações */}
      <div className="p-5">
        <div className="text-[15px] font-medium text-white truncate">{pagina.displayName}</div>
        <div className="mt-2.5 flex items-center gap-2 min-w-0">
          <span className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/10 bg-bee-bg/60 font-mono text-xs text-white/85 flex-shrink-0">
            <span
              className={cn(
                "w-1.5 h-1.5 rounded-full",
                pagina.published ? "bg-emerald-400" : "bg-white/30",
              )}
              title={pagina.published ? "No ar" : "Fora do ar"}
            />
            {pagina.host}
          </span>
          <span className="font-mono text-xs text-bee-muted truncate">/{pagina.slug}</span>
        </div>

        <div className="mt-4 pt-4 border-t border-white/[0.06] flex items-center gap-2">
          <button
            onClick={onCopiar}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full border border-white/15 text-sm text-white/85 hover:border-white/30 transition-colors"
          >
            <Copy className="w-3.5 h-3.5" />
            Copiar link
          </button>
          <button
            onClick={onEditar}
            className="px-5 py-2 rounded-full bg-white text-bee-bg text-sm font-semibold hover:bg-white/90 transition-colors"
          >
            Editar
          </button>
          <div className="ml-auto flex items-center gap-2">
            <a
              href={urlDaPagina(pagina.host, pagina.slug)}
              target="_blank"
              rel="noreferrer"
              title="Abrir a página"
              className="w-9 h-9 rounded-full border border-white/10 flex items-center justify-center text-white/60 hover:text-white hover:border-white/30 transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
            <button
              onClick={onApagar}
              title="Apagar a página"
              className="w-9 h-9 rounded-full border border-white/10 flex items-center justify-center text-white/60 hover:text-red-400 hover:border-red-400/40 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function NovaPagina({
  aberto,
  ehPro,
  onFechar,
  onCriada,
}: {
  aberto: boolean;
  ehPro: boolean;
  onFechar: () => void;
  onCriada: (pagina: ApiProfile) => void;
}) {
  const [nome, setNome] = useState("");
  const [slug, setSlug] = useState("");
  const [salvando, setSalvando] = useState(false);

  const criar = async (e: React.FormEvent) => {
    e.preventDefault();
    const limpo = slug.trim() || slugify(nome);
    if (!nome.trim() || !validateSlug(limpo)) {
      toast.error("Dê um nome e um endereço de 3 a 30 letras, números ou hífen.");
      return;
    }
    setSalvando(true);
    try {
      onCriada(
        await api.createProfile({
          displayName: nome.trim(),
          slug: limpo,
          // O Free só tem o Clássico; o modelo se troca depois, no editor.
          templateId: TEMPLATE_DO_FREE,
        }),
      );
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : "Não foi possível criar a página.");
      setSalvando(false);
    }
  };

  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && onFechar()}>
      <DialogContent className="bg-bee-surface border-white/10 max-w-md">
        <DialogTitle className="text-white">Nova página</DialogTitle>
        <form onSubmit={criar} className="space-y-3 mt-2">
          <input
            value={nome}
            onChange={(e) => {
              setNome(e.target.value);
              // O endereço acompanha o nome até a criadora mexer nele.
              if (!slug || slug === slugify(nome)) setSlug(slugify(e.target.value));
            }}
            placeholder="Nome da página"
            autoFocus
            className="w-full h-11 px-3 rounded-lg bg-bee-bg border border-white/10 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-bee-pink/50"
          />
          {/* Sem domínio na frente: a página nova recebe um domínio sorteado. */}
          <label className="flex items-center gap-1 h-11 px-3 rounded-lg bg-bee-bg border border-white/10 focus-within:border-bee-pink/50">
            <span className="text-sm text-white/35">/</span>
            <input
              value={slug}
              onChange={(e) => setSlug(slugify(e.target.value))}
              placeholder="endereco"
              className="flex-1 min-w-0 bg-transparent text-sm text-white placeholder:text-white/30 focus:outline-none"
            />
          </label>
          {!ehPro && (
            <p className="text-xs text-bee-muted">
              A página nasce com o modelo Clássico. Outros modelos são do plano Pro.
            </p>
          )}
          <button
            type="submit"
            disabled={salvando}
            className="w-full h-11 rounded-lg bg-bee-pink hover:bg-bee-pink-hot text-white text-sm font-semibold transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {salvando && <Loader2 className="w-4 h-4 animate-spin" />}
            Criar página
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Apagar é para sempre e leva links e cliques junto, então a criadora digita o
 * endereço para confirmar.
 */
function ApagarPagina({
  pagina,
  onFechar,
  onApagada,
}: {
  pagina: ApiProfile | null;
  onFechar: () => void;
  onApagada: (id: string) => void;
}) {
  const [confirmacao, setConfirmacao] = useState("");
  const [apagando, setApagando] = useState(false);
  // O diálogo fecha com animação; o nome continua visível até o fim dela.
  const exibida = useUltimo(pagina);

  useEffect(() => setConfirmacao(""), [pagina]);

  const apagar = async () => {
    if (!pagina || confirmacao !== pagina.slug) return;
    setApagando(true);
    try {
      await api.deleteProfile(pagina.id);
      onApagada(pagina.id);
      toast.success("Página apagada.");
      onFechar();
    } catch (caught) {
      // A API recusa apagar a última página e explica por quê.
      toast.error(caught instanceof ApiError ? caught.message : "Não foi possível apagar.");
    } finally {
      setApagando(false);
    }
  };

  return (
    <Dialog open={pagina !== null} onOpenChange={(v) => !v && onFechar()}>
      <DialogContent className="bg-bee-surface border-white/10 max-w-md">
        <DialogTitle className="text-white">Apagar {exibida?.displayName}?</DialogTitle>
        <p className="text-sm text-bee-muted">
          Os links e o histórico de cliques desta página somem junto, e não dá para desfazer. Se
          quiser só tirar do ar, desligue "Página no ar" no editor da página. Para confirmar, digite{" "}
          <span className="font-mono text-white">{exibida?.slug}</span>.
        </p>
        <input
          value={confirmacao}
          onChange={(e) => setConfirmacao(e.target.value)}
          placeholder={exibida?.slug}
          className="w-full h-11 px-3 rounded-lg bg-bee-bg border border-white/10 font-mono text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-red-400/50"
        />
        <button
          onClick={apagar}
          disabled={!pagina || confirmacao !== pagina.slug || apagando}
          className="w-full h-11 rounded-lg bg-red-500/90 hover:bg-red-500 text-white text-sm font-semibold transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
        >
          {apagando && <Loader2 className="w-4 h-4 animate-spin" />}
          Apagar para sempre
        </button>
      </DialogContent>
    </Dialog>
  );
}
