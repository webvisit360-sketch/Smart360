import { notificationWhatsappPhoneForSave } from "./notification-channel";

// Shared by debounced autosave and the explicit save-before-publish path.
export function tenantSavePayload<T extends {
  slug: string;
  customDomain: string;
  email: string;
  mapUrl: string;
  wifiSsid: string;
  wifiPass: string;
  notificationWhatsappPhone: string;
  latitude?: unknown;
  longitude?: unknown;
  guestUiMode?: unknown;
}>(snapshot: T, quotaGb: string, isOwner: boolean) {
  const {
    latitude: _latitude,
    longitude: _longitude,
    guestUiMode: _guestUiMode,
    ...saveData
  } = snapshot;
  const data = {
    ...saveData,
    customDomain: snapshot.customDomain.trim() || null,
    email: snapshot.email.trim() || null,
    mapUrl: snapshot.mapUrl.trim() || null,
    wifiSsid: snapshot.wifiSsid.trim() || null,
    wifiPass: snapshot.wifiPass || null,
    mediaQuotaBytes: Math.round(Math.max(0.1, parseFloat(quotaGb.replace(",", ".")) || 2) * 1_000_000_000),
    notificationWhatsappPhone: notificationWhatsappPhoneForSave(snapshot.notificationWhatsappPhone),
  };
  if (!isOwner) {
    const hostDeniedFields = [
      "slug", "customDomain", "isTemplate", "mediaQuotaBytes", "renewsAt",
      "rating", "reviewsCount", "coordinateOverride",
    ] as const;
    for (const field of hostDeniedFields) {
      delete (data as Record<string, unknown>)[field];
    }
  }
  return data;
}

export function publicationDraftChanged(
  currentForm: unknown,
  lastSavedForm: unknown,
  currentQuota: string,
  lastSavedQuota: string,
): boolean {
  return JSON.stringify(currentForm) !== JSON.stringify(lastSavedForm)
    || currentQuota !== lastSavedQuota;
}

export function publicationNeedsConfirmation({
  cachedDirty,
  localDirty,
  previewTotal,
  allowCleanAutoPublish,
}: {
  cachedDirty: boolean;
  localDirty: boolean;
  previewTotal: number;
  allowCleanAutoPublish: boolean;
}): boolean {
  return !allowCleanAutoPublish || cachedDirty || localDirty || previewTotal > 0;
}