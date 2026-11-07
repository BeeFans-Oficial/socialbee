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
  ApiPlan,
  AdminAcao,
  AdminContaDetalhe,
  AdminContaResumo,
  AdminDominioDoPool,
  AdminPagina,
  AdminVisaoGeral,
  ApiCustomDomain,
  ApiLinkReport,
  ApiDnsCheck,
  ApiErrorBody,
  ApiLink,
  ApiDomain,
  ApiProfile,
  ApiPublicProfile,
  ApiSession,
  ApiUser,
  LinkInput,
  CreateProfileInput,
  ProfileInput,
  RegisterInput,
  ReportParams,
  ReportResponse,
  ApiRevisao,
  AdminRevisaoPendente,
  ApiVerificacaoDeLink,
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
        // Multipart (upload de imagem) define o próprio Content-Type, com o
        // `boundary`; forçar JSON aqui quebraria o parse do lado da API.
        ...(init?.body && !(init.body instanceof FormData) ? { "Content-Type": "application/json" } : {}),
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

  // `profile` é `null` para a conta que ainda não criou a primeira página.
  me: () => request<{ user: ApiUser; profile: ApiProfile | null }>("/auth/me"),

  /** O clique no link do e-mail. Pública. */
  confirmarEmail: (token: string) =>
    request<{ email: string; jaConfirmado: boolean }>("/auth/email/confirmar", {
      method: "POST",
      body: JSON.stringify({ token }),
    }),
  /** Pública, por e-mail; a resposta é a mesma exista a conta ou não. */
  verificarLinkDeSenha: (token: string) =>
    request<{ valido: boolean }>("/auth/senha/verificar", { method: "POST", body: JSON.stringify({ token }) }),
  /** O link do convite: cria a senha e já devolve a sessão (cookie). */
  definirSenha: (token: string, password: string) =>
    request<ApiSession>("/auth/senha/definir", { method: "POST", body: JSON.stringify({ token, password }) }),
  reenviarConfirmacao: (email: string) =>
    request<{ enviado: true }>("/auth/email/reenviar", { method: "POST", body: JSON.stringify({ email }) }),

  // ------------------------------------------------------------------- perfil
  profile: () => request<ApiProfile>("/me/profile"),

  updateProfile: (input: ProfileInput) =>
    request<ApiProfile>("/me/profile", { method: "PATCH", body: JSON.stringify(input) }),

  /**
   * Imagens do perfil: avatar, capa (`cover`) e foto da página de chegada
   * (`iab`). O arquivo vai em multipart e a API o redimensiona antes de
   * guardar; a resposta é a URL pública. Remover é `DELETE` — o PATCH não
   * aceita mais imagem, nem em base64 nem como URL.
   */
  uploadProfileImage: (tipo: "avatar" | "cover" | "iab", arquivo: File) => {
    const form = new FormData();
    form.append("file", arquivo, arquivo.name);
    return request<{ url: string }>(`/me/profile/images/${tipo}`, { method: "POST", body: form });
  },

  removeProfileImage: (tipo: "avatar" | "cover" | "iab") =>
    request<void>(`/me/profile/images/${tipo}`, { method: "DELETE" }),

  uploadLinkImage: (linkId: string, arquivo: File) => {
    const form = new FormData();
    form.append("file", arquivo, arquivo.name);
    return request<{ url: string }>(`/me/links/${linkId}/image`, { method: "POST", body: form });
  },

  removeLinkImage: (linkId: string) => request<void>(`/me/links/${linkId}/image`, { method: "DELETE" }),

  /** Os domínios que uma página pode usar. Só os ativos. */
  domains: () => request<{ domains: ApiDomain[] }>("/me/domains").then((d) => d.domains),

  /** Domínios próprios da conta, as vagas do plano e o IP do registro A. */
  customDomains: () =>
    request<{ domains: ApiCustomDomain[]; vagas: number; serverIp: string | null }>(
      "/me/custom-domains",
    ),

  addCustomDomain: (host: string) =>
    request<ApiCustomDomain>("/me/custom-domains", { method: "POST", body: JSON.stringify({ host }) }),

  checkCustomDomainDns: (id: string) =>
    request<ApiDnsCheck>(`/me/custom-domains/${id}/dns`, { method: "POST" }),

  removeCustomDomain: (id: string) =>
    request<void>(`/me/custom-domains/${id}`, { method: "DELETE" }),

  /** As páginas da conta. */
  profiles: () =>
    request<{ profiles: ApiProfile[] }>("/me/profiles").then((d) => d.profiles),

  createProfile: (input: CreateProfileInput) =>
    request<ApiProfile>("/me/profiles", { method: "POST", body: JSON.stringify(input) }),

  /** Apaga uma página e, por cascata, os links e os cliques dela. Irreversível.
   *  A API recusa apagar a única página da conta. */
  deleteProfile: (profileId: string) =>
    request<void>(`/me/profiles/${profileId}`, { method: "DELETE" }),

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
  report: (params: ReportParams = { days: 30 }) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "" && v !== null) q.set(k, String(v));
    return request<ReportResponse>(`/me/tracking/report?${q.toString()}`);
  },

  /** Métricas de um link só. Do Pro, como o relatório. */
  linkReport: (linkId: string, days: number) =>
    request<{ days: number; report: ApiLinkReport }>(`/me/tracking/links/${linkId}?days=${days}`),

  // ------------------------------------------------------ revisão da Meta
  /** Roda o simulador na página. Demora alguns segundos: são dezenas de
   *  requisições feitas pela API contra o próprio site. */
  revisarPagina: (profileId: string) => request<ApiRevisao>(`/me/profiles/${profileId}/revisao`, { method: "POST" }),
  /** Um link só, como a Meta o seguiria. Instantâneo. */
  verificarLink: (linkId: string) => request<ApiVerificacaoDeLink>(`/me/links/${linkId}/verificar`, { method: "POST" }),
  historicoDeRevisoes: (profileId: string) =>
    request<{ revisoes: ApiRevisao[] }>(`/me/profiles/${profileId}/revisao/historico`),
  ultimaRevisao: (profileId: string) => request<{ revisao: ApiRevisao | null }>(`/me/profiles/${profileId}/revisao`),

  // -------------------------------------------------------------- painel admin
  // Toda rota aqui exige `role = 'admin'` na API (`RolesGuard`); para uma
  // conta comum a resposta é 403, e o app nem mostra as telas.
  admin: {
    visaoGeral: () => request<AdminVisaoGeral>("/admin/visao-geral"),
    contas: (q: string, pagina = 1) =>
      request<AdminPagina<AdminContaResumo>>(
        `/admin/contas?q=${encodeURIComponent(q)}&pagina=${pagina}`,
      ),
    conta: (id: string) => request<AdminContaDetalhe>(`/admin/contas/${id}`),
    criarConta: (input: { email: string; motivo: string }) =>
      request<{ id: string }>("/admin/contas", { method: "POST", body: JSON.stringify(input) }),
    editarConta: (id: string, input: { email?: string; novaSenha?: string; motivo: string }) =>
      request<{ email: string }>(`/admin/contas/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
    apagarConta: (id: string, input: { confirmacao: string; motivo: string }) =>
      request<{ apagada: true }>(`/admin/contas/${id}`, { method: "DELETE", body: JSON.stringify(input) }),
    liberarPro: (id: string, input: { dias?: number; ate?: string; motivo: string }) =>
      request<ApiPlan>(`/admin/contas/${id}/plano/liberar`, { method: "POST", body: JSON.stringify(input) }),
    rebaixarPro: (id: string, motivo: string) =>
      request<ApiPlan>(`/admin/contas/${id}/plano/rebaixar`, { method: "POST", body: JSON.stringify({ motivo }) }),
    revogarSessoes: (id: string, motivo: string) =>
      request<{ revogadas: number }>(`/admin/contas/${id}/sessoes/revogar`, {
        method: "POST",
        body: JSON.stringify({ motivo }),
      }),
    reenviarConvite: (id: string, motivo: string) =>
      request<{ enviado: true }>(`/admin/contas/${id}/convite/reenviar`, { method: "POST", body: JSON.stringify({ motivo }) }),
    definirPapel: (id: string, papel: "creator" | "admin", motivo: string) =>
      request<{ role: "creator" | "admin" }>(`/admin/contas/${id}/papel`, {
        method: "POST",
        body: JSON.stringify({ papel, motivo }),
      }),
    auditoria: (pagina = 1) => request<AdminPagina<AdminAcao>>(`/admin/auditoria?pagina=${pagina}`),
    revisoes: () => request<AdminRevisaoPendente[]>("/admin/revisoes"),
    dominios: () => request<AdminDominioDoPool[]>("/admin/dominios"),
    adicionarDominio: (input: { host: string; label?: string | null; motivo: string }) =>
      request<AdminDominioDoPool>("/admin/dominios", { method: "POST", body: JSON.stringify(input) }),
    editarDominio: (id: string, input: { label?: string | null; motivo: string }) =>
      request<AdminDominioDoPool>(`/admin/dominios/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
    pausarDominio: (id: string, motivo: string) =>
      request<AdminDominioDoPool>(`/admin/dominios/${id}/pausar`, { method: "POST", body: JSON.stringify({ motivo }) }),
    ativarDominio: (id: string, motivo: string) =>
      request<AdminDominioDoPool>(`/admin/dominios/${id}/ativar`, { method: "POST", body: JSON.stringify({ motivo }) }),
  },
};
