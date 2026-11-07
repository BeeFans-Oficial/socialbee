"use client";

import React, { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, CheckCircle2, Loader2, Radar, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

import { api, ApiError } from "@/lib/api/client";
import type { ApiVerificacaoDeLink } from "@/lib/api/types";
import { DURACAO, SAIDA, SUAVE, TOQUE } from "@/lib/movimento";
import { cn } from "@/lib/utils";

/**
 * "Verificar destino" de um link, no editor de Links.
 *
 * Segue o botão como o navegador da Meta seguiria, até o host final, e diz
 * onde chega e com que régua: a mesma da saúde da página, para um link só
 * e na hora. Não grava nada; o registro é a checagem da página.
 */
export function VerificarDestino({ linkId, destino }: { linkId: string; destino: string }) {
  const [resultado, setResultado] = useState<ApiVerificacaoDeLink | null>(null);
  const [verificando, setVerificando] = useState(false);
  const [paraDestino, setParaDestino] = useState<string | null>(null);

  const verificar = async () => {
    setVerificando(true);
    try {
      const r = await api.verificarLink(linkId);
      setResultado(r);
      setParaDestino(destino);
    } catch (caught) {
      toast.error(caught instanceof ApiError && caught.status === 429 ? "Muitas verificações seguidas. Espere um minuto." : "Não foi possível verificar agora.");
    } finally {
      setVerificando(false);
    }
  };

  // O destino mudou depois da verificação: o resultado é de outro link.
  const valido = resultado && paraDestino === destino;
  const Icone = valido ? ICONE[resultado.estado] : Radar;

  return (
    <div className="px-1 pt-1 pb-3">
      <div className="flex items-center gap-2">
        <motion.button
          type="button"
          onClick={() => void verificar()}
          disabled={verificando}
          whileTap={TOQUE.whileTap}
          transition={TOQUE.transition}
          className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg border border-white/15 text-xs font-semibold text-white/85 hover:border-white/30 hover:text-white disabled:opacity-60 transition-colors"
        >
          {verificando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Radar className="w-3.5 h-3.5" />}
          {verificando ? "Seguindo o link…" : valido ? "Verificar de novo" : "Verificar destino"}
        </motion.button>
        {!valido && <span className="text-[11px] text-bee-dim">Segue o botão como a Meta seguiria, até o fim.</span>}
      </div>

      <AnimatePresence initial={false}>
        {valido && (
          <motion.div
            key={resultado.titulo}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0, transition: { duration: DURACAO.base, ease: SUAVE } }}
            exit={{ opacity: 0, transition: { duration: DURACAO.rapida, ease: SAIDA } }}
            className={cn("mt-3 rounded-lg border px-3 py-2.5 text-xs", BORDA[resultado.estado])}
            role="status"
          >
            <div className="flex items-start gap-2">
              <Icone className={cn("w-4 h-4 mt-px flex-shrink-0", COR[resultado.estado])} aria-hidden />
              <div className="min-w-0 space-y-1">
                <p className="text-sm text-white">{resultado.titulo}</p>
                <p className="text-bee-muted leading-relaxed">{resultado.detalhe}</p>
                {resultado.acao && <p className={cn("font-medium", COR[resultado.estado])}>{resultado.acao}</p>}
                {resultado.cadeia.saltos.length > 0 && (
                  <p className="font-mono text-[11px] text-bee-dim truncate">{["/r/…", ...resultado.cadeia.saltos].join(" → ")}</p>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const ICONE = { verde: CheckCircle2, amarelo: AlertTriangle, vermelho: ShieldAlert } as const;
const COR = { verde: "text-emerald-400", amarelo: "text-amber-400", vermelho: "text-red-400" } as const;
const BORDA = {
  verde: "border-emerald-400/30 bg-emerald-500/[0.06]",
  amarelo: "border-amber-400/30 bg-amber-500/[0.06]",
  vermelho: "border-red-400/30 bg-red-500/[0.06]",
} as const;
