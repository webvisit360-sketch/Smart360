import { createContext, useContext, useEffect, useMemo, useReducer, type ReactNode } from "react";
import { offlineCopy, reduceOfflineState } from "./living-guide-offline-model";
import { subscribeLivingGuideOfflineStatus } from "./living-guide-worker-registration";

const OfflineContext = createContext({
  cached: false,
  disconnected: false,
  reportNetworkFailure: () => {},
});

export function useLivingGuideOffline() {
  return useContext(OfflineContext);
}

export function LivingGuideOfflineProvider({ slug, lang, children }: { slug: string; lang: string; children: ReactNode }) {
  const [state, dispatch] = useReducer(reduceOfflineState, {
    cached: false,
    disconnected: typeof navigator !== "undefined" && !navigator.onLine,
  });
  useEffect(() => {
    const online = () => dispatch({ type: "online" });
    const offline = () => dispatch({ type: "offline" });
    // An online/offline browser event supplements worker-confirmed fallback.
    // It never claims that a copy was saved just because the radio is offline.
    dispatch({ type: "online" });
    if (!navigator.onLine) dispatch({ type: "offline" });
    window.addEventListener("online", online);
    window.addEventListener("offline", offline);
    const unsubscribe = subscribeLivingGuideOfflineStatus(slug, lang, (offline) => {
      dispatch({ type: "status", offline });
    });
    return () => {
      window.removeEventListener("online", online);
      window.removeEventListener("offline", offline);
      unsubscribe();
    };
  }, [slug, lang]);
  const value = useMemo(() => ({
    ...state,
    reportNetworkFailure: () => dispatch({ type: "network-failure" }),
  }), [state]);
  return <OfflineContext.Provider value={value}>{children}</OfflineContext.Provider>;
}

export function LivingGuideOfflineBanner({ lang }: { lang: string }) {
  const { cached } = useLivingGuideOffline();
  if (!cached) return null;
  return (
    <div className="lg2-offline-banner" role="status" aria-live="polite" data-testid="banner-guide-offline">
      {offlineCopy(lang).banner}
    </div>
  );
}