/**
 * Cliente da API para o NAVEGADOR.
 *
 * Chama sempre `/api/v1/*` na própria origem; o servidor do Next reescreve para
 * a API (ver `next.config.js`). Três consequências, e é por elas que o rewrite
 * existe:
 *
 *   - o cookie de sessão é same-site e viaja sozinho, sem `SameSite=None`;
 *   - o token nunca passa por `localStorage`, que é legível por qualquer script
 *     da página — um XSS em qualquer canto do dashboard entregaria a sessão;
 *   - nenhuma chamada do produto paga preflight de CORS.
 *
 * Todo erro sai como `ApiError`, com a mensagem que a API mandou em português.
 * A tela mostra `error.message` direto: mensagem inventada no front sobre algo
 * que o servidor recusou quase sempre descreve a causa errada.
 */

import type {
  ApiErrorBody,
  ApiLink,
  ApiProfile,
  ApiPublicProfile,
  ApiSession,
  ApiUser,
  LinkInput,
  CreateProfileInput,
  ProfileInput,
  RegisterInput,
  ReportResponse,
} from "./types";

const BASE = "/api/v1";

/**
 * A PÁGINA que o painel está editando.
 *
 * Uma conta pode ter várias, e toda chamada de link, relatório e perfil é
 * escopada por ela. O valor viaja no cabeçalho `x-profile-id` e a API **confere
 * se a página é de quem está pedindo** antes de aceitar — id de outra criadora
 * não chega a lugar nenhum, o pedido só cai na página padrão.
 *
 * Fica no `localStorage` porque é preferência de quem está na frente do
 * navegador, não estado do servidor: duas abas podem editar páginas diferentes,
 * e a sessão não deveria escolher por elas. Ausente, a API usa a página padrão
 * da conta — que é o que acontece com quem tem uma página só.
 */
const CHAVE_PAGINA = "bs_pagina_ativa";

export function paginaAtiva(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(CHAVE_PAGINA);
  } catch {
    // Navegação privada e armazenamento bloqueado: sem página escolhida, a API
    // cai na padrão. Degradar assim é melhor que derrubar o painel.
    return null;
  }
}

export function definirPaginaAtiva(profileId: string | null): void {
  try {
    if (profileId) window.localStorage.setItem(CHAVE_PAGINA, profileId);
    else window.localStorage.removeItem(CHAVE_PAGINA);
  } catch {
    /* idem */
  }
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;
  readonly requestId?: string;

  constructor(status: number, body?: ApiErrorBody) {
    super(body?.error?.message ?? "Não foi possível concluir. Tente de novo.");
    this.name = "ApiError";
    this.status = status;
    this.code = body?.error?.code ?? "unknown";
    this.details = body?.error?.details;
    this.requestId = body?.error?.requestId;
  }

  /** Sessão ausente, expirada ou revogada. A tela usa isto para mandar a pessoa
   *  ao login em vez de mostrar "erro ao carregar". */
  get isUnauthorized(): boolean {
    return this.status === 401;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${BASE}${path}`, {
      ...init,
      // O cookie é httpOnly: o JavaScript não o lê nem o escreve, só pede ao
      // navegador que o envie.
      credentials: "include",
      headers: {
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        // Um lugar só manda o cabeçalho: toda chamada do painel passa por aqui,
        // e espalhar isso por cada método seria esquecer em um deles.
        ...(paginaAtiva() ? { "x-profile-id": paginaAtiva()! } : {}),
        ...init?.headers,
      },
    });
  } catch {
    // Falha de rede não tem corpo de erro para ler: API fora do ar, wifi caído,
    // requisição abortada.
    throw new ApiError(0, {
      error: { code: "network_error", message: "Sem conexão com o servidor." },
    });
  }

  if (response.status === 204) return undefined as T;

  const text = await response.text();
  const payload = text ? safeJson(text) : undefined;

  if (!response.ok) {
    throw new ApiError(response.status, payload as ApiErrorBody | undefined);
  }
  return payload as T;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

export const api = {
  // ------------------------------------------------------------------- sessão
  register: (input: RegisterInput) =>
    request<ApiSession>("/auth/register", { method: "POST", body: JSON.stringify(input) }),

  login: (email: string, password: string) =>
    request<ApiSession>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  logout: () => request<void>("/auth/logout", { method: "POST" }),

  me: () => request<{ user: ApiUser; profile: ApiProfile }>("/auth/me"),

  // ------------------------------------------------------------------- perfil
  profile: () => request<ApiProfile>("/me/profile"),

  updateProfile: (input: ProfileInput) =>
    request<ApiProfile>("/me/profile", { method: "PATCH", body: JSON.stringify(input) }),

  /** As páginas da conta. */
  profiles: () =>
    request<{ profiles: ApiProfile[] }>("/me/profiles").then((d) => d.profiles),

  createProfile: (input: CreateProfileInput) =>
    request<ApiProfile>("/me/profiles", { method: "POST", body: JSON.stringify(input) }),

  slugAvailable: (slug: string) =>
    request<{ slug: string; available: boolean }>(
      `/public/slug-available?slug=${encodeURIComponent(slug)}`,
    ),

  // -------------------------------------------------------------------- links
  links: () => request<{ links: ApiLink[] }>("/me/links").then((data) => data.links),

  createLink: (input: LinkInput) =>
    request<ApiLink>("/me/links", { method: "POST", body: JSON.stringify(input) }),

  updateLink: (id: string, input: Partial<LinkInput>) =>
    request<ApiLink>(`/me/links/${id}`, { method: "PATCH", body: JSON.stringify(input) }),

  deleteLink: (id: string) => request<void>(`/me/links/${id}`, { method: "DELETE" }),

  reorderLinks: (ids: string[]) =>
    request<{ links: ApiLink[] }>("/me/links/reorder", {
      method: "PATCH",
      body: JSON.stringify({ ids }),
    }).then((data) => data.links),

  // ------------------------------------------------------------------ público
  publicProfile: (slug: string) =>
    request<ApiPublicProfile>(`/public/profiles/${encodeURIComponent(slug)}`),

  /** Registra a visualização do perfil. Recebe SLUG, nunca id: o cliente não
   *  escolhe em qual perfil grava. `keepalive` porque a visitante pode tocar num
   *  link imediatamente — sem ele o navegador cancela a requisição ao sair da
   *  página e a view some, inflando a taxa de clique justamente nos perfis que
   *  convertem mais rápido. */
  recordView: (slug: string) =>
    fetch(`${BASE}/public/tracking/view`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug }),
      keepalive: true,
    }).catch(() => undefined),

  // ---------------------------------------------------------------- analytics
  report: (days: number) => request<ReportResponse>(`/me/tracking/report?days=${days}`),
};
