"use client";

import React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Palette, Copy, Trash2, Shield } from "lucide-react";
import { toast } from "sonner";
import { IconeDePlataforma } from "@/components/shared/IconeDePlataforma";
import { PLATFORMS, type Link } from "@/lib/catalog";
import { cn } from "@/lib/utils";
import { urlDaPagina } from "@/lib/site";

// ── Mini Toggle ───────────────────────────────────────────────────────────────

function MiniToggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={checked ? "Link ativo" : "Link desativado"}
      onClick={(e) => { e.stopPropagation(); onChange(!checked); }}
      className={cn(
        "relative flex-shrink-0 w-9 h-5 rounded-full transition-colors focus:outline-none",
        checked ? "bg-white" : "bg-white/10",
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 w-4 h-4 rounded-full transition-all",
          checked ? "left-[18px] bg-bee-bg" : "left-0.5 bg-white/50",
        )}
      />
    </button>
  );
}

// ── LinkCard ──────────────────────────────────────────────────────────────────

interface LinkCardProps {
  link: Link;
  /** Slug do perfil da sessão. É o que o cartão exibe e o que o botão de copiar
   *  entrega — não o código curto do link. Ver o comentário em `enderecoPublico`. */
  profileSlug: string;
  /** Domínio em que ESTA página é servida, resolvido pela API (`profile.host`).
   *
   *  Vem por prop em vez de sair de `siteHost()` porque o valor de build é o
   *  mesmo para todas as páginas — e com o pool de domínios ele estaria errado
   *  justamente para quem escolheu outro endereço. Errar aqui é a criadora
   *  colar na bio um link que não leva à página dela. */
  profileHost: string;
  /** Clique nos números: abre as métricas deste link. */
  onVerMetricas: (link: Link) => void;
  /** Paleta: abre o editor do link (aparência, destino, proteção). */
  onEditar: (link: Link) => void;
  onDelete: (id: string) => void;
  onToggleActive: (id: string, isActive: boolean) => void;
}

export function LinkCard({ link, profileSlug, profileHost, onVerMetricas, onEditar, onDelete, onToggleActive }: LinkCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: link.id });

  /**
   * O endereço que a criadora vê e copia.
   *
   * Era `host/r/<código curto>`. Virou `host/<slug>` porque é o endereço que
   * ela realmente divulga: o `/r/<código>` é o redirecionador que a PÁGINA dela
   * usa por dentro para contar o clique, não um link de bio. Oferecer o código
   * opaco no botão de copiar fazia ela colar na bio uma URL que leva a um único
   * destino, sem a página, sem os outros links e sem o gate de idade.
   *
   * O código curto continua existindo e funcionando — só deixou de ser a coisa
   * que a interface entrega.
   */
  const enderecoPublico = profileSlug && profileHost ? `${profileHost}/${profileSlug}` : "";

  const destinationDomain = (() => {
    if (!link.destinationUrl) return null;
    try { return new URL(link.destinationUrl).hostname.replace(/^www\./, ""); }
    catch { return link.destinationUrl.replace(/^https?:\/\/(www\.)?/, "").split("/")[0] || null; }
  })();

  const nomeDaPlataforma = PLATFORMS.find((p) => p.id === link.platform)?.label ?? link.platform;

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "group relative rounded-xl border bg-bee-surface transition-colors",
        isDragging ? "z-50 border-white/25 shadow-2xl" : "border-white/[0.06] hover:border-white/15",
        !link.isActive && "opacity-50",
      )}
      style={{
        transform: CSS.Transform.toString(transform),
        transition: isDragging ? undefined : (transition ?? undefined),
      }}
    >
      <div className="flex items-center gap-3 px-3 sm:px-4 py-3">
        <button
          {...attributes}
          {...listeners}
          aria-label="Arrastar para reordenar"
          className="text-white/15 hover:text-white/45 cursor-grab active:cursor-grabbing transition-colors flex-shrink-0 focus:outline-none"
        >
          <GripVertical className="w-4 h-4" />
        </button>

        <div className="w-9 h-9 rounded-lg flex-shrink-0 overflow-hidden flex items-center justify-center bg-white/[0.04] border border-white/[0.06]">
          {link.thumbnailUrl ? (
            <img src={link.thumbnailUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <IconeDePlataforma plataforma={link.platform} className="w-4 h-4 text-white/55" />
          )}
        </div>

        {/* A linha em si não é clicável: as ações são os controles à direita. */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-sm font-medium text-white truncate">{link.title}</span>
            {link.cloakEnabled && (
              <span
                title="Cloaking ligado"
                className="flex items-center gap-1 px-1.5 py-0.5 rounded-md border border-white/10 text-[10px] text-white/50 flex-shrink-0"
              >
                <Shield className="w-3 h-3" />
                Cloaking
              </span>
            )}
          </div>
          <div className="mt-0.5 text-xs text-bee-muted truncate">
            {nomeDaPlataforma}
            {destinationDomain && <span className="text-white/25"> · </span>}
            {destinationDomain}
          </div>
        </div>

        <button
          type="button"
          onClick={() => onVerMetricas(link)}
          title="Ver as métricas deste link"
          className="text-right flex-shrink-0 hidden sm:block w-16 px-2 py-1 rounded-lg hover:bg-white/[0.05] transition-colors focus:outline-none"
        >
          <div className="text-sm font-medium text-white/80 tabular-nums">{link.clicks.toLocaleString("pt-BR")}</div>
          <div className="text-[10px] text-bee-muted underline decoration-dotted underline-offset-2">cliques</div>
        </button>

        <MiniToggle checked={link.isActive} onChange={(v) => onToggleActive(link.id, v)} />

        <div className="flex items-center flex-shrink-0">
          <button
            onClick={(e) => { e.stopPropagation(); onEditar(link); }}
            title="Editar link"
            className="p-2 rounded-lg text-white/35 hover:text-white hover:bg-white/[0.05] transition-colors focus:outline-none"
          >
            <Palette className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (!profileSlug || !profileHost) return;
              // O endereço vai no DOMÍNIO DA PÁGINA, não na origem de onde o
              // painel foi servido: ela edita em beesocial.bio e a página dela
              // pode viver em outro domínio do pool.
              navigator.clipboard.writeText(urlDaPagina(profileHost, profileSlug));
              toast.success("Link da página copiado.");
            }}
            disabled={!profileSlug || !profileHost}
            title={enderecoPublico ? `Copiar ${enderecoPublico}` : "Carregando..."}
            className="p-2 rounded-lg text-white/35 hover:text-white hover:bg-white/[0.05] transition-colors focus:outline-none disabled:opacity-40"
          >
            <Copy className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); if (window.confirm("Apagar este link?")) { onDelete(link.id); toast.success("Link apagado."); } }}
            title="Apagar"
            className="p-2 rounded-lg text-white/35 hover:text-red-400 hover:bg-red-500/[0.06] transition-colors focus:outline-none"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
