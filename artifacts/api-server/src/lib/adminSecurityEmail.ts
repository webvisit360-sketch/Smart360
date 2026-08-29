import { ReplitConnectors } from "@replit/connectors-sdk";
import { emailFrom } from "./orderEmail";
import { p, renderEmail, small } from "./emailTemplate";
import { logger } from "./logger";

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

type Delivery = (body: Record<string, unknown>) => Promise<{ ok: boolean }>;
let deliveryOverride: Delivery | null = null;

export function _setAdminSecurityDeliveryOverride(fn: Delivery | null): void {
  deliveryOverride = fn;
}

export async function sendAdminSecurityEmail(event: AdminSecurityEvent): Promise<boolean> {
  const body = buildAdminSecurityEmail(event);
  if (deliveryOverride) return (await deliveryOverride(body)).ok;
  try {
    const response = await connectors.proxy("resend", "/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
    if (!response.ok) {
      logger.error({ event, httpStatus: response.status }, "[adminSecurityEmail] Resend rejected");
      return false;
    }
    logger.info({ event }, "[adminSecurityEmail] accepted by Resend");
    return true;
  } catch (error) {
    logger.error(
      { event, errName: error instanceof Error ? error.name : "Error" },
      "[adminSecurityEmail] send failed",
    );
    return false;
  }
}