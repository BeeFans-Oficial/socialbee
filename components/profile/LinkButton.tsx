"use client";

import React from "react";
import { motion } from "framer-motion";
import { ChevronRight } from "lucide-react";
import { LinkAppearance, DEFAULT_LINK_APPEARANCE } from "@/lib/catalog";

interface LinkButtonProps {
  link: {
    id: string;
    title: string;
    /** Editável no painel desde sempre, e até o template "Cartões" existir
     *  NUNCA renderizado: este componente nem recebia o campo. */
    subtitle?: string | null;
    thumbnailUrl?: string | null;
    platform: string;
    shortCode: string;
    cloakEnabled: boolean;
    appearance?: LinkAppearance;
  };
  icon: string;
  /** fallback accent from profile theme, used when link has no appearance */
  accentColor: string;
  /** fallback button style from profile settings */
  buttonStyle: string;
  /** O template pede miniatura e subtítulo (`cartoes`). Fora dele o botão é a
   *  linha de sempre — a informação existe, mas não cabe numa lista estreita. */
  detalhes?: boolean;
  index: number;
  onClick: () => void;
}

export function LinkButton({
  link,
  icon,
  accentColor,
  buttonStyle: profileButtonStyle,
  detalhes = false,
  index,
  onClick,
}: LinkButtonProps) {
  // Per-link appearance takes priority over profile-wide settings
  const appearance: LinkAppearance = link.appearance ?? {
    ...DEFAULT_LINK_APPEARANCE,
    style: (profileButtonStyle as LinkAppearance["style"]) ?? "soft",
    color: accentColor,
  };

  const { style, color, useGradient, gradientTo, glow, showIcon, showArrow } = appearance;
  const isPill = style === "pill";
  const radius = isPill ? "rounded-full" : "rounded-xl";

  const bg = (() => {
    switch (style) {
      case "filled":
        return useGradient ? `linear-gradient(135deg, ${color}, ${gradientTo})` : color;
      case "soft":
      case "pill":
        return useGradient ? `linear-gradient(135deg, ${color}28, ${gradientTo}28)` : `${color}22`;
      case "glass":
        return "rgba(255,255,255,0.06)";
      case "outlined":
        return "transparent";
    }
  })();

  const borderStyle = (() => {
    switch (style) {
      case "filled": return "none";
      case "soft": case "pill": return `1px solid ${color}44`;
      case "glass": return "1px solid rgba(255,255,255,0.1)";
      case "outlined": return `2px solid ${color}`;
    }
  })();

  const textColor = style === "filled" ? "#fff" : color;

  const boxShadow = glow
    ? `0 4px 24px ${color}55, 0 0 0 1px ${color}22`
    : style === "filled"
    ? `0 4px 16px ${color}35`
    : undefined;

  return (
    <motion.button
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08, duration: 0.3 }}
      onClick={onClick}
      className={`relative w-full overflow-hidden cursor-pointer transition-all ${radius}`}
      style={{ background: bg, border: borderStyle, boxShadow, backdropFilter: style === "glass" ? "blur(12px)" : undefined }}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      {/* Cloak badge */}
      {link.cloakEnabled && (
        <div className="absolute top-1 right-8 z-10">
          <span className="text-[10px] opacity-50">🔐</span>
        </div>
      )}

      {detalhes ? (
        /* Cartão: miniatura em cima, texto embaixo. O alinhamento é à esquerda
           porque com subtítulo o bloco vira texto corrido, e texto corrido
           centralizado é mais difícil de ler. */
        <div className="flex flex-col text-left">
          <div className="w-full aspect-[16/10] bg-black/20 overflow-hidden flex items-center justify-center">
            {link.thumbnailUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- data URL
              // vinda do banco, como o avatar.
              <img src={link.thumbnailUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="text-3xl opacity-40">{icon}</span>
            )}
          </div>
          <div className="px-3 py-2.5">
            <div className="text-sm font-semibold leading-tight" style={{ color: textColor }}>
              {link.title}
            </div>
            {link.subtitle && (
              <div className="text-[11px] mt-0.5 line-clamp-2" style={{ color: `${textColor}99` }}>
                {link.subtitle}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="grid items-center gap-2 py-4 px-4"
          style={{ gridTemplateColumns: showIcon ? "48px 1fr 24px" : "1fr 24px" }}>
          {showIcon && (
            <div className="flex items-center justify-center">
              <div className="w-9 h-9 flex items-center justify-center text-2xl">{icon}</div>
            </div>
          )}
          <div className="flex items-center justify-center">
            <span className="text-sm font-semibold" style={{ color: textColor }}>{link.title}</span>
          </div>
          {showArrow && (
            <div className="flex items-center justify-center">
              <ChevronRight className="w-4 h-4" style={{ color: `${textColor}80` }} />
            </div>
          )}
        </div>
      )}
    </motion.button>
  );
}
