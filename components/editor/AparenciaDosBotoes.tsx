"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown, Plus } from "lucide-react";
import { toast } from "sonner";

import { IconeDePlataforma } from "@/components/shared/IconeDePlataforma";
import { Switch } from "@/components/ui/switch";
import { api, ApiError } from "@/lib/api/client";
import type { ApiLink } from "@/lib/api/types";
import { DEFAULT_LINK_APPEARANCE, type LinkAppearance } from "@/lib/catalog";
import { ESTILOS_DE_BOTAO } from "@/lib/templates";
import { cn } from "@/lib/utils";

/**
 * A aparência dos botões da página, no editor de aparência.
 *
 * Morava no editor de cada link, ao lado de uma prévia do botão sozinho. A
 * tela de links passou a ser só configuração (destino, proteção, ligar e
 * desligar); tudo o que é visual fica na aba Aparência, onde a prévia é a
 * página inteira — o botão aparece entre os outros, como a fã vê.
 *
 * Um botão aberto por vez: cada ajuste salva e avisa quem chamou
 * (`onMudou`), que recarrega a prévia.
 */
export function AparenciaDosBotoes({
  uniformes,
  onMudou,
}: {
  /** O modelo da página desenha todos os botões iguais e ignora a aparência
   *  por botão (ver `LinkButton`, `uniforme`). Mostrar os controles seria
   *  oferecer um ajuste que não muda nada na página. */
  uniformes: boolean;
  onMudou: () => void;
}) {
  const [links, setLinks] = useState<ApiLink[] | null>(null);
  const [aberto, setAberto] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;
    api
      .links()
      .then((l) => !cancelado && setLinks(l))
      .catch(() => !cancelado && setLinks([]));
    return () => {
      cancelado = true;
    };
  }, []);

  const mudar = async (id: string, appearance: LinkAppearance) => {
    try {
      const salvo = await api.updateLink(id, { appearance });
      setLinks((atual) => atual?.map((l) => (l.id === id ? salvo : l)) ?? null);
      onMudou();
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : "Não foi possível salvar.");
    }
  };

  if (uniformes) {
    return (
      <p className="px-2 pb-3 text-sm leading-relaxed text-white/55">
        No modelo desta página os botões são todos iguais, então não há estilo nem cor por botão. Para
        personalizar cada um, escolha outro modelo em “Página”, acima.
      </p>
    );
  }

  if (links === null) return <p className="px-2 py-3 text-xs text-white/30">Carregando…</p>;

  if (links.length === 0) {
    return (
      <Link
        href="/links/novo"
        className="mx-2 my-2 inline-flex items-center gap-1.5 text-sm text-white/70 hover:text-white transition-colors"
      >
        <Plus className="w-4 h-4" />
        Esta página ainda não tem links. Criar o primeiro
      </Link>
    );
  }

  return (
    <div className="space-y-1.5 pb-2">
      {links.map((link) => {
        const expandido = aberto === link.id;
        return (
          <div key={link.id} className="rounded-xl border border-white/[0.08] bg-white/[0.02]">
            <button
              onClick={() => setAberto(expandido ? null : link.id)}
              aria-expanded={expandido}
              className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left"
            >
              <IconeDePlataforma plataforma={link.platform} className="w-4 h-4 text-white/60 flex-shrink-0" />
              <span className={cn("flex-1 min-w-0 truncate text-sm", link.isActive ? "text-white/90" : "text-white/40")}>
                {link.title}
                {!link.isActive && <span className="ml-2 text-xs text-white/30">desligado</span>}
              </span>
              <ChevronDown
                className={cn("w-4 h-4 text-white/40 transition-transform duration-200", expandido && "rotate-180")}
              />
            </button>
            {expandido && (
              <div className="border-t border-white/[0.06] pt-3">
                <AparenciaDoBotao
                  valor={link.appearance ?? DEFAULT_LINK_APPEARANCE}
                  onMudar={(appearance) => void mudar(link.id, appearance)}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Estilo, cor, ícone e seta de UM botão. */
export function AparenciaDoBotao({
  valor,
  onMudar,
}: {
  valor: LinkAppearance;
  onMudar: (a: LinkAppearance) => void;
}) {
  // A API mescla com o padrão, não com o valor atual: manda sempre o objeto
  // inteiro (ver `links.service.ts`, `update`).
  const mudar = (parcial: Partial<LinkAppearance>) => onMudar({ ...valor, ...parcial });

  // O seletor de cor dispara a cada pixel arrastado: a tela acompanha na hora
  // e salva só quando a criadora para de mexer.
  const [cor, setCor] = useState(valor.color);
  const espera = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => setCor(valor.color), [valor.color]);
  useEffect(() => () => { if (espera.current) clearTimeout(espera.current); }, []);
  const escolherCor = (nova: string) => {
    setCor(nova);
    if (espera.current) clearTimeout(espera.current);
    espera.current = setTimeout(() => mudar({ color: nova }), 600);
  };

  return (
    <div className="px-3 pt-1 pb-3 space-y-4">
      <div className="flex flex-wrap gap-2">
        {ESTILOS_DE_BOTAO.map((e) => (
          <button
            key={e.id}
            onClick={() => valor.style !== e.id && mudar({ style: e.id })}
            className={cn(
              "px-3 py-1.5 rounded-lg border text-xs transition-colors",
              valor.style === e.id
                ? "border-bee-pink/60 bg-bee-pink/[0.08] text-white"
                : "border-white/10 text-white/60 hover:text-white hover:border-white/25",
            )}
          >
            {e.label}
          </button>
        ))}
      </div>
      <div className="flex items-center justify-between">
        <span className="text-sm text-white/85">Cor</span>
        <span className="flex items-center gap-2">
          <code className="text-xs text-white/50 uppercase">{cor}</code>
          <input
            type="color"
            value={cor}
            onChange={(e) => escolherCor(e.target.value)}
            className="w-8 h-8 rounded-md bg-transparent border border-white/10 cursor-pointer"
          />
        </span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-sm text-white/85">Mostrar ícone</span>
        <Switch checked={valor.showIcon} onCheckedChange={(showIcon) => mudar({ showIcon })} />
      </div>
      <div className="flex items-center justify-between">
        <span className="text-sm text-white/85">Mostrar seta</span>
        <Switch checked={valor.showArrow} onCheckedChange={(showArrow) => mudar({ showArrow })} />
      </div>
    </div>
  );
}
