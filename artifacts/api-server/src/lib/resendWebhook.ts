import { Webhook, type WebhookRequiredHeaders } from "svix";

export const RESEND_EVENT_STATUSES = {
  "email.sent": { status: "accepted", severity: 1 },
  "email.delivery_delayed": { status: "pending", severity: 2 },
  "email.delivered": { status: "delivered", severity: 3 },
  "email.failed": { status: "failed", severity: 4 },
  "email.suppressed": { status: "failed", severity: 4 },
  "email.bounced": { status: "bounced", severity: 5 },
  "email.complained": { status: "complained", severity: 6 },
} as const;

export type ResendEventName = keyof typeof RESEND_EVENT_STATUSES;

export type ResendEmailEvent = {
  name: ResendEventName;
  messageId: string;
  occurredAt: Date;
  status: (typeof RESEND_EVENT_STATUSES)[ResendEventName]["status"];
  severity: number;
};

type ResendPayload = {
  type?: unknown;
  created_at?: unknown;
  data?: { email_id?: unknown };
};

export function verifyResendPayload(rawBody: Buffer, headers: WebhookRequiredHeaders, secret: string): unknown {
  return new Webhook(secret).verify(rawBody, headers);
}

export function parseResendEmailEvent(payload: unknown): ResendEmailEvent | null {
  if (!payload || typeof payload !== "object") return null;
  const { type, created_at, data } = payload as ResendPayload;
  if (typeof type !== "string" || !(type in RESEND_EVENT_STATUSES)) return null;
  if (!data || typeof data.email_id !== "string" || !data.email_id) return null;
  if (typeof created_at !== "string") return null;
  const occurredAt = new Date(created_at);
  if (Number.isNaN(occurredAt.getTime())) return null;
  const event = RESEND_EVENT_STATUSES[type as ResendEventName];
  return { name: type as ResendEventName, messageId: data.email_id, occurredAt, ...event };
}

export function shouldApplyProviderEvent(
  currentStatus: string,
  currentEventAt: Date | null,
  incoming: ResendEmailEvent,
): boolean {
  const currentSeverity = Object.values(RESEND_EVENT_STATUSES)
    .find((event) => event.status === currentStatus)?.severity ?? 0;
  return incoming.severity > currentSeverity
    || (incoming.severity === currentSeverity && (!currentEventAt || incoming.occurredAt > currentEventAt));
}

/** A stale event is known and intentionally quiet; only no matching record warns. */
export function isUnknownProviderMessage(enquiryMatched: boolean, inviteMatched: boolean): boolean {
  return !enquiryMatched && !inviteMatched;
}