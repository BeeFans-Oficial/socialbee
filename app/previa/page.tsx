"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, RefreshCw, ExternalLink, Info } from "lucide-react";

import { useSession } from "@/lib/api/use-session";
import { siteHost } from "@/lib/site";
import { cn } from "@/lib/utils";

/**
 * Prévia: como o perfil aparece para um robô e para uma pessoa.
 *
 * A pergunta que esta tela responde — "o que o Instagram vê quando eu colo meu
 * link?" — antes só dava para responder por linha de comando
 * (`npm run ver:robo`). Aqui a criadora vê com os próprios olhos, sem terminal.
 *
 * Não há detecção reimplementada no cliente: cada lado é um `<iframe>` para a
 * PÁGINA REAL. O lado humano carrega `/{slug}` normal (o navegador dela roda
 * JS, cai no ramo humano); o lado robô carrega `/{slug}?preview=bot`, que a
 * própria rota de perfil força para o `BotProfile` — mas só porque ela está
 * logada (ver a trava em `app/[slug]/page.tsx`). O que aparece nos quadros é
 * byte a byte o que cada visitante recebe.
 *
 * O card de compartilhamento no topo replica o `generateMetadata` da rota: é o
 * que vira o retângulo no WhatsApp, no Telegram e no Instagram.
 */

type Lado = "robo" | "humano";

export default function PreviaPage() {
  const router = useRouter();
  const { session, loading, error } = useSession();
  const [recarga, setRecarga] = useState(0);
  const [foco, setFoco] = useState<Lado | null>(null);

  if (error?.isUnauthorized) {
    router.replace("/login?de=/previa");
    return null;
  }

  const slug = session?.profile.slug ?? "";
  const nome = session?.profile.displayName ?? "";
  const host = siteHost();

  // Espelha `generateMetadata` em app/[slug]/page.tsx — se mudar lá, muda aqui.
  const previaTitulo = nome;
  const previaDescricao = `Todos os links de @${slug} em um só lugar.`;

  const url = (lado: Lado) =>
    `/${slug}${lado === "robo" ? "?preview=bot" : ""}${
      // O contador entra como hash para o iframe recarregar sem uma nova
      // entrada no histórico do navegador.
      recarga ? `#r=${recarga}` : ""
    }`;

  return (
    <div className="min-h-screen px-6 py-8 lg:px-10">
      <div className="max-w-5xl mx-auto">
        {/* Cabeçalho */}
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="font-bebas text-[36px] uppercase tracking-widest text-white leading-none mb-1">
              PRÉVIA
            </h1>
            <p className="text-xs text-white/25 tracking-wide uppercase font-medium">
              O que o robô vê · o que a pessoa vê
            </p>
          </div>
          <button
            onClick={() => setRecarga((n) => n + 1)}
            disabled={!slug}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white/60 border border-white/10 hover:text-white hover:border-white/20 transition-all disabled:opacity-40"
          >
            <RefreshCw className="w-4 h-4" />
            Recarregar
          </button>
        </div>

        {/* Explicação — a lógica por trás dos dois quadros */}
        <div className="mb-6 flex gap-3 rounded-xl bg-bee-pink/[0.06] border border-bee-pink/15 p-4">
          <Info className="w-4 h-4 text-bee-pink flex-shrink-0 mt-0.5" />
          <p className="text-xs text-white/50 leading-relaxed">
            Robôs de rede social não abrem sua página — eles só leem o texto para
            montar a prévia do link. Por isso o robô recebe seu nome e sua bio,
            mas <span className="text-white/80 font-medium">nunca a lista de links</span>.
            Sua visitante, num navegador de verdade, recebe a página completa.
          </p>
        </div>

        {/* Card de compartilhamento */}
        <div className="mb-8">
          <div className="text-[11px] uppercase tracking-wider text-white/30 font-medium mb-2">
            Como o link aparece quando compartilhado
          </div>
          <div className="max-w-md rounded-xl overflow-hidden border border-white/10 bg-bee-surface">
            <div className="h-40 bg-gradient-to-br from-bee-pink/20 to-bee-pink/5 flex items-center justify-center">
              <span className="font-bebas text-2xl text-white/40 uppercase tracking-widest">
                {host}
              </span>
            </div>
            <div className="p-3">
              <div className="text-[10px] uppercase tracking-wider text-white/30">{host}</div>
              <div className="text-sm font-semibold text-white truncate mt-0.5">
                {previaTitulo || "—"}
              </div>
              <div className="text-xs text-white/40 truncate">{previaDescricao}</div>
            </div>
          </div>
        </div>

        {/* Os dois quadros */}
        {loading ? (
          <div className="py-20 text-center text-bee-muted text-sm">Carregando…</div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Quadro
              titulo="Visão do robô"
              subtitulo="facebookexternalhit, Telegram, Google…"
              icone={<EyeOff className="w-4 h-4" />}
              url={slug ? url("robo") : ""}
              ativo={foco !== "humano"}
              onFoco={() => setFoco(foco === "robo" ? null : "robo")}
              key={`robo-${recarga}`}
            />
            <Quadro
              titulo="Visão da pessoa"
              subtitulo="quem abre o link no navegador"
              icone={<Eye className="w-4 h-4" />}
              url={slug ? url("humano") : ""}
              ativo={foco !== "robo"}
              onFoco={() => setFoco(foco === "humano" ? null : "humano")}
              key={`humano-${recarga}`}
            />
          </div>
        )}

        {slug && (
          <a
            href={`/${slug}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 mt-6 text-xs text-white/30 hover:text-bee-pink transition-colors"
          >
            Abrir minha página numa aba <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>
    </div>
  );
}

function Quadro({
  titulo,
  subtitulo,
  icone,
  url,
  ativo,
  onFoco,
}: {
  titulo: string;
  subtitulo: string;
  icone: React.ReactNode;
  url: string;
  ativo: boolean;
  onFoco: () => void;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border overflow-hidden transition-all duration-300",
        ativo ? "border-white/15 opacity-100" : "border-white/5 opacity-30",
      )}
    >
      <button
        onClick={onFoco}
        className="w-full flex items-center gap-2 px-4 py-3 border-b border-white/[0.06] text-left hover:bg-white/[0.02] transition-colors"
      >
        <span className="text-bee-pink">{icone}</span>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-white">{titulo}</div>
          <div className="text-[11px] text-white/30 truncate">{subtitulo}</div>
        </div>
      </button>
      {/* Uma "moldura de celular" para a prévia ter a proporção real de onde a
          página é vista. O iframe carrega a rota de verdade — não é uma
          simulação, é a página. */}
      <div className="bg-black/40 p-4 flex justify-center">
        <div className="w-[300px] h-[560px] rounded-[24px] overflow-hidden border border-white/10 bg-black shadow-2xl">
          {url ? (
            <iframe
              src={url}
              title={titulo}
              className="w-full h-full"
              // `sandbox` sem `allow-top-navigation`: um link dentro da prévia
              // não pode sequestrar a aba do painel. `allow-scripts` porque o
              // lado humano precisa de JS para ser fiel.
              sandbox="allow-scripts allow-same-origin"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-white/20 text-xs">
              sem perfil
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
