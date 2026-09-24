import React from "react";

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
          className={cn(
            "relative w-full overflow-hidden",
            visual.capa === "heroi" ? "h-[45vh] min-h-[260px]" : "h-32",
          )}
          style={
            temCapa
              ? undefined
              : // Sem foto, a faixa vira um gradiente da cor de destaque — é o
                // que o template Clássico sempre fez, e sem ele o topo da
                // página fica um retângulo vazio.
                { background: `linear-gradient(135deg, ${visual.accent}40, ${visual.accent}80)` }
          }
        >
          {temCapa && (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element -- a rota
                  serve bytes de uma coluna do banco; `next/image` exige loader
                  ou domínio configurado e não acrescentaria nada aqui. */}
              <img
                src={visual.coverUrl!}
                alt=""
                className="w-full h-full object-cover"
                // O enquadramento que a criadora escolheu. Sem ele, toda foto
                // vertical de celular é cortada no meio — que é justamente
                // onde o rosto costuma estar.
                style={{ objectPosition: visual.coverPos }}
              />
              {/* Escurecimento. Existe para o texto por cima continuar legível
                  sobre foto clara; a criadora controla a intensidade. */}
              <div
                className="absolute inset-0"
                style={{
                  background: `linear-gradient(to bottom, rgba(0,0,0,${visual.overlay * 0.5}), ${visual.bg})`,
                }}
              />
            </>
          )}

          {/* No HERÓI o nome fica sobre a imagem, e não abaixo dela. */}
          {visual.capa === "heroi" && (
            <div className="absolute inset-x-0 bottom-0 px-6 pb-5">
              <div className={cn("flex items-center gap-2", aEsquerda ? "" : "justify-center")}>
                <h1
                  className={cn(
                    visual.fonteClasse,
                    "text-[34px] leading-none uppercase tracking-wide text-white",
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
                "uppercase tracking-wide",
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
            {activePlatforms.slice(0, 5).map((platform, i) => (
              <div
                key={i}
                className="w-8 h-8 rounded-full bg-bee-surface border border-bee-border flex items-center justify-center text-lg"
              >
                {platform}
              </div>
            ))}
            {activePlatforms.length > 5 && (
              <div className="w-8 h-8 rounded-full bg-bee-surface border border-bee-border flex items-center justify-center text-xs text-bee-muted">
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
