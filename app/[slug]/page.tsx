import { cookies, headers } from "next/headers";
import Link from "next/link";
import type { Metadata } from "next";
import { cache } from "react";

import { HexBackground } from "@/components/shared/HexBackground";
import { Logo } from "@/components/shared/Logo";
import { ProfileHeader } from "@/components/profile/ProfileHeader";
import { resolverVisual } from "@/lib/templates";
import { getPlatformIcon } from "@/lib/utils";
import { fetchPublicProfile, type PublicProfileForRender } from "@/lib/api/server";
import { SESSION_COOKIE } from "@/lib/session-cookie";
import { siteHost } from "@/lib/site";
import type { Link as LinkType, User } from "@/lib/catalog";
import { BotProfile } from "./BotProfile";
import { IabLanding } from "./IabLanding";
import { ProfileClient } from "./ProfileClient";

/**
 * Perfil público, renderizado no SERVIDOR.
 *
 * Era um componente de cliente, e a consequência aparecia em duas pontas:
 *
 *   - **Prévia genérica.** Quem não executa JavaScript recebia 21 KB de casca
 *     com os metadados globais do layout. Quando uma fã compartilhava o link no
 *     WhatsApp, a prévia dizia "BeeSocial — Seu link na bio", sem o nome nem a
 *     foto da criadora. Custava clique em toda partilha orgânica, que é o canal
 *     mais valioso que ela tem.
 *   - **Bifurcação acidental.** Robô e humano já recebiam páginas diferentes,
 *     mas por efeito colateral do modelo de renderização — não por decisão que
 *     alguém tomou, revisou ou testou.
 *
 * Agora a decisão é explícita e está numa linha só (`requester.isBot`), com
 * teste em cima. O veredito vem da API, que é onde o detector vive: a página
 * não reimplementa heurística de robô, porque duas heurísticas em dois lugares
 * divergem, e a que fica errada é sempre a que ninguém está olhando.
 */

// A resposta depende de QUEM pediu, então não pode ser cacheada: uma página de
// perfil em cache entregaria ao visitante seguinte o veredito do anterior.
export const dynamic = "force-dynamic";

/**
 * Uma busca por requisição, compartilhada entre `generateMetadata` e a página.
 *
 * `cache()` do React memoiza dentro do mesmo render. Sem ele, cada acesso faria
 * duas chamadas idênticas à API — e as duas repassam os cabeçalhos do visitante,
 * então nem o veredito de robô sairia consistente entre elas.
 */
const carregarPerfil = cache(
  async (slug: string): Promise<PublicProfileForRender | null> =>
    fetchPublicProfile(slug, await headers()),
);

function paraUser(view: PublicProfileForRender): User {
  return {
    id: view.profile.id,
    slug: view.profile.slug,
    displayName: view.profile.displayName,
    bio: view.profile.bio,
    avatarUrl: view.profile.avatarUrl,
    coverUrl: view.profile.coverUrl,
    themeId: view.profile.themeId,
    buttonStyle: view.profile.buttonStyle,
    isAdult: view.profile.isAdult,
    joinedAt: view.profile.joinedAt,
  };
}

function paraLinks(view: PublicProfileForRender): LinkType[] {
  // A API já devolve só os links ATIVOS, ordenados, e **sem** `destinationUrl`:
  // o destino nunca chega ao navegador, é o redirecionador que o conhece.
  return view.links.map((link) => ({
    ...link,
    subtitle: link.subtitle ?? undefined,
    isActive: true,
    clicks: 0,
  }));
}

/**
 * Metadados da prévia.
 *
 * O que o crawler lê aqui é o que vira o cartão no WhatsApp, no Telegram e no
 * Instagram. Duas escolhas deliberadas:
 *
 *   - **O nome da criadora entra** — é o que faz a fã reconhecer o link e clicar.
 *   - **A bio NÃO entra.** Ela é campo de expressão da criadora e costuma ser
 *     explícita; a descrição da prévia é texto neutro gerado a partir do slug.
 *     O próximo passo é dar a ela um campo de prévia próprio, para escolher o
 *     que aparece sem ter que censurar a bio.
 *
 * Sem `og:image` por ora, pelo mesmo motivo: o avatar é escolha dela e pode ser
 * conteúdo adulto — expor por padrão é decisão que não cabe a este código.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const view = await carregarPerfil(slug);

  if (!view) {
    return { title: "Perfil não encontrado | BeeSocial" };
  }

  const titulo = view.profile.displayName;
  const descricao = `Todos os links de @${view.profile.slug} em um só lugar.`;

  return {
    title: titulo,
    description: descricao,
    openGraph: {
      title: titulo,
      description: descricao,
      type: "profile",
      url: `https://${siteHost()}/${view.profile.slug}`,
      siteName: "BeeSocial",
    },
    twitter: { card: "summary", title: titulo, description: descricao },
  };
}

export default async function ProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ preview?: string; fora?: string }>;
}) {
  const { slug } = await params;
  const view = await carregarPerfil(slug);

  if (!view) return <PerfilNaoEncontrado slug={slug} />;

  const user = paraUser(view);

  /**
   * Prévia de robô, para a criadora ver na tela do painel como o crawler vê o
   * perfil dela (`/previa`).
   *
   * `?preview=bot` força o ramo do robô — mas **só com sessão**. A trava não é
   * decorativa: sem ela, qualquer um forçaria o ramo pela URL, e um bot esperto
   * usaria `?preview=human` (que não existe, justamente por isso) para pedir a
   * versão com links. Aqui só o `bot` é forçável, e só para quem está logado —
   * a presença do cookie basta, porque forçar o ramo do robô só entrega MENOS
   * conteúdo, nunca mais.
   */
  const { preview, fora } = await searchParams;
  const temSessao = (await cookies()).has(SESSION_COOKIE);
  const forcarRoboNaPrevia = preview === "bot" && temSessao;
  const forcarChegadaNaPrevia = preview === "iab" && temSessao;

  /**
   * A bifurcação, agora com três saídas. A ordem é o que a torna correta.
   *
   * 1. **Página de chegada**, quando ligada, para quem vem de navegador
   *    embutido E para robô. É o primeiro ramo de propósito: enquanto ela está
   *    ligada, o robô recebe o MESMO documento que a fã do Instagram, e a
   *    diferença entre os dois deixa de ser o user-agent (o que caracteriza
   *    cloaking) e passa a ser executar JavaScript ou não.
   * 2. **Perfil do robô**, para crawler quando a chegada está desligada. É o
   *    comportamento antigo, preservado para quem não ativou nada.
   * 3. **Perfil completo**, para todo o resto.
   *
   * `?fora=1` é a volta do escape: a pessoa já está num navegador de verdade,
   * então pular o ramo 1 é o que impede o laço. Não precisa de sessão nem de
   * proteção — forçar a rota a entregar o perfil completo é o que ela faz por
   * padrão para qualquer navegador comum.
   */
  const escapou = fora === "1";
  const chegouDeApp = view.requester?.isInAppBrowser ?? false;
  const ehRobo = forcarRoboNaPrevia || (view.requester?.isBot ?? false);

  const iab = view.profile.iab;
  const mostrarChegada =
    forcarChegadaNaPrevia || (iab?.enabled === true && !escapou && (chegouDeApp || ehRobo));

  if (mostrarChegada) {
    return (
      <IabLanding
        slug={slug}
        displayName={user.displayName}
        themeId={user.themeId}
        imageUrl={iab?.imageUrl ?? null}
        headline={iab?.headline ?? null}
        buttonLabel={iab?.buttonLabel ?? null}
        platform={view.requester?.platform ?? "other"}
        // Na prévia do painel a página é desenhada, nunca executada: sem isto,
        // abrir a prévia tentaria escapar e levaria a criadora para fora do
        // painel dela.
        preview={forcarChegadaNaPrevia}
      />
    );
  }

  if (ehRobo) {
    return <BotProfile user={user} />;
  }

  /**
   * Humano: a página real, já renderizada no servidor.
   *
   * O cabeçalho — nome, bio, avatar, selo de idade — vai no HTML, então aparece
   * no primeiro paint, sem esperar JavaScript. É o que atende "humano vai
   * direto para a página real".
   *
   * **Os links só vão no HTML quando o perfil NÃO é adulto.** Sendo adulto, a
   * barreira de idade só significa algo se o conteúdo não estiver no documento
   * antes da confirmação — senão basta abrir o código-fonte. O `ProfileClient`
   * os busca em paralelo com a barreira na tela, então confirmar revela tudo no
   * mesmo gesto.
   *
   * Os ícones de plataforma seguem a mesma regra: são derivados dos links, e
   * `onlyfans` no cabeçalho é a mesma informação que os links dariam.
   */
  const links = paraLinks(view);

  /**
   * Template e escolhas da criadora, resolvidos numa estrutura só.
   *
   * A precedência está em `resolverVisual()` e não espalhada por aqui: cor
   * personalizada ganha do preset de tema, que ganha do padrão do template. A
   * mesma função alimenta a prévia do editor, que é o que garante que o que ela
   * vê enquanto edita seja o que a fã recebe.
   */
  const visual = resolverVisual({
    templateId: view.profile.template?.templateId,
    themeId: user.themeId,
    buttonStyle: user.buttonStyle,
    bgColor: view.profile.template?.bgColor,
    accentColor: view.profile.template?.accentColor,
    fontId: view.profile.template?.fontId,
    coverUrl: view.profile.coverUrl,
    coverPosX: view.profile.template?.coverPosX,
    coverPosY: view.profile.template?.coverPosY,
    coverOverlay: view.profile.template?.coverOverlay,
  });

  const capaEmTela = visual.capa === "tela" && visual.coverUrl;

  return (
    <div
      className="relative min-h-screen text-bee-text overflow-hidden"
      style={{ backgroundColor: visual.bg }}
    >
      {/* Imagem cobrindo a tela inteira, quando o template pede. As outras
          formas de usar a capa (faixa, herói) são desenhadas no cabeçalho. */}
      {capaEmTela && (
        <div className="fixed inset-0">
          {/* eslint-disable-next-line @next/next/no-img-element -- a rota serve
              bytes de uma coluna do banco. */}
          <img
            src={visual.coverUrl!}
            alt=""
            className="w-full h-full object-cover"
            style={{ objectPosition: visual.coverPos }}
          />
          <div
            className="absolute inset-0"
            style={{ backgroundColor: `rgba(0,0,0,${visual.overlay})` }}
          />
        </div>
      )}

      {/* O fundo hexagonal é decoração da marca — alguns templates dispensam,
          e sobre foto ele só suja a imagem. */}
      {visual.hex && !capaEmTela && <HexBackground density="medium" />}

      <div className="relative z-10 pb-20">
        <ProfileHeader
          user={user}
          visual={visual}
          activePlatforms={user.isAdult ? [] : links.map((l) => getPlatformIcon(l.platform))}
        />

        <ProfileClient
          slug={slug}
          displayName={user.displayName}
          isAdult={user.isAdult}
          visual={visual}
          initialLinks={user.isAdult ? null : links}
        />
      </div>
    </div>
  );
}

function PerfilNaoEncontrado({ slug }: { slug: string }) {
  return (
    <div className="relative min-h-screen bg-bee-bg text-bee-text overflow-hidden flex items-center justify-center">
      <HexBackground density="low" />
      <div className="relative z-10 text-center px-6">
        <Logo size="lg" variant="full" className="mb-8 justify-center" />
        <h1 className="font-bebas text-6xl uppercase mb-4">Perfil não encontrado</h1>
        <p className="text-bee-muted mb-8 max-w-md mx-auto">
          O perfil <span className="text-bee-pink">@{slug}</span> não existe ou foi removido.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-6 py-3 bg-bee-pink rounded-full font-semibold hover:opacity-90 transition-opacity glow-pink-sm"
        >
          Voltar para o início
        </Link>
      </div>
    </div>
  );
}
