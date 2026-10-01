import { notificationWhatsappPhoneForSave } from "./notification-channel";

/** A restricted save must not mark hidden, still-unsaved draft fields as saved. */
export function savedTenantDraft<T extends object>(previous: T, snapshot: T, payload: object): T {
  const saved = { ...previous };
  for (const key of Object.keys(payload) as Array<keyof T>) {
    if (key in snapshot) saved[key] = snapshot[key];
  }
  return saved;
}

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
  tourRecordingEnabled?: boolean;
}>(snapshot: T, quotaGb: string, isOwner: boolean, canManageContent = isOwner) {
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
    const contacts = {
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
    if (!canManageContent) return contacts;
    // Explicit host allowlist: never carry a stale slug, unpublish toggle, quota,
    // review/subscription field, management mode or future operator field into autosave.
    const editableFields = [
      "name", "subtitle", "customDomain", "theme", "mapQuery", "mapUrl", "tourUrl",
      "tourRecordingEnabled", "heroUrl", "logoUrl", "coverTitle", "coverSubtitle",
      "coverTitleSize", "coverTitleOpacity", "coverTextColor", "coverSubSize",
      "coverSubOpacity", "coverMetaSize", "coverMetaOpacity", "coverVeil", "tileVeil",
      "textScale", "textFont", "textColor", "coverAlign", "coverShowRating",
      "logoX", "logoY", "logoW", "logoOpacity", "navColorCover", "navColor",
      "navColorOn", "bgColor",
    ] as const;
    const hostData: Record<string, unknown> = { ...contacts };
    for (const field of editableFields) {
      if (field in data) hostData[field] = (data as Record<string, unknown>)[field];
    }
    return hostData as typeof contacts;
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