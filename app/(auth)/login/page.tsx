"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Mail, Lock, Eye, EyeOff, Loader2, XCircle } from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/shared/Logo";
import { HexBackground } from "@/components/shared/HexBackground";
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
      router.replace(destino && destino.startsWith("/") ? destino : "/links");
    } catch (caught) {
      // A mensagem vem da API: ela é a única que sabe se foi credencial errada,
      // excesso de tentativas ou o serviço fora do ar.
      setError(caught instanceof ApiError ? caught.message : "Não foi possível entrar.");
      setLoading(false);
    }
  };

  // Testimonials for decorative panel
  const testimonials = [
    {
      initials: "BL",
      stars: 5,
      text: "Aumentei meus ganhos em 180%! Melhor plataforma!",
      name: "Bella L.",
    },
    {
      initials: "MR",
      stars: 5,
      text: "O cloaking do Instagram é perfeito. Zero cliques perdidos.",
      name: "Maria R.",
    },
    {
      initials: "JC",
      stars: 5,
      text: "Interface linda e super fácil de usar!",
      name: "Júlia C.",
    },
  ];

  return (
    <div className="min-h-screen flex">
      {/* Left Panel - Form */}
      <div className="w-full lg:w-[45%] bg-bee-bg flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          {/* Logo */}
          <div className="mb-10 flex items-center">
            <Logo variant="full" size="lg" className="flex-shrink-0" />
          </div>

          {/* Title */}
          <h1 className="font-bebas text-[36px] uppercase text-white mb-2 tracking-wide">
            BEM-VINDA DE VOLTA
          </h1>
          <p className="text-sm text-bee-muted mb-8">
            Entre na sua conta para gerenciar seus links
          </p>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#555]" />
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                required
                className="pl-12 bg-bee-surface border-white/[0.08] focus:border-bee-pink focus:ring-2 focus:ring-bee-pink/10 placeholder:text-[#444]"
              />
            </div>

            {/* Password */}
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#555]" />
              <Input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Sua senha"
                required
                className="pl-12 pr-12 bg-bee-surface border-white/[0.08] focus:border-bee-pink focus:ring-2 focus:ring-bee-pink/10 placeholder:text-[#444]"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-[#555] hover:text-white transition-colors"
              >
                {showPassword ? (
                  <EyeOff className="w-5 h-5" />
                ) : (
                  <Eye className="w-5 h-5" />
                )}
              </button>
            </div>

            {/* Error Message */}
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

            {/* Forgot Password */}
            <div className="text-right">
              <Link
                href="#"
                className="text-sm text-bee-pink hover:text-bee-pink-hot transition-colors"
              >
                Esqueci minha senha
              </Link>
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-bee-pink hover:bg-bee-pink-hot text-white rounded-full font-barlow font-bold uppercase tracking-wide h-12 glow-pink-sm"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Entrando...
                </>
              ) : (
                "ENTRAR"
              )}
            </Button>
          </form>

          {/* Sign Up Link */}
          <p className="text-center text-sm text-bee-muted mt-6">
            Não tem conta?{" "}
            <Link
              href="/cadastro"
              className="text-bee-pink hover:text-bee-pink-hot font-medium transition-colors"
            >
              Criar grátis →
            </Link>
          </p>
        </div>
      </div>

      {/* Right Panel - Decorative (Desktop Only) */}
      <div className="hidden lg:flex lg:w-[55%] bg-[#111111] relative overflow-hidden items-center justify-center p-12">
        {/* Background */}
        <HexBackground density="medium" />

        {/* Content */}
        <div className="relative z-10 text-center">
          {/* Logo Hexagon */}
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="mx-auto mb-8"
          >
            <div
              className="relative w-[120px] h-[120px] mx-auto flex items-center justify-center"
              style={{
                filter: "drop-shadow(0 0 20px rgba(255, 60, 110, 0.4))",
              }}
            >
              <svg viewBox="0 0 100 100" className="w-full h-full" aria-hidden>
                <polygon
                  points="50,5 85,27.5 85,72.5 50,95 15,72.5 15,27.5"
                  stroke="#FF3C6E"
                  strokeWidth="2"
                  fill="rgba(255, 60, 110, 0.1)"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <Logo variant="icon" size="lg" />
              </div>
            </div>
          </motion.div>

          {/* Tagline */}
          <motion.h2
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="font-bebas text-[40px] uppercase text-white mb-12 tracking-wider text-glow"
          >
            FAÇA O SEU #BUZZ
          </motion.h2>

          {/* Testimonials */}
          <div className="space-y-4 max-w-md mx-auto">
            {testimonials.map((testimonial, index) => (
              <motion.div
                key={index}
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.5, delay: 0.4 + index * 0.1 }}
              >
                <motion.div
                  animate={{
                    y: [0, -8, 0],
                  }}
                  transition={{
                    duration: 3,
                    repeat: Infinity,
                    delay: index * 0.3,
                    ease: "easeInOut",
                  }}
                  className="p-4 rounded-xl backdrop-blur-sm"
                  style={{
                    backgroundColor: "rgba(21, 21, 21, 0.8)",
                    border: "1px solid rgba(255, 60, 110, 0.2)",
                  }}
                >
                  <div className="flex items-start gap-3">
                    {/* Avatar */}
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center font-bebas text-sm flex-shrink-0"
                      style={{
                        background: "linear-gradient(135deg, #FF3C6E, #FF1F57)",
                      }}
                    >
                      {testimonial.initials}
                    </div>

                    {/* Content */}
                    <div className="flex-1 text-left">
                      {/* Stars */}
                      <div className="flex gap-0.5 mb-1">
                        {[...Array(testimonial.stars)].map((_, i) => (
                          <span key={i} className="text-bee-pink text-xs">
                            ★
                          </span>
                        ))}
                      </div>

                      {/* Text */}
                      <p className="text-xs text-white mb-1">
                        {testimonial.text}
                      </p>

                      {/* Name */}
                      <p className="text-[10px] text-bee-muted">
                        {testimonial.name}
                      </p>
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
