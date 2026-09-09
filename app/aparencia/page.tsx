"use client";

import React, { useState, useEffect } from "react";
import { Camera, CheckCircle2, XCircle, Loader2, Palette, ChevronRight, Sparkles, User, Link2 } from "lucide-react";
import { motion } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { PhoneMockup } from "@/components/shared/PhoneMockup";
import { LinkModal, ModalTab } from "@/components/dashboard/LinkModal";
import { toast, Toaster } from "sonner";
import {
  THEMES, Link,
  LinkAppearance, DEFAULT_LINK_APPEARANCE,
} from "@/lib/catalog";
import { validateSlug, slugify, getPlatformColor, getPlatformIcon } from "@/lib/utils";
import { api, ApiError } from "@/lib/api/client";
import type { ApiLink } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { siteHost } from "@/lib/site";
import { useRouter } from "next/navigation";

type PageTab = "perfil" | "links";

/** `ApiLink` já é compatível com o `Link` da UI; a conversão é só de forma
 *  (`subtitle` opcional em vez de anulável). */
function paraLinkDaUi(link: ApiLink): Link {
  return { ...link, subtitle: link.subtitle ?? undefined };
}

// ── Mini Button Preview (inline, sem import do modal) ──────────────────────────
function MiniLinkPreview({ appearance, title, icon }: { appearance: LinkAppearance; title: string; icon: string }) {
  const { style, color, useGradient, gradientTo, glow, showIcon, showArrow } = appearance;
  const isPill = style === "pill";

  const bg = (() => {
    switch (style) {
      case "filled": return useGradient ? `linear-gradient(135deg, ${color}, ${gradientTo})` : color;
      case "soft": case "pill": return `${color}22`;
      case "glass": return "rgba(255,255,255,0.07)";
      case "outlined": return "transparent";
    }
  })();
  const border = (() => {
    switch (style) {
      case "filled": return "none";
      case "soft": case "pill": return `1px solid ${color}44`;
      case "glass": return "1px solid rgba(255,255,255,0.12)";
      case "outlined": return `2px solid ${color}`;
    }
  })();
  const textColor = style === "filled" ? "#fff" : color;

  return (
    <div className="flex items-center gap-2 px-3 py-2 w-full"
      style={{
        borderRadius: isPill ? 999 : 8,
        background: bg, border,
        backdropFilter: style === "glass" ? "blur(8px)" : undefined,
        boxShadow: glow ? `0 2px 12px ${color}55` : undefined,
      }}>
      {showIcon && <span style={{ fontSize: 13, lineHeight: 1 }}>{icon}</span>}
      <span className="flex-1 truncate font-semibold text-xs" style={{ color: textColor }}>{title}</span>
      {showArrow && <ChevronRight style={{ width: 11, height: 11, color: `${textColor}70`, flexShrink: 0 }} />}
    </div>
  );
}

export default function AparenciaPage() {
  const router = useRouter();
  const [pageTab, setPageTab] = useState<PageTab>("perfil");

  // Estados do formulário. Começam vazios e são preenchidos pela API — antes
  // eram inicializados com `MOCK_USER`, o que fazia a tela abrir mostrando o
  // perfil de outra pessoa (a "Bella" de mentira) para qualquer criadora.
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugAtual, setSlugAtual] = useState("");
  const [slugStatus, setSlugStatus] = useState<
    "idle" | "checking" | "valid" | "invalid" | "taken"
  >("idle");
  const [bio, setBio] = useState("");
  const [selectedTheme, setSelectedTheme] = useState("neon-pink");
  const [buttonStyle, setButtonStyle] = useState("soft");
  const [isAdult, setIsAdult] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  // Estado dos links (para editar aparência)
  const [links, setLinks] = useState<Link[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingLink, setEditingLink] = useState<Link | null>(null);
  const [modalTab, setModalTab] = useState<ModalTab>("aparencia");

  const tratarErro = React.useCallback(
    (caught: unknown, fallback: string) => {
      if (caught instanceof ApiError && caught.isUnauthorized) {
        router.replace("/login?de=/aparencia");
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
        const [perfil, apiLinks] = await Promise.all([api.profile(), api.links()]);
        if (cancelado) return;
        setAvatarPreview(perfil.avatarUrl);
        setCoverPreview(perfil.coverUrl);
        setDisplayName(perfil.displayName);
        setSlug(perfil.slug);
        setSlugAtual(perfil.slug);
        setBio(perfil.bio);
        setSelectedTheme(perfil.themeId);
        setButtonStyle(perfil.buttonStyle);
        setIsAdult(perfil.isAdult);
        setLinks(apiLinks.map(paraLinkDaUi));
      } catch (caught) {
        if (!cancelado) tratarErro(caught, "Não foi possível carregar seu perfil.");
      } finally {
        if (!cancelado) setCarregando(false);
      }
    })();

    return () => {
      cancelado = true;
    };
  }, [tratarErro]);

  /**
   * Disponibilidade do slug.
   *
   * Comparado com `slugAtual` (o que está salvo), não com uma constante: com
   * `MOCK_USER.slug` no lugar, o próprio slug da criadora aparecia como "em
   * uso" e o dela como "livre". A consulta é a mesma da tela de cadastro, e a
   * API já ignora o perfil da própria sessão ao responder.
   */
  useEffect(() => {
    if (!slug || slug === slugAtual) {
      setSlugStatus("idle");
      return;
    }

    if (!validateSlug(slug)) {
      setSlugStatus("invalid");
      return;
    }

    setSlugStatus("checking");
    let cancelado = false;

    const timer = setTimeout(async () => {
      try {
        const { available } = await api.slugAvailable(slug);
        if (!cancelado) setSlugStatus(available ? "valid" : "taken");
      } catch {
        if (!cancelado) setSlugStatus("checking");
      }
    }, 400);

    return () => {
      cancelado = true;
      clearTimeout(timer);
    };
  }, [slug, slugAtual]);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setCoverPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  /**
   * Salvar o perfil.
   *
   * O que havia aqui: um `setTimeout` de 600 ms que só mostrava "Perfil
   * atualizado! ✓". Nada saía da tela, e no refresh tudo voltava.
   *
   * O slug só entra no payload quando mudou: mandá-lo sempre faria a API
   * revalidar disponibilidade a cada troca de tema — e responder "já está em
   * uso" para o próprio slug de quem está salvando.
   */
  const handleSave = async () => {
    if (slug !== slugAtual && slugStatus !== "valid") {
      toast.error("Escolha um link válido e disponível antes de salvar.");
      return;
    }

    setSalvando(true);
    try {
      const salvo = await api.updateProfile({
        displayName,
        bio,
        avatarUrl: avatarPreview,
        coverUrl: coverPreview,
        themeId: selectedTheme,
        buttonStyle,
        isAdult,
        ...(slug !== slugAtual ? { slug } : {}),
      });
      setSlugAtual(salvo.slug);
      setSlug(salvo.slug);
      setSlugStatus("idle");
      toast.success("Perfil atualizado! ✓");
    } catch (caught) {
      tratarErro(caught, "Não foi possível salvar o perfil.");
    } finally {
      setSalvando(false);
    }
  };

  const theme = THEMES.find((t) => t.id === selectedTheme) || THEMES[0];

  const buttonStyles = [
    { id: "soft", label: "Suave" },
    { id: "filled", label: "Preenchido" },
    { id: "outlined", label: "Contorno" },
    { id: "glass", label: "Vidro" },
    { id: "pill", label: "Pílula" },
  ];

  return (
    <div className="min-h-screen p-6 md:p-8">
      <Toaster position="top-center" richColors />

      <div className="max-w-7xl mx-auto">

        {/* ── TAB HEADER ─────────────────────────────────────────────────── */}
        <div className="mb-8">
          <h1 className="font-bebas text-3xl uppercase text-white mb-1">APARÊNCIA PERSONALIZADA</h1>
          <p className="text-sm text-bee-muted mb-6">Personalize o visual do seu perfil e de cada link</p>

          {/* Tab Pills */}
          <div className="inline-flex p-1 rounded-2xl gap-1"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
            {([
              { id: "perfil" as PageTab, label: "Perfil", icon: User },
              { id: "links" as PageTab, label: "Links", icon: Palette },
            ] as { id: PageTab; label: string; icon: React.ElementType }[]).map(({ id, label, icon: Icon }) => {
              const active = pageTab === id;
              return (
                <button
                  key={id}
                  onClick={() => setPageTab(id)}
                  className="relative flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 focus:outline-none"
                  style={{
                    color: active ? "#fff" : "#888",
                    background: active ? "rgba(255,60,110,0.12)" : "transparent",
                    border: active ? "1px solid rgba(255,60,110,0.35)" : "1px solid transparent",
                    boxShadow: active ? "0 0 12px rgba(255,60,110,0.15)" : "none",
                  }}
                >
                  <Icon style={{ width: 15, height: 15 }} />
                  {label}
                  {id === "links" && (
                    <span className="ml-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold"
                      style={{ background: "rgba(155,109,255,0.2)", color: "#9b6dff" }}>
                      {links.filter(l => l.appearance).length}/{links.length}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── TAB CONTENT ────────────────────────────────────────────────── */}

        {/* ═══ ABA: PERFIL ══════════════════════════════════════════════════ */}
        <div className={cn("transition-opacity duration-200", pageTab !== "perfil" && "hidden")}>
        <div className="grid lg:grid-cols-[1fr_auto] gap-8">
          {/* Painel Esquerdo - Formulário */}
          <div className="space-y-8">
            {/* SEÇÃO 1: SEU PERFIL */}
            <section>
              <h2 className="font-bebas text-2xl uppercase text-white mb-6">
                SEU PERFIL
              </h2>

              <div className="space-y-6">
                {/* Upload Avatar + Cover (flex em desktop) */}
                <div className="flex gap-4">
                  {/* Avatar */}
                  <div className="flex-shrink-0">
                    <label className="block text-sm font-medium text-white mb-2">
                      Avatar
                    </label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarChange}
                      className="hidden"
                      id="avatar-upload"
                    />
                    <label
                      htmlFor="avatar-upload"
                      className="block w-20 h-20 rounded-full cursor-pointer transition-all group relative overflow-hidden"
                      style={{
                        backgroundColor: avatarPreview ? "transparent" : "#1e1e1e",
                        border: avatarPreview
                          ? "2px solid rgba(255, 60, 110, 0.3)"
                          : "2px dashed rgba(255, 60, 110, 0.3)",
                      }}
                    >
                      {avatarPreview ? (
                        <>
                          <img
                            src={avatarPreview}
                            alt="Avatar preview"
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <Camera className="w-5 h-5 text-white" />
                          </div>
                        </>
                      ) : (
                        <div className="flex items-center justify-center h-full">
                          <Camera className="w-5 h-5 text-bee-muted" />
                        </div>
                      )}
                    </label>
                  </div>

                  {/* Cover */}
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-white mb-2">
                      Capa
                    </label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleCoverChange}
                      className="hidden"
                      id="cover-upload"
                    />
                    <label
                      htmlFor="cover-upload"
                      className="block w-full h-20 rounded-lg cursor-pointer transition-all group relative overflow-hidden"
                      style={{
                        backgroundColor: coverPreview ? "transparent" : "#1e1e1e",
                        border: coverPreview
                          ? "2px solid rgba(255, 60, 110, 0.3)"
                          : "2px dashed rgba(255, 60, 110, 0.3)",
                        background: coverPreview
                          ? `url(${coverPreview})`
                          : "linear-gradient(135deg, #1e1e1e, #151515)",
                        backgroundSize: "cover",
                        backgroundPosition: "center",
                      }}
                    >
                      {!coverPreview && (
                        <div className="flex items-center justify-center h-full">
                          <span className="text-xs text-bee-muted">
                            Adicionar capa
                          </span>
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Camera className="w-5 h-5 text-white" />
                      </div>
                    </label>
                  </div>
                </div>

                {/* Nome de exibição */}
                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    Nome de exibição
                  </label>
                  <Input
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Ex: Bella ✨"
                    className="bg-bee-surface border-bee-border text-white focus:border-bee-pink"
                  />
                </div>

                {/* Usuário */}
                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    Usuário
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="px-3 py-2 rounded-lg bg-bee-surface2 text-bee-muted text-sm border border-bee-border">
                      {siteHost()}/
                    </span>
                    <div className="flex-1 relative">
                      <Input
                        value={slug}
                        onChange={(e) => setSlug(slugify(e.target.value))}
                        placeholder="usuario"
                        className="bg-bee-surface border-bee-border text-white focus:border-bee-pink pr-10"
                      />
                      {/* Status Icon */}
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        {slugStatus === "checking" && (
                          <Loader2 className="w-4 h-4 text-bee-muted animate-spin" />
                        )}
                        {slugStatus === "valid" && (
                          <CheckCircle2 className="w-4 h-4 text-green-500" />
                        )}
                        {(slugStatus === "invalid" || slugStatus === "taken") && (
                          <XCircle className="w-4 h-4 text-red-500" />
                        )}
                      </div>
                    </div>
                  </div>
                  {/* Status Message */}
                  {slugStatus === "valid" && (
                    <p className="text-xs text-green-500 mt-1.5">
                      ✓ Disponível!
                    </p>
                  )}
                  {slugStatus === "taken" && (
                    <p className="text-xs text-red-500 mt-1.5">
                      ✗ Já utilizado
                    </p>
                  )}
                  {slugStatus === "invalid" && (
                    <p className="text-xs text-orange-500 mt-1.5">
                      Use apenas letras, números e -
                    </p>
                  )}
                </div>

                {/* Bio */}
                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    Bio
                  </label>
                  <Textarea
                    value={bio}
                    onChange={(e) => {
                      if (e.target.value.length <= 150) {
                        setBio(e.target.value);
                      }
                    }}
                    placeholder="Conte um pouco sobre você..."
                    className="bg-bee-surface border-bee-border text-white focus:border-bee-pink min-h-[80px]"
                  />
                  <p className="text-xs text-bee-muted mt-1.5 text-right">
                    {bio.length}/150
                  </p>
                </div>
              </div>
            </section>

            {/* SEÇÃO 2: TEMA DA PÁGINA */}
            <section>
              <h2 className="font-bebas text-2xl uppercase text-white mb-6">
                TEMA DA PÁGINA
              </h2>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {THEMES.map((themeItem) => (
                  <button
                    key={themeItem.id}
                    onClick={() => setSelectedTheme(themeItem.id)}
                    className="p-3 rounded-xl transition-all relative"
                    style={{
                      backgroundColor:
                        selectedTheme === themeItem.id
                          ? "rgba(255, 60, 110, 0.06)"
                          : "#151515",
                      border:
                        selectedTheme === themeItem.id
                          ? "2px solid #FF3C6E"
                          : "1px solid rgba(255, 255, 255, 0.06)",
                    }}
                  >
                    {/* Color Preview */}
                    <div className="flex gap-1.5 mb-2">
                      {themeItem.preview.map((color, index) => (
                        <div
                          key={index}
                          className="w-4 h-4 rounded-full"
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>

                    {/* Theme Name */}
                    <p className="text-xs text-bee-muted text-left">
                      {themeItem.label}
                    </p>

                    {/* Checkmark */}
                    {selectedTheme === themeItem.id && (
                      <div className="absolute top-2 right-2">
                        <CheckCircle2 className="w-4 h-4 text-bee-pink" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </section>

            {/* SEÇÃO 3: ESTILO DOS BOTÕES */}
            <section>
              <h2 className="font-bebas text-2xl uppercase text-white mb-6">
                ESTILO DOS BOTÕES
              </h2>

              <div className="flex gap-3 overflow-x-auto pb-2">
                {buttonStyles.map((style) => (
                  <button
                    key={style.id}
                    onClick={() => setButtonStyle(style.id)}
                    className="flex-shrink-0 p-4 rounded-xl transition-all min-w-[120px]"
                    style={{
                      backgroundColor:
                        buttonStyle === style.id
                          ? "rgba(255, 60, 110, 0.06)"
                          : "#151515",
                      border:
                        buttonStyle === style.id
                          ? "2px solid #FF3C6E"
                          : "1px solid rgba(255, 255, 255, 0.06)",
                    }}
                  >
                    {/* Mini Preview Button */}
                    <div
                      className={cn(
                        "w-full px-3 py-1.5 rounded text-xs font-medium mb-2 text-white",
                        style.id === "pill" && "rounded-full"
                      )}
                      style={{
                        ...(style.id === "soft" && {
                          backgroundColor: `${theme.accent}20`,
                          border: `1px solid ${theme.accent}40`,
                        }),
                        ...(style.id === "filled" && {
                          backgroundColor: theme.accent,
                        }),
                        ...(style.id === "outlined" && {
                          backgroundColor: "transparent",
                          border: `1.5px solid ${theme.accent}`,
                        }),
                        ...(style.id === "glass" && {
                          backgroundColor: "rgba(255, 255, 255, 0.05)",
                          border: "1px solid rgba(255, 255, 255, 0.1)",
                          backdropFilter: "blur(4px)",
                        }),
                      }}
                    >
                      Preview
                    </div>

                    {/* Style Name */}
                    <p className="text-xs text-bee-muted">{style.label}</p>
                  </button>
                ))}
              </div>
            </section>

            {/* Botão Salvar */}
            <div className="sticky bottom-0 pt-6 pb-2 bg-bee-bg">
              <Button
                onClick={handleSave}
                disabled={salvando || carregando}
                className="w-full bg-bee-pink hover:bg-bee-pink-hot text-white rounded-full font-barlow font-bold uppercase tracking-wide glow-pink-sm"
              >
                SALVAR ALTERAÇÕES
              </Button>
            </div>
          </div>

          {/* Painel Direito - Preview (Desktop only) */}
          <div className="hidden lg:block sticky top-8">
            <PhoneMockup
              themeBg={theme.bg}
              themeAccent={theme.accent}
              coverGradient={
                coverPreview
                  ? `url(${coverPreview})`
                  : `linear-gradient(135deg, ${theme.accent}, ${theme.accent}dd)`
              }
              avatarUrl={avatarPreview}
              displayName={displayName}
              bio={bio}
              buttonStyle={buttonStyle}
              // Sem esta prop o preview mostrava "Nenhum link ativo" com 4 links
              // ativos no estado ao lado — e o preview ao vivo é o motivo de
              // existir desta página.
              links={links}
              // Esta página não tem toggle de +18 (o de verdade mora no
              // cadastro); o preview reflete o que está no perfil.
              showAgeBadge={isAdult}
            />
          </div>
        </div>
        </div>

        {/* ═══ ABA: LINKS ════════════════════════════════════════════════════ */}
        <div className={cn("transition-opacity duration-200", pageTab !== "links" && "hidden")}>
        <section>
              <div className="flex items-center justify-between mb-6">
                <h2 className="font-bebas text-2xl uppercase text-white">
                  APARÊNCIA DOS LINKS
                </h2>
                <span className="text-[11px] text-white/30 uppercase tracking-widest">
                  {links.filter(l => l.appearance).length}/{links.length} personalizados
                </span>
              </div>

              <div className="space-y-2.5">
                {links.map((link, idx) => {
                  const platformColor = getPlatformColor(link.platform);
                  const platformIcon = getPlatformIcon(link.platform);
                  const appearance: LinkAppearance = link.appearance ?? {
                    ...DEFAULT_LINK_APPEARANCE,
                    color: platformColor,
                  };
                  const hasCustomAppearance = !!link.appearance;

                  return (
                    <motion.div
                      key={link.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.04 }}
                      className="group relative rounded-2xl overflow-hidden"
                      style={{
                        background: "rgba(255,255,255,0.025)",
                        border: hasCustomAppearance
                          ? `1px solid ${appearance.color}30`
                          : "1px solid rgba(255,255,255,0.07)",
                        backdropFilter: "blur(16px)",
                      }}
                    >
                      {/* Faixa de cor no topo */}
                      {hasCustomAppearance && (
                        <div className="absolute top-0 left-5 right-5 h-px rounded-full opacity-70"
                          style={{
                            background: appearance.useGradient
                              ? `linear-gradient(90deg, ${appearance.color}, ${appearance.gradientTo})`
                              : appearance.color,
                          }} />
                      )}

                      <div className="flex items-center gap-4 px-4 py-3.5">
                        {/* Ícone da plataforma */}
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-base"
                          style={{ background: `${platformColor}18`, border: `1px solid ${platformColor}30` }}>
                          {platformIcon}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className="text-sm font-semibold text-white truncate">{link.title}</span>
                            {hasCustomAppearance && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold"
                                style={{ background: `${appearance.color}20`, color: appearance.color }}>
                                <Sparkles style={{ width: 8, height: 8 }} />
                                Custom
                              </span>
                            )}
                          </div>
                          {/* Mini preview do botão */}
                          <div className="max-w-[200px]">
                            <MiniLinkPreview appearance={appearance} title={link.title} icon={platformIcon} />
                          </div>
                        </div>

                        {/* Botão editar */}
                        <button
                          type="button"
                          onClick={() => { setEditingLink(link); setModalTab("aparencia"); setModalOpen(true); }}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold focus:outline-none transition-all duration-200 flex-shrink-0"
                          style={{
                            background: hasCustomAppearance ? `${appearance.color}15` : "rgba(155,109,255,0.08)",
                            border: hasCustomAppearance ? `1px solid ${appearance.color}30` : "1px solid rgba(155,109,255,0.2)",
                            color: hasCustomAppearance ? appearance.color : "#9b6dff",
                          }}
                          onMouseEnter={(e) => {
                            const c = hasCustomAppearance ? appearance.color : "#9b6dff";
                            (e.currentTarget as HTMLElement).style.background = `${c}25`;
                          }}
                          onMouseLeave={(e) => {
                            const c = hasCustomAppearance ? appearance.color : "#9b6dff";
                            (e.currentTarget as HTMLElement).style.background = `${c}15`;
                          }}
                        >
                          <Palette style={{ width: 12, height: 12 }} />
                          {hasCustomAppearance ? "Editar" : "Personalizar"}
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              <p className="text-[11px] text-white/20 mt-4 px-1">
                A aparência definida por link tem prioridade sobre o estilo global de botões.
              </p>
            </section>
        </div>
      </div>

      {/* Modal de aparência dos links */}
      <LinkModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditingLink(null); }}
        editLink={editingLink}
        initialTab={modalTab}
        appearanceOnly
        allLinks={links}
        profileData={{ displayName, slug, bio, avatarUrl: avatarPreview, coverUrl: coverPreview }}
        onSave={async (linkData) => {
          if (!linkData.id) return;

          const anterior = links;
          // Otimista: a prévia no celular tem que refletir a mudança no mesmo
          // gesto. Se a API recusar, volta.
          setLinks((prev) => prev.map((l) => (l.id === linkData.id ? { ...l, ...linkData } : l)));

          try {
            await api.updateLink(linkData.id, { appearance: linkData.appearance });
            toast.success("Aparência salva! ✓");
          } catch (caught) {
            setLinks(anterior);
            tratarErro(caught, "Não foi possível salvar a aparência.");
          }
        }}
      />
    </div>
  );
}
