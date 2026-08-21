/**
 * Shared helpers for the Living Guide orders feature.
 *
 * Security notes:
 * - sha256hex: one-way SHA-256 so raw device tokens are NEVER stored/returned
 * - makeIdempotencyKey: composite hash prevents duplicate rows on client retry.
 *   x-idempotency-key header is REQUIRED (16-128 chars) so every order carries
 *   a distinct key; an absent key is rejected at the route level.
 * - Rate limiting is process-local (per-IP and per-device) — well below 15/min
 * - PII is never logged; error messages never echo request bodies
 */
import crypto from "node:crypto";

// ─── Validation constants ────────────────────────────────────────────────────

/** Minimum length of the raw device token header (x-device-token). */
export const DEVICE_TOKEN_MIN = 16;
/** Maximum length of the raw device token header (x-device-token). */
export const DEVICE_TOKEN_MAX = 256;

/** Minimum length of the idempotency key header (x-idempotency-key). */
export const IDEMPOTENCY_KEY_MIN = 16;
/** Maximum length of the idempotency key header (x-idempotency-key). */
export const IDEMPOTENCY_KEY_MAX = 128;

// ─── Guest-field max lengths ──────────────────────────────────────────────────

export const GUEST_NAME_MAX = 200;
export const GUEST_PHONE_MAX = 50;
export const GUEST_UNIT_MAX = 100;
export const GUEST_NOTE_MAX = 500;
export const STATUS_NOTE_MAX = 300;

// ─── Stale-claim reclaim threshold ───────────────────────────────────────────

/**
 * How long an ACTIVE send claim ('sending' with notificationClaimedAt) may live
 * before another request is allowed to reclaim it (treating the original sender
 * as crashed). 2 minutes is generous relative to any reasonable HTTP timeout.
 *
 * Provider-level idempotency (Idempotency-Key header = orderRef) ensures the
 * email is sent at most once even if two processes overlap during the stale
 * window. The claim token additionally guarantees only ONE attempt can move the
 * row to sent/failed, so a stale attempt can never overwrite a newer claim.
 *
 * Kept exported under the historic name STALE_PENDING_MS for compatibility with
 * existing call sites; also re-exported as STALE_CLAIM_MS with clearer intent.
 */
export const STALE_PENDING_MS = 2 * 60 * 1000; // 2 minutes
export const STALE_CLAIM_MS = STALE_PENDING_MS;

// ─── Token & idempotency hashing ─────────────────────────────────────────────

/**
 * SHA-256 hex digest of an arbitrary string.  Used for device-token storage
 * and idempotency keys so raw secrets never appear in the database or logs.
 */
export function sha256hex(value: string): string {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}

/**
 * Build the composite idempotency key that prevents duplicate orders when a
 * client retries after a network timeout.
 *
 * key = SHA-256 of "<tenantId>:<deviceTokenHash>:<clientKey>"
 *
 * clientKey is the validated x-idempotency-key header value (required, 16-128 chars).
 */
export function makeIdempotencyKey(
  tenantId: string,
  deviceTokenHash: string,
  clientKey: string,
): string {
  return sha256hex(`${tenantId}:${deviceTokenHash}:${clientKey}`);
}

// ─── Claim token generation ──────────────────────────────────────────────────

/**
 * Generate a fresh cryptographically random claim token for a send attempt.
 * 128 bits of entropy as hex. Every attempt that transitions a row into
 * 'sending' rotates this so completion updates can match on the exact token.
 */
export function makeClaimToken(): string {
  return crypto.randomBytes(16).toString("hex");
}

// ─── Notification action decision ────────────────────────────────────────────

/**
 * Minimal representation of an existing order row used for the action decision.
 * Only the fields needed for the decision — no PII.
 */
export interface ExistingOrderSummary {
  notificationStatus: string;
  /**
   * When the current active claim was taken ('sending' rows). Null for
   * pending/sent/failed rows. Used to detect an expired (crashed) claim.
   */
  notificationClaimedAt: Date | null;
}

/**
 * What the create-order handler should do when it finds an existing row for
 * the composite idempotency key.
 *
 *   'conflict_sent'         — Row already delivered or notification skipped
 *                             → return existing visible order
 *   'processing'            — Row is 'sending' with a FRESH (non-expired) claim →
 *                             another attempt owns it; return 425 without sending
 *   'claim_failed'          — Row is 'failed' → caller should atomically reclaim
 *                             (rotate token, → 'sending') and resend
 *   'reclaim_stale_claim'   — Row is 'sending' but notificationClaimedAt is older
 *                             than STALE_CLAIM_MS (crashed sender) → caller should
 *                             atomically reclaim (rotate token, → 'sending') and
 *                             resend. Recovery may reclaim ONLY an expired claim.
 *   'claim_pending'         — Row is 'pending' (inserted but never claimed — should
 *                             be transient) → caller should atomically claim it.
 */
export type NotificationAction =
  | "conflict_sent"
  | "processing"
  | "claim_failed"
  | "reclaim_stale_claim"
  | "claim_pending";

/**
 * Pure function: decide what to do when a row already exists for this key.
 *
 * This is extracted as a testable pure function — no DB or I/O involved.
 * The decision is advisory; the route still performs the claim via a conditional
 * atomic UPDATE, so losing a race after this decision is handled safely.
 *
 * @param existing        Summary of the existing row (status + claimedAt)
 * @param nowMs           Current time in milliseconds (injectable for tests)
 * @param staleClaimMs    Stale active-claim threshold (injectable for tests)
 */
export function decideNotificationAction(
  existing: ExistingOrderSummary,
  nowMs: number = Date.now(),
  staleClaimMs: number = STALE_CLAIM_MS,
): NotificationAction {
  if (
    existing.notificationStatus === "sent" ||
    existing.notificationStatus === "skipped"
  ) {
    return "conflict_sent";
  }
  if (existing.notificationStatus === "failed") return "claim_failed";
  if (existing.notificationStatus === "pending") return "claim_pending";
  // notificationStatus === 'sending' (active claim)
  const claimedAt = existing.notificationClaimedAt;
  if (claimedAt === null) {
    // Defensive: 'sending' without a claim timestamp is treated as reclaimable.
    return "reclaim_stale_claim";
  }
  const ageMs = nowMs - claimedAt.getTime();
  if (ageMs >= staleClaimMs) return "reclaim_stale_claim";
  return "processing";
}

// ─── Status transition enforcement ───────────────────────────────────────────

export type OrderStatus = "novo" | "potrjeno" | "prevzeto" | "zavrnjeno";

const TERMINAL: ReadonlySet<string> = new Set(["prevzeto", "zavrnjeno"]);

const ALLOWED: Record<string, ReadonlySet<string>> = {
  novo: new Set(["potrjeno", "zavrnjeno"]),
  potrjeno: new Set(["prevzeto", "zavrnjeno"]),
};

/**
 * Returns true when the transition from `from` → `to` is permitted.
 *
 * Matrix:
 *   novo      → potrjeno | zavrnjeno
 *   potrjeno  → prevzeto | zavrnjeno
 *   prevzeto  → (nothing — terminal)
 *   zavrnjeno → (nothing — terminal)
 */
export function isAllowedTransition(from: string, to: string): boolean {
  if (TERMINAL.has(from)) return false;
  return ALLOWED[from]?.has(to) ?? false;
}

/**
 * Returns true when `status` is a terminal status that cannot change.
 */
export function isTerminal(status: string): boolean {
  return TERMINAL.has(status);
}

// ─── Process-local rate limiter ───────────────────────────────────────────────

interface RateLimitBucket {
  count: number;
  resetAt: number;
}

const DEFAULT_WINDOW_MS = 60_000; // 1 minute
const DEFAULT_LIMIT = 5; // well below 15/min

/**
 * A very simple process-local token-bucket rate limiter.
 * Keyed by an arbitrary string (IP address or device token hash).
 * Not distributed — acceptable for a single-process API server behind a proxy.
 *
 * Returns true when the request should be ALLOWED; false when rate-limited.
 */
export class ProcessLocalRateLimiter {
  private readonly buckets = new Map<string, RateLimitBucket>();
  private readonly windowMs: number;
  private readonly limit: number;

  constructor(opts: { windowMs?: number; limit?: number } = {}) {
    this.windowMs = opts.windowMs ?? DEFAULT_WINDOW_MS;
    this.limit = opts.limit ?? DEFAULT_LIMIT;
  }

  allow(key: string): boolean {
    const now = Date.now();
    const bucket = this.buckets.get(key);
    if (!bucket || now >= bucket.resetAt) {
      this.buckets.set(key, { count: 1, resetAt: now + this.windowMs });
      return true;
    }
    if (bucket.count >= this.limit) return false;
    bucket.count++;
    return true;
  }

  /** Remove expired buckets (call periodically to prevent unbounded memory). */
  cleanup(): void {
    const now = Date.now();
    for (const [key, bucket] of this.buckets) {
      if (now >= bucket.resetAt) this.buckets.delete(key);
    }
  }
}

// Per-IP limiter: 5 orders/min/IP
export const ipRateLimiter = new ProcessLocalRateLimiter({ limit: 5, windowMs: 60_000 });
// Per-device limiter: 5 orders/min/device
export const deviceRateLimiter = new ProcessLocalRateLimiter({ limit: 5, windowMs: 60_000 });

// Clean up stale buckets every 5 minutes
setInterval(() => {
  ipRateLimiter.cleanup();
  deviceRateLimiter.cleanup();
}, 5 * 60 * 1000).unref();

// ─── Order retention ──────────────────────────────────────────────────────────

export const ORDER_RETENTION_DAYS = 90;

/** Returns the deleteAfter timestamp for a new order (90 days from now). */
export function makeDeleteAfter(): Date {
  return new Date(Date.now() + ORDER_RETENTION_DAYS * 24 * 60 * 60 * 1000);
}

// ─── Guest field trimming ─────────────────────────────────────────────────────

/**
 * Trim and validate a required guest string field.
 * Returns { ok: true, value } when valid, { ok: false, error } when not.
 */
export function validateGuestField(
  raw: unknown,
  fieldName: string,
  maxLen: number,
): { ok: true; value: string } | { ok: false; error: string } {
  if (typeof raw !== "string") {
    return { ok: false, error: `${fieldName} is required` };
  }
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return { ok: false, error: `${fieldName} must not be blank` };
  }
  if (trimmed.length > maxLen) {
    return { ok: false, error: `${fieldName} must be at most ${maxLen} characters` };
  }
  return { ok: true, value: trimmed };
}
