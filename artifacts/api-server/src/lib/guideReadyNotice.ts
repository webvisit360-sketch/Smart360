import QRCode from "qrcode";
import { makeGuideSticker, makeGuideStickers } from "./guideStickers";
import { HOST_NOTIFICATION_REPLY_TO } from "./businessContact";
import { cta, escHtml, p, renderEmail, portalUrl, small } from "./emailTemplate";
import { INVITATION_SENDER_NOTE_SL, INVITATION_SENDER_NOTE_EN } from "./lifecycleEmails";
import { emailFrom } from "./orderEmail";
import { deliverResend, type ResendResult } from "./resendDelivery";

export const READY_SUBJECT = "Vaš digitalni vodnik je pripravljen";
export function defaultReadyMessage(guideUrl: string): string {
  return `Spoštovani,

z veseljem sporočamo, da je vaš digitalni vodnik izdelan po vaših navodilih in pripravljen za goste.

Vodnik si lahko ogledate na naslovu:
${guideUrl}

V priponkah vam pošiljamo veliko in malo nalepko s QR-kodo za tisk in namestitev na vidno mesto v nastanitvi.

Prosimo, da vodnik pregledate in nam morebitne popravke ali dopolnitve sporočite kar z odgovorom na to sporočilo.

Ekipa Smart360`;
}

export type ReadyInput = {
  tenantName: string;
  slug: string;
  guideUrl: string;
  mode: "self_service" | "concierge";
  subject?: string;
  message?: string;
};

const FOOTER = [
  "Smart360 · Agencija Sinhron d.o.o.",
  `Tomšičeva ulica 12, SI-2310 Slovenska Bistrica · ${HOST_NOTIFICATION_REPLY_TO}`,
];

function validCopy(input: ReadyInput) {
  const subject = input.subject ?? READY_SUBJECT;
  const message = input.message ?? defaultReadyMessage(input.guideUrl);
  if (!subject.trim() || subject.length > 180 || /[\r\n]/.test(subject)) throw new Error("Neveljavna zadeva.");
  if (!message.trim() || message.length > 4000) throw new Error("Neveljavno besedilo.");
  if (!/^https:\/\//.test(input.guideUrl)) throw new Error("Neveljaven naslov vodnika.");
  return { subject, message };
}

export async function renderReadyNotice(input: ReadyInput, inline = "data") {
  const { subject, message } = validCopy(input);
  const png = await QRCode.toDataURL(input.guideUrl, {
    errorCorrectionLevel: "H", margin: 4, width: 640,
    color: { dark: "#000000", light: "#FFFFFF" },
  });
  const paragraphs = message.split(/\n\s*\n/);
  const blocks = paragraphs.map((paragraph) => p(paragraph));
  const rendered = renderEmail({
    theme: "welcome-cgp",
    cardRadius: 16,
    subject,
    preheader: READY_SUBJECT,
    brand: "Smart360",
    title: READY_SUBJECT,
    blocks: [
      ...blocks,
      cta("Odprite vodnik", input.guideUrl),
      ...(input.mode === "self_service" ? [p("Vodnik lahko tudi sami uredite:"), cta("Uredite vodnik", portalUrl())] : []),
      small(INVITATION_SENDER_NOTE_SL),
      small(INVITATION_SENDER_NOTE_EN),
    ],
    footerLines: FOOTER,
  });
  // Start with the welcome CGP so its branding, layout, typography, footer and
  // sender note remain shared. The QR uses no third-party service.
  const qrSrc = inline === "cid" ? "cid:guide-ready-qr" : png;
  const qr = `<p style="margin:12px 0 18px"><img src="${qrSrc}" width="176" height="176" alt="QR-koda vodnika" style="display:block;width:176px;height:176px;border:4px solid #FFFFFF"></p>`;
  let html = rendered.html;
  for (const paragraph of paragraphs) {
    if (paragraph.includes("\n")) html = html.replace(escHtml(paragraph), escHtml(paragraph).replaceAll("\n", "<br>"));
  }
  // QR belongs to the changing middle, immediately before the unchanged
  // bilingual sender note and footer (not after the note).
  const senderNote = `<p style="font-size:13.5px;line-height:1.55;color:#66716A;margin:0 0 14px">${escHtml(INVITATION_SENDER_NOTE_SL)}</p>`;
  if (!html.includes(senderNote)) throw new Error("Welcome CGP sender note missing");
  html = html.replace(senderNote, qr + senderNote);
  html = html.replace("border-radius:14px;border-collapse:separate", "border-radius:16px;border-collapse:separate");
  html = html.replaceAll("border-radius:12px;font-family:", "border-radius:999px;font-family:");
  return { subject, message, html, text: rendered.text };
}

/** Compatibility for legacy integrations; runtime delivery uses both sizes. */
export async function makeReadySticker(input: ReadyInput): Promise<Buffer> {
  return makeGuideSticker(input.tenantName, input.guideUrl, "large");
}

type Delivery = (body: Record<string, unknown>, options?: { idempotencyKey?: string }) => Promise<ResendResult>;
let deliveryOverride: Delivery | null = null;
export function _setReadyDeliveryOverride(value: Delivery | null): void { deliveryOverride = value; }

export async function sendReadyNotice(input: ReadyInput & { recipient: string }, key: string): Promise<ResendResult> {
  const rendered = await renderReadyNotice(input, "cid");
  const pdfs = await makeGuideStickers(input.tenantName, input.guideUrl);
  const qr = await QRCode.toBuffer(input.guideUrl, {
    errorCorrectionLevel: "H", margin: 4, width: 640,
    color: { dark: "#000000", light: "#FFFFFF" },
  });
  return (deliveryOverride ?? deliverResend)({
    from: `Smart360 <${emailFrom()}>`,
    reply_to: HOST_NOTIFICATION_REPLY_TO,
    to: [input.recipient],
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
    attachments: [
      { filename: "smart360-nalepka-velika.pdf", content: pdfs.large.toString("base64"), content_type: "application/pdf" },
      { filename: "smart360-nalepka-mala.pdf", content: pdfs.small.toString("base64"), content_type: "application/pdf" },
      { filename: "vodnik-qr.png", content: qr.toString("base64"), content_type: "image/png", content_id: "guide-ready-qr" },
    ],
  }, { idempotencyKey: key });
}

export function readyError(result: ResendResult): string | null {
  if (result.ok) return null;
  // Never persist a provider-returned string. Codes below are fixed allowlisted categories.
  const codes = new Set(["missing_api_key", "provider_unauthorized", "provider_forbidden", "provider_rate_limited", "validation_error", "missing_required_field", "invalid_parameter", "provider_rejected", "missing_message_id", "transport_timeout", "transport_error", "attachment_error", "sender_configuration"]);
  return codes.has(result.error.code) ? result.error.code : "provider_rejected";
}