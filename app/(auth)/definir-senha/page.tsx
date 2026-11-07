"use client";

import React, { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, Loader2, Lock, MailWarning, XCircle } from "lucide-react";

import { CartaoDeAuth } from "@/components/auth/CartaoDeAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, ApiError } from "@/lib/api/client";
import { invalidateSession } from "@/lib/api/use-session";

/**
 * O destino do convite: a pessoa escolhe a própria senha. Ao salvar, a API
 * confirma o e-mail (o clique provou que é dela), abre a sessão e esta
 * tela manda direto para o painel — ela acabou de digitar a senha, pedir de
 * novo no login seria cerimônia.
 */
export default function DefinirSenhaPage() {
  return (
    <CartaoDeAuth>
      <Suspense fallback={null}>
        <Formulario />
      </Suspense>
    </CartaoDeAuth>
  );
}

function Formulario() {
  const router = useRouter();
  const token = useSearchParams().get("token") ?? "";
  const [senha, setSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [mostrar, setMostrar] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [linkMorto, setLinkMorto] = useState(!token);
  const [verificado, setVerificado] = useState(false);
  const [salvando, setSalvando] = useState(false);

  // Antes de mostrar o formulário: link vencido ou já usado é dito na hora,
  // não depois de a pessoa escolher a senha. Falha na checagem deixa passar;
  // o salvar repete a validação de verdade.
  useEffect(() => {
    if (!token) return;
    let cancelado = false;
    api
      .verificarLinkDeSenha(token)
      .then((r) => !cancelado && !r.valido && setLinkMorto(true))
      .catch(() => undefined)
      .finally(() => !cancelado && setVerificado(true));
    return () => {
      cancelado = true;
    };
  }, [token]);

  const pronta = senha.length >= 6 && senha === confirmacao;

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pronta) return;
    setSalvando(true);
    setErro(null);
    try {
      await api.definirSenha(token, senha);
      invalidateSession();
      router.replace("/paginas");
    } catch (caught) {
      const codigo = caught instanceof ApiError ? caught.code : "";
      if (codigo === "token_invalido" || codigo === "token_expirado") {
        setLinkMorto(true);
      } else {
        setErro(caught instanceof ApiError ? caught.message : "Não foi possível salvar a senha agora.");
      }
      setSalvando(false);
    }
  };

  if (!linkMorto && !verificado) {
    return (
      <div className="flex flex-col items-center py-8 text-bee-muted" role="status" aria-label="Conferindo o link">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  if (linkMorto) {
    return (
      <div className="text-center">
        <MailWarning className="w-12 h-12 mx-auto text-bee-muted" aria-hidden />
        <h1 className="mt-4 text-2xl font-bold text-white">Esse link não vale mais</h1>
        <p className="mt-2 text-sm text-bee-muted">
          O convite vale por 7 dias e só pode ser usado uma vez. Se a senha já foi criada, é só entrar. Se não, peça
          um convite novo à equipe.
        </p>
        <Link href="/login" className="block mt-6">
          <Button className="w-full h-12 rounded-md bg-bee-pink hover:bg-bee-pink-hot text-white font-semibold glow-pink-sm">Entrar</Button>
        </Link>
      </div>
    );
  }

  return (
    <>
      <h1 className="font-semibold text-[28px] text-white text-center mb-1">Crie a sua senha</h1>
      <p className="text-sm text-bee-muted text-center mb-8">A equipe criou a sua conta. Escolha a senha e entre.</p>

      <form onSubmit={salvar} className="space-y-5">
        <div>
          <label htmlFor="senha" className="block text-sm text-white/60 mb-2">
            Senha (6 a 72 caracteres)
          </label>
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#555]" />
            <Input
              id="senha"
              type={mostrar ? "text" : "password"}
              autoComplete="new-password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder="Crie uma senha"
              required
              minLength={6}
              maxLength={72}
              className="pl-12 pr-12 bg-bee-bg/60 border-white/[0.08] focus:border-bee-pink focus:ring-2 focus:ring-bee-pink/10 placeholder:text-[#444]"
            />
            <button
              type="button"
              onClick={() => setMostrar(!mostrar)}
              aria-label={mostrar ? "Esconder senha" : "Mostrar senha"}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-[#555] hover:text-white transition-colors"
            >
              {mostrar ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
        </div>

        <div>
          <label htmlFor="confirmacao" className="block text-sm text-white/60 mb-2">
            Repita a senha
          </label>
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#555]" />
            <Input
              id="confirmacao"
              type={mostrar ? "text" : "password"}
              autoComplete="new-password"
              value={confirmacao}
              onChange={(e) => setConfirmacao(e.target.value)}
              placeholder="Confirme sua senha"
              required
              className="pl-12 bg-bee-bg/60 border-white/[0.08] focus:border-bee-pink focus:ring-2 focus:ring-bee-pink/10 placeholder:text-[#444]"
            />
          </div>
          {confirmacao && confirmacao !== senha && <p className="mt-2 text-xs text-red-400">As senhas não são iguais.</p>}
        </div>

        {erro && (
          <div className="flex items-center gap-2 p-3 rounded-lg" style={{ backgroundColor: "rgba(255, 60, 110, 0.1)", border: "1px solid rgba(255, 60, 110, 0.3)" }}>
            <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
            <p className="text-sm text-red-500">{erro}</p>
          </div>
        )}

        <Button
          type="submit"
          disabled={!pronta || salvando}
          className="w-full h-12 rounded-md bg-bee-pink hover:bg-bee-pink-hot text-white font-semibold glow-pink-sm disabled:opacity-50"
        >
          {salvando ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Salvando…
            </>
          ) : (
            "Salvar senha e entrar"
          )}
        </Button>
      </form>
    </>
  );
}
