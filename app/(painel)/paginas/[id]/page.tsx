"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  Camera,
  ChevronDown,
  ChevronRight,
  Copy,
  ExternalLink,
  Eye,
  ImagePlus,
  Link2,
  List,
  Loader2,
  Minus,
  Move,
  Plus,
  ShieldCheck,
  Trash2,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";

import {
  Aviso,
  CampoDeTexto,
  CLASSE_DO_PAINEL,
  Grupo,
  Info,
  Linha,
  MolduraDeCelular,
  Opcao,
  OpcaoLigavel,
  PreviaDoEditor,
  Secao,
} from "@/components/editor/Painel";
import { EsqueletoDeEditor } from "@/components/painel/Esqueleto";
import { SeloPro, avisarPro } from "@/components/shared/SeloPro";
import { api, ApiError, definirPaginaAtiva } from "@/lib/api/client";
import { arquivoDoInput, subirImagemDoPerfil, type ImagemDoPerfil } from "@/lib/imagens";
import { invalidateSession, usePlano } from "@/lib/api/use-session";
import type { ApiDomain, ApiProfile, ProfileInput } from "@/lib/api/types";
import { THEMES } from "@/lib/catalog";
import { CROSSFADE, SURGIR, SURGIR_DE_BAIXO } from "@/lib/movimento";
import { urlDaPagina } from "@/lib/site";
import {
  ESTILOS_DE_BOTAO,
  FONTES,
  TEMPLATES,
  TEMPLATE_DO_FREE,
  resolverVisual,
} from "@/lib/templates";
import { cn, slugify, validateSlug } from "@/lib/utils";

type Lado = "chegada" | "pagina";

/**
 * Editor de uma página: a prévia no celular à esquerda, as configurações à
 * direita — dentro da casca do painel, com a barra lateral encolhida. No
 * celular só o painel aparece, e a prévia abre por cima (`PreviaDoEditor`).
 *
 * Abrir o editor torna esta página a ATIVA do painel (`x-profile-id`): é o que
 * faz o `PATCH /me/profile` cair nela, e o que deixa Links e Analytics, a um
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
   * Enquadramento da capa durante o AJUSTE (`object-position` Y, 0–100).
   *
   * Entra no modo de ajuste, arrasta a foto (ou usa o controle deslizante), e
   * conclui: uma gravação só. Cada mudança mexe neste estado e no
   * `object-position` da imagem DENTRO do iframe (mesma origem, então o
   * editor alcança o documento da prévia); nada recarrega. Nulo fora do modo.
   */
  const [posicaoLocal, setPosicaoLocal] = useState<number | null>(null);
  /** O que está aberto sobre a capa: o menu do botão "Capa" ou o ajuste. */
  const [modoCapa, setModoCapa] = useState<"menu" | "ajuste" | null>(null);
  /** O menu do avatar (trocar, remover), aberto pelo botão de câmera. */
  const [menuDoAvatar, setMenuDoAvatar] = useState(false);

  /**
   * Onde está a área da capa DENTRO da prévia, em px a partir do topo da tela
   * do iPhone. Os controles da foto ficam numa camada por cima do iframe; sem
   * isto eles ficavam parados enquanto a página rolava por baixo deles.
   */
  const [areaDaCapa, setAreaDaCapa] = useState<{ top: number; height: number } | null>(null);
  /** O mesmo para o círculo do avatar: a foto de perfil se troca clicando
   *  nele, direto na prévia, e não só pelo campo do painel. */
  const [areaDoAvatar, setAreaDoAvatar] = useState<
    { top: number; left: number; width: number; height: number } | null
  >(null);
  const acompanharCapa = useCallback(() => {
    const janela = previa.current?.contentWindow;
    if (!janela) return;
    const medir = () => {
      const el = janela.document.querySelector("[data-capa-area]");
      if (!el) setAreaDaCapa(null);
      else {
        const r = el.getBoundingClientRect();
        setAreaDaCapa({ top: r.top, height: r.height });
      }
      const avatar = janela.document.querySelector("[data-avatar-area]");
      if (!avatar) setAreaDoAvatar(null);
      else {
        const r = avatar.getBoundingClientRect();
        setAreaDoAvatar({ top: r.top, left: r.left, width: r.width, height: r.height });
      }
    };
    medir();
    // A janela é nova a cada recarga do iframe, então os ouvintes antigos vão
    // embora com ela — não há o que remover.
    janela.addEventListener("scroll", medir, { passive: true });
    janela.addEventListener("resize", medir);
  }, []);
  const previa = useRef<HTMLIFrameElement>(null);
  /** Última posição aplicada à imagem; o arraste parte dela. */
  const posicaoRef = useRef(50);
  const ajustando = modoCapa === "ajuste";
  /** Cancelar o ajuste pelo Esc, de qualquer lugar da janela do painel. */
  const cancelarRef = useRef<() => void>(() => undefined);

  /**
   * Arrastar a foto, no modo de ajuste.
   *
   * A imagem fica dentro do iframe, então os ouvintes vão no documento DELE.
   * Arrastar para baixo mostra mais do topo da foto (a posição diminui): é o
   * gesto de "puxar a foto", o mesmo do Instagram e do Facebook ao enquadrar
   * uma capa. A regra WCAG de arraste pede uma alternativa sem arrastar — é o
   * controle deslizante e os botões − e + da barra.
   */
  useEffect(() => {
    if (!ajustando) return;
    const doc = previa.current?.contentDocument;
    const img = doc?.querySelector<HTMLImageElement>("img[data-capa]");
    if (!doc || !img) return;
    // O ponteiro cai na camada de escurecimento, que fica POR CIMA da imagem;
    // por isso os ouvintes vão na caixa da capa, que contém as duas.
    const alvo = (img.closest("[data-capa-area]") as HTMLElement | null) ?? img.parentElement ?? img;
    const x = pagina?.template?.coverPosX ?? 50;
    /**
     * Quantos px a foto pode deslizar dentro da caixa (`object-fit: cover`):
     * a altura em que ela é desenhada menos a altura da caixa. É o que faz a
     * foto acompanhar o dedo — 1 px de arraste, 1 px de foto. Imagem mais
     * larga que alta não sobra na vertical; aí a altura da caixa serve de
     * escala para o gesto ainda fazer alguma coisa.
     */
    const caixa = img.getBoundingClientRect();
    const desenhada = img.naturalWidth
      ? Math.max(caixa.height, (caixa.width * img.naturalHeight) / img.naturalWidth)
      : caixa.height;
    const sobra = Math.max(desenhada - caixa.height, caixa.height, 1);
    let inicioY = 0;
    let inicioPos = 0;
    let arrastando = false;
    const aplicar = (y: number) => {
      const v = Math.min(100, Math.max(0, Math.round(y)));
      posicaoRef.current = v;
      img.style.objectPosition = `${x}% ${v}%`;
      setPosicaoLocal(v);
    };
    const baixar = (e: PointerEvent) => {
      arrastando = true;
      inicioY = e.clientY;
      inicioPos = posicaoRef.current;
      alvo.setPointerCapture?.(e.pointerId);
      alvo.style.cursor = "grabbing";
      e.preventDefault();
    };
    const mover = (e: PointerEvent) => {
      if (!arrastando) return;
      aplicar(inicioPos - ((e.clientY - inicioY) / sobra) * 100);
    };
    const soltar = () => {
      arrastando = false;
      alvo.style.cursor = "grab";
    };
    alvo.style.cursor = "grab";
    alvo.style.touchAction = "none";
    alvo.style.userSelect = "none";
    alvo.addEventListener("pointerdown", baixar);
    doc.addEventListener("pointermove", mover);
    doc.addEventListener("pointerup", soltar);
    doc.addEventListener("pointercancel", soltar);
    const tecla = (e: KeyboardEvent) => e.key === "Escape" && cancelarRef.current();
    window.addEventListener("keydown", tecla);
    return () => {
      alvo.style.cursor = "";
      alvo.style.touchAction = "";
      alvo.style.userSelect = "";
      alvo.removeEventListener("pointerdown", baixar);
      doc.removeEventListener("pointermove", mover);
      doc.removeEventListener("pointerup", soltar);
      doc.removeEventListener("pointercancel", soltar);
      window.removeEventListener("keydown", tecla);
    };
  }, [ajustando, areaDaCapa?.height, pagina?.template?.coverPosX]);

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

  /**
   * Troca (arquivo) ou remove (`null`) uma imagem da página. O upload grava
   * direto na API; depois a página é relida para a prévia e os campos
   * mostrarem a URL nova. `extra` é o que deve ser salvo junto (o enquadramento
   * da capa volta ao centro quando a foto muda).
   */
  const trocarImagem = useCallback(async (
    tipo: ImagemDoPerfil,
    arquivo: File | null,
    extra: ProfileInput = {},
  ): Promise<boolean> => {
    setSalvando(true);
    try {
      if (arquivo) {
        if (!(await subirImagemDoPerfil(tipo, arquivo))) return false;
      } else {
        await api.removeProfileImage(tipo);
      }
      const atualizada = Object.keys(extra).length > 0 ? await api.updateProfile(extra) : await api.profile();
      setPagina(atualizada);
      setRecarga((r) => r + 1);
      invalidateSession();
      return true;
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : "Não foi possível salvar a imagem.");
      return false;
    } finally {
      setSalvando(false);
    }
  }, []);

  if (!pagina) return <EsqueletoDeEditor />;

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
  const salvoY = pagina.template?.coverPosY ?? 50;
  const posicaoY = posicaoLocal ?? salvoY;
  /** Os controles da capa aparecem sobre a prévia quando o modelo usa foto de
   *  capa e a área dela está visível. Com foto: o botão "Capa" (menu com
   *  ajustar, trocar e remover). Sem foto: "Adicionar foto de capa". */
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
  /** O botão "Capa" fica no canto superior direito da área da capa, logo
   *  abaixo da Dynamic Island. É um só, com rótulo, no lugar dos quatro
   *  botões de ícone que ficavam em cima da foto e da foto de perfil. */
  const topoDoBotaoDaCapa = Math.max(TOPO_LIVRE, (areaDaCapa?.top ?? 0) + 10);
  const temFoto = Boolean(pagina.coverUrl);
  /** O círculo do avatar vira botão quando está visível e fora da Dynamic
   *  Island. Nos modelos sem avatar (`visual.avatar === "nenhum"`) não existe
   *  círculo e nada aparece. Some durante o ajuste da capa, para não disputar
   *  a tela com a barra de ajuste. */
  const mostraControleDoAvatar =
    lado === "pagina" &&
    pagina.published &&
    modoCapa === null &&
    areaDoAvatar !== null &&
    areaDoAvatar.top + areaDoAvatar.height > TOPO_LIVRE + 8;
  const temAvatar = Boolean(pagina.avatarUrl);
  const escolherAvatar = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMenuDoAvatar(false);
    const arquivo = arquivoDoInput(e);
    if (arquivo) void trocarImagem("avatar", arquivo);
  };
  const escolherCapa = (e: React.ChangeEvent<HTMLInputElement>) => {
    setModoCapa(null);
    const arquivo = arquivoDoInput(e);
    if (arquivo) void trocarImagem("cover", arquivo, { coverPosY: 50 });
  };
  /** Aplica uma posição à imagem dentro da prévia, sem gravar. */
  const aplicarPosicao = (y: number) => {
    const v = Math.min(100, Math.max(0, Math.round(y)));
    posicaoRef.current = v;
    const x = pagina.template?.coverPosX ?? 50;
    previa.current?.contentDocument
      ?.querySelectorAll<HTMLImageElement>("img[data-capa]")
      .forEach((img) => {
        img.style.objectPosition = `${x}% ${v}%`;
      });
    setPosicaoLocal(v);
  };
  const iniciarAjuste = () => {
    posicaoRef.current = salvoY;
    setPosicaoLocal(salvoY);
    setModoCapa("ajuste");
  };
  const cancelarAjuste = () => {
    aplicarPosicao(salvoY);
    setPosicaoLocal(null);
    setModoCapa(null);
  };
  cancelarRef.current = cancelarAjuste;
  const concluirAjuste = async () => {
    const novo = posicaoY;
    setModoCapa(null);
    if (novo !== salvoY) {
      const ok = await salvar({ coverPosY: novo }, { recarregar: false });
      // Falhou: a prévia volta ao que está gravado, para não mostrar um
      // enquadramento que a fã não vai ver.
      if (!ok) aplicarPosicao(salvoY);
    }
    setPosicaoLocal(null);
  };

  return (
    <div className="flex flex-col lg:flex-row">
      {/* ── Prévia ─────────────────────────────────────────────────────── */}
      <PreviaDoEditor>
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
          {/* Fundo invisível que fecha o menu aberto. Clique dentro do iframe
              não chega ao documento do painel, então um ouvinte global não
              bastaria; esta camada cobre a prévia inteira. */}
          {(modoCapa === "menu" || menuDoAvatar) && (
            <button
              aria-label="Fechar o menu"
              data-sem-toque
              onClick={() => {
                setModoCapa(null);
                setMenuDoAvatar(false);
              }}
              className="absolute inset-0 z-30 cursor-default"
            />
          )}

          {mostraControlesDaFoto && temFoto && !ajustando && (
            <>
              <motion.button
                variants={CROSSFADE}
                initial="initial"
                animate="animate"
                data-tour="capa"
                onClick={() => setModoCapa(modoCapa === "menu" ? null : "menu")}
                aria-haspopup="menu"
                aria-expanded={modoCapa === "menu"}
                className="absolute right-3 z-40 flex items-center gap-1.5 h-9 pl-3 pr-3.5 rounded-full bg-black/55 backdrop-blur-md text-xs font-semibold text-white shadow-md hover:bg-black/70 transition-colors"
                style={{ top: topoDoBotaoDaCapa }}
              >
                <Camera className="w-3.5 h-3.5" strokeWidth={2.5} />
                Capa
              </motion.button>
              <AnimatePresence>
              {modoCapa === "menu" && (
                <MenuDaImagem
                  origem="top right"
                  style={{ top: topoDoBotaoDaCapa + 42, right: 12 }}
                  itens={[
                    { icone: Move, rotulo: "Ajustar posição", onClick: iniciarAjuste },
                    { icone: ImagePlus, rotulo: "Trocar foto", arquivo: escolherCapa },
                    {
                      icone: Trash2,
                      rotulo: "Remover foto",
                      perigo: true,
                      onClick: () => {
                        setModoCapa(null);
                        void trocarImagem("cover", null);
                      },
                    },
                  ]}
                />
              )}
              </AnimatePresence>
            </>
          )}

          {mostraControlesDaFoto && !temFoto && (
            <label
              data-tour="adicionar-capa"
              className="absolute left-1/2 -translate-x-1/2 z-30 flex items-center gap-1.5 whitespace-nowrap h-9 px-3.5 rounded-full bg-black/55 backdrop-blur-md text-xs font-semibold text-white shadow-md hover:bg-black/70 cursor-pointer transition-colors"
              style={{ top: naCapa(visual.capa === "faixa" ? 0.3 : 0.4) }}
            >
              <ImagePlus className="w-3.5 h-3.5" strokeWidth={2.5} />
              Adicionar foto de capa
              <input type="file" accept="image/*" onChange={escolherCapa} className="hidden" />
            </label>
          )}

          {/* Barra de ajuste: fica no pé da tela do iPhone, longe da foto e do
              avatar. Arrastar a foto é o gesto principal; o controle deslizante
              e os botões − e + são a alternativa sem arraste. */}
          <AnimatePresence>
          {ajustando && (
            <motion.div
              role="group"
              aria-label="Posição da foto de capa"
              variants={SURGIR_DE_BAIXO}
              initial="initial"
              animate="animate"
              exit="exit"
              className="absolute inset-x-3 bottom-6 z-40 rounded-2xl bg-black/80 backdrop-blur-md p-3 text-white shadow-[0_8px_24px_rgba(0,0,0,0.5)]"
            >
              <div className="mb-2">
                <span className="block text-xs font-semibold">Posição da foto</span>
                <span className="block text-[11px] text-white/60">Arraste a foto, ou use o controle abaixo.</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => aplicarPosicao(posicaoY - 5)}
                  aria-label="Mostrar mais do topo da foto"
                  className="w-9 h-9 flex-shrink-0 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
                >
                  <Minus className="w-4 h-4" strokeWidth={2.5} />
                </button>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={posicaoY}
                  onChange={(e) => aplicarPosicao(Number(e.target.value))}
                  aria-label="Posição vertical da foto"
                  className="flex-1 h-9 accent-bee-pink cursor-pointer"
                />
                <button
                  onClick={() => aplicarPosicao(posicaoY + 5)}
                  aria-label="Mostrar mais da base da foto"
                  className="w-9 h-9 flex-shrink-0 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
                >
                  <Plus className="w-4 h-4" strokeWidth={2.5} />
                </button>
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={cancelarAjuste}
                  className="flex-1 h-9 rounded-lg border border-white/20 text-xs font-semibold text-white/85 hover:text-white hover:border-white/40 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => void concluirAjuste()}
                  className="flex-1 h-9 rounded-lg bg-white text-bee-bg text-xs font-semibold hover:bg-white/90 transition-colors"
                >
                  Concluir
                </button>
              </div>
            </motion.div>
          )}
          </AnimatePresence>

          {mostraControleDoAvatar && areaDoAvatar && (
            <>
              {/* Sem foto: o círculo inteiro é o botão e mostra "Foto" por cima
                  da inicial. Com foto: uma câmera no canto do círculo abre o
                  menu (trocar, remover), para não cobrir a foto. */}
              {temAvatar ? (
                <button
                  onClick={() => setMenuDoAvatar((v) => !v)}
                  aria-haspopup="menu"
                  aria-expanded={menuDoAvatar}
                  aria-label="Foto de perfil"
                  title="Foto de perfil"
                  data-tour="foto-de-perfil"
                  className="absolute z-40 w-9 h-9 rounded-full bg-white text-bee-bg shadow-md flex items-center justify-center hover:bg-white/90 transition-colors"
                  style={{
                    top: areaDoAvatar.top + areaDoAvatar.height - 30,
                    left: areaDoAvatar.left + areaDoAvatar.width - 30,
                  }}
                >
                  <Camera className="w-4 h-4" strokeWidth={2.5} />
                </button>
              ) : (
                <label
                  title="Adicionar foto de perfil"
                  data-tour="foto-de-perfil"
                  className="absolute z-30 rounded-full cursor-pointer flex flex-col items-center justify-center gap-0.5 text-white bg-black/45 hover:bg-black/60 backdrop-blur-[1px] transition-colors"
                  style={{
                    top: areaDoAvatar.top,
                    left: areaDoAvatar.left,
                    width: areaDoAvatar.width,
                    height: areaDoAvatar.height,
                  }}
                >
                  <Camera className="w-5 h-5" strokeWidth={2.25} />
                  <span className="text-[11px] font-semibold leading-none">Foto</span>
                  <input type="file" accept="image/*" onChange={escolherAvatar} className="hidden" />
                </label>
              )}
              <AnimatePresence>
              {menuDoAvatar && temAvatar && (
                <MenuDaImagem
                  origem="top center"
                  style={{
                    top: areaDoAvatar.top + areaDoAvatar.height + 8,
                    left: Math.max(12, areaDoAvatar.left + areaDoAvatar.width / 2 - 88),
                  }}
                  itens={[
                    { icone: ImagePlus, rotulo: "Trocar foto", arquivo: escolherAvatar },
                    {
                      icone: Trash2,
                      rotulo: "Remover foto",
                      perigo: true,
                      onClick: () => {
                        setMenuDoAvatar(false);
                        void trocarImagem("avatar", null);
                      },
                    },
                  ]}
                />
              )}
              </AnimatePresence>
            </>
          )}
        </MolduraDeCelular>
      </PreviaDoEditor>

      {/* ── Painel ─────────────────────────────────────────────────────── */}
      <aside className={CLASSE_DO_PAINEL}>
        {/* Grudado abaixo da barra do topo no celular, onde o painel é a tela
            inteira e rola: o botão de voltar não some no meio da edição. */}
        <div className="sticky top-14 lg:static z-20 h-14 lg:h-16 px-4 flex items-center gap-3 border-b border-bee-line bg-bee-panel">
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

        <div className="px-4 py-4 border-b border-bee-line">
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
              data-tour="ver-pagina"
              className="flex-1 flex items-center justify-center gap-2 h-11 rounded-xl bg-white text-bee-panel text-[15px] font-semibold hover:bg-white/90 transition-colors"
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
          </div>
        </div>

        <Secao titulo="Link">
          <CampoDeTexto
            rotulo="Nome da página"
            valor={pagina.displayName}
            maxLength={60}
            onSalvar={(v) => (v.trim() ? salvar({ displayName: v.trim() }) : Promise.resolve(false))}
          />
          <CampoDeAvatar
            imagem={pagina.avatarUrl}
            nome={pagina.displayName}
            onTrocar={(arquivo) => trocarImagem("avatar", arquivo)}
          />
          <CampoDeBio valor={pagina.bio} onSalvar={(bio) => salvar({ bio })} />
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

        <Secao titulo="Proteção" dataTour="protecao">
          <Grupo
            titulo="Sair do Instagram"
            dataTour="sair-do-instagram"
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
            dataTour="barreira-de-idade"
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
                        ? "ring-2 ring-white ring-offset-2 ring-offset-bee-panel"
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
                      // O estilo de botão acompanha o modelo escolhido.
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
            titulo="Cores"
            info="Cores escolhidas a dedo, por cima do tema. 'Tema' volta à cor dele."
            nota={ehPro ? undefined : "Cores próprias são do plano Pro."}
          >
            <CampoDeCor
              rotulo="Fundo"
              valor={visual.bg}
              propria={Boolean(pagina.template?.bgColor)}
              travado={!ehPro}
              onSalvar={(bgColor) => salvar({ bgColor })}
            />
            <CampoDeCor
              rotulo="Destaque"
              valor={visual.accent}
              propria={Boolean(pagina.template?.accentColor)}
              travado={!ehPro}
              onSalvar={(accentColor) => salvar({ accentColor })}
            />
          </Grupo>

          <Grupo titulo="Fonte" nota={ehPro ? undefined : "Trocar a fonte é do plano Pro."}>
            <div className="grid grid-cols-3 gap-2 px-1">
              {FONTES.map((f) => {
                const ativa = (pagina.template?.fontId ?? visual.fontePadrao) === f.id;
                return (
                  <button
                    key={f.id}
                    onClick={() => {
                      if (ativa) return;
                      if (!ehPro) return avisarPro("Trocar a fonte");
                      void salvar({ fontId: f.id });
                    }}
                    className={cn(
                      f.classe,
                      "flex items-center justify-center gap-1.5 px-2 py-2.5 rounded-xl border text-[14px] transition-colors",
                      ativa
                        ? "border-white/15 bg-black/35 text-white"
                        : "border-white/[0.07] text-white/60 hover:text-white hover:border-white/20",
                    )}
                  >
                    {f.label}
                    {!ehPro && !ativa && <SeloPro />}
                  </button>
                );
              })}
            </div>
          </Grupo>

          {!visual.botoesUniformes && (
            <Grupo
              titulo="Botões"
              info="Vale para os botões sem aparência própria. A aparência de cada link se ajusta no editor dele."
            >
              <div className="flex flex-wrap gap-2 px-1">
                {ESTILOS_DE_BOTAO.map((e) => {
                  const ativo = (pagina.buttonStyle || visual.botaoPadrao) === e.id;
                  return (
                    <button
                      key={e.id}
                      onClick={() => !ativo && salvar({ buttonStyle: e.id })}
                      className={cn(
                        "px-3 py-2 rounded-xl border text-[13px] transition-colors",
                        ativo
                          ? "border-white/15 bg-black/35 text-white"
                          : "border-white/[0.07] text-white/60 hover:text-white hover:border-white/20",
                      )}
                    >
                      {e.label}
                    </button>
                  );
                })}
              </div>
            </Grupo>
          )}

          {visual.capa !== "nenhuma" && pagina.coverUrl && (
            <Grupo
              titulo="Escurecer a capa"
              info="Uma camada escura sobre a foto, para o nome continuar legível sobre foto clara."
            >
              <CampoDeEscurecimento
                valor={pagina.template?.coverOverlay ?? 55}
                onSalvar={(coverOverlay) => salvar({ coverOverlay })}
              />
            </Grupo>
          )}

          <Grupo
            titulo="Visibilidade"
            nota="Fora do ar, a página some para o público e tudo fica guardado."
            dataTour="no-ar"
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
          <Secao
            titulo="Página de chegada"
            info="É a primeira tela que a fã vê ao abrir o seu link de dentro do Instagram ou de outro aplicativo: a sua foto, um título e o botão que leva para a sua página no navegador do celular."
          >
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
              rotulo="Foto da página de chegada"
              info="Aparece em destaque na tela de chegada, acima do título e do botão de continuar. Sem foto escolhida, entra a padrão da plataforma."
              imagem={pagina.iab.imageUrl}
              padrao="/chegada-padrao.svg"
              nota="É a primeira imagem que a fã vê ao abrir o seu link. Ela ainda não está na sua página; está na tela de entrada."
              onTrocar={(arquivo) => trocarImagem("iab", arquivo)}
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

/**
 * Campo de imagem do editor: mostra a atual (ou a padrão), troca por arquivo
 * e remove. Usado pela foto de capa e pela imagem da página de chegada.
 *
 * `padrao`: o que a página usa sem imagem escolhida. A tela mostra essa, para
 * a criadora saber o que a fã vê — "sem imagem" daria a entender que está vazio.
 */
function CampoDeImagem({
  rotulo,
  info,
  imagem,
  padrao,
  nota,
  aviso,
  onTrocar,
}: {
  rotulo: string;
  /** Explicação do campo, no ⓘ ao lado do rótulo. */
  info?: string;
  imagem: string | null;
  padrao?: string;
  nota?: string;
  aviso?: string;
  /** Arquivo para subir, ou `null` para remover. O upload é de quem chama. */
  onTrocar: (arquivo: File | null) => Promise<boolean>;
}) {
  const [enviando, setEnviando] = useState(false);
  /** Prévia local enquanto o upload roda: a criadora vê a foto escolhida na
   *  hora, antes de a API responder com a URL definitiva. */
  const [previa, setPrevia] = useState<string | null>(null);
  useEffect(() => () => { if (previa) URL.revokeObjectURL(previa); }, [previa]);

  const escolher = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const arquivo = arquivoDoInput(e);
    if (!arquivo) return;
    setPrevia(URL.createObjectURL(arquivo));
    setEnviando(true);
    try {
      await onTrocar(arquivo);
    } finally {
      setEnviando(false);
      setPrevia(null);
    }
  };

  const mostrada = previa ?? imagem ?? padrao ?? null;

  return (
    <div className="px-2 py-3">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-sm text-white/85">{rotulo}</span>
        {info && <Info texto={info} />}
      </div>
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
          <label className={cn("px-3 py-1.5 rounded-md bg-white text-bee-bg text-xs font-semibold cursor-pointer", enviando && "opacity-60 pointer-events-none")}>
            {enviando ? "Enviando…" : imagem ? "Trocar" : "Escolher foto"}
            <input type="file" accept="image/*" onChange={escolher} className="hidden" disabled={enviando} />
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

/** Foto de perfil: círculo com a atual (ou a inicial), trocar e remover.
 *
 *  O arquivo sobe em multipart pela mesma rota das outras imagens da página
 *  (`trocarImagem`); enquanto sobe, o círculo mostra a foto escolhida. */
function CampoDeAvatar({
  imagem,
  nome,
  onTrocar,
}: {
  imagem: string | null;
  nome: string;
  /** Arquivo para subir, ou `null` para remover. */
  onTrocar: (arquivo: File | null) => Promise<boolean>;
}) {
  const [enviando, setEnviando] = useState(false);
  const [previa, setPrevia] = useState<string | null>(null);
  useEffect(() => () => { if (previa) URL.revokeObjectURL(previa); }, [previa]);

  const escolher = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const arquivo = arquivoDoInput(e);
    if (!arquivo) return;
    setPrevia(URL.createObjectURL(arquivo));
    setEnviando(true);
    try {
      await onTrocar(arquivo);
    } finally {
      setEnviando(false);
      setPrevia(null);
    }
  };

  const mostrada = previa ?? imagem;

  return (
    <div className="flex items-center justify-between gap-3 px-2 py-3">
      <span className="text-[15px] text-white/85">Foto de perfil</span>
      <div className="flex items-center gap-2">
        <span className="w-9 h-9 rounded-full overflow-hidden bg-white/10 flex items-center justify-center text-sm font-semibold text-white">
          {mostrada ? (
            // eslint-disable-next-line @next/next/no-img-element -- URL do próprio perfil
            <img src={mostrada} alt="" className="w-full h-full object-cover" />
          ) : (
            nome.slice(0, 1).toUpperCase()
          )}
        </span>
        <label
          className={cn(
            "px-3 py-1.5 rounded-lg border border-white/10 text-xs text-white/80 hover:text-white hover:border-white/25 cursor-pointer transition-colors",
            enviando && "opacity-60 pointer-events-none",
          )}
        >
          {enviando ? "Enviando…" : imagem ? "Trocar" : "Escolher"}
          <input type="file" accept="image/*" onChange={escolher} className="hidden" disabled={enviando} />
        </label>
        {imagem && !enviando && (
          <button
            onClick={() => void onTrocar(null)}
            aria-label="Remover foto de perfil"
            className="p-1.5 text-white/40 hover:text-white transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

/** Limite da bio na tela. A API aceita até 500, mas o cabeçalho da página
 *  mostra só duas linhas — mais que isso a fã nunca lê. */
const LIMITE_DA_BIO = 150;

/** Bio: salva ao sair do campo, e volta ao valor salvo se a API recusar. */
function CampoDeBio({ valor, onSalvar }: { valor: string; onSalvar: (v: string) => Promise<boolean> }) {
  const [rascunho, setRascunho] = useState(valor);
  useEffect(() => setRascunho(valor), [valor]);
  const confirmar = async () => {
    if (rascunho === valor) return;
    if (!(await onSalvar(rascunho.trim()))) setRascunho(valor);
  };
  return (
    <label className="block px-2 py-3">
      <span className="flex items-center justify-between text-[15px] text-white/85">
        Bio
        <span className="text-xs text-white/35 tabular-nums">
          {rascunho.length}/{LIMITE_DA_BIO}
        </span>
      </span>
      <textarea
        value={rascunho}
        maxLength={LIMITE_DA_BIO}
        rows={3}
        placeholder="Uma frase sobre você"
        onChange={(e) => setRascunho(e.target.value)}
        onBlur={confirmar}
        className="mt-2 w-full resize-none rounded-xl bg-black/30 border border-white/10 px-3 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-white/25"
      />
    </label>
  );
}

/**
 * Cor própria (fundo ou destaque). O seletor dispara a cada pixel arrastado:
 * a amostra acompanha na hora e salva só quando a criadora para de mexer.
 * "Tema" apaga a cor própria e volta à do tema.
 */
function CampoDeCor({
  rotulo,
  valor,
  propria,
  travado,
  onSalvar,
}: {
  rotulo: string;
  valor: string;
  propria: boolean;
  travado: boolean;
  onSalvar: (cor: string | null) => Promise<boolean>;
}) {
  const [cor, setCor] = useState(valor);
  const espera = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => setCor(valor), [valor]);
  useEffect(() => () => {
    if (espera.current) clearTimeout(espera.current);
  }, []);

  const escolher = (nova: string) => {
    setCor(nova);
    if (espera.current) clearTimeout(espera.current);
    espera.current = setTimeout(() => void onSalvar(nova), 600);
  };

  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2">
      <span className="flex items-center gap-1.5 text-[15px] text-white/85">
        {rotulo}
        {travado && <SeloPro />}
      </span>
      <span className="flex items-center gap-2">
        {propria && !travado && (
          <button
            onClick={() => void onSalvar(null)}
            title="Voltar à cor do tema"
            className="text-[11px] text-white/45 hover:text-white transition-colors"
          >
            tema
          </button>
        )}
        <code className="text-xs text-white/50 uppercase">{cor}</code>
        {travado ? (
          <button
            type="button"
            onClick={() => avisarPro("Cor própria")}
            className="w-8 h-8 rounded-lg border border-white/10 opacity-50 cursor-not-allowed"
            style={{ background: cor }}
            aria-label={`${rotulo}: cor própria é do plano Pro`}
          />
        ) : (
          <input
            type="color"
            value={cor}
            onChange={(e) => escolher(e.target.value)}
            aria-label={`Cor de ${rotulo.toLowerCase()}`}
            className="w-8 h-8 rounded-lg bg-transparent border border-white/10 cursor-pointer"
          />
        )}
      </span>
    </div>
  );
}

/** Escurecimento da capa (0 a 100): o número acompanha o arraste e salva ao
 *  soltar, para a prévia não recarregar a cada passo. */
function CampoDeEscurecimento({
  valor,
  onSalvar,
}: {
  valor: number;
  onSalvar: (v: number) => Promise<boolean>;
}) {
  const [atual, setAtual] = useState(valor);
  useEffect(() => setAtual(valor), [valor]);
  const confirmar = () => {
    if (atual !== valor) void onSalvar(atual);
  };
  return (
    <div className="flex items-center gap-3 px-3 py-2">
      <input
        type="range"
        min={0}
        max={100}
        value={atual}
        onChange={(e) => setAtual(Number(e.target.value))}
        onPointerUp={confirmar}
        onKeyUp={confirmar}
        aria-label="Escurecer a capa"
        className="flex-1 accent-white"
      />
      <span className="w-10 text-right text-xs text-white/60 tabular-nums">{atual}%</span>
    </div>
  );
}

type ItemDoMenuDaImagem = {
  icone: LucideIcon;
  rotulo: string;
  perigo?: boolean;
  /** Clique simples. */
  onClick?: () => void;
  /** Ou: abre o seletor de arquivo e entrega o evento. */
  arquivo?: (e: React.ChangeEvent<HTMLInputElement>) => void;
};

/**
 * Menu pequeno sobre a prévia, para as ações de uma imagem (capa, avatar):
 * ícone + rótulo em cada linha, nunca ícone sozinho. Quem o abre também
 * desenha o fundo que o fecha (ver a camada `inset-0` no editor).
 */
function MenuDaImagem({
  itens,
  style,
  origem = "top right",
}: {
  itens: ItemDoMenuDaImagem[];
  style?: React.CSSProperties;
  /** De onde o menu cresce: o canto onde está o botão que o abriu. */
  origem?: string;
}) {
  return (
    <motion.div
      role="menu"
      variants={SURGIR}
      initial="initial"
      animate="animate"
      exit="exit"
      className="absolute z-40 w-44 py-1 rounded-xl border border-white/10 bg-bee-surface shadow-2xl overflow-hidden"
      style={{ ...style, transformOrigin: origem }}
    >
      {itens.map((item) => {
        const Icone = item.icone;
        const classe = cn(
          "flex items-center gap-2.5 w-full h-10 px-3 text-left text-[13px] transition-colors cursor-pointer",
          item.perigo ? "text-red-300 hover:bg-red-500/10" : "text-white/85 hover:bg-white/[0.06] hover:text-white",
        );
        if (item.arquivo) {
          return (
            <label key={item.rotulo} role="menuitem" className={classe}>
              <Icone className="w-4 h-4" />
              {item.rotulo}
              <input type="file" accept="image/*" onChange={item.arquivo} className="hidden" />
            </label>
          );
        }
        return (
          <button key={item.rotulo} role="menuitem" onClick={item.onClick} className={classe}>
            <Icone className="w-4 h-4" />
            {item.rotulo}
          </button>
        );
      })}
    </motion.div>
  );
}
