"use client";

import React, { useRef, useState } from "react";
import { Loader2 } from "lucide-react";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

/**
 * O último valor não nulo.
 *
 * Um diálogo que fecha com animação continua na tela por 200 ms depois de
 * `aberto` virar falso — e nesse instante a tela já zerou "o que" estava
 * sendo apagado. Sem isto, o título virava `Apagar ""?` no meio do fade.
 */
export function useUltimo<T>(valor: T | null | undefined): T | null {
  const ultimo = useRef<T | null>(null);
  if (valor !== null && valor !== undefined) ultimo.current = valor;
  return ultimo.current;
}

/**
 * Confirmação de uma exclusão simples, no lugar do `window.confirm` nativo:
 * o diálogo do navegador não diz O QUE vai sumir, não segue o visual do
 * painel e, no celular, aparece como um aviso de sistema.
 *
 * Para exclusões que levam muita coisa junto (uma página inteira), a tela
 * continua pedindo o endereço digitado — ver `ApagarPagina`.
 */
export function ConfirmarExclusao({
  aberto,
  titulo,
  descricao,
  rotulo = "Apagar",
  onFechar,
  onConfirmar,
}: {
  aberto: boolean;
  titulo: string;
  descricao: React.ReactNode;
  rotulo?: string;
  onFechar: () => void;
  onConfirmar: () => Promise<void> | void;
}) {
  const [executando, setExecutando] = useState(false);
  // Enquanto fecha, mostra o que mostrava ao abrir.
  const exibido = useRef({ titulo, descricao });
  if (aberto) exibido.current = { titulo, descricao };

  const confirmar = async () => {
    setExecutando(true);
    try {
      await onConfirmar();
      onFechar();
    } finally {
      setExecutando(false);
    }
  };

  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && !executando && onFechar()}>
      <DialogContent className="bg-bee-surface border-white/10 max-w-md">
        <DialogTitle className="text-white">{exibido.current.titulo}</DialogTitle>
        <p className="text-sm text-bee-muted">{exibido.current.descricao}</p>
        <div className="flex gap-2">
          <button
            onClick={onFechar}
            disabled={executando}
            className="flex-1 h-11 rounded-lg border border-white/15 text-sm text-white/80 hover:text-white hover:border-white/30 transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={() => void confirmar()}
            disabled={executando}
            className="flex-1 h-11 rounded-lg bg-red-500/90 hover:bg-red-500 text-white text-sm font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {executando && <Loader2 className="w-4 h-4 animate-spin" />}
            {rotulo}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
