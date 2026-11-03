"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MotionConfig, motion } from "framer-motion";
import { ArrowLeft, ClipboardList, LayoutDashboard, LogOut, Users, type LucideIcon } from "lucide-react";

import { sairDoPainel, useSession } from "@/lib/api/use-session";
import { ENTRADA_DA_TELA, MOLA, SUAVE } from "@/lib/movimento";
import { cn } from "@/lib/utils";

/**
 * A casca do painel admin.
 *
 * Mesmo app, mesma linguagem (tokens, movimento, `Tela`), mas com uma
 * diferença que se vê de longe: faixa âmbar no topo e o selo ADMIN. Ninguém
 * pode confundir a tela de operação com o painel da criadora — é aqui que se
 * libera plano e se revoga sessão de outras pessoas.
 */
const ITENS: { href: string; label: string; icone: LucideIcon }[] = [
  { href: "/admin", label: "Visão geral", icone: LayoutDashboard },
  { href: "/admin/contas", label: "Contas", icone: Users },
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
      <div className="min-h-dvh bg-bee-bg">
        {/* Faixa âmbar: o sinal de que isto é operação, não o painel comum. */}
        <div className="h-1 bg-amber-400" aria-hidden />

        <header className="sticky top-0 z-30 h-14 lg:h-16 flex items-center gap-3 px-4 lg:px-8 border-b border-bee-line bg-bee-bg/85 backdrop-blur">
          <span className="inline-flex items-center h-7 px-2.5 rounded-md bg-amber-400/15 text-amber-300 text-[11px] font-bold tracking-[0.14em] border border-amber-400/30">
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
                    estaAtivo ? "text-white" : "text-white/60 hover:text-white hover:bg-white/[0.04]",
                  )}
                >
                  {estaAtivo && (
                    <motion.span
                      layoutId="item-ativo-do-admin"
                      transition={MOLA}
                      className="absolute inset-0 rounded-lg bg-white/[0.07]"
                      aria-hidden
                    />
                  )}
                  <Icone className={cn("relative w-4 h-4", estaAtivo && "text-amber-300")} />
                  <span className="relative hidden sm:inline">{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <Link
              href="/paginas"
              className="hidden sm:inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-white/15 text-xs text-white/80 hover:text-white hover:border-white/30 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Painel da criadora
            </Link>
            {email && (
              <span className="hidden lg:inline text-xs text-white/50 truncate max-w-[200px]" title={email}>
                {email}
              </span>
            )}
            <button
              onClick={() => void sairDoPainel()}
              aria-label="Sair"
              title="Sair"
              className="w-9 h-9 flex items-center justify-center rounded-lg text-white/60 hover:text-white hover:bg-white/[0.06] transition-colors"
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
