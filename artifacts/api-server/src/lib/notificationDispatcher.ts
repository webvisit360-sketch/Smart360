import { db, notificationDeliveryAttemptsTable } from "@workspace/db";
import { logger } from "./logger";
import {
  sendWhatsappTemplate,
  type WhatsAppTemplatePayload,
} from "./whatsapp";

export type NotificationChannel = "email" | "whatsapp";
export type NotificationKind = "order" | "message";
export type AdapterResult =
  | { ok: true; providerMessageId?: string }
  | { ok: false; providerError?: string };

export interface DispatchNotification {
  tenantId: string;
  kind: NotificationKind;
  notificationId: string;
  channel: NotificationChannel;
  emailRecipient: string | null;
  whatsappRecipient: string | null;
  sendEmail: () => Promise<AdapterResult>;
  whatsappPayload: Omit<WhatsAppTemplatePayload, "kind" | "notificationId" | "to">;
}

export interface DispatcherDependencies {
  sendWhatsapp?: typeof sendWhatsappTemplate;
  persistAttempt?: (row: typeof notificationDeliveryAttemptsTable.$inferInsert) => Promise<void>;
}

async function defaultPersistAttempt(
  row: typeof notificationDeliveryAttemptsTable.$inferInsert,
): Promise<void> {
  await db.insert(notificationDeliveryAttemptsTable).values(row);
}

export async function dispatchNotification(
  input: DispatchNotification,
  dependencies: DispatcherDependencies = {},
): Promise<{ ok: boolean; usedFallback: boolean; evidencePersisted: boolean; error?: string }> {
  const persist = dependencies.persistAttempt ?? defaultPersistAttempt;
  const record = async (
    channel: NotificationChannel,
    recipient: string,
    result: AdapterResult,
    fallbackFrom?: NotificationChannel,
    fallbackTriggerError?: string,
  ): Promise<boolean> => {
    try {
      await persist({
        tenantId: input.tenantId,
        notificationKind: input.kind,
        notificationId: input.notificationId,
        channel,
        recipient,
        outcome: result.ok ? "sent" : "failed",
        providerMessageId: result.ok ? result.providerMessageId ?? null : null,
        providerError: result.ok ? null : result.providerError ?? "Neznana napaka ponudnika.",
        fallbackFrom: fallbackFrom ?? null,
        fallbackTriggerError: fallbackTriggerError ?? null,
      });
      return true;
    } catch (error) {
      logger.error(
        {
          tenantId: input.tenantId,
          notificationId: input.notificationId,
          errName: error instanceof Error ? error.name : "Error",
        },
        "[notifications] delivery evidence persistence failed",
      );
      return false;
    }
  };

  if (input.channel === "email") {
    if (!input.emailRecipient) {
      return { ok: false, usedFallback: false, evidencePersisted: true, error: "Manjka e-poštni naslov prejemnika." };
    }
    const result = await input.sendEmail();
    const evidencePersisted = await record("email", input.emailRecipient, result);
    return {
      ok: result.ok && evidencePersisted,
      usedFallback: false,
      evidencePersisted,
      ...(!result.ok ? { error: result.providerError ?? "Pošiljanje e-pošte ni uspelo." } : {}),
      ...(!evidencePersisted ? { error: "Dokaza o dostavi ni bilo mogoče shraniti." } : {}),
    };
  }

  if (!input.whatsappRecipient) {
    return { ok: false, usedFallback: false, evidencePersisted: true, error: "Manjka WhatsApp številka prejemnika." };
  }
  const whatsapp = await (dependencies.sendWhatsapp ?? sendWhatsappTemplate)({
    ...input.whatsappPayload,
    kind: input.kind,
    notificationId: input.notificationId,
    to: input.whatsappRecipient,
  });
  const waError = whatsapp.ok ? undefined : whatsapp.providerError;
  const waPersisted = await record(
    "whatsapp",
    input.whatsappRecipient,
    whatsapp.ok
      ? { ok: true, providerMessageId: whatsapp.providerMessageId }
      : { ok: false, providerError: whatsapp.providerError },
  );
  if (whatsapp.ok) {
    return {
      ok: waPersisted,
      usedFallback: false,
      evidencePersisted: waPersisted,
      ...(!waPersisted ? { error: "Dokaza o dostavi ni bilo mogoče shraniti." } : {}),
    };
  }

  if (!input.emailRecipient) {
    return { ok: false, usedFallback: false, evidencePersisted: waPersisted, error: waError };
  }
  const email = await input.sendEmail();
  const emailPersisted = await record(
    "email",
    input.emailRecipient,
    email,
    "whatsapp",
    waError,
  );
  return {
    ok: email.ok && waPersisted && emailPersisted,
    usedFallback: true,
    evidencePersisted: waPersisted && emailPersisted,
    ...(!email.ok ? { error: email.providerError ?? "Tudi nadomestna e-pošta ni bila dostavljena." } : {}),
    ...(!(waPersisted && emailPersisted) ? { error: "Dokaza o dostavi ni bilo mogoče shraniti." } : {}),
  };
}