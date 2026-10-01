import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLivingGuideOffline } from "./living-guide-offline";
import { isOfflineFailure } from "./living-guide-offline-model";
import {
  activeAnnouncements,
  hasUnread,
  loadReadIds,
  markAnnouncementRead,
  nextVisibilityChange,
  type GuestAnnouncement,
} from "./living-guide-announcements-model";

class AnnouncementsHttpError extends Error {
  constructor(public status: number) { super(`HTTP ${status}`); }
}

export const guestAnnouncementsQueryKey = (slug: string) => ["guest-announcements", slug] as const;

async function fetchAnnouncements(slug: string): Promise<GuestAnnouncement[]> {
  // Runtime data: always live, never from HTTP/service-worker caches.
  const base = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");
  const response = await fetch(`${base}/api/guest/${encodeURIComponent(slug)}/announcements`, {
    cache: "no-store",
    credentials: "include",
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw new AnnouncementsHttpError(response.status);
  return parseAnnouncementsResponse(await response.json());
}

/** Strict contract check: malformed payloads throw instead of rendering as an empty list. */
export function parseAnnouncementsResponse(body: unknown): GuestAnnouncement[] {
  const list = (body as { announcements?: unknown } | null)?.announcements;
  if (!Array.isArray(list)) throw new Error("Malformed announcements response");
  for (const row of list) {
    const r = row as Record<string, unknown> | null;
    if (!r || typeof r.id !== "string" || typeof r.validFrom !== "string" || typeof r.createdAt !== "string" ||
        !(r.validTo == null || typeof r.validTo === "string") || !(r.deletedAt == null || typeof r.deletedAt === "string")) {
      throw new Error("Malformed announcement row");
    }
  }
  return list as GuestAnnouncement[];
}

function useNavigatorOffline() {
  const [offline, setOffline] = useState(() => typeof navigator !== "undefined" && navigator.onLine === false);
  useEffect(() => {
    const on = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);
  return offline;
}

export function useGuestAnnouncements(slug: string, tenantKey: string, enabled = true) {
  const guideOffline = useLivingGuideOffline();
  const navigatorOffline = useNavigatorOffline();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: guestAnnouncementsQueryKey(slug),
    queryFn: () => fetchAnnouncements(slug),
    enabled: enabled && !!slug,
    staleTime: 0,
    gcTime: 0,
    refetchInterval: 30_000, // runtime data: hosts expect edits to reach guests quickly
    refetchOnWindowFocus: "always",
    refetchOnReconnect: "always",
    retry: (count, error) => !isOfflineFailure(error, typeof navigator === "undefined" || navigator.onLine) && count < 1,
  });

  const [now, setNow] = useState(() => Date.now());
  const [readIds, setReadIds] = useState<Set<string>>(() => loadReadIds(tenantKey));
  useEffect(() => { setReadIds(loadReadIds(tenantKey)); }, [tenantKey]);

  const error = query.error;
  const fetchOffline = !!error && isOfflineFailure(error, !navigatorOffline);
  // Never show announcements offline — not even rows fetched earlier in this session.
  const offline = guideOffline.disconnected || navigatorOffline || fetchOffline;
  useEffect(() => {
    if (offline) queryClient.removeQueries({ queryKey: guestAnnouncementsQueryKey(slug) });
  }, [offline, queryClient, slug]);
  const rows = offline ? undefined : query.data;
  // Local timer hides rows when their validTo passes (and shows already-delivered rows whose
  // validFrom passes). Rows the server has not yet returned appear on the next poll/focus.
  useEffect(() => {
    const next = nextVisibilityChange(rows, now);
    if (next === null) return;
    const id = window.setTimeout(() => setNow(Date.now()), Math.min(next - now + 50, 2_147_000_000));
    return () => window.clearTimeout(id);
  }, [rows, now]);
  // On wake (tab/app regains visibility), re-evaluate windows; react-query refetches on focus.
  useEffect(() => {
    const wake = () => { if (document.visibilityState === "visible") { setNow(Date.now()); setReadIds(loadReadIds(tenantKey)); } };
    document.addEventListener("visibilitychange", wake);
    window.addEventListener("pageshow", wake);
    return () => { document.removeEventListener("visibilitychange", wake); window.removeEventListener("pageshow", wake); };
  }, [tenantKey]);

  const active = useMemo(() => activeAnnouncements(rows, now), [rows, now]);
  const markRead = useCallback((id: string) => {
    setReadIds(markAnnouncementRead(tenantKey, id, active.map((r) => r.id)));
  }, [tenantKey, active]);

  const refetchRef = useRef(query.refetch);
  refetchRef.current = query.refetch;
  const refresh = useCallback(() => { setNow(Date.now()); return refetchRef.current(); }, []);
  return {
    active,
    readIds,
    unread: !offline && hasUnread(active, readIds),
    markRead,
    isLoading: !offline && query.isLoading,
    offline,
    failed: !offline && !!error && !query.data,
    refetch: refresh,
    now,
  };
}

export type GuestAnnouncementsState = ReturnType<typeof useGuestAnnouncements>;
