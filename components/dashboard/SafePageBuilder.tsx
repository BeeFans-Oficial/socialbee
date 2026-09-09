"use client";

import React, { useState } from "react";
import { AlertTriangle, CheckCircle2, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SocialLink, SafePage } from "@/lib/catalog";
import { cn } from "@/lib/utils";

interface SafePageBuilderProps {
  safePage: SafePage | null | undefined;
  onSafePageChange: (safePage: SafePage | null) => void;
}

const SAFE_PLATFORMS = [
  { id: "instagram" as const, label: "Instagram", icon: "📸", color: "#E1306C" },
  { id: "twitter" as const, label: "Twitter/X", icon: "🐦", color: "#1DA1F2" },
  { id: "tiktok" as const, label: "TikTok", icon: "🎵", color: "#ff0050" },
  { id: "twitch" as const, label: "Twitch", icon: "🎮", color: "#9146FF" },
  { id: "youtube" as const, label: "YouTube", icon: "▶️", color: "#FF0000" },
  { id: "snapchat" as const, label: "Snapchat", icon: "👻", color: "#FFFC00" },
  { id: "facebook" as const, label: "Facebook", icon: "👥", color: "#1877F2" },
];

export function SafePageBuilder({
  safePage,
  onSafePageChange,
}: SafePageBuilderProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  // `string[]` e não a união de ids: a lista inicial vem da API, onde canal é
  // texto aberto. Quem restringe a escolha continua sendo o seletor abaixo.
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(
    safePage?.socialLinks.map((link) => link.platform) || [],
  );
  const [socialLinks, setSocialLinks] = useState<SocialLink[]>(
    safePage?.socialLinks || []
  );

  const hasSafePage = safePage && safePage.socialLinks.length > 0;

  const handleTogglePlatform = (
    platformId: (typeof SAFE_PLATFORMS)[number]["id"]
  ) => {
    setSelectedPlatforms((prev) => {
      if (prev.includes(platformId)) {
        return prev.filter((p) => p !== platformId);
      } else {
        return [...prev, platformId];
      }
    });
  };

  const handleContinueToStep2 = () => {
    if (selectedPlatforms.length === 0) return;

    // Criar socialLinks baseado nas plataformas selecionadas
    const newSocialLinks: SocialLink[] = selectedPlatforms.map((platformId) => {
      const platform = SAFE_PLATFORMS.find((p) => p.id === platformId);
      const existingLink = socialLinks.find((l) => l.platform === platformId);

      return {
        platform: platformId,
        url: existingLink?.url || "",
        title:
          existingLink?.title ||
          `Meu ${platform?.label}` ||
          `Meu Perfil`,
      };
    });

    setSocialLinks(newSocialLinks);
    setStep(2);
  };

  const handleSaveSafePage = () => {
    // Validar se todas as URLs foram preenchidas
    const allFilled = socialLinks.every((link) => link.url.trim() !== "");

    if (!allFilled) {
      return;
    }

    const newSafePage: SafePage = {
      id: safePage?.id || `sp_${Date.now()}`,
      socialLinks: socialLinks,
      createdAt: safePage?.createdAt || new Date().toISOString(),
    };

    onSafePageChange(newSafePage);
    setIsExpanded(false);
    setStep(1);
  };

  const handleEdit = () => {
    setIsExpanded(true);
    setStep(1);
  };

  const handleUpdateSocialLink = (
    platformId: string,
    field: "url" | "title",
    value: string
  ) => {
    setSocialLinks((prev) =>
      prev.map((link) =>
        link.platform === platformId ? { ...link, [field]: value } : link
      )
    );
  };

  if (hasSafePage && !isExpanded) {
    // SafePage já configurada - mostrar resumo
    return (
      <div className="rounded-lg border-2 border-green-500/30 bg-green-500/5 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-green-500" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white">
                SafePage Configurada
              </h4>
              <p className="text-xs text-bee-muted">
                {safePage.socialLinks.length} rede
                {safePage.socialLinks.length > 1 ? "s" : ""} social
                {safePage.socialLinks.length > 1 ? "is" : ""} configurada
                {safePage.socialLinks.length > 1 ? "s" : ""}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleEdit}
            className="text-bee-pink hover:text-bee-pink-hot"
          >
            Editar
          </Button>
        </div>

        {/* Preview das redes */}
        <div className="flex gap-2 mt-3 flex-wrap">
          {safePage.socialLinks.map((link) => {
            const platform = SAFE_PLATFORMS.find(
              (p) => p.id === link.platform
            );
            return (
              <div
                key={link.platform}
                className="px-2 py-1 rounded-full text-xs flex items-center gap-1"
                style={{
                  backgroundColor: `${platform?.color}20`,
                  color: platform?.color,
                }}
              >
                <span>{platform?.icon}</span>
                <span>{platform?.label}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  if (!hasSafePage && !isExpanded) {
    // SafePage não configurada - mostrar alerta
    return (
      <div className="rounded-lg border-2 border-orange-500/30 bg-orange-500/5 p-4">
        <div className="flex items-start gap-3 mb-3">
          <AlertTriangle className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-semibold text-white mb-1">
              SafePage Obrigatória
            </h4>
            <p className="text-xs text-bee-muted leading-relaxed">
              Para usar cloaking, você precisa criar uma página segura (sem
              links adultos) que os bots do Instagram verão. Adicione apenas
              suas redes sociais públicas.
            </p>
          </div>
        </div>

        <Button
          variant="outline"
          className="w-full border-orange-500/50 text-orange-500 hover:bg-orange-500/10"
          onClick={() => setIsExpanded(true)}
        >
          🛡️ Criar SafePage Agora
        </Button>
      </div>
    );
  }

  // Wizard expandido
  return (
    <div className="rounded-lg border-2 border-bee-pink/30 bg-bee-surface/50 p-4">
      {step === 1 ? (
        // Step 1: Selecionar Plataformas
        <>
          <div className="mb-4">
            <h4 className="text-sm font-semibold text-white mb-1">
              1. Escolha suas redes sociais públicas
            </h4>
            <p className="text-xs text-bee-muted">
              Selecione 3-5 redes sociais (mínimo 1)
            </p>
          </div>

          <div className="space-y-2 mb-4 max-h-[240px] overflow-y-auto">
            {SAFE_PLATFORMS.map((platform) => {
              const isSelected = selectedPlatforms.includes(platform.id);

              return (
                <button
                  key={platform.id}
                  onClick={() => handleTogglePlatform(platform.id)}
                  className={cn(
                    "w-full flex items-center gap-3 p-3 rounded-lg transition-all text-left",
                    isSelected
                      ? "bg-bee-pink/10 border-2 border-bee-pink"
                      : "bg-bee-bg border border-white/10 hover:border-white/20"
                  )}
                >
                  <div
                    className={cn(
                      "w-5 h-5 rounded flex items-center justify-center border-2 transition-all",
                      isSelected
                        ? "bg-bee-pink border-bee-pink"
                        : "border-white/20"
                    )}
                  >
                    {isSelected && (
                      <CheckCircle2 className="w-3 h-3 text-white" />
                    )}
                  </div>
                  <span className="text-xl">{platform.icon}</span>
                  <span className="text-sm text-white font-medium">
                    {platform.label}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex gap-2">
            <Button
              variant="ghost"
              onClick={() => {
                setIsExpanded(false);
                setStep(1);
                setSelectedPlatforms(
                  safePage?.socialLinks.map((link) => link.platform) || []
                );
              }}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleContinueToStep2}
              disabled={selectedPlatforms.length === 0}
              className="flex-1 bg-bee-pink hover:bg-bee-pink-hot text-white disabled:opacity-50"
            >
              Continuar
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </>
      ) : (
        // Step 2: Preencher URLs
        <>
          <div className="mb-4">
            <h4 className="text-sm font-semibold text-white mb-1">
              2. URLs das suas redes sociais
            </h4>
            <p className="text-xs text-bee-muted">
              Preencha os links das redes selecionadas
            </p>
          </div>

          <div className="space-y-3 mb-4 max-h-[280px] overflow-y-auto">
            {socialLinks.map((link) => {
              const platform = SAFE_PLATFORMS.find(
                (p) => p.id === link.platform
              );

              return (
                <div key={link.platform}>
                  <label className="block text-xs font-medium text-white mb-1.5 flex items-center gap-2">
                    <span>{platform?.icon}</span>
                    <span>{platform?.label}</span>
                  </label>
                  <Input
                    type="url"
                    value={link.url}
                    onChange={(e) =>
                      handleUpdateSocialLink(
                        link.platform,
                        "url",
                        e.target.value
                      )
                    }
                    placeholder={`https://${link.platform}.com/seuperfil`}
                    className="bg-bee-bg border-bee-border text-white text-sm"
                  />
                </div>
              );
            })}
          </div>

          <div className="flex gap-2">
            <Button
              variant="ghost"
              onClick={() => setStep(1)}
              className="flex-1"
            >
              ← Voltar
            </Button>
            <Button
              onClick={handleSaveSafePage}
              disabled={socialLinks.some((link) => !link.url.trim())}
              className="flex-1 bg-bee-pink hover:bg-bee-pink-hot text-white disabled:opacity-50"
            >
              ✓ Salvar SafePage
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
