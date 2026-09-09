"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Link2,
  Palette,
  BarChart2,
  Settings,
  LogOut,
  Menu,
  X,
  ExternalLink,
} from "lucide-react";
import { Logo } from "@/components/shared/Logo";
import { cn } from "@/lib/utils";
import { siteHost } from "@/lib/site";
import { api } from "@/lib/api/client";
import { invalidateSession, useSession } from "@/lib/api/use-session";

const menuItems = [
  { icon: Link2, label: "Links", href: "/links" },
  { icon: Palette, label: "Aparência", href: "/aparencia" },
  { icon: BarChart2, label: "Analytics", href: "/analytics" },
  { icon: Settings, label: "Configurações", href: "/configuracoes" },
];

function getInitials(name: string): string {
  if (!name.trim()) return "";
  return name
    .split(" ")
    .map((word) => word[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

interface SidebarContentProps {
  onClose?: () => void;
}

function SidebarContent({ onClose }: SidebarContentProps) {
  const pathname = usePathname();
  const { session } = useSession();

  // Enquanto a sessão carrega, mostra o mínimo em vez de um nome de outra
  // pessoa: era `MOCK_USER`, então toda criadora via "Bella ✨" e um link para
  // `/bella` dentro do próprio painel.
  const displayName = session?.profile.displayName ?? "";
  const slug = session?.profile.slug ?? "";
  const avatarUrl = session?.profile.avatarUrl ?? null;

  /**
   * Sair de verdade.
   *
   * Antes: `window.location.href = "/login"`, que só trocava de página — não
   * havia sessão para encerrar. Agora a API revoga a linha em `sessions` e
   * apaga o cookie, então o token deixa de valer mesmo para quem o tivesse
   * copiado.
   *
   * A navegação usa `window.location` de propósito, e não o router: recarregar
   * a página inteira descarta todo estado de cliente da sessão anterior. Com
   * navegação do lado do cliente, dados da conta antiga continuariam em memória.
   */
  const handleLogout = async () => {
    try {
      await api.logout();
    } catch {
      // Falha ao revogar não pode prender a pessoa no painel: o cookie some do
      // navegador de todo jeito e a próxima requisição será recusada.
    } finally {
      invalidateSession();
      window.location.href = "/login";
    }
  };

  return (
    <div className="flex flex-col h-full bg-bee-bg border-r border-opacity-10 border-bee-pink">
      {/* Topo - Logo */}
      <div className="p-5">
        <Logo variant="full" size="md" />
        <div
          className="mt-5 h-px"
          style={{ backgroundColor: "rgba(255, 60, 110, 0.15)" }}
        />
      </div>

      {/* Perfil */}
      <div className="px-4 py-4">
        {/* Avatar + Info */}
        <div className="flex items-center gap-3 mb-4">
          {/* Avatar */}
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center font-bebas text-sm"
            style={{
              border: "2px solid #FF3C6E",
              background: "linear-gradient(135deg, #FF3C6E, #FF1F57)",
            }}
          >
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={displayName}
                className="w-full h-full rounded-full object-cover"
              />
            ) : (
              <span className="text-white">{getInitials(displayName)}</span>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="font-barlow font-semibold text-sm text-white truncate">
              {displayName || "..."}
            </div>
            <div className="text-xs text-bee-pink truncate">
              {siteHost()}/{slug}
            </div>
          </div>
        </div>

        {/* Botão Ver Página */}
        <Link
          href={slug ? `/${slug}` : "/links"}
          target="_blank"
          className="flex items-center justify-center gap-2 w-full px-3 py-2 rounded-lg text-xs font-medium transition-colors"
          style={{
            border: "1px solid rgba(255, 60, 110, 0.4)",
            color: "#FF3C6E",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "rgba(255, 60, 110, 0.08)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "transparent";
          }}
        >
          Ver minha página
          <ExternalLink className="w-3 h-3" />
        </Link>
      </div>

      {/* Menu */}
      <nav className="px-3 py-3 flex flex-col gap-1">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all relative",
                isActive
                  ? "text-bee-pink"
                  : "text-bee-muted hover:text-white hover:bg-bee-surface"
              )}
              style={
                isActive
                  ? {
                      backgroundColor: "rgba(255, 60, 110, 0.1)",
                    }
                  : undefined
              }
            >
              {/* Borda esquerda quando ativo */}
              {isActive && (
                <div
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-[60%] bg-bee-pink rounded-r"
                />
              )}

              <Icon
                className="w-5 h-5"
                style={{
                  color: isActive ? "#FF3C6E" : undefined,
                }}
              />
              <span className="font-medium text-sm">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Rodapé - Upgrade & Logout */}
      <div className="mt-auto px-4 py-4 space-y-4">
        {/* Separador */}
        <div
          className="h-px"
          style={{ backgroundColor: "rgba(255, 60, 110, 0.1)" }}
        />

        {/* Badge Plano */}
        <div className="flex items-center gap-2">
          <span
            className="px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wide"
            style={{
              backgroundColor: "rgba(136, 136, 136, 0.2)",
              color: "#888888",
            }}
          >
            Free
          </span>
          <span className="text-xs text-bee-muted">Plano: Gratuito</span>
        </div>

        {/* Botão Upgrade */}
        <button
          className="w-full px-4 py-2.5 rounded-full font-barlow font-bold uppercase text-xs tracking-wide text-white transition-all hover:glow-pink"
          style={{
            background: "linear-gradient(135deg, #FF3C6E, #FF1F57)",
          }}
        >
          UPGRADE PARA PRO ✨
        </button>

        {/* Separador */}
        <div
          className="h-px"
          style={{ backgroundColor: "rgba(255, 60, 110, 0.1)" }}
        />

        {/* Botão Sair */}
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-xs text-bee-muted hover:text-white transition-colors"
        >
          <LogOut className="w-4 h-4" />
          <span>Sair</span>
        </button>
      </div>
    </div>
  );
}

export function Sidebar() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-40 h-16 flex items-center justify-between px-4 border-b"
        style={{
          backgroundColor: "rgba(13, 13, 13, 0.9)",
          backdropFilter: "blur(8px)",
          borderColor: "rgba(255, 60, 110, 0.1)",
        }}
      >
        <Logo variant="full" size="sm" />
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="p-2 text-bee-muted hover:text-white transition-colors"
          aria-label="Toggle menu"
        >
          {isOpen ? (
            <X className="w-6 h-6" />
          ) : (
            <Menu className="w-6 h-6" />
          )}
        </button>
      </header>

      {/* Desktop Sidebar */}
      <aside className="hidden lg:block fixed left-0 top-0 bottom-0 w-[240px] overflow-y-auto">
        <SidebarContent />
      </aside>

      {/* Mobile Drawer */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setIsOpen(false)}
              className="lg:hidden fixed inset-0 z-40 bg-black/80 backdrop-blur-sm"
            />

            {/* Drawer */}
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="lg:hidden fixed left-0 top-0 bottom-0 w-[280px] z-50 overflow-y-auto"
            >
              <SidebarContent onClose={() => setIsOpen(false)} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
