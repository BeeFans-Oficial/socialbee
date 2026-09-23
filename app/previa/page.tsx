"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast, Toaster } from "sonner";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  Copy,
  ExternalLink,
  ImagePlus,
  Info,
  RefreshCw,
  Trash2,
} from "lucide-react";

import { api, ApiError } from "@/lib/api/client";
import { invalidateSession, useSession } from "@/lib/api/use-session";
import { clientOrigin, siteHost } from "@/lib/site";
import { cn } from "@/lib/utils";

/**
 * Prévia: os dois documentos que a mesma URL entrega.
 *
 * A tela mostra o caminho inteiro da fã que vem do Instagram, na ordem em que
 * ele acontece: ela cai na **página de chegada**, dentro do navegador embutido
 * do aplicativo; de lá o escape a leva para a **página real**, num navegador de
 * verdade. Os dois quadros lado a lado com a seta no meio são essa passagem.
 *
 * Nenhum dos dois é simulação: cada quadro é um `<iframe>` para a rota de
 * verdade, forçada pelo parâmetro `?preview=` — que só funciona para quem está
 * logado (a trava está em `app/[slug]/page.tsx`). O que aparece aqui é byte a
 * byte o que a visitante recebe. É a propriedade que faz esta tela valer mais
 * do que um desenho, e vale preservá-la em qualquer mudança.
 *
 * O painel da direita edita a página de chegada. Ele grava pela API e recarrega
 * os quadros — a prévia continua refletindo o que está no ar, nunca um rascunho
 * que só existe nesta tela.
 */

type Lado = "chegada" | "pagina";

export default function PreviaPage() {
  const router = useRouter();
  const { session, loading, error } = useSession();

  const [recarga, setRecarga] = useState(0);
  const [foco, setFoco] = useState<Lado | null>(null);

  // Formulário da página de chegada.
  const [ligada, setLigada] = useState(false);
  const [imagem, setImagem] = useState<string | null>(null);
  const [titulo, setTitulo] = useState("");
  const [rotuloBotao, setRotuloBotao] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [copiado, setCopiado] = useState(false);

  const slug = session?.profile.slug ?? "";
  const nome = session?.profile.displayName ?? "";
  const host = siteHost();

  // O formulário nasce do que está gravado. `session` chega uma vez por
  // carregamento (ver `use-session`), então isto não sobrescreve digitação.
  useEffect(() => {
    if (!session) return;
    const iab = session.profile.iab;
    setLigada(iab?.enabled ?? false);
    setImagem(iab?.imageUrl ?? null);
    setTitulo(iab?.headline ?? "");
    setRotuloBotao(iab?.buttonLabel ?? "");
  }, [session]);

  if (error?.isUnauthorized) {
    router.replace("/login?de=/previa");
    return null;
  }

  /**
   * A URL de cada quadro.
   *
   * O lado da chegada é forçado por `?preview=iab`. O lado da página real NÃO
   * tem parâmetro, e isso é deliberado: `?preview=humano` não existe na rota
   * justamente para um robô não conseguir pedir a versão com links. Aqui não
   * faz falta — o navegador da criadora já é humano, então a URL nua entrega
   * exatamente o que a fã receberia.
   */
  const url = (lado: Lado) =>
    `/${slug}${lado === "chegada" ? "?preview=iab" : ""}${recarga ? `#r=${recarga}` : ""}`;

  const enderecoPublico = slug ? `${clientOrigin()}/${slug}` : "";

  const copiarEndereco = async () => {
    if (!enderecoPublico) return;
    await navigator.clipboard.writeText(enderecoPublico);
    setCopiado(true);
    toast.success("Link do seu perfil copiado!");
    setTimeout(() => setCopiado(false), 2000);
  };

  const escolherImagem = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => setImagem(reader.result as string);
    reader.readAsDataURL(file);
  };

  const salvar = async () => {
    setSalvando(true);
    try {
      await api.updateProfile({
        iabEnabled: ligada,
        iabImageUrl: imagem,
        // Campo vazio grava `null`, e não string vazia: é o que faz o título
        // cair no nome de exibição na renderização, em vez de a página de
        // chegada aparecer sem título nenhum.
        iabHeadline: titulo.trim() || null,
        iabButtonLabel: rotuloBotao.trim() || null,
      });
      // A Sidebar e esta tela leem a mesma sessão em cache; sem invalidar, o
      // próximo carregamento mostraria o estado antigo.
      invalidateSession();
      setRecarga((n) => n + 1);
      toast.success("Página de chegada salva! ✓");
    } catch (caught) {
      if (caught instanceof ApiError && caught.isUnauthorized) {
        router.replace("/login?de=/previa");
        return;
      }
      toast.error(
        caught instanceof ApiError ? caught.message : "Não foi possível salvar.",
      );
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="min-h-screen">
      <Toaster position="top-center" richColors />

      <div className="flex flex-col lg:flex-row">
        {/* ── Palco: os dois celulares ──────────────────────────────────── */}
        <div className="flex-1 px-6 py-8 lg:px-10">
          <div className="mb-8 flex items-start justify-between gap-4">
            <div>
              <h1 className="font-bebas text-[36px] uppercase tracking-widest text-white leading-none mb-1">
                PRÉVIA
              </h1>
              <p className="text-xs text-white/25 tracking-wide uppercase font-medium">
                O caminho de quem chega pelo Instagram
              </p>
            </div>
            <button
              onClick={() => setRecarga((n) => n + 1)}
              disabled={!slug}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white/60 border border-white/10 hover:text-white hover:border-white/20 transition-all disabled:opacity-40"
            >
              <RefreshCw className="w-4 h-4" />
              Recarregar
            </button>
          </div>

          {loading ? (
            <div className="py-20 text-center text-bee-muted text-sm">Carregando…</div>
          ) : (
            <div className="flex flex-col xl:flex-row items-center justify-center gap-6">
              <Celular
                rotulo="Página de chegada"
                aviso={
                  ligada
                    ? "Visível para robôs — escolha uma imagem de baixo risco"
                    : "Desligada: quem vem do app cai direto na página real"
                }
                avisoTom={ligada ? "alerta" : "neutro"}
                url={slug ? url("chegada") : ""}
                ativo={foco !== "pagina"}
                onFoco={() => setFoco(foco === "chegada" ? null : "chegada")}
                key={`chegada-${recarga}`}
              />

              {/* A passagem de um para o outro. É o que a fã faz ao tocar no
                  botão — e o que o robô nunca faz, porque não executa JS. */}
              <div className="flex flex-col items-center gap-1.5 text-white/25">
                <ArrowRight className="w-5 h-5 rotate-90 xl:rotate-0" />
                <span className="text-[10px] uppercase tracking-[0.2em] font-medium whitespace-nowrap">
                  sai do app
                </span>
              </div>

              <Celular
                rotulo="Página real"
                aviso="O que a fã vê depois de sair do aplicativo"
                avisoTom="neutro"
                url={slug ? url("pagina") : ""}
                ativo={foco !== "chegada"}
                onFoco={() => setFoco(foco === "pagina" ? null : "pagina")}
                key={`pagina-${recarga}`}
              />
            </div>
          )}

          <div className="mt-8 max-w-2xl mx-auto flex gap-3 rounded-xl bg-bee-pink/[0.06] border border-bee-pink/15 p-4">
            <Info className="w-4 h-4 text-bee-pink flex-shrink-0 mt-0.5" />
            <p className="text-xs text-white/50 leading-relaxed">
              Com a página de chegada ligada, <span className="text-white/80 font-medium">robô
              e fã recebem o mesmo documento</span>. A diferença é que o navegador dela
              executa JavaScript e sai dali para a página real; o robô não executa, e fica.
              Nada é servido com base em quem pediu.
            </p>
          </div>
        </div>

        {/* ── Painel ────────────────────────────────────────────────────── */}
        <aside className="w-full lg:w-[360px] lg:min-h-screen border-t lg:border-t-0 lg:border-l border-white/[0.06] bg-white/[0.015] px-6 py-8">
          <div className="text-[11px] uppercase tracking-wider text-white/30 font-medium mb-2">
            Sua página
          </div>
          <div className="flex items-center gap-2 mb-3">
            <code className="flex-1 truncate text-sm text-white/70 font-mono">
              {enderecoPublico || "—"}
            </code>
            <button
              onClick={copiarEndereco}
              disabled={!slug}
              title={`Copiar ${enderecoPublico}`}
              className="p-2 rounded-lg text-white/40 hover:text-bee-pink hover:bg-bee-pink/[0.08] transition-all disabled:opacity-30"
            >
              {copiado ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
          <a
            href={slug ? `/${slug}` : "#"}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border border-white/10 text-sm font-medium text-white/70 hover:text-white hover:border-white/20 transition-all"
          >
            <ExternalLink className="w-4 h-4" />
            Abrir numa aba
          </a>

          <div className="mt-8 mb-4 text-[11px] uppercase tracking-wider text-white/30 font-medium">
            Página de chegada
          </div>

          <label className="flex items-start gap-3 p-3 rounded-xl border border-white/10 cursor-pointer hover:border-white/20 transition-all">
            <input
              type="checkbox"
              checked={ligada}
              onChange={(e) => setLigada(e.target.checked)}
              className="mt-0.5 accent-bee-pink"
            />
            <span>
              <span className="block text-sm font-medium text-white">Ligada</span>
              <span className="block text-[11px] text-white/35 leading-relaxed mt-0.5">
                Quem vem de dentro de um aplicativo — e os robôs — recebem esta página
                antes do seu perfil.
              </span>
            </span>
          </label>

          {/* Imagem */}
          <div className="mt-5">
            <div className="text-xs text-white/40 mb-2">Imagem</div>
            {imagem ? (
              <div className="relative rounded-xl overflow-hidden border border-white/10">
                {/* eslint-disable-next-line @next/next/no-img-element -- data URL
                    local, antes de existir no servidor; `next/image` não otimiza. */}
                <img src={imagem} alt="" className="w-full h-36 object-cover" />
                <button
                  onClick={() => setImagem(null)}
                  className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/60 text-white/70 hover:text-white transition-colors"
                  title="Remover imagem"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center gap-2 h-36 rounded-xl border border-dashed border-white/15 cursor-pointer hover:border-white/30 transition-all">
                <ImagePlus className="w-5 h-5 text-white/30" />
                <span className="text-xs text-white/35">Escolher imagem</span>
                <input type="file" accept="image/*" onChange={escolherImagem} className="hidden" />
              </label>
            )}
            <div className="flex gap-2 mt-2">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400/70 flex-shrink-0 mt-0.5" />
              <p className="text-[11px] text-white/35 leading-relaxed">
                É a imagem que o robô da rede social vê. Escolha uma que passe por
                qualquer revisão — a sua página real continua sendo sua.
              </p>
            </div>
          </div>

          {/* Textos */}
          <div className="mt-5">
            <label className="block text-xs text-white/40 mb-1.5">Título</label>
            <input
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              maxLength={60}
              placeholder={nome || "Seu nome"}
              className="w-full px-3 py-2.5 rounded-xl bg-white/[0.03] border border-white/10 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-bee-pink/40 transition-colors"
            />
            <p className="text-[11px] text-white/25 mt-1">Vazio usa seu nome de exibição.</p>
          </div>

          <div className="mt-4">
            <label className="block text-xs text-white/40 mb-1.5">Texto do botão</label>
            <input
              value={rotuloBotao}
              onChange={(e) => setRotuloBotao(e.target.value)}
              maxLength={40}
              placeholder={nome ? `Continuar para ${nome}` : "Continuar"}
              className="w-full px-3 py-2.5 rounded-xl bg-white/[0.03] border border-white/10 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-bee-pink/40 transition-colors"
            />
          </div>

          <button
            onClick={salvar}
            disabled={salvando || !slug}
            className="mt-6 w-full py-3 rounded-xl bg-bee-pink text-white text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-40"
          >
            {salvando ? "Salvando…" : "Salvar"}
          </button>

          <div className="mt-8">
            <div className="text-[11px] uppercase tracking-wider text-white/30 font-medium mb-2">
              Como o link aparece compartilhado
            </div>
            <div className="rounded-xl overflow-hidden border border-white/10 bg-bee-surface">
              <div className="h-24 bg-gradient-to-br from-bee-pink/20 to-bee-pink/5 flex items-center justify-center">
                <span className="font-bebas text-xl text-white/40 uppercase tracking-widest">
                  {host}
                </span>
              </div>
              <div className="p-3">
                <div className="text-[10px] uppercase tracking-wider text-white/30">{host}</div>
                <div className="text-sm font-semibold text-white truncate mt-0.5">
                  {nome || "—"}
                </div>
                <div className="text-xs text-white/40 truncate">
                  Todos os links de @{slug || "voce"} em um só lugar.
                </div>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

/**
 * Um celular com a página real dentro.
 *
 * A moldura existe para a prévia ter a proporção de onde a página é vista de
 * verdade — celular, sempre. O `sandbox` sem `allow-top-navigation` é o que
 * impede um link de dentro da prévia de sequestrar a aba do painel.
 */
function Celular({
  rotulo,
  aviso,
  avisoTom,
  url,
  ativo,
  onFoco,
}: {
  rotulo: string;
  aviso: string;
  avisoTom: "alerta" | "neutro";
  url: string;
  ativo: boolean;
  onFoco: () => void;
}) {
  return (
    <div className={cn("transition-opacity duration-300", ativo ? "opacity-100" : "opacity-25")}>
      <button
        onClick={onFoco}
        className="block w-full text-center text-[11px] uppercase tracking-[0.25em] text-white/40 hover:text-white/70 transition-colors mb-3"
      >
        {rotulo}
      </button>

      <div
        className={cn(
          "mx-auto mb-3 w-[300px] flex items-start gap-1.5 px-3 py-2 rounded-xl text-[11px] leading-snug",
          avisoTom === "alerta"
            ? "bg-amber-400/10 text-amber-200/90 border border-amber-400/20"
            : "bg-white/[0.04] text-white/35 border border-white/[0.06]",
        )}
      >
        {avisoTom === "alerta" && (
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-px" />
        )}
        <span>{aviso}</span>
      </div>

      <div className="relative">

        {/* Moldura */}
        <div className="relative w-[300px] h-[600px] rounded-[38px] border-[6px] border-white/10 bg-black shadow-2xl overflow-hidden">
          {/* Entalhe da câmera, que é o que faz o olho ler "celular". */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-5 rounded-b-2xl bg-black z-10" />
          {url ? (
            <iframe
              src={url}
              title={rotulo}
              className="w-full h-full"
              sandbox="allow-scripts allow-same-origin"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-white/20 text-xs">
              sem perfil
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
