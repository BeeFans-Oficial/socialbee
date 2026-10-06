"use client";

import { usePathname } from "next/navigation";

import { useSession } from "@/lib/api/use-session";
import type { ApiPlan } from "@/lib/api/types";
import { cn } from "@/lib/utils";

const TITULOS: Record<string, string> = {
  "/paginas": "Páginas",
  "/links": "Links",
  "/aparencia": "Aparência",
  "/analytics": "Analytics",
  "/dominios": "Domínio próprio",
  "/configuracoes": "Configurações",
};

/**
 * Barra do topo do painel (desktop): onde a pessoa está e qual é o plano dela.
 * No celular quem faz esse papel é o cabeçalho da `Sidebar`.
 */
export function BarraDoTopo() {
  const pathname = usePathname();
  const { session } = useSession();
  const plan = session?.user.plan ?? null;
  const email = session?.user.email ?? "";

  return (
    <header className="hidden lg:flex sticky top-0 z-30 h-16 items-center justify-between px-8 border-b border-white/[0.06] bg-bee-bg/85 backdrop-blur">
      <span className="text-sm font-medium text-white">{TITULOS[pathname] ?? ""}</span>
      <div className="flex items-center gap-3">
        {plan && (
          <span
            title={legendaDoPlano(plan)}
            className={cn(
              "px-3 py-1 rounded-full text-[11px] font-bold tracking-[0.14em] border",
              plan.id === "pro"
                ? "bg-bee-pink/10 text-bee-pink border-bee-pink/40"
                : "bg-white/[0.04] text-white/55 border-white/15",
            )}
          >
            {plan.id === "pro" ? "PRO" : "FREE"}
            <span className="ml-2 font-medium tracking-normal opacity-80">{legendaDoPlano(plan)}</span>
          </span>
        )}
        {email && (
          <span
            title={email}
            className="w-8 h-8 rounded-full border border-white/15 flex items-center justify-center text-xs font-semibold text-white/80 uppercase"
          >
            {email[0]}
          </span>
        )}
      </div>
    </header>
  );
}

/** "até 05/11" no Pro; no Free, se já foi Pro, quando venceu. */
function legendaDoPlano(plan: ApiPlan): string {
  const fim = plan.proUntil ? new Date(plan.proUntil) : null;
  // O ano só aparece quando não é o atual: "até 06/10" num plano que vai até
  // 2037 parece vencer hoje.
  const data = fim
    ? fim.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        ...(fim.getFullYear() !== new Date().getFullYear() ? { year: "numeric" } : {}),
      })
    : null;
  if (plan.id === "pro") return data ? `até ${data}` : "";
  return data ? `Pro venceu em ${data}` : "plano gratuito";
}
