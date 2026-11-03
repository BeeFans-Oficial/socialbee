import React from "react";
import { Toaster } from "sonner";

import { Shell } from "@/components/painel/Shell";

/**
 * O painel inteiro — listas E editores — dentro da mesma casca.
 *
 * Antes havia seis `layout.tsx` re-exportando um mesmo layout, e os editores
 * de página e de link ficavam fora dele, em tela cheia: a criadora perdia a
 * navegação ao entrar num editor e só saía pela seta de voltar. Agora a casca
 * é uma só (`Shell`): barra lateral no computador, barra inferior no celular,
 * e a barra do topo com a página que está sendo editada. Nos editores a barra
 * lateral encolhe para dar espaço à prévia, mas continua lá.
 *
 * O `Toaster` mora aqui, uma vez, em vez de ser montado em cada tela.
 */
export default function PainelLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Toaster position="top-center" richColors />
      <Shell>{children}</Shell>
    </>
  );
}
