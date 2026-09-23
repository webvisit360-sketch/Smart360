import { HOST_NOTIFICATION_REPLY_TO } from "./businessContact";
import { cta, p as par, renderEmail, rows, small } from "./emailTemplate";
import { emailFrom } from "./orderEmail";
import {
  deliverResend,
  resendConfigurationFailure,
  type ResendFailure,
} from "./resendDelivery";

const FROM_NAME = "Smart360";
const CONCIERGE_COPY =
  "Vaš digitalni vodnik v celoti pripravljamo in urejamo mi — vam ni treba storiti ničesar. Vse spremembe, dopolnitve ali fotografije nam kadar koli pošljite na info@webvisit360.com in jih vnesemo za vas.";
const AGENCY_FOOTER = [
  "Smart360 · Agencija Sinhron d.o.o.",
  "Tomšičeva ulica 12, SI-2310 Slovenska Bistrica · info@webvisit360.com",
];
const INVITATION_SENDER_NOTE_SL =
  "To sporočilo pošilja Smart360 prek svojega poštnega sistema na domeni webvisit360.com. Povezava vodi na smart360.info.";
const INVITATION_SENDER_NOTE_EN =
  "This message is sent by Smart360 through its mail system at webvisit360.com. The link points to smart360.info.";

export const CONCIERGE_WELCOME_REPLY_TO = "info@webvisit360.com";

export interface ConciergeWelcomeEmailRenderPayload {
  tenantName: string;
  /** Public guest-guide URL. It must not be an account, invite, or auto-login URL. */
  guideUrl: string;
}

export interface ConciergeWelcomeEmailPayload extends ConciergeWelcomeEmailRenderPayload {
  /** Required destination supplied by the caller; never inferred or hard-coded. */
  recipient: string;
}

export interface RenderedConciergeWelcomeEmail {
  subject: string;
  html: string;
  text: string;
}

export interface ConciergeWelcomeEmailBody
  extends RenderedConciergeWelcomeEmail, Record<string, unknown> {
  from: string;
  reply_to: string;
  to: string[];
}

export type ConciergeWelcomeEmailResult =
  | { ok: true; providerMessageId: string | null }
  | ResendFailure;

type Delivery = (
  body: ConciergeWelcomeEmailBody,
  options?: { idempotencyKey?: string },
) => Promise<ConciergeWelcomeEmailResult>;

let deliveryOverride: Delivery | null = null;

/** Test-only transport seam. Passing null restores the shared Resend delivery. */
export function _setConciergeWelcomeDeliveryOverride(delivery: Delivery | null): void {
  deliveryOverride = delivery;
}

function requireValue(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${field} is required`);
  return normalized;
}

/**
 * Pure concierge welcome renderer. It uses the same welcome-cgp renderer as
 * the normal invitation while intentionally containing no account access.
 */
export function renderConciergeWelcomeEmail(
  payload: ConciergeWelcomeEmailRenderPayload,
): RenderedConciergeWelcomeEmail {
  const tenantName = requireValue(payload.tenantName, "tenantName");
  const guideUrl = requireValue(payload.guideUrl, "guideUrl");
  const subject = "Dobrodošli v Smart360 · vaš vodnik je v pripravi";
  const { html, text } = renderEmail({
    theme: "welcome-cgp",
    subject,
    preheader: "Vaš digitalni vodnik v celoti pripravljamo in urejamo mi",
    brand: "Smart360",
    title: "Dobrodošli",
    blocks: [
      par(
        "Pozdravljeni. Hvala za zaupanje — za ",
        { b: tenantName },
        " pripravljamo digitalni vodnik za vaše goste.",
      ),
      par(CONCIERGE_COPY),
      cta("Oglejte si svoj vodnik", guideUrl),
      rows([
        { label: "Nastanitev", value: tenantName },
        { label: "Naslov vodnika", value: guideUrl },
      ]),
      small(INVITATION_SENDER_NOTE_SL),
      small(INVITATION_SENDER_NOTE_EN),
    ],
    footerLines: AGENCY_FOOTER,
  });

  return { subject, html, text };
}

/**
 * Sends one already-mode-selected concierge welcome through the shared Resend
 * transport. Mode selection and invitation history remain the caller's job.
 */
export async function sendConciergeWelcomeEmail(
  payload: ConciergeWelcomeEmailPayload,
  idempotencyKey?: string,
): Promise<ConciergeWelcomeEmailResult> {
  requireValue(payload.recipient, "recipient");
  if (!deliveryOverride) {
    const configurationFailure = resendConfigurationFailure();
    if (configurationFailure) return configurationFailure;
  }

  try {
    const recipient = requireValue(payload.recipient, "recipient");
    const body: ConciergeWelcomeEmailBody = {
      from: `${FROM_NAME} <${emailFrom()}>`,
      reply_to: HOST_NOTIFICATION_REPLY_TO,
      to: [recipient],
      ...renderConciergeWelcomeEmail(payload),
    };
    return (deliveryOverride ?? deliverResend)(body, { idempotencyKey });
  } catch {
    return {
      ok: false,
      error: {
        code: "sender_configuration",
        message: "Pošiljatelj ni pravilno nastavljen",
        httpStatus: null,
        stage: "configuration",
      },
    };
  }
}