import Link from "next/link";
import { Check } from "lucide-react";

import { BuscaDeEndereco } from "@/components/landing/BuscaDeEndereco";
import { CeuEstrelado } from "@/components/landing/CeuEstrelado";
import { CamadasDaPagina } from "@/components/landing/CamadasDaPagina";
import { Revelar, RevelarItem, RevelarLista } from "@/components/landing/Revelar";
import { LogoAnimada } from "@/components/landing/LogoAnimada";

/**
 * Tela inicial.
 *
 * Céu escuro, título em serifa e um único botão claro de ação. O texto descreve
 * só o que o produto faz hoje — cada item do hero tem um recurso real por trás
 * (página de chegada, endereço próprio, barreira de idade, plano Free).
 *
 * O que esta página NÃO diz, de propósito: que "sai do Instagram", que tem
 * "domínios de reserva" para quando "um for bloqueado", que serve "página
 * segura" a quem "não deve ver o destino". Era assim, e é o vocabulário que a
 * Meta usa para classificar serviço de cloaking — o classificador lê a raiz do
 * domínio, não só o perfil. Em 15/10/2026 ela derrubou a conta de uma criadora
 * no mesmo segundo em que o link entrou na bio (ver `app/[slug]/page.tsx`).
 * A página descreve benefício para a fã, não truque contra a plataforma.
 */

const NAV = [
  { href: "#como-funciona", label: "Como funciona" },
  { href: "#recursos", label: "Recursos" },
  { href: "#planos", label: "Planos" },
];

const DESTAQUES = ["Abre no navegador do celular", "Seu endereço, seu nome", "Barreira de idade", "Grátis para começar"];

const RECURSOS = [
  { titulo: "Modelos prontos", texto: "Escolha um layout e troque foto, textos, cores e botões." },
  { titulo: "Várias páginas", texto: "Uma página para cada perfil ou campanha, na mesma conta." },
  { titulo: "Cliques e visitas", texto: "Saiba de onde vem o seu público e em qual botão ele clica." },
  { titulo: "Barreira de idade", texto: "Confirmação de 18+ antes de mostrar os seus links." },
];

const PLANOS = [
  {
    nome: "Free",
    resumo: "Para começar agora.",
    itens: ["1 página", "Até 5 links", "Modelo Clássico", "Tela de boas-vindas no celular", "Barreira de idade"],
    destaque: false,
  },
  {
    nome: "Pro",
    resumo: "Para quem vive do link na bio.",
    itens: [
      "Páginas e links sem limite",
      "Todos os modelos, cores e fontes",
      "Escolha do domínio",
      "Relatório de cliques e visitas",
    ],
    destaque: true,
  },
];

export default function LandingPage() {
  return (
    <div className="relative min-h-screen bg-bee-bg text-white font-sans overflow-x-clip">
      {/* ── Navegação ─────────────────────────────────────────────────── */}
      <header className="relative z-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 h-[88px] flex items-center justify-between">
          <Link href="/" className="font-semibold text-xl tracking-tight text-white/90">
            BeeSocial
          </Link>
          <nav className="hidden md:flex items-center gap-6 absolute left-1/2 -translate-x-1/2">
            {NAV.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="text-[15px] text-white/70 hover:text-white transition-colors"
              >
                {item.label}
              </a>
            ))}
          </nav>
          <Link
            href="/login"
            className="px-6 py-2.5 rounded-md border border-bee-pink/40 text-[15px] text-white hover:bg-bee-pink/10 transition-colors"
          >
            Entrar
          </Link>
        </div>
      </header>

      {/* ── Hero ──────────────────────────────────────────────────────── */}
      <section className="relative">
        <CeuEstrelado />

        <div className="relative z-10 mx-auto max-w-5xl px-4 sm:px-6 pt-6 pb-24 text-center">
          <LogoAnimada className="mb-6 sm:mb-8" />

          <Revelar como="h1" atraso={0.2} className="relative font-semibold text-[48px] leading-[1.02] sm:text-[88px] md:text-[104px] tracking-[-0.02em]">
            Seu link,
            <br />
            sempre no ar
          </Revelar>

          <Revelar como="p" atraso={0.35} className="mt-6 text-lg sm:text-xl text-white/80">
            O link na bio feito para criadoras de conteúdo
          </Revelar>

          <RevelarLista como="ul" className="mt-12 flex flex-wrap justify-center gap-x-8 gap-y-3">
            {DESTAQUES.map((d) => (
              <RevelarItem
                como="li"
                key={d}
                className="flex items-center gap-2 text-[13px] sm:text-sm uppercase tracking-[0.14em] text-white/65"
              >
                <span className="w-1 h-1 rounded-full bg-bee-pink" />
                {d}
              </RevelarItem>
            ))}
          </RevelarLista>

          <Revelar atraso={0.15}>
            <Link
              href="/cadastro"
              className="inline-block mt-10 px-8 py-3.5 rounded-md bg-bee-pink text-white text-[15px] font-semibold hover:bg-bee-pink-hot transition-colors glow-pink-sm"
            >
              Começar grátis
            </Link>
            <p className="mt-10 text-sm text-white/50">Sem cartão de crédito. Pronto em dois minutos.</p>
          </Revelar>

          {/* Busca de endereço */}
          <Revelar className="mt-8 mx-auto max-w-2xl rounded-2xl border border-bee-border bg-bee-surface/60 backdrop-blur-sm px-5 sm:px-6 pt-8 pb-5">
            <h2 className="font-semibold text-3xl sm:text-[34px] leading-tight tracking-[-0.01em]">
              Sua página. Seu nome. Seu link.
            </h2>
            <p className="mt-2 mb-6 text-sm text-white/60">
              Veja na hora se o endereço que você quer está livre.
            </p>
            <BuscaDeEndereco />
          </Revelar>
        </div>
      </section>

      {/* ── Como funciona ─────────────────────────────────────────────── */}
      {/* ── Como funciona ─────────────────────────────────────────────── */}
      <section id="como-funciona" className="relative mx-auto max-w-6xl px-4 sm:px-6 py-24 scroll-mt-8">
        <Revelar>
          <Cabecalho
            rotulo="Como funciona"
            titulo="Uma página, quatro camadas"
            texto="Cada camada faz uma promessa a quem abre o seu link. Desça e veja a página se montar."
          />
        </Revelar>
        <CamadasDaPagina />
      </section>

      {/* ── Recursos ──────────────────────────────────────────────────── */}
      <section id="recursos" className="relative mx-auto max-w-6xl px-4 sm:px-6 py-24 scroll-mt-8">
        <Revelar>
          <Cabecalho
            rotulo="Recursos"
            titulo="Tudo o que a sua bio precisa"
            texto="Monte em minutos, ajuste quando quiser."
          />
        </Revelar>
        <RevelarLista className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {RECURSOS.map((r) => (
            <RevelarItem key={r.titulo}>
              <Cartao titulo={r.titulo} texto={r.texto} />
            </RevelarItem>
          ))}
        </RevelarLista>
      </section>

      {/* ── Planos ────────────────────────────────────────────────────── */}
      <section id="planos" className="relative mx-auto max-w-4xl px-4 sm:px-6 py-24 scroll-mt-8">
        <Revelar>
          <Cabecalho rotulo="Planos" titulo="Comece grátis" texto="Passe para o Pro quando precisar de mais." />
        </Revelar>
        <RevelarLista className="mt-14 grid gap-4 md:grid-cols-2">
          {PLANOS.map((plano) => (
            <RevelarItem
              key={plano.nome}
              className={
                plano.destaque
                  ? "rounded-2xl border border-bee-pink/40 bg-bee-pink/[0.04] p-8 glow-pink-sm"
                  : "rounded-2xl border border-bee-border bg-bee-surface/60 p-8"
              }
            >
              <h3 className="font-semibold text-3xl">{plano.nome}</h3>
              <p className="mt-1 text-sm text-white/55">{plano.resumo}</p>
              <ul className="mt-6 space-y-3">
                {plano.itens.map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-[15px] text-white/80">
                    <Check className="w-4 h-4 mt-0.5 text-bee-pink flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
              <Link
                href="/cadastro"
                className={
                  plano.destaque
                    ? "mt-8 block text-center px-6 py-3 rounded-md bg-bee-pink text-white text-[15px] font-semibold hover:bg-bee-pink-hot transition-colors glow-pink-sm"
                    : "mt-8 block text-center px-6 py-3 rounded-md border border-bee-pink/40 text-[15px] hover:bg-bee-pink/10 transition-colors"
                }
              >
                {plano.destaque ? "Começar e pedir o Pro" : "Começar grátis"}
              </Link>
            </RevelarItem>
          ))}
        </RevelarLista>
      </section>

      {/* ── Rodapé ────────────────────────────────────────────────────── */}
      <footer className="border-t border-bee-border">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-10 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-white/45">
          <span className="font-semibold text-base text-white/70">BeeSocial</span>
          <span>© {new Date().getFullYear()} BeeSocial</span>
        </div>
      </footer>
    </div>
  );
}

function Cabecalho({ rotulo, titulo, texto }: { rotulo: string; titulo: string; texto: string }) {
  return (
    <div className="text-center">
      <p className="flex items-center justify-center gap-2 text-[13px] uppercase tracking-[0.14em] text-white/55">
        <span className="w-1 h-1 rounded-full bg-bee-pink" />
        {rotulo}
      </p>
      <h2 className="mt-4 font-semibold text-4xl sm:text-5xl tracking-[-0.01em]">{titulo}</h2>
      <p className="mt-4 text-white/60">{texto}</p>
    </div>
  );
}

function Cartao({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <div className="h-full rounded-2xl border border-bee-border bg-bee-surface/60 p-6 text-left">
      <h3 className="font-semibold text-xl">{titulo}</h3>
      <p className="mt-2 text-[15px] leading-relaxed text-white/60">{texto}</p>
    </div>
  );
}
