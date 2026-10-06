import React from "react";

import { IconeDePlataforma } from "@/components/shared/IconeDePlataforma";
import { cn } from "@/lib/utils";
import type { VisualResolvido } from "@/lib/templates";

/**
 * Cabeçalho do perfil público.
 *
 * **Não é componente de cliente**, e isso é medida, não estilo: ele tinha
 * `"use client"` sem usar um único hook ou handler. O efeito colateral era caro
 * — ao receber `user` como prop através da fronteira de cliente, o avatar
 * (data URL de até 2 MB, porque ainda não há upload de arquivo) ia para o
 * payload RSC **além** do HTML renderizado. A mesma imagem, duas vezes, no
 * mesmo documento: 2,9 MB para um perfil com uma foto de 1,8 MB.
 *
 * Sendo componente de servidor, ele sai do payload e a imagem viaja uma vez.
 * Por isso ele é renderizado por `app/[slug]/page.tsx` e não de dentro do
 * `ProfileClient` — módulo importado por componente de cliente volta a ser
 * cliente.
 *
 * ## O que o template muda aqui
 *
 * Quatro coisas, todas vindas do descritor (`lib/templates.ts`): o uso da
 * imagem de fundo (faixa, herói, tela ou nenhuma), o tamanho do avatar, o
 * alinhamento e a fonte do nome. O resto — selo 18+, bio, ícones de plataforma
 * — é igual em todos, porque é informação e não decoração.
 */

interface ProfileHeaderProps {
  user: {
    displayName: string;
    bio: string;
    avatarUrl: string | null;
    isAdult: boolean;
  };
  visual: VisualResolvido;
  /** Ids das plataformas dos links (`telegram`, `onlyfans`…), sem repetição.
   *  Viram ícones de linha — eram emojis. */
  activePlatforms: string[];
}

const TAMANHO_AVATAR = {
  grande: "w-32 h-32",
  medio: "w-24 h-24",
  nenhum: "",
} as const;

export function ProfileHeader({ user, visual, activePlatforms }: ProfileHeaderProps) {
  const getInitials = (name: string) =>
    name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);

  const aEsquerda = visual.alinhamento === "esquerda";
  const mostrarAvatar = visual.avatar !== "nenhum";
  const temCapa = Boolean(visual.coverUrl) && visual.capa !== "nenhuma";

  return (
    <div className="w-full">
      {/* Imagem de fundo, quando o template a usa como FAIXA ou HERÓI.
          O uso "tela" não é desenhado aqui: ele é o fundo da página inteira e
          fica em `app/[slug]/page.tsx`, atrás de tudo. */}
      {(visual.capa === "faixa" || visual.capa === "heroi") && (
        <div
          // `data-capa-area`: o editor de página mede esta caixa dentro da
          // prévia para posicionar os controles da foto sobre ela.
          data-capa-area
          className={cn(
            // A capa ocupa a COLUNA da página, não a janela: no computador,
            // esticar uma foto vertical a 1.280 px de largura mostrava só uma
            // faixa ampliada do meio dela.
            "relative w-full max-w-[560px] mx-auto overflow-hidden",
            // Proporção fixa, e não fração da altura da janela: o recorte da
            // foto fica IGUAL no iPhone e no computador, então o enquadramento
            // que a criadora acerta na prévia é o que a fã vê em qualquer tela.
            visual.capa === "heroi" ? "aspect-[4/5]" : "h-32",
          )}
          style={
            temCapa
              ? undefined
              : // Sem foto, a faixa vira um gradiente da cor de destaque — é o
                // que o template Clássico sempre fez, e sem ele o topo da
                // página fica um retângulo vazio.
                { background: `linear-gradient(to bottom, ${visual.accent}26, transparent)` }
          }
        >
          {temCapa && (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element -- a rota
                  serve bytes de uma coluna do banco; `next/image` exige loader
                  ou domínio configurado e não acrescentaria nada aqui. */}
              {/* Bordas infinitas: a foto e o escurecimento somem num degradê
                  de máscara até o transparente, e o que aparece por baixo é o
                  próprio fundo da página. Sem linha de corte entre foto e
                  fundo, em qualquer cor de tema. */}
              <div className="absolute inset-0 capa-infinita">
                {/* `data-capa`: o editor de página ajusta o enquadramento direto
                    nesta imagem, dentro da prévia, sem recarregar a página. */}
                <img
                  data-capa
                  src={visual.coverUrl!}
                  alt=""
                  className="w-full h-full object-cover"
                  style={{ objectPosition: visual.coverPos }}
                />
                {/* Escurecimento, para o nome por cima continuar legível sobre
                    foto clara; a criadora controla a intensidade. */}
                <div
                  className="absolute inset-0"
                  style={{
                    background: `linear-gradient(to bottom, rgba(0,0,0,0) 35%, rgba(0,0,0,${visual.overlay * 0.7}) 100%)`,
                  }}
                />
              </div>
            </>
          )}

          {/* No HERÓI o nome fica sobre a imagem, e não abaixo dela. */}
          {visual.capa === "heroi" && (
            <div className="absolute inset-x-0 bottom-0 px-6 pb-5">
              <div className={cn("flex items-center gap-2", aEsquerda ? "" : "justify-center")}>
                <h1
                  className={cn(
                    visual.fonteClasse,
                    "leading-none text-white",
                    visual.nomeEmCaixaAlta
                      ? "text-[34px] uppercase tracking-wide"
                      : "text-[30px] font-semibold tracking-tight",
                  )}
                >
                  {user.displayName}
                </h1>
                {user.isAdult && <SeloAdulto />}
              </div>
            </div>
          )}
        </div>
      )}

      <div
        className={cn(
          "flex flex-col px-6",
          aEsquerda ? "items-start" : "items-center",
          mostrarAvatar && visual.capa === "faixa" ? "-mt-12" : "mt-6",
        )}
      >
        {/* Avatar
            `w-22 h-22` estava aqui e **não existe** na escala do Tailwind (ela
            vai de 20 para 24). As duas classes não geravam CSS nenhum, então o
            contêiner ficava sem largura e sem altura, e a `<img w-full h-full>`
            dentro dele passava a valer 100% de um pai de tamanho automático —
            ou seja, o tamanho natural do arquivo. Quem subia um avatar de
            câmera via a foto tomar a tela inteira. */}
        {mostrarAvatar && (
          <div
            className={cn(
              TAMANHO_AVATAR[visual.avatar],
              "flex-shrink-0 rounded-full border-2 bg-bee-surface2 flex items-center justify-center overflow-hidden",
            )}
            style={{ borderColor: visual.accent }}
          >
            {user.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- ver acima
              <img
                src={user.avatarUrl}
                alt={user.displayName}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className={cn(visual.fonteClasse, "text-3xl")} style={{ color: visual.accent }}>
                {getInitials(user.displayName)}
              </span>
            )}
          </div>
        )}

        {/* Nome + selo 18+ — exceto no herói, onde já saíram sobre a imagem.
            O `isAdult` já chegava nas props e nunca era renderizado: o perfil
            adulto não se identificava como tal em nenhum lugar da página. */}
        {visual.capa !== "heroi" && (
          <div className={cn("flex items-center gap-2 mt-4", aEsquerda ? "" : "justify-center")}>
            <h1
              className={cn(
                visual.fonteClasse,
                visual.nomeEmCaixaAlta ? "uppercase tracking-wide" : "font-semibold tracking-tight",
                visual.avatar === "grande" ? "text-4xl" : "text-2xl",
                aEsquerda ? "text-left" : "text-center",
              )}
            >
              {user.displayName}
            </h1>
            {user.isAdult && <SeloAdulto />}
          </div>
        )}

        <p
          className={cn(
            "text-sm text-bee-muted max-w-xs mt-2 line-clamp-2 leading-relaxed",
            aEsquerda ? "text-left" : "text-center mx-auto",
          )}
        >
          {user.bio}
        </p>

        {activePlatforms.length > 0 && (
          <div className="flex items-center gap-2 mt-4">
            {activePlatforms.slice(0, 5).map((platform) => (
              <div
                key={platform}
                className="w-8 h-8 rounded-full bg-white/[0.06] border border-white/10 flex items-center justify-center text-white/70"
              >
                <IconeDePlataforma plataforma={platform} className="w-4 h-4" />
              </div>
            ))}
            {activePlatforms.length > 5 && (
              <div className="w-8 h-8 rounded-full bg-white/[0.06] border border-white/10 flex items-center justify-center text-xs text-white/50">
                +{activePlatforms.length - 5}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function SeloAdulto() {
  return (
    <span
      className="flex-shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold leading-none text-red-400"
      style={{
        backgroundColor: "rgba(220, 38, 38, 0.18)",
        border: "1px solid rgba(220, 38, 38, 0.4)",
      }}
    >
      18+
    </span>
  );
}
