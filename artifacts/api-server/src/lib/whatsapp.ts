import { logger } from "./logger";

const META_GRAPH_VERSION = "v22.0";
const TIMEOUT_MS = 8_000;
const E164_RE = /^\+[1-9]\d{7,14}$/;

export type WhatsAppKind = "order" | "message";
export type WhatsAppResult =
  | { ok: true; providerMessageId?: string; providerResponse: string }
  | { ok: false; providerError: string; providerResponse?: string };

export interface WhatsAppTemplatePayload {
  kind: WhatsAppKind;
  notificationId: string;
  to: string;
  guestName: string;
  guestUnit: string;
  item?: string;
  quantity?: number;
  time?: string;
  preview?: string;
}

export type FetchLike = typeof fetch;

export function isValidE164(value: string): boolean {
  return E164_RE.test(value);
}

/** PATCH blank semantics: whitespace is omission, never deletion. */
export function normalizeWhatsappPhonePatch(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  return value.trim() || undefined;
}

export function whatsappConfig(
  env: NodeJS.ProcessEnv = process.env,
): {
  accessToken: string;
  phoneNumberId: string;
  orderTemplateName: string;
  orderTemplateLanguage: string;
  messageTemplateName: string;
  messageTemplateLanguage: string;
} | null {
  const accessToken = env["META_WHATSAPP_ACCESS_TOKEN"]?.trim();
  const phoneNumberId = env["META_WHATSAPP_PHONE_NUMBER_ID"]?.trim();
  const orderTemplateName = env["META_WHATSAPP_ORDER_TEMPLATE_NAME"]?.trim();
  const orderTemplateLanguage =
    env["META_WHATSAPP_ORDER_TEMPLATE_LANGUAGE"]?.trim() || "sl";
  const messageTemplateName = env["META_WHATSAPP_MESSAGE_TEMPLATE_NAME"]?.trim();
  const messageTemplateLanguage =
    env["META_WHATSAPP_MESSAGE_TEMPLATE_LANGUAGE"]?.trim() || "sl";
  return accessToken && phoneNumberId && orderTemplateName && messageTemplateName
    ? {
        accessToken,
        phoneNumberId,
        orderTemplateName,
        orderTemplateLanguage,
        messageTemplateName,
        messageTemplateLanguage,
      }
    : null;
}

export function isWhatsappConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return whatsappConfig(env) !== null;
}

function textParameter(text: string) {
  return { type: "text", text };
}

export function buildWhatsappTemplateBody(
  payload: WhatsAppTemplatePayload,
  templateName: string,
  templateLanguage: string,
): Record<string, unknown> {
  const parameters =
    payload.kind === "order"
      ? [
          textParameter(`${payload.guestName} / ${payload.guestUnit}`),
          textParameter(payload.item ?? "—"),
          textParameter(String(payload.quantity ?? 1)),
          textParameter(payload.time ?? "—"),
        ]
      : [
          textParameter(`${payload.guestName} / ${payload.guestUnit}`),
          textParameter((payload.preview ?? "").slice(0, 120)),
        ];
  return {
    messaging_product: "whatsapp",
    to: payload.to.slice(1),
    type: "template",
    template: {
      name: templateName,
      language: { code: templateLanguage },
      components: [{ type: "body", parameters }],
    },
  };
}

/** Official Meta Cloud API adapter; fetch is injectable and no free-form text is sent. */
export async function sendWhatsappTemplate(
  payload: WhatsAppTemplatePayload,
  options: {
    fetchImpl?: FetchLike;
    env?: NodeJS.ProcessEnv;
    timeoutMs?: number;
  } = {},
): Promise<WhatsAppResult> {
  const config = whatsappConfig(options.env);
  if (!config) return { ok: false, providerError: "Meta WhatsApp ni konfiguriran." };
  if (!isValidE164(payload.to)) {
    return { ok: false, providerError: "Prejemnik ni veljavna mednarodna številka E.164." };
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? TIMEOUT_MS);
  try {
    const { templateName, templateLanguage } =
      payload.kind === "order"
        ? {
            templateName: config.orderTemplateName,
            templateLanguage: config.orderTemplateLanguage,
          }
        : {
            templateName: config.messageTemplateName,
            templateLanguage: config.messageTemplateLanguage,
          };
    const response = await (options.fetchImpl ?? fetch)(
      `https://graph.facebook.com/${META_GRAPH_VERSION}/${config.phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(
          buildWhatsappTemplateBody(payload, templateName, templateLanguage),
        ),
        signal: controller.signal,
      },
    );
    const responseText = await response.text();
    if (!response.ok) {
      logger.warn(
        { notificationId: payload.notificationId, httpStatus: response.status },
        "[whatsapp] Meta rejected template notification",
      );
      return { ok: false, providerError: responseText, providerResponse: responseText };
    }
    let providerMessageId: string | undefined;
    try {
      const parsed = JSON.parse(responseText) as { messages?: Array<{ id?: unknown }> };
      const id = parsed.messages?.[0]?.id;
      if (typeof id === "string") providerMessageId = id;
    } catch {
      // The exact accepted response remains available even when it is not JSON.
    }
    return { ok: true, providerMessageId, providerResponse: responseText };
  } catch (error) {
    const providerError = error instanceof Error ? error.message : String(error);
    logger.error(
      { notificationId: payload.notificationId, errName: error instanceof Error ? error.name : "Error" },
      "[whatsapp] Meta request failed",
    );
    return { ok: false, providerError };
  } finally {
    clearTimeout(timer);
  }
}