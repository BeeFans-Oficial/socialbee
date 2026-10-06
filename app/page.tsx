import Link from "next/link";
import { Check, Flag } from "lucide-react";

import { BuscaDeEndereco } from "@/components/landing/BuscaDeEndereco";
import { CeuEstrelado } from "@/components/landing/CeuEstrelado";
import { LogoAnimada } from "@/components/landing/LogoAnimada";

/**
 * Tela inicial.
 *
 * Céu escuro, título em serifa e um único botão claro de ação. O texto descreve
 * só o que o produto faz hoje — cada item do hero tem um recurso real por trás
 * (página de chegada, pool de domínios, página segura, plano Free).
 */

const NAV = [
  { href: "#protecao", label: "Proteção" },
  { href: "#recursos", label: "Recursos" },
  { href: "#planos", label: "Planos" },
];

const DESTAQUES = ["Sai do Instagram", "Domínios de reserva", "Página segura", "Grátis para começar"];

const PROTECAO = [
  {
    titulo: "Sai do navegador do Instagram",
    texto:
      "Quem toca no seu link dentro do app cai numa página de chegada que leva ao navegador do celular, onde pagamento e login funcionam de verdade.",
  },
  {
    titulo: "Domínios de reserva",
    texto:
      "As páginas ficam espalhadas por vários endereços. Se um for bloqueado, os outros continuam no ar e a sua página pode mudar de casa.",
  },
  {
    titulo: "Página segura",
    texto:
      "No Pro, cada link pode ter uma página limpa, só com as suas redes, para quem não deve ver o destino final.",
  },
];

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
    itens: ["1 página", "Até 5 links", "Modelo Clássico", "Saída do Instagram", "Domínio de reserva"],
    destaque: false,
  },
  {
    nome: "Pro",
    resumo: "Para quem vive do link na bio.",
    itens: [
      "Páginas e links sem limite",
      "Todos os modelos, cores e fontes",
      "Página segura nos links",
      "Escolha do domínio",
      "Relatório de cliques e visitas",
    ],
    destaque: true,
  },
];

export default function LandingPage() {
  return (
    <div className="relative min-h-screen bg-bee-bg text-white font-sans overflow-x-hidden">
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

          <h1 className="relative font-semibold text-[48px] leading-[1.02] sm:text-[88px] md:text-[104px] tracking-[-0.02em]">
            Seu link,
            <br />
            sempre no ar
          </h1>

          <p className="mt-6 text-lg sm:text-xl text-white/80">
            O link na bio feito para criadoras de conteúdo
          </p>

          <ul className="mt-12 flex flex-wrap justify-center gap-x-8 gap-y-3">
            {DESTAQUES.map((d) => (
              <li
                key={d}
                className="flex items-center gap-2 text-[13px] sm:text-sm uppercase tracking-[0.14em] text-white/65"
              >
                <span className="w-1 h-1 rounded-full bg-bee-pink" />
                {d}
              </li>
            ))}
          </ul>

          <Link
            href="/cadastro"
            className="inline-block mt-10 px-8 py-3.5 rounded-md bg-bee-pink text-white text-[15px] font-semibold hover:bg-bee-pink-hot transition-colors glow-pink-sm"
          >
            Começar grátis
          </Link>

          <p className="mt-10 text-sm text-white/50">Sem cartão de crédito. Pronto em dois minutos.</p>

          {/* Busca de endereço */}
          <div className="mt-8 mx-auto max-w-2xl rounded-2xl border border-bee-border bg-bee-surface/60 backdrop-blur-sm px-5 sm:px-6 pt-8 pb-5">
            <h2 className="font-semibold text-3xl sm:text-[34px] leading-tight tracking-[-0.01em]">
              Sua página. Seu nome. Seu link.
            </h2>
            <p className="mt-2 mb-6 text-sm text-white/60">
              Veja na hora se o endereço que você quer está livre.
            </p>
            <BuscaDeEndereco />
          </div>
        </div>
      </section>

      {/* ── Proteção ──────────────────────────────────────────────────── */}
      <section id="protecao" className="relative mx-auto max-w-6xl px-4 sm:px-6 py-24 scroll-mt-8">
        <Cabecalho
          rotulo="Proteção"
          titulo="Feito para o link não morrer"
          texto="Três camadas trabalhando juntas para a sua fã chegar onde você quer."
        />
        <div className="mt-14 grid gap-4 md:grid-cols-3">
          {PROTECAO.map((p) => (
            <Cartao key={p.titulo} titulo={p.titulo} texto={p.texto} />
          ))}
        </div>
      </section>

      {/* ── Recursos ──────────────────────────────────────────────────── */}
      <section id="recursos" className="relative mx-auto max-w-6xl px-4 sm:px-6 py-24 scroll-mt-8">
        <Cabecalho
          rotulo="Recursos"
          titulo="Tudo o que a sua bio precisa"
          texto="Monte em minutos, ajuste quando quiser."
        />
        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {RECURSOS.map((r) => (
            <Cartao key={r.titulo} titulo={r.titulo} texto={r.texto} />
          ))}
        </div>
      </section>

      {/* ── Planos ────────────────────────────────────────────────────── */}
      <section id="planos" className="relative mx-auto max-w-4xl px-4 sm:px-6 py-24 scroll-mt-8">
        <Cabecalho rotulo="Planos" titulo="Comece grátis" texto="Passe para o Pro quando precisar de mais." />
        <div className="mt-14 grid gap-4 md:grid-cols-2">
          {PLANOS.map((plano) => (
            <div
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
            </div>
          ))}
        </div>
      </section>

      {/* ── Rodapé ────────────────────────────────────────────────────── */}
      <footer className="border-t border-bee-border">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-10 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-white/45">
          <span className="font-semibold text-base text-white/70">BeeSocial</span>
          <span>© {new Date().getFullYear()} BeeSocial</span>
        </div>
      </footer>

      {/* Atalho fixo para quem chegou aqui porque o link parou de abrir. */}
      <a
        href="#protecao"
        className="fixed bottom-5 right-4 sm:right-6 z-30 flex items-center gap-2 px-4 py-3 rounded-full border border-bee-pink/30 bg-bee-bg/80 backdrop-blur text-sm text-white/90 hover:border-bee-pink/60 transition-colors"
      >
        <Flag className="w-4 h-4 text-bee-pink" />
        Link bloqueado?
      </a>
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
    <div className="rounded-2xl border border-bee-border bg-bee-surface/60 p-6 text-left">
      <h3 className="font-semibold text-xl">{titulo}</h3>
      <p className="mt-2 text-[15px] leading-relaxed text-white/60">{texto}</p>
    </div>
  );
}
