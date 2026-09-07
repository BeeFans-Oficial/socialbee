"use client";

import React, { useState, useEffect } from "react";
import {
  Eye,
  MousePointer2,
  Smartphone,
  TrendingUp,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { MOCK_ANALYTICS, MOCK_LINKS } from "@/lib/mock-data";
import { formatNumber } from "@/lib/utils";
import { cn } from "@/lib/utils";

export default function AnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<"7d" | "30d" | "90d">("30d");

  // Simular loading
  useEffect(() => {
    setTimeout(() => {
      setLoading(false);
    }, 800);
  }, []);

  // Filtrar dados por período
  const getFilteredData = () => {
    const days = period === "7d" ? 7 : period === "30d" ? 30 : 90;
    return MOCK_ANALYTICS.dailyData.slice(-days);
  };

  const filteredData = getFilteredData();

  // Ordenar links por clicks
  const topLinks = [...MOCK_LINKS]
    .filter((link) => link.isActive)
    .sort((a, b) => b.clicks - a.clicks);

  // Origens dos cliques
  const clickSources = [
    {
      name: "Instagram",
      value: 2104,
      percentage: 52,
      color: "#E1306C",
      emoji: "📸",
    },
    {
      name: "WhatsApp",
      value: 620,
      percentage: 15,
      color: "#25D366",
      emoji: "💬",
    },
    {
      name: "Telegram",
      value: 480,
      percentage: 12,
      color: "#229ED9",
      emoji: "✈️",
    },
    {
      name: "Direto",
      value: 416,
      percentage: 10,
      color: "#888888",
      emoji: "🌐",
    },
    {
      name: "Outros",
      value: 400,
      percentage: 10,
      color: "#555555",
      emoji: "📊",
    },
  ];

  // Custom Tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div
          className="rounded-lg p-3 shadow-xl"
          style={{
            backgroundColor: "#1e1e1e",
            border: "1px solid rgba(255, 60, 110, 0.3)",
          }}
        >
          <p className="text-xs text-white font-medium mb-1">
            {payload[0].payload.date}
          </p>
          <p className="text-xs text-bee-muted">
            Visualizações: <span className="text-white">{payload[0].value}</span>
          </p>
          <p className="text-xs text-bee-muted">
            Cliques: <span className="text-bee-pink">{payload[1].value}</span>
          </p>
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <div className="min-h-screen p-8">
        <div className="max-w-7xl mx-auto space-y-8">
          {/* Stats Cards Skeleton */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-32 bg-bee-surface rounded-xl animate-pulse"
              />
            ))}
          </div>

          {/* Chart Skeleton */}
          <div className="h-96 bg-bee-surface rounded-xl animate-pulse" />

          {/* Table Skeleton */}
          <div className="h-64 bg-bee-surface rounded-xl animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatsCard
            icon={Eye}
            iconBg="rgba(255, 60, 110, 0.15)"
            label="Visualizações"
            value={formatNumber(MOCK_ANALYTICS.totalViews)}
            change="+18%"
            changePeriod="vs mês anterior"
            changeType="positive"
          />
          <StatsCard
            icon={MousePointer2}
            iconBg="rgba(255, 160, 60, 0.15)"
            label="Cliques"
            value={formatNumber(MOCK_ANALYTICS.totalClicks)}
            change="+24%"
            changePeriod="vs mês anterior"
            changeType="positive"
          />
          <StatsCard
            icon={Smartphone}
            iconBg="rgba(225, 48, 108, 0.15)"
            label="Do Instagram"
            value={formatNumber(MOCK_ANALYTICS.instagramClicks)}
            change="52% do total"
            changeType="neutral"
          />
          <StatsCard
            icon={TrendingUp}
            iconBg="rgba(100, 220, 100, 0.15)"
            label="Conversão"
            value={`${MOCK_ANALYTICS.conversionRate}%`}
            change="+3.1pp"
            changeType="positive"
          />
        </div>

        {/* Chart */}
        <section className="bg-bee-surface rounded-xl p-6 border border-white/5">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-bebas text-2xl uppercase text-white">
              PERFORMANCE 30 DIAS
            </h2>

            {/* Period Filter */}
            <div className="flex gap-2">
              {[
                { id: "7d", label: "7d" },
                { id: "30d", label: "30d" },
                { id: "90d", label: "90d" },
              ].map((p) => (
                <button
                  key={p.id}
                  onClick={() => setPeriod(p.id as any)}
                  className={cn(
                    "px-3 py-1 rounded-full text-xs font-medium transition-all",
                    period === p.id
                      ? "bg-bee-pink text-white"
                      : "bg-bee-bg text-bee-muted hover:text-white"
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Chart */}
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={filteredData}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(255, 255, 255, 0.05)"
              />
              <XAxis
                dataKey="date"
                stroke="#555"
                tick={{ fontSize: 11 }}
                tickLine={false}
              />
              <YAxis stroke="#555" tick={{ fontSize: 11 }} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Line
                type="monotone"
                dataKey="views"
                stroke="#555"
                strokeWidth={2}
                dot={false}
                name="Visualizações"
              />
              <Line
                type="monotone"
                dataKey="clicks"
                stroke="#FF3C6E"
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 4, fill: "#FF3C6E" }}
                name="Cliques"
              />
            </LineChart>
          </ResponsiveContainer>

          {/* Legend */}
          <div className="flex items-center justify-center gap-6 mt-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-[#555]" />
              <span className="text-xs text-bee-muted">Visualizações</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-bee-pink" />
              <span className="text-xs text-bee-muted">Cliques</span>
            </div>
          </div>
        </section>

        {/* Top Links Table */}
        <section className="bg-bee-surface rounded-xl p-6 border border-white/5">
          <h2 className="font-bebas text-2xl uppercase text-white mb-6">
            TOP LINKS
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left text-xs font-medium text-bee-muted pb-3">
                    Link
                  </th>
                  <th className="text-right text-xs font-medium text-bee-muted pb-3">
                    Cliques
                  </th>
                  <th className="text-right text-xs font-medium text-bee-muted pb-3">
                    % Total
                  </th>
                  <th className="text-right text-xs font-medium text-bee-muted pb-3">
                    Instagram
                  </th>
                  <th className="w-32 text-xs font-medium text-bee-muted pb-3"></th>
                </tr>
              </thead>
              <tbody>
                {topLinks.map((link, index) => {
                  const percentage = (
                    (link.clicks / MOCK_ANALYTICS.totalClicks) *
                    100
                  ).toFixed(1);
                  const instagramClicks = Math.floor(link.clicks * 0.5);

                  return (
                    <tr
                      key={link.id}
                      className={cn(
                        "border-b border-white/5",
                        index % 2 === 1 && "bg-white/[0.02]"
                      )}
                    >
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-2">
                          <span className="text-sm">{link.platform}</span>
                          <span className="text-sm text-white truncate max-w-[200px]">
                            {link.title}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 text-right text-sm text-white">
                        {formatNumber(link.clicks)}
                      </td>
                      <td className="py-3 text-right">
                        <span
                          className="inline-block px-2 py-0.5 rounded-full text-xs font-medium"
                          style={{
                            backgroundColor: "rgba(255, 60, 110, 0.1)",
                            color: "#FF3C6E",
                          }}
                        >
                          {percentage}%
                        </span>
                      </td>
                      <td className="py-3 text-right text-sm text-bee-muted">
                        {formatNumber(instagramClicks)} 📱
                      </td>
                      <td className="py-3 pl-4">
                        <div className="w-full h-2 bg-bee-bg rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${percentage}%`,
                              background:
                                "linear-gradient(90deg, #FF3C6E, #FF1F57)",
                            }}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* Click Sources */}
        <section>
          <h2 className="font-bebas text-2xl uppercase text-white mb-6">
            ORIGEM DOS CLIQUES
          </h2>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {clickSources.map((source) => (
              <div
                key={source.name}
                className="bg-bee-surface rounded-xl p-4 border border-white/5"
              >
                {/* Emoji */}
                <div className="text-2xl mb-3">{source.emoji}</div>

                {/* Value */}
                <div className="font-bebas text-2xl text-white mb-1">
                  {formatNumber(source.value)}
                </div>

                {/* Name */}
                <div className="text-xs text-bee-muted mb-3">{source.name}</div>

                {/* Progress Bar */}
                <div className="w-full h-1.5 bg-bee-bg rounded-full overflow-hidden mb-2">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${source.percentage}%`,
                      backgroundColor: source.color,
                    }}
                  />
                </div>

                {/* Percentage */}
                <div
                  className="text-xs font-medium"
                  style={{ color: source.color }}
                >
                  {source.percentage}%
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
