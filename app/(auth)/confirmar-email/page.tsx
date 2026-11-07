"use client";

import React, { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Loader2, MailWarning } from "lucide-react";

import { CartaoDeAuth } from "@/components/auth/CartaoDeAuth";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api/client";
import { invalidateSession } from "@/lib/api/use-session";

/**
 * O destino do link do e-mail de boas-vindas.
 *
 * Pública: quem clica pode estar em outro aparelho, sem sessão. Chama a API
 * uma vez e mostra o resultado; não há formulário. Link vencido manda para
 * o painel, onde o botão de reenviar vive (`Configurações`), porque só ali
 * se sabe de quem é a conta.
 */
export default function ConfirmarEmailPage() {
  return (
    <CartaoDeAuth>
      <Suspense fallback={<Aguardando />}>
        <Confirmacao />
      </Suspense>
    </CartaoDeAuth>
  );
}

type Estado = { tipo: "aguardando" } | { tipo: "ok"; email: string; jaConfirmado: boolean } | { tipo: "erro"; codigo: string; mensagem: string };

function Confirmacao() {
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const [estado, setEstado] = useState<Estado>({ tipo: "aguardando" });

  useEffect(() => {
    if (!token) {
      setEstado({ tipo: "erro", codigo: "token_invalido", mensagem: "Esse link não é válido." });
      return;
    }
    let cancelado = false;
    api
      .confirmarEmail(token)
      .then((r) => {
        if (cancelado) return;
        setEstado({ tipo: "ok", ...r });
        // Se a pessoa está logada neste navegador, a faixa do painel some.
        invalidateSession();
      })
      .catch((caught) => {
        if (cancelado) return;
        setEstado({
          tipo: "erro",
          codigo: caught instanceof ApiError ? caught.code : "desconhecido",
          mensagem: caught instanceof ApiError ? caught.message : "Não foi possível confirmar agora. Tente de novo em instantes.",
        });
      });
    return () => {
      cancelado = true;
    };
  }, [token]);

  if (estado.tipo === "aguardando") return <Aguardando />;

  if (estado.tipo === "ok") {
    return (
      <div className="text-center">
        <CheckCircle2 className="w-12 h-12 mx-auto text-bee-pink" aria-hidden />
        <h1 className="mt-4 text-2xl font-bold text-white">{estado.jaConfirmado ? "Já estava confirmado" : "E-mail confirmado"}</h1>
        <p className="mt-2 text-sm text-bee-muted">
          <span className="text-white">{estado.email}</span> é seu. Entre com a sua senha e monte a página.
        </p>
        <Link href="/login" className="block mt-6">
          <Button className="w-full h-12 rounded-md bg-bee-pink hover:bg-bee-pink-hot text-white font-semibold glow-pink-sm">Entrar</Button>
        </Link>
      </div>
    );
  }

  const vencido = estado.codigo === "token_expirado";
  return (
    <div className="text-center">
      <MailWarning className="w-12 h-12 mx-auto text-bee-muted" aria-hidden />
      <h1 className="mt-4 text-2xl font-bold text-white">{vencido ? "Esse link venceu" : "Esse link não é válido"}</h1>
      <p className="mt-2 text-sm text-bee-muted">
        {vencido
          ? "O link do e-mail vale por 24 horas. Tente entrar: a tela de login reenvia um novo."
          : "Confira se o endereço foi copiado inteiro. Se já tiver confirmado antes, é só entrar."}
      </p>
      <Link href="/login" className="block mt-6">
        <Button className="w-full h-12 rounded-md bg-bee-pink hover:bg-bee-pink-hot text-white font-semibold glow-pink-sm">Entrar</Button>
      </Link>
    </div>
  );
}

function Aguardando() {
  return (
    <div className="flex flex-col items-center py-8 text-bee-muted" role="status" aria-label="Confirmando">
      <Loader2 className="w-6 h-6 animate-spin" />
      <span className="mt-3 text-sm">Confirmando…</span>
    </div>
  );
}
