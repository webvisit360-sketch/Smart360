import { db, hostAuthEventsTable, hostInvitesTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export type HostInviteDeliveryFailure = {
  code: string;
  message: string;
  httpStatus: number | null;
  stage: "configuration" | "provider" | "transport";
};

const FAILURE_MESSAGES = {
  missing_api_key: "Poštni ključ ni nastavljen",
  sender_configuration: "Pošiljatelj ni pravilno nastavljen",
  provider_unauthorized: "Ponudnik je zavrnil poštni ključ",
  provider_forbidden: "Ponudnik ni dovolil pošiljanja",
  provider_rate_limited: "Ponudnik je omejil hitrost pošiljanja",
  validation_error: "Ponudnik je zavrnil podatke sporočila",
  missing_required_field: "Ponudnik je zavrnil podatke sporočila",
  invalid_parameter: "Ponudnik je zavrnil podatke sporočila",
  provider_rejected: "Ponudnik je zavrnil pošiljanje",
  missing_message_id: "Ponudnik ni vrnil identifikatorja sporočila",
  transport_timeout: "Pošiljanje pošte je poteklo",
  transport_error: "Povezava s poštnim ponudnikom ni uspela",
} as const;

type KnownFailureCode = keyof typeof FAILURE_MESSAGES;
const FAILURE_CODES = new Set<string>(Object.keys(FAILURE_MESSAGES));
const FAILURE_STAGES = new Set<HostInviteDeliveryFailure["stage"]>([
  "configuration",
  "provider",
  "transport",
]);

/**
 * Converts a sender result (including the former bare `{ ok: false }` result)
 * to the small, non-sensitive failure vocabulary that may be persisted.
 */
export function safeHostInviteDeliveryFailure(result: unknown): HostInviteDeliveryFailure {
  if (result && typeof result === "object" && "error" in result) {
    const error = result.error;
    if (error && typeof error === "object") {
      const raw = error as Record<string, unknown>;
      const code = typeof raw["code"] === "string" && FAILURE_CODES.has(raw["code"])
        ? raw["code"] as KnownFailureCode
        : null;
      const stage = typeof raw["stage"] === "string" && FAILURE_STAGES.has(
        raw["stage"] as HostInviteDeliveryFailure["stage"],
      )
        ? raw["stage"] as HostInviteDeliveryFailure["stage"]
        : null;
      const httpStatus = raw["httpStatus"] === null
        ? null
        : typeof raw["httpStatus"] === "number" &&
            Number.isInteger(raw["httpStatus"]) &&
            raw["httpStatus"] >= 100 &&
            raw["httpStatus"] <= 599
          ? raw["httpStatus"]
          : null;
      if (code && stage) {
        return { code, stage, httpStatus, message: FAILURE_MESSAGES[code] };
      }
    }
  }
  return {
    code: "transport_error",
    message: FAILURE_MESSAGES.transport_error,
    httpStatus: null,
    stage: "transport",
  };
}

/** Validate an audit detail before returning it through the owner API. */
export function parseHostInviteDeliveryFailure(
  detail: unknown,
  expectedInviteId: string,
): HostInviteDeliveryFailure | null {
  if (typeof detail !== "string" || detail.length > 1_000) return null;
  try {
    const parsed: unknown = JSON.parse(detail);
    if (!parsed || typeof parsed !== "object") return null;
    const record = parsed as Record<string, unknown>;
    if (record["inviteId"] !== expectedInviteId) return null;
    const error = record["error"];
    if (!error || typeof error !== "object") return null;
    const raw = error as Record<string, unknown>;
    if (
      typeof raw["code"] !== "string" ||
      !FAILURE_CODES.has(raw["code"]) ||
      typeof raw["stage"] !== "string" ||
      !FAILURE_STAGES.has(raw["stage"] as HostInviteDeliveryFailure["stage"]) ||
      typeof raw["message"] !== "string" ||
      raw["message"].length < 1 ||
      raw["message"].length > 300 ||
      (raw["httpStatus"] !== null &&
        (typeof raw["httpStatus"] !== "number" ||
          !Number.isInteger(raw["httpStatus"]) ||
          raw["httpStatus"] < 100 ||
          raw["httpStatus"] > 599))
    ) {
      return null;
    }
    // Reconstruct the public value from the same canonical map rather than
    // trusting even a syntactically valid historical message.
    return safeHostInviteDeliveryFailure({ error: raw });
  } catch {
    return null;
  }
}

export async function recordHostInviteDeliveryFailure(
  inviteId: string,
  result: unknown,
): Promise<HostInviteDeliveryFailure> {
  const error = safeHostInviteDeliveryFailure(result);
  await db.transaction(async (tx) => {
    const [invite] = await tx
      .update(hostInvitesTable)
      .set({
        deliveryStatus: "failed",
        providerMessageId: null,
        deliveryAttemptedAt: new Date(),
      })
      .where(eq(hostInvitesTable.id, inviteId))
      .returning({ hostUserId: hostInvitesTable.hostUserId });
    if (!invite) throw new Error("Invite not found while recording delivery failure");
    await tx.insert(hostAuthEventsTable).values({
      hostUserId: invite.hostUserId,
      type: "invite_delivery_failed",
      detail: JSON.stringify({ inviteId, error }),
    });
  });
  return error;
}