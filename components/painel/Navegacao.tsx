"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
  BarChart2,
  ExternalLink,
  Globe,
  LayoutGrid,
  Link2,
  LogOut,
  MoreHorizontal,
  Settings,
  type LucideIcon,
} from "lucide-react";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Logo } from "@/components/shared/Logo";
import { SeloPro } from "@/components/shared/SeloPro";
import { sairDoPainel, useSession } from "@/lib/api/use-session";
import { MOLA } from "@/lib/movimento";
import { urlDaPagina } from "@/lib/site";
import { cn } from "@/lib/utils";

/**
 * As entradas do painel, num lugar só.
 *
 * A barra lateral (computador) e a barra inferior (celular) leem desta lista,
 * então não há como uma ter um item que a outra não tem. `pro` marca o que o
 * Free não tem: o item continua visível, com o selo, porque sumir com ele
 * esconderia o que a criadora ganha ao passar para o Pro.
 */
export interface ItemDoPainel {
  href: string;
  label: string;
  /** Rótulo que cabe sob o ícone no trilho de 72px. */
  curto: string;
  icone: LucideIcon;
  pro?: boolean;
}

export const ITENS: ItemDoPainel[] = [
  { href: "/paginas", label: "Páginas", curto: "Páginas", icone: LayoutGrid },
  { href: "/links", label: "Links", curto: "Links", icone: Link2 },
  { href: "/analytics", label: "Analytics", curto: "Analytics", icone: BarChart2, pro: true },
  { href: "/dominios", label: "Domínio próprio", curto: "Domínio", icone: Globe, pro: true },
];

export const ITENS_DA_CONTA: ItemDoPainel[] = [
  { href: "/configuracoes", label: "Configurações", curto: "Conta", icone: Settings },
];

/** Os três que cabem na barra inferior; o resto vai para "Mais". */
const NA_BARRA_INFERIOR = ITENS.slice(0, 3);
const NO_MAIS = [...ITENS.slice(3), ...ITENS_DA_CONTA];

/** `/paginas/<id>` e `/links/<id>` são editores: prévia + painel, precisam de
 *  largura. É onde a barra lateral vira trilho. */
export function ehRotaDeEditor(pathname: string): boolean {
  return /^\/(paginas|links)\/[^/]+$/.test(pathname);
}

export function itemAtivo(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** O que a barra do topo mostra como título da tela atual. */
export function tituloDaRota(pathname: string): string {
  if (/^\/paginas\/[^/]+$/.test(pathname)) return "Editar página";
  if (pathname === "/links/novo") return "Novo link";
  if (/^\/links\/[^/]+$/.test(pathname)) return "Editar link";
  return [...ITENS, ...ITENS_DA_CONTA].find((i) => itemAtivo(pathname, i.href))?.label ?? "";
}

// ── Computador ────────────────────────────────────────────────────────────────

/**
 * Barra lateral. Aberta (240px) nas listas; trilho (72px) nos editores, com
 * ícone e um rótulo pequeno embaixo — nunca ícone sozinho, que ninguém
 * decifra.
 */
export function Sidebar({ compacta }: { compacta: boolean }) {
  const pathname = usePathname();
  const { session } = useSession();
  const plano = session?.user.plan ?? null;
  const slug = session?.profile.slug ?? "";
  const host = session?.profile.host ?? "";

  return (
    <aside
      className={cn(
        "hidden lg:flex fixed left-0 top-0 bottom-0 z-40 flex-col bg-bee-rail border-r border-bee-line transition-[width] duration-200",
        compacta ? "w-[72px]" : "w-[240px]",
      )}
    >
      <div className={cn("h-16 flex items-center border-b border-bee-line", compacta ? "justify-center" : "px-5")}>
        <Link href="/paginas" aria-label="Páginas">
          <Logo variant={compacta ? "icon" : "full"} size="sm" />
        </Link>
      </div>

      <nav className={cn("flex-1 py-4 flex flex-col gap-6", compacta ? "px-2" : "px-3")}>
        <Secao titulo="Link na bio" compacta={compacta}>
          {ITENS.map((item) => (
            <Entrada
              key={item.href}
              item={item}
              ativo={itemAtivo(pathname, item.href)}
              compacta={compacta}
              selo={item.pro && plano?.id === "free"}
            />
          ))}
        </Secao>
        <Secao titulo="Conta" compacta={compacta}>
          {ITENS_DA_CONTA.map((item) => (
            <Entrada key={item.href} item={item} ativo={itemAtivo(pathname, item.href)} compacta={compacta} />
          ))}
        </Secao>
      </nav>

      {slug && host && (
        <div className={cn("py-3 border-t border-bee-line", compacta ? "px-2" : "px-3")}>
          <a
            href={urlDaPagina(host, slug)}
            target="_blank"
            rel="noreferrer"
            title="Ver minha página"
            className={cn(
              "flex items-center gap-2.5 rounded-lg text-sm text-white/60 hover:text-white hover:bg-white/[0.04] transition-colors",
              compacta ? "flex-col justify-center h-12 text-[10px]" : "px-2 py-2",
            )}
          >
            <ExternalLink className="w-4 h-4" />
            <span className={cn(compacta && "leading-none")}>{compacta ? "Ver" : "Ver minha página"}</span>
          </a>
        </div>
      )}
    </aside>
  );
}

function Secao({ titulo, compacta, children }: { titulo: string; compacta: boolean; children: React.ReactNode }) {
  return (
    <div>
      {!compacta && (
        <div className="px-2 mb-1.5 text-[10px] font-semibold tracking-[0.14em] uppercase text-white/35">
          {titulo}
        </div>
      )}
      <div className="flex flex-col gap-0.5">{children}</div>
    </div>
  );
}

function Entrada({
  item,
  ativo,
  compacta,
  selo,
}: {
  item: ItemDoPainel;
  ativo: boolean;
  compacta: boolean;
  selo?: boolean;
}) {
  const Icone = item.icone;
  return (
    <Link
      href={item.href}
      title={item.label}
      aria-current={ativo ? "page" : undefined}
      className={cn(
        "relative flex items-center rounded-lg transition-colors duration-200",
        compacta ? "flex-col justify-center gap-1 h-14 text-[10px]" : "gap-2.5 px-2 py-2 text-sm",
        ativo ? "text-white" : "text-white/60 hover:text-white hover:bg-white/[0.04]",
      )}
    >
      {/* O fundo do item ativo DESLIZA de um item para o outro (`layoutId`):
          o olho acompanha para onde a navegação foi, em vez de ver um fundo
          sumir aqui e aparecer ali. */}
      {ativo && (
        <motion.span
          layoutId="item-ativo-da-lateral"
          transition={MOLA}
          className="absolute inset-0 rounded-lg bg-white/[0.07]"
          aria-hidden
        />
      )}
      <Icone className={cn("relative w-4 h-4 flex-shrink-0 transition-colors duration-200", ativo && "text-bee-pink")} />
      <span className={cn("relative truncate", compacta && "leading-none max-w-full")}>
        {compacta ? item.curto : item.label}
      </span>
      {selo && !compacta && <SeloPro className="relative ml-auto" />}
    </Link>
  );
}

// ── Celular ───────────────────────────────────────────────────────────────────

/**
 * Barra inferior: as três entradas mais usadas e "Mais", que abre uma folha
 * com o resto (domínio, configurações, ver a página, sair). Fica em toda
 * tela do painel, inclusive nos editores — sair de um subfluxo nunca depende
 * de achar uma seta.
 */
export function BarraInferior() {
  const pathname = usePathname();
  const [maisAberto, setMaisAberto] = useState(false);
  const maisAtivo = NO_MAIS.some((i) => itemAtivo(pathname, i.href));

  return (
    <>
      <nav
        aria-label="Navegação principal"
        className="lg:hidden fixed inset-x-0 bottom-0 z-40 bg-bee-rail/95 backdrop-blur border-t border-bee-line pb-[env(safe-area-inset-bottom)]"
      >
        <div className="grid grid-cols-4 h-16">
          {NA_BARRA_INFERIOR.map((item) => {
            const Icone = item.icone;
            const ativo = itemAtivo(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={ativo ? "page" : undefined}
                className={cn(
                  "relative flex flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors duration-200",
                  ativo ? "text-white" : "text-white/50 active:text-white",
                )}
              >
                {ativo && <TracoAtivo />}
                <Icone className={cn("w-5 h-5 transition-colors duration-200", ativo && "text-bee-pink")} />
                {item.label}
              </Link>
            );
          })}
          <button
            onClick={() => setMaisAberto(true)}
            aria-haspopup="dialog"
            aria-expanded={maisAberto}
            className={cn(
              "relative flex flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors duration-200",
              maisAtivo ? "text-white" : "text-white/50 active:text-white",
            )}
          >
            {maisAtivo && <TracoAtivo />}
            <MoreHorizontal className={cn("w-5 h-5 transition-colors duration-200", maisAtivo && "text-bee-pink")} />
            Mais
          </button>
        </div>
      </nav>
      <MenuMais aberto={maisAberto} onFechar={() => setMaisAberto(false)} />
    </>
  );
}

/** O traço rosa no topo do item ativo da barra inferior, que desliza entre
 *  os itens (`layoutId`), como o fundo na barra lateral. */
function TracoAtivo() {
  return (
    <motion.span
      layoutId="item-ativo-da-inferior"
      transition={MOLA}
      className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-b-full bg-bee-pink"
      aria-hidden
    />
  );
}

function MenuMais({ aberto, onFechar }: { aberto: boolean; onFechar: () => void }) {
  const pathname = usePathname();
  const { session } = useSession();
  const plano = session?.user.plan ?? null;
  const slug = session?.profile.slug ?? "";
  const host = session?.profile.host ?? "";

  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && onFechar()}>
      <DialogContent
        className={cn(
          "left-0 top-auto bottom-0 translate-x-0 translate-y-0 w-full max-w-none gap-0 p-2",
          "rounded-t-2xl sm:rounded-t-2xl sm:rounded-b-none border-bee-line bg-bee-surface",
          "pb-[max(env(safe-area-inset-bottom),0.5rem)]",
          // Folha: sobe de baixo em vez de crescer do centro como o diálogo.
          "data-[state=open]:animate-folha-entrar data-[state=closed]:animate-folha-sair",
        )}
      >
        <DialogTitle className="sr-only">Mais</DialogTitle>
        <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-white/15" aria-hidden />
        {NO_MAIS.map((item) => {
          const Icone = item.icone;
          const ativo = itemAtivo(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onFechar}
              className={cn(
                "flex items-center gap-3 h-12 px-3 rounded-xl text-[15px] transition-colors",
                ativo ? "bg-white/[0.07] text-white" : "text-white/80 active:bg-white/[0.05]",
              )}
            >
              <Icone className={cn("w-5 h-5", ativo && "text-bee-pink")} />
              <span className="flex-1">{item.label}</span>
              {item.pro && plano?.id === "free" && <SeloPro />}
            </Link>
          );
        })}
        {slug && host && (
          <a
            href={urlDaPagina(host, slug)}
            target="_blank"
            rel="noreferrer"
            onClick={onFechar}
            className="flex items-center gap-3 h-12 px-3 rounded-xl text-[15px] text-white/80 active:bg-white/[0.05] transition-colors"
          >
            <ExternalLink className="w-5 h-5" />
            Ver minha página
          </a>
        )}
        <div className="my-2 h-px bg-bee-line" />
        <button
          onClick={() => void sairDoPainel()}
          className="flex items-center gap-3 w-full h-12 px-3 rounded-xl text-[15px] text-white/60 active:bg-white/[0.05] transition-colors"
        >
          <LogOut className="w-5 h-5" />
          Sair
        </button>
      </DialogContent>
    </Dialog>
  );
}
