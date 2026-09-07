import { createFileTrackingStore } from "./store-file";
import { createTrackingService, type TrackingService } from "./service";
import { mockLinkResolver } from "./resolver";
import type { LinkResolver, TrackingStore } from "./types";

/**
 * Fachada do módulo de rastreamento.
 *
 * As três peças trocáveis ficam montadas aqui, num lugar só: quem usa o
 * rastreamento importa daqui e nunca escolhe implementação. Ligar um banco é
 * substituir `createFileTrackingStore()`; ligar o cadastro real de links é
 * substituir `mockLinkResolver`.
 */

/** Instância única por processo.
 *
 *  Em dev o Next recarrega os módulos a cada alteração; guardar no
 *  `globalThis` evita acumular uma fila de escrita nova por recarga, o que
 *  reabriria a corrida que o mutex do store existe para fechar. */
const globalForTracking = globalThis as typeof globalThis & {
  __beesocialTrackingStore?: TrackingStore;
  __beesocialTrackingService?: TrackingService;
};

export const trackingStore: TrackingStore =
  globalForTracking.__beesocialTrackingStore ??
  (globalForTracking.__beesocialTrackingStore = createFileTrackingStore());

export const tracking: TrackingService =
  globalForTracking.__beesocialTrackingService ??
  (globalForTracking.__beesocialTrackingService = createTrackingService(trackingStore));

export const linkResolver: LinkResolver = mockLinkResolver;

export { resolveProfileBySlug, safeDestination } from "./resolver";
export type { ClickInput, ClickOutcome, TrackingService, ViewInput } from "./service";
export { EVENT_TTL_DAYS } from "./store-file";
export type {
  Attribution,
  Breakdown,
  ClientContext,
  DateRange,
  LinkCounters,
  LinkResolver,
  ResolvedLink,
  TrackingEvent,
  TrackingEventType,
  TrackingReport,
  TrackingStore,
} from "./types";
