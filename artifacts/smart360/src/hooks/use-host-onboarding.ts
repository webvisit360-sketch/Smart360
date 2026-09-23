import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type {
  HostOnboardingCanonicalItem,
  HostOnboardingDataHero,
} from "@workspace/api-client-react";
import {
  getGetTenantQueryKey,
  getGetTranslationOverviewQueryKey,
  getListTenantTranslationsQueryKey,
  retryHostOnboardingRecommendations,
  type HostOnboardingRecommendationProcessing,
} from "@workspace/api-client-react";

export interface HostOnboardingData {
  accommodationName?: string;
  address?: string;
  guestPhone?: string;
  guestEmail?: string;
  website?: string;
  checkInFrom?: string;
  checkOutUntil?: string;
  contacts?: Array<{ id: string; name: string; phone: string }>;
  wifiName?: string;
  wifiPassword?: string;
  houseRulesParking?: string;
  offers?: Array<{ id: string; categoryId?: string; name: string; price: string }>;
  recommendations?: Array<{ id: string; categoryId: string; name: string }>;
  customCategories?: Array<{
    id: string;
    name: string;
    entries: Array<{ id: string; name: string }>;
  }>;
  events?: Array<{ id: string; name: string; date: string; time: string }>;
  /**
   * Canonical tenant media. Omit this property to preserve all media; when it
   * is supplied, every existing row and stable ID must be retained.
   */
  media?: HostOnboardingMedia[];
  /** Canonical row deletion is explicit; collection omission never deletes. */
  deleteContactIds?: string[];
  deleteOfferIds?: string[];
  deleteEventIds?: string[];
  deleteMediaIds?: string[];
  /** Lossless canonical item projection; only changed stable-ID rows are sent. */
  canonicalItems?: HostOnboardingCanonicalItem[];
  /** Current tenant hero is previewed, but never dropped by an omitted patch. */
  hero?: HostOnboardingDataHero | null;
}

export interface HostOnboardingMedia {
  id: string;
  itemId: string | null;
  kind: "image" | "video";
  url: string;
  alt: string;
  position: number;
  posterUrl: string | null;
  durationSec: number | null;
  width?: number | null;
  height?: number | null;
  focusX?: number | null;
  focusY?: number | null;
}

export interface HostOnboardingCategory {
  id: string;
  name: string;
  order: number;
}

export interface HostOnboardingPhoto {
  id: string;
  fileName: string;
  contentType: string;
  size: number;
  status: "uploading" | "ready" | "submitted";
  previewUrl?: string;
  /** Stable canonical media ID once the upload is attached to the draft. */
  mediaId?: string;
}

export interface HostOnboardingContentSection {
  id: string;
  key: "stay" | "offer";
  title: string;
  order: number;
  categories: Array<{
    id: string;
    key: string;
    label: string;
    order: number;
  }>;
}

export interface HostOnboardingResponse {
  id: string;
  tenantId: string;
  round: number;
  status: "draft" | "submitted";
  data: HostOnboardingData;
  categories: HostOnboardingCategory[];
  contentSections?: HostOnboardingContentSection[];
  photos: HostOnboardingPhoto[];
  updatedAt: string;
  submittedAt: string | null;
  revision: number;
  canonicalRevision: string;
  recommendationProcessing?: HostOnboardingRecommendationProcessing | null;
}

export type RecommendationProcessingPresentation = {
  tone: "pending" | "failed" | "succeeded";
  message: string;
  canRetry: boolean;
};

export function recommendationProcessingPresentation(
  processing: HostOnboardingRecommendationProcessing | null | undefined,
): RecommendationProcessingPresentation | null {
  if (!processing) return null;
  if (processing.status === "pending") {
    return {
      tone: "pending",
      message: "Priporočila so shranjena in čakajo na obdelavo.",
      canRetry: true,
    };
  }
  if (processing.status === "failed") {
    return {
      tone: "failed",
      message: "Priporočila so shranjena; obdelava ni uspela.",
      canRetry: true,
    };
  }
  return {
    tone: "succeeded",
    message: "Priporočila so obdelana.",
    canRetry: false,
  };
}

export function automaticRecommendationRetryDelay(attempt: number): number | null {
  return [1_500, 5_000][attempt] ?? null;
}

export function canHydrateCanonicalDraft(input: {
  initialized: boolean;
  localSnapshot: string;
  lastSavedSnapshot: string;
  queuedSnapshot: string;
  saveState: "saved" | "dirty" | "saving" | "error" | "conflict";
}): boolean {
  if (!input.initialized) return true;
  return input.localSnapshot === input.lastSavedSnapshot
    && input.queuedSnapshot === ""
    && input.saveState !== "dirty"
    && input.saveState !== "saving"
    && input.saveState !== "conflict";
}

export function preserveCanonicalMediaForWrite(
  data: HostOnboardingData,
  currentServerMedia: HostOnboardingMedia[],
  mediaChanged: boolean,
  removedMediaIds: ReadonlySet<string> = new Set(),
): HostOnboardingData {
  const next = { ...data };
  if (!mediaChanged) {
    delete next.media;
    return next;
  }
  const localMedia = data.media || [];
  const localIds = new Set(localMedia.map((media) => media.id));
  next.media = [
    ...localMedia,
    ...currentServerMedia.filter((media) =>
      !localIds.has(media.id) && !removedMediaIds.has(media.id)
    ),
  ];
  return next;
}

export function updateCanonicalItemText(
  data: HostOnboardingData,
  itemId: string,
  change: { title?: string; body?: string },
): HostOnboardingData {
  const current = (data.canonicalItems || []).find((item) => item.id === itemId);
  if (
    !current ||
    (change.title === undefined || change.title === current.title) &&
    (change.body === undefined || change.body === current.body)
  ) {
    return data;
  }
  return {
    ...data,
    canonicalItems: (data.canonicalItems || []).map((item) =>
      item.id === itemId ? { ...item, ...change } : item
    ),
  };
}

export function canonicalHostRowIds(data: HostOnboardingData) {
  return {
    contacts: new Set(data.contacts?.map((row) => row.id) || []),
    offers: new Set(data.offers?.map((row) => row.id) || []),
    events: new Set(data.events?.map((row) => row.id) || []),
  };
}

export function omitLegacyRichAliasForCanonicalItems(
  data: HostOnboardingData,
): HostOnboardingData {
  const next = { ...data };
  const hasCanonicalHouseItems = next.canonicalItems?.some(
    (item) => item.sectionKey === "stay" && item.categoryKey === "house",
  );
  if (hasCanonicalHouseItems) delete next.houseRulesParking;
  return next;
}

export function persistedHostOnboardingSubmitPayload(
  round: number,
  revision: number,
  canonicalRevision: string,
) {
  return { round, revision, canonicalRevision };
}

export function changedHostOnboardingFields(
  current: HostOnboardingData,
  baseline: HostOnboardingData,
): Partial<HostOnboardingData> {
  const patch: Partial<HostOnboardingData> = {};
  for (const key of Object.keys(current) as Array<keyof HostOnboardingData>) {
    if (key === "canonicalItems") {
      const baselineRows = new Map(
        (baseline.canonicalItems || []).map((row) => [row.id, row]),
      );
      const changedRows = (current.canonicalItems || []).filter(
        (row) => JSON.stringify(row) !== JSON.stringify(baselineRows.get(row.id)),
      );
      if (changedRows.length) patch.canonicalItems = changedRows;
      continue;
    }
    if (JSON.stringify(current[key]) !== JSON.stringify(baseline[key])) {
      (patch as Record<string, unknown>)[key] = current[key];
    }
  }
  return patch;
}

const customFetch = async (url: string, options?: RequestInit) => {
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
    credentials: "include",
  });
  if (!res.ok) {
    let msg = "Napaka pri zahtevi";
    let currentRevision: number | undefined;
    try {
      const errData = await res.json();
      if (errData.message) msg = errData.message;
      if (typeof errData.currentRevision === "number") currentRevision = errData.currentRevision;
    } catch {}
    const error = new Error(msg) as Error & { status?: number; currentRevision?: number };
    error.status = res.status;
    error.currentRevision = currentRevision;
    throw error;
  }
  if (res.status === 204) return undefined;
  return res.json();
};

export function fetchHostOnboardingSnapshot(): Promise<HostOnboardingResponse> {
  return customFetch("/api/admin/host/onboarding");
}

// Host endpoints

export const getHostOnboardingQueryKey = () => ["host-onboarding"];

export function useGetHostOnboarding(options?: { enabled?: boolean }) {
  return useQuery<HostOnboardingResponse>({
    queryKey: getHostOnboardingQueryKey(),
    queryFn: () => customFetch("/api/admin/host/onboarding"),
    enabled: options?.enabled,
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });
}

type HostOnboardingWriteResult = {
  ok: true;
  revision: number;
  updatedAt: string;
  canonicalRevision: string;
  /** Canonical server projection, when returned by the direct-draft endpoint. */
  data?: HostOnboardingData;
  photos?: HostOnboardingPhoto[];
  categories?: HostOnboardingCategory[];
  contentSections?: HostOnboardingContentSection[];
  recommendationProcessing?: HostOnboardingRecommendationProcessing | null;
};

function applyWriteResult(
  current: HostOnboardingResponse | undefined,
  result: HostOnboardingWriteResult,
  submitted: Partial<HostOnboardingData>,
): HostOnboardingResponse | undefined {
  if (!current) return current;
  return {
    ...current,
    data: result.data ?? { ...current.data, ...submitted },
    photos: result.photos ?? current.photos,
    categories: result.categories ?? current.categories,
    contentSections: result.contentSections ?? current.contentSections,
    revision: result.revision,
    canonicalRevision: result.canonicalRevision,
    updatedAt: result.updatedAt,
    recommendationProcessing: "recommendationProcessing" in result
      ? result.recommendationProcessing
      : current.recommendationProcessing,
  };
}

export function usePatchHostOnboarding() {
  const queryClient = useQueryClient();
  return useMutation<HostOnboardingWriteResult, Error, {
    data: Partial<HostOnboardingData>;
    revision: number;
    canonicalRevision: string;
  }>({
    mutationFn: (payload) =>
      customFetch("/api/admin/host/onboarding", {
        method: "PATCH",
        body: JSON.stringify(payload),
      }),
    onSuccess: (result, variables) => {
      queryClient.setQueryData<HostOnboardingResponse>(getHostOnboardingQueryKey(), (current) =>
        applyWriteResult(current, result, variables.data),
      );
    },
  });
}

export function useSaveHostOnboarding() {
  const queryClient = useQueryClient();
  return useMutation<HostOnboardingWriteResult, Error, {
    data: Partial<HostOnboardingData>;
    revision: number;
    canonicalRevision: string;
  }>({
    mutationFn: (payload) =>
      customFetch("/api/admin/host/onboarding/save", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: (result, variables) => {
      queryClient.setQueryData<HostOnboardingResponse>(getHostOnboardingQueryKey(), (current) =>
        applyWriteResult(current, result, variables.data),
      );
    },
  });
}

export function useCreateHostOnboardingCategory() {
  const queryClient = useQueryClient();
  return useMutation<HostOnboardingResponse, Error, {
    sourceId: string;
    sectionKey: "stay" | "offer";
    name: string;
    revision: number;
    canonicalRevision: string;
  }>({
    mutationFn: (payload) =>
      customFetch("/api/admin/host/onboarding/categories", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: (result) => {
      queryClient.setQueryData<HostOnboardingResponse>(getHostOnboardingQueryKey(), result);
      // The canonical category is shared with the admin content and
      // translation views. Mark those reads stale without hydrating the host
      // form from them; dirty host fields remain protected by the onboarding
      // hydration gate.
      void queryClient.invalidateQueries({
        queryKey: getGetTenantQueryKey(result.tenantId),
        exact: true,
      });
      void queryClient.invalidateQueries({
        queryKey: getListTenantTranslationsQueryKey(result.tenantId),
      });
      void queryClient.invalidateQueries({
        queryKey: getGetTranslationOverviewQueryKey(result.tenantId),
        exact: true,
      });
    },
  });
}

export function useSubmitHostOnboarding() {
  const queryClient = useQueryClient();
  return useMutation<{
    ok: true;
    alreadySubmitted: boolean;
    message: string;
    recommendationProcessing?: HostOnboardingRecommendationProcessing | null;
  }, Error, {
    round: number;
    data?: HostOnboardingData;
    revision: number;
    canonicalRevision: string;
  }>({
    mutationFn: (payload) =>
      customFetch("/api/admin/host/onboarding/submit", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: (result, variables) => {
      queryClient.setQueryData<HostOnboardingResponse>(getHostOnboardingQueryKey(), (current) =>
        current ? {
          ...current,
          data: variables.data ?? current.data,
          status: "submitted",
          submittedAt: new Date().toISOString(),
          recommendationProcessing: "recommendationProcessing" in result
            ? result.recommendationProcessing
            : current.recommendationProcessing,
        } : current,
      );
    },
  });
}

export function useRetryHostOnboardingRecommendations() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => retryHostOnboardingRecommendations(),
    onSuccess: (result) => {
      queryClient.setQueryData<HostOnboardingResponse>(
        getHostOnboardingQueryKey(),
        (current) => current ? {
          ...current,
          recommendationProcessing: result.recommendationProcessing,
        } : current,
      );
    },
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: getHostOnboardingQueryKey(),
        exact: true,
      });
    },
  });
}

export function useUploadPhotoUrl() {
  return useMutation({
    mutationFn: (payload: { fileName: string; contentType: string; size: number }) =>
      customFetch("/api/admin/host/onboarding/photos/upload-url", {
        method: "POST",
        body: JSON.stringify(payload),
      }) as Promise<{ uploadUrl: string; objectPath: string; photoId: string }>,
  });
}

export function useCompletePhoto() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (photoId: string) =>
      customFetch(`/api/admin/host/onboarding/photos/${photoId}/complete`, { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: getHostOnboardingQueryKey() });
    },
  });
}

export function useDeletePhoto() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (photoId: string) =>
      customFetch(`/api/admin/host/onboarding/photos/${photoId}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: getHostOnboardingQueryKey() });
    },
  });
}

// Owner endpoints

export const getOwnerOnboardingQueryKey = (tenantId: string) => ["owner-onboarding", tenantId];

export interface OwnerTargetReview {
  target: string;
  hostValue: unknown;
  operatorValue: unknown;
  resolution: "filled_blank" | "suggestion" | "unchanged";
  suggestionVisible: boolean;
}
export interface OwnerOnboardingRound extends Omit<HostOnboardingResponse, "tenantId" | "categories"> {
  targetReview: OwnerTargetReview[];
  recommendations: Array<{ categoryKey: string; name: string; proposalId: string | null }>;
  customCategories: Array<{
    id: string;
    name: string;
    hostCreated: true;
    provenance: string;
    categoryId: string | null;
    entries: Array<{ id: string; name: string; proposalId: string | null }>;
  }>;
  events: Array<{ id: string; name: string; date: string; time: string; status: "pending" }>;
  notification: {
    status: "pending" | "sending" | "sent" | "failed";
    recipient: string;
    providerMessageId: string | null;
    error: string | null;
    attemptedAt: string | null;
  };
  createdAt: string;
}
export function useGetOwnerOnboarding(tenantId: string, options?: { enabled?: boolean }) {
  return useQuery<{ tenantId: string; tenantName: string; rounds: OwnerOnboardingRound[] }>({
    queryKey: getOwnerOnboardingQueryKey(tenantId),
    queryFn: () => customFetch(`/api/admin/tenants/${tenantId}/host/onboarding`),
    enabled: options?.enabled,
  });
}

export function useOpenOnboarding(tenantId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      customFetch(`/api/admin/tenants/${tenantId}/host/onboarding/open`, { method: "POST", body: "{}" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: getOwnerOnboardingQueryKey(tenantId) });
    },
  });
}

export function useReopenOnboarding(tenantId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (idempotencyKey: string) =>
      customFetch(`/api/admin/tenants/${tenantId}/host/onboarding/reopen`, {
        method: "POST",
        headers: { "Idempotency-Key": idempotencyKey },
        body: "{}"
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: getOwnerOnboardingQueryKey(tenantId) });
    },
  });
}
