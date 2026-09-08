"use client"

import * as React from "react"
import * as SwitchPrimitives from "@radix-ui/react-switch"

import { cn } from "@/lib/utils"

/**
 * Switch.
 *
 * As cores são explícitas, e não os tokens do shadcn (`bg-primary`,
 * `bg-input`, `bg-background`), por dois motivos:
 *
 *  1. Sem os tokens no tema, este componente era **invisível** — track e thumb
 *     ficavam os dois sem `background`. No `/cadastro` isso travava o cadastro
 *     inteiro: ninguém conseguia marcar "confirmo que tenho 18 anos ou mais",
 *     e o botão CONTINUAR nunca saía de desabilitado. Os tokens agora existem
 *     em `tailwind.config.ts`, mas...
 *  2. ...mesmo com eles, o thumb do shadcn é `bg-background` — que num tema
 *     escuro é quase preto sobre um trilho escuro. Contraste ruim de origem.
 *
 * A linguagem visual segue o `MiniToggle` de `components/dashboard/LinkCard.tsx`,
 * que já estava certo e é o toggle que a criadora vê no dashboard: verde para
 * ligado, cinza para desligado. Um app com dois toggles de aparência diferente
 * confunde mais do que qualquer ganho de fidelidade ao shadcn.
 *
 * A geometria do shadcn (44×24) foi mantida de propósito, e não a do MiniToggle
 * (36×20): este Switch aparece em confirmação de idade no celular, onde o alvo
 * de toque maior importa.
 */
const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitives.Root
    className={cn(
      "peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border transition-colors",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bee-pink focus-visible:ring-offset-2 focus-visible:ring-offset-bee-bg",
      "disabled:cursor-not-allowed disabled:opacity-50",
      "data-[state=unchecked]:border-white/10 data-[state=unchecked]:bg-white/[0.07]",
      "data-[state=checked]:border-[#4ade80]/35 data-[state=checked]:bg-[#4ade80]/20",
      className
    )}
    {...props}
    ref={ref}
  >
    <SwitchPrimitives.Thumb
      className={cn(
        "pointer-events-none block h-4 w-4 rounded-full shadow-lg ring-0 transition-transform",
        "translate-x-1 data-[state=checked]:translate-x-6",
        "data-[state=unchecked]:bg-[#555]",
        "data-[state=checked]:bg-[#4ade80] data-[state=checked]:shadow-[0_0_8px_rgba(74,222,128,0.6)]"
      )}
    />
  </SwitchPrimitives.Root>
))
Switch.displayName = SwitchPrimitives.Root.displayName

export { Switch }
