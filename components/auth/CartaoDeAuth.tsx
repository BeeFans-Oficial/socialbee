import Link from "next/link";

import { CeuEstrelado } from "@/components/landing/CeuEstrelado";
import { Logo } from "@/components/shared/Logo";

/**
 * Moldura das telas de entrar e criar conta: só o formulário, num cartão
 * centralizado sobre o mesmo céu da tela inicial. Nada de painel lateral — a
 * pessoa veio fazer uma coisa só.
 */
export function CartaoDeAuth({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen bg-bee-bg flex items-center justify-center px-4 py-12 overflow-hidden">
      <CeuEstrelado />
      <div className="relative z-10 w-full max-w-[420px] rounded-2xl border border-bee-border bg-bee-surface/80 backdrop-blur-sm px-6 sm:px-8 py-9 shadow-2xl">
        <Link href="/" className="flex justify-center mb-7" aria-label="Voltar à página inicial">
          <Logo variant="full" size="sm" />
        </Link>
        {children}
      </div>
    </div>
  );
}
