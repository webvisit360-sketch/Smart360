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
  ProcessLocalRateLimiter,
  requiredOrderFieldMessage,
  wrongOrderPasswordMessage,
} from "./orderHelpers";

export const MESSAGE_BODY_MAX = 2000;
export const MESSAGE_GUEST_NAME_MAX = 200;
export const MESSAGE_GUEST_UNIT_MAX = 100;
export const MESSAGE_PASSWORD_MAX = 200;

export function requiredMessageNameMessage(lang: string | undefined): string {
  return requiredOrderFieldMessage(lang);
}

export function requiredMessageUnitMessage(lang: string | undefined): string {
  return requiredOrderFieldMessage(lang);
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
