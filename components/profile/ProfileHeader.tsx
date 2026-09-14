"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface ProfileHeaderProps {
  user: {
    displayName: string;
    bio: string;
    avatarUrl: string | null;
    isAdult: boolean;
  };
  themeAccent: string;
  activePlatforms: string[];
}

export function ProfileHeader({ user, themeAccent, activePlatforms }: ProfileHeaderProps) {
  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="w-full">
      {/* Cover */}
      <div
        className="h-32 w-full"
        style={{
          background: `linear-gradient(135deg, ${themeAccent}40, ${themeAccent}80)`,
        }}
      />

      {/* Avatar
          `w-22 h-22` estava aqui e **não existe** na escala do Tailwind (ela vai
          de 20 para 24). As duas classes não geravam CSS nenhum, então o
          contêiner ficava sem largura e sem altura, e a `<img className="w-full
          h-full">` dentro dele passava a valer 100% de um pai de tamanho
          automático — ou seja, o tamanho natural do arquivo. Com iniciais no
          lugar da foto o defeito não aparecia (o `<span>` é pequeno), mas quem
          subia um avatar de câmera via a foto tomar a tela inteira.

          Agora usa `w-24 h-24` (96 px) com `-mt-12` (48 px), mantendo a
          sobreposição de metade do avatar sobre a capa que o `-mt-11` original
          pretendia. `flex-shrink-0` impede que a coluna esprema o círculo. */}
      <div className="flex flex-col items-center -mt-12 px-6">
        <div
          className="w-24 h-24 flex-shrink-0 rounded-full border-2 bg-bee-surface2 flex items-center justify-center overflow-hidden"
          style={{ borderColor: themeAccent }}
        >
          {user.avatarUrl ? (
            <img
              src={user.avatarUrl}
              alt={user.displayName}
              className="w-full h-full object-cover"
            />
          ) : (
            <span
              className="font-bebas text-3xl"
              style={{ color: themeAccent }}
            >
              {getInitials(user.displayName)}
            </span>
          )}
        </div>

        {/* Display Name + selo 18+
            O `isAdult` já chegava nas props e nunca era renderizado: o perfil
            adulto não se identificava como tal em nenhum lugar da página. */}
        <div className="flex items-center justify-center gap-2 mt-4">
          <h1 className="font-bebas text-2xl uppercase tracking-wide text-center">
            {user.displayName}
          </h1>
          {user.isAdult && (
            <span
              className="flex-shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold leading-none text-red-400"
              style={{
                backgroundColor: "rgba(220, 38, 38, 0.18)",
                border: "1px solid rgba(220, 38, 38, 0.4)",
              }}
            >
              18+
            </span>
          )}
        </div>

        {/* Bio */}
        <p className="text-sm text-bee-muted text-center max-w-xs mx-auto mt-2 line-clamp-2 leading-relaxed">
          {user.bio}
        </p>

        {/* Platform Icons */}
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
