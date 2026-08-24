/**
 * Email notification adapter for guest–host messaging.
 *
 * Design notes (PII-safe):
 * - Email contains ONLY: tenant name and a prompt to open the admin portal.
 * - Never includes: message body, guest name, guest unit, raw device token, IP.
 * - Uses "message-<messageId>" as the Resend idempotency key. One notification
 *   per inserted message row — every guest message may trigger a bell, not just
 *   the first one in the thread. The stable non-PII key prevents duplicate sends
 *   if the fire-and-forget task is retried.
 * - Returns { ok: true } on 2xx, { ok: false } otherwise.
 * - Logs only messageId + threadRef + HTTP status or exception class — never PII.
 *   Exception message text is never logged (may contain request context).
 */
import { ReplitConnectors } from "@replit/connectors-sdk";
import { logger } from "./logger";
import { emailFrom as orderEmailFrom } from "./orderEmail";
import { cta, p as par, portalUrl, renderEmail } from "./emailTemplate";

const connectors = new ReplitConnectors();

export const MESSAGE_EMAIL_FROM_NAME = "Smart360";

/**
 * Returns the sender address for message notifications.
 * Reuses the ORDER_EMAIL_FROM variable (same verified sender).
 * Throws if not configured — callers should guard and skip if missing.
 */
export function messageEmailFrom(): string {
  // Reuse the same verified sender as orders.
  return orderEmailFrom();
}

export interface MessageNotifyPayload {
  /** Tenant's notification email address. Required — caller must verify before calling. */
  to: string;
  /** Tenant display name. Never the guest's name. */
  tenantName: string;
  /**
   * Guest's accommodation unit (e.g. "Apartma 3"). The ONLY guest datum the
   * approved template shows — it identifies the stay, not the person. Message
   * content, guest name and phone stay in the portal.
   */
  guestUnit: string;
  /**
   * The UUID of the newly inserted message row.
   * Used to build the Resend idempotency key: "message-<messageId>".
   * Ensures one notification attempt per guest message, not per thread.
   * No PII — it is an opaque internal UUID.
   */
  messageId: string;
  /**
   * The thread reference UUID. Included in log entries only for correlation.
   * Never included in the email body.
   */
  threadRef: string;
}

/**
 * Build the Resend request body for a message notification.
 * Pure function — no I/O; exported for unit tests.
 *
 * Approved template #3 (emaili-gostitelju): tenant brand, guest UNIT only
 * (deliberately no message content, name or phone), green "Odpri portal" CTA.
 */
export function buildMessageEmailBody(
  p: MessageNotifyPayload,
  from: string,
): Record<string, unknown> {
  const subject = `Novo sporočilo · ${p.guestUnit}`;
  const { html, text } = renderEmail({
    subject,
    preheader: "Odprite portal za odgovor",
    brand: p.tenantName,
    title: "Novo sporočilo",
    blocks: [
      par("Gost iz enote ", { b: p.guestUnit }, " vam je poslal sporočilo."),
      par(
        "Vsebine sporočila v e-pošto namenoma ne pošiljamo — preberete in odgovorite jo v portalu.",
      ),
      cta("Odpri portal", portalUrl()),
    ],
    footerLines: [
      "Smart360 · digitalni vodnik za goste",
      "Obveščanje o sporočilih lahko izklopite v portalu pod Nastavitve.",
    ],
  });

  return {
    from: `${MESSAGE_EMAIL_FROM_NAME} <${from}>`,
    reply_to: from,
    to: [p.to],
    subject,
    html,
    text,
  };
}

/**
 * Build HTTP headers for the Resend proxy call.
 *
 * Idempotency key is "message-<messageId>" — scoped to the newly inserted
 * message row so every guest message may produce a notification bell, not just
 * the first one in the thread. The stable non-PII key prevents duplicate sends
 * if the fire-and-forget send is retried.
 */
export function buildMessageEmailHeaders(messageId: string): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "Idempotency-Key": `message-${messageId}`,
  };
}

export type EmailResult = { ok: true; resendId?: string } | { ok: false };

/**
 * Send a PII-safe message notification via the Resend connector.
 *
 * - Only sends tenant name and a portal open prompt. Never body, name, unit,
 *   raw token, or IP.
 * - Returns { ok: true } on HTTP 2xx.
 * - Returns { ok: false } on non-2xx or any exception.
 * - Logs only messageId + threadRef + HTTP status or exception class.
 *   Never logs exception message text (may contain request context).
 */
export async function sendMessageNotification(
  p: MessageNotifyPayload,
): Promise<EmailResult> {
  const from = messageEmailFrom();
  const body = buildMessageEmailBody(p, from);
  const headers = buildMessageEmailHeaders(p.messageId);

  try {
    const resp = await connectors.proxy("resend", "/emails", {
      method: "POST",
      body,
      headers,
    });

    if (!resp.ok) {
      logger.error(
        { messageId: p.messageId, threadRef: p.threadRef, httpStatus: resp.status },
        "[messageEmail] Resend rejected the request",
      );
      return { ok: false };
    }

    const accepted = await resp.json().catch(() => null);
    const resendId =
      accepted &&
      typeof accepted === "object" &&
      "id" in accepted &&
      typeof accepted.id === "string"
        ? accepted.id
        : undefined;

    logger.info(
      { messageId: p.messageId, threadRef: p.threadRef, resendId: resendId ?? null },
      "[messageEmail] notification accepted by Resend",
    );
    return { ok: true, resendId };
  } catch (err) {
    // Log only the exception class name — never the message text, which may
    // contain request context such as URLs or headers.
    const errName = err instanceof Error ? err.constructor.name : "UnknownError";
    logger.error(
      { messageId: p.messageId, threadRef: p.threadRef, errName },
      "[messageEmail] unexpected error contacting Resend",
    );
    return { ok: false };
  }
}
