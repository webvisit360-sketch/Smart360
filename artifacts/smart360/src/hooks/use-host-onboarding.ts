import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

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
  offers?: Array<{ id: string; name: string; price: string }>;
  recommendations?: Array<{ id: string; categoryId: string; name: string }>;
  customCategories?: Array<{
    id: string;
    name: string;
    entries: Array<{ id: string; name: string }>;
  }>;
  events?: Array<{ id: string; name: string; date: string; time: string }>;
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
}

export interface HostOnboardingResponse {
  id: string;
  tenantId: string;
  round: number;
  status: "draft" | "submitted";
  data: HostOnboardingData;
  categories: HostOnboardingCategory[];
  photos: HostOnboardingPhoto[];
  updatedAt: string;
  submittedAt: string | null;
  revision: number;
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

// Host endpoints

export const getHostOnboardingQueryKey = () => ["host-onboarding"];

export function useGetHostOnboarding(options?: { enabled?: boolean }) {
  return useQuery<HostOnboardingResponse>({
    queryKey: getHostOnboardingQueryKey(),
    queryFn: () => customFetch("/api/admin/host/onboarding"),
    enabled: options?.enabled,
  });
}

export function usePatchHostOnboarding() {
  const queryClient = useQueryClient();
  return useMutation<{ ok: true; revision: number; updatedAt: string }, Error, { data: Partial<HostOnboardingData>; revision: number }>({
    mutationFn: (payload: { data: Partial<HostOnboardingData>; revision?: number }) =>
      customFetch("/api/admin/host/onboarding", {
        method: "PATCH",
        body: JSON.stringify(payload),
      }),
    onSuccess: (result, variables) => {
      queryClient.setQueryData<HostOnboardingResponse>(getHostOnboardingQueryKey(), (current) =>
        current ? { ...current, data: { ...current.data, ...variables.data }, revision: result.revision, updatedAt: result.updatedAt } : current,
      );
    },
  });
}

export function useSaveHostOnboarding() {
  const queryClient = useQueryClient();
  return useMutation<{ ok: true; revision: number; updatedAt: string }, Error, { data: Partial<HostOnboardingData>; revision: number }>({
    mutationFn: (payload: { data: Partial<HostOnboardingData>; revision?: number }) =>
      customFetch("/api/admin/host/onboarding/save", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: (result, variables) => {
      queryClient.setQueryData<HostOnboardingResponse>(getHostOnboardingQueryKey(), (current) =>
        current ? { ...current, data: { ...current.data, ...variables.data }, revision: result.revision, updatedAt: result.updatedAt } : current,
      );
    },
  });
}

export function useSubmitHostOnboarding() {
  const queryClient = useQueryClient();
  return useMutation<{ ok: true; alreadySubmitted: boolean; message: string }, Error, { round: number; data: HostOnboardingData; revision: number }>({
    mutationFn: (payload) =>
      customFetch("/api/admin/host/onboarding/submit", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: (_result, variables) => {
      queryClient.setQueryData<HostOnboardingResponse>(getHostOnboardingQueryKey(), (current) =>
        current ? { ...current, data: variables.data, status: "submitted", submittedAt: new Date().toISOString() } : current,
      );
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
