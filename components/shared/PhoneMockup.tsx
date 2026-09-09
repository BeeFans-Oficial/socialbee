"use client";

import React from "react";
import { Link, LinkAppearance, DEFAULT_LINK_APPEARANCE } from "@/lib/catalog";
import { getPlatformColor, getPlatformIcon } from "@/lib/utils";
import { ChevronRight } from "lucide-react";

interface PhoneMockupProps {
  themeBg: string;
  themeAccent: string;
  coverGradient?: string;
  avatarUrl?: string | null;
  displayName: string;
  bio: string;
  buttonStyle: string;
  showAgeBadge?: boolean;
  links?: Link[];
}

function getInitials(name: string): string {
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

// Renders a single link button inside the phone, using its LinkAppearance
function PhoneLinkButton({ link, fallbackAccent, fallbackStyle }: {
  link: Link;
  fallbackAccent: string;
  fallbackStyle: string;
}) {
  const icon = getPlatformIcon(link.platform);
  const platformColor = getPlatformColor(link.platform);

  const app: LinkAppearance = link.appearance ?? {
    ...DEFAULT_LINK_APPEARANCE,
    style: fallbackStyle as LinkAppearance["style"],
    color: fallbackAccent || platformColor,
  };

  const { style, color, useGradient, gradientTo, glow, showIcon, showArrow } = app;
  const isPill = style === "pill";

  const bg = (() => {
    switch (style) {
      case "filled":   return useGradient ? `linear-gradient(135deg,${color},${gradientTo})` : color;
      case "soft":
      case "pill":     return useGradient ? `linear-gradient(135deg,${color}28,${gradientTo}28)` : `${color}22`;
      case "glass":    return "rgba(255,255,255,0.07)";
      case "outlined": return "transparent";
    }
  })();

  const border = (() => {
    switch (style) {
      case "filled":   return "none";
      case "soft":
      case "pill":     return `1px solid ${color}44`;
      case "glass":    return "1px solid rgba(255,255,255,0.14)";
      case "outlined": return `2px solid ${color}`;
    }
  })();

  const textColor = style === "filled" ? "#fff" : color;

  return (
    <div
      className="flex items-center gap-2 w-full select-none"
      style={{
        borderRadius: isPill ? 999 : 8,
        padding: "6px 10px",
        background: bg,
        border,
        backdropFilter: style === "glass" ? "blur(8px)" : undefined,
        boxShadow: glow ? `0 2px 10px ${color}55` : undefined,
      }}
    >
      {/* Thumbnail or platform icon */}
      {showIcon && (
        link.thumbnailUrl ? (
          <div style={{ width: 18, height: 18, borderRadius: isPill ? "50%" : 4, overflow: "hidden", flexShrink: 0 }}>
            <img src={link.thumbnailUrl} alt={link.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </div>
        ) : (
          <span style={{ fontSize: 11, lineHeight: 1, flexShrink: 0 }}>{icon}</span>
        )
      )}
      <div className="flex-1 min-w-0">
        <div className="truncate font-semibold" style={{ fontSize: 10, color: textColor, lineHeight: 1.3 }}>
          {link.title}
        </div>
        {link.subtitle && (
          <div className="truncate" style={{ fontSize: 8, color: `${textColor}80`, lineHeight: 1.2, marginTop: 1 }}>
            {link.subtitle}
          </div>
        )}
      </div>
      {showArrow && (
        <ChevronRight style={{ width: 10, height: 10, color: `${textColor}70`, flexShrink: 0 }} />
      )}
    </div>
  );
}

export function PhoneMockup({
  themeBg,
  themeAccent,
  coverGradient,
  avatarUrl,
  displayName,
  bio,
  buttonStyle,
  showAgeBadge = false,
  links = [],
}: PhoneMockupProps) {
  const coverStyle = coverGradient || `linear-gradient(135deg, ${themeAccent}cc, ${themeAccent}44)`;
  const activeLinks = links.filter((l) => l.isActive);

  return (
    /* Phone Frame */
    <div
      className="relative mx-auto rounded-[34px] overflow-hidden"
      style={{
        width: "240px",
        height: "490px",
        border: "5px solid #1a1a1a",
        boxShadow: `0 0 0 1px rgba(255,255,255,0.06), 0 24px 60px rgba(0,0,0,0.7), 0 0 40px ${themeAccent}18`,
        backgroundColor: themeBg,
      }}
    >
      {/* Status bar */}
      <div
        className="absolute top-0 inset-x-0 h-7 flex items-center justify-between px-4 z-10"
        style={{ background: `linear-gradient(180deg, ${themeBg} 60%, transparent)` }}
      >
        <span className="text-[7px] font-bold" style={{ color: "rgba(255,255,255,0.3)" }}>9:41</span>
        {/* Notch */}
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 h-4 bg-[#111] rounded-b-2xl"
          style={{ width: "64px" }}
        />
        <div className="flex items-center gap-0.5">
          <div className="w-2 h-1 rounded-sm" style={{ background: "rgba(255,255,255,0.3)" }} />
          <div className="w-0.5 h-0.5 rounded-full" style={{ background: "rgba(255,255,255,0.3)" }} />
        </div>
      </div>

      {/* Scrollable content */}
      <div className="h-full overflow-y-auto" style={{ scrollbarWidth: "none" }}>
        {/* Cover */}
        <div className="h-[60px] w-full" style={{ background: coverStyle }} />

        {/* Avatar */}
        <div className="flex justify-center -mt-5 mb-2 px-4">
          <div
            className="w-11 h-11 rounded-full flex items-center justify-center font-bebas text-sm overflow-hidden"
            style={{
              border: `2px solid ${themeAccent}`,
              background: avatarUrl ? "transparent" : `linear-gradient(135deg, ${themeAccent}, ${themeAccent}99)`,
              boxShadow: `0 0 12px ${themeAccent}44`,
            }}
          >
            {avatarUrl
              ? <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover" />
              : <span className="text-white">{getInitials(displayName)}</span>
            }
          </div>
        </div>

        {/* Name */}
        <div className="px-4 mb-1 text-center">
          <h2 className="font-bebas text-[13px] uppercase text-white tracking-wide">{displayName}</h2>
        </div>

        {/* Bio */}
        <div className="px-4 mb-3">
          <p className="text-[9px] text-center leading-relaxed line-clamp-2" style={{ color: "rgba(255,255,255,0.35)" }}>
            {bio}
          </p>
        </div>

        {/* Links */}
        <div className="px-3 space-y-1.5">
          {activeLinks.length === 0 ? (
            <div className="text-center py-4">
              <p className="text-[9px]" style={{ color: "#333" }}>Nenhum link ativo</p>
            </div>
          ) : (
            activeLinks.map((link) => (
              <PhoneLinkButton
                key={link.id}
                link={link}
                fallbackAccent={themeAccent}
                fallbackStyle={buttonStyle}
              />
            ))
          )}
        </div>

        {/* BeeSocial footer branding */}
        <div className="flex items-center justify-center gap-1.5 mt-5 pb-5">
          <span style={{ fontSize: 8 }}>🐝</span>
          <span
            className="font-bebas tracking-widest"
            style={{ fontSize: 8, color: themeAccent, opacity: 0.5 }}
          >
            BEESOCIAL
          </span>
        </div>
      </div>

      {/* Bottom home bar */}
      <div className="absolute bottom-1.5 inset-x-0 flex justify-center">
        <div className="w-14 h-1 rounded-full" style={{ background: "rgba(255,255,255,0.2)" }} />
      </div>
    </div>
  );
}
