"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, MoreHorizontal } from "lucide-react";
import { AgeGate } from "@/components/profile/AgeGate";
import { LinkButton } from "@/components/profile/LinkButton";
import { type Link as LinkType } from "@/lib/catalog";
import type { VisualResolvido } from "@/lib/templates";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api/client";
import { handleLinkClick } from "@/lib/cloak";
import { getPlatformIcon } from "@/lib/utils";

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
}

export function ProfileClient({
  slug,
  displayName,
  isAdult,
  visual,
  initialLinks,
}: ProfileClientProps) {
  const [showFallbackButton, setShowFallbackButton] = useState(false);
  const [ageVerified, setAgeVerified] = useState(false);
  const [links, setLinks] = useState<LinkType[]>(initialLinks ?? []);

  const needsAgeGate = isAdult && !ageVerified;

  // Referência estável: o `useEffect` do AgeGate depende de `onVerified`, e uma
  // arrow inline mudaria de identidade a cada render, reexecutando o efeito que
  // lê o localStorage.
  const handleVerified = useCallback(() => setAgeVerified(true), []);

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

  // Registra a visualização — é o denominador da taxa de clique.
  //
  // Só conta DEPOIS da barreira: quem desiste no modal nunca viu os links, e
  // contá-lo diluiria a taxa de clique de todo perfil adulto.
  useEffect(() => {
    if (!slug || needsAgeGate) return;
    // Manda o SLUG, nunca o id do perfil: quem traduz é o servidor. Aceitar o
    // id do cliente deixaria qualquer um postar views em qualquer perfil.
    api.recordView(slug);
  }, [slug, needsAgeGate]);

  const onLinkClick = (shortCode: string, cloakEnabled: boolean) => {
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
            "max-w-sm mx-auto px-4 mt-6",
            // Grade de dois com espaçamento menor; lista com o de sempre.
            visual.lista === "grade" ? "grid grid-cols-2 gap-3" : "space-y-3",
          )}
        >
          {links.map((link, index) => (
            <LinkButton
              key={link.id}
              link={link}
              icon={getPlatformIcon(link.platform)}
              buttonStyle={visual.botao}
              accentColor={visual.accent}
              detalhes={visual.detalhes}
              index={index}
              onClick={() => onLinkClick(link.shortCode, link.cloakEnabled)}
            />
          ))}
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
