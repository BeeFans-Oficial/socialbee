/**
 * Contratos da API.
 *
 * É a fronteira entre o app e o serviço: o que estiver aqui é o que a API
 * promete devolver, e mudou de lugar quando o rastreamento saiu do Next (os
 * tipos de relatório vinham de `lib/tracking/types.ts`, que não existe mais
 * aqui — vive em `api/src/tracking/types.ts`).
 *
 * Catálogo de apresentação (temas, plataformas) NÃO está aqui: continua em
 * `lib/catalog.ts`, porque é escolha de design do front e a API guarda apenas
 * o id escolhido.
 */

import type { LinkAppearance, SafePage } from "@/lib/catalog";

/** Conta autenticada. Nunca traz hash de senha — a API serializa por DTO de
 *  saída justamente para não haver caminho em que ele escape. */
export interface ApiUser {
  id: string;
  email: string;
  isAdultConfirmed: boolean;
  createdAt: string;
}

/** Perfil como o dono dele vê. */
export interface ApiProfile {
  id: string;
  slug: string;
  displayName: string;
  bio: string;
  avatarUrl: string | null;
  coverUrl: string | null;
  themeId: string;
  buttonStyle: string;
  isAdult: boolean;
  joinedAt: string;
}

/** Link como o dono dele vê: com destino e com números. */
export interface ApiLink {
  id: string;
  title: string;
  subtitle: string | null;
  thumbnailUrl: string | null;
  platform: string;
  shortCode: string;
  destinationUrl: string;
  isActive: boolean;
  position: number;
  cloakEnabled: boolean;
  appearance: LinkAppearance;
  /** Total histórico do contador, não a contagem da janela do relatório:
   *  sobrevive à expiração do evento cru. */
  clicks: number;
  botHits: number;
  lastClickAt: string | null;
  safePage: SafePage | null;
  createdAt: string;
}

/** Link como o VISITANTE o recebe.
 *
 *  `destinationUrl` está ausente, e é o ponto central do produto: se o destino
 *  viesse no JSON da página pública, ele estaria no HTML entregue ao visitante —
 *  e o robô da rede social leria o link do OnlyFans direto, que é exatamente o
 *  que o redirecionador existe para evitar. O visitante recebe o código curto. */
export interface ApiPublicLink {
  id: string;
  title: string;
  subtitle: string | null;
  thumbnailUrl: string | null;
  platform: string;
  shortCode: string;
  position: number;
  cloakEnabled: boolean;
  appearance: LinkAppearance;
}

export interface ApiPublicProfile {
  profile: ApiProfile;
  links: ApiPublicLink[];
}

export interface ApiSession {
  user: ApiUser;
  profile: ApiProfile;
  accessToken: string;
  expiresAt: string;
}

/** Uma linha de quebra do relatório (por canal, por origem, por campanha…). */
export interface Breakdown {
  key: string;
  clicks: number;
  share: number;
}

/** Contadores por link. */
export interface LinkCounters {
  clicks: number;
  botHits: number;
  lastClickAt?: string;
}

/** Relatório do dashboard, já escopado no perfil da sessão. */
export interface TrackingReport {
  profileId: string;
  from: string;
  to: string;
  views: number;
  clicks: number;
  /** clicks / views. 0 quando não houve view — nunca divisão por zero. */
  clickRate: number;
  botHits: number;
  /** Cliques que chegaram de dentro de um navegador embutido de app. */
  inAppClicks: number;
  byChannel: Breakdown[];
  bySource: Breakdown[];
  byCampaign: Breakdown[];
  byLink: Array<Breakdown & { linkId: string; channel?: string }>;
  daily: Array<{ date: string; views: number; clicks: number }>;
}

export interface ReportResponse {
  days: number;
  report: TrackingReport;
  counters: Record<string, LinkCounters>;
}

/** Corpo de erro da API. Formato único, um caminho de tratamento no front. */
export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
    requestId?: string;
  };
}

/** Payload de criação/edição de link. `shortCode` não entra: quem escolhe o
 *  código é o servidor — é o endereço público do link. */
export interface LinkInput {
  title: string;
  subtitle?: string | null;
  thumbnailUrl?: string | null;
  platform?: string;
  destinationUrl: string;
  isActive?: boolean;
  cloakEnabled?: boolean;
  position?: number;
  appearance?: LinkAppearance;
  safePage?: { socialLinks: Array<{ platform: string; url: string; title: string }> } | null;
}

export interface ProfileInput {
  displayName?: string;
  slug?: string;
  bio?: string;
  avatarUrl?: string | null;
  coverUrl?: string | null;
  themeId?: string;
  buttonStyle?: string;
  isAdult?: boolean;
}

export interface RegisterInput {
  email: string;
  password: string;
  displayName: string;
  slug: string;
  ageConfirmed: boolean;
  isAdult?: boolean;
}
