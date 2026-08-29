import { ReplitConnectors } from "@replit/connectors-sdk";
import { emailFrom } from "./orderEmail";
import { p, renderEmail, small } from "./emailTemplate";
import { logger } from "./logger";
import { db, adminSecurityEmailsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { providerMessageIdFromResendResponse } from "./lifecycleEmails";

const connectors = new ReplitConnectors();
export const ADMIN_SECURITY_MAILBOX = "smart360hq@gmail.com";

export type AdminSecurityEvent =
  | "password_changed"
  | "password_recovered"
  | "passkey_enrolled"
  | "recovery_codes_replaced";

const COPY: Record<AdminSecurityEvent, { subject: string; title: string; text: string }> = {
  password_changed: {
    subject: "Smart360 varnostno obvestilo: geslo je bilo spremenjeno",
    title: "Geslo je bilo spremenjeno",
    text: "Geslo za upravljavski račun Smart360 je bilo nastavljeno ali spremenjeno.",
  },
  password_recovered: {
    subject: "Smart360 varnostno obvestilo: geslo je bilo obnovljeno",
    title: "Geslo je bilo obnovljeno",
    text: "Geslo za upravljavski račun Smart360 je bilo ponastavljeno z obnovitveno kodo.",
  },
  passkey_enrolled: {
    subject: "Smart360 varnostno obvestilo: dodan je bil passkey",
    title: "Dodan je bil nov ključ",
    text: "Upravljavskemu računu Smart360 je bil dodan nov passkey.",
  },
  recovery_codes_replaced: {
    subject: "Smart360 varnostno obvestilo: obnovitvene kode so bile zamenjane",
    title: "Obnovitvene kode so bile zamenjane",
    text: "Obnovitvene kode upravljavskega računa Smart360 so bile zamenjane. Prejšnje kode ne veljajo več.",
  },
};

export function buildAdminSecurityEmail(event: AdminSecurityEvent) {
  const copy = COPY[event];
  const { html, text } = renderEmail({
    subject: copy.subject,
    preheader: copy.title,
    brand: "Smart360",
    title: copy.title,
    blocks: [
      p(copy.text),
      small("Če tega niste storili vi, takoj preverite dostop do računa in obnovitvene kode."),
    ],
    footerLines: [
      "Smart360 · Agencija Sinhron d.o.o.",
      "Tomšičeva ulica 12, SI-2310 Slovenska Bistrica · info@webvisit360.com",
    ],
  });
  return {
    from: `Smart360 <${emailFrom()}>`,
    to: [ADMIN_SECURITY_MAILBOX],
    subject: copy.subject,
    html,
    text,
  };
}

type Delivery = (body: Record<string, unknown>) => Promise<{ ok: boolean; providerMessageId?: string | null }>;
let deliveryOverride: Delivery | null = null;

export function _setAdminSecurityDeliveryOverride(fn: Delivery | null): void {
  deliveryOverride = fn;
}

export async function sendAdminSecurityEmail(event: AdminSecurityEvent): Promise<boolean> {
  const body = buildAdminSecurityEmail(event);
  const [evidence] = await db
    .insert(adminSecurityEmailsTable)
    .values({ event })
    .returning({ id: adminSecurityEmailsTable.id });
  if (!evidence) throw new Error("Security e-mail evidence could not be created");
  const finish = async (ok: boolean, providerMessageId: string | null) => {
    const accepted = ok && !!providerMessageId;
    await db
      .update(adminSecurityEmailsTable)
      .set({
        deliveryStatus: accepted ? "accepted" : "failed",
        providerMessageId: accepted ? providerMessageId : null,
        deliveryAttemptedAt: new Date(),
      })
      .where(eq(adminSecurityEmailsTable.id, evidence.id));
    return accepted;
  };
  if (deliveryOverride) {
    const result = await deliveryOverride(body);
    return finish(result.ok, result.providerMessageId ?? (result.ok ? `test-${evidence.id}` : null));
  }
  try {
    const response = await connectors.proxy("resend", "/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
    if (!response.ok) {
      logger.error({ event, httpStatus: response.status }, "[adminSecurityEmail] Resend rejected");
      return finish(false, null);
    }
    const providerMessageId = providerMessageIdFromResendResponse(
      await response.json().catch(() => null),
    );
    if (!providerMessageId) {
      logger.error({ event }, "[adminSecurityEmail] Resend response missing message id");
      return finish(false, null);
    }
    logger.info({ event, providerMessageId }, "[adminSecurityEmail] accepted by Resend");
    return finish(true, providerMessageId);
  } catch (error) {
    logger.error(
      { event, errName: error instanceof Error ? error.name : "Error" },
      "[adminSecurityEmail] send failed",
    );
    return finish(false, null);
  }
}