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

const connectors = new ReplitConnectors();

export const MESSAGE_EMAIL_FROM_NAME = "Smart360 sporočila";

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

function escHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Build the Resend request body for a message notification.
 * Pure function — no I/O; exported for unit tests.
 *
 * Contains: only tenant name and a portal link prompt. No message content, no
 * guest data.
 */
export function buildMessageEmailBody(
  p: MessageNotifyPayload,
  from: string,
): Record<string, unknown> {
  const html = `<!DOCTYPE html>
<html lang="sl">
<head><meta charset="utf-8"><title>Novo sporočilo – ${escHtml(p.tenantName)}</title></head>
<body style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px">
  <h1 style="font-size:20px;margin-bottom:4px">Novo sporočilo gosta</h1>
  <p style="color:#666;margin-top:0;font-size:14px">
    Gost je poslal sporočilo. Odprite skrbniški portal za ogled in odgovor.
  </p>
  <hr style="margin:24px 0;border:none;border-top:1px solid #eee">
  <p style="color:#999;font-size:12px">Smart360 · ${escHtml(p.tenantName)}</p>
</body>
</html>`;

  return {
    from: `${MESSAGE_EMAIL_FROM_NAME} <${from}>`,
    reply_to: from,
    to: [p.to],
    subject: `Novo sporočilo – odprite portal`,
    html,
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
