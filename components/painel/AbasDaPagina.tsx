"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { BarChart2, ChevronLeft, ExternalLink, Link2, Palette, ShieldCheck, type LucideIcon } from "lucide-react";

import { EscolhaDePagina } from "@/components/painel/EscolhaDePagina";
import { SeloPro } from "@/components/shared/SeloPro";
import { paginaAtiva } from "@/lib/api/client";
import { useSession } from "@/lib/api/use-session";
import { MOLA } from "@/lib/movimento";
import { urlDaPagina } from "@/lib/site";
import { cn } from "@/lib/utils";

/**
 * A área de UMA página: quem ela é e as abas do que dá para mexer nela.
 *
 * O painel era organizado por tipo de coisa (Páginas, Links, Saúde,
 * Analytics), e a página era escolhida num seletor na barra do topo. Quem
 * administra várias páginas — uma por modelo — tinha de pensar primeiro na
 * seção e depois em de quem. Agora a entrada é a página: escolhe-se uma em
 * `/paginas` e tudo o que é dela fica nestas abas.
 *
 * As telas por trás são as mesmas (`/links`, `/paginas/<id>`, `/saude/<id>`,
 * `/analytics`); esta faixa só as reúne. A página em questão é a ATIVA do
 * painel (`x-profile-id`), ou a do endereço quando ele traz um id — os
 * editores tornam ativa a página deles ao montar.
 */

/** Rotas que pertencem a uma página só. `/paginas` (a lista) e `/saude` (a
 *  visão de todas) ficam de fora: são da conta. */
export function ehAreaDaPagina(pathname: string): boolean {
  return (
    pathname === "/links" ||
    pathname.startsWith("/links/") ||
    pathname === "/analytics" ||
    /^\/(paginas|saude)\/[^/]+$/.test(pathname)
  );
}

/** Altura da faixa no computador (`lg:h-14`). A casca a publica como
 *  `--abas` para os editores descontarem. */
export const ALTURA_DAS_ABAS = "3.5rem";

interface Aba {
  id: string;
  label: string;
  icone: LucideIcon;
  href: (paginaId: string) => string;
  ativa: (pathname: string) => boolean;
  pro?: boolean;
}

const ABAS: Aba[] = [
  {
    id: "links",
    label: "Links",
    icone: Link2,
    href: () => "/links",
    ativa: (p) => p === "/links" || p.startsWith("/links/"),
  },
  {
    id: "aparencia",
    label: "Aparência",
    icone: Palette,
    href: (id) => `/paginas/${id}`,
    ativa: (p) => /^\/paginas\/[^/]+$/.test(p),
  },
  {
    id: "saude",
    label: "Saúde",
    icone: ShieldCheck,
    href: (id) => `/saude/${id}`,
    ativa: (p) => /^\/saude\/[^/]+$/.test(p),
  },
  {
    id: "analytics",
    label: "Analytics",
    icone: BarChart2,
    href: () => "/analytics",
    ativa: (p) => p === "/analytics",
    pro: true,
  },
];

export function AbasDaPagina() {
  const pathname = usePathname();
  const { session } = useSession();
  const pagina = session?.profile ?? null;

  if (!ehAreaDaPagina(pathname) || !pagina) return null;

  const doEndereco = pathname.match(/^\/(?:paginas|saude)\/([^/]+)$/)?.[1] ?? null;
  const id = doEndereco ?? paginaAtiva() ?? pagina.id;
  const semPro = session?.user.plan?.id === "free";

  // No computador é UMA linha de altura fixa (`ALTURA_DAS_ABAS`), grudada
  // abaixo da barra do topo: os editores descontam essa altura para caber na
  // tela sem rolagem. No celular são duas linhas que rolam com o conteúdo.
  return (
    <div className="border-b border-bee-line bg-bee-bg lg:sticky lg:top-16 lg:z-20 lg:flex lg:h-14 lg:items-stretch lg:gap-4 lg:px-8">
      <div className="flex items-center gap-2 px-4 pt-3 lg:contents">
        <Link
          href="/paginas"
          className="flex items-center gap-1 h-9 pl-1 pr-2 -ml-1 rounded-lg text-sm text-white/60 hover:text-white hover:bg-white/[0.04] transition-colors flex-shrink-0 lg:self-center"
        >
          <ChevronLeft className="w-4 h-4" />
          <span className="hidden sm:inline">Perfis</span>
        </Link>
        <EscolhaDePagina alinhar="esquerda" className="lg:self-center" />
        <a
          href={urlDaPagina(pagina.host, pagina.slug)}
          target="_blank"
          rel="noreferrer"
          title="Abrir o perfil numa aba nova"
          className="ml-auto flex items-center gap-1.5 h-9 px-2.5 rounded-lg text-sm text-white/60 hover:text-white hover:bg-white/[0.04] transition-colors flex-shrink-0 lg:order-last lg:self-center"
        >
          <ExternalLink className="w-4 h-4" />
          <span className="hidden sm:inline">Ver perfil</span>
        </a>
      </div>

      <nav
        aria-label="Seções do perfil"
        data-tour="abas-da-pagina"
        className="flex gap-1 px-2 mt-1 overflow-x-auto sem-barra lg:mt-0 lg:px-0 lg:min-w-0"
      >
        {ABAS.map((aba) => {
          const Icone = aba.icone;
          const ativa = aba.ativa(pathname);
          return (
            <Link
              key={aba.id}
              href={aba.href(id)}
              aria-current={ativa ? "page" : undefined}
              className={cn(
                "relative flex items-center gap-2 h-11 lg:h-auto px-3 text-sm whitespace-nowrap transition-colors duration-200",
                ativa ? "text-white" : "text-white/55 hover:text-white",
              )}
            >
              <Icone className={cn("w-4 h-4", ativa && "text-bee-pink")} />
              {aba.label}
              {aba.pro && semPro && <SeloPro />}
              {ativa && (
                <motion.span
                  layoutId="aba-ativa-da-pagina"
                  transition={MOLA}
                  className="absolute inset-x-2 bottom-0 h-0.5 rounded-t-full bg-bee-pink"
                  aria-hidden
                />
              )}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
