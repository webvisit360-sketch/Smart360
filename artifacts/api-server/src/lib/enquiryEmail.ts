import { ReplitConnectors } from "@replit/connectors-sdk";
import { logger } from "./logger";

const connectors = new ReplitConnectors();
const OWNER_EMAIL = "webvisit360@gmail.com";
const FROM_EMAIL = "info@webvisit360.com";

export type Enquiry = {
  name: string;
  email: string;
  propertyName: string;
  address: string;
  propertyType: string;
  message?: string;
};

export type EnquiryDeliveryResult = {
  status: "accepted" | "failed";
  providerMessageId: string | null;
};
type Delivery = (body: ReturnType<typeof buildEnquiryEmail>) => Promise<EnquiryDeliveryResult>;
let deliveryOverride: Delivery | null = null;

export function _setEnquiryDeliveryOverride(delivery: Delivery | null): void {
  deliveryOverride = delivery;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[char]!);
}

export function buildEnquiryEmail(enquiry: Enquiry) {
  const rows = [
    ["Ime in priimek", enquiry.name],
    ["E-pošta", enquiry.email],
    ["Ime nastanitve", enquiry.propertyName],
    ["Naslov nastanitve", enquiry.address],
    ["Kaj oddajate", enquiry.propertyType],
    ["Vprašanje ali opomba", enquiry.message || "—"],
  ];
  const text = rows.map(([label, value]) => `${label}: ${value}`).join("\n");
  const html = `<h1>Novo povpraševanje Smart360</h1>${rows
    .map(([label, value]) => `<p><strong>${escapeHtml(label!)}</strong><br>${escapeHtml(value!).replace(/\n/g, "<br>")}</p>`)
    .join("")}`;
  return {
    from: `Smart360 <${FROM_EMAIL}>`,
    reply_to: enquiry.email,
    to: [OWNER_EMAIL],
    subject: `Povpraševanje · ${enquiry.propertyName}`,
    text,
    html,
  };
}

export async function sendEnquiry(enquiry: Enquiry): Promise<EnquiryDeliveryResult> {
  const body = buildEnquiryEmail(enquiry);
  if (deliveryOverride) return deliveryOverride(body);
  try {
    const response = await connectors.proxy("resend", "/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
    if (!response.ok) {
      logger.error({ httpStatus: response.status }, "[enquiryEmail] Resend rejected");
      return { status: "failed", providerMessageId: null };
    }
    const payload = await response.json().catch(() => null) as { id?: unknown } | null;
    return {
      status: "accepted",
      providerMessageId: typeof payload?.id === "string" ? payload.id : null,
    };
  } catch (error) {
    logger.error(
      { errName: error instanceof Error ? error.name : "Error" },
      "[enquiryEmail] send failed",
    );
    return { status: "failed", providerMessageId: null };
  }
}