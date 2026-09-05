export type TenantNotificationChannel = "email" | "whatsapp";

export const NOTIFICATION_PHONE_ERROR =
  "Vpišite veljavno mednarodno številko E.164 (npr. +38641234567), nato izberite WhatsApp.";

export const WHATSAPP_NOT_CONFIGURED_ERROR = "WhatsApp še ni nastavljen";

export function notificationWhatsappPhoneForSave(value: string): string | undefined {
  const trimmed = value.trim();
  return /^\+[1-9]\d{7,14}$/.test(trimmed) ? trimmed : undefined;
}

export function selectNotificationChannel(
  current: TenantNotificationChannel,
  requested: TenantNotificationChannel,
  whatsappConfigured: boolean,
  whatsappPhone: string,
): { channel: TenantNotificationChannel; error: string | null } {
  if (requested === "email") {
    return { channel: "email", error: null };
  }
  if (!whatsappConfigured) {
    return { channel: current, error: WHATSAPP_NOT_CONFIGURED_ERROR };
  }
  if (!notificationWhatsappPhoneForSave(whatsappPhone)) {
    return { channel: current, error: NOTIFICATION_PHONE_ERROR };
  }
  return { channel: "whatsapp", error: null };
}