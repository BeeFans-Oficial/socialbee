"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  Loader2,
  User,
  CheckCircle2,
  XCircle,
  Check,
} from "lucide-react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Logo } from "@/components/shared/Logo";
import { HexBackground } from "@/components/shared/HexBackground";
import { PhoneMockup } from "@/components/shared/PhoneMockup";
import { toast, Toaster } from "sonner";
import { validateSlug, isSlugTaken, slugify } from "@/lib/utils";
import { cn } from "@/lib/utils";

export default function CadastroPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);

  // Step 1 fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [ageConfirmed, setAgeConfirmed] = useState(false);

  // Step 2 fields
  const [displayName, setDisplayName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugStatus, setSlugStatus] = useState<
    "idle" | "checking" | "valid" | "invalid" | "taken"
  >("idle");
  const [isAdult, setIsAdult] = useState(false);

  const [loading, setLoading] = useState(false);

  // Password strength
  const getPasswordStrength = (pass: string) => {
    if (!pass) return 0;
    let strength = 0;
    if (pass.length >= 6) strength++;
    if (pass.length >= 10) strength++;
    if (/[a-z]/.test(pass) && /[A-Z]/.test(pass)) strength++;
    if (/\d/.test(pass)) strength++;
    if (/[^a-zA-Z\d]/.test(pass)) strength++;
    return Math.min(strength, 4);
  };

  const passwordStrength = getPasswordStrength(password);
  const strengthLabels = ["", "Muito fraca", "Fraca", "Média", "Forte", "Excelente"];
  const strengthColors = [
    "#1e1e1e",
    "#ef4444",
    "#f97316",
    "#eab308",
    "#22c55e",
    "#FF3C6E",
  ];

  // Slug validation debounce
  useEffect(() => {
    if (!slug || step !== 2) {
      setSlugStatus("idle");
      return;
    }

    setSlugStatus("checking");
    const timer = setTimeout(() => {
      if (!validateSlug(slug)) {
        setSlugStatus("invalid");
      } else if (isSlugTaken(slug)) {
        setSlugStatus("taken");
      } else {
        setSlugStatus("valid");
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [slug, step]);

  // Step 1 validation
  const canProceedStep1 =
    email &&
    password.length >= 6 &&
    confirmPassword === password &&
    ageConfirmed;

  // Step 2 validation
  const canProceedStep2 = displayName && slugStatus === "valid";

  const handleStep1Submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (canProceedStep1) {
      setStep(2);
    }
  };

  const handleStep2Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canProceedStep2) return;

    setLoading(true);

    setTimeout(() => {
      toast.success("Conta criada! Bem-vinda ao BeeSocial 🎉");
      setTimeout(() => {
        router.push("/links");
      }, 1000);
    }, 1500);
  };

  // Features list
  const features = [
    "LINKS ILIMITADOS",
    "CLOAKING INSTAGRAM",
    "ANALYTICS COMPLETO",
    "GRÁTIS PARA SEMPRE",
  ];

  return (
    <>
      <Toaster position="top-center" richColors />
      <div className="min-h-screen flex">
        {/* Left Panel - Form */}
        <div className="w-full lg:w-[45%] bg-bee-bg flex items-center justify-center p-8">
          <div className="w-full max-w-md">
            {/* Logo */}
            <div className="mb-8">
              <Logo variant="full" size="md" />
            </div>

            {/* Progress Bar */}
            <div className="mb-8">
              <div className="flex items-center gap-2">
                <div className="flex-1 flex items-center gap-2">
                  {/* Step 1 */}
                  <div
                    className={cn(
                      "flex-1 h-2 rounded-full transition-all",
                      step >= 1 ? "bg-bee-pink" : "bg-bee-surface"
                    )}
                  />
                  {/* Connector */}
                  <div
                    className={cn(
                      "w-8 h-2 rounded-full transition-all",
                      step >= 2 ? "bg-bee-pink" : "bg-bee-surface"
                    )}
                  />
                  {/* Step 2 */}
                  <div
                    className={cn(
                      "flex-1 h-2 rounded-full transition-all",
                      step >= 2 ? "bg-bee-pink" : "bg-bee-surface"
                    )}
                  />
                </div>
              </div>
              <div className="flex justify-between mt-2">
                <span className="text-xs text-bee-muted">Sua Conta</span>
                <span className="text-xs text-bee-muted">Seu Perfil</span>
              </div>
            </div>

            <AnimatePresence mode="wait">
              {/* STEP 1 */}
              {step === 1 && (
                <motion.div
                  key="step1"
                  initial={{ x: 20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: -20, opacity: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  {/* Title */}
                  <h1 className="font-bebas text-[36px] uppercase text-white mb-2 tracking-wide">
                    CRIAR SUA CONTA
                  </h1>
                  <p className="text-sm text-bee-muted mb-8">
                    Comece grátis em menos de 1 minuto
                  </p>

                  {/* Form */}
                  <form onSubmit={handleStep1Submit} className="space-y-4">
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
                    <div>
                      <div className="relative">
                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#555]" />
                        <Input
                          type={showPassword ? "text" : "password"}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="Crie uma senha"
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

                      {/* Password Strength */}
                      {password && (
                        <div className="mt-2">
                          <div className="flex gap-1 mb-1">
                            {[1, 2, 3, 4].map((level) => (
                              <div
                                key={level}
                                className="flex-1 h-1 rounded-full transition-all"
                                style={{
                                  backgroundColor:
                                    passwordStrength >= level
                                      ? strengthColors[passwordStrength]
                                      : "#1e1e1e",
                                }}
                              />
                            ))}
                          </div>
                          <p
                            className="text-xs"
                            style={{
                              color:
                                passwordStrength > 0
                                  ? strengthColors[passwordStrength]
                                  : "#555",
                            }}
                          >
                            {strengthLabels[passwordStrength]}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Confirm Password */}
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#555]" />
                      <Input
                        type={showConfirmPassword ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Confirme sua senha"
                        required
                        className="pl-12 pr-12 bg-bee-surface border-white/[0.08] focus:border-bee-pink focus:ring-2 focus:ring-bee-pink/10 placeholder:text-[#444]"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-[#555] hover:text-white transition-colors"
                      >
                        {showConfirmPassword ? (
                          <EyeOff className="w-5 h-5" />
                        ) : (
                          <Eye className="w-5 h-5" />
                        )}
                      </button>
                      {confirmPassword && confirmPassword === password && (
                        <CheckCircle2 className="absolute right-12 top-1/2 -translate-y-1/2 w-5 h-5 text-green-500" />
                      )}
                    </div>

                    {/* Age Confirmation */}
                    <div className="flex items-start gap-3 p-4 rounded-lg bg-bee-surface">
                      <Switch
                        checked={ageConfirmed}
                        onCheckedChange={setAgeConfirmed}
                      />
                      <label className="text-sm text-white cursor-pointer flex-1">
                        Confirmo que tenho 18 anos ou mais
                      </label>
                    </div>

                    {/* Submit Button */}
                    <Button
                      type="submit"
                      disabled={!canProceedStep1}
                      className="w-full bg-bee-pink hover:bg-bee-pink-hot text-white rounded-full font-barlow font-bold uppercase tracking-wide h-12 glow-pink-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      CONTINUAR →
                    </Button>
                  </form>

                  {/* Login Link */}
                  <p className="text-center text-sm text-bee-muted mt-6">
                    Já tem conta?{" "}
                    <Link
                      href="/login"
                      className="text-bee-pink hover:text-bee-pink-hot font-medium transition-colors"
                    >
                      Entrar
                    </Link>
                  </p>
                </motion.div>
              )}

              {/* STEP 2 */}
              {step === 2 && (
                <motion.div
                  key="step2"
                  initial={{ x: 20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: -20, opacity: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  {/* Title */}
                  <h1 className="font-bebas text-[36px] uppercase text-white mb-2 tracking-wide">
                    SEU PERFIL
                  </h1>
                  <p className="text-sm text-bee-muted mb-8">
                    Personalize seu perfil BeeSocial
                  </p>

                  {/* Form */}
                  <form onSubmit={handleStep2Submit} className="space-y-4">
                    {/* Display Name */}
                    <div className="relative">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#555]" />
                      <Input
                        type="text"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder="Seu nome de exibição"
                        required
                        className="pl-12 bg-bee-surface border-white/[0.08] focus:border-bee-pink focus:ring-2 focus:ring-bee-pink/10 placeholder:text-[#444]"
                      />
                    </div>

                    {/* Username */}
                    <div>
                      <label className="block text-sm font-medium text-white mb-2">
                        Seu link único
                      </label>
                      <div className="flex items-center gap-2">
                        <span className="px-3 py-2 rounded-lg bg-bee-surface2 text-bee-muted text-sm border border-white/[0.08]">
                          beesocial.app/
                        </span>
                        <div className="flex-1 relative">
                          <Input
                            type="text"
                            value={slug}
                            onChange={(e) => setSlug(slugify(e.target.value))}
                            placeholder="usuario"
                            required
                            className="bg-bee-surface border-white/[0.08] focus:border-bee-pink focus:ring-2 focus:ring-bee-pink/10 placeholder:text-[#444] pr-10"
                          />
                          {/* Status Icon */}
                          <div className="absolute right-3 top-1/2 -translate-y-1/2">
                            {slugStatus === "checking" && (
                              <Loader2 className="w-4 h-4 text-bee-muted animate-spin" />
                            )}
                            {slugStatus === "valid" && (
                              <CheckCircle2 className="w-4 h-4 text-green-500" />
                            )}
                            {(slugStatus === "invalid" || slugStatus === "taken") && (
                              <XCircle className="w-4 h-4 text-red-500" />
                            )}
                          </div>
                        </div>
                      </div>
                      {/* Status Message */}
                      {slugStatus === "valid" && (
                        <p className="text-xs text-green-500 mt-1.5">
                          ✓ Disponível!
                        </p>
                      )}
                      {slugStatus === "taken" && (
                        <p className="text-xs text-red-500 mt-1.5">
                          ✗ Já utilizado
                        </p>
                      )}
                      {slugStatus === "invalid" && (
                        <p className="text-xs text-orange-500 mt-1.5">
                          Use apenas letras, números e -
                        </p>
                      )}
                      {slug && slugStatus === "valid" && (
                        <p className="text-xs text-bee-muted mt-1.5">
                          Sua URL: beesocial.app/{slug}
                        </p>
                      )}
                    </div>

                    {/* Adult Content Toggle */}
                    <div className="flex items-start gap-3 p-4 rounded-lg bg-bee-surface">
                      <Switch checked={isAdult} onCheckedChange={setIsAdult} />
                      <div className="flex-1">
                        <div className="text-sm font-medium text-white mb-1">
                          Meu conteúdo é adulto (+18)
                        </div>
                        <p className="text-xs text-bee-muted">
                          Ativa verificação de idade no seu perfil
                        </p>
                      </div>
                    </div>

                    {/* Submit Buttons */}
                    <div className="flex gap-3">
                      <Button
                        type="button"
                        onClick={() => setStep(1)}
                        variant="ghost"
                        className="flex-1"
                      >
                        Voltar
                      </Button>
                      <Button
                        type="submit"
                        disabled={!canProceedStep2 || loading}
                        className="flex-1 bg-bee-pink hover:bg-bee-pink-hot text-white rounded-full font-barlow font-bold uppercase tracking-wide h-12 glow-pink-sm disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {loading ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Criando...
                          </>
                        ) : (
                          "CRIAR MINHA CONTA →"
                        )}
                      </Button>
                    </div>
                  </form>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Right Panel - Decorative (Desktop Only) */}
        <div className="hidden lg:flex lg:w-[55%] bg-[#111111] relative overflow-hidden items-center justify-center p-12">
          {/* Background */}
          <HexBackground density="medium" />

          {/* Content */}
          <div className="relative z-10">
            {/* Features List */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5 }}
              className="mb-12 space-y-4"
            >
              {features.map((feature, index) => (
                <motion.div
                  key={feature}
                  initial={{ x: -20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                  className="flex items-center gap-3"
                >
                  <div className="w-8 h-8 rounded-full bg-bee-pink/20 flex items-center justify-center">
                    <Check className="w-5 h-5 text-bee-pink" />
                  </div>
                  <span className="font-bebas text-xl text-white tracking-wide">
                    {feature}
                  </span>
                </motion.div>
              ))}
            </motion.div>

            {/* Phone Mockup */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.5 }}
              className="flex justify-center"
            >
              <PhoneMockup
                themeBg="#0d0d0d"
                themeAccent="#FF3C6E"
                avatarUrl={null}
                displayName={displayName || "Seu Nome"}
                bio="Conteúdo exclusivo para quem quer mais 🔥"
                buttonStyle="soft"
                showAgeBadge={isAdult}
              />
            </motion.div>
          </div>
        </div>
      </div>
    </>
  );
}
