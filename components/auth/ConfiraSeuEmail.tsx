"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Loader2, MailCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api/client";

/**
 * Depois do cadastro: a conta existe, a sessão não. Só o clique no link do
 * e-mail abre a porta, e esta tela diz isso sem rodeio, com o reenvio ao
 * alcance — o motivo número um de não confirmar é o e-mail no spam.
 */
export function ConfiraSeuEmail({ email }: { email: string }) {
  return (
    <div className="text-center">
      <MailCheck className="w-12 h-12 mx-auto text-bee-pink" aria-hidden />
      <h1 className="mt-4 text-2xl font-bold text-white">Confira seu e-mail</h1>
      <p className="mt-2 text-sm text-bee-muted">
        Enviamos um link para <span className="text-white">{email}</span>. Clique nele para confirmar e entrar.
        O link vale por 24 horas.
      </p>
      <p className="mt-3 text-xs text-bee-muted">Não chegou? Olhe o spam e a aba Promoções.</p>
      <div className="mt-6 space-y-3">
        <BotaoReenviar email={email} />
        <Link href="/login" className="block text-sm text-bee-muted hover:text-white transition-colors">
          Já confirmei, quero entrar
        </Link>
      </div>
    </div>
  );
}

/** Reenvia pelo e-mail, sem sessão. A API responde igual para e-mail
 *  desconhecido, então a tela não tem como (nem deve) distinguir. */
export function BotaoReenviar({ email, className }: { email: string; className?: string }) {
  const [estado, setEstado] = useState<"parado" | "enviando" | "enviado">("parado");
  const [aviso, setAviso] = useState<string | null>(null);

  const reenviar = async () => {
    setEstado("enviando");
    setAviso(null);
    try {
      await api.reenviarConfirmacao(email);
      setEstado("enviado");
    } catch (caught) {
      setEstado("parado");
      setAviso(
        caught instanceof ApiError && caught.status === 429
          ? "Já reenviamos há pouco. Espere alguns minutos e olhe o spam."
          : "Não foi possível reenviar agora. Tente de novo em instantes.",
      );
    }
  };

  return (
    <div className={className}>
      <Button
        type="button"
        variant="ghost"
        disabled={estado !== "parado" || !email}
        onClick={() => void reenviar()}
        className="w-full h-11 rounded-md border border-white/15 text-white hover:border-white/30 disabled:opacity-60"
      >
        {estado === "enviando" && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
        {estado === "enviado" ? "E-mail reenviado" : "Reenviar e-mail"}
      </Button>
      {aviso && <p className="mt-2 text-xs text-red-400">{aviso}</p>}
    </div>
  );
}
