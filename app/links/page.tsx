"use client";

import React, { useState } from "react";
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
import { Plus, Link as LinkIcon } from "lucide-react";
import { toast, Toaster } from "sonner";
import { LinkCard } from "@/components/dashboard/LinkCard";
import { LinkModal, ModalTab } from "@/components/dashboard/LinkModal";
import { MOCK_LINKS, Link, MOCK_USER } from "@/lib/mock-data";

export default function LinksPage() {
  const [links, setLinks] = useState<Link[]>(
    [...MOCK_LINKS].sort((a, b) => a.position - b.position)
  );
  const [modalOpen, setModalOpen] = useState(false);
  const [initialTab, setInitialTab] = useState<ModalTab>("link");
  const [profile, setProfile] = useState({
    displayName: MOCK_USER.displayName,
    slug: MOCK_USER.slug,
    bio: MOCK_USER.bio,
    avatarUrl: MOCK_USER.avatarUrl as string | null,
    coverUrl: MOCK_USER.coverUrl as string | null,
  });

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const openModal = (tab: ModalTab = "link") => {
    setInitialTab(tab);
    setModalOpen(true);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setLinks((items) => {
        const oldIndex = items.findIndex((i) => i.id === active.id);
        const newIndex = items.findIndex((i) => i.id === over.id);
        return arrayMove(items, oldIndex, newIndex).map((item, idx) => ({ ...item, position: idx }));
      });
      toast.success("Ordem atualizada!");
    }
  };

  const handleSaveLink = (linkData: Partial<Link>) => {
    if (linkData.id) {
      setLinks((prev) => {
        const exists = prev.find((l) => l.id === linkData.id);
        if (exists) return prev.map((l) => (l.id === linkData.id ? { ...l, ...linkData } : l));
        return [{ ...(linkData as Link), position: 0 }, ...prev.map((l) => ({ ...l, position: l.position + 1 }))];
      });
    }
  };

  const handleDeleteLink = (id: string) => {
    setLinks((prev) => prev.filter((l) => l.id !== id));
    toast.success("Link deletado!");
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
        {links.length === 0 ? (
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
                    onOpenModal={() => openModal("link")}
                    onEditAppearance={() => openModal("aparencia")}
                    onDelete={handleDeleteLink}
                    onToggleActive={(id, isActive) => {
                      setLinks((prev) => prev.map((l) => (l.id === id ? { ...l, isActive } : l)));
                      toast.success(isActive ? "Link ativado!" : "Link desativado!");
                    }}
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
        onSaveProfile={(data) => setProfile(data)}
        initialTab={initialTab}
        allLinks={links}
        profileData={profile}
      />
    </div>
  );
}
