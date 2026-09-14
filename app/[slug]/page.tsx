import { cookies, headers } from "next/headers";
import Link from "next/link";
import type { Metadata } from "next";
import { cache } from "react";

import { HexBackground } from "@/components/shared/HexBackground";
import { Logo } from "@/components/shared/Logo";
import { ProfileHeader } from "@/components/profile/ProfileHeader";
import { THEMES } from "@/lib/catalog";
import { getPlatformIcon } from "@/lib/utils";
import { fetchPublicProfile, type PublicProfileForRender } from "@/lib/api/server";
import { SESSION_COOKIE } from "@/lib/session-cookie";
import { siteHost } from "@/lib/site";
import type { Link as LinkType, User } from "@/lib/catalog";
import { BotProfile } from "./BotProfile";
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
  searchParams: Promise<{ preview?: string }>;
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
  const { preview } = await searchParams;
  const temSessao = (await cookies()).has(SESSION_COOKIE);
  const forcarRoboNaPrevia = preview === "bot" && temSessao;

  // A bifurcação. Uma linha, explícita, testável.
  if (forcarRoboNaPrevia || view.requester?.isBot) {
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
  const theme = THEMES.find((t) => t.id === user.themeId) ?? THEMES[0];

  return (
    <div
      className="relative min-h-screen text-bee-text overflow-hidden"
      style={{ backgroundColor: theme.bg }}
    >
      <HexBackground density="medium" />

      <div className="relative z-10 pb-20">
        <ProfileHeader
          user={user}
          themeAccent={theme.accent}
          activePlatforms={user.isAdult ? [] : links.map((l) => getPlatformIcon(l.platform))}
        />

        <ProfileClient
          slug={slug}
          displayName={user.displayName}
          isAdult={user.isAdult}
          themeId={user.themeId}
          buttonStyle={user.buttonStyle}
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
