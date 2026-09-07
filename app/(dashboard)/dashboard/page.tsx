"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function DashboardPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <div className="max-w-md text-center space-y-6">
        {/* Título */}
        <h1 className="font-bebas text-5xl uppercase text-white tracking-wide">
          BEM-VINDA AO DASHBOARD
        </h1>

        {/* Subtítulo */}
        <p className="text-bee-muted text-sm leading-relaxed">
          Gerencie seus links, personalize sua página e acompanhe seus resultados
          em tempo real.
        </p>

        {/* Cards de navegação rápida */}
        <div className="grid gap-4 pt-4">
          <button
            onClick={() => router.push("/links")}
            className="group p-6 rounded-xl border border-bee-border bg-bee-surface hover:bg-bee-surface2 transition-all text-left"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-barlow font-semibold text-white mb-1">
                  Gerenciar Links
                </h3>
                <p className="text-xs text-bee-muted">
                  Adicione, edite e organize seus links
                </p>
              </div>
              <ArrowRight className="w-5 h-5 text-bee-pink group-hover:translate-x-1 transition-transform" />
            </div>
          </button>

          <button
            onClick={() => router.push("/aparencia")}
            className="group p-6 rounded-xl border border-bee-border bg-bee-surface hover:bg-bee-surface2 transition-all text-left"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-barlow font-semibold text-white mb-1">
                  Personalizar Aparência
                </h3>
                <p className="text-xs text-bee-muted">
                  Escolha temas e estilos de botão
                </p>
              </div>
              <ArrowRight className="w-5 h-5 text-bee-pink group-hover:translate-x-1 transition-transform" />
            </div>
          </button>

          <button
            onClick={() => router.push("/analytics")}
            className="group p-6 rounded-xl border border-bee-border bg-bee-surface hover:bg-bee-surface2 transition-all text-left"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-barlow font-semibold text-white mb-1">
                  Ver Analytics
                </h3>
                <p className="text-xs text-bee-muted">
                  Acompanhe cliques e conversões
                </p>
              </div>
              <ArrowRight className="w-5 h-5 text-bee-pink group-hover:translate-x-1 transition-transform" />
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
