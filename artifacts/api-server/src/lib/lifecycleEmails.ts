/**
 * Tenant-lifecycle e-mails (approved templates #1, #4 and #6):
 *   1. purchase welcome — introduces onboarding; the guide is built by US, so it
 *      deliberately does NOT teach the creator flow,
 *   4. guide ready — the set-password link + review invitation,
 *   6. guide published — the live address and the QR-print pointer.
 *
 * All three use the shared approved card layout (emailTemplate.ts) and carry
 * a plain-text alternative. Senders follow the same contract as order and
 * message notifications: 2xx → { ok: true }, anything else → { ok: false },
 * logs carry no recipient address and no token.
 */
import { HOST_NOTIFICATION_REPLY_TO } from "./businessContact";
import { logger } from "./logger";
import { emailFrom as verifiedFrom } from "./orderEmail";
import { cta, displayHost, p as par, renderEmail, rows, small } from "./emailTemplate";
import {
  deliverResend,
  resendConfigurationFailure,
  type ResendFailure,
} from "./resendDelivery";

export const LIFECYCLE_FROM_NAME = "Smart360";

const AGENCY_FOOTER = [
  "Smart360 · Agencija Sinhron d.o.o.",
  "Tomšičeva ulica 12, SI-2310 Slovenska Bistrica · info@webvisit360.com",
];

const INVITATION_SENDER_NOTE_SL =
  "To sporočilo pošilja Smart360 prek svojega poštnega sistema na domeni webvisit360.com. Povezava vodi na smart360.info.";
const INVITATION_SENDER_NOTE_EN =
  "This message is sent by Smart360 through its mail system at webvisit360.com. The link points to smart360.info.";

function fromHeader(): string {
  return `${LIFECYCLE_FROM_NAME} <${verifiedFrom()}>`;
}

// ── 1 · Purchase welcome ─────────────────────────────────────────────────────

export interface WelcomeEmailPayload {
  to: string;
  /** Host's first name for the greeting; optional. */
  hostName?: string | null;
  /** Property display name, e.g. "Apartmaji Meli Pu". */
  propertyName: string;
  /** Single-use 72-hour account-claim link. NEVER an auto-login link. */
  setPasswordUrl: string;
}

/** Pure builder — exported for unit tests. */
export function buildWelcomeEmailBody(p: WelcomeEmailPayload, from: string) {
  const subject = "Dobrodošli v Smart360 · vaš vodnik je v pripravi";
  const { html, text } = renderEmail({
    theme: "welcome-cgp",
    subject,
    preheader: "Pošljite nam gradivo — vodnik pripravimo mi",
    brand: "Smart360",
    title: "Dobrodošli",
    blocks: [
      par(
        "Pozdravljeni. Hvala za zaupanje — za ",
        { b: p.propertyName },
        " pripravljamo digitalni vodnik za vaše goste.",
      ),
      par("Najprej si varno nastavite geslo za svoj Smart360 račun:"),
      cta("Nastavite geslo", p.setPasswordUrl),
      small(
        "Povezava velja 72 ur in jo je mogoče uporabiti enkrat. Gesla ne pošiljamo po e-pošti in ga tudi mi ne vidimo.",
      ),
      par(
        "Po nastavitvi gesla vas počaka kratek obrazec — vpišete podatke o svoji nastanitvi in priporočila za okolico, vse ostalo uredimo mi.",
      ),
      par(
        "Ko bo vodnik pripravljen, ga boste s svojim računom lahko kadar koli sami urejali in dopolnjevali — besedila, fotografije, ponudbo in obvestila.",
      ),
      cta("Pošljite gradivo", "mailto:info@webvisit360.com"),
      par(
        "Ko bo vodnik pripravljen, prejmete še povabilo za pregled.",
      ),
      small(INVITATION_SENDER_NOTE_SL),
      small(INVITATION_SENDER_NOTE_EN),
    ],
    footerLines: AGENCY_FOOTER,
  });
  return { from, reply_to: HOST_NOTIFICATION_REPLY_TO, to: [p.to], subject, html, text };
}

// ── 4 · Guide ready (set-password link) ─────────────────────────────────────

export interface GuideReadyEmailPayload {
  to: string;
  hostName?: string | null;
  propertyName: string;
  /** Tenant slug for the public address row, e.g. "meli-pu". */
  slug: string;
  /** Single-use, expiring set-password link. NEVER an auto-login link. */
  setPasswordUrl: string;
}

/** Pure builder — exported for unit tests. */
export function buildGuideReadyEmailBody(p: GuideReadyEmailPayload, from: string) {
  const subject = "Vaš digitalni vodnik je pripravljen";
  const greeting = p.hostName ? `Pozdravljeni, ${p.hostName}.` : "Pozdravljeni.";
  const { html, text } = renderEmail({
    subject,
    preheader: "Nastavite geslo in preglejte, kar smo pripravili",
    brand: "Smart360",
    title: "Vaš digitalni vodnik je pripravljen",
    blocks: [
      par(
        `${greeting} Za `,
        { b: p.propertyName },
        " smo pripravili digitalni vodnik za vaše goste — vključno z okolico, razdaljami in opisi znamenitosti v krogu 15 km.",
      ),
      par("Da ga dokončate, si najprej nastavite geslo:"),
      cta("Nastavite geslo", p.setPasswordUrl),
      small(
        "Povezava velja 72 ur in jo je mogoče uporabiti enkrat. Gesla ne pošiljamo po e-pošti in ga tudi mi ne vidimo.",
      ),
      par(
        "Ko se prijavite, vas ",
        { b: "Kreator vodnika" },
        " pelje po korakih: potrdite okolico, dodate svoje fotografije in podatke o nastanitvi ter objavite. Ves čas vidite predogled, kako vodnik izgleda na telefonu.",
      ),
      rows([
        { label: "Naslov vodnika", value: `${displayHost()}/${p.slug}` },
        { label: "Portal", value: `${displayHost()}/admin` },
      ]),
      small(INVITATION_SENDER_NOTE_SL),
      small(INVITATION_SENDER_NOTE_EN),
    ],
    footerLines: AGENCY_FOOTER,
  });
  return { from, reply_to: HOST_NOTIFICATION_REPLY_TO, to: [p.to], subject, html, text };
}

// ── 6 · Guide published ──────────────────────────────────────────────────────

export interface PublishedEmailPayload {
  to: string;
  /** Tenant display name — used as the brand kicker. */
  tenantName: string;
  slug: string;
}

/** Pure builder — exported for unit tests. */
export function buildPublishedEmailBody(p: PublishedEmailPayload, from: string) {
  const subject = "Vaš vodnik je objavljen";
  const { html, text } = renderEmail({
    subject,
    preheader: "QR kode za apartmaje so pripravljene za tisk",
    brand: p.tenantName,
    title: "Vodnik je objavljen",
    blocks: [
      par("Od zdaj je vaš vodnik dosegljiv gostom na naslovu:"),
      rows([{ label: "Naslov", value: `${displayHost()}/${p.slug}` }]),
      par(
        "V portalu pod ",
        { b: "Pregled" },
        " natisnete QR kode in nalepke za apartmaje. Naslov se ne spreminja, zato natisnjene kode ostanejo veljavne tudi po vseh poznejših spremembah.",
      ),
      par(
        "Vsebino lahko urejate naprej — spremembe so gostom vidne, ko pritisnete ",
        { b: "Objavi" },
        ".",
      ),
    ],
    footerLines: ["Smart360 · digitalni vodnik za goste"],
  });
  return { from, reply_to: HOST_NOTIFICATION_REPLY_TO, to: [p.to], subject, html, text };
}

// ── Shared sender ────────────────────────────────────────────────────────────

export type LifecycleEmailResult = { ok: true; providerMessageId: string | null } | ResendFailure;

type BuiltBody = Record<string, unknown>;
type Delivery = (body: BuiltBody) => Promise<LifecycleEmailResult | { ok: true }>;

export function providerMessageIdFromResendResponse(response: unknown): string | null {
  return response && typeof response === "object" && "id" in response && typeof response.id === "string"
    ? response.id
    : null;
}

let deliveryOverride: Delivery | null = null;
/** Test hook: capture the outgoing mail instead of calling Resend. */
export function _setLifecycleDeliveryOverride(fn: Delivery | null): void {
  deliveryOverride = fn;
}

async function deliver(
  kind: string,
  body: BuiltBody,
  idempotencyKey?: string,
): Promise<LifecycleEmailResult> {
  if (deliveryOverride) {
    const overridden = await deliveryOverride(body);
    return overridden.ok
      ? { ok: true, providerMessageId: "providerMessageId" in overridden ? overridden.providerMessageId : null }
      : overridden;
  }
  const result = await deliverResend(body, { idempotencyKey });
  if (!result.ok) {
    logger.error(
      { kind, code: result.error.code, httpStatus: result.error.httpStatus, stage: result.error.stage },
      "[lifecycleEmail] send failed",
    );
    return result;
  }
  logger.info({ kind, providerMessageId: result.providerMessageId }, "[lifecycleEmail] accepted by Resend");
  return result;
}

export async function sendWelcomeEmail(
  p: WelcomeEmailPayload,
  idempotencyKey?: string,
): Promise<LifecycleEmailResult> {
  if (!deliveryOverride) {
    const configurationFailure = resendConfigurationFailure();
    if (configurationFailure) return configurationFailure;
  }
  try {
    return deliver("welcome", buildWelcomeEmailBody(p, fromHeader()), idempotencyKey);
  } catch {
    return { ok: false, error: { code: "sender_configuration", message: "Pošiljatelj ni pravilno nastavljen", httpStatus: null, stage: "configuration" } };
  }
}

export async function sendGuideReadyEmail(
  p: GuideReadyEmailPayload,
  idempotencyKey?: string,
): Promise<LifecycleEmailResult> {
  if (!deliveryOverride) {
    const configurationFailure = resendConfigurationFailure();
    if (configurationFailure) return configurationFailure;
  }
  try {
    return deliver("guide-ready", buildGuideReadyEmailBody(p, fromHeader()), idempotencyKey);
  } catch {
    return { ok: false, error: { code: "sender_configuration", message: "Pošiljatelj ni pravilno nastavljen", httpStatus: null, stage: "configuration" } };
  }
}

export async function sendPublishedEmail(
  p: PublishedEmailPayload,
  idempotencyKey?: string,
): Promise<LifecycleEmailResult> {
  if (!deliveryOverride) {
    const configurationFailure = resendConfigurationFailure();
    if (configurationFailure) return configurationFailure;
  }
  try {
    return deliver("published", buildPublishedEmailBody(p, fromHeader()), idempotencyKey);
  } catch {
    return { ok: false, error: { code: "sender_configuration", message: "Pošiljatelj ni pravilno nastavljen", httpStatus: null, stage: "configuration" } };
  }
}
