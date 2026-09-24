"use client";

import React from "react";

import { ProfileHeader } from "@/components/profile/ProfileHeader";
import { LinkButton } from "@/components/profile/LinkButton";
import { HexBackground } from "@/components/shared/HexBackground";
import type { Link as LinkType } from "@/lib/catalog";
import type { VisualResolvido } from "@/lib/templates";
import { getPlatformIcon } from "@/lib/utils";
import { cn } from "@/lib/utils";

/**
 * A página pública dentro de um celular — com os COMPONENTES DE VERDADE.
 *
 * Existe um `PhoneMockup` mais antigo que desenha uma imitação: cabeçalho
 * próprio, botões próprios, layout próprio. Funcionava enquanto a página tinha
 * uma estrutura só; com templates ele passaria a mentir a cada layout novo, e
 * manter duas implementações sincronizadas é uma dívida que se paga toda
 * semana.
 *
 * Aqui a prévia monta `ProfileHeader` e `LinkButton` — os mesmos que a fã
 * recebe — com o mesmo `VisualResolvido` que a rota pública usa. O que muda no
 * template aparece aqui sem ninguém precisar replicar nada.
 *
 * Diferença deliberada: nada de `<iframe>`. A prévia do editor precisa refletir
 * o que está sendo DIGITADO, antes de salvar; um iframe só mostra o que já
 * está no servidor. Quem faz o papel do iframe é a tela de Prévia
 * (`/previa`), que mostra a página publicada, de verdade, byte a byte.
 */

interface PreviaDaPaginaProps {
  visual: VisualResolvido;
  user: {
    displayName: string;
    bio: string;
    avatarUrl: string | null;
    isAdult: boolean;
  };
  links: LinkType[];
  /** Altura do quadro. O padrão é a proporção de um celular comum. */
  className?: string;
}

export function PreviaDaPagina({ visual, user, links, className }: PreviaDaPaginaProps) {
  const ativos = links.filter((l) => l.isActive);
  const capaEmTela = visual.capa === "tela" && visual.coverUrl;

  return (
    <div
      className={cn(
        "relative mx-auto w-[300px] h-[600px] rounded-[38px] border-[6px] border-white/10 shadow-2xl overflow-hidden",
        className,
      )}
      style={{ backgroundColor: visual.bg }}
    >
      {/* Entalhe da câmera: é o que faz o olho ler "celular" antes de ler o
          conteúdo. */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-5 rounded-b-2xl bg-black z-30" />

      {capaEmTela && (
        <div className="absolute inset-0">
          {/* eslint-disable-next-line @next/next/no-img-element -- pode ser um
              data URL ainda não enviado; `next/image` não otimizaria. */}
          <img
            src={visual.coverUrl!}
            alt=""
            className="w-full h-full object-cover"
            style={{ objectPosition: visual.coverPos }}
          />
          <div
            className="absolute inset-0"
            style={{ backgroundColor: `rgba(0,0,0,${visual.overlay})` }}
          />
        </div>
      )}

      {visual.hex && !capaEmTela && <HexBackground density="medium" />}

      {/* `overflow-y-auto` porque a página real rola: sem isso o editor mostra
          só o topo e a criadora nunca vê os últimos links. */}
      <div className="relative z-10 h-full overflow-y-auto pb-8 text-bee-text">
        <ProfileHeader
          user={user}
          visual={visual}
          activePlatforms={user.isAdult ? [] : ativos.map((l) => getPlatformIcon(l.platform))}
        />

        <div
          className={cn(
            "px-4 mt-5",
            visual.lista === "grade" ? "grid grid-cols-2 gap-2.5" : "space-y-2.5",
          )}
        >
          {ativos.map((link, index) => (
            <LinkButton
              key={link.id}
              link={link}
              icon={getPlatformIcon(link.platform)}
              buttonStyle={visual.botao}
              accentColor={visual.accent}
              detalhes={visual.detalhes}
              index={index}
              // A prévia não navega: clicar aqui abriria o destino e tiraria a
              // criadora do editor no meio de uma edição.
              onClick={() => {}}
            />
          ))}

          {ativos.length === 0 && (
            <div className="col-span-2 text-center text-[11px] text-white/25 py-6">
              Nenhum link ativo ainda
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
