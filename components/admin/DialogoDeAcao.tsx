"use client";

import React, { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/**
 * Diálogo de uma ação de admin: o que vai acontecer, os campos da ação e o
 * MOTIVO, obrigatório em todas. O motivo vai para `admin_actions` e é a única
 * resposta, daqui a seis meses, para "por que fizeram isso nesta conta?".
 *
 * Tema claro, como o resto do admin (ver `Ui.tsx`).
 */
export function DialogoDeAcao({
  aberto,
  titulo,
  descricao,
  rotulo,
  perigo,
  campos,
  onFechar,
  onConfirmar,
}: {
  aberto: boolean;
  titulo: string;
  descricao: React.ReactNode;
  rotulo: string;
  /** Ação que tira algo de alguém: botão vermelho. */
  perigo?: boolean;
  /** Campos extras, desenhados acima do motivo. */
  campos?: React.ReactNode;
  onFechar: () => void;
  /** Recebe o motivo; lança para manter o diálogo aberto com a mensagem. */
  onConfirmar: (motivo: string) => Promise<void>;
}) {
  const [motivo, setMotivo] = useState("");
  const [executando, setExecutando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (aberto) {
      setMotivo("");
      setErro(null);
    }
  }, [aberto]);

  const confirmar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (motivo.trim().length < 3) {
      setErro("Escreva o motivo (pelo menos 3 letras).");
      return;
    }
    setExecutando(true);
    setErro(null);
    try {
      await onConfirmar(motivo.trim());
      onFechar();
    } catch (caught) {
      setErro(caught instanceof Error ? caught.message : "Não foi possível concluir.");
    } finally {
      setExecutando(false);
    }
  };

  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && !executando && onFechar()}>
      <DialogContent className="bg-admin-card border-admin-line text-admin-ink max-w-md" style={{ colorScheme: "light" }}>
        <DialogTitle className="text-admin-ink">{titulo}</DialogTitle>
        <p className="text-sm text-admin-muted">{descricao}</p>
        <form onSubmit={confirmar} className="space-y-3">
          {campos}
          <label className="block">
            <span className="block mb-1.5 text-xs text-admin-muted">Motivo (fica registrado na auditoria)</span>
            <textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              maxLength={500}
              rows={3}
              autoFocus
              placeholder="Ex.: parceria com a agência X até o fim do ano"
              className="w-full px-3 py-2 rounded-lg bg-admin-card border border-admin-line text-sm text-admin-ink placeholder:text-admin-faint focus:outline-none focus:border-admin-accent focus:ring-2 focus:ring-admin-accent/20"
            />
          </label>
          {erro && <p className="text-xs text-admin-danger">{erro}</p>}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onFechar}
              disabled={executando}
              className="flex-1 h-11 rounded-lg border border-admin-line text-sm text-admin-ink/85 hover:bg-admin-hover transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={executando}
              className={cn(
                "flex-1 h-11 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2",
                perigo ? "bg-admin-danger hover:bg-admin-danger-hover text-white" : "bg-admin-primary hover:bg-admin-primary-hover text-white",
              )}
            >
              {executando && <Loader2 className="w-4 h-4 animate-spin" />}
              {rotulo}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Campo com rótulo dos diálogos de ação. */
export function CampoDoDialogo({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block mb-1.5 text-xs text-admin-muted">{rotulo}</span>
      {children}
    </label>
  );
}
