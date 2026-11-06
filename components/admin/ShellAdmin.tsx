"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MotionConfig, motion } from "framer-motion";
import { ArrowLeft, ClipboardList, Globe, LayoutDashboard, LogOut, Users, type LucideIcon } from "lucide-react";

import { sairDoPainel, useSession } from "@/lib/api/use-session";
import { ENTRADA_DA_TELA, MOLA, SUAVE } from "@/lib/movimento";
import { cn } from "@/lib/utils";

/**
 * A casca do painel admin: TEMA CLARO.
 *
 * O painel da criadora é escuro; este é branco com faixa âmbar e selo ADMIN.
 * A diferença é a primeira coisa que se vê, antes de qualquer texto — é aqui
 * que se libera plano e se revoga sessão de outras pessoas, e ninguém pode
 * fazer isso achando que está na própria conta. Mesmos tokens de movimento
 * do resto do app (`lib/movimento.ts`).
 */
const ITENS: { href: string; label: string; icone: LucideIcon }[] = [
  { href: "/admin", label: "Visão geral", icone: LayoutDashboard },
  { href: "/admin/contas", label: "Contas", icone: Users },
  { href: "/admin/dominios", label: "Domínios", icone: Globe },
  { href: "/admin/auditoria", label: "Auditoria", icone: ClipboardList },
];

function ativo(pathname: string, href: string): boolean {
  return href === "/admin" ? pathname === "/admin" : pathname === href || pathname.startsWith(`${href}/`);
}

export function ShellAdmin({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { session } = useSession();
  const email = session?.user.email ?? "";

  return (
    <MotionConfig reducedMotion="user" transition={{ ease: SUAVE }}>
      {/* `colorScheme: light`: campos de data e selects nativos seguem o tema. */}
      <div className="min-h-dvh bg-admin-bg text-admin-ink antialiased" style={{ colorScheme: "light" }}>
        <div className="h-1 bg-admin-accent" aria-hidden />

        <header className="sticky top-0 z-30 h-14 lg:h-16 flex items-center gap-3 px-4 lg:px-8 border-b border-admin-line bg-admin-card/90 backdrop-blur">
          <span className="inline-flex items-center h-7 px-2.5 rounded-md bg-admin-accent-soft text-admin-accent-ink text-[11px] font-bold tracking-[0.14em] border border-admin-accent-line">
            ADMIN
          </span>
          <nav className="flex items-center gap-1 ml-2 overflow-x-auto sem-barra" aria-label="Painel admin">
            {ITENS.map((item) => {
              const Icone = item.icone;
              const estaAtivo = ativo(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={estaAtivo ? "page" : undefined}
                  className={cn(
                    "relative flex items-center gap-2 h-9 px-3 rounded-lg text-sm whitespace-nowrap transition-colors duration-200",
                    estaAtivo ? "text-admin-ink" : "text-admin-muted hover:text-admin-ink hover:bg-admin-hover",
                  )}
                >
                  {estaAtivo && (
                    <motion.span
                      layoutId="item-ativo-do-admin"
                      transition={MOLA}
                      className="absolute inset-0 rounded-lg bg-admin-hover"
                      aria-hidden
                    />
                  )}
                  <Icone className={cn("relative w-4 h-4", estaAtivo && "text-admin-accent")} />
                  <span className="relative hidden sm:inline">{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <Link
              href="/paginas"
              className="hidden sm:inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-admin-line text-xs text-admin-ink/85 hover:bg-admin-hover transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Painel da criadora
            </Link>
            {email && (
              <span className="hidden lg:inline text-xs text-admin-muted truncate max-w-[200px]" title={email}>
                {email}
              </span>
            )}
            <button
              onClick={() => void sairDoPainel()}
              aria-label="Sair"
              title="Sair"
              className="w-9 h-9 flex items-center justify-center rounded-lg text-admin-muted hover:text-admin-ink hover:bg-admin-hover transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </header>

        <main>
          <motion.div
            key={pathname}
            initial={ENTRADA_DA_TELA.initial}
            animate={ENTRADA_DA_TELA.animate}
            transition={ENTRADA_DA_TELA.transition}
          >
            {children}
          </motion.div>
        </main>
      </div>
    </MotionConfig>
  );
}
