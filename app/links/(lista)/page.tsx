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
import { EscolhaDePagina } from "@/components/dashboard/EscolhaDePagina";
import { LinkCard } from "@/components/dashboard/LinkCard";
import { MetricasDoLink } from "@/components/dashboard/MetricasDoLink";
import { avisarPro } from "@/components/shared/SeloPro";
import { Link } from "@/lib/catalog";
import { api, ApiError } from "@/lib/api/client";
import { usePlano } from "@/lib/api/use-session";
import type { ApiLink } from "@/lib/api/types";

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

export default function LinksPage() {
  const router = useRouter();
  const [links, setLinks] = useState<Link[]>([]);
  /** Endereço desta página (slug e domínio resolvido pela API). É o que o
   *  botão de copiar de cada link entrega — ver `LinkCard`. */
  const [profile, setProfile] = useState({ slug: "", host: "" });
  const [loading, setLoading] = useState(true);

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
        // Em paralelo: são duas leituras independentes, e o endereço da página
        // é o que o botão de copiar de cada link entrega.
        const [apiLinks, apiProfile] = await Promise.all([api.links(), api.profile()]);
        if (cancelado) return;
        setLinks(apiLinks.map(toUiLink));
        setProfile({ slug: apiProfile.slug, host: apiProfile.host });
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

  /** A paleta abre o editor DO link (`/links/[id]`). */
  const abrirEditor = (linkId: string) => router.push(`/links/${linkId}`);

  /** Os cliques abrem as métricas do link — relatório, então do Pro. */
  const { ehPro } = usePlano();
  const [metricasDe, setMetricasDe] = useState<Link | null>(null);
  const verMetricas = (link: Link) => (ehPro ? setMetricasDe(link) : avisarPro("As métricas do link"));

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


  return (
    <div className="min-h-screen px-4 sm:px-8 py-8">
      <Toaster position="top-center" richColors />
      <MetricasDoLink link={metricasDe} onFechar={() => setMetricasDe(null)} />

      {/* Cabeçalho */}
      <div className="max-w-3xl mx-auto mb-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-semibold text-white">Links</h1>
          <p className="text-sm text-bee-muted mt-1">
            {loading
              ? "Carregando…"
              : `${links.length} ${links.length === 1 ? "link" : "links"} · arraste para reordenar`}
          </p>
        </div>
        <div className="self-start sm:self-auto flex items-center gap-2">
          {/* De qual página são estes links — e a troca, aqui mesmo. */}
          <EscolhaDePagina />
          <button
            onClick={() => router.push("/links/novo")}
            className="flex items-center gap-2 h-10 px-4 rounded-lg bg-bee-pink hover:bg-bee-pink-hot text-white text-sm font-semibold transition-colors"
          >
            <Plus className="w-4 h-4" />
            Novo link
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
            <h3 className="text-lg font-semibold text-white mb-1">Nenhum link ainda</h3>
            <p className="text-sm text-bee-muted mb-6">Clique em "Novo link" para adicionar o primeiro</p>
            <button
              onClick={() => router.push("/links/novo")}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-bee-pink hover:bg-bee-pink-hot text-white text-sm font-semibold transition-colors"
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
                    profileHost={profile.host}
                    onVerMetricas={verMetricas}
                    onEditar={() => abrirEditor(link.id)}
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
    </div>
  );
}
