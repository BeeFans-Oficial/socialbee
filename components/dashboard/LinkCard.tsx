"use client";

import React from "react";
import { motion } from "framer-motion";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Palette, Copy, Trash2, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Link } from "@/lib/catalog";
import { getPlatformColor, getPlatformIcon } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { profileUrl, siteHost } from "@/lib/site";

// ── Mini Toggle ───────────────────────────────────────────────────────────────

function MiniToggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onChange(!checked); }}
      className="relative flex-shrink-0 focus:outline-none"
      style={{
        width: 36, height: 20, borderRadius: 999,
        background: checked ? "rgba(74,222,128,0.2)" : "rgba(255,255,255,0.07)",
        border: checked ? "1px solid rgba(74,222,128,0.35)" : "1px solid rgba(255,255,255,0.1)",
        transition: "background 0.25s, border-color 0.25s",
      }}
    >
      <motion.div layout transition={{ type: "spring", stiffness: 600, damping: 35 }}
        className="absolute top-0.5"
        style={{
          left: checked ? "calc(100% - 17px)" : 2,
          width: 14, height: 14, borderRadius: "50%",
          background: checked ? "#4ade80" : "#555",
          boxShadow: checked ? "0 0 8px rgba(74,222,128,0.6)" : "none",
        }} />
    </button>
  );
}

// ── LinkCard ──────────────────────────────────────────────────────────────────

interface LinkCardProps {
  link: Link;
  /** Slug do perfil da sessão. É o que o cartão exibe e o que o botão de copiar
   *  entrega — não o código curto do link. Ver o comentário em `enderecoPublico`. */
  profileSlug: string;
  onOpenModal: (link: Link) => void;
  onEditAppearance: (link: Link) => void;
  onDelete: (id: string) => void;
  onToggleActive: (id: string, isActive: boolean) => void;
}

export function LinkCard({ link, profileSlug, onOpenModal, onEditAppearance, onDelete, onToggleActive }: LinkCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: link.id });

  const platformColor = getPlatformColor(link.platform);
  const platformIcon = getPlatformIcon(link.platform);
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
  const enderecoPublico = profileSlug ? `${siteHost()}/${profileSlug}` : "";

  const destinationDomain = (() => {
    if (!link.destinationUrl) return null;
    try { return new URL(link.destinationUrl).hostname.replace(/^www\./, ""); }
    catch { return link.destinationUrl.replace(/^https?:\/\/(www\.)?/, "").split("/")[0] || null; }
  })();

  const appearanceColor = link.appearance?.color ?? platformColor;

  return (
    <motion.div
      ref={setNodeRef}
      whileHover={!isDragging ? { y: -1 } : {}}
      className={cn("group relative rounded-2xl transition-colors duration-200", !link.isActive && "opacity-45", isDragging && "z-50")}
      style={{
        transform: CSS.Transform.toString(transform),
        transition: isDragging ? undefined : (transition ?? undefined),
        background: isDragging ? "rgba(255,60,110,0.07)" : "rgba(255,255,255,0.025)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        border: isDragging ? "1px solid rgba(255,60,110,0.45)" : "1px solid rgba(255,255,255,0.07)",
        boxShadow: isDragging ? "0 24px 60px rgba(0,0,0,0.55)" : "0 2px 16px rgba(0,0,0,0.18)",
      }}
    >
      {/* Appearance accent strip */}
      {link.appearance && (
        <div className="absolute top-0 left-6 right-6 h-px rounded-full opacity-60"
          style={{ background: link.appearance.useGradient ? `linear-gradient(90deg,${link.appearance.color},${link.appearance.gradientTo})` : link.appearance.color }} />
      )}

      <div className="relative flex items-center gap-3 px-4 py-3.5">
        {/* Drag Handle */}
        <button {...attributes} {...listeners}
          className="text-white/10 hover:text-white/40 cursor-grab active:cursor-grabbing transition-colors flex-shrink-0 focus:outline-none">
          <GripVertical className="w-4 h-4" />
        </button>

        {/* Thumbnail or Icon */}
        <div className="w-10 h-10 rounded-xl flex-shrink-0 overflow-hidden flex items-center justify-center text-base"
          style={{ background: `${platformColor}18`, border: `1px solid ${platformColor}35` }}>
          {link.thumbnailUrl
            ? <img src={link.thumbnailUrl} alt={link.title} className="w-full h-full object-cover" />
            : platformIcon}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0 cursor-pointer" onClick={() => onOpenModal(link)}>
          <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium"
              style={{ backgroundColor: `${platformColor}18`, color: platformColor, border: `1px solid ${platformColor}30` }}>
              {link.platform}
            </span>
            {link.cloakEnabled && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-bee-pink/10 text-bee-pink border border-bee-pink/20">
                🔐 Cloaking
              </span>
            )}
            {link.appearance && link.appearance.style !== "soft" && (
              <span className="text-[10px] px-2 py-0.5 rounded-full"
                style={{ background: `${appearanceColor}15`, color: appearanceColor, border: `1px solid ${appearanceColor}28` }}>
                ● {link.appearance.style}
              </span>
            )}
          </div>
          <div className="font-semibold text-sm text-white leading-tight truncate">{link.title}</div>
          {link.subtitle && <div className="text-[11px] text-white/35 truncate">{link.subtitle}</div>}
          <div className="flex items-center gap-2 mt-0.5">
            {enderecoPublico && (
              <span className="text-[11px] text-white/20 truncate font-mono">{enderecoPublico}</span>
            )}
            {destinationDomain && (
              <span className="flex items-center gap-0.5 flex-shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded-full"
                style={{ color: `${platformColor}cc`, background: `${platformColor}12`, border: `1px solid ${platformColor}25` }}>
                <ExternalLink style={{ width: 8, height: 8, flexShrink: 0 }} />
                {destinationDomain}
              </span>
            )}
          </div>
        </div>

        {/* Clicks */}
        <div className="text-right flex-shrink-0 hidden sm:block">
          <div className="text-sm font-semibold text-white/70">{link.clicks.toLocaleString()}</div>
          <div className="text-[10px] text-white/25">clicks</div>
        </div>

        {/* Toggle */}
        <MiniToggle checked={link.isActive} onChange={(v) => onToggleActive(link.id, v)} />

        <div className="w-px h-6 bg-white/[0.06] flex-shrink-0" />

        {/* Actions */}
        <div className="flex items-center gap-0.5">
          <button
            onClick={(e) => { e.stopPropagation(); onEditAppearance(link); }}
            className="p-2 rounded-lg transition-all focus:outline-none"
            title="Personalizar aparência"
            style={{ color: link.appearance ? appearanceColor : "rgba(255,255,255,0.25)" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = `${appearanceColor}18`; (e.currentTarget as HTMLElement).style.color = appearanceColor; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = link.appearance ? appearanceColor : "rgba(255,255,255,0.25)"; }}
          >
            <Palette className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (!profileSlug) return;
              // `profileUrl` usa a origem de onde a página foi servida, então o
              // link copiado funciona até acessando pelo IP da rede local para
              // testar no celular.
              navigator.clipboard.writeText(profileUrl(profileSlug));
              toast.success("Link do seu perfil copiado!");
            }}
            disabled={!profileSlug}
            title={profileSlug ? `Copiar ${enderecoPublico}` : "Carregando seu perfil..."}
            className="p-2 text-white/25 hover:text-bee-pink rounded-lg hover:bg-bee-pink/[0.08] transition-all focus:outline-none disabled:opacity-40 disabled:cursor-default disabled:hover:text-white/25 disabled:hover:bg-transparent">
            <Copy className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); if (window.confirm("Deletar este link?")) { onDelete(link.id); toast.success("Link deletado!"); } }}
            className="p-2 text-white/25 hover:text-red-400 rounded-lg hover:bg-red-500/[0.08] transition-all focus:outline-none">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
