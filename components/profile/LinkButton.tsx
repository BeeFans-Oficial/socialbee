"use client";

import React from "react";
import { motion } from "framer-motion";
import { ChevronRight } from "lucide-react";
import { LinkAppearance, DEFAULT_LINK_APPEARANCE } from "@/lib/mock-data";

interface LinkButtonProps {
  link: {
    id: string;
    title: string;
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
  index: number;
  onClick: () => void;
}

export function LinkButton({ link, icon, accentColor, buttonStyle: profileButtonStyle, index, onClick }: LinkButtonProps) {
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
    </motion.button>
  );
}
