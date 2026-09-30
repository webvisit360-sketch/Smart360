import { canRegisterLivingGuideWorker } from "./living-guide-offline-model";

/**
 * A cached document can boot its lazy shell after the worker's original status
 * broadcast. Subscribe first, then explicitly ask the controller to replay by
 * rechecking the current language. Never infer a saved copy from onLine alone.
 */
export function subscribeLivingGuideOfflineStatus(
  slug: string,
  lang: string,
  onStatus: (offline: boolean) => void,
): () => void {
  const container = navigator.serviceWorker;
  if (!container) return () => {};
  const message = (event: MessageEvent) => {
    if (event.data?.type === "LG_OFFLINE_STATUS" && event.data.slug === slug &&
        typeof event.data.offline === "boolean") onStatus(event.data.offline);
  };
  container.addEventListener("message", message);
  const controller = container.controller;
  if (controller && canRegisterLivingGuideWorker({
    slug, tenantSlug: slug, mode: "living-guide",
    pathname: window.location.pathname, search: window.location.search,
  }) && new URL(controller.scriptURL, window.location.origin).pathname ===
      `/api/public/tenants/${encodeURIComponent(slug)}/sw.js`) {
    controller.postMessage({ type: "LG_OFFLINE_INIT", slug, lang });
  }
  return () => container.removeEventListener("message", message);
}

/** Preserve the original network-only registration for Swipe/legacy guests. */
export function registerPassthroughGuestWorker(slug: string): () => void {
  let stopped = false;
  let timer: number | undefined;
  let registration: ServiceWorkerRegistration | undefined;
  const update = () => {
    if (document.visibilityState === "visible") void registration?.update().catch(() => undefined);
  };
  void navigator.serviceWorker.register(
    `/api/public/tenants/${encodeURIComponent(slug)}/sw.js`,
    { scope: `/${slug}/`, updateViaCache: "none" },
  ).then((result) => {
    if (stopped) return;
    registration = result;
    document.addEventListener("visibilitychange", update);
    timer = window.setInterval(update, 60 * 60_000);
  }).catch(() => undefined);
  return () => {
    stopped = true;
    window.clearInterval(timer);
    document.removeEventListener("visibilitychange", update);
  };
}

/**
 * Prime on the first visit as well as after claim; never reload the document.
 * postMessage targets both controller and ready active because a first install
 * may be active before clients.claim has reached this tab.
 */
export function registerLivingGuideWorker(slug: string, lang: string, onVersion: () => void): () => void {
  let stopped = false;
  let timer: number | undefined;
  let registration: ServiceWorkerRegistration | undefined;
  let version: string | undefined;
  const workerPath = `/api/public/tenants/${encodeURIComponent(slug)}/sw.js`;
  const matches = (worker: ServiceWorker | null | undefined) =>
    worker && new URL(worker.scriptURL, window.location.origin).pathname === workerPath;
  const post = (type: "LG_OFFLINE_INIT" | "LG_OFFLINE_REFRESH") => {
    if (stopped) return;
    const workers = new Set([navigator.serviceWorker.controller, registration?.active]);
    for (const worker of workers) {
      if (worker && matches(worker)) worker.postMessage({ type, slug, lang });
    }
  };
  const init = () => post("LG_OFFLINE_INIT");
  const update = () => {
    if (document.visibilityState !== "visible") return;
    void registration?.update().catch(() => undefined);
    post("LG_OFFLINE_REFRESH");
  };
  const message = (event: MessageEvent) => {
    if (event.data?.type !== "LG_OFFLINE_VERSION" || event.data.slug !== slug) return;
    const next = String(event.data.version ?? "");
    if (next && next === version) return;
    version = next;
    onVersion();
  };
  navigator.serviceWorker.addEventListener("controllerchange", init);
  navigator.serviceWorker.addEventListener("message", message);
  // Already controlling workers can replay navigation-fallback status now.
  init();
  void navigator.serviceWorker.register(workerPath, {
    scope: `/${slug}/`, updateViaCache: "none",
  }).then((result) => {
    if (stopped) return;
    registration = result;
    init();
    document.addEventListener("visibilitychange", update);
    timer = window.setInterval(update, 60 * 60_000);
    return navigator.serviceWorker.ready.then((ready) => {
      if (stopped || ready.scope !== result.scope) return;
      registration = ready;
      init();
    });
  }).catch(() => undefined); // unsupported/blocked SW leaves normal network UX
  return () => {
    stopped = true;
    window.clearInterval(timer);
    document.removeEventListener("visibilitychange", update);
    navigator.serviceWorker.removeEventListener("controllerchange", init);
    navigator.serviceWorker.removeEventListener("message", message);
  };
}