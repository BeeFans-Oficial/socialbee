"use client";

import React from "react";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatsCardProps {
  icon: LucideIcon;
  iconBg: string;
  label: string;
  value: string;
  change?: string;
  changePeriod?: string;
  changeType?: "positive" | "negative" | "neutral";
}

export function StatsCard({
  icon: Icon,
  iconBg,
  label,
  value,
  change,
  changePeriod,
  changeType = "positive",
}: StatsCardProps) {
  return (
    <div
      className="bg-bee-surface rounded-xl p-5 transition-all hover:border-bee-pink/15"
      style={{
        border: "1px solid rgba(255, 255, 255, 0.05)",
      }}
    >
      {/* Icon */}
      <div
        className="w-10 h-10 rounded-lg flex items-center justify-center mb-4"
        style={{ backgroundColor: iconBg }}
      >
        <Icon className="w-5 h-5 text-white" />
      </div>

      {/* Value */}
      <div className="font-bebas text-[32px] leading-none text-white mb-1">
        {value}
      </div>

      {/* Label */}
      <div className="text-xs text-bee-muted mb-2">{label}</div>

      {/* Change Badge */}
      {change && (
        <div
          className={cn(
            "inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium",
            changeType === "positive" && "bg-green-500/20 text-green-500",
            changeType === "negative" && "bg-red-500/20 text-red-500",
            changeType === "neutral" && "bg-bee-muted/20 text-bee-muted"
          )}
        >
          {change}
          {changePeriod && <span className="ml-1">{changePeriod}</span>}
        </div>
      )}
    </div>
  );
}
