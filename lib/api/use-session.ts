"use client";

import { useEffect, useState } from "react";

import { api, ApiError } from "./client";
import type { ApiProfile, ApiUser } from "./types";

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
  profile: ApiProfile;
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

export function invalidateSession(): void {
  pendente = null;
}

export function useSession(): { session: Session | null; loading: boolean; error: ApiError | null } {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);

  useEffect(() => {
    let cancelado = false;

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

    return () => {
      cancelado = true;
    };
  }, []);

  return { session, loading, error };
}
