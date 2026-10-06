"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Mail, Lock, Eye, EyeOff, Loader2, XCircle } from "lucide-react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CartaoDeAuth } from "@/components/auth/CartaoDeAuth";
import { api, ApiError } from "@/lib/api/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  /**
   * Login de verdade.
   *
   * O que havia aqui: um `setTimeout` de 1,5 s comparando o email com a string
   * `bella@beesocial.app` e a senha com `123456`, dentro do código que vai para
   * o navegador. Qualquer pessoa lia a credencial no bundle, e o `router.push`
   * levava ao painel sem nenhuma sessão existir.
   *
   * Agora a resposta vem da API, que devolve o cookie `httpOnly` de sessão. O
   * `de` na query é para onde o middleware queria levar a pessoa antes de ela
   * ser mandada para cá.
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await api.login(email, password);
      // Lido de `window.location` dentro do handler, e não com
      // `useSearchParams()`: o hook obriga a página a ter fronteira de Suspense
      // (ou vira renderização dinâmica) e esta tela é estática. O valor só
      // interessa no momento do envio, quando o navegador já existe.
      const destino = new URLSearchParams(window.location.search).get("de");
      // `replace` e não `push`: com push, o botão "voltar" do navegador
      // devolveria a pessoa autenticada para a tela de login.
      router.replace(destino && destino.startsWith("/") ? destino : "/paginas");
    } catch (caught) {
      // A mensagem vem da API: ela é a única que sabe se foi credencial errada,
      // excesso de tentativas ou o serviço fora do ar.
      setError(caught instanceof ApiError ? caught.message : "Não foi possível entrar.");
      setLoading(false);
    }
  };

  return (
    <CartaoDeAuth>
      <h1 className="font-semibold text-[28px] text-white text-center mb-1">Bem-vinda de volta</h1>
      <p className="text-sm text-bee-muted text-center mb-8">Entre para gerenciar seus links</p>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="email" className="block text-sm text-white/60 mb-2">
            E-mail
          </label>
          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#555]" />
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              required
              className="pl-12 bg-bee-bg/60 border-white/[0.08] focus:border-bee-pink focus:ring-2 focus:ring-bee-pink/10 placeholder:text-[#444]"
            />
          </div>
        </div>

        <div>
          <label htmlFor="senha" className="block text-sm text-white/60 mb-2">
            Senha
          </label>
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#555]" />
            <Input
              id="senha"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Sua senha"
              required
              className="pl-12 pr-12 bg-bee-bg/60 border-white/[0.08] focus:border-bee-pink focus:ring-2 focus:ring-bee-pink/10 placeholder:text-[#444]"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? "Esconder senha" : "Mostrar senha"}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-[#555] hover:text-white transition-colors"
            >
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {error && (
          <div
            className="flex items-center gap-2 p-3 rounded-lg"
            style={{
              backgroundColor: "rgba(255, 60, 110, 0.1)",
              border: "1px solid rgba(255, 60, 110, 0.3)",
            }}
          >
            <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
            <p className="text-sm text-red-500">{error}</p>
          </div>
        )}

        {/* "Esqueci minha senha" saiu daqui: apontava para `#`, porque a
            recuperação de senha ainda não existe (ver README). Volta junto com
            ela. */}
        <Button
          type="submit"
          disabled={loading}
          className="w-full h-12 rounded-md bg-bee-pink hover:bg-bee-pink-hot text-white font-semibold glow-pink-sm"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Entrando...
            </>
          ) : (
            "Entrar"
          )}
        </Button>
      </form>

      <p className="text-center text-sm text-bee-muted mt-7">
        Não tem conta?{" "}
        <Link href="/cadastro" className="text-white hover:text-bee-pink font-medium transition-colors">
          Criar grátis
        </Link>
      </p>
    </CartaoDeAuth>
  );
}
