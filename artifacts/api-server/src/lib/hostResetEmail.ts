import { ReplitConnectors } from "@replit/connectors-sdk";
import { rpOrigin } from "./adminAuth";
import { logger } from "./logger";

/**
 * Password-reset e-mail for HOST accounts, via the Resend connector.
 *
 * Hard rules (Instruction #28):
 * - The recipient is ALWAYS the host account's own e-mail. There is no code
 *   path that addresses this mail to the owner; the owner's "send reset"
 *   cockpit action calls the same function with the host's address.
 * - The mail carries the raw token link; only the SHA-256 hash exists in the
 *   database. The token is NEVER logged.
 */

const connectors = new ReplitConnectors();

export const HOST_RESET_FROM_NAME = "Smart360 portal";

function emailFrom(): string {
  const addr = process.env["ORDER_EMAIL_FROM"];
  if (!addr) throw new Error("ORDER_EMAIL_FROM must be set");
  if (addr !== "info@webvisit360.com") {
    throw new Error("ORDER_EMAIL_FROM must be info@webvisit360.com");
  }
  return `${HOST_RESET_FROM_NAME} <${addr}>`;
}

export function resetLink(token: string): string {
  // The reset page ships with the portal shell (CHECKPOINT 3); the API-side
  // confirm endpoint it calls is already live.
  return `${rpOrigin()}/portal/ponastavitev?token=${encodeURIComponent(token)}`;
}

/** Pure function — no I/O; exported for unit tests. */
export function buildResetEmailBody(to: string, link: string, from: string) {
  return {
    from,
    to: [to],
    subject: "Ponastavitev gesla – Smart360 portal",
    html: [
      `<p>Pozdravljeni,</p>`,
      `<p>prejeli smo zahtevo za ponastavitev gesla za vaš Smart360 portal.</p>`,
      `<p><a href="${link}">Nastavite novo geslo</a></p>`,
      `<p>Povezava velja 60 minut in jo je mogoče uporabiti samo enkrat.</p>`,
      `<p>Če gesla niste zahtevali vi, to sporočilo prezrite — geslo ostane nespremenjeno.</p>`,
    ].join("\n"),
  };
}

export type ResetEmailResult = { ok: true } | { ok: false };

type Delivery = (body: ReturnType<typeof buildResetEmailBody>) => Promise<ResetEmailResult>;

let deliveryOverride: Delivery | null = null;
/** Test hook: capture the outgoing mail instead of calling Resend. */
export function _setHostResetDeliveryOverride(fn: Delivery | null): void {
  deliveryOverride = fn;
}

export async function sendHostResetEmail(to: string, token: string): Promise<ResetEmailResult> {
  const body = buildResetEmailBody(to, resetLink(token), emailFrom());
  if (deliveryOverride) return deliveryOverride(body);
  try {
    const resp = await connectors.proxy("resend", "/emails", {
      method: "POST",
      body,
    });
    if (!resp.ok) {
      // Status only — never the body, never the token, never the address.
      logger.error({ httpStatus: resp.status }, "[hostResetEmail] Resend rejected the request");
      return { ok: false };
    }
    return { ok: true };
  } catch (err) {
    logger.error(
      { errName: err instanceof Error ? err.name : "Error" },
      "[hostResetEmail] send failed",
    );
    return { ok: false };
  }
}
