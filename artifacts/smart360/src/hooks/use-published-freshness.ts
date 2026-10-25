import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { TenantContent } from "@workspace/api-client-react";
import { createPublishedFreshness } from "@/lib/published-freshness";
import { isReloadSafe } from "@/lib/bundle-freshness";
import { hasActiveTourView } from "@/lib/active-tour-views";

export function usePublishedFreshness(slug: string, lang: string, enabled: boolean) {
  const client = useQueryClient();
  useEffect(() => {
    if (!enabled || !slug) return;
    const key = ["getPublicTenant", slug, lang, false];
    const base = `${import.meta.env.BASE_URL}api/public/tenants/${encodeURIComponent(slug)}`;
    const json = async (url: string) => {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error("Publication unavailable");
      return res.json();
    };
    const controller = createPublishedFreshness<TenantContent>({
      current: () => client.getQueryData(key),
      safe: () => isReloadSafe() && !hasActiveTourView(slug),
      version: async () => (await json(`${base}/published-version`)).version,
      content: () => json(`${base}?lang=${encodeURIComponent(lang)}`),
      apply: (next) => client.setQueryData(key, next),
    });
    const wake = () => { if (document.visibilityState === "visible") void controller.check(); };
    const worker = (event: MessageEvent) => {
      if (event.data?.type === "LG_OFFLINE_VERSION" && event.data.slug === slug) wake();
    };
    wake();
    document.addEventListener("visibilitychange", wake);
    window.addEventListener("pageshow", wake);
    window.addEventListener("online", wake);
    navigator.serviceWorker?.addEventListener("message", worker);
    // Pending publication is applied within one second after activity ends.
    const flush = window.setInterval(() => {
      if (document.visibilityState === "visible") controller.flush();
    }, 1000);
    const check = window.setInterval(wake, 60_000);
    return () => {
      controller.dispose();
      clearInterval(flush); clearInterval(check);
      document.removeEventListener("visibilitychange", wake);
      window.removeEventListener("pageshow", wake);
      window.removeEventListener("online", wake);
      navigator.serviceWorker?.removeEventListener("message", worker);
    };
  }, [slug, lang, enabled, client]);
}
