"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { HexBackground } from "@/components/shared/HexBackground";
import { AgeGate } from "@/components/profile/AgeGate";
import { ProfileHeader } from "@/components/profile/ProfileHeader";
import { LinkButton } from "@/components/profile/LinkButton";
import { MOCK_USER, MOCK_LINKS, THEMES } from "@/lib/mock-data";
import { handleLinkClick } from "@/lib/cloak";
import { getPlatformIcon } from "@/lib/utils";
import { Logo } from "@/components/shared/Logo";

export default function ProfilePage() {
  const params = useParams();
  const slug = params?.slug as string;

  const [showFallbackButton, setShowFallbackButton] = useState(false);
  const [fallbackUrl, setFallbackUrl] = useState("");
  const [mounted, setMounted] = useState(false);
  const [ageVerified, setAgeVerified] = useState(false);

  // Mock: aceitar apenas "bella" ou "demo"
  const isValidSlug = slug === "bella" || slug === "demo";

  // Dados do usuário (mock)
  const user = isValidSlug ? MOCK_USER : null;
  const links = isValidSlug ? MOCK_LINKS.filter((l) => l.isActive) : [];
  const theme = THEMES.find((t) => t.id === user?.themeId) || THEMES[0];

  // Perfil adulto exige confirmação de idade antes de mostrar qualquer link.
  const needsAgeGate = Boolean(user?.isAdult) && !ageVerified;

  // Referência estável: o `useEffect` do AgeGate depende de `onVerified`, e uma
  // arrow inline mudaria de identidade a cada render, reexecutando o efeito que
  // lê o localStorage.
  const handleVerified = useCallback(() => setAgeVerified(true), []);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Registra a visualização do perfil — é o denominador da taxa de clique.
  //
  // Só conta DEPOIS da barreira de idade: quem desiste no modal nunca viu os
  // links, e contá-lo diluiria a taxa de clique de todo perfil adulto.
  //
  // `keepalive` porque a pessoa pode tocar num link imediatamente: sem ele o
  // navegador cancela a requisição ao sair da página e a view some, inflando a
  // taxa de clique justamente nos perfis que convertem mais rápido.
  useEffect(() => {
    if (!isValidSlug || !slug || needsAgeGate) return;
    fetch("/api/tracking/view", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug }),
      keepalive: true,
    }).catch(() => {
      // Falha de rastreamento nunca afeta a página do visitante.
    });
  }, [isValidSlug, slug, needsAgeGate]);

  // Aplicar tema
  useEffect(() => {
    if (!mounted || !user) return;

    const root = document.documentElement;
    root.style.setProperty("--theme-bg", theme.bg);
    root.style.setProperty("--theme-accent", theme.accent);
    
    // Calcular surface (mais claro que bg)
    const surface = theme.bg.replace(/[^,]+(?=\))/, (m) =>
      String(Math.min(255, parseInt(m) + 20))
    );
    root.style.setProperty("--theme-surface", surface);

    // Aplicar bg color
    document.body.style.backgroundColor = theme.bg;

    return () => {
      document.body.style.backgroundColor = "";
    };
  }, [mounted, user, theme]);

  // Handler de clique com fallback
  const onLinkClick = (shortCode: string, cloakEnabled: boolean) => {
    const url = `${window.location.origin}/r/${shortCode}`;
    setFallbackUrl(url);

    handleLinkClick(shortCode, cloakEnabled, () => {
      // Callback para iOS - mostrar botão manual
      setShowFallbackButton(true);
      setTimeout(() => setShowFallbackButton(false), 10000);
    });
  };

  // Ícones das plataformas ativas
  const activePlatforms = links.map((link) => getPlatformIcon(link.platform));

  // Loading ou aguardando mount
  if (!mounted) {
    return (
      <div className="min-h-screen bg-bee-bg flex items-center justify-center">
        <div className="text-bee-muted">Carregando...</div>
      </div>
    );
  }

  // 404 - Perfil não encontrado
  if (!isValidSlug || !user) {
    return (
      <div className="relative min-h-screen bg-bee-bg text-bee-text overflow-hidden flex items-center justify-center">
        <HexBackground density="low" />
        <div className="relative z-10 text-center px-6">
          <Logo size="lg" variant="full" className="mb-8 justify-center" />
          <h1 className="font-bebas text-6xl uppercase mb-4">
            Perfil não encontrado
          </h1>
          <p className="text-bee-muted mb-8 max-w-md mx-auto">
            O perfil <span className="text-bee-pink">@{slug}</span> não existe
            ou foi removido.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 bg-bee-pink rounded-full font-semibold hover:opacity-90 transition-opacity glow-pink-sm"
          >
            Voltar para o início
          </Link>
        </div>
      </div>
    );
  }

  // Barreira de idade — vem ANTES do perfil, e por isso nada do conteúdo
  // adulto chega ao DOM antes da confirmação.
  //
  // O componente já existia pronto (localStorage por slug, validade de 24 h,
  // prevenção de flash) e nunca havia sido importado: `/bella` abria o conteúdo
  // +18 direto.
  if (needsAgeGate) {
    return (
      <AgeGate
        slug={slug}
        displayName={user.displayName}
        onVerified={handleVerified}
      />
    );
  }

  // Perfil
  return (
    <div
      className="relative min-h-screen text-bee-text overflow-hidden"
      style={{ backgroundColor: theme.bg }}
    >
      {/* Background */}
      <HexBackground density="medium" />

      {/* Content */}
      <div className="relative z-10 pb-20">
        {/* Profile Header */}
        <ProfileHeader 
          user={user} 
          themeAccent={theme.accent}
          activePlatforms={activePlatforms} 
        />

        {/* Links List */}
        <div className="max-w-sm mx-auto px-4 mt-6 space-y-3">
          {links.map((link, index) => (
            <LinkButton
              key={link.id}
              link={link}
              icon={getPlatformIcon(link.platform)}
              buttonStyle={user.buttonStyle}
              accentColor={theme.accent}
              index={index}
              onClick={() => onLinkClick(link.shortCode, link.cloakEnabled)}
            />
          ))}
        </div>

        {/* Fallback Button (iOS) */}
        {showFallbackButton && (
          <div className="fixed bottom-6 left-6 right-6 z-50 animate-in slide-in-from-bottom">
            <div className="max-w-sm mx-auto bg-bee-surface border border-bee-border rounded-xl p-4 shadow-2xl">
              <p className="text-sm text-bee-muted mb-3">
                Não abriu automaticamente?
              </p>
              <button
                onClick={() => window.open(fallbackUrl, "_blank")}
                className="w-full px-4 py-2 bg-bee-pink rounded-lg font-semibold hover:opacity-90 transition-opacity"
              >
                Toque aqui para abrir
              </button>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="text-center mt-12">
          <Link
            href="/"
            className="text-xs text-bee-muted hover:text-bee-pink transition-colors"
          >
            Powered by BeeSocial
          </Link>
        </div>
      </div>
    </div>
  );
}
