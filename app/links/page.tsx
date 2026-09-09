"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Loader2, Plus, Link as LinkIcon } from "lucide-react";
import { toast, Toaster } from "sonner";
import { LinkCard } from "@/components/dashboard/LinkCard";
import { LinkModal, ModalTab, type ProfileData } from "@/components/dashboard/LinkModal";
import { Link } from "@/lib/catalog";
import { api, ApiError } from "@/lib/api/client";
import { invalidateSession } from "@/lib/api/use-session";
import type { ApiLink, LinkInput } from "@/lib/api/types";

/**
 * Meus links.
 *
 * Esta tela era o coração do protótipo e o lugar onde o problema aparecia mais
 * cru: tudo vivia em `useState` sobre `lib/mock-data.ts`, então criar, editar,
 * apagar e reordenar funcionavam na tela e **desapareciam no refresh**.
 *
 * Agora cada gesto vira uma requisição. Duas decisões de comportamento:
 *
 *   1. **Reordenar e ligar/desligar são otimistas.** Arrastar um link precisa
 *      responder no mesmo quadro; esperar a rede para mover o cartão faria o
 *      drag parecer travado. A tela aplica na hora e, se a API recusar, volta
 *      ao estado anterior e diz o que aconteceu — nunca fica mostrando uma
 *      ordem que o banco não tem.
 *   2. **Criar e editar esperam a resposta.** Aqui o servidor decide coisas que
 *      o front não sabe: o código curto do link e a validação do destino. Fingir
 *      sucesso antes disso é como o protótipo perdia o primeiro link de todo
 *      usuário novo enquanto anunciava "Link salvo".
 */

/** Um id da API é UUID; rascunho local é `l<timestamp>`. É assim que a tela
 *  distingue "existe no banco" de "a pessoa acabou de escolher a plataforma e
 *  ainda não digitou o destino". */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function ehIdDaApi(id: string): boolean {
  return UUID.test(id);
}

/** A API devolve mais campos do que a UI usa (botHits, lastClickAt, createdAt).
 *  `ApiLink` já é compatível com `Link`, então a conversão é só de forma. */
function toUiLink(link: ApiLink): Link {
  return {
    ...link,
    subtitle: link.subtitle ?? undefined,
    safePage: link.safePage,
  };
}

/** Converte a safe page do formato da UI para o da API. */
function paraSafePage(data: Partial<Link>) {
  if (data.safePage === undefined) return undefined;
  if (!data.safePage) return null;
  return {
    socialLinks: data.safePage.socialLinks.map((social) => ({
      platform: social.platform,
      url: social.url,
      title: social.title,
    })),
  };
}

/**
 * Payload de CRIAÇÃO.
 *
 * `shortCode`, `clicks` e `id` são deliberadamente descartados: quem decide o
 * código curto é o servidor, o contador é dele, e o id vai na URL.
 */
function paraCriacao(data: Partial<Link>): LinkInput {
  return {
    title: data.title ?? "",
    subtitle: data.subtitle ?? null,
    thumbnailUrl: data.thumbnailUrl ?? null,
    platform: data.platform,
    destinationUrl: data.destinationUrl ?? "",
    isActive: data.isActive,
    cloakEnabled: data.cloakEnabled,
    appearance: data.appearance,
    safePage: paraSafePage(data) ?? null,
  };
}

/**
 * Payload de EDIÇÃO — só as chaves que vieram.
 *
 * A diferença em relação à criação não é estilo, é corretude: o modal salva em
 * pedaços (um blur de campo, uma troca de cor) e emite payloads como
 * `{ id, appearance }`. Se a edição mandasse o objeto inteiro com valores
 * default, uma troca de cor enviaria `title: ""` — que a API recusa — e
 * `safePage: null`, que APAGARIA a página segura do link sem ninguém pedir.
 */
function paraEdicao(data: Partial<Link>): Partial<LinkInput> {
  const input: Partial<LinkInput> = {};
  if (data.title !== undefined) input.title = data.title;
  if (data.subtitle !== undefined) input.subtitle = data.subtitle ?? null;
  if (data.thumbnailUrl !== undefined) input.thumbnailUrl = data.thumbnailUrl ?? null;
  if (data.platform !== undefined) input.platform = data.platform;
  if (data.destinationUrl !== undefined) input.destinationUrl = data.destinationUrl;
  if (data.isActive !== undefined) input.isActive = data.isActive;
  if (data.cloakEnabled !== undefined) input.cloakEnabled = data.cloakEnabled;
  if (data.appearance !== undefined) input.appearance = data.appearance;
  const safePage = paraSafePage(data);
  if (safePage !== undefined) input.safePage = safePage;
  return input;
}

export default function LinksPage() {
  const router = useRouter();
  const [links, setLinks] = useState<Link[]>([]);
  const [profile, setProfile] = useState({
    displayName: "",
    slug: "",
    bio: "",
    avatarUrl: null as string | null,
    coverUrl: null as string | null,
    // Vão para a prévia dentro do modal. Antes ela lia `MOCK_USER`, então a
    // prévia mostrava o tema do perfil de mentira em cima dos links reais.
    themeId: "neon-pink",
    buttonStyle: "soft",
  });
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [initialTab, setInitialTab] = useState<ModalTab>("link");

  /** Sessão inválida vira ida ao login, não "erro ao carregar".
   *
   *  O middleware só olha se o COOKIE existe (ele não valida assinatura nem
   *  consulta o banco — isso é papel da API). Um cookie expirado passa por
   *  ele, e é aqui que a expiração é percebida. */
  const handleError = useCallback(
    (caught: unknown, fallback: string) => {
      if (caught instanceof ApiError && caught.isUnauthorized) {
        router.replace("/login?de=/links");
        return;
      }
      toast.error(caught instanceof ApiError ? caught.message : fallback);
    },
    [router],
  );

  useEffect(() => {
    let cancelado = false;

    (async () => {
      try {
        // Em paralelo: são duas leituras independentes e a tela precisa das
        // duas para renderizar (a prévia do modal mostra o perfil).
        const [apiLinks, apiProfile] = await Promise.all([api.links(), api.profile()]);
        if (cancelado) return;
        setLinks(apiLinks.map(toUiLink));
        setProfile({
          displayName: apiProfile.displayName,
          slug: apiProfile.slug,
          bio: apiProfile.bio,
          avatarUrl: apiProfile.avatarUrl,
          coverUrl: apiProfile.coverUrl,
          themeId: apiProfile.themeId,
          buttonStyle: apiProfile.buttonStyle,
        });
      } catch (caught) {
        if (!cancelado) handleError(caught, "Não foi possível carregar seus links.");
      } finally {
        if (!cancelado) setLoading(false);
      }
    })();

    return () => {
      cancelado = true;
    };
  }, [handleError]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const openModal = (tab: ModalTab = "link") => {
    setInitialTab(tab);
    setModalOpen(true);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    // Com rascunho na lista, reordenar não pode ir para a API: ela exige a
    // ordem COMPLETA e em ids que existem. A nova ordem fica na tela e é
    // gravada no próximo arraste depois de o rascunho virar link.
    if (links.some((l) => !ehIdDaApi(l.id))) {
      const oldIdx = links.findIndex((l) => l.id === active.id);
      const newIdx = links.findIndex((l) => l.id === over.id);
      setLinks(arrayMove(links, oldIdx, newIdx).map((item, idx) => ({ ...item, position: idx })));
      toast.info("Termine de preencher o link novo para salvar a ordem.");
      return;
    }

    const anterior = links;
    const oldIndex = links.findIndex((l) => l.id === active.id);
    const newIndex = links.findIndex((l) => l.id === over.id);
    const reordenados = arrayMove(links, oldIndex, newIndex).map((item, idx) => ({
      ...item,
      position: idx,
    }));

    setLinks(reordenados);

    try {
      // A API renumera 0..n-1 numa transação e exige a lista COMPLETA: ordem
      // parcial deixaria dois links na mesma posição, o que é ordem indefinida
      // na página pública.
      const salvos = await api.reorderLinks(reordenados.map((l) => l.id));
      setLinks(salvos.map(toUiLink));
      toast.success("Ordem atualizada!");
    } catch (caught) {
      setLinks(anterior);
      handleError(caught, "Não foi possível salvar a nova ordem.");
    }
  };

  /**
   * Salvar link, com um caso especial que vale explicar.
   *
   * O modal em modo lista cria um **rascunho** quando a pessoa escolhe uma
   * plataforma: uma linha na lista, com título, sem destino, para ela digitar a
   * URL ali mesmo. Esse rascunho não pode ir para a API — link sem destino é um
   * botão que não leva a lugar nenhum, e o banco recusa (`CHECK` de esquema
   * http/https).
   *
   * Então o rascunho vive só no estado desta tela, identificado por um id
   * provisório (`l<timestamp>`, que não é UUID), e é criado de verdade no
   * momento em que o destino aparece. Quando isso acontece, o id provisório é
   * trocado pelo id real na MESMA posição da lista, para a linha não pular de
   * lugar debaixo do cursor de quem está digitando.
   */
  const handleSaveLink = async (linkData: Partial<Link>) => {
    const idAtual = linkData.id;
    const jaExisteNaApi = Boolean(idAtual && ehIdDaApi(idAtual));
    const temDestino = Boolean(linkData.destinationUrl?.trim());

    // Na CRIAÇÃO, o payload é mesclado com o rascunho que está na tela.
    //
    // O rascunho guarda escolhas que o salvamento seguinte não reenvia: a linha
    // da lista só emite título, subtítulo, destino, miniatura e status no blur —
    // a PLATAFORMA foi escolhida no seletor, um passo antes. Sem a mesclagem o
    // link nasce como "custom" e a criadora perde o canal que acabou de
    // escolher, junto com o ícone e a cor do botão.
    //
    // Na EDIÇÃO a mesclagem não acontece: ali vale mandar só o que mudou, ou
    // cada blur de campo reenviaria a miniatura inteira em base64.
    const rascunho = idAtual ? links.find((l) => l.id === idAtual) : undefined;
    const dadosParaCriar: Partial<Link> = rascunho ? { ...rascunho, ...linkData } : linkData;

    // Rascunho sem destino: mantém local e não chama a API.
    if (!jaExisteNaApi && !temDestino) {
      const id = idAtual ?? `l${Date.now()}`;
      setLinks((prev) => {
        const existe = prev.some((l) => l.id === id);
        if (existe) {
          return prev.map((l) => (l.id === id ? { ...l, ...linkData, id } : l));
        }
        return [
          { ...(linkData as Link), id, position: 0 },
          ...prev.map((l) => ({ ...l, position: l.position + 1 })),
        ];
      });
      return;
    }

    try {
      if (jaExisteNaApi) {
        const salvo = await api.updateLink(idAtual as string, paraEdicao(linkData));
        setLinks((prev) => prev.map((l) => (l.id === salvo.id ? toUiLink(salvo) : l)));
      } else {
        const criado = await api.createLink(paraCriacao(dadosParaCriar));

        setLinks((prev) => {
          const posicaoDoRascunho = prev.findIndex((l) => l.id === idAtual);
          if (posicaoDoRascunho >= 0) {
            // Promove o rascunho no lugar onde ele já está.
            const copia = [...prev];
            copia[posicaoDoRascunho] = toUiLink(criado);
            return copia;
          }
          // Link novo entra no topo (a API já o cria em position 0 e empurra os
          // outros); refletir isso aqui evita um segundo GET.
          return [toUiLink(criado), ...prev.map((l) => ({ ...l, position: l.position + 1 }))];
        });
      }
    } catch (caught) {
      handleError(caught, "Não foi possível salvar o link.");
    }
  };

  const handleDeleteLink = async (id: string) => {
    const anterior = links;
    setLinks((prev) => prev.filter((l) => l.id !== id));

    // Rascunho nunca existiu na API: apagar é só tirar da lista. Chamar
    // `deleteLink` com id provisório voltaria 404 e a linha reapareceria.
    if (!ehIdDaApi(id)) return;

    try {
      await api.deleteLink(id);
    } catch (caught) {
      setLinks(anterior);
      handleError(caught, "Não foi possível deletar o link.");
    }
  };

  const handleToggleActive = async (id: string, isActive: boolean) => {
    const anterior = links;
    setLinks((prev) => prev.map((l) => (l.id === id ? { ...l, isActive } : l)));
    toast.success(isActive ? "Link ativado!" : "Link desativado!");

    if (!ehIdDaApi(id)) return;

    try {
      await api.updateLink(id, { isActive });
    } catch (caught) {
      setLinks(anterior);
      handleError(caught, "Não foi possível mudar o status do link.");
    }
  };

  const handleSaveProfile = async (data: ProfileData) => {
    const anterior = profile;
    setProfile((prev) => ({ ...prev, ...data }));

    try {
      const salvo = await api.updateProfile({
        displayName: data.displayName,
        slug: data.slug,
        bio: data.bio,
        avatarUrl: data.avatarUrl,
        coverUrl: data.coverUrl,
      });
      setProfile({
        displayName: salvo.displayName,
        slug: salvo.slug,
        bio: salvo.bio,
        avatarUrl: salvo.avatarUrl,
        coverUrl: salvo.coverUrl,
        themeId: salvo.themeId,
        buttonStyle: salvo.buttonStyle,
      });
      // O nome e o slug aparecem na Sidebar, que tem cache próprio da sessão.
      invalidateSession();
      toast.success("Perfil salvo!");
    } catch (caught) {
      setProfile(anterior);
      handleError(caught, "Não foi possível salvar o perfil.");
    }
  };

  return (
    <div className="min-h-screen px-6 py-8 lg:px-10">
      <Toaster position="top-center" richColors />

      {/* Header */}
      <div className="max-w-3xl mx-auto mb-8">
        <div className="mb-6">
          <h1 className="font-bebas text-[36px] uppercase tracking-widest text-white leading-none mb-1">
            MEUS LINKS
          </h1>
          <p className="text-xs text-white/25 tracking-wide uppercase font-medium">
            Arraste para reordenar · Clique para editar
          </p>
        </div>

        <div className="flex items-center justify-end">
          <button
            onClick={() => openModal("link")}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-bold uppercase tracking-wider focus:outline-none transition-all duration-200"
            style={{ background: "linear-gradient(135deg,#FF3C6E,#FF1F57)", boxShadow: "0 4px 20px rgba(255,60,110,0.3),inset 0 1px 0 rgba(255,255,255,0.15)" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = "0 6px 28px rgba(255,60,110,0.45),inset 0 1px 0 rgba(255,255,255,0.15)"; (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 20px rgba(255,60,110,0.3),inset 0 1px 0 rgba(255,255,255,0.15)"; (e.currentTarget as HTMLElement).style.transform = "translateY(0)"; }}
          >
            <Plus className="w-4 h-4" />
            GERENCIAR LINKS
          </button>
        </div>
      </div>

      {/* Lista */}
      <div className="max-w-3xl mx-auto">
        {loading ? (
          // Sem este estado a tela pisca "Nenhum link ainda" a cada abertura do
          // painel, enquanto a requisição está no ar — e sugere à criadora que
          // ela perdeu tudo.
          <div className="flex items-center justify-center py-20 gap-3 text-bee-muted">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm">Carregando seus links...</span>
          </div>
        ) : links.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-16 h-16 rounded-full bg-bee-surface flex items-center justify-center mb-4">
              <LinkIcon className="w-8 h-8 text-[#333]" />
            </div>
            <h3 className="font-bebas text-2xl text-white mb-2">Nenhum link ainda</h3>
            <p className="text-sm text-bee-muted mb-6">Clique em "Gerenciar Links" para adicionar</p>
            <button
              onClick={() => openModal("link")}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-bold uppercase tracking-wider"
              style={{ background: "linear-gradient(135deg,#FF3C6E,#FF1F57)", boxShadow: "0 4px 20px rgba(255,60,110,0.3)" }}
            >
              <Plus className="w-4 h-4" />
              Adicionar link
            </button>
          </div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={links.map((l) => l.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-3">
                {links.map((link) => (
                  <LinkCard
                    key={link.id}
                    link={link}
                    profileSlug={profile.slug}
                    onOpenModal={() => openModal("link")}
                    onEditAppearance={() => openModal("aparencia")}
                    onDelete={handleDeleteLink}
                    onToggleActive={handleToggleActive}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>

      {/* Modal — full link manager with live preview */}
      <LinkModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleSaveLink}
        onDelete={handleDeleteLink}
        onSaveProfile={handleSaveProfile}
        initialTab={initialTab}
        allLinks={links}
        profileData={profile}
      />
    </div>
  );
}
