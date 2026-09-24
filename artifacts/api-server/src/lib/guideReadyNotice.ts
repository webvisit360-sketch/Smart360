import { readFile } from "node:fs/promises";
import path from "node:path";
import PDFDocument from "pdfkit";
import QRCode from "qrcode";
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

V priponki vam pošiljamo nalepko s QR-kodo za tisk — namestite jo na vidno mesto v nastanitvi, da bodo gostje vodnik odprli z enim samim skenom.

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
  // Start with the welcome CGP so its layout, typography, footer and sender
  // note remain shared; the ready-only brand treatment is never applied to
  // the existing welcome email. The QR uses no third-party service.
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
  const welcomeBand = '<tr><td><div style="height:3px;line-height:3px;font-size:0;background:#DD9A2B">&nbsp;</div></td></tr>';
  const welcomeBrand = /<div style="font-size:13px;font-weight:800;letter-spacing:\.14em;text-transform:uppercase;color:#121A14;font-family:[^"]+"><img src="([^"]+)" width="20" height="20" alt="" style="[^"]+">Smart360<\/div>/;
  if (!html.includes(welcomeBand) || !welcomeBrand.test(html)) throw new Error("Welcome CGP header has changed");
  html = html.replace(welcomeBand, "");
  html = html.replace(welcomeBrand, (_match, znak: string) =>
    `<table role="presentation" cellpadding="0" cellspacing="0"><tr>` +
    `<td width="46" style="width:46px"><img src="${znak}" width="46" height="46" alt="Smart360" style="display:block;width:46px;height:46px;border:0"></td>` +
    `<td style="padding-left:12px;font-size:13px;font-weight:800;letter-spacing:.14em;color:#157347;font-family:Archivo,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif">SMART360</td>` +
    `</tr></table>`,
  );
  html = html.replace("border-radius:14px;border-collapse:separate", "border-radius:16px;border-collapse:separate");
  html = html.replaceAll("border-radius:12px;font-family:", "border-radius:999px;font-family:");
  return { subject, message, html, text: rendered.text };
}

async function asset(file: string): Promise<Buffer> {
  const bases = [process.cwd(), path.resolve(process.cwd(), "../..")];
  for (const base of bases) {
    try { return await readFile(path.join(base, file)); } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
  throw new Error(`Required print asset missing: ${file}`);
}

/** A6 landscape (419.53 × 297.64 pt), PDF vector squares, four-module quiet zone. */
export async function makeReadySticker(input: ReadyInput): Promise<Buffer> {
  const [titleFont, urlFont] = await Promise.all([
    asset("artifacts/api-server/assets/Archivo-800.ttf"),
    asset("artifacts/api-server/assets/Archivo-600.ttf"),
  ]);
  const matrix = QRCode.create(input.guideUrl, { errorCorrectionLevel: "H" }).modules;
  const width = 419.53, height = 297.64, qrSize = 174;
  const moduleSize = qrSize / (matrix.size + 8);
  const qrX = (width - qrSize) / 2, qrY = 75;
  const doc = new PDFDocument({ size: [width, height], margin: 0, compress: true });
  const chunks: Buffer[] = [];
  return await new Promise<Buffer>((resolve, reject) => {
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("error", reject);
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.rect(0, 0, width, height).fill("#FFFFFF");
    // Half-point hairline entirely inside the trim edge; no print bleed.
    doc.lineWidth(0.5).strokeColor("#E8EBE6").rect(0.25, 0.25, width - 0.5, height - 0.5).stroke();
    doc.registerFont("Archivo800", titleFont);
    doc.registerFont("Archivo600", urlFont);
    // Wrap the complete tenant name (never use ellipsis). Shrink only if it
    // exceeds the header's two-line allowance; reject impossible long labels.
    const name = input.tenantName.trim();
    if (!name) throw new Error("Tenant name is required for QR sticker");
    const nameWidth = width - 46;
    let nameSize = 17;
    doc.font("Archivo800");
    while (nameSize >= 8 && doc.fontSize(nameSize).heightOfString(name, { width: nameWidth, lineGap: 0 }) > 44) nameSize -= 0.5;
    if (nameSize < 8) throw new Error("Tenant name is too long for A6 sticker");
    doc.fontSize(nameSize).fillColor("#121A14").text(name, 23, 29, { width: nameWidth, lineGap: 0, align: "center" });
    doc.fillColor("#000000");
    for (let y = 0; y < matrix.size; y++) {
      for (let x = 0; x < matrix.size; x++) {
        if (matrix.get(x, y)) doc.rect(qrX + (x + 4) * moduleSize, qrY + (y + 4) * moduleSize, moduleSize + 0.005, moduleSize + 0.005).fill();
      }
    }
    doc.font("Archivo600").fontSize(10).fillColor("#66716A")
      .text(input.guideUrl, 18, 263, { width: width - 36, align: "center", lineBreak: false });
    doc.end();
  });
}

type Delivery = (body: Record<string, unknown>, options?: { idempotencyKey?: string }) => Promise<ResendResult>;
let deliveryOverride: Delivery | null = null;
export function _setReadyDeliveryOverride(value: Delivery | null): void { deliveryOverride = value; }

export async function sendReadyNotice(input: ReadyInput & { recipient: string }, key: string): Promise<ResendResult> {
  const rendered = await renderReadyNotice(input, "cid");
  const pdf = await makeReadySticker(input);
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
      { filename: `nalepka-qr-${input.slug}.pdf`, content: pdf.toString("base64"), content_type: "application/pdf" },
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