"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface HexBackgroundProps {
  className?: string;
  density?: "low" | "medium" | "high";
}

export function HexBackground({
  className,
  density = "medium",
}: HexBackgroundProps) {
  const hexagons = React.useMemo(() => {
    const configs = {
      low: [
        { size: 150, top: -5, left: -5, opacity: 0.3, rotation: 15, glow: true, delay: 0 },
        { size: 120, top: 10, left: 85, opacity: 0.4, rotation: -20, glow: false, delay: 2 },
        { size: 180, top: 45, left: 90, opacity: 0.35, rotation: 30, glow: true, delay: 4 },
        { size: 130, top: 75, left: 80, opacity: 0.3, rotation: -15, glow: false, delay: 1 },
        { size: 150, top: 85, left: -8, opacity: 0.4, rotation: 25, glow: true, delay: 3 },
      ],
      medium: [
        { size: 150, top: -8, left: -8, opacity: 0.35, rotation: 15, glow: true, delay: 0 },
        { size: 120, top: -5, left: 12, opacity: 0.25, rotation: -10, glow: false, delay: 1.5 },
        { size: 180, top: 8, left: 88, opacity: 0.4, rotation: -25, glow: true, delay: 3 },
        { size: 140, top: 5, left: 75, opacity: 0.3, rotation: 20, glow: false, delay: 2 },
        { size: 160, top: 35, left: 92, opacity: 0.35, rotation: 10, glow: true, delay: 4.5 },
        { size: 130, top: 50, left: 85, opacity: 0.25, rotation: -20, glow: false, delay: 1 },
        { size: 170, top: 72, left: 88, opacity: 0.4, rotation: 30, glow: true, delay: 3.5 },
        { size: 145, top: 78, left: 75, opacity: 0.3, rotation: -15, glow: false, delay: 2.5 },
        { size: 155, top: 88, left: -10, opacity: 0.35, rotation: 25, glow: true, delay: 0.5 },
        { size: 135, top: 92, left: 10, opacity: 0.28, rotation: -18, glow: false, delay: 4 },
      ],
      high: [
        { size: 150, top: -10, left: -10, opacity: 0.35, rotation: 15, glow: true, delay: 0 },
        { size: 120, top: -8, left: 8, opacity: 0.25, rotation: -10, glow: false, delay: 1.5 },
        { size: 110, top: 5, left: 20, opacity: 0.22, rotation: 35, glow: false, delay: 3.5 },
        { size: 180, top: 5, left: 88, opacity: 0.4, rotation: -25, glow: true, delay: 3 },
        { size: 140, top: 2, left: 72, opacity: 0.3, rotation: 20, glow: false, delay: 2 },
        { size: 125, top: 22, left: 5, opacity: 0.28, rotation: -12, glow: false, delay: 5 },
        { size: 160, top: 32, left: 92, opacity: 0.35, rotation: 10, glow: true, delay: 4.5 },
        { size: 130, top: 48, left: 85, opacity: 0.25, rotation: -20, glow: false, delay: 1 },
        { size: 145, top: 55, left: -5, opacity: 0.3, rotation: 18, glow: false, delay: 6 },
        { size: 170, top: 70, left: 88, opacity: 0.4, rotation: 30, glow: true, delay: 3.5 },
        { size: 145, top: 75, left: 72, opacity: 0.3, rotation: -15, glow: false, delay: 2.5 },
        { size: 135, top: 78, left: 15, opacity: 0.26, rotation: 22, glow: false, delay: 4.8 },
        { size: 155, top: 90, left: -12, opacity: 0.35, rotation: 25, glow: true, delay: 0.5 },
        { size: 135, top: 95, left: 8, opacity: 0.28, rotation: -18, glow: false, delay: 4 },
        { size: 120, top: 88, left: 50, opacity: 0.24, rotation: 12, glow: false, delay: 5.5 },
      ],
    };

    return configs[density];
  }, [density]);

  return (
    <div className={cn("absolute inset-0 overflow-hidden pointer-events-none z-0", className)}>
      <style jsx>{`
        @keyframes hexPulse {
          0%, 100% { opacity: var(--hex-opacity-min); }
          50% { opacity: var(--hex-opacity-max); }
        }
      `}</style>
      {hexagons.map((hex, i) => (
        <div
          key={i}
          className="absolute hex-glow"
          style={{
            width: `${hex.size}px`,
            height: `${hex.size}px`,
            top: `${hex.top}%`,
            left: `${hex.left}%`,
            transform: `rotate(${hex.rotation}deg)`,
            filter: hex.glow ? "drop-shadow(0 0 6px #FF3C6E)" : "none",
            animation: `hexPulse ${4 + (i % 5) * 0.8}s ease-in-out infinite`,
            animationDelay: `${hex.delay}s`,
            // @ts-ignore
            "--hex-opacity-min": hex.opacity - 0.1,
            "--hex-opacity-max": hex.opacity + 0.2,
          }}
        >
          <svg
            viewBox="0 0 100 100"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="w-full h-full"
          >
            <polygon
              points="50,5 85,27.5 85,72.5 50,95 15,72.5 15,27.5"
              stroke="#FF3C6E"
              strokeWidth="1.5"
              fill="none"
            />
          </svg>
        </div>
      ))}
    </div>
  );
}
