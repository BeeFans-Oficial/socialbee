"use client";

import { useEffect, useState } from "react";

import { api, ApiError } from "./client";
import type { ApiPlan, ApiProfile, ApiUser } from "./types";

/**
 * Sessão atual, para componentes de layout.
 *
 * Existe por causa da Sidebar: ela é renderizada em toda página do painel e
 * precisa do nome, do avatar e do slug de quem está logado — dados que antes
 * vinham de `MOCK_USER`, então TODA criadora via "Bella ✨" e um link para
 * `/bella` no próprio painel.
 *
 * A promessa é guardada num módulo, não no componente: com navegação do lado do
 * cliente, o layout remonta a cada rota e cada remontagem dispararia um
 * `GET /auth/me` novo. Guardando aqui, é uma requisição por carregamento de
 * página.
 *
 * `invalidateSession()` limpa o cache — chamado no logout e depois de salvar o
 * perfil, para o nome na Sidebar não ficar diferente do que a tela mostra.
 */

export interface Session {
  user: ApiUser;
  /** `null` até a conta criar a primeira página (conta aberta pelo admin). */
  profile: ApiProfile | null;
}

let pendente: Promise<Session> | null = null;

function fetchSession(): Promise<Session> {
  if (!pendente) {
    pendente = api.me().catch((error) => {
      // Falha não pode ficar cacheada: a próxima montagem tem que tentar de
      // novo, senão um erro de rede transitório deixa a Sidebar vazia até o
      // refresh.
      pendente = null;
      throw error;
    });
  }
  return pendente;
}

/**
 * Quem está montado e exibe a sessão (barra do topo, seletor de página).
 *
 * Invalidar só limpava o cache; quem já tinha lido continuava com o valor
 * antigo até remontar. O caso visível: abrir o editor de uma página torna ELA a
 * ativa, mas a barra do topo — que já tinha pedido a sessão com a página
 * anterior — seguia mostrando a outra. Agora invalidar avisa, e cada ouvinte
 * busca de novo.
 */
const ouvintes = new Set<() => void>();

export function invalidateSession(): void {
  pendente = null;
  ouvintes.forEach((avisar) => avisar());
}

export function useSession(): { session: Session | null; loading: boolean; error: ApiError | null } {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);

  useEffect(() => {
    let cancelado = false;

    const buscar = () => {
      fetchSession()
        .then((data) => {
          if (!cancelado) setSession(data);
        })
        .catch((caught) => {
          if (!cancelado) setError(caught instanceof ApiError ? caught : null);
        })
        .finally(() => {
          if (!cancelado) setLoading(false);
        });
    };

    buscar();
    ouvintes.add(buscar);

    return () => {
      cancelado = true;
      ouvintes.delete(buscar);
    };
  }, []);

  return { session, loading, error };
}

/**
 * O plano da conta, para a tela antecipar o que a API vai recusar.
 *
 * Enquanto a sessão carrega, `ehPro` é `true`: travar tudo por meio segundo e
 * destravar em seguida pisca a tela inteira para quem é Pro. Quem é Free e
 * clicar nesse meio segundo recebe a recusa da própria API, com a mesma
 * mensagem — a trava daqui é conforto, a de lá é a regra.
 */
export function usePlano(): { plano: ApiPlan | null; ehPro: boolean } {
  const { session } = useSession();
  const plano = session?.user.plan ?? null;
  return { plano, ehPro: plano ? plano.id === "pro" : true };
}

/**
 * Sair de verdade.
 *
 * A API revoga a linha em `sessions` e apaga o cookie, então o token deixa de
 * valer mesmo para quem o tivesse copiado. Falha ao revogar não pode prender a
 * pessoa no painel: o cookie some do navegador de todo jeito e a próxima
 * requisição será recusada.
 *
 * A navegação usa `window.location` de propósito, e não o router: recarregar
 * a página inteira descarta todo estado de cliente da sessão anterior. Com
 * navegação do lado do cliente, dados da conta antiga continuariam em memória.
 */
export async function sairDoPainel(): Promise<void> {
  try {
    await api.logout();
  } catch {
    // ver acima
  } finally {
    invalidateSession();
    window.location.href = "/login";
  }
}
