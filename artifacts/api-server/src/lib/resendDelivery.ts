export type ResendFailure = {
  ok: false;
  error: {
    code: string;
    message: string;
    httpStatus: number | null;
    stage: "configuration" | "provider" | "transport";
  };
};

export type ResendResult =
  | { ok: true; providerMessageId: string | null }
  | ResendFailure;

const RESEND_EMAILS_URL = "https://api.resend.com/emails";
const DEFAULT_TIMEOUT_MS = 10_000;

type ResendBody = Record<string, unknown>;

function failure(
  code: string,
  message: string,
  httpStatus: number | null,
  stage: ResendFailure["error"]["stage"],
): ResendFailure {
  return { ok: false, error: { code, message, httpStatus, stage } };
}

export function resendConfigurationFailure(): ResendFailure | null {
  return process.env["RESEND_API_KEY"]?.trim()
    ? null
    : failure("missing_api_key", "Poštni ključ ni nastavljen", null, "configuration");
}

function providerFailure(status: number, providerName: unknown): ResendFailure {
  const allowedName =
    typeof providerName === "string" &&
    ["validation_error", "missing_required_field", "invalid_parameter"].includes(providerName)
      ? providerName
      : null;
  if (status === 401) {
    return failure("provider_unauthorized", "Ponudnik je zavrnil poštni ključ", status, "provider");
  }
  if (status === 403) {
    return failure("provider_forbidden", "Ponudnik ni dovolil pošiljanja", status, "provider");
  }
  if (status === 429) {
    return failure("provider_rate_limited", "Ponudnik je omejil hitrost pošiljanja", status, "provider");
  }
  if (allowedName) {
    return failure(allowedName, "Ponudnik je zavrnil podatke sporočila", status, "provider");
  }
  return failure("provider_rejected", "Ponudnik je zavrnil pošiljanje", status, "provider");
}

/**
 * Deliver one message directly to Resend. This function never retries: after a
 * network ambiguity a retry could create a duplicate delivery.
 */
export async function deliverResend(
  body: ResendBody,
  options: { idempotencyKey?: string; timeoutMs?: number } = {},
): Promise<ResendResult> {
  const configurationFailure = resendConfigurationFailure();
  if (configurationFailure) return configurationFailure;
  const apiKey = process.env["RESEND_API_KEY"]!.trim();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  try {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    };
    if (options.idempotencyKey) headers["Idempotency-Key"] = options.idempotencyKey;

    const response = await fetch(RESEND_EMAILS_URL, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const payload: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const providerName =
        payload && typeof payload === "object" && "name" in payload ? payload.name : null;
      return providerFailure(response.status, providerName);
    }
    const providerMessageId =
      payload && typeof payload === "object" && "id" in payload && typeof payload.id === "string"
        ? payload.id
        : null;
    if (!providerMessageId) {
      return failure(
        "missing_message_id",
        "Ponudnik ni vrnil identifikatorja sporočila",
        response.status,
        "provider",
      );
    }
    return { ok: true, providerMessageId };
  } catch (error) {
    if (
      controller.signal.aborted ||
      (error instanceof Error && error.name === "AbortError")
    ) {
      return failure("transport_timeout", "Pošiljanje pošte je poteklo", null, "transport");
    }
    return failure("transport_error", "Povezava s poštnim ponudnikom ni uspela", null, "transport");
  } finally {
    clearTimeout(timeout);
  }
}