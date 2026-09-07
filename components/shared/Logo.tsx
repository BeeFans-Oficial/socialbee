import React from "react";
import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
  variant?: "full" | "icon" | "stacked";
  iconColor?: string;
  textColor?: string;
}

const iconSizes = { sm: 36, md: 50, lg: 62, xl: 80 } as const;

// Quando trocar a logo em public/logo-bee.png, mude este número (ex: 3, 4) e salve
const LOGO_VERSION = 2;

export function Logo({
  className,
  size = "md",
  variant = "full",
  iconColor,
  textColor,
}: LogoProps) {
  const sizeClasses = {
    sm: { icon: "h-9 w-9", text: "text-xl" },
    md: { icon: "h-[50px] w-[50px]", text: "text-2xl" },
    lg: { icon: "h-[62px] w-[62px]", text: "text-4xl" },
    xl: { icon: "h-20 w-20", text: "text-5xl" },
  };

  const currentSize = sizeClasses[size];
  const defaultTextColor = textColor ?? "#FFFFFF";
  const px = iconSizes[size];

  const LogoIcon = () => (
    <span
      className="inline-flex overflow-hidden flex-shrink-0"
      style={{
        width: px,
        height: px,
        mixBlendMode: "lighten",
      }}
    >
      <img
        src={`/logo-bee.png?v=${LOGO_VERSION}`}
        alt="BeeSocial"
        width={px}
        height={px}
        className="object-contain w-full h-full"
        style={{ transform: "scale(1.5)", transformOrigin: "center center" }}
        fetchPriority="high"
      />
    </span>
  );

  const BeeText = () => (
    <span className={cn("font-bebas font-bold tracking-tight leading-none", currentSize.text)}>
      <span style={{ color: defaultTextColor, fontSize: "1.1em" }}>Bee</span>
      <span style={{ color: "#FF3C6E" }}>Social</span>
    </span>
  );

  if (variant === "icon") {
    return (
      <div className={cn("inline-flex", className)}>
        <LogoIcon />
      </div>
    );
  }

  if (variant === "stacked") {
    return (
      <div className={cn("inline-flex flex-col items-center gap-1", className)}>
        <LogoIcon />
        <BeeText />
      </div>
    );
  }

  return (
    <div className={cn("inline-flex items-center gap-2 overflow-visible", className)}>
      <LogoIcon />
      <BeeText />
    </div>
  );
}
