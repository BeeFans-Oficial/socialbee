import Link from "next/link";
import { Logo } from "@/components/shared/Logo";
import { HexBackground } from "@/components/shared/HexBackground";
import { 
  ArrowRight, 
  Shield, 
  Link as LinkIcon, 
  BarChart3,
  Check,
  Star,
  ChevronDown
} from "lucide-react";
import { PLATFORMS } from "@/lib/mock-data";

export default function LandingPage() {
  return (
    <div className="bg-bee-bg text-bee-text">
      {/* NAVIGATION */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-bee-bg/85 backdrop-blur-md border-b border-bee-border min-h-[72px] flex items-center">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between w-full">
          <Logo size="md" variant="full" className="flex-shrink-0 self-center" />
          
          <div className="hidden md:flex items-center gap-8">
            <a href="#como-funciona" className="text-bee-muted hover:text-bee-text transition-colors">
              Como funciona
            </a>
            <a href="#plataformas" className="text-bee-muted hover:text-bee-text transition-colors">
              Plataformas
            </a>
            <a href="#recursos" className="text-bee-muted hover:text-bee-text transition-colors">
              Recursos
            </a>
          </div>

          <div className="flex items-center gap-4">
            <Link
              href="/login"
              className="text-bee-muted hover:text-bee-text transition-colors"
            >
              Entrar
            </Link>
            <Link
              href="/cadastro"
              className="px-6 py-2.5 bg-bee-pink rounded-full font-semibold hover:opacity-90 transition-all glow-pink-sm"
            >
              Começar grátis
            </Link>
          </div>
        </div>
      </nav>

      {/* HERO SECTION */}
      <section className="relative min-h-screen flex items-center overflow-hidden pt-20">
        <HexBackground density="high" />
        
        <div className="container mx-auto px-6 relative z-10">
          <div className="max-w-xl">
            {/* Tag pill */}
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-bee-pink/10 border border-bee-pink/30 rounded-full mb-6">
              <span className="text-sm font-semibold text-bee-pink">
                Faça o seu #Buzz
              </span>
            </div>

            {/* Avatares + Logo */}
            <div className="flex items-center gap-2 mb-8">
              <div className="flex -space-x-2">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-sm font-bold border-2 border-bee-bg">
                  B
                </div>
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-sm font-bold border-2 border-bee-bg">
                  M
                </div>
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center text-sm font-bold border-2 border-bee-bg">
                  L
                </div>
              </div>
              <div className="w-10 h-10 rounded-lg bg-bee-pink/20 border border-bee-pink flex items-center justify-center">
                <Logo variant="icon" size="sm" />
              </div>
            </div>

            {/* Headline */}
            <h1 className="font-bebas text-7xl lg:text-8xl uppercase tracking-wide leading-none mb-6">
              GANHOS CONSTANTES,
              <br />
              <span className="text-bee-pink">CRESCIMENTO</span> SEM PARAR.
            </h1>

            {/* Subtitle */}
            <p className="text-lg text-bee-muted mb-8 max-w-lg">
              A plataforma de links feita para criadores que levam a sério sua presença online.
            </p>

            {/* CTAs */}
            <div className="flex flex-wrap items-center gap-4">
              <Link
                href="/cadastro"
                className="px-8 py-4 bg-bee-pink rounded-full font-bold text-lg hover:opacity-90 transition-all glow-pink inline-flex items-center gap-2"
              >
                Junte-se a nós
                <ArrowRight className="w-5 h-5" />
              </Link>
              <Link
                href="/demo"
                className="text-bee-muted hover:text-bee-pink transition-colors inline-flex items-center gap-2"
              >
                Ver exemplo
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES - 3 CARDS */}
      <section id="recursos" className="relative py-24 bg-bee-bg">
        <div className="container mx-auto px-6">
          <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {/* Card 1 */}
            <div className="group p-8 bg-bee-surface border border-bee-border rounded-2xl hover:border-bee-pink/60 transition-all hover:glow-pink-sm">
              <div className="relative w-14 h-14 mb-6 flex items-center justify-center mx-auto">
                <svg viewBox="0 0 100 100" className="w-full h-full" aria-hidden>
                  <polygon
                    points="50,5 85,27.5 85,72.5 50,95 15,72.5 15,27.5"
                    stroke="#FF3C6E"
                    strokeWidth="2"
                    fill="none"
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center">
                  <Shield className="w-6 h-6 text-bee-pink" />
                </span>
              </div>
              <h3 className="font-barlow font-bold text-2xl mb-3">
                Cloaking para Instagram
              </h3>
              <p className="text-bee-muted leading-relaxed">
                Seus seguidores saem automaticamente do app. Zero cliques perdidos.
              </p>
            </div>

            {/* Card 2 */}
            <div className="group p-8 bg-bee-surface border border-bee-border rounded-2xl hover:border-bee-pink/60 transition-all hover:glow-pink-sm">
              <div className="relative w-14 h-14 mb-6 flex items-center justify-center mx-auto">
                <svg viewBox="0 0 100 100" className="w-full h-full" aria-hidden>
                  <polygon
                    points="50,5 85,27.5 85,72.5 50,95 15,72.5 15,27.5"
                    stroke="#FF3C6E"
                    strokeWidth="2"
                    fill="none"
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center">
                  <LinkIcon className="w-6 h-6 text-bee-pink" />
                </span>
              </div>
              <h3 className="font-barlow font-bold text-2xl mb-3">
                Links 100% seguros
              </h3>
              <p className="text-bee-muted leading-relaxed">
                Sua URL real nunca aparece. Só você sabe o destino de cada link.
              </p>
            </div>

            {/* Card 3 */}
            <div className="group p-8 bg-bee-surface border border-bee-border rounded-2xl hover:border-bee-pink/60 transition-all hover:glow-pink-sm">
              <div className="relative w-14 h-14 mb-6 flex items-center justify-center mx-auto">
                <svg viewBox="0 0 100 100" className="w-full h-full" aria-hidden>
                  <polygon
                    points="50,5 85,27.5 85,72.5 50,95 15,72.5 15,27.5"
                    stroke="#FF3C6E"
                    strokeWidth="2"
                    fill="none"
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center">
                  <BarChart3 className="w-6 h-6 text-bee-pink" />
                </span>
              </div>
              <h3 className="font-barlow font-bold text-2xl mb-3">
                Analytics em tempo real
              </h3>
              <p className="text-bee-muted leading-relaxed">
                Veja cliques, origem, conversão e quanto veio do Instagram.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* COMO FUNCIONA */}
      <section id="como-funciona" className="relative py-24 bg-[#111111]">
        <div className="container mx-auto px-6">
          <h2 className="font-bebas text-5xl md:text-6xl text-center uppercase mb-16">
            Como funciona
          </h2>

          <div className="max-w-5xl mx-auto grid md:grid-cols-3 gap-8">
            {/* Step 1 */}
            <div className="relative text-center">
              <div className="font-bebas text-7xl text-bee-pink mb-4">01</div>
              <h3 className="font-bold text-xl mb-3">CRIE SUA CONTA</h3>
              <p className="text-bee-muted">
                Cadastre em 30 segundos. Sem cartão.
              </p>
              <div className="hidden md:block absolute top-12 -right-8 w-16 h-0.5 bg-gradient-to-r from-bee-pink to-transparent" />
            </div>

            {/* Step 2 */}
            <div className="relative text-center">
              <div className="font-bebas text-7xl text-bee-pink mb-4">02</div>
              <h3 className="font-bold text-xl mb-3">ADICIONE SEUS LINKS</h3>
              <p className="text-bee-muted">
                OnlyFans, Telegram, WhatsApp e mais
              </p>
              <div className="hidden md:block absolute top-12 -right-8 w-16 h-0.5 bg-gradient-to-r from-bee-pink to-transparent" />
            </div>

            {/* Step 3 */}
            <div className="relative text-center">
              <div className="font-bebas text-7xl text-bee-pink mb-4">03</div>
              <h3 className="font-bold text-xl mb-3">COMPARTILHE UM LINK</h3>
              <p className="text-bee-muted">
                beesocial.app/seunome direto no Instagram
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* PLATAFORMAS */}
      <section id="plataformas" className="relative py-24 bg-bee-bg overflow-hidden">
        <div className="container mx-auto px-6 mb-12">
          <h2 className="font-bebas text-5xl md:text-6xl text-center uppercase">
            Conecte tudo
          </h2>
        </div>

        {/* Marquee */}
        <div className="relative overflow-hidden">
          <div className="flex gap-3 animate-[marquee_30s_linear_infinite]">
            {[...PLATFORMS, ...PLATFORMS].map((platform, i) => (
              <div
                key={i}
                className="flex-shrink-0 px-6 py-3 bg-bee-surface border border-bee-border rounded-full flex items-center gap-3"
              >
                <span className="text-2xl">{platform.icon}</span>
                <span className="font-semibold whitespace-nowrap">{platform.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PROVA SOCIAL */}
      <section className="relative py-24 bg-bee-bg">
        <div className="container mx-auto px-6">
          <h2 className="font-bebas text-5xl md:text-6xl text-center uppercase mb-16">
            Já usado por +5.000 criadores
          </h2>

          <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {/* Depoimento 1 */}
            <div className="p-6 bg-bee-surface border border-bee-border rounded-2xl">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center font-bold">
                  MC
                </div>
                <div>
                  <div className="font-semibold">Maria Clara</div>
                  <div className="flex gap-0.5">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="w-4 h-4 fill-bee-pink text-bee-pink" />
                    ))}
                  </div>
                </div>
              </div>
              <p className="text-bee-muted leading-relaxed">
                "Finalmente consigo gerenciar todos os meus links em um lugar só. Meus ganhos aumentaram 40% no primeiro mês!"
              </p>
            </div>

            {/* Depoimento 2 */}
            <div className="p-6 bg-bee-surface border border-bee-border rounded-2xl">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center font-bold">
                  JR
                </div>
                <div>
                  <div className="font-semibold">Julia Rocha</div>
                  <div className="flex gap-0.5">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="w-4 h-4 fill-bee-pink text-bee-pink" />
                    ))}
                  </div>
                </div>
              </div>
              <p className="text-bee-muted leading-relaxed">
                "O cloaking é game changer! Meus seguidores do Instagram agora conseguem acessar todos os meus links sem problema."
              </p>
            </div>

            {/* Depoimento 3 */}
            <div className="p-6 bg-bee-surface border border-bee-border rounded-2xl">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center font-bold">
                  AS
                </div>
                <div>
                  <div className="font-semibold">Amanda Silva</div>
                  <div className="flex gap-0.5">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="w-4 h-4 fill-bee-pink text-bee-pink" />
                    ))}
                  </div>
                </div>
              </div>
              <p className="text-bee-muted leading-relaxed">
                "Analytics em tempo real me ajudaram a entender qual conteúdo converte mais. Essencial para quem leva isso a sério!"
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA FINAL */}
      <section className="relative py-32 bg-bee-surface overflow-hidden">
        <HexBackground density="low" />
        
        <div className="container mx-auto px-6 text-center relative z-10">
          <h2 className="font-bebas text-6xl md:text-7xl uppercase mb-8">
            Pronta para começar?
          </h2>
          <p className="text-xl text-bee-muted mb-8 max-w-2xl mx-auto">
            Junte-se a milhares de criadores que já transformaram seus links em resultados.
          </p>
          <Link
            href="/cadastro"
            className="inline-flex items-center gap-3 px-10 py-5 bg-bee-pink rounded-full font-bold text-xl hover:opacity-90 transition-all glow-pink"
          >
            Criar conta grátis
            <ArrowRight className="w-6 h-6" />
          </Link>
          <p className="text-sm text-bee-muted mt-4">
            Sem cartão de crédito · Comece em 30 segundos
          </p>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-bee-bg border-t border-bee-border py-12">
        <div className="container mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex flex-col items-center md:items-start gap-2">
              <Logo size="sm" variant="full" />
              <p className="text-sm text-bee-muted">Seus links. Seu controle.</p>
            </div>

            <div className="flex gap-6 text-sm text-bee-muted">
              <Link href="/termos" className="hover:text-bee-pink transition-colors">
                Termos
              </Link>
              <span>·</span>
              <Link href="/privacidade" className="hover:text-bee-pink transition-colors">
                Privacidade
              </Link>
              <span>·</span>
              <Link href="/contato" className="hover:text-bee-pink transition-colors">
                Contato
              </Link>
            </div>
          </div>

          <div className="mt-8 pt-8 border-t border-bee-pink/20 text-center text-sm text-bee-muted">
            © 2024 BeeSocial. Todos os direitos reservados.
          </div>
        </div>
      </footer>
    </div>
  );
}
