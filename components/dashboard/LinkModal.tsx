"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { SafePageBuilder } from "@/components/dashboard/SafePageBuilder";
import {
  PLATFORMS,
  Link,
  SafePage,
  LinkAppearance,
  DEFAULT_LINK_APPEARANCE,
  LinkButtonStyle,
  THEMES,
} from "@/lib/catalog";
import { PhoneMockup } from "@/components/shared/PhoneMockup";
import { getPlatformColor, getPlatformIcon, validateSlug, slugify } from "@/lib/utils";
import { Plus, X } from "lucide-react";
import { toast } from "sonner";
import { siteHost } from "@/lib/site";
import { api } from "@/lib/api/client";
import {
  ShieldCheck,
  ShieldOff,
  Eye,
  EyeOff,
  Link2,
  Palette,
  Check,
  Zap,
  ChevronRight,
  Camera,
  CheckCircle2,
  XCircle,
  Loader2,
  User,
  ImagePlus,
  AlignLeft,
  Trash2,
} from "lucide-react";

// ── Appearance Presets ────────────────────────────────────────────────────────

interface AppearancePreset {
  id: string;
  name: string;
  tag?: string;
  appearance: LinkAppearance;
}

const APPEARANCE_PRESETS: AppearancePreset[] = [
  {
    id: "hot-pink",
    name: "Hot Pink",
    tag: "Popular",
    appearance: { style: "filled", color: "#FF3C6E", useGradient: true, gradientTo: "#FF1F57", glow: true, showIcon: true, showArrow: true },
  },
  {
    id: "neon-purple",
    name: "Neon Purple",
    tag: "Novo",
    appearance: { style: "filled", color: "#9b6dff", useGradient: true, gradientTo: "#7c3aed", glow: true, showIcon: true, showArrow: true },
  },
  {
    id: "dark-teal",
    name: "Dark Teal",
    appearance: { style: "filled", color: "#00d4aa", useGradient: true, gradientTo: "#00b894", glow: true, showIcon: true, showArrow: true },
  },
  {
    id: "crimson",
    name: "Crimson",
    appearance: { style: "filled", color: "#ef4444", useGradient: true, gradientTo: "#dc2626", glow: true, showIcon: true, showArrow: true },
  },
  {
    id: "amber-glow",
    name: "Âmbar",
    appearance: { style: "filled", color: "#f59e0b", useGradient: true, gradientTo: "#ef4444", glow: true, showIcon: true, showArrow: true },
  },
  {
    id: "pill-gradient",
    name: "Pill Gradient",
    tag: "Tendência",
    appearance: { style: "pill", color: "#FF3C6E", useGradient: true, gradientTo: "#9b6dff", glow: false, showIcon: true, showArrow: true },
  },
  {
    id: "glass-dark",
    name: "Glass",
    appearance: { style: "glass", color: "#ffffff", useGradient: false, gradientTo: "#ffffff", glow: false, showIcon: true, showArrow: true },
  },
  {
    id: "minimal-outline",
    name: "Minimal",
    appearance: { style: "outlined", color: "#ffffff", useGradient: false, gradientTo: "#ffffff", glow: false, showIcon: true, showArrow: false },
  },
  {
    id: "soft-pink",
    name: "Soft Pink",
    appearance: { style: "soft", color: "#FF3C6E", useGradient: false, gradientTo: "#FF1F57", glow: false, showIcon: true, showArrow: true },
  },
  {
    id: "cobalt",
    name: "Cobalt",
    appearance: { style: "filled", color: "#3b82f6", useGradient: true, gradientTo: "#1d4ed8", glow: false, showIcon: true, showArrow: true },
  },
];

const STYLE_OPTIONS: { id: LinkButtonStyle; label: string }[] = [
  { id: "soft", label: "Suave" },
  { id: "filled", label: "Sólido" },
  { id: "outlined", label: "Contorno" },
  { id: "glass", label: "Vidro" },
  { id: "pill", label: "Pílula" },
];

const COLOR_SWATCHES = [
  "#FF3C6E", "#FF1F57", "#9b6dff", "#3b82f6",
  "#00d4aa", "#f59e0b", "#ef4444", "#ffffff",
  "#10b981", "#ec4899", "#06b6d4", "#8b5cf6",
];

// ── Button Preview ─────────────────────────────────────────────────────────────

function ButtonPreview({
  appearance,
  title,
  icon,
  size = "normal",
}: {
  appearance: LinkAppearance;
  title: string;
  icon: string;
  size?: "normal" | "compact";
}) {
  const { style, color, useGradient, gradientTo, glow, showIcon, showArrow } = appearance;
  const isPill = style === "pill";
  const radius = isPill ? 999 : size === "compact" ? 8 : 12;

  const bg = (() => {
    switch (style) {
      case "filled":
        return useGradient
          ? `linear-gradient(135deg, ${color}, ${gradientTo})`
          : color;
      case "soft":
      case "pill":
        return useGradient
          ? `linear-gradient(135deg, ${color}28, ${gradientTo}28)`
          : `${color}22`;
      case "glass":
        return "rgba(255,255,255,0.07)";
      case "outlined":
        return "transparent";
    }
  })();

  const border = (() => {
    switch (style) {
      case "filled": return "none";
      case "soft": case "pill": return `1px solid ${color}44`;
      case "glass": return "1px solid rgba(255,255,255,0.14)";
      case "outlined": return `2px solid ${color}`;
    }
  })();

  const textColor = style === "filled" ? "#fff" : color;

  return (
    <div
      className="flex items-center gap-2.5 w-full select-none"
      style={{
        borderRadius: radius,
        background: bg,
        border,
        padding: size === "compact" ? "8px 12px" : "14px 16px",
        backdropFilter: style === "glass" ? "blur(12px)" : undefined,
        boxShadow: glow
          ? `0 4px 24px ${color}55, 0 0 0 1px ${color}22`
          : style === "filled"
          ? `0 4px 16px ${color}35`
          : undefined,
      }}
    >
      {showIcon && (
        <span style={{ fontSize: size === "compact" ? 14 : 18, lineHeight: 1 }}>
          {icon}
        </span>
      )}
      <span
        className="flex-1 truncate font-semibold"
        style={{
          color: textColor,
          fontSize: size === "compact" ? 11 : 14,
          textAlign: showIcon ? "center" : "left",
        }}
      >
        {title || "Meu Link"}
      </span>
      {showArrow && (
        <ChevronRight
          style={{ width: size === "compact" ? 12 : 16, height: size === "compact" ? 12 : 16, color: `${textColor}80`, flexShrink: 0 }}
        />
      )}
    </div>
  );
}

// ── Preset Card ────────────────────────────────────────────────────────────────

function PresetCard({
  preset,
  selected,
  title,
  icon,
  onSelect,
}: {
  preset: AppearancePreset;
  selected: boolean;
  title: string;
  icon: string;
  onSelect: () => void;
}) {
  return (
    <motion.button
      type="button"
      onClick={onSelect}
      whileTap={{ scale: 0.96 }}
      className="relative flex flex-col gap-2 p-3 rounded-xl text-left focus:outline-none transition-all duration-200"
      style={{
        background: selected ? "rgba(255,60,110,0.08)" : "rgba(255,255,255,0.03)",
        border: selected ? "1px solid rgba(255,60,110,0.4)" : "1px solid rgba(255,255,255,0.07)",
        boxShadow: selected ? "0 0 16px rgba(255,60,110,0.12)" : "none",
      }}
    >
      {/* Mini preview */}
      <div className="w-full">
        <ButtonPreview appearance={preset.appearance} title={title} icon={icon} size="compact" />
      </div>
      {/* Name row */}
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold text-white/60">{preset.name}</span>
        <div className="flex items-center gap-1">
          {preset.tag && (
            <span
              className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
              style={{ background: "rgba(255,60,110,0.15)", color: "#FF3C6E" }}
            >
              {preset.tag}
            </span>
          )}
          {selected && (
            <span
              className="w-4 h-4 rounded-full flex items-center justify-center"
              style={{ background: "#FF3C6E" }}
            >
              <Check style={{ width: 9, height: 9, color: "#fff" }} />
            </span>
          )}
        </div>
      </div>
    </motion.button>
  );
}

// ── Appearance Tab ─────────────────────────────────────────────────────────────

function AppearanceTab({
  appearance,
  onChange,
  title,
  icon,
  allLinks = [],
  editLinkId,
  profileData,
}: {
  appearance: LinkAppearance;
  onChange: (a: LinkAppearance) => void;
  title: string;
  icon: string;
  allLinks?: Link[];
  editLinkId?: string;
  profileData?: { displayName: string; slug: string; bio: string; avatarUrl: string | null; coverUrl: string | null };
}) {
  const hexInputRef = useRef<HTMLInputElement>(null);
  const [customHex, setCustomHex] = useState(appearance.color);
  const set = (partial: Partial<LinkAppearance>) =>
    onChange({ ...appearance, ...partial, themePresetId: partial.themePresetId ?? undefined });

  const applyPreset = (preset: AppearancePreset) =>
    onChange({ ...preset.appearance, themePresetId: preset.id });

  const handleHexChange = (v: string) => {
    setCustomHex(v);
    if (/^#[0-9a-fA-F]{6}$/.test(v)) set({ color: v, themePresetId: undefined });
  };

  useEffect(() => {
    setCustomHex(appearance.color);
  }, [appearance.color]);

  return (
    <div className="space-y-6">
      {/* Button preview */}
      <div>
        <p className="text-[10px] font-semibold text-white/30 uppercase tracking-widest mb-2">
          Preview do botão
        </p>
        <div
          className="rounded-2xl p-4"
          style={{ background: "rgba(0,0,0,0.5)", border: "1px solid rgba(255,255,255,0.05)" }}
        >
          <div className="max-w-[280px] mx-auto">
            <ButtonPreview appearance={appearance} title={title} icon={icon} />
          </div>
        </div>
      </div>

      {/* Quick Themes */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Zap style={{ width: 12, height: 12, color: "#FF3C6E" }} />
          <p className="text-[10px] font-semibold text-white/30 uppercase tracking-widest">
            Temas Padrão
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {APPEARANCE_PRESETS.map((preset) => (
            <PresetCard
              key={preset.id}
              preset={preset}
              selected={appearance.themePresetId === preset.id}
              title={title}
              icon={icon}
              onSelect={() => applyPreset(preset)}
            />
          ))}
        </div>
      </div>

      {/* Custom */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Palette style={{ width: 12, height: 12, color: "#9b6dff" }} />
          <p className="text-[10px] font-semibold text-white/30 uppercase tracking-widest">
            Personalizar
          </p>
        </div>

        <div className="space-y-5">
          {/* Style */}
          <div>
            <p className="text-[10px] text-white/20 uppercase tracking-widest mb-2">Estilo</p>
            <div className="grid grid-cols-5 gap-1.5">
              {STYLE_OPTIONS.map((s) => {
                const isActive = appearance.style === s.id;
                const previewBg = s.id === "filled"
                  ? appearance.color
                  : s.id === "glass"
                  ? "rgba(255,255,255,0.08)"
                  : `${appearance.color}25`;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => set({ style: s.id, themePresetId: undefined })}
                    className="flex flex-col items-center gap-1.5 py-2.5 rounded-xl focus:outline-none transition-all duration-150"
                    style={{
                      background: isActive ? "rgba(255,60,110,0.1)" : "rgba(255,255,255,0.03)",
                      border: isActive ? "1px solid rgba(255,60,110,0.4)" : "1px solid rgba(255,255,255,0.07)",
                    }}
                  >
                    <div
                      className="w-full h-4 mx-auto"
                      style={{
                        background: previewBg,
                        border: s.id === "outlined" ? `1.5px solid ${appearance.color}` : "none",
                        borderRadius: s.id === "pill" ? 999 : 5,
                        width: "calc(100% - 12px)",
                      }}
                    />
                    <span
                      className="text-[9px] font-medium"
                      style={{ color: isActive ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.3)" }}
                    >
                      {s.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Color */}
          <div>
            <p className="text-[10px] text-white/20 uppercase tracking-widest mb-2">Cor principal</p>
            <div className="flex flex-wrap gap-2 mb-3">
              {COLOR_SWATCHES.map((hex) => (
                <button
                  key={hex}
                  type="button"
                  onClick={() => set({ color: hex, themePresetId: undefined })}
                  className="w-7 h-7 rounded-full focus:outline-none transition-all duration-150"
                  style={{
                    background: hex === "#ffffff" ? "linear-gradient(135deg, #fff 0%, #ccc 100%)" : hex,
                    border: appearance.color === hex ? "2px solid #fff" : "2px solid transparent",
                    boxShadow: appearance.color === hex ? `0 0 0 1px ${hex}, 0 0 10px ${hex}70` : "none",
                    transform: appearance.color === hex ? "scale(1.2)" : "scale(1)",
                  }}
                />
              ))}
            </div>
            {/* Hex input */}
            <div
              className="flex items-center gap-2 px-3 py-2 rounded-lg"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
            >
              <div
                className="w-5 h-5 rounded flex-shrink-0"
                style={{ background: appearance.color, border: "1px solid rgba(255,255,255,0.15)" }}
              />
              <input
                ref={hexInputRef}
                value={customHex}
                onChange={(e) => handleHexChange(e.target.value)}
                placeholder="#FF3C6E"
                maxLength={7}
                className="flex-1 bg-transparent text-white text-xs font-mono outline-none placeholder-white/20"
              />
            </div>
          </div>

          {/* Gradient end color */}
          <AnimatePresence>
            {appearance.useGradient && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <p className="text-[10px] text-white/20 uppercase tracking-widest mb-2">Cor do gradiente</p>
                <div className="flex flex-wrap gap-2">
                  {COLOR_SWATCHES.map((hex) => (
                    <button
                      key={hex}
                      type="button"
                      onClick={() => set({ gradientTo: hex })}
                      className="w-7 h-7 rounded-full focus:outline-none transition-all duration-150"
                      style={{
                        background: hex,
                        border: appearance.gradientTo === hex ? "2px solid #fff" : "2px solid transparent",
                        boxShadow: appearance.gradientTo === hex ? `0 0 0 1px ${hex}, 0 0 10px ${hex}70` : "none",
                        transform: appearance.gradientTo === hex ? "scale(1.2)" : "scale(1)",
                      }}
                    />
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Options */}
          <div>
            <p className="text-[10px] text-white/20 uppercase tracking-widest mb-3">Opções</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { key: "useGradient" as const, label: "Gradiente", desc: "Degradê de cor" },
                { key: "glow" as const, label: "Glow", desc: "Brilho neon" },
                { key: "showIcon" as const, label: "Ícone", desc: "Ícone da plataforma" },
                { key: "showArrow" as const, label: "Seta", desc: "Mostrar ›" },
              ].map(({ key, label, desc }) => {
                const checked = appearance[key] as boolean;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => set({ [key]: !checked })}
                    className="flex items-center justify-between px-3 py-2.5 rounded-xl focus:outline-none transition-all duration-200"
                    style={{
                      background: checked ? "rgba(255,60,110,0.08)" : "rgba(255,255,255,0.03)",
                      border: checked ? "1px solid rgba(255,60,110,0.3)" : "1px solid rgba(255,255,255,0.07)",
                    }}
                  >
                    <div className="text-left">
                      <div className="text-xs font-semibold" style={{ color: checked ? "#fff" : "rgba(255,255,255,0.4)" }}>
                        {label}
                      </div>
                      <div className="text-[9px]" style={{ color: "rgba(255,255,255,0.2)" }}>
                        {desc}
                      </div>
                    </div>
                    <div
                      className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0"
                      style={{ background: checked ? "#FF3C6E" : "rgba(255,255,255,0.08)" }}
                    >
                      {checked && <Check style={{ width: 9, height: 9, color: "#fff" }} />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── CloakToggle ───────────────────────────────────────────────────────────────

function CloakToggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  const [ripple, setRipple] = useState(false);
  const handleClick = () => { setRipple(true); setTimeout(() => setRipple(false), 500); onChange(!checked); };
  return (
    <motion.button type="button" onClick={handleClick} whileTap={{ scale: 0.98 }}
      className="relative w-full text-left overflow-hidden rounded-2xl focus:outline-none transition-all duration-300"
      style={{
        background: checked ? "rgba(255,60,110,0.07)" : "rgba(255,255,255,0.03)",
        backdropFilter: "blur(12px)",
        border: checked ? "1px solid rgba(255,60,110,0.4)" : "1px solid rgba(255,255,255,0.08)",
        boxShadow: checked ? "0 0 24px rgba(255,60,110,0.08), inset 0 1px 0 rgba(255,255,255,0.04)" : "inset 0 1px 0 rgba(255,255,255,0.03)",
      }}>
      <AnimatePresence>
        {ripple && <motion.span key="r" initial={{ scale: 0, opacity: 0.3 }} animate={{ scale: 5, opacity: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.5 }} className="absolute left-10 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full pointer-events-none" style={{ background: checked ? "rgba(255,60,110,0.35)" : "rgba(255,255,255,0.1)" }} />}
      </AnimatePresence>
      <AnimatePresence>
        {checked && <motion.div key="line" initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} exit={{ scaleX: 0 }} transition={{ duration: 0.35 }} className="absolute top-0 left-0 right-0 h-px origin-left" style={{ background: "linear-gradient(90deg, #FF3C6E 0%, rgba(255,31,87,0.6) 60%, transparent 100%)" }} />}
      </AnimatePresence>
      <div className="relative flex items-center gap-3.5 px-4 py-3.5 z-10">
        <motion.div animate={{ scale: checked ? [1, 1.15, 1] : 1 }} transition={{ duration: 0.35 }}
          className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors duration-300"
          style={{ background: checked ? "rgba(255,60,110,0.18)" : "rgba(255,255,255,0.06)", border: checked ? "1px solid rgba(255,60,110,0.3)" : "1px solid rgba(255,255,255,0.08)" }}>
          {checked ? <ShieldCheck style={{ width: 18, height: 18 }} className="text-bee-pink" /> : <ShieldOff style={{ width: 18, height: 18 }} className="text-white/30" />}
        </motion.div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold transition-colors duration-300" style={{ color: checked ? "#fff" : "rgba(255,255,255,0.5)" }}>Forçar saída do Instagram</div>
          <div className="text-[11px] mt-0.5 transition-colors duration-300" style={{ color: checked ? "rgba(255,60,110,0.75)" : "rgba(255,255,255,0.25)" }}>
            {checked ? "✓ Cloaking ativo — bots verão a SafePage" : "Redireciona para o browser nativo"}
          </div>
        </div>
        <div className="relative flex-shrink-0" style={{ width: 44, height: 24, borderRadius: 999, background: checked ? "rgba(255,60,110,0.2)" : "rgba(255,255,255,0.06)", border: checked ? "1px solid rgba(255,60,110,0.45)" : "1px solid rgba(255,255,255,0.1)" }}>
          <motion.div layout transition={{ type: "spring", stiffness: 500, damping: 30 }} className="absolute top-[3px]" style={{ left: checked ? "calc(100% - 19px)" : 3, width: 16, height: 16, borderRadius: "50%", background: checked ? "#FF3C6E" : "#444", boxShadow: checked ? "0 0 10px rgba(255,60,110,0.7)" : "none" }} />
        </div>
      </div>
    </motion.button>
  );
}

// ── ActiveToggle ──────────────────────────────────────────────────────────────

function ActiveToggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  const [burst, setBurst] = useState(false);
  const handleClick = () => { setBurst(true); setTimeout(() => setBurst(false), 400); onChange(!checked); };
  return (
    <div className="flex items-center justify-between rounded-2xl transition-all duration-300"
      style={{ padding: "14px 16px", background: checked ? "rgba(74,222,128,0.06)" : "rgba(255,255,255,0.03)", backdropFilter: "blur(12px)", border: checked ? "1px solid rgba(74,222,128,0.25)" : "1px solid rgba(255,255,255,0.08)", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)" }}>
      <div className="flex items-center gap-3.5">
        <motion.div animate={{ scale: checked ? [1, 1.12, 1] : 1 }} transition={{ duration: 0.3 }}
          className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors duration-300"
          style={{ background: checked ? "rgba(74,222,128,0.15)" : "rgba(255,255,255,0.06)", border: checked ? "1px solid rgba(74,222,128,0.25)" : "1px solid rgba(255,255,255,0.08)" }}>
          {checked ? <Eye className="text-green-400" style={{ width: 16, height: 16 }} /> : <EyeOff className="text-white/30" style={{ width: 16, height: 16 }} />}
        </motion.div>
        <div>
          <div className="text-sm font-semibold transition-colors duration-300" style={{ color: checked ? "#fff" : "rgba(255,255,255,0.5)" }}>Link ativo</div>
          <div className="text-[11px] transition-colors duration-300" style={{ color: checked ? "rgba(74,222,128,0.65)" : "rgba(255,255,255,0.25)" }}>
            {checked ? "Visível no seu perfil" : "Oculto no seu perfil"}
          </div>
        </div>
      </div>
      <motion.button type="button" onClick={handleClick} whileTap={{ scale: 0.93 }}
        className="relative overflow-hidden rounded-full text-xs font-bold uppercase tracking-wider focus:outline-none transition-all duration-300"
        style={{ padding: "6px 16px", background: checked ? "linear-gradient(135deg, #4ade80, #22c55e)" : "rgba(255,255,255,0.07)", color: checked ? "#000" : "rgba(255,255,255,0.4)", border: checked ? "none" : "1px solid rgba(255,255,255,0.1)", boxShadow: checked ? "0 0 16px rgba(74,222,128,0.35)" : "none", minWidth: 72 }}>
        <AnimatePresence mode="wait">
          <motion.span key={checked ? "on" : "off"} initial={{ y: 7, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -7, opacity: 0 }} transition={{ duration: 0.14 }} className="block text-center">
            {checked ? "Ativo" : "Oculto"}
          </motion.span>
        </AnimatePresence>
        <AnimatePresence>
          {burst && checked && [...Array(6)].map((_, i) => (
            <motion.span key={i} initial={{ scale: 0, x: 0, y: 0, opacity: 1 }} animate={{ scale: 1, x: Math.cos((i * Math.PI * 2) / 6) * 22, y: Math.sin((i * Math.PI * 2) / 6) * 22, opacity: 0 }} transition={{ duration: 0.4, ease: "easeOut" }} className="absolute w-1.5 h-1.5 rounded-full pointer-events-none" style={{ left: "50%", top: "50%", background: "#4ade80" }} />
          ))}
        </AnimatePresence>
      </motion.button>
    </div>
  );
}

// ── Platform URL hints ────────────────────────────────────────────────────────

// ── Mini Toggle (for InlineLinkRow) ──────────────────────────────────────────

function ModalMiniToggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onChange(!checked); }}
      className="relative flex-shrink-0 focus:outline-none"
      style={{
        width: 30, height: 17, borderRadius: 999,
        background: checked ? "rgba(74,222,128,0.2)" : "rgba(255,255,255,0.07)",
        border: checked ? "1px solid rgba(74,222,128,0.35)" : "1px solid rgba(255,255,255,0.1)",
        transition: "all 0.25s",
      }}
    >
      <motion.div layout transition={{ type: "spring", stiffness: 600, damping: 35 }}
        className="absolute top-[1.5px]"
        style={{
          left: checked ? "calc(100% - 14px)" : 2,
          width: 12, height: 12, borderRadius: "50%",
          background: checked ? "#4ade80" : "#555",
          boxShadow: checked ? "0 0 6px rgba(74,222,128,0.6)" : "none",
        }}
      />
    </button>
  );
}

// ── Inline Platform Picker (inside modal) ─────────────────────────────────────

function ModalPlatformPicker({
  onSelect,
  onClose,
}: {
  onSelect: (platformId: string) => void;
  onClose: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.15 }}
      className="rounded-xl overflow-hidden mb-3"
      style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.09)" }}
    >
      <div className="flex items-center justify-between px-3 py-2" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
        <span className="text-[10px] font-semibold text-white/30 uppercase tracking-widest">Escolha a plataforma</span>
        <button onClick={onClose} className="p-0.5 text-white/20 hover:text-white/60 transition-colors focus:outline-none rounded">
          <X style={{ width: 12, height: 12 }} />
        </button>
      </div>
      <div className="grid grid-cols-5 gap-1.5 p-3">
        {PLATFORMS.map((p) => {
          const color = getPlatformColor(p.id);
          return (
            <button
              key={p.id}
              onClick={() => onSelect(p.id)}
              className="flex flex-col items-center gap-1 p-2 rounded-xl transition-all focus:outline-none"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background = `${color}15`;
                (e.currentTarget as HTMLElement).style.border = `1px solid ${color}35`;
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.03)";
                (e.currentTarget as HTMLElement).style.border = "1px solid rgba(255,255,255,0.06)";
              }}
            >
              <span className="text-base leading-none">{p.icon}</span>
              <span className="text-[9px] text-white/35 text-center leading-tight">{p.label.split(" ")[0]}</span>
            </button>
          );
        })}
      </div>
    </motion.div>
  );
}

// ── URL Field (prominent destination input) ───────────────────────────────────

function UrlField({
  url,
  setUrl,
  onSave,
  platformColor,
}: {
  url: string;
  setUrl: (v: string) => void;
  onSave: () => void;
  platformColor: string;
}) {
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const hasUrl = url.trim().length > 0;
  const domain = (() => {
    if (!url.trim()) return null;
    try { return new URL(url).hostname.replace(/^www\./, ""); }
    catch { return url.replace(/^https?:\/\/(www\.)?/, "").split("/")[0] || null; }
  })();

  return (
    <div
      className="rounded-lg cursor-text"
      onClick={() => inputRef.current?.focus()}
      style={{
        background: focused
          ? "rgba(255,255,255,0.06)"
          : hasUrl
          ? "rgba(74,222,128,0.05)"
          : "rgba(255,255,255,0.04)",
        border: focused
          ? "1px solid rgba(255,60,110,0.45)"
          : hasUrl
          ? "1px solid rgba(74,222,128,0.3)"
          : "1px dashed rgba(255,255,255,0.15)",
        boxShadow: focused ? "0 0 0 3px rgba(255,60,110,0.07)" : "none",
        transition: "all 0.2s",
      }}
    >
      {/* Label row */}
      <div className="flex items-center justify-between px-2.5 pt-2 pb-1">
        <span className="text-[9px] font-bold uppercase tracking-widest"
          style={{ color: focused ? "#FF3C6E" : hasUrl ? "rgba(74,222,128,0.8)" : "rgba(255,255,255,0.25)" }}>
          {hasUrl ? "✓ Destino" : "Para onde vai este botão?"}
        </span>
        {hasUrl && domain && (
          <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full"
            style={{ background: "rgba(74,222,128,0.12)", color: "#4ade80", border: "1px solid rgba(74,222,128,0.25)" }}>
            {domain}
          </span>
        )}
      </div>

      {/* Input row */}
      <div className="flex items-center gap-1.5 px-2.5 pb-2">
        <span className="text-[10px] flex-shrink-0" style={{ color: hasUrl ? "#4ade80" : "rgba(255,255,255,0.2)" }}>
          {hasUrl ? "🔗" : "🔒"}
        </span>
        <input
          ref={inputRef}
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => { setFocused(false); onSave(); }}
          placeholder="https://..."
          className="flex-1 min-w-0 bg-transparent text-xs placeholder-white/20 outline-none font-mono"
          style={{ color: hasUrl ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.35)" }}
        />
      </div>
    </div>
  );
}

// ── Inline Link Row (inside modal, Beacons-style) ─────────────────────────────

function InlineLinkRow({
  link,
  isNew,
  isFocused,
  onSave,
  onDelete,
  onEditAppearance,
}: {
  link: Link;
  isNew?: boolean;
  isFocused?: boolean;
  onSave: (data: Partial<Link>) => void;
  onDelete: () => void;
  onEditAppearance: () => void;
}) {
  const [title, setTitle] = useState(link.title);
  const [subtitle, setSubtitle] = useState(link.subtitle || "");
  const [url, setUrl] = useState(link.destinationUrl || "");
  const [thumbUrl, setThumbUrl] = useState<string | null>(link.thumbnailUrl || null);
  const [isActive, setIsActive] = useState(link.isActive);
  const titleRef = useRef<HTMLInputElement>(null);
  const thumbInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isNew) setTimeout(() => titleRef.current?.focus(), 60);
  }, [isNew]);

  // Keep in sync when parent updates (e.g. new link added by parent)
  useEffect(() => {
    setTitle(link.title);
    setSubtitle(link.subtitle || "");
    setUrl(link.destinationUrl || "");
    setThumbUrl(link.thumbnailUrl || null);
    setIsActive(link.isActive);
  }, [link.id]);

  const platformColor = getPlatformColor(link.platform);
  const platformIcon = getPlatformIcon(link.platform);
  const appearanceColor = link.appearance?.color ?? platformColor;

  const save = (overrides: Partial<Link> = {}) => {
    onSave({
      id: link.id,
      title: title.trim() || link.title,
      subtitle: subtitle.trim() || undefined,
      destinationUrl: url.trim(),
      thumbnailUrl: thumbUrl,
      isActive,
      ...overrides,
    });
  };

  const handleThumb = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const r = new FileReader();
    r.onloadend = () => { const result = r.result as string; setThumbUrl(result); save({ thumbnailUrl: result }); };
    r.readAsDataURL(file);
  };

  // Color swatch showing the current appearance
  const accentBg = link.appearance?.useGradient
    ? `linear-gradient(135deg,${link.appearance.color},${link.appearance.gradientTo})`
    : appearanceColor;
  const hasCustomAppearance = !!link.appearance;

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        background: isFocused ? "rgba(255,60,110,0.05)" : "rgba(255,255,255,0.025)",
        border: isFocused ? "1.5px solid rgba(255,60,110,0.35)" : "1px solid rgba(255,255,255,0.07)",
        boxShadow: isFocused ? "0 0 0 3px rgba(255,60,110,0.08)" : "none",
        transition: "all 0.2s",
      }}
    >
      {/* Focused indicator strip */}
      {isFocused && (
        <div className="h-0.5" style={{ background: "linear-gradient(90deg,#FF3C6E,#FF1F57)" }} />
      )}

      {/* Main row */}
      <div className="flex items-start gap-2.5 p-3">
        {/* Platform icon */}
        <div className="w-7 h-7 rounded-lg flex-shrink-0 flex items-center justify-center text-sm mt-0.5"
          style={{ background: `${platformColor}15`, border: `1px solid ${platformColor}28` }}>
          {platformIcon}
        </div>

        {/* Fields */}
        <div className="flex-1 min-w-0 space-y-2">
          <input
            ref={titleRef}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => save()}
            placeholder="Título"
            className="w-full bg-transparent text-sm font-semibold text-white placeholder-white/20 outline-none border-b border-transparent focus:border-white/10 transition-colors pb-px"
          />
          <input
            value={subtitle}
            onChange={(e) => setSubtitle(e.target.value)}
            onBlur={() => save()}
            placeholder="Subtítulo (opcional)"
            maxLength={60}
            className="w-full bg-transparent text-xs text-white/40 placeholder-white/15 outline-none border-b border-transparent focus:border-white/08 transition-colors pb-px"
          />

          {/* ── URL de destino — prominent ── */}
          <UrlField url={url} setUrl={setUrl} onSave={save} platformColor={platformColor} />
        </div>

        {/* Thumbnail */}
        <div className="flex-shrink-0">
          <input ref={thumbInputRef} type="file" accept="image/*" onChange={handleThumb} className="hidden" />
          <button
            type="button"
            onClick={() => thumbInputRef.current?.click()}
            className="w-11 h-11 rounded-xl overflow-hidden flex items-center justify-center relative group/t focus:outline-none"
            style={{ background: thumbUrl ? "transparent" : `${platformColor}10`, border: thumbUrl ? "none" : `1px dashed ${platformColor}28` }}
            title="Adicionar imagem"
          >
            {thumbUrl ? (
              <>
                <img src={thumbUrl} alt="" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover/t:opacity-100 flex items-center justify-center transition-opacity">
                  <Camera style={{ width: 11, height: 11, color: "#fff" }} />
                </div>
              </>
            ) : (
              <span className="text-base opacity-50">{platformIcon}</span>
            )}
          </button>
          {thumbUrl && (
            <button type="button" onClick={() => { setThumbUrl(null); save({ thumbnailUrl: null }); }}
              className="w-11 text-center text-[8px] text-white/15 hover:text-red-400 mt-0.5 focus:outline-none transition-colors">
              remover
            </button>
          )}
        </div>
      </div>

      {/* Action row */}
      <div className="flex items-center gap-2 px-3 py-2" style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
        {/* Platform + cloaking badges */}
        <span className="text-[9px] px-1.5 py-0.5 rounded-full flex-shrink-0"
          style={{ background: `${platformColor}15`, color: platformColor, border: `1px solid ${platformColor}25` }}>
          {link.platform}
        </span>
        {link.cloakEnabled && (
          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-bee-pink/10 text-bee-pink border border-bee-pink/20 flex-shrink-0">🔐</span>
        )}

        <div className="flex-1" />

        {/* ── Appearance button — prominent, labeled ── */}
        <button
          onClick={onEditAppearance}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-all focus:outline-none flex-shrink-0"
          style={{
            background: isFocused
              ? "rgba(255,60,110,0.12)"
              : hasCustomAppearance
              ? `${appearanceColor}15`
              : "rgba(255,255,255,0.05)",
            border: isFocused
              ? "1px solid rgba(255,60,110,0.4)"
              : hasCustomAppearance
              ? `1px solid ${appearanceColor}35`
              : "1px solid rgba(255,255,255,0.1)",
          }}
          title="Personalizar aparência deste botão"
        >
          {/* Color swatch */}
          <span
            className="w-3 h-3 rounded-full flex-shrink-0"
            style={{ background: accentBg, boxShadow: hasCustomAppearance ? `0 0 6px ${appearanceColor}55` : "none" }}
          />
          <span className="text-[10px] font-semibold"
            style={{ color: isFocused ? "#FF3C6E" : hasCustomAppearance ? appearanceColor : "rgba(255,255,255,0.35)" }}>
            {isFocused ? "Editando" : "Estilo"}
          </span>
          {isFocused && (
            <Check style={{ width: 10, height: 10, color: "#FF3C6E", flexShrink: 0 }} />
          )}
        </button>

        {/* Active toggle */}
        <ModalMiniToggle checked={isActive} onChange={(v) => { setIsActive(v); save({ isActive: v }); }} />

        {/* Delete */}
        <button
          onClick={onDelete}
          className="p-1 text-white/15 hover:text-red-400 transition-colors focus:outline-none rounded-lg hover:bg-red-500/10 flex-shrink-0"
          title="Deletar link"
        >
          <Trash2 style={{ width: 12, height: 12 }} />
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

const PLATFORM_URL_HINTS: Record<string, { placeholder: string; hint: string }> = {
  onlyfans:  { placeholder: "https://onlyfans.com/seu_usuario",         hint: "Link do seu perfil OnlyFans" },
  privacy:   { placeholder: "https://privacy.com.br/seu_usuario",       hint: "Link do seu perfil Privacy" },
  telegram:  { placeholder: "https://t.me/seu_canal",                   hint: "Link do canal ou bot do Telegram" },
  whatsapp:  { placeholder: "https://wa.me/5511999999999",              hint: "Número com DDI ex: 5511..." },
  instagram: { placeholder: "https://instagram.com/seu_usuario",        hint: "Link do seu Instagram" },
  tiktok:    { placeholder: "https://tiktok.com/@seu_usuario",          hint: "Link do seu TikTok" },
  twitter:   { placeholder: "https://twitter.com/seu_usuario",          hint: "Link do seu Twitter/X" },
  youtube:   { placeholder: "https://youtube.com/@seu_canal",           hint: "Link do seu canal" },
  site:      { placeholder: "https://seusite.com.br",                   hint: "URL do seu site" },
  custom:    { placeholder: "https://...",                               hint: "URL de destino completa" },
};

// ── LinkModal ─────────────────────────────────────────────────────────────────

export type ModalTab = "link" | "aparencia" | "perfil";

export interface ProfileData {
  displayName: string;
  slug: string;
  bio: string;
  avatarUrl: string | null;
  coverUrl: string | null;
}

interface LinkModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (link: Partial<Link>) => void;
  onDelete?: (id: string) => void;
  onSaveProfile?: (data: ProfileData) => void;
  editLink?: Link | null;
  initialTab?: ModalTab;
  /** When true, only appearance is saved — skips cloaking/safepage validation */
  appearanceOnly?: boolean;
  /** All current links (used for the Beacons-style list AND full-profile preview) */
  allLinks?: Link[];
  /** Current profile data (used for the full-profile preview).
   *
   *  `themeId` e `buttonStyle` são opcionais porque só a tela de aparência os
   *  conhece ao vivo; sem eles a prévia usa o padrão. Antes tudo isto vinha de
   *  `MOCK_USER`, então a prévia dentro do modal mostrava o perfil de mentira
   *  em cima dos links reais da criadora. */
  profileData?: {
    displayName: string;
    slug: string;
    bio: string;
    avatarUrl: string | null;
    coverUrl: string | null;
    themeId?: string;
    buttonStyle?: string;
  };
}

export function LinkModal({ open, onClose, onSave, onDelete, onSaveProfile, editLink, initialTab = "link", appearanceOnly = false, allLinks = [], profileData }: LinkModalProps) {
  const [activeTab, setActiveTab] = useState<ModalTab>(initialTab);

  // ── List mode (Beacons-style) ─────────────────────────────────────────────
  // True when allLinks has items AND we're not in appearance-only mode
  const isListMode = allLinks.length > 0 && !appearanceOnly;
  const [focusedLinkId, setFocusedLinkId] = useState<string | null>(editLink?.id || null);
  const [showPicker, setShowPicker] = useState(false);
  const [newLinkIds, setNewLinkIds] = useState<Set<string>>(new Set());

  const focusedLink = allLinks.find((l) => l.id === focusedLinkId) || allLinks[0] || null;

  // ── Single link mode state ────────────────────────────────────────────────
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [destinationUrl, setDestinationUrl] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [cloakEnabled, setCloakEnabled] = useState(false);
  const [safePage, setSafePage] = useState<SafePage | null>(null);
  const [isActive, setIsActive] = useState(true);
  const [appearance, setAppearance] = useState<LinkAppearance>({ ...DEFAULT_LINK_APPEARANCE });
  const thumbnailInputRef = useRef<HTMLInputElement>(null);

  // Profile tab state. Vem do perfil real, via prop — nunca de constante.
  const [profileDisplayName, setProfileDisplayName] = useState(profileData?.displayName ?? "");
  const [profileSlug, setProfileSlug] = useState(profileData?.slug ?? "");
  const [profileBio, setProfileBio] = useState(profileData?.bio ?? "");
  const [profileAvatar, setProfileAvatar] = useState<string | null>(profileData?.avatarUrl ?? null);
  const [profileCover, setProfileCover] = useState<string | null>(profileData?.coverUrl ?? null);
  const [slugStatus, setSlugStatus] = useState<"idle" | "checking" | "valid" | "invalid" | "taken">("idle");

  // O perfil chega por prop e pode ainda estar carregando quando o modal é
  // montado: sem este efeito, abrir o modal antes da resposta da API deixaria a
  // aba "Perfil" com os campos vazios e um "salvar" que apagaria a bio.
  useEffect(() => {
    if (!open || !profileData) return;
    setProfileDisplayName(profileData.displayName);
    setProfileSlug(profileData.slug);
    setProfileBio(profileData.bio);
    setProfileAvatar(profileData.avatarUrl);
    setProfileCover(profileData.coverUrl);
  }, [open, profileData]);

  useEffect(() => {
    if (open) {
      setActiveTab(initialTab);
      setFocusedLinkId(editLink?.id || (allLinks[0]?.id ?? null));
      setShowPicker(false);
      setNewLinkIds(new Set());
      if (editLink) {
        setSelectedPlatform(editLink.platform);
        setTitle(editLink.title);
        setSubtitle(editLink.subtitle || "");
        setThumbnailUrl(editLink.thumbnailUrl || null);
        setDestinationUrl(editLink.destinationUrl || "");
        setCloakEnabled(editLink.cloakEnabled);
        setSafePage(editLink.safePage || null);
        setIsActive(editLink.isActive);
        setAppearance(editLink.appearance ?? { ...DEFAULT_LINK_APPEARANCE, color: getPlatformColor(editLink.platform) });
      } else {
        setSelectedPlatform(null);
        setTitle("");
        setSubtitle("");
        setThumbnailUrl(null);
        setDestinationUrl("");
        setCloakEnabled(false);
        setSafePage(null);
        setIsActive(true);
        setAppearance({ ...DEFAULT_LINK_APPEARANCE });
      }
    }
  }, [open, editLink, initialTab]);

  // Sync appearance state with focused link when in list mode
  useEffect(() => {
    if (isListMode && focusedLink) {
      setAppearance(focusedLink.appearance ?? { ...DEFAULT_LINK_APPEARANCE, color: getPlatformColor(focusedLink.platform) });
    }
  }, [focusedLinkId, isListMode]);

  // Disponibilidade do slug, pela API.
  //
  // A comparação é com o slug SALVO (`profileData?.slug`) e não com uma
  // constante: com `MOCK_USER.slug` ali, o slug da própria criadora aparecia
  // como "em uso" e o de outra pessoa como "livre".
  useEffect(() => {
    const slugSalvo = profileData?.slug ?? "";
    if (!profileSlug || profileSlug === slugSalvo) { setSlugStatus("idle"); return; }
    if (!validateSlug(profileSlug)) { setSlugStatus("invalid"); return; }

    setSlugStatus("checking");
    let cancelado = false;

    const t = setTimeout(async () => {
      try {
        const { available } = await api.slugAvailable(profileSlug);
        if (!cancelado) setSlugStatus(available ? "valid" : "taken");
      } catch {
        // Falha de rede não é "indisponível": manter `checking` deixa o botão
        // desabilitado em vez de liberar um slug que talvez não exista.
        if (!cancelado) setSlugStatus("checking");
      }
    }, 400);

    return () => { cancelado = true; clearTimeout(t); };
  }, [profileSlug, profileData?.slug]);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) { const r = new FileReader(); r.onloadend = () => setProfileAvatar(r.result as string); r.readAsDataURL(file); }
  };

  const handleCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) { const r = new FileReader(); r.onloadend = () => setProfileCover(r.result as string); r.readAsDataURL(file); }
  };

  const handleSaveProfile = () => {
    if (slugStatus === "invalid" || slugStatus === "taken") return;
    onSaveProfile?.({ displayName: profileDisplayName, slug: profileSlug, bio: profileBio, avatarUrl: profileAvatar, coverUrl: profileCover });
    toast.success("Perfil atualizado! ✓");
    onClose();
  };

  const handleThumbnailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const r = new FileReader();
      r.onloadend = () => setThumbnailUrl(r.result as string);
      r.readAsDataURL(file);
    }
  };

  const handleSelectPlatform = (platformId: string) => {
    setSelectedPlatform(platformId);
    const platform = PLATFORMS.find((p) => p.id === platformId);
    if (platform && !editLink) {
      setTitle(`Meu ${platform.label}`);
      setAppearance((prev) => ({ ...prev, color: platform.color }));
    }
  };

  // In list mode: auto-save appearance for focused link
  const handleListAppearanceChange = (newAppearance: LinkAppearance) => {
    setAppearance(newAppearance);
    if (focusedLinkId) {
      onSave({ id: focusedLinkId, appearance: newAppearance });
    }
  };

  // In list mode: add a new link via platform picker
  const handleListAddLink = (platformId: string) => {
    const platform = PLATFORMS.find((p) => p.id === platformId)!;
    const newId = `l${Date.now()}`;
    // Rascunho: entra na lista sem destino, para a pessoa preencher a URL na
    // própria linha. O `id` provisório (`l<timestamp>`) é o que a página usa
    // para saber que este link ainda NÃO existe na API — ela só o cria quando o
    // destino é preenchido. Ver `handleSaveLink` em `app/links/page.tsx`.
    //
    // `shortCode` saiu do payload: quem escolhe o código curto é o servidor. É
    // o endereço público do link, e um cliente que pudesse escolhê-lo poderia
    // tentar colidir com o de outra criadora.
    const newLink: Partial<Link> = {
      id: newId,
      title: `Meu ${platform.label}`,
      platform: platformId,
      isActive: true,
      position: 0,
      clicks: 0,
      cloakEnabled: false,
      destinationUrl: "",
    };
    onSave(newLink);
    setNewLinkIds((s) => new Set([...s, newId]));
    setFocusedLinkId(newId);
    setShowPicker(false);
  };

  const buildLinkPayload = () => ({
    ...(editLink?.id && { id: editLink.id }),
    title: title.trim(),
    subtitle: subtitle.trim() || undefined,
    thumbnailUrl: thumbnailUrl || undefined,
    platform: selectedPlatform!,
    destinationUrl: destinationUrl.trim(),
    cloakEnabled,
    safePage: cloakEnabled ? safePage : null,
    isActive,
    clicks: editLink?.clicks || 0,
    position: editLink?.position ?? 0,
    appearance,
  });

  const validateLinkForm = () => {
    if (!selectedPlatform || !title.trim()) {
      setActiveTab("link");
      toast.error("Selecione uma plataforma e preencha o título");
      return false;
    }
    // O destino é obrigatório e a API o recusa vazio — um link sem destino é um
    // botão que não leva a lugar nenhum. Validar aqui mostra o erro no campo,
    // em vez de deixar a requisição falhar depois do "salvar".
    if (!appearanceOnly && !destinationUrl.trim()) {
      setActiveTab("link");
      toast.error("Informe o link de destino");
      return false;
    }
    if (!appearanceOnly && cloakEnabled && (!safePage || safePage.socialLinks.length === 0)) {
      toast.error("Configure a SafePage antes de salvar", {
        description: "A SafePage é obrigatória quando o cloaking está ativo.",
      });
      return false;
    }
    return true;
  };

  const handleSave = () => {
    if (!validateLinkForm()) return;
    onSave(buildLinkPayload());
    toast.success("Link salvo! ✓");
    onClose();
  };

  const handleSaveAndAddAnother = () => {
    if (!validateLinkForm()) return;
    onSave(buildLinkPayload());
    toast.success("Link salvo! Adicione o próximo ✓");
    // Reset fields but keep modal open
    setSelectedPlatform(null);
    setTitle("");
    setSubtitle("");
    setThumbnailUrl(null);
    setDestinationUrl("");
    setCloakEnabled(false);
    setSafePage(null);
    setIsActive(true);
    setAppearance({ ...DEFAULT_LINK_APPEARANCE });
    setActiveTab("link");
  };

  const platformData = PLATFORMS.find((p) => p.id === selectedPlatform);
  const platformIcon = platformData?.icon ?? "⭐";

  const tabs: { id: ModalTab; label: string; icon: React.ReactNode }[] = [
    { id: "link", label: "Link", icon: <Link2 style={{ width: 14, height: 14 }} /> },
    { id: "aparencia", label: "Aparência", icon: <Palette style={{ width: 14, height: 14 }} /> },
    ...(!appearanceOnly ? [{ id: "perfil" as ModalTab, label: "Perfil", icon: <User style={{ width: 14, height: 14 }} /> }] : []),
  ];

  // ── Preview helpers ──────────────────────────────────────────────────────
  const previewTheme = THEMES.find((t) => t.id === profileData?.themeId) ?? THEMES[0];
  const previewProfile = profileData ?? {
    displayName: "",
    slug: "",
    bio: "",
    avatarUrl: null,
    coverUrl: null,
    buttonStyle: "soft",
  };
  // Merge live appearance into focused link for real-time preview
  const previewLinks = allLinks.map((l) =>
    l.id === (isListMode ? focusedLinkId : editLink?.id) ? { ...l, appearance } : l
  );

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent
        className="overflow-hidden rounded-2xl p-0 flex flex-row"
        style={{
          background: "rgba(10,10,10,0.95)",
          backdropFilter: "blur(40px)",
          WebkitBackdropFilter: "blur(40px)",
          border: "1px solid rgba(255,255,255,0.09)",
          boxShadow: "0 40px 100px rgba(0,0,0,0.85), 0 0 0 1px rgba(255,255,255,0.04), inset 0 1px 0 rgba(255,255,255,0.06)",
          height: "min(88vh, 720px)",
          width: "min(900px, 96vw)",
          maxWidth: "900px",
          maxHeight: "88vh",
        }}
      >
        {/* ── LEFT PANEL: editing area ─────────────────────────────────── */}
        <div className="flex flex-col min-w-0 overflow-hidden" style={{ flex: "1 1 0", minWidth: 0 }}>

        {/* Header */}
        <div className="px-6 pt-5 pb-0 flex-shrink-0">
          <div className="flex items-start justify-between mb-4">
            <h2 className="font-bebas text-2xl uppercase tracking-widest text-white leading-none">
              {isListMode ? "GERENCIAR LINKS" : editLink ? "EDITAR LINK" : "ADICIONAR LINK"}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center transition-all focus:outline-none ml-3 mt-0.5"
              style={{
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.08)",
                color: "rgba(255,255,255,0.35)",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background = "rgba(255,60,110,0.12)";
                (e.currentTarget as HTMLElement).style.border = "1px solid rgba(255,60,110,0.3)";
                (e.currentTarget as HTMLElement).style.color = "#FF3C6E";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.05)";
                (e.currentTarget as HTMLElement).style.border = "1px solid rgba(255,255,255,0.08)";
                (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.35)";
              }}
            >
              <X style={{ width: 13, height: 13 }} />
            </button>
          </div>

          {/* Tabs */}
          <div
            className="flex gap-1 p-1 rounded-xl mb-0"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
          >
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold transition-all duration-200 focus:outline-none"
                style={{
                  background: activeTab === tab.id ? "rgba(255,60,110,0.12)" : "transparent",
                  color: activeTab === tab.id ? "#fff" : "rgba(255,255,255,0.35)",
                  border: activeTab === tab.id ? "1px solid rgba(255,60,110,0.3)" : "1px solid transparent",
                  boxShadow: activeTab === tab.id ? "0 0 12px rgba(255,60,110,0.1)" : "none",
                }}
              >
                {tab.icon}
                {tab.label}
                {tab.id === "aparencia" && appearance.themePresetId && (
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ background: "#FF3C6E", boxShadow: "0 0 6px #FF3C6E" }}
                  />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-6 py-5 min-h-0" style={{ scrollbarWidth: "none" }}>
          <AnimatePresence mode="wait">
            {activeTab === "link" ? (
              <motion.div
                key="link"
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.2 }}
                className="space-y-4"
              >
                {/* ── LIST MODE: Beacons-style ──────────────────────────── */}
                {isListMode ? (
                  <div className="space-y-3">
                    {/* Add link button */}
                    <motion.button
                      type="button"
                      onClick={() => setShowPicker((v) => !v)}
                      whileTap={{ scale: 0.98 }}
                      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all focus:outline-none"
                      style={{
                        background: showPicker ? "rgba(255,60,110,0.08)" : "rgba(255,255,255,0.04)",
                        border: showPicker ? "1px solid rgba(255,60,110,0.3)" : "1px solid rgba(255,255,255,0.1)",
                        color: showPicker ? "#FF3C6E" : "rgba(255,255,255,0.5)",
                      }}
                    >
                      <motion.span animate={{ rotate: showPicker ? 45 : 0 }} transition={{ duration: 0.2 }} style={{ display: "inline-flex" }}>
                        <Plus style={{ width: 15, height: 15 }} />
                      </motion.span>
                      {showPicker ? "Cancelar" : "Adicionar link"}
                    </motion.button>

                    {/* Platform picker */}
                    <AnimatePresence>
                      {showPicker && (
                        <ModalPlatformPicker onSelect={handleListAddLink} onClose={() => setShowPicker(false)} />
                      )}
                    </AnimatePresence>

                    {/* Links list */}
                    {allLinks.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-10">
                        <p className="text-sm text-white/25">Nenhum link ainda. Adicione o primeiro acima.</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {allLinks.map((link) => (
                          <InlineLinkRow
                            key={link.id}
                            link={link}
                            isNew={newLinkIds.has(link.id)}
                            isFocused={focusedLinkId === link.id}
                            onSave={(data) => {
                              onSave(data);
                              setNewLinkIds((s) => { const n = new Set(s); n.delete(link.id); return n; });
                            }}
                            onDelete={() => {
                              onDelete?.(link.id);
                              if (focusedLinkId === link.id) setFocusedLinkId(allLinks.find(l => l.id !== link.id)?.id || null);
                            }}
                            onEditAppearance={() => {
                              setFocusedLinkId(link.id);
                              setActiveTab("aparencia");
                            }}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                <>
                {/* ── SINGLE LINK MODE (original) ──────────────────────── */}
                {/* Plataforma */}
                <div>
                  <label className="block text-[10px] font-semibold text-white/30 uppercase tracking-widest mb-3">
                    Plataforma
                  </label>
                  <div className="grid grid-cols-5 gap-2">
                    {PLATFORMS.map((platform) => {
                      const isSelected = selectedPlatform === platform.id;
                      return (
                        <motion.button
                          key={platform.id}
                          type="button"
                          onClick={() => handleSelectPlatform(platform.id)}
                          whileTap={{ scale: 0.91 }}
                          className="flex flex-col items-center justify-center gap-1.5 py-3 rounded-xl transition-all duration-200 focus:outline-none"
                          style={{
                            background: isSelected ? "rgba(255,60,110,0.1)" : "rgba(255,255,255,0.03)",
                            border: isSelected ? "1px solid rgba(255,60,110,0.5)" : "1px solid rgba(255,255,255,0.07)",
                            boxShadow: isSelected ? "0 0 14px rgba(255,60,110,0.2)" : "none",
                          }}
                        >
                          <span className="text-xl leading-none">{platform.icon}</span>
                          <span className="text-[9px] text-center leading-tight font-medium transition-colors duration-200"
                            style={{ color: isSelected ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.3)" }}>
                            {platform.label.split(" ")[0]}
                          </span>
                        </motion.button>
                      );
                    })}
                  </div>
                </div>

                <AnimatePresence>
                  {selectedPlatform && (
                    <motion.div
                      key="fields"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 8 }}
                      transition={{ duration: 0.2 }}
                      className="space-y-4"
                    >
                  {/* ── Configuração do Link Card ──────────────────── */}
                  {(() => {
                    const hint = PLATFORM_URL_HINTS[selectedPlatform || "custom"] ?? PLATFORM_URL_HINTS.custom;
                    const shortCode = editLink?.shortCode || "xxxxxx";
                    const hasUrl = destinationUrl.trim().length > 0;
                    const platformColor = getPlatformColor(selectedPlatform || "custom");
                    const platformIcon = PLATFORMS.find(p => p.id === selectedPlatform)?.icon ?? "⭐";

                    return (
                      <div className="space-y-4">
                        {/* Card visual do link */}
                        <div className="rounded-2xl overflow-hidden"
                          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>

                          {/* Row: thumbnail + campos */}
                          <div className="flex gap-3 p-4">
                            {/* Thumbnail upload */}
                            <div className="flex-shrink-0">
                              <input ref={thumbnailInputRef} type="file" accept="image/*" onChange={handleThumbnailChange} className="hidden" />
                              <button
                                type="button"
                                onClick={() => thumbnailInputRef.current?.click()}
                                className="relative w-16 h-16 rounded-xl overflow-hidden flex items-center justify-center group transition-all focus:outline-none"
                                style={{
                                  background: thumbnailUrl ? "transparent" : `${platformColor}15`,
                                  border: thumbnailUrl ? "none" : `1.5px dashed ${platformColor}40`,
                                }}
                                title="Adicionar imagem ao link"
                              >
                                {thumbnailUrl ? (
                                  <>
                                    <img src={thumbnailUrl} alt="thumbnail" className="w-full h-full object-cover" />
                                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                      <Camera style={{ width: 16, height: 16, color: "#fff" }} />
                                    </div>
                                  </>
                                ) : (
                                  <div className="flex flex-col items-center gap-1">
                                    <span className="text-xl leading-none">{platformIcon}</span>
                                    <div className="absolute bottom-1 right-1 w-4 h-4 rounded-full flex items-center justify-center"
                                      style={{ background: platformColor }}>
                                      <ImagePlus style={{ width: 8, height: 8, color: "#fff" }} />
                                    </div>
                                  </div>
                                )}
                              </button>
                              {thumbnailUrl && (
                                <button type="button" onClick={() => setThumbnailUrl(null)}
                                  className="mt-1 w-16 flex items-center justify-center gap-0.5 text-[9px] text-white/25 hover:text-red-400 transition-colors focus:outline-none">
                                  <Trash2 style={{ width: 9, height: 9 }} /> remover
                                </button>
                              )}
                            </div>

                            {/* Título + Subtítulo */}
                            <div className="flex-1 space-y-2">
                              <div className="relative">
                                <input
                                  value={title}
                                  onChange={(e) => setTitle(e.target.value)}
                                  placeholder={`Ex: Meu ${PLATFORMS.find(p => p.id === selectedPlatform)?.label ?? "Link"}`}
                                  className="w-full px-3 py-2.5 rounded-xl text-sm font-semibold text-white placeholder-white/20 outline-none transition-all duration-200"
                                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
                                  onFocus={(e) => { e.currentTarget.style.border = "1px solid rgba(255,60,110,0.4)"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(255,60,110,0.08)"; }}
                                  onBlur={(e) => { e.currentTarget.style.border = "1px solid rgba(255,255,255,0.1)"; e.currentTarget.style.boxShadow = "none"; }}
                                />
                              </div>
                              <div className="relative">
                                <input
                                  value={subtitle}
                                  onChange={(e) => setSubtitle(e.target.value)}
                                  placeholder="Subtítulo opcional..."
                                  maxLength={60}
                                  className="w-full px-3 py-2 rounded-xl text-xs text-white/60 placeholder-white/15 outline-none transition-all duration-200"
                                  style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
                                  onFocus={(e) => { e.currentTarget.style.border = "1px solid rgba(255,60,110,0.3)"; }}
                                  onBlur={(e) => { e.currentTarget.style.border = "1px solid rgba(255,255,255,0.06)"; }}
                                />
                                {subtitle.length > 0 && (
                                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[9px] text-white/20">
                                    {subtitle.length}/60
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* URL de destino */}
                          <div className="px-4 pb-4 space-y-2">
                            <div className="flex items-center justify-between">
                              <label className="text-[10px] font-semibold text-white/30 uppercase tracking-widest flex items-center gap-1.5">
                                <span>🔒</span> URL de destino
                              </label>
                              <span className="text-[9px] text-white/20 italic">privada · nunca exibida</span>
                            </div>
                            <div className="relative">
                              <input
                                value={destinationUrl}
                                onChange={(e) => setDestinationUrl(e.target.value)}
                                placeholder={hint.placeholder}
                                className="w-full px-3.5 py-3 rounded-xl text-sm text-white placeholder-white/15 outline-none transition-all duration-200"
                                style={{
                                  background: hasUrl ? "rgba(74,222,128,0.04)" : "rgba(255,255,255,0.04)",
                                  border: hasUrl ? "1px solid rgba(74,222,128,0.3)" : "1px solid rgba(255,255,255,0.08)",
                                }}
                                onFocus={(e) => { e.currentTarget.style.border = "1px solid rgba(255,60,110,0.45)"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(255,60,110,0.08)"; e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}
                                onBlur={(e) => { e.currentTarget.style.border = hasUrl ? "1px solid rgba(74,222,128,0.3)" : "1px solid rgba(255,255,255,0.08)"; e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.background = hasUrl ? "rgba(74,222,128,0.04)" : "rgba(255,255,255,0.04)"; }}
                              />
                              {hasUrl && (
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full flex items-center justify-center"
                                  style={{ background: "rgba(74,222,128,0.2)" }}>
                                  <Check style={{ width: 10, height: 10, color: "#4ade80" }} />
                                </div>
                              )}
                            </div>

                            <p className="text-[10px] text-white/20 px-1">{hint.hint}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                      {/* Cloaking */}
                      <CloakToggle checked={cloakEnabled} onChange={setCloakEnabled} />

                      {/* SafePage */}
                      <AnimatePresence>
                        {cloakEnabled && (
                          <motion.div key="safepage" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.28 }} className="overflow-hidden">
                            <SafePageBuilder safePage={safePage} onSafePageChange={setSafePage} />
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {/* Ativo */}
                      <ActiveToggle checked={isActive} onChange={setIsActive} />

                      {/* CTA Aparência */}
                      <button
                        type="button"
                        onClick={() => setActiveTab("aparencia")}
                        className="w-full flex items-center justify-between px-4 py-3 rounded-xl focus:outline-none transition-all duration-200"
                        style={{
                          background: "rgba(155,109,255,0.06)",
                          border: "1px solid rgba(155,109,255,0.25)",
                        }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(155,109,255,0.1)"; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(155,109,255,0.06)"; }}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "rgba(155,109,255,0.15)" }}>
                            <Palette style={{ width: 14, height: 14, color: "#9b6dff" }} />
                          </div>
                          <div className="text-left">
                            <div className="text-sm font-semibold text-white/70">Personalizar aparência</div>
                            <div className="text-[11px] text-white/25">
                              {appearance.themePresetId
                                ? `Tema: ${APPEARANCE_PRESETS.find(p => p.id === appearance.themePresetId)?.name ?? "Personalizado"}`
                                : "Estilo, cor, gradiente, glow..."}
                            </div>
                          </div>
                        </div>
                        <ChevronRight style={{ width: 16, height: 16, color: "rgba(255,255,255,0.2)" }} />
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
                </>
                )}
              </motion.div>
            ) : activeTab === "aparencia" ? (
              <motion.div
                key="aparencia"
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 12 }}
                transition={{ duration: 0.2 }}
              >
                {isListMode && focusedLink && (
                  <div className="flex items-center gap-2 mb-4 px-3 py-2 rounded-xl"
                    style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
                    <span className="text-sm">{getPlatformIcon(focusedLink.platform)}</span>
                    <span className="text-xs font-semibold text-white/60 truncate">{focusedLink.title}</span>
                    <button type="button" onClick={() => setActiveTab("link")}
                      className="ml-auto text-[10px] text-white/30 hover:text-white/60 transition-colors focus:outline-none flex items-center gap-1">
                      ← voltar
                    </button>
                  </div>
                )}
                <AppearanceTab
                  appearance={appearance}
                  onChange={isListMode ? handleListAppearanceChange : setAppearance}
                  title={isListMode ? (focusedLink?.title || "Link") : (title || "Meu Link")}
                  icon={isListMode ? (getPlatformIcon(focusedLink?.platform || "custom")) : platformIcon}
                  allLinks={allLinks}
                  editLinkId={isListMode ? focusedLinkId ?? undefined : editLink?.id}
                  profileData={profileData}
                />
              </motion.div>
            ) : (
              <motion.div
                key="perfil"
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 12 }}
                transition={{ duration: 0.2 }}
                className="space-y-5"
              >
                {/* Cover + Avatar */}
                <div className="relative">
                  <input type="file" accept="image/*" onChange={handleCoverChange} className="hidden" id="lm-cover" />
                  <label htmlFor="lm-cover"
                    className="block w-full h-20 rounded-2xl cursor-pointer overflow-hidden group relative"
                    style={{
                      background: profileCover ? `url(${profileCover}) center/cover` : "linear-gradient(135deg, #1a1a1a, #0f0f0f)",
                      border: "1px solid rgba(255,255,255,0.07)",
                    }}>
                    {!profileCover && (
                      <div className="flex flex-col items-center justify-center h-full gap-1">
                        <Camera style={{ width: 18, height: 18, color: "rgba(255,255,255,0.15)" }} />
                        <span className="text-[10px] text-white/20">Adicionar capa</span>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <Camera style={{ width: 16, height: 16, color: "#fff" }} />
                      <span className="text-xs text-white font-medium">Alterar capa</span>
                    </div>
                  </label>
                  {/* Avatar overlapping cover */}
                  <div className="absolute -bottom-5 left-4">
                    <input type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" id="lm-avatar" />
                    <label htmlFor="lm-avatar"
                      className="block w-12 h-12 rounded-full cursor-pointer overflow-hidden group relative"
                      style={{ border: "2.5px solid rgba(8,8,8,0.9)", boxShadow: "0 0 0 1.5px rgba(255,60,110,0.35)" }}>
                      {profileAvatar ? (
                        <img src={profileAvatar} alt="avatar" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center" style={{ background: "rgba(255,60,110,0.08)" }}>
                          <span className="font-bebas text-base text-bee-pink">
                            {profileDisplayName.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)}
                          </span>
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Camera style={{ width: 12, height: 12, color: "#fff" }} />
                      </div>
                    </label>
                  </div>
                </div>

                {/* Space for avatar overflow */}
                <div className="h-3" />

                {/* Display Name */}
                <div>
                  <label className="block text-[10px] font-semibold text-white/30 uppercase tracking-widest mb-2">
                    Nome de exibição
                  </label>
                  <input
                    value={profileDisplayName}
                    onChange={(e) => setProfileDisplayName(e.target.value)}
                    placeholder="Ex: Bella ✨"
                    className="w-full px-4 py-2.5 rounded-xl text-sm text-white placeholder-white/20 focus:outline-none transition-all"
                    style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
                    onFocus={(e) => { e.currentTarget.style.border = "1px solid rgba(255,60,110,0.4)"; e.currentTarget.style.background = "rgba(255,60,110,0.04)"; }}
                    onBlur={(e) => { e.currentTarget.style.border = "1px solid rgba(255,255,255,0.08)"; e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}
                  />
                </div>

                {/* Slug */}
                <div>
                  <label className="block text-[10px] font-semibold text-white/30 uppercase tracking-widest mb-2">
                    Usuário
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="px-3 py-2.5 rounded-xl text-xs text-white/25 flex-shrink-0"
                      style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                      {siteHost()}/
                    </span>
                    <div className="flex-1 relative">
                      <input
                        value={profileSlug}
                        onChange={(e) => setProfileSlug(slugify(e.target.value))}
                        placeholder="usuario"
                        className="w-full px-4 py-2.5 pr-10 rounded-xl text-sm text-white placeholder-white/20 focus:outline-none transition-all"
                        style={{
                          background: "rgba(255,255,255,0.04)",
                          border: slugStatus === "valid" ? "1px solid rgba(34,197,94,0.5)"
                            : (slugStatus === "invalid" || slugStatus === "taken") ? "1px solid rgba(239,68,68,0.5)"
                            : "1px solid rgba(255,255,255,0.08)",
                        }}
                      />
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        {slugStatus === "checking" && <Loader2 style={{ width: 14, height: 14, color: "rgba(255,255,255,0.3)" }} className="animate-spin" />}
                        {slugStatus === "valid" && <CheckCircle2 style={{ width: 14, height: 14, color: "#22c55e" }} />}
                        {(slugStatus === "invalid" || slugStatus === "taken") && <XCircle style={{ width: 14, height: 14, color: "#ef4444" }} />}
                      </div>
                    </div>
                  </div>
                  {slugStatus === "valid" && <p className="text-[10px] text-green-500 mt-1 ml-1">✓ Disponível!</p>}
                  {slugStatus === "taken" && <p className="text-[10px] text-red-400 mt-1 ml-1">✗ Já utilizado</p>}
                  {slugStatus === "invalid" && <p className="text-[10px] text-orange-400 mt-1 ml-1">Use apenas letras, números e -</p>}
                </div>

                {/* Bio */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-[10px] font-semibold text-white/30 uppercase tracking-widest">Bio</label>
                    <span className="text-[10px] text-white/20">{profileBio.length}/150</span>
                  </div>
                  <textarea
                    value={profileBio}
                    onChange={(e) => { if (e.target.value.length <= 150) setProfileBio(e.target.value); }}
                    placeholder="Conte um pouco sobre você..."
                    rows={3}
                    className="w-full px-4 py-2.5 rounded-xl text-sm text-white placeholder-white/20 focus:outline-none transition-all resize-none"
                    style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
                    onFocus={(e) => { e.currentTarget.style.border = "1px solid rgba(255,60,110,0.4)"; e.currentTarget.style.background = "rgba(255,60,110,0.04)"; }}
                    onBlur={(e) => { e.currentTarget.style.border = "1px solid rgba(255,255,255,0.08)"; e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-end gap-2 px-6 py-4 flex-shrink-0"
          style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
        >
          {isListMode ? (
            /* List mode: auto-save, just close button unless on profile tab */
            activeTab === "perfil" ? (
              <>
                <button type="button" onClick={onClose}
                  className="px-4 py-2.5 rounded-xl text-sm font-medium focus:outline-none transition-all"
                  style={{ color: "rgba(255,255,255,0.4)" }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "#fff"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.4)"; }}
                >
                  Cancelar
                </button>
                <motion.button type="button" onClick={handleSaveProfile} whileTap={{ scale: 0.96 }}
                  className="px-5 py-2.5 rounded-xl text-white text-sm font-bold uppercase tracking-wider focus:outline-none"
                  style={{ background: "linear-gradient(135deg,#FF3C6E,#FF1F57)", boxShadow: "0 4px 20px rgba(255,60,110,0.35)" }}>
                  SALVAR PERFIL
                </motion.button>
              </>
            ) : (
              <button type="button" onClick={onClose}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold focus:outline-none transition-all"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.6)" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "#fff"; (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.08)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.6)"; (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.05)"; }}
              >
                Fechar
              </button>
            )
          ) : (
            /* Single link mode: original save buttons */
            <>
              <button type="button" onClick={onClose}
                className="px-4 py-2.5 rounded-xl text-sm font-medium focus:outline-none transition-all"
                style={{ color: "rgba(255,255,255,0.4)" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "#fff"; (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.05)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.4)"; (e.currentTarget as HTMLElement).style.background = "transparent"; }}
              >
                Cancelar
              </button>
              <motion.button type="button"
                onClick={activeTab === "perfil" ? handleSaveProfile : handleSave}
                whileTap={{ scale: 0.96 }} whileHover={{ scale: 1.02 }}
                className="px-5 py-2.5 rounded-xl text-white text-sm font-bold uppercase tracking-wider focus:outline-none flex-shrink-0"
                style={{ background: "linear-gradient(135deg,#FF3C6E,#FF1F57)", boxShadow: "0 4px 20px rgba(255,60,110,0.35),inset 0 1px 0 rgba(255,255,255,0.15)" }}>
                {activeTab === "perfil" ? "SALVAR PERFIL" : "SALVAR LINK"}
              </motion.button>
            </>
          )}
        </div>

        </div>{/* end LEFT PANEL */}

        {/* ── RIGHT PANEL: live preview (≥ 768px only) ───────────────── */}
        <div
          className="hidden md:flex flex-col flex-shrink-0"
          style={{
            width: 260,
            borderLeft: "1px solid rgba(255,255,255,0.07)",
            background: "rgba(0,0,0,0.4)",
          }}
        >
          {/* ── Branding bar ── */}
          <div
            className="flex-shrink-0 px-4 pt-4 pb-3"
            style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}
          >
            <div className="flex items-center gap-2 mb-1.5">
              {/* Live dot */}
              <div className="relative w-1.5 h-1.5 flex-shrink-0">
                <div className="absolute inset-0 rounded-full animate-ping opacity-60" style={{ background: "#4ade80" }} />
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: "#4ade80" }} />
              </div>
              <span className="text-[9px] font-bold uppercase tracking-[0.18em]" style={{ color: "rgba(255,255,255,0.25)" }}>
                Prévia ao vivo
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[15px] leading-none select-none">🐝</span>
              <span
                className="font-bebas tracking-widest leading-none"
                style={{ fontSize: 17, color: "#FF3C6E", letterSpacing: "0.14em" }}
              >
                BEESOCIAL
              </span>
            </div>
          </div>

          {/* ── Phone mockup (aspect-ratio preservado, escala uniforme) ── */}
          <div
            className="flex-1 flex flex-col items-center overflow-hidden min-h-0"
            style={{ paddingTop: 20, paddingBottom: 8 }}
          >
            {/* Container com proporção fixa de celular (240:490) para não espremer */}
            <div
              className="flex flex-shrink-0 items-start justify-center w-full"
              style={{
                aspectRatio: "240 / 490",
                maxWidth: 232,
              }}
            >
              <div
                style={{
                  width: 240,
                  height: 490,
                  transform: "scale(0.967)",
                  transformOrigin: "top center",
                }}
              >
                <PhoneMockup
                  themeBg={previewTheme.bg}
                  themeAccent={previewTheme.accent}
                  avatarUrl={previewProfile.avatarUrl}
                  displayName={previewProfile.displayName}
                  bio={previewProfile.bio}
                  buttonStyle={profileData?.buttonStyle ?? "soft"}
                  links={previewLinks}
                />
              </div>
            </div>
          </div>

          {/* ── URL strip ── */}
          <div
            className="flex-shrink-0 px-3 pb-3 pt-2"
            style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}
          >
            <div
              className="flex items-center gap-1.5 rounded-xl px-2.5 py-2"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
            >
              <span
                className="text-[9px] font-mono flex-1 truncate"
                style={{ color: "rgba(255,255,255,0.3)" }}
              >
                {siteHost()}/{previewProfile.slug}
              </span>
              <a
                href={`/${previewProfile.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-shrink-0 text-[9px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-lg"
                style={{
                  background: "linear-gradient(135deg,#FF3C6E,#FF1F57)",
                  color: "#fff",
                  boxShadow: "0 1px 8px rgba(255,60,110,0.3)",
                }}
              >
                VER
              </a>
            </div>
          </div>
        </div>{/* end RIGHT PANEL */}

      </DialogContent>
    </Dialog>
  );
}
