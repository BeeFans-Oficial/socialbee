import React from "react";

import { cn } from "@/lib/utils";

/**
 * Esqueletos: a forma do conteúdo enquanto ele carrega.
 *
 * Em vez de um spinner no meio da tela (que não diz o que vai aparecer e faz
 * o layout pular quando chega), cada tela desenha os seus blocos na posição
 * final. O brilho varre da esquerda para a direita a cada 1,6 s — o único
 * movimento contínuo permitido no painel, e só enquanto se espera.
 *
 * Os blocos só aparecem depois de 120 ms (`animation-delay` em `.esqueleto`):
 * uma resposta que chega antes disso não pisca esqueleto nenhum.
 */
export function Esqueleto({ className }: { className?: string }) {
  return <div aria-hidden className={cn("esqueleto rounded-lg", className)} />;
}

/** Uma lista de linhas, como a de Links. */
export function EsqueletoDeLinhas({ linhas = 5 }: { linhas?: number }) {
  return (
    <div className="space-y-3" role="status" aria-label="Carregando" data-esqueleto>
      {Array.from({ length: linhas }, (_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3 rounded-xl border border-bee-line bg-bee-surface">
          <Esqueleto className="w-4 h-4 rounded" />
          <Esqueleto className="w-9 h-9" />
          <div className="flex-1 space-y-2">
            <Esqueleto className="h-3.5 w-1/2 max-w-[180px]" />
            <Esqueleto className="h-3 w-1/3 max-w-[120px]" />
          </div>
          <Esqueleto className="hidden sm:block w-12 h-7" />
          <Esqueleto className="w-9 h-5 rounded-full" />
        </div>
      ))}
    </div>
  );
}

/** Uma grade de cartões, como a de Páginas. */
export function EsqueletoDeCartoes({ cartoes = 2 }: { cartoes?: number }) {
  return (
    <div className="grid gap-5 md:grid-cols-2" role="status" aria-label="Carregando" data-esqueleto>
      {Array.from({ length: cartoes }, (_, i) => (
        <div key={i} className="rounded-2xl border border-bee-line bg-bee-surface overflow-hidden">
          <Esqueleto className="h-44 rounded-none" />
          <div className="p-5 space-y-3">
            <Esqueleto className="h-4 w-1/2" />
            <Esqueleto className="h-7 w-2/3 rounded-full" />
            <div className="pt-4 border-t border-bee-line flex gap-2">
              <Esqueleto className="h-9 w-28 rounded-full" />
              <Esqueleto className="h-9 w-20 rounded-full" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/** O editor: o celular à esquerda e as linhas do painel à direita. */
export function EsqueletoDeEditor() {
  return (
    <div className="flex flex-col lg:flex-row" role="status" aria-label="Carregando o editor" data-esqueleto>
      <section className="hidden lg:flex flex-1 flex-col items-center px-4 py-5 lg:h-[calc(100dvh-4rem)]">
        <Esqueleto className="h-10 w-64 rounded-full" />
        <Esqueleto className="mt-5 h-[min(calc(100dvh-13.5rem),900px)] min-h-[520px] aspect-[440/956] rounded-[68px]" />
      </section>
      <aside className="w-full lg:w-[380px] lg:flex-shrink-0 border-l border-bee-line bg-bee-panel pb-10">
        <div className="h-14 lg:h-16 px-4 flex items-center gap-3 border-b border-bee-line">
          <Esqueleto className="w-9 h-9" />
          <Esqueleto className="h-4 w-32" />
        </div>
        <div className="px-4 py-4 border-b border-bee-line space-y-3">
          <Esqueleto className="h-3.5 w-3/4" />
          <Esqueleto className="h-11 w-full rounded-xl" />
        </div>
        {[4, 3, 5].map((linhas, s) => (
          <div key={s} className="px-4 pt-6 pb-2 space-y-3">
            <Esqueleto className="h-3 w-16" />
            {Array.from({ length: linhas }, (_, i) => (
              <div key={i} className="flex items-center justify-between py-1">
                <Esqueleto className="h-4 w-28" />
                <Esqueleto className="h-4 w-20" />
              </div>
            ))}
          </div>
        ))}
      </aside>
    </div>
  );
}
