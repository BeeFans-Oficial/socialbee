"use client";

import { useEffect, useState } from "react";
import { animate, useMotionValue, useReducedMotion } from "framer-motion";

import { SUAVE } from "@/lib/movimento";

/**
 * Um número que conta até o valor, em vez de aparecer pronto.
 *
 * É a animação do "hero metric" do relatório: o olho acompanha o número
 * subir e entende que ele acabou de chegar. Dura 0,8 s — mais que isso e a
 * pessoa espera o número parar para ler. Com movimento reduzido, mostra o
 * valor direto.
 *
 * `formatar` recebe o valor intermediário e devolve o texto (inteiro
 * abreviado, duas casas, o que a tela precisar).
 */
export function NumeroAnimado({
  valor,
  formatar = (n) => Math.round(n).toLocaleString("pt-BR"),
  className,
}: {
  valor: number;
  formatar?: (n: number) => string;
  className?: string;
}) {
  const reduzido = useReducedMotion();
  const mv = useMotionValue(0);
  const [texto, setTexto] = useState(() => formatar(reduzido ? valor : 0));

  useEffect(() => {
    if (reduzido) {
      setTexto(formatar(valor));
      return;
    }
    const controle = animate(mv, valor, {
      duration: 0.8,
      ease: SUAVE,
      onUpdate: (v) => setTexto(formatar(v)),
    });
    return () => controle.stop();
    // `formatar` costuma ser uma arrow nova a cada render; reanimar por isso
    // faria o número piscar a cada atualização de estado da tela.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valor, reduzido, mv]);

  return (
    <span className={className} aria-live="off">
      {texto}
    </span>
  );
}
