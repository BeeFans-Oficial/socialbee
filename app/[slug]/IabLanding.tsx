"use client";

import { useEffect, useState } from "react";
import { ArrowUpRight, MoreHorizontal } from "lucide-react";

import { HexBackground } from "@/components/shared/HexBackground";
import { buildIntentUrl } from "@/lib/cloak";
import { THEMES } from "@/lib/catalog";
import { cn } from "@/lib/utils";

/**
 * Página de CHEGADA, para quem vem de dentro de um aplicativo.
 *
 * O problema que ela resolve: o navegador embutido do Instagram não tem barra
 * de endereço, não compartilha sessão com o navegador de verdade da pessoa e em
 * vários aparelhos recusa abrir esquemas de outros apps. A fã clica no link da
 * bio, cai numa janela sem saída, e o destino nunca é alcançado.
 *
 * ## Por que a mesma página serve o robô
 *
 * A bifurcação por user-agent que existia — robô recebe um documento, humano
 * recebe outro — é o que a documentação da Meta chama de cloaking, e é o que
 * expõe o domínio a bloqueio. Aqui a diferença deixa de ser QUEM pediu e passa
 * a ser o que o cliente FAZ: todo mundo recebe este mesmo HTML, e quem executa
 * JavaScript sai dele. O robô não executa, então fica — e o que ele indexa é
 * uma página que a criadora escolheu e revisou.
 *
 * Não há conteúdo fabricado: é o nome dela, a imagem que ela escolheu e um
 * botão. Os links continuam fora do documento, como já estavam.
 *
 * ## O escape
 *
 * No Android, `intent://` faz o sistema entregar a URL ao Chrome, com
 * `browser_fallback_url` para o caso de não haver app que atenda. No iOS não
 * existe equivalente: o sistema não deixa uma página tirar o usuário do
 * WebView, então o caminho honesto é o botão mais a instrução do menu `•••`.
 *
 * A tentativa automática só acontece uma vez, e só no Android. Repetir em laço
 * ou tentar no iOS produz o pior resultado possível: a página pisca, não sai do
 * lugar, e a fã acha que o link está quebrado.
 */

export interface IabLandingProps {
  slug: string;
  displayName: string;
  themeId: string;
  /** Rota da imagem escolhida pela criadora. Sem ela, o fundo é só o tema. */
  imageUrl: string | null;
  /** Título. Vazio cai no nome de exibição. */
  headline: string | null;
  buttonLabel: string | null;
  /** Decide a técnica de escape. Vem do detector da API, não do `navigator`:
   *  o documento precisa ser o mesmo para todo mundo, inclusive no HTML. */
  platform: "android" | "ios" | "other";
  /** Prévia no painel: desenha a página sem NUNCA tentar escapar, senão abrir
   *  a prévia sequestraria a aba de quem está editando. */
  preview?: boolean;
}

/** Destino do escape: a própria página, pedindo o perfil completo.
 *
 *  `?fora=1` é o que diz ao servidor "já estou num navegador de verdade" — sem
 *  ele a pessoa voltaria para esta mesma tela, em laço. */
const PARAM_ESCAPE = "fora";

export function IabLanding({
  slug,
  displayName,
  themeId,
  imageUrl,
  headline,
  buttonLabel,
  platform,
  preview = false,
}: IabLandingProps) {
  const theme = THEMES.find((t) => t.id === themeId) ?? THEMES[0];
  const titulo = headline?.trim() || displayName;
  const rotulo = buttonLabel?.trim() || `Continuar para ${displayName}`;

  /** Mostra a instrução manual depois de a tentativa automática não ter tirado
   *  ninguém do lugar. No iOS ela aparece de cara, porque lá não há tentativa. */
  const [mostrarInstrucao, setMostrarInstrucao] = useState(platform === "ios");

  useEffect(() => {
    if (preview || platform !== "android") return;

    // Uma tentativa, e só. Se o intent funcionar, esta página é descartada
    // junto com o WebView; se não funcionar, o timer revela a instrução.
    const destino = `${window.location.origin}/${slug}?${PARAM_ESCAPE}=1`;
    window.location.href = buildIntentUrl(destino);

    const timer = setTimeout(() => setMostrarInstrucao(true), 2500);
    return () => clearTimeout(timer);
  }, [preview, platform, slug]);

  const abrir = () => {
    if (preview) return;
    const destino = `${window.location.origin}/${slug}?${PARAM_ESCAPE}=1`;
    window.location.href = platform === "android" ? buildIntentUrl(destino) : destino;
    setMostrarInstrucao(true);
  };

  return (
    <div
      className="relative min-h-screen flex flex-col text-bee-text overflow-hidden"
      style={{ backgroundColor: theme.bg }}
    >
      <HexBackground density="low" />

      {/* A imagem escolhida pela criadora ocupa o topo inteiro. É o que a fã vê
          antes de qualquer texto, e é também o que um revisor automático vê. */}
      {imageUrl && (
        <div className="absolute inset-x-0 top-0 h-[55vh] overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element -- a rota serve
              bytes de uma coluna do banco; `next/image` exige loader ou domínio
              configurado e não acrescentaria nada a uma imagem só. */}
          <img src={imageUrl} alt="" className="w-full h-full object-cover" />
          <div
            className="absolute inset-0"
            style={{ background: `linear-gradient(to bottom, transparent 30%, ${theme.bg} 95%)` }}
          />
        </div>
      )}

      {/* Com imagem o conteúdo desce para não cobri-la; sem imagem ele se
          centraliza, senão metade da tela fica vazia. */}
      <div
        className={cn(
          "relative z-10 flex-1 flex flex-col px-6 pb-12",
          imageUrl ? "justify-end pt-[45vh]" : "justify-center",
        )}
      >
        <h1 className="font-bebas text-[40px] leading-none uppercase tracking-wide text-white text-center">
          {titulo}
        </h1>
        <p className="mt-2 text-center text-sm text-white/50">
          {displayName} está compartilhando os links dela com você
        </p>

        <button
          onClick={abrir}
          className="mt-8 w-full rounded-2xl bg-white px-6 py-4 text-center text-[15px] font-semibold text-black transition-transform active:scale-[0.98]"
        >
          {rotulo}
        </button>

        {/*
          A instrução do menu `•••` é o único caminho no iOS, e o segundo no
          Android. Escrita com os rótulos exatos do Instagram: "abra no
          navegador" descreve a intenção, mas quem está com o celular na mão
          precisa do nome do item que vai tocar.
        */}
        {mostrarInstrucao && (
          <div className="mt-6 rounded-2xl border border-white/10 bg-black/30 p-4">
            <p className="text-center text-xs text-white/40 mb-3">
              Não abriu? Faça assim:
            </p>
            <ol className="space-y-2 text-[13px] text-white/60">
              <li className="flex items-center gap-2">
                <span className="text-white/25">1</span>
                Toque em
                <MoreHorizontal className="w-4 h-4 text-white/80" />
                no canto da tela
              </li>
              <li className="flex items-center gap-2">
                <span className="text-white/25">2</span>
                Escolha
                <span className="text-white/80 inline-flex items-center gap-1">
                  “Abrir no navegador” <ArrowUpRight className="w-3.5 h-3.5" />
                </span>
              </li>
            </ol>
          </div>
        )}
      </div>
    </div>
  );
}
