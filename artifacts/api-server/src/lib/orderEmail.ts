/**
 * Email notification adapter for Living Guide orders.
 *
 * Uses @replit/connectors-sdk ReplitConnectors to proxy through the Resend
 * connector.  The sender address MUST come from ORDER_EMAIL_FROM environment
 * variable — no default is provided; a missing var is a configuration error.
 *
 * Contract:
 * - Returns { ok: true } when Resend accepted the email (2xx response).
 * - Returns { ok: false } and logs the error (without PII) on failure.
 * - NEVER leaks guest PII (phone, name, note) into log entries.
 * - Error log entries carry only: orderRef, HTTP status code or error name.
 * - Passes orderRef as 'Idempotency-Key' header (Resend documented standard)
 *   so provider re-accepts retries without sending a duplicate email.
 *
 * buildEmailHeaders / buildEmailBody are exported as pure functions so tests
 * can verify the exact outbound header name and payload without I/O.
 */
import { ReplitConnectors } from "@replit/connectors-sdk";
import { logger } from "./logger";

const connectors = new ReplitConnectors();

/**
 * Sender address from environment.  Must be configured — no fallback.
 * Callers should check this at startup or fail clearly if missing.
 */
export function emailFrom(): string {
  const v = process.env["ORDER_EMAIL_FROM"];
  if (!v) {
    throw new Error(
      "ORDER_EMAIL_FROM environment variable is not set. " +
        "Configure a verified Resend sender address before enabling orders.",
    );
  }
  return v;
}

export interface OrderEmailPayload {
  /** Tenant's notification email address. Required — caller must check before calling. */
  to: string;
  tenantName: string;
  /** Real order reference UUID (not a placeholder). */
  orderRef: string;
  itemTitle: string | null | undefined;
  price: string | null | undefined;
  priceUnit: string | null | undefined;
  fulfillment: string | null | undefined;
  producerName: string | null | undefined;
  qty: number;
  guestName: string;
  /** Phone shown in email — operator needs it to call back. */
  guestPhone: string;
  /** Guest's accommodation/unit from sign-in (for example B-14). */
  guestUnit: string;
  guestNote: string | null | undefined;
}

function escHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Build the Resend request body for an order notification.
 * Pure function — no I/O; exported for unit tests.
 */
export function buildEmailBody(
  p: OrderEmailPayload,
  from: string,
): Record<string, unknown> {
  const shortRef = p.orderRef.replace(/-/g, "").slice(0, 8).toUpperCase();
  const priceStr = [p.price, p.priceUnit].filter(Boolean).join(" / ") || "—";
  const fulfillmentStr = p.fulfillment ?? "—";
  const producerStr = p.producerName ?? "—";
  const noteRow = p.guestNote
    ? `<tr><td style="padding:6px 0;color:#666;vertical-align:top">Opomba gosta</td><td>${escHtml(p.guestNote)}</td></tr>`
    : "";

  const html = `<!DOCTYPE html>
<html lang="sl">
<head><meta charset="utf-8"><title>Novo naročilo – ${escHtml(p.tenantName)}</title></head>
<body style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px">
  <h1 style="font-size:20px;margin-bottom:4px">Novo naročilo #${escHtml(shortRef)}</h1>
  <p style="color:#666;margin-top:0;font-size:13px">Celotna referenca: ${escHtml(p.orderRef)}</p>
  <table style="border-collapse:collapse;width:100%;margin-top:16px">
    <tr><td style="padding:6px 0;color:#666;width:140px">Artikel</td><td><strong>${escHtml(p.itemTitle ?? "—")}</strong></td></tr>
    <tr><td style="padding:6px 0;color:#666">Cena</td><td>${escHtml(priceStr)}</td></tr>
    <tr><td style="padding:6px 0;color:#666">Količina</td><td>${p.qty}</td></tr>
    <tr><td style="padding:6px 0;color:#666">Prevzem / dostava</td><td>${escHtml(fulfillmentStr)}</td></tr>
    <tr><td style="padding:6px 0;color:#666">Pridelovalec</td><td>${escHtml(producerStr)}</td></tr>
    <tr><td style="padding:6px 0;color:#666">Ime gosta</td><td>${escHtml(p.guestName)}</td></tr>
    <tr><td style="padding:6px 0;color:#666">Enota gosta</td><td>${escHtml(p.guestUnit)}</td></tr>
    <tr><td style="padding:6px 0;color:#666">Telefon gosta</td><td>${escHtml(p.guestPhone)}</td></tr>
    ${noteRow}
  </table>
  <hr style="margin:24px 0;border:none;border-top:1px solid #eee">
  <p style="color:#999;font-size:12px">Smart360 · ${escHtml(p.tenantName)}</p>
</body>
</html>`;

  return {
    from,
    to: [p.to],
    subject: `Novo naročilo: ${p.itemTitle ?? shortRef} – ${p.tenantName}`,
    html,
  };
}

/**
 * Build the HTTP headers for the Resend proxy call.
 * Pure function — no I/O; exported for unit tests.
 *
 * Uses 'Idempotency-Key' (Resend documented standard header name).
 * The value is the orderRef UUID so provider deduplication is tied to the
 * canonical order row — safe for retry and crash recovery.
 */
export function buildEmailHeaders(orderRef: string): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "Idempotency-Key": orderRef,
  };
}

export type EmailResult = { ok: true } | { ok: false };

/**
 * Send an order notification email via the Resend connector.
 *
 * - All email content MUST come from the stored order snapshot fields —
 *   never from the current request or current item/tenant values.
 * - Returns { ok: true } on HTTP 2xx.
 * - Returns { ok: false } on non-2xx or any exception.
 * - Logs only orderRef + status/error name — never guest PII.
 */
export async function sendOrderEmail(p: OrderEmailPayload): Promise<EmailResult> {
  // emailFrom() throws if ORDER_EMAIL_FROM is not set — let it propagate so
  // the caller can return 422 with a configuration-error message.
  const from = emailFrom();
  const body = buildEmailBody(p, from);
  const headers = buildEmailHeaders(p.orderRef);

  try {
    const resp = await connectors.proxy("resend", "/emails", {
      method: "POST",
      body,
      headers,
    });

    // The connectors SDK returns a standard fetch Response object.
    if (!resp.ok) {
      // Log HTTP status only — never include resp body (may echo PII)
      logger.error(
        { orderRef: p.orderRef, httpStatus: resp.status },
        "[orderEmail] Resend rejected the request",
      );
      return { ok: false };
    }

    logger.info({ orderRef: p.orderRef }, "[orderEmail] notification accepted by Resend");
    return { ok: true };
  } catch (err) {
    // Log only the error name/message — never the full err object which may
    // serialise the outgoing body containing guest PII.
    const errName = err instanceof Error ? err.constructor.name : "UnknownError";
    const errMsg = err instanceof Error ? err.message.slice(0, 120) : String(err).slice(0, 120);
    logger.error(
      { orderRef: p.orderRef, errName, errMsg },
      "[orderEmail] unexpected error contacting Resend",
    );
    return { ok: false };
  }
}
