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
import { BUSINESS_CONTACT_EMAIL } from "./businessContact";
import { logger } from "./logger";
import { cta, p as par, portalUrl, renderEmail, rows, small } from "./emailTemplate";

const connectors = new ReplitConnectors();
export const ORDER_EMAIL_FROM_ADDRESS = "info@webvisit360.com";
export const ORDER_EMAIL_FROM_NAME = "Smart360";

/**
 * Sender address from environment.  Must be configured — no fallback.
 * Callers should check this at startup or fail clearly if missing.
 */
export function emailFrom(): string {
  const v = process.env["ORDER_EMAIL_FROM"]?.trim().toLowerCase();
  if (!v) {
    throw new Error(
      "ORDER_EMAIL_FROM environment variable is not set. " +
        "Configure a verified Resend sender address before enabling orders.",
    );
  }
  if (v !== ORDER_EMAIL_FROM_ADDRESS) {
    throw new Error(
      `ORDER_EMAIL_FROM must be the verified sender ${ORDER_EMAIL_FROM_ADDRESS}.`,
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
  qty: number;
  /** Snapshot price at order time, e.g. "25 €" (free text, may be null). */
  price: string | null | undefined;
  /** Snapshot price unit at order time, e.g. "dan" (free text, may be null). */
  priceUnit: string | null | undefined;
  /** Required full name shown first so the host can identify the guest. */
  guestName: string;
  /** Phone shown in email — operator needs it to call back. */
  guestPhone: string;
  /** Guest's accommodation/unit from sign-in (for example B-14). */
  guestUnit: string;
  guestNote: string | null | undefined;
}

/**
 * Build the Resend request body for an order notification.
 * Pure function — no I/O; exported for unit tests.
 *
 * Approved template #2 (emaili-gostitelju): brand = tenant name, data rows for
 * name/unit/phone/item/qty/price/note, green "Odpri portal" CTA (a plain link
 * to the login page — no auto-login), pickup small-print, footer with the
 * opt-out hint. Subject and inbox preview follow the approved file exactly.
 */
export function buildEmailBody(
  p: OrderEmailPayload,
  from: string,
): Record<string, unknown> {
  const subject = `Novo naročilo · ${p.guestUnit} · ${p.itemTitle ?? "—"}`;
  const priceLabel = p.price
    ? `${p.price}${p.priceUnit ? ` / ${p.priceUnit}` : ""}`
    : null;
  const { html, text } = renderEmail({
    subject,
    preheader: `${p.guestName}, ${p.qty} × · odprite portal za potrditev`,
    brand: p.tenantName,
    title: "Novo naročilo",
    blocks: [
      par("Gost je pravkar oddal naročilo prek vašega digitalnega vodnika."),
      rows([
        { label: "Ime in priimek", value: p.guestName },
        { label: "Enota", value: p.guestUnit },
        { label: "Telefon", value: p.guestPhone },
        { label: "Artikel", value: p.itemTitle ?? "—" },
        { label: "Količina", value: String(p.qty) },
        priceLabel ? { label: "Cena", value: priceLabel } : null,
        p.guestNote ? { label: "Opomba gosta", value: p.guestNote } : null,
      ]),
      par(
        "Naročilo potrdite ali zavrnete v portalu. Gost stanje vidi v vodniku pod ",
        { b: "Moja naročila" },
        ".",
      ),
      cta("Odpri portal", portalUrl()),
      small("Prevzem je pri vas, razen če je pri artiklu izrecno napisana dostava."),
    ],
    footerLines: [
      "Smart360 · digitalni vodnik za goste",
      "Obveščanje o naročilih lahko izklopite v portalu pod Nastavitve.",
    ],
  });

  return {
    from: `${ORDER_EMAIL_FROM_NAME} <${from}>`,
    reply_to: BUSINESS_CONTACT_EMAIL,
    to: [p.to],
    subject,
    html,
    text,
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

export type EmailResult =
  | { ok: true; messageId?: string }
  | { ok: false };

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

    // Resend returns { id } for an accepted send. It is safe to log and retain
    // for delivery evidence; unlike the response body it contains no guest PII.
    const accepted = await resp.json().catch(() => null);
    const messageId =
      accepted &&
      typeof accepted === "object" &&
      "id" in accepted &&
      typeof accepted.id === "string"
        ? accepted.id
        : undefined;

    logger.info(
      { orderRef: p.orderRef, resendMessageId: messageId ?? null },
      "[orderEmail] notification accepted by Resend",
    );
    return { ok: true, messageId };
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
