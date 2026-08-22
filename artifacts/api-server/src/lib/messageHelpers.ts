/**
 * Shared helpers for the guest–host messaging feature.
 *
 * Security notes:
 * - sha256hex / DEVICE_TOKEN constants reuse orderHelpers to stay consistent.
 * - Separate ProcessLocalRateLimiter instances: messaging rate limits are
 *   independent from order rate limits.
 * - PII is never logged.
 */
import {
  GUEST_PHONE_MAX,
  GUEST_PHONE_MIN_DIGITS,
  ProcessLocalRateLimiter,
  hasMinimumPhoneDigits,
  requiredOrderFieldMessage,
  wrongOrderPasswordMessage,
} from "./orderHelpers";

export const MESSAGE_BODY_MAX = 2000;
export const MESSAGE_GUEST_NAME_MAX = 200;
export const MESSAGE_GUEST_UNIT_MAX = 100;
export const MESSAGE_GUEST_PHONE_MAX = GUEST_PHONE_MAX;
export const MESSAGE_GUEST_PHONE_MIN_DIGITS = GUEST_PHONE_MIN_DIGITS;
export const MESSAGE_PASSWORD_MAX = 200;

export function requiredMessageNameMessage(lang: string | undefined): string {
  return requiredOrderFieldMessage(lang);
}

export function requiredMessageUnitMessage(lang: string | undefined): string {
  return requiredOrderFieldMessage(lang);
}

export function requiredMessagePhoneMessage(lang: string | undefined): string {
  return requiredOrderFieldMessage(lang);
}

const INVALID_MESSAGE_PHONE_MESSAGES = {
  sl: "Telefonska številka mora vsebovati vsaj 6 števk.",
  en: "The phone number must contain at least 6 digits.",
  de: "Die Telefonnummer muss mindestens 6 Ziffern enthalten.",
  it: "Il numero di telefono deve contenere almeno 6 cifre.",
} as const;

export function invalidMessagePhoneMessage(lang: string | undefined): string {
  const normalizedLang =
    lang === "en" || lang === "de" || lang === "it" ? lang : "sl";
  return INVALID_MESSAGE_PHONE_MESSAGES[normalizedLang];
}

export function hasMinimumMessagePhoneDigits(value: string): boolean {
  return hasMinimumPhoneDigits(value, MESSAGE_GUEST_PHONE_MIN_DIGITS);
}

export function wrongMessagePasswordMessage(lang: string | undefined): string {
  return wrongOrderPasswordMessage(lang);
}

// ─── Per-feature rate limiters ────────────────────────────────────────────────

// Guest message send: 5/min per IP — separate from orders
export const msgIpRateLimiter = new ProcessLocalRateLimiter({
  limit: 5,
  windowMs: 60_000,
});

// Guest message send: 5/min per device token hash — separate from orders
export const msgDeviceRateLimiter = new ProcessLocalRateLimiter({
  limit: 5,
  windowMs: 60_000,
});

// Clean up stale buckets every 5 minutes
setInterval(() => {
  msgIpRateLimiter.cleanup();
  msgDeviceRateLimiter.cleanup();
}, 5 * 60 * 1000).unref();
