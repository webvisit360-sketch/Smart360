import { guideLanguage } from "@workspace/guide-languages";
import { extendCatalog } from "../../lib/guest-catalogs";
/** Only a worker-confirmed cache fallback warrants the saved-copy banner. */
export type OfflineState = { cached: boolean; disconnected: boolean };
export type OfflineEvent =
  | { type: "status"; offline: boolean }
  | { type: "online" }
  | { type: "offline" }
  | { type: "network-failure" };

export function reduceOfflineState(state: OfflineState, event: OfflineEvent): OfflineState {
  if (event.type === "online") return { cached: false, disconnected: false };
  if (event.type === "status") return { cached: event.offline, disconnected: event.offline };
  return { ...state, disconnected: true };
}

export const OFFLINE_COPY = extendCatalog({
  sl: {
    banner: "Ni povezave — vodnik deluje iz shranjene kopije.",
    retry: "Ni povezave. Poskusite znova, ko boste spet povezani.",
  },
  en: {
    banner: "No connection — the guide is using a saved copy.",
    retry: "No connection. Please try again when you’re back online.",
  },
  de: {
    banner: "Keine Verbindung — der Reiseführer nutzt eine gespeicherte Kopie.",
    retry: "Keine Verbindung. Bitte versuchen Sie es erneut, sobald Sie wieder online sind.",
  },
  it: {
    banner: "Nessuna connessione — la guida usa una copia salvata.",
    retry: "Nessuna connessione. Riprova quando sarai di nuovo online.",
  },
});

export function offlineCopy(lang: string) {
  return OFFLINE_COPY[guideLanguage(lang)];
}

/** Fetch rejects without an HTTP status even when navigator.onLine stays true. */
export function isOfflineFailure(error: unknown, online = true): boolean {
  if (typeof error === "object" && error !== null) {
    if ("status" in error && Number(error.status) > 0) return false;
    if ("name" in error && error.name === "AbortError") return false;
    if (!online) return true;
    if ("name" in error && error.name === "TypeError") return true;
    if ("message" in error && typeof error.message === "string") {
      return /failed to fetch|fetch failed|networkerror|network request failed|load failed/i.test(error.message);
    }
  }
  return !online;
}

type GuestWorkerRoute = { slug: string; tenantSlug?: string; mode?: string; pathname: string; search: string };

export function canRegisterGuestWorker({
  slug, tenantSlug, pathname, search,
}: GuestWorkerRoute) {
  const params = new URLSearchParams(search);
  return !!slug && tenantSlug === slug &&
    pathname.startsWith(`/${slug}/`) && !params.has("preview") && !params.has("ui");
}

export function canRegisterLivingGuideWorker(route: GuestWorkerRoute) {
  return route.mode === "living-guide" && canRegisterGuestWorker(route);
}