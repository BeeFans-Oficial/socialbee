"use client";

import React from "react";
import { motion } from "framer-motion";
import { ChevronRight } from "lucide-react";
import { IconeDePlataforma } from "@/components/shared/IconeDePlataforma";
import { LinkAppearance, DEFAULT_LINK_APPEARANCE } from "@/lib/catalog";

interface LinkButtonProps {
  link: {
    id: string;
    title: string;
    /** Editável no painel desde sempre, e até o template "Cartões" existir
     *  NUNCA renderizado: este componente nem recebia o campo. */
    subtitle?: string | null;
    thumbnailUrl?: string | null;
    platform: string;
    shortCode: string;
    cloakEnabled: boolean;
    appearance?: LinkAppearance;
  };
  /** fallback accent from profile theme, used when link has no appearance */
  accentColor: string;
  /** fallback button style from profile settings */
  buttonStyle: string;
  /** O template pede miniatura e subtítulo (`cartoes`). Fora dele o botão é a
   *  linha de sempre — a informação existe, mas não cabe numa lista estreita. */
  detalhes?: boolean;
  /** Botão branco, igual para todos os links, ignorando a aparência por link
   *  (modelo "Foto"). */
  uniforme?: boolean;
  /** Posição na lista. Escalonava a animação de entrada, que saiu; continua
   *  aceito para não mexer em quem chama. */
  index?: number;
  onClick: () => void;
}

export function LinkButton({
  link,
  accentColor,
  buttonStyle: profileButtonStyle,
  detalhes = false,
  uniforme = false,
  onClick,
}: LinkButtonProps) {
  if (uniforme) {
    return (
      <motion.button
        // Sem animação de entrada: o botão vem do servidor já visível. Com
        // `initial={{ opacity: 0 }}` ele chegava transparente e só aparecia
        // depois de o JavaScript carregar — dentro do Instagram, em rede
        // móvel, a fã via a página sem nenhum botão por segundos.
        initial={false}
        onClick={onClick}
        whileHover={{ y: -1 }}
        whileTap={{ scale: 0.98, y: 0 }}
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
        className="relative w-full min-h-[56px] rounded-[14px] bg-white text-[#111] px-6 py-[17px] flex items-center justify-center gap-2.5 shadow-[0_1px_2px_rgba(0,0,0,0.18)] transition-[background-color,box-shadow] duration-200 hover:bg-[#f2f2f2] hover:shadow-[0_8px_24px_rgba(0,0,0,0.28)]"
      >
        <IconeDePlataforma plataforma={link.platform} className="w-[18px] h-[18px] flex-shrink-0 text-[#111]/70" />
        <span className="text-[15px] font-semibold leading-tight">{link.title}</span>
      </motion.button>
    );
  }

  // Per-link appearance takes priority over profile-wide settings
  const appearance: LinkAppearance = link.appearance ?? {
    ...DEFAULT_LINK_APPEARANCE,
    style: (profileButtonStyle as LinkAppearance["style"]) ?? "soft",
    color: accentColor,
  };

  const { style, color, useGradient, gradientTo, glow, showIcon, showArrow } = appearance;
  const isPill = style === "pill";
  const radius = isPill ? "rounded-full" : "rounded-xl";

  const bg = (() => {
    switch (style) {
      case "filled":
        return useGradient ? `linear-gradient(135deg, ${color}, ${gradientTo})` : color;
      case "soft":
      case "pill":
        return useGradient ? `linear-gradient(135deg, ${color}1f, ${gradientTo}1f)` : `${color}1a`;
      case "glass":
        return "rgba(255,255,255,0.06)";
      case "outlined":
        return "transparent";
    }
  })();

  const borderStyle = (() => {
    switch (style) {
      case "filled": return "none";
      case "soft": case "pill": return `1px solid ${color}30`;
      case "glass": return "1px solid rgba(255,255,255,0.1)";
      case "outlined": return `2px solid ${color}`;
    }
  })();

  // Texto branco em todos os estilos: título na cor de destaque sobre fundo
  // tingido da mesma cor era o que deixava a página com cara de neon.
  const textColor = "rgba(255,255,255,0.94)";

  // O "glow" da aparência por link não acende mais nada: brilho colorido em
  // volta do botão é exatamente o neon que a página deixou de ter. O campo
  // continua no banco, sem efeito.
  void glow;
  const boxShadow = style === "filled" ? "0 1px 2px rgba(0,0,0,0.25)" : undefined;

  return (
    <motion.button
      // Visível desde o HTML do servidor — ver o botão uniforme acima.
      initial={false}
      onClick={onClick}
      className={`relative w-full overflow-hidden cursor-pointer transition-[filter,box-shadow] duration-200 hover:brightness-125 hover:shadow-[0_8px_24px_rgba(0,0,0,0.3)] ${radius}`}
      style={{ background: bg, border: borderStyle, boxShadow, backdropFilter: style === "glass" ? "blur(12px)" : undefined }}
      // Hover discreto: sobe 1px e clareia — sem crescer, que empurrava o
      // vizinho na grade do modelo Cartões.
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.98, y: 0 }}
    >

      {detalhes ? (
        /* Cartão: miniatura em cima, texto embaixo. O alinhamento é à esquerda
           porque com subtítulo o bloco vira texto corrido, e texto corrido
           centralizado é mais difícil de ler. */
        <div className="flex flex-col text-left">
          <div className="w-full aspect-[16/10] bg-black/20 overflow-hidden flex items-center justify-center">
            {link.thumbnailUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- data URL
              // vinda do banco, como o avatar.
              <img src={link.thumbnailUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <IconeDePlataforma plataforma={link.platform} className="w-8 h-8 opacity-40" />
            )}
          </div>
          <div className="px-3 py-2.5">
            <div className="text-sm font-semibold leading-tight" style={{ color: textColor }}>
              {link.title}
            </div>
            {link.subtitle && (
              <div className="text-[11px] mt-0.5 line-clamp-2" style={{ color: `${textColor}99` }}>
                {link.subtitle}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="grid items-center gap-2 py-4 px-4"
          style={{ gridTemplateColumns: showIcon ? "48px 1fr 24px" : "1fr 24px" }}>
          {showIcon && (
            <div className="flex items-center justify-center">
              <div className="w-9 h-9 flex items-center justify-center" style={{ color: textColor }}>
                <IconeDePlataforma plataforma={link.platform} className="w-5 h-5 opacity-80" />
              </div>
            </div>
          )}
          <div className="flex items-center justify-center">
            <span className="text-sm font-semibold" style={{ color: textColor }}>{link.title}</span>
          </div>
          {showArrow && (
            <div className="flex items-center justify-center">
              <ChevronRight className="w-4 h-4" style={{ color: `${textColor}80` }} />
            </div>
          )}
        </div>
      )}
    </motion.button>
  );
}
