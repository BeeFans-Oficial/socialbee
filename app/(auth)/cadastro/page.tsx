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
} from "lucide-react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { CartaoDeAuth } from "@/components/auth/CartaoDeAuth";
import { toast, Toaster } from "sonner";
import { validateSlug, slugify } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { api, ApiError } from "@/lib/api/client";

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

  // Endereço escolhido na busca da tela inicial (`/cadastro?slug=`). Lido no
  // efeito, e não com `useSearchParams`, para a página não precisar de um
  // `Suspense` só por isso. A disponibilidade é conferida de novo no passo 2.
  useEffect(() => {
    const vindo = new URLSearchParams(window.location.search).get("slug");
    if (vindo && validateSlug(slugify(vindo))) setSlug(slugify(vindo));
  }, []);

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

  /**
   * Disponibilidade do slug.
   *
   * Antes: `isSlugTaken` comparava com uma lista de sete nomes chumbada em
   * `lib/utils.ts` — que reservava "bella" e "luna" mas NÃO reservava as rotas
   * reais do app (`links`, `aparencia`, `analytics`, `configuracoes`). Quem se
   * cadastrasse com o slug `links` ficaria com um perfil público que o
   * dashboard sombreia para sempre.
   *
   * Agora quem responde é a API, que confere as três coisas de uma vez: formato,
   * lista de reservados (a de verdade, com as rotas) e perfil já existente.
   *
   * O `cancelado` no fecho existe porque as respostas podem chegar fora de
   * ordem: sem ele, a resposta de um slug já apagado sobrescreveria o estado do
   * slug que a pessoa está digitando agora.
   */
  useEffect(() => {
    if (!slug || step !== 2) {
      setSlugStatus("idle");
      return;
    }

    if (!validateSlug(slug)) {
      setSlugStatus("invalid");
      return;
    }

    setSlugStatus("checking");
    let cancelado = false;

    const timer = setTimeout(async () => {
      try {
        const { available } = await api.slugAvailable(slug);
        if (!cancelado) setSlugStatus(available ? "valid" : "taken");
      } catch {
        // Falha de rede não é "indisponível": marcar como livre aqui faria a
        // pessoa avançar e receber o erro só no fim. `checking` mantém o botão
        // desabilitado até a próxima tentativa.
        if (!cancelado) setSlugStatus("checking");
      }
    }, 400);

    return () => {
      cancelado = true;
      clearTimeout(timer);
    };
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

  /**
   * Cria a conta.
   *
   * O que havia aqui: um `setTimeout` que mostrava "Conta criada!" e navegava
   * para o painel. Nenhuma conta era criada, nenhuma sessão existia, e no
   * refresh a pessoa voltava para o zero.
   *
   * `ageConfirmed` (declaração de maioridade de quem se cadastra) e `isAdult`
   * (o perfil tem conteúdo adulto e liga a barreira de idade) são coisas
   * diferentes e vão separados — a API guarda a data da declaração como
   * registro de consentimento.
   */
  const handleStep2Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canProceedStep2) return;

    setLoading(true);

    try {
      await api.register({
        email,
        password,
        displayName,
        slug,
        ageConfirmed: ageConfirmed,
        isAdult,
      });
      toast.success("Conta criada! Bem-vinda ao BeeSocial 🎉");
      // O registro já devolve a sessão em cookie: dá para ir direto ao painel.
      router.replace("/links");
    } catch (caught) {
      const mensagem = caught instanceof ApiError ? caught.message : "Não foi possível criar a conta.";
      toast.error(mensagem);
      // Slug tomado entre a checagem e o envio: devolve o campo ao estado certo
      // em vez de deixar o visto verde numa escolha que a API recusou.
      if (caught instanceof ApiError && caught.code === "slug_unavailable") {
        setSlugStatus("taken");
      }
      setLoading(false);
    }
  };

  return (
    <>
      <Toaster position="top-center" richColors />
      <CartaoDeAuth>
          <div>

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
                  <h1 className="font-semibold text-[28px] text-white text-center mb-1">
                    Criar sua conta
                  </h1>
                  <p className="text-sm text-bee-muted text-center mb-8">
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
                      className="w-full bg-bee-pink hover:bg-bee-pink-hot text-white rounded-md font-semibold h-12 glow-pink-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Continuar
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
                  <h1 className="font-semibold text-[28px] text-white text-center mb-1">
                    Seu perfil
                  </h1>
                  <p className="text-sm text-bee-muted text-center mb-8">
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
                        {/* Sem domínio aqui, só a barra.
                            A página ainda não existe, e o endereço dela é
                            SORTEADO entre os domínios ativos na hora da criação
                            (ver `sortearDomainId`). Mostrar o domínio padrão
                            neste campo seria prometer um endereço que pode não
                            ser o dela — e o primeiro link que ela copiasse
                            estaria errado. O endereço completo aparece no
                            painel, assim que a página nasce. */}
                        <span className="px-3 py-2 rounded-lg bg-bee-surface2 text-bee-muted text-sm border border-white/[0.08]">
                          /
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
                          Seu endereço termina em <span className="text-white/70">/{slug}</span>
                          {" "}— o domínio aparece no painel depois de criar a conta.
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
                        className="flex-1 bg-bee-pink hover:bg-bee-pink-hot text-white rounded-md font-semibold h-12 glow-pink-sm disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {loading ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Criando...
                          </>
                        ) : (
                          "Criar minha conta"
                        )}
                      </Button>
                    </div>
                  </form>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
      </CartaoDeAuth>
    </>
  );
}
