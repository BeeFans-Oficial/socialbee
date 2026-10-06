"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  ImagePlus,
  Pencil,
  X,
  Copy,
  ExternalLink,
  Eye,
  Link2,
  List,
  Loader2,
  Palette,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { toast, Toaster } from "sonner";

import {
  Aviso,
  CampoDeTexto,
  Grupo,
  Linha,
  MolduraDeCelular,
  FUNDO_DO_PAINEL,
  Opcao,
  OpcaoLigavel,
  Secao,
} from "@/components/editor/Painel";
import { CeuEstrelado } from "@/components/landing/CeuEstrelado";
import { SeloPro, avisarPro } from "@/components/shared/SeloPro";
import { api, ApiError, definirPaginaAtiva } from "@/lib/api/client";
import { invalidateSession, usePlano } from "@/lib/api/use-session";
import type { ApiDomain, ApiProfile, ProfileInput } from "@/lib/api/types";
import { THEMES } from "@/lib/catalog";
import { urlDaPagina } from "@/lib/site";
import { TEMPLATES, TEMPLATE_DO_FREE, resolverVisual } from "@/lib/templates";
import { cn, slugify, validateSlug } from "@/lib/utils";

type Lado = "chegada" | "pagina";

/**
 * Editor de uma página: a prévia no celular à esquerda, as configurações à
 * direita.
 *
 * Abrir o editor torna esta página a ATIVA do painel (`x-profile-id`): é o que
 * faz o `PATCH /me/profile` cair nela, e o que deixa Links e Aparência, a um
 * clique daqui, editando a mesma página.
 *
 * Cada ajuste salva sozinho — ao sair do campo, ao trocar uma opção — e a
 * prévia recarrega em seguida. Não há botão "Salvar" para esquecer.
 *
 * A prévia não é simulação: é um `<iframe>` para a rota pública de verdade,
 * com `?preview=iab` no lado da página de chegada — o parâmetro só vale com
 * sessão (ver `app/[slug]/page.tsx`).
 */
export default function EditorDePagina() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { ehPro } = usePlano();

  const [pagina, setPagina] = useState<ApiProfile | null>(null);
  const [dominios, setDominios] = useState<ApiDomain[]>([]);
  const [lado, setLado] = useState<Lado>("pagina");
  const [recarga, setRecarga] = useState(0);
  const [salvando, setSalvando] = useState(false);

  /**
   * Enquadramento da foto enquanto a criadora mexe nas setas.
   *
   * Cada clique muda só este estado e o `object-position` da imagem DENTRO do
   * iframe (mesma origem, então o editor alcança o documento da prévia). Nada
   * recarrega. O valor vai para a API uma vez, quando ela para de clicar —
   * salvar e recarregar a cada clique fazia a prévia inteira piscar.
   */
  const [posicaoLocal, setPosicaoLocal] = useState<number | null>(null);

  /**
   * Onde está a área da capa DENTRO da prévia, em px a partir do topo da tela
   * do iPhone. Os controles da foto ficam numa camada por cima do iframe; sem
   * isto eles ficavam parados enquanto a página rolava por baixo deles.
   */
  const [areaDaCapa, setAreaDaCapa] = useState<{ top: number; height: number } | null>(null);
  const acompanharCapa = useCallback(() => {
    const janela = previa.current?.contentWindow;
    if (!janela) return;
    const medir = () => {
      const el = janela.document.querySelector("[data-capa-area]");
      if (!el) return setAreaDaCapa(null);
      const r = el.getBoundingClientRect();
      setAreaDaCapa({ top: r.top, height: r.height });
    };
    medir();
    // A janela é nova a cada recarga do iframe, então os ouvintes antigos vão
    // embora com ela — não há o que remover.
    janela.addEventListener("scroll", medir, { passive: true });
    janela.addEventListener("resize", medir);
  }, []);
  const previa = useRef<HTMLIFrameElement>(null);
  const esperaDoEnquadramento = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (esperaDoEnquadramento.current) clearTimeout(esperaDoEnquadramento.current);
  }, []);

  useEffect(() => {
    definirPaginaAtiva(id);
    invalidateSession();

    Promise.all([api.profile(), api.domains().catch(() => [])])
      .then(([perfil, lista]) => {
        // Página de outra conta (ou apagada): o servidor ignora o cabeçalho e
        // devolve a página da sessão. Não é a pedida — volta para a lista.
        if (perfil.id !== id) {
          definirPaginaAtiva(null);
          toast.error("Página não encontrada.");
          router.replace("/paginas");
          return;
        }
        setPagina(perfil);
        setDominios(lista);
      })
      .catch((caught) => {
        if (caught instanceof ApiError && caught.isUnauthorized) {
          router.replace(`/login?de=/paginas/${id}`);
          return;
        }
        toast.error("Não foi possível abrir a página.");
      });
  }, [id, router]);

  /** Salva um pedaço da página e recarrega a prévia. Devolve se deu certo,
   *  para o campo voltar ao valor anterior quando a API recusa. */
  /**
   * Salva um pedaço da página. Por padrão recarrega a prévia em seguida;
   * `recarregar: false` é para o que a prévia já mostra sem recarregar (o
   * enquadramento da foto, aplicado direto na imagem dentro do iframe).
   */
  const salvar = useCallback(async (
    input: ProfileInput,
    { recarregar = true }: { recarregar?: boolean } = {},
  ): Promise<boolean> => {
    setSalvando(true);
    try {
      const atualizada = await api.updateProfile(input);
      setPagina(atualizada);
      if (recarregar) setRecarga((r) => r + 1);
      invalidateSession();
      return true;
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : "Não foi possível salvar.");
      return false;
    } finally {
      setSalvando(false);
    }
  }, []);

  if (!pagina) {
    return (
      <div className="min-h-screen bg-bee-bg flex items-center justify-center text-bee-muted">
        <Toaster position="top-center" richColors />
        <Loader2 className="w-5 h-5 animate-spin" />
      </div>
    );
  }

  const endereco = urlDaPagina(pagina.host, pagina.slug);
  const visual = resolverVisual({
    templateId: pagina.template?.templateId,
    themeId: pagina.themeId,
    buttonStyle: pagina.buttonStyle,
    bgColor: pagina.template?.bgColor,
    accentColor: pagina.template?.accentColor,
    fontId: pagina.template?.fontId,
    coverUrl: pagina.coverUrl,
    coverPosY: pagina.template?.coverPosY,
  });
  const posicaoY = posicaoLocal ?? pagina.template?.coverPosY ?? 50;
  /** Os controles da foto aparecem sobre a prévia da página, quando o modelo
   *  usa foto de capa. Com foto: setas, trocar e remover. Sem: adicionar. */
  const mostraControlesDaFoto =
    lado === "pagina" &&
    pagina.published &&
    visual.capa !== "nenhuma" &&
    areaDaCapa !== null &&
    // Some quando a capa já rolou para fora da tela.
    areaDaCapa.top + areaDaCapa.height > 70;
  /** Ponto da área da capa, em px, onde um controle deve ficar (0 a 1). */
  const naCapa = (fracao: number) =>
    areaDaCapa ? Math.round(areaDaCapa.top + areaDaCapa.height * fracao) : 0;
  /** Abaixo disto o controle ficaria sob a Dynamic Island — some antes. */
  const TOPO_LIVRE = 56;
  const topoSetas = naCapa(visual.capa === "faixa" ? 0.2 : 0.3);
  const topoAcoes = naCapa(visual.capa === "faixa" ? 0.62 : 0.72);
  const temFoto = Boolean(pagina.coverUrl);
  const escolherCapa = (e: React.ChangeEvent<HTMLInputElement>) => {
    const arquivo = e.target.files?.[0];
    e.target.value = "";
    if (!arquivo) return;
    if (arquivo.size > LIMITE_DA_IMAGEM) {
      toast.error("Imagem muito grande. Use um arquivo de até 1,4 MB.");
      return;
    }
    const leitor = new FileReader();
    leitor.onloadend = () => void salvar({ coverUrl: leitor.result as string, coverPosY: 50 });
    leitor.readAsDataURL(arquivo);
  };
  /** Sobe ou desce o enquadramento da foto de capa (`object-position` Y). */
  const centralizar = (passo: number) => {
    const novo = Math.min(100, Math.max(0, posicaoY + passo));
    if (novo === posicaoY) return;
    setPosicaoLocal(novo);

    const x = pagina.template?.coverPosX ?? 50;
    const enquadrar = (y: number) =>
      previa.current?.contentDocument
        ?.querySelectorAll<HTMLImageElement>("img[data-capa]")
        .forEach((img) => {
          img.style.objectPosition = `${x}% ${y}%`;
        });
    enquadrar(novo);

    if (esperaDoEnquadramento.current) clearTimeout(esperaDoEnquadramento.current);
    const salvo = pagina.template?.coverPosY ?? 50;
    esperaDoEnquadramento.current = setTimeout(async () => {
      const ok = await salvar({ coverPosY: novo }, { recarregar: false });
      // Falhou: a prévia volta ao que está gravado, para não mostrar um
      // enquadramento que a fã não vai ver.
      if (!ok) enquadrar(salvo);
      setPosicaoLocal(null);
    }, 600);
  };

  return (
    <div className="min-h-screen bg-bee-bg flex flex-col-reverse lg:flex-row">
      <Toaster position="top-center" richColors />

      {/* ── Prévia ─────────────────────────────────────────────────────── */}
      <section className="relative flex-1 min-h-[760px] lg:min-h-screen flex flex-col items-center px-4 py-8 overflow-hidden">
        <CeuEstrelado />

        <div className="relative z-10 flex p-1 rounded-full bg-white/[0.06] border border-white/10 backdrop-blur">
          {(
            [
              ["chegada", "Página de chegada"],
              ["pagina", "Página"],
            ] as const
          ).map(([valor, rotulo]) => (
            <button
              key={valor}
              onClick={() => setLado(valor)}
              className={cn(
                "px-4 py-1.5 rounded-full text-sm font-medium transition-colors",
                lado === valor ? "bg-bee-pink text-white" : "text-white/60 hover:text-white",
              )}
            >
              {rotulo}
            </button>
          ))}
        </div>

        <MolduraDeCelular>
          {!pagina.published ? (
            <div className="w-full h-full flex items-center justify-center px-8 text-center text-sm text-white/40">
              A página está fora do ar. Coloque no ar para ver a prévia.
            </div>
          ) : lado === "chegada" && !pagina.iab.enabled ? (
            <div className="w-full h-full flex items-center justify-center px-8 text-center text-sm text-white/40">
              A saída do Instagram está em Manual: a fã vai direto para a página, sem página de
              chegada.
            </div>
          ) : (
            <iframe
              ref={previa}
              onLoad={acompanharCapa}
              // `key` força recarregar depois de cada salvamento.
              key={`${lado}-${recarga}`}
              src={`/${pagina.slug}?preview=${lado === "chegada" ? "iab" : "pagina"}`}
              title={lado === "chegada" ? "Página de chegada" : "Página"}
              className="w-full h-full"
              // `allow-top-navigation-by-user-activation`: o "Adicionar link" da
              // prévia abre o editor de link na janela do painel — só com
              // clique de verdade, nunca por script da página.
              sandbox="allow-scripts allow-same-origin allow-top-navigation-by-user-activation"
            />
          )}
          {mostraControlesDaFoto && temFoto && (
            <>
              {topoSetas >= TOPO_LIVRE && (
              <div
                className="absolute right-3 z-30 flex flex-col items-center w-8 py-1 rounded-full bg-black/35 backdrop-blur-md"
                style={{ top: topoSetas }}
              >
                <button
                  onClick={() => centralizar(-10)}
                  aria-label="Mostrar mais do topo da foto"
                  title="Subir a foto"
                  className="w-8 h-7 flex items-center justify-center text-white/90 hover:text-white transition-colors"
                >
                  <ChevronUp className="w-3.5 h-3.5" strokeWidth={2.5} />
                </button>
                <button
                  onClick={() => centralizar(10)}
                  aria-label="Mostrar mais da base da foto"
                  title="Descer a foto"
                  className="w-8 h-7 flex items-center justify-center text-white/90 hover:text-white transition-colors"
                >
                  <ChevronDown className="w-3.5 h-3.5" strokeWidth={2.5} />
                </button>
              </div>
              )}
              {topoAcoes >= TOPO_LIVRE && (
              <div
                className="absolute right-3 z-30 flex gap-1.5"
                style={{ top: topoAcoes }}
              >
                <label
                  title="Trocar a foto"
                  className="w-7 h-7 rounded-full bg-black/35 backdrop-blur-md flex items-center justify-center text-white/90 hover:text-white cursor-pointer transition-colors"
                >
                  <Pencil className="w-3 h-3" strokeWidth={2.5} />
                  <input type="file" accept="image/*" onChange={escolherCapa} className="hidden" />
                </label>
                <button
                  onClick={() => salvar({ coverUrl: null })}
                  aria-label="Remover a foto"
                  title="Remover a foto"
                  className="w-7 h-7 rounded-full bg-black/35 backdrop-blur-md flex items-center justify-center text-white/90 hover:text-white transition-colors"
                >
                  <X className="w-3.5 h-3.5" strokeWidth={2.5} />
                </button>
              </div>
              )}
            </>
          )}
          {mostraControlesDaFoto && !temFoto && (
            <label
              className="absolute left-1/2 -translate-x-1/2 z-30 flex items-center gap-1.5 whitespace-nowrap px-3.5 py-2 rounded-full bg-black/35 backdrop-blur-md text-xs text-white/90 hover:text-white cursor-pointer transition-colors"
              style={{ top: naCapa(visual.capa === "faixa" ? 0.3 : 0.4) }}
            >
              <ImagePlus className="w-3.5 h-3.5" />
              Adicionar foto de capa
              <input type="file" accept="image/*" onChange={escolherCapa} className="hidden" />
            </label>
          )}
        </MolduraDeCelular>
      </section>

      {/* ── Painel ─────────────────────────────────────────────────────── */}
      <aside
        className={cn(
          "w-full lg:w-[380px] lg:h-screen lg:sticky lg:top-0 lg:overflow-y-auto sem-barra border-l border-white/[0.07] pb-10",
          FUNDO_DO_PAINEL,
        )}
      >
        <div className="h-16 px-4 flex items-center gap-3 border-b border-white/[0.07]">
          <Link
            href="/paginas"
            aria-label="Voltar às páginas"
            className="w-9 h-9 rounded-lg border border-white/10 flex items-center justify-center text-white/70 hover:text-white hover:border-white/25 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <span className="flex-1 text-[15px] font-semibold text-white truncate">
            {pagina.displayName}
          </span>
          {salvando && <Loader2 className="w-4 h-4 text-white/40 animate-spin" />}
        </div>

        <div className="px-4 py-4 border-b border-white/[0.07]">
          <div className="flex items-center gap-2">
            <span className="flex-1 font-mono text-[13px] text-white/80 truncate">{endereco}</span>
            <button
              onClick={async () => {
                await navigator.clipboard.writeText(endereco);
                toast.success("Link copiado.");
              }}
              aria-label="Copiar link"
              className="p-1.5 text-white/50 hover:text-white transition-colors"
            >
              <Copy className="w-4 h-4" />
            </button>
          </div>
          <div className="mt-3 flex gap-2">
            <a
              href={endereco}
              target="_blank"
              rel="noreferrer"
              className="flex-1 flex items-center justify-center gap-2 h-11 rounded-xl bg-white text-[#0d1119] text-[15px] font-semibold hover:bg-white/90 transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              Ver página
            </a>
            <Link
              href="/links"
              title="Links da página"
              className="w-11 h-11 rounded-xl border border-white/10 flex items-center justify-center text-white/70 hover:text-white hover:border-white/25 transition-colors"
            >
              <Link2 className="w-4 h-4" />
            </Link>
            <Link
              href="/aparencia"
              title="Aparência"
              className="w-11 h-11 rounded-xl border border-white/10 flex items-center justify-center text-white/70 hover:text-white hover:border-white/25 transition-colors"
            >
              <Palette className="w-4 h-4" />
            </Link>
          </div>
        </div>

        <Secao titulo="Link">
          <CampoDeTexto
            rotulo="Nome da página"
            valor={pagina.displayName}
            maxLength={60}
            onSalvar={(v) => (v.trim() ? salvar({ displayName: v.trim() }) : Promise.resolve(false))}
          />
          <Linha rotulo="Domínio">
            <SeletorDeDominio
              pagina={pagina}
              dominios={dominios}
              ehPro={ehPro}
              onEscolher={(domainId) => salvar({ domainId })}
            />
          </Linha>
          <CampoDeEndereco slug={pagina.slug} onSalvar={(slug) => salvar({ slug })} />
        </Secao>

        <Secao titulo="Proteção">
          <Grupo
            titulo="Sair do Instagram"
            info="Leva a fã do navegador embutido do Instagram para o navegador do celular, onde pagamento e login funcionam."
            nota={
              pagina.iab.enabled
                ? "Automático tira a fã do navegador do Instagram antes de ela chegar na sua página."
                : "Manual abre a página direto, dentro do Instagram. Pagamento e login podem falhar ali."
            }
          >
            <Opcao
              icone={<Zap className="w-3.5 h-3.5 text-amber-400" />}
              rotulo="Automático"
              ativa={pagina.iab.enabled}
              onClick={() => !pagina.iab.enabled && salvar({ iabEnabled: true })}
            />
            <Opcao
              icone={<List className="w-3.5 h-3.5 text-white/60" />}
              rotulo="Manual"
              ativa={!pagina.iab.enabled}
              onClick={() => pagina.iab.enabled && salvar({ iabEnabled: false })}
            />
          </Grupo>

          <Grupo
            titulo="Barreira de idade"
            info="Pede a confirmação de 18 anos ou mais antes de mostrar os links."
            nota="Quem visita confirma ter 18 anos ou mais antes de ver os seus links."
          >
            <OpcaoLigavel
              icone={<ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />}
              rotulo="Confirmação de 18+"
              ligada={pagina.isAdult}
              onMudar={(isAdult) => salvar({ isAdult })}
            />
          </Grupo>
        </Secao>

        <Secao titulo="Página">
          <Grupo titulo="Tema" nota={THEMES.find((t) => t.id === pagina.themeId)?.label ?? ""}>
            <div className="flex flex-wrap gap-2 px-1">
              {THEMES.map((t) => {
                const ativo = pagina.themeId === t.id;
                return (
                  <button
                    key={t.id}
                    title={t.label}
                    aria-label={`Tema ${t.label}`}
                    // Trocar de tema limpa as cores escolhidas a dedo, senão
                    // nada muda na tela e parece que quebrou.
                    onClick={() => !ativo && salvar({ themeId: t.id, bgColor: null, accentColor: null })}
                    className={cn(
                      "w-10 h-10 rounded-full transition-all",
                      ativo
                        ? "ring-2 ring-white ring-offset-2 ring-offset-[#0d1119]"
                        : "ring-1 ring-white/10 hover:ring-white/30",
                    )}
                    style={{ background: t.accent }}
                  />
                );
              })}
            </div>
          </Grupo>

          <Grupo
            titulo="Modelo"
            info="O modelo muda o layout da página inteira."
            nota={ehPro ? undefined : "No Free a página usa o Clássico. Os outros modelos são do Pro."}
          >
            <div className="grid grid-cols-3 gap-2 px-1">
              {TEMPLATES.map((t) => {
                const travado = !ehPro && t.id !== TEMPLATE_DO_FREE;
                const ativo = (pagina.template?.templateId ?? TEMPLATE_DO_FREE) === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => {
                      if (ativo) return;
                      if (travado) return avisarPro("Este modelo");
                      // O estilo de botão acompanha o modelo, como na Aparência.
                      void salvar({ templateId: t.id, buttonStyle: t.botaoPadrao });
                    }}
                    className={cn(
                      "flex items-center justify-center gap-1.5 px-2 py-2.5 rounded-xl border text-[13px] transition-colors",
                      ativo
                        ? "border-white/15 bg-black/35 text-white"
                        : "border-white/[0.07] text-white/60 hover:text-white hover:border-white/20",
                    )}
                  >
                    {t.label}
                    {travado && <SeloPro />}
                  </button>
                );
              })}
            </div>
          </Grupo>

          <Grupo
            titulo="Visibilidade"
            nota="Fora do ar, a página some para o público e tudo fica guardado."
          >
            <OpcaoLigavel
              icone={<Eye className="w-3.5 h-3.5 text-sky-400" />}
              rotulo="Página no ar"
              ligada={pagina.published}
              onMudar={(published) => salvar({ published })}
            />
          </Grupo>
        </Secao>

        {pagina.iab.enabled && (
          <Secao titulo="Página de chegada">
            <CampoDeTexto
              rotulo="Título"
              valor={pagina.iab.headline ?? ""}
              placeholder={pagina.displayName}
              maxLength={60}
              onSalvar={(v) => salvar({ iabHeadline: v.trim() || null })}
            />
            <CampoDeTexto
              rotulo="Texto do botão"
              valor={pagina.iab.buttonLabel ?? ""}
              placeholder={`Continuar para ${pagina.displayName}`}
              maxLength={40}
              onSalvar={(v) => salvar({ iabButtonLabel: v.trim() || null })}
            />
            <CampoDeImagem
              rotulo="Imagem"
              imagem={pagina.iab.imageUrl}
              padrao="/chegada-padrao.svg"
              aviso="É a imagem que o robô da rede social vê. Escolha uma que passe por qualquer revisão."
              onTrocar={(iabImageUrl) => salvar({ iabImageUrl })}
            />
          </Secao>
        )}
      </aside>
    </div>
  );
}

/**
 * O endereço (`/slug`) se edita só depois de um clique, e com aviso: trocar
 * quebra o link que já está divulgado na bio.
 */
function CampoDeEndereco({ slug, onSalvar }: { slug: string; onSalvar: (s: string) => Promise<boolean> }) {
  const [editando, setEditando] = useState(false);
  const [rascunho, setRascunho] = useState(slug);
  useEffect(() => setRascunho(slug), [slug]);

  const confirmar = async () => {
    const limpo = slugify(rascunho);
    if (limpo === slug) {
      setEditando(false);
      return;
    }
    if (!validateSlug(limpo)) {
      toast.error("Use de 3 a 30 letras, números ou hífen.");
      return;
    }
    if (await onSalvar(limpo)) setEditando(false);
  };

  if (!editando) {
    return (
      <button
        onClick={() => setEditando(true)}
        className="w-full flex items-center justify-between px-2 py-3 text-sm"
      >
        <span className="text-white/85">Endereço</span>
        <span className="flex items-center gap-1.5 font-mono text-[13px] text-white/50">
          /{slug}
          <ChevronRight className="w-4 h-4" />
        </span>
      </button>
    );
  }

  return (
    <div className="px-2 py-3">
      <div className="flex items-center gap-2">
        <span className="text-sm text-white/85 flex-shrink-0">Endereço</span>
        <span className="ml-auto font-mono text-[13px] text-white/40">/</span>
        <input
          value={rascunho}
          autoFocus
          onChange={(e) => setRascunho(slugify(e.target.value))}
          onKeyDown={(e) => {
            if (e.key === "Enter") void confirmar();
            if (e.key === "Escape") {
              setRascunho(slug);
              setEditando(false);
            }
          }}
          className="w-40 bg-white/[0.04] border border-white/10 rounded-md px-2 py-1 font-mono text-[13px] text-white focus:outline-none focus:border-bee-pink/50"
        />
        <button
          onClick={confirmar}
          className="px-2.5 py-1 rounded-md bg-bee-pink text-white text-xs font-semibold"
        >
          Salvar
        </button>
      </div>
      <Aviso>Trocar o endereço quebra o link que você já divulgou na bio.</Aviso>
    </div>
  );
}

function SeletorDeDominio({
  pagina,
  dominios,
  ehPro,
  onEscolher,
}: {
  pagina: ApiProfile;
  dominios: ApiDomain[];
  ehPro: boolean;
  onEscolher: (domainId: string | null) => Promise<boolean>;
}) {
  const pilula =
    "relative flex items-center gap-2 pl-4 pr-9 py-2.5 rounded-full border border-white/10 bg-black/40 font-mono text-[13px] text-white/90";
  const ponto = (
    <span
      className={cn("w-1.5 h-1.5 rounded-full", pagina.published ? "bg-emerald-400" : "bg-white/30")}
    />
  );

  // Free, ou catálogo vazio: mostra o domínio, sem escolha.
  if (!ehPro || dominios.length === 0) {
    return (
      <button
        type="button"
        onClick={() => !ehPro && avisarPro("Escolher o domínio")}
        className={cn(pilula, "pr-4")}
      >
        {ponto}
        {pagina.host}
        {!ehPro && <SeloPro />}
      </button>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <label className={pilula}>
        {ponto}
        <select
          value={pagina.domainId ?? ""}
          onChange={(e) => void onEscolher(e.target.value || null)}
          className="appearance-none bg-transparent focus:outline-none cursor-pointer"
          aria-label="Domínio da página"
        >
          <option value="" className="bg-bee-surface">
            padrão da plataforma
          </option>
          {dominios.map((d) => (
            <option key={d.id} value={d.id} className="bg-bee-surface">
              {d.host}
              {d.proprio ? " · seu domínio" : ""}
            </option>
          ))}
        </select>
        <ChevronDown className="absolute right-3 w-3.5 h-3.5 text-white/40 pointer-events-none" />
      </label>
      <Aviso>Trocar quebra o link já divulgado.</Aviso>
    </div>
  );
}

/** O data URL vai inteiro no PATCH, e a API recusa acima de 2 MB de texto —
 *  em base64, isso é cerca de 1,4 MB de arquivo. Recusar aqui poupa o upload. */
const LIMITE_DA_IMAGEM = 1_400_000;

/**
 * Campo de imagem do editor: mostra a atual (ou a padrão), troca por arquivo
 * e remove. Usado pela foto de capa e pela imagem da página de chegada.
 *
 * `padrao`: o que a página usa sem imagem escolhida. A tela mostra essa, para
 * a criadora saber o que a fã vê — "sem imagem" daria a entender que está vazio.
 */
function CampoDeImagem({
  rotulo,
  imagem,
  padrao,
  nota,
  aviso,
  onTrocar,
}: {
  rotulo: string;
  imagem: string | null;
  padrao?: string;
  nota?: string;
  aviso?: string;
  onTrocar: (dataUrl: string | null) => Promise<boolean>;
}) {
  const escolher = (e: React.ChangeEvent<HTMLInputElement>) => {
    const arquivo = e.target.files?.[0];
    e.target.value = "";
    if (!arquivo) return;
    if (arquivo.size > LIMITE_DA_IMAGEM) {
      toast.error("Imagem muito grande. Use um arquivo de até 1,4 MB.");
      return;
    }
    const leitor = new FileReader();
    leitor.onloadend = () => void onTrocar(leitor.result as string);
    leitor.readAsDataURL(arquivo);
  };

  const mostrada = imagem ?? padrao ?? null;

  return (
    <div className="px-2 py-3">
      <div className="text-sm text-white/85 mb-2">{rotulo}</div>
      <div className="relative h-36 rounded-lg overflow-hidden border border-white/10 bg-white/[0.02]">
        {mostrada ? (
          // eslint-disable-next-line @next/next/no-img-element -- data URL ou arquivo estático
          <img src={mostrada} alt="" className={cn("w-full h-full object-cover", !imagem && "opacity-60")} />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-xs text-white/35">
            Nenhuma foto
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 flex items-center gap-2 p-2 bg-gradient-to-t from-black/80 to-transparent">
          <label className="px-3 py-1.5 rounded-md bg-white text-bee-bg text-xs font-semibold cursor-pointer">
            {imagem ? "Trocar" : "Escolher foto"}
            <input type="file" accept="image/*" onChange={escolher} className="hidden" />
          </label>
          {imagem ? (
            <button
              onClick={() => void onTrocar(null)}
              className="px-3 py-1.5 rounded-md bg-black/50 text-white/80 text-xs hover:text-white"
            >
              {padrao ? "Usar a padrão" : "Remover"}
            </button>
          ) : (
            padrao && <span className="text-[11px] text-white/60">usando a padrão</span>
          )}
        </div>
      </div>
      {nota && <p className="mt-2 text-xs text-bee-muted">{nota}</p>}
      {aviso && <Aviso>{aviso}</Aviso>}
    </div>
  );
}
