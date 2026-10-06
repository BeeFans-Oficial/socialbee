import { toast } from "sonner";

import { cn } from "@/lib/utils";

/** Marca o que é do plano Pro, ao lado do controle travado. */
export function SeloPro({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-1.5 py-0.5 rounded-md text-[9px] font-bold tracking-wider",
        "bg-bee-pink/15 text-bee-pink border border-bee-pink/30",
        className,
      )}
    >
      PRO
    </span>
  );
}

/**
 * Explica a trava em vez de só não fazer nada.
 *
 * Ainda não há assinatura no produto — a liberação é feita pela equipe — então
 * o aviso não promete um botão de upgrade que não existe.
 */
export function avisarPro(oQue: string): void {
  toast.info(`${oQue} é do plano Pro.`, {
    description: "Fale com a equipe para liberar na sua conta.",
  });
}
