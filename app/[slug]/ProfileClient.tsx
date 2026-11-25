"use client";

import React, { useCallback, useEffect, useState, useRef } from "react";
import Link from "next/link";
import { ArrowUpRight, MoreHorizontal, Plus } from "lucide-react";
import { AgeGate } from "@/components/profile/AgeGate";
import { LinkButton } from "@/components/profile/LinkButton";
import { type Link as LinkType } from "@/lib/catalog";
import type { VisualResolvido } from "@/lib/templates";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api/client";
import { handleLinkClick } from "@/lib/cloak";
import { EVENTO_CHEGADA_FECHADA } from "./IabLanding";

/**
 * A parte interativa do perfil público.
 *
 * O que mudou de desenho, e por quê:
 *
 * **1. O cabeçalho não está mais aqui.** Ele é renderizado pelo servidor
 * (`page.tsx`), então nome, bio e avatar aparecem no primeiro paint, sem
 * esperar JavaScript. Antes esta era a página inteira e o visitante — humano ou
 * robô — recebia uma casca vazia. O avatar também deixa de ser embarcado duas
 * vezes no documento (ver o comentário em `ProfileHeader`).
 *
 * **2. A barreira de idade virou sobreposição.** Ela cobre a tela inteira
 * (`fixed inset-0 z-[9999]`) em cima do perfil já pintado, em vez de substituir
 * a página. É o que atende "humano vai direto para a página real": o perfil
 * aparece na hora e a confirmação não custa um carregamento novo.
 *
 * **3. Os links do perfil adulto não vêm no HTML.** Continuam fora do documento
 * até a confirmação — a barreira só significa algo se o conteúdo não estiver no
 * código-fonte. Para isso não cobrar conversão, a busca dispara **junto** com a
 * barreira na tela, então confirmar revela tudo no mesmo gesto.
 *
 * O que ficou de fora das props de propósito: `avatarUrl`, `bio` e `coverUrl`.
 * Nada aqui os usa, e mandá-los pela fronteira de cliente é justamente o que
 * duplicava megabytes no payload.
 */

interface ProfileClientProps {
  slug: string;
  displayName: string;
  isAdult: boolean;
  /** Tudo o que o template e as escolhas da criadora resolveram — cores,
   *  formato da lista, estilo de botão. Vem pronto de `resolverVisual()`, que é
   *  a MESMA função usada pela prévia do editor: duas resoluções à mão em dois
   *  lugares divergem, e o que diverge é o caso que ninguém testou. */
  visual: VisualResolvido;
  /** Presentes no HTML só quando o perfil NÃO é adulto. */
  initialLinks: LinkType[] | null;
  /** Prévia do editor: não conta visita e clicar nos links não navega. */
  previa?: boolean;
  /** A página veio com a tela de chegada por cima. A visita só conta quando
   *  ela sai da frente (ver o efeito da visualização). */
  comChegada?: boolean;
}

export function ProfileClient({
  slug,
  displayName,
  isAdult,
  visual,
  initialLinks,
  previa = false,
  comChegada = false,
}: ProfileClientProps) {
  const [showFallbackButton, setShowFallbackButton] = useState(false);
  const [ageVerified, setAgeVerified] = useState(false);
  const idadeRegistrada = useRef(false);
  const [links, setLinks] = useState<LinkType[]>(initialLinks ?? []);

  const needsAgeGate = isAdult && !ageVerified;

  // A tela de chegada cobre o perfil até a pessoa tocar no botão. Dentro de um
  // aplicativo ela nunca sai: o botão leva ao navegador do celular, e é lá
  // (já sem a chegada) que a visita acontece.
  const [chegadaNaFrente, setChegadaNaFrente] = useState(comChegada);
  useEffect(() => {
    if (!comChegada) return;
    const liberar = () => setChegadaNaFrente(false);
    window.addEventListener(EVENTO_CHEGADA_FECHADA, liberar);
    return () => window.removeEventListener(EVENTO_CHEGADA_FECHADA, liberar);
  }, [comChegada]);

  // Referência estável: o `useEffect` do AgeGate depende de `onVerified`, e uma
  // arrow inline mudaria de identidade a cada render, reexecutando o efeito que
  // lê o localStorage.
  const handleVerified = useCallback(() => {
    setAgeVerified(true);
    // Etapa do funil: passou pela barreira (agora, ou numa visita anterior
    // que o aparelho lembrou). Uma vez por carregamento.
    if (!previa && slug && !idadeRegistrada.current) {
      idadeRegistrada.current = true;
      api.recordView(slug, "age");
    }
  }, [previa, slug]);

  // A página rola sem barra visível, como no celular — inclusive dentro da
  // moldura de iPhone das prévias do painel.
  useEffect(() => {
    const raiz = document.documentElement;
    raiz.classList.add("sem-barra");
    return () => raiz.classList.remove("sem-barra");
  }, []);

  /**
   * Tema, aplicado no documento.
   *
   * O `page.tsx` já pinta o fundo do container no servidor; isto ajusta as
   * variáveis CSS e o `body`, que só existem no navegador.
   */
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--theme-bg", visual.bg);
    root.style.setProperty("--theme-accent", visual.accent);

    const surface = visual.bg.replace(/[^,]+(?=\))/, (m) =>
      String(Math.min(255, parseInt(m) + 20)),
    );
    root.style.setProperty("--theme-surface", surface);
    document.body.style.backgroundColor = visual.bg;

    return () => {
      document.body.style.backgroundColor = "";
    };
  }, [visual.bg, visual.accent]);

  /**
   * Busca antecipada dos links do perfil adulto.
   *
   * Dispara no mount, em paralelo com a barreira na tela — não depois da
   * confirmação. É o que faz o "tenho 18+" revelar os links no mesmo gesto.
   */
  useEffect(() => {
    if (initialLinks !== null) return;
    let cancelado = false;

    api
      .publicProfile(slug)
      .then((data) => {
        if (cancelado) return;
        setLinks(
          data.links.map((link) => ({
            ...link,
            subtitle: link.subtitle ?? undefined,
            isActive: true,
            clicks: 0,
          })),
        );
      })
      .catch(() => {
        // Sem links a página ainda mostra o perfil; insistir num retry aqui
        // deixaria a visitante olhando uma tela vazia sem explicação.
      });

    return () => {
      cancelado = true;
    };
  }, [initialLinks, slug]);

  // Registra a CHEGADA: todo carregamento, de todo visitante, antes da barreira
  // de idade. Não conta como visita; é o que deixa o relatório saber de onde a
  // pessoa veio. Numa página adulta aberta dentro do Instagram, a visita só
  // acontece depois, no navegador do celular, onde já não há referrer nem
  // user-agent do aplicativo — a origem só existe neste momento.
  useEffect(() => {
    if (!slug || previa) return;
    api.recordView(slug, "arrival");
  }, [slug, previa]);

  // Registra a SAÍDA: a página deixou de estar na tela (aba fechada, volta ao
  // aplicativo, troca de aba, celular bloqueado). É o que o funil usa para
  // separar, entre quem parou numa etapa, quem foi embora de quem ficou com a
  // página aberta.
  //
  // `visibilitychange` e não só `pagehide`: no celular, fechar o navegador
  // embutido ou matar o app quase nunca dispara `pagehide`, e "oculta" é o
  // último evento confiável. `pagehide` cobre o computador, onde fechar a aba
  // nem sempre passa por "oculta" antes. Uma saída por vez em que a página
  // some, e no máximo três por carregamento — quem alterna de aba vinte vezes
  // não vira vinte eventos.
  useEffect(() => {
    if (!slug || previa) return;
    let enviadas = 0;
    let oculta = false;
    const registrar = () => {
      if (oculta || enviadas >= 3) return;
      oculta = true;
      enviadas += 1;
      api.recordView(slug, "leave");
    };
    const aoMudar = () => {
      if (document.visibilityState === "hidden") registrar();
      else oculta = false;
    };
    document.addEventListener("visibilitychange", aoMudar);
    window.addEventListener("pagehide", registrar);
    return () => {
      document.removeEventListener("visibilitychange", aoMudar);
      window.removeEventListener("pagehide", registrar);
    };
  }, [slug, previa]);

  // Registra a visualização — é o denominador da taxa de clique.
  //
  // Só conta DEPOIS da barreira: quem desiste no modal nunca viu os links, e
  // contá-lo diluiria a taxa de clique de todo perfil adulto.
  //
  // E só conta com a tela de chegada fora da frente, pelo mesmo motivo. Sem
  // isso, a página sem barreira 18+ contava uma visita dentro do Instagram,
  // com os links cobertos, e outra no navegador do celular: a mesma pessoa
  // duas vezes (medido em 24/11/2026).
  useEffect(() => {
    if (!slug || needsAgeGate || chegadaNaFrente) return;
    // Manda o SLUG, nunca o id do perfil: quem traduz é o servidor. Aceitar o
    // id do cliente deixaria qualquer um postar views em qualquer perfil.
    if (previa) return;
    api.recordView(slug);
  }, [slug, needsAgeGate, chegadaNaFrente, previa]);

  const onLinkClick = (shortCode: string, cloakEnabled: boolean) => {
    if (previa) return;
    handleLinkClick(shortCode, cloakEnabled, () => {
      // Chamado no iOS quando a navegação não tirou a fã do aplicativo — o que
      // lá é sempre. Mostra a instrução do menu, que é o único caminho real.
      setShowFallbackButton(true);
      setTimeout(() => setShowFallbackButton(false), 10000);
    });
  };

  return (
    <>
      {needsAgeGate && (
        <AgeGate slug={slug} displayName={displayName} onVerified={handleVerified} />
      )}

        {/* Links List
            Renderizado só DEPOIS da confirmação de idade. A distinção que
            importa: a pré-busca pode acontecer durante a barreira (fica em
            memória, e é o que faz o "tenho 18+" revelar tudo na hora), mas o
            RENDER não — senão os links entram no DOM antes da confirmação e a
            barreira vira enfeite, contornável com um inspecionar elemento. */}
        {!needsAgeGate && (
        <div
          className={cn(
            // Margem lateral de 20px no celular, como a referência; a coluna
            // segue limitada no computador.
            "max-w-sm mx-auto px-5 mt-6",
            // Grade de dois com espaçamento menor; lista com o de sempre.
            visual.lista === "grade" ? "grid grid-cols-2 gap-3" : "space-y-3",
          )}
        >
          {links.map((link, index) => (
            <LinkButton
              key={link.id}
              link={link}
              buttonStyle={visual.botao}
              accentColor={visual.accent}
              detalhes={visual.detalhes}
              uniforme={visual.botoesUniformes}
              index={index}
              onClick={() => onLinkClick(link.shortCode, link.cloakEnabled)}
            />
          ))}
          {/* Só na prévia do editor: atalho para criar um link nesta página.
              `target="_top"` abre o editor de link na janela do painel, e não
              dentro do iPhone da prévia. A fã nunca recebe este botão. */}
          {previa && (
            <a
              href="/links/novo"
              target="_top"
              className={cn(
                "flex items-center justify-center gap-2 w-full min-h-[52px] rounded-[14px]",
                "border-2 border-dashed border-white/45 bg-white/[0.14] backdrop-blur-sm",
                "text-[15px] font-semibold text-white/90",
                "shadow-[0_8px_24px_rgba(0,0,0,0.28)]",
                "transition-colors duration-200 hover:bg-white/[0.2] hover:border-white/65",
                visual.lista === "grade" && "col-span-2",
              )}
            >
              <Plus className="w-4 h-4" strokeWidth={2.5} />
              Adicionar link
            </a>
          )}
        </div>
        )}

        {/*
          Plano B do iOS.
          
          Era um botão "Toque aqui para abrir" que chamava `window.open` — e
          `window.open` dentro do navegador embutido do Instagram abre outra aba
          DO PRÓPRIO INSTAGRAM. Ou seja: prometia a saída e entregava a mesma
          janela, com a fã achando que tinha tentado tudo.

          Nenhum site consegue tirar o usuário do navegador embutido no iPhone —
          é limitação do sistema, não do nosso código. O único caminho real é a
          instrução do menu, a mesma que a página de chegada já usa. Mostrar o
          caminho honesto converte mais do que um botão que não funciona.
        */}
        {showFallbackButton && (
          <div className="fixed bottom-6 left-6 right-6 z-50 animate-in slide-in-from-bottom">
            <div className="max-w-sm mx-auto bg-bee-surface border border-bee-border rounded-xl p-4 shadow-2xl">
              <p className="text-sm text-bee-muted mb-3">
                Não abriu? Abra no seu navegador:
              </p>
              <ol className="space-y-2 text-[13px] text-bee-text">
                <li className="flex items-center gap-2">
                  <span className="text-bee-muted">1</span>
                  Toque em
                  <MoreHorizontal className="w-4 h-4" />
                  no canto da tela
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-bee-muted">2</span>
                  Escolha
                  <span className="inline-flex items-center gap-1 font-medium">
                    “Abrir no navegador” <ArrowUpRight className="w-3.5 h-3.5" />
                  </span>
                </li>
              </ol>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="text-center mt-12">
          <Link
            href="/"
            className="text-xs text-bee-muted hover:text-bee-pink transition-colors"
          >
            Powered by BeeSocial
          </Link>
        </div>
    </>
  );
}
