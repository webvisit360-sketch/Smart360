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
  wifiEnc?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  viber?: string | null;
  instagram?: string | null;
  notificationChannel?: "email" | "whatsapp";
  orderNotifyEmail?: boolean;
  messageNotifyEmail?: boolean;
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
    // Explicit allowlist: a newly added operator setting must never leak into
    // a host autosave (or the save-before-publish path).
    return {
      wifiSsid: data.wifiSsid,
      wifiPass: data.wifiPass,
      wifiEnc: snapshot.wifiEnc,
      phone: snapshot.phone,
      email: data.email,
      whatsapp: snapshot.whatsapp,
      viber: snapshot.viber,
      instagram: snapshot.instagram,
      notificationChannel: snapshot.notificationChannel,
      notificationWhatsappPhone: data.notificationWhatsappPhone,
      orderNotifyEmail: snapshot.orderNotifyEmail,
      messageNotifyEmail: snapshot.messageNotifyEmail,
    };
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