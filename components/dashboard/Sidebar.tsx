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
  LayoutGrid,
  Globe,
} from "lucide-react";
import { Logo } from "@/components/shared/Logo";
import { cn } from "@/lib/utils";
import { SeletorDePagina } from "@/components/dashboard/SeletorDePagina";
import { SeloPro } from "@/components/shared/SeloPro";
import { api } from "@/lib/api/client";
import { invalidateSession, useSession } from "@/lib/api/use-session";

/** Itens do menu, em seções. `pro` marca o que o Free não tem. */
const SECOES = [
  {
    titulo: "LINK NA BIO",
    itens: [
      { icon: LayoutGrid, label: "Páginas", href: "/paginas" },
      { icon: Link2, label: "Links", href: "/links" },
      { icon: Palette, label: "Aparência", href: "/aparencia" },
      { icon: BarChart2, label: "Analytics", href: "/analytics", pro: true },
      { icon: Globe, label: "Domínio próprio", href: "/dominios", pro: true },
    ],
  },
  {
    titulo: "CONTA",
    itens: [{ icon: Settings, label: "Configurações", href: "/configuracoes" }],
  },
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
  const host = session?.profile.host ?? "";
  const avatarUrl = session?.profile.avatarUrl ?? null;
  const plan = session?.user.plan ?? null;

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
    <div className="flex flex-col h-full bg-[#0a0a0a] border-r border-white/[0.06]">
      {/* Logo, na altura da barra do topo para as duas linharem. */}
      <div className="h-16 px-4 flex items-center border-b border-white/[0.06]">
        <Link href="/paginas" onClick={onClose}>
          <Logo variant="full" size="sm" />
        </Link>
      </div>

      {/* Página que as telas abaixo editam. O seletor troca entre elas. */}
      <div className="px-3 pt-4">
        <div className="flex items-center gap-2.5 px-2 py-2 rounded-lg bg-white/[0.03] border border-white/[0.06]">
          <div className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center overflow-hidden text-[11px] font-semibold text-white bg-gradient-to-br from-bee-pink to-bee-pink-hot">
            {avatarUrl ? (
              <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              getInitials(displayName)
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-medium text-white truncate">{displayName || "..."}</div>
            <SeletorDePagina slugAtual={slug} hostAtual={host} />
          </div>
          {slug && (
            <a
              href={`/${slug}`}
              target="_blank"
              rel="noreferrer"
              title="Ver minha página"
              className="p-1 text-white/40 hover:text-white transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
        </div>
      </div>

      <nav className="px-3 pt-5 flex flex-col gap-5">
        {SECOES.map((secao) => (
          <div key={secao.titulo}>
            <div className="px-2 mb-1.5 text-[10px] font-semibold tracking-[0.14em] text-white/35">
              {secao.titulo}
            </div>
            <div className="flex flex-col gap-0.5">
              {secao.itens.map((item) => {
                const Icon = item.icon;
                const ativo = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onClose}
                    className={cn(
                      "flex items-center gap-2.5 px-2 py-2 rounded-lg text-sm transition-colors",
                      ativo
                        ? "bg-white/[0.07] text-white"
                        : "text-white/60 hover:text-white hover:bg-white/[0.04]",
                    )}
                  >
                    <Icon className={cn("w-4 h-4", ativo && "text-bee-pink")} />
                    <span>{item.label}</span>
                    {item.pro && plan?.id === "free" && <SeloPro className="ml-auto" />}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="mt-auto px-3 py-3 border-t border-white/[0.06]">
        <button
          onClick={handleLogout}
          className="flex items-center gap-2.5 w-full px-2 py-2 rounded-lg text-sm text-white/50 hover:text-white hover:bg-white/[0.04] transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Sair
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
