/**
 * Focused unit tests for Living Guide orders helpers.
 *
 * Covers:
 *  - sha256hex: determinism, uniqueness, output format
 *  - makeIdempotencyKey: composition, isolation, required-key semantics
 *  - makeClaimToken: format + cryptographic uniqueness
 *  - decideNotificationAction: all outcomes, stale-claim boundary (sending model)
 *  - Exact claim identity: stale-A / new-B completion race cannot clobber
 *  - Status transition matrix (all valid + all invalid transitions)
 *  - ProcessLocalRateLimiter: limit, window reset, cleanup, 20-rapid throttle
 *  - makeDeleteAfter / ORDER_RETENTION_DAYS / STALE_PENDING_MS / STALE_CLAIM_MS
 *  - Guest field validation (validateGuestField, trim, maxLength)
 *  - extractFulfillmentSentence: keyword detection, markup stripping,
 *    default fallback, producerNote isolation, per-language keywords
 *  - hasDeliveryKeyword: spot checks
 *  - stripMarkup: HTML entity / tag stripping
 *  - buildEmailHeaders: exact Idempotency-Key header name and value
 *  - buildEmailBody: snapshot fields used, guestUnit, qty, no computed total
 *  - Stored-snapshot retry payload (pure simulation)
 *  - Conditional failure/sent state expectations (pure simulation)
 *  - Header length bounds constants
 *
 * No DB schema is required for any test here — all helpers are pure functions.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  sha256hex,
  makeIdempotencyKey,
  makeClaimToken,
  isAllowedTransition,
  isTerminal,
  decideNotificationAction,
  ProcessLocalRateLimiter,
  makeDeleteAfter,
  ORDER_RETENTION_DAYS,
  STALE_PENDING_MS,
  STALE_CLAIM_MS,
  validateGuestField,
  DEVICE_TOKEN_MIN,
  DEVICE_TOKEN_MAX,
  IDEMPOTENCY_KEY_MIN,
  IDEMPOTENCY_KEY_MAX,
  GUEST_NAME_MAX,
  GUEST_PHONE_MAX,
  GUEST_PHONE_MIN_DIGITS,
  GUEST_UNIT_MAX,
  GUEST_NOTE_MAX,
  STATUS_NOTE_MAX,
  hasMinimumPhoneDigits,
  ORDER_PASSWORD_MAX,
  matchesOrderPassword,
  requiredOrderFieldMessage,
  wrongOrderPasswordMessage,
  type ExistingOrderSummary,
} from "../lib/orderHelpers";

import {
  extractFulfillmentSentence,
  hasDeliveryKeyword,
  stripMarkup,
  DEFAULT_FULFILLMENT,
} from "../lib/orderFulfillment";

import {
  buildEmailHeaders,
  buildEmailBody,
  ORDER_EMAIL_FROM_ADDRESS,
  ORDER_EMAIL_FROM_NAME,
  type OrderEmailPayload,
} from "../lib/orderEmail";

// ─── Header bounds constants ──────────────────────────────────────────────────

describe("header length constants", () => {
  test("DEVICE_TOKEN_MIN = 16", () => assert.equal(DEVICE_TOKEN_MIN, 16));
  test("DEVICE_TOKEN_MAX = 256", () => assert.equal(DEVICE_TOKEN_MAX, 256));
  test("IDEMPOTENCY_KEY_MIN = 16", () => assert.equal(IDEMPOTENCY_KEY_MIN, 16));
  test("IDEMPOTENCY_KEY_MAX = 128", () => assert.equal(IDEMPOTENCY_KEY_MAX, 128));
  test("GUEST_NAME_MAX = 200", () => assert.equal(GUEST_NAME_MAX, 200));
  test("GUEST_PHONE_MAX = 50", () => assert.equal(GUEST_PHONE_MAX, 50));
  test("GUEST_PHONE_MIN_DIGITS = 6", () => assert.equal(GUEST_PHONE_MIN_DIGITS, 6));
  test("GUEST_UNIT_MAX = 100", () => assert.equal(GUEST_UNIT_MAX, 100));
  test("GUEST_NOTE_MAX = 500", () => assert.equal(GUEST_NOTE_MAX, 500));
  test("STATUS_NOTE_MAX = 300", () => assert.equal(STATUS_NOTE_MAX, 300));
  test("ORDER_PASSWORD_MAX = 200", () => assert.equal(ORDER_PASSWORD_MAX, 200));
  test("STALE_PENDING_MS = 120000 (2 minutes)", () => assert.equal(STALE_PENDING_MS, 120_000));
});

describe("hasMinimumPhoneDigits", () => {
  test("rejects non-digit text", () => {
    assert.equal(hasMinimumPhoneDigits("abcdef"), false);
  });

  test("accepts an international number with spaces and plus", () => {
    assert.equal(hasMinimumPhoneDigits("+386 41 998 660"), true);
  });

  test("accepts local separators without normalizing the input", () => {
    const phone = "041/998-660";
    assert.equal(hasMinimumPhoneDigits(phone), true);
    assert.equal(phone, "041/998-660");
  });

  test("rejects five digits even with allowed formatting", () => {
    assert.equal(hasMinimumPhoneDigits("+12 / 34-5."), false);
  });
});

describe("tenant order password", () => {
  test("empty or unset tenant password opts out", () => {
    assert.equal(matchesOrderPassword(null, undefined), true);
    assert.equal(matchesOrderPassword("   ", "anything"), true);
  });

  test("trims both sides and remains case-sensitive", () => {
    assert.equal(matchesOrderPassword("  Stay-2026  ", " Stay-2026 "), true);
    assert.equal(matchesOrderPassword("Stay-2026", "stay-2026"), false);
  });

  test("missing or incorrect submitted password is rejected", () => {
    assert.equal(matchesOrderPassword("Stay-2026", undefined), false);
    assert.equal(matchesOrderPassword("Stay-2026", "wrong"), false);
  });

  test("returns the exact localized error messages", () => {
    assert.equal(wrongOrderPasswordMessage("sl"), "Napačno geslo");
    assert.equal(wrongOrderPasswordMessage("en"), "Wrong password");
    assert.equal(wrongOrderPasswordMessage("de"), "Falsches Passwort");
    assert.equal(wrongOrderPasswordMessage("it"), "Password errata");
  });
});

describe("required order fields", () => {
  test("returns the same localized required-field error as the order form", () => {
    assert.equal(requiredOrderFieldMessage("sl"), "To polje je obvezno.");
    assert.equal(requiredOrderFieldMessage("en"), "This field is required.");
    assert.equal(requiredOrderFieldMessage("de"), "Dieses Feld ist erforderlich.");
    assert.equal(requiredOrderFieldMessage("it"), "Questo campo è obbligatorio.");
  });
});

// ─── Token hashing ────────────────────────────────────────────────────────────

describe("sha256hex", () => {
  test("produces a 64-char hex string", () => {
    const h = sha256hex("hello");
    assert.equal(h.length, 64);
    assert.match(h, /^[0-9a-f]{64}$/);
  });

  test("is deterministic", () => {
    assert.equal(sha256hex("token123"), sha256hex("token123"));
  });

  test("is distinct for different inputs", () => {
    assert.notEqual(sha256hex("tokenA"), sha256hex("tokenB"));
  });

  test("raw token and hash are different", () => {
    const raw = "my-secret-device-token-12345";
    assert.notEqual(raw, sha256hex(raw));
  });
});

// ─── Idempotency key ─────────────────────────────────────────────────────────

describe("makeIdempotencyKey", () => {
  test("same inputs produce same key (retry safety)", () => {
    const k1 = makeIdempotencyKey("tenant1", "deviceHash", "client-key-abc123456");
    const k2 = makeIdempotencyKey("tenant1", "deviceHash", "client-key-abc123456");
    assert.equal(k1, k2);
  });

  test("different tenant → different key (tenant isolation)", () => {
    const k1 = makeIdempotencyKey("tenant1", "deviceHash", "client-key-abc123456");
    const k2 = makeIdempotencyKey("tenant2", "deviceHash", "client-key-abc123456");
    assert.notEqual(k1, k2);
  });

  test("different device → different key (device isolation)", () => {
    const k1 = makeIdempotencyKey("tenant1", "deviceHashA", "client-key-abc123456");
    const k2 = makeIdempotencyKey("tenant1", "deviceHashB", "client-key-abc123456");
    assert.notEqual(k1, k2);
  });

  test("different clientKey → different key (intent isolation)", () => {
    const k1 = makeIdempotencyKey("tenant1", "deviceHash", "client-key-aaaaaaaaa");
    const k2 = makeIdempotencyKey("tenant1", "deviceHash", "client-key-bbbbbbbbb");
    assert.notEqual(k1, k2);
  });

  test("produces a 64-char hex string", () => {
    const k = makeIdempotencyKey("t", "d", "c");
    assert.match(k, /^[0-9a-f]{64}$/);
  });

  test("minimum-length valid clientKey (16 chars) is accepted", () => {
    const k = makeIdempotencyKey("tenant1", "hash", "1234567890123456");
    assert.equal(k.length, 64);
  });

  test("two orders from same device with DIFFERENT keys get DIFFERENT idempotency keys", () => {
    const k1 = makeIdempotencyKey("t", "d", "order-intent-one-aaaa");
    const k2 = makeIdempotencyKey("t", "d", "order-intent-two-bbbb");
    assert.notEqual(k1, k2, "different order intents must not conflict");
  });
});

// ─── makeClaimToken ──────────────────────────────────────────────────────────

describe("makeClaimToken", () => {
  test("produces a 32-char hex string (128 bits)", () => {
    const t = makeClaimToken();
    assert.match(t, /^[0-9a-f]{32}$/);
  });

  test("is unique across calls (cryptographically random)", () => {
    const tokens = new Set<string>();
    for (let i = 0; i < 1000; i++) tokens.add(makeClaimToken());
    assert.equal(tokens.size, 1000, "1000 tokens must all be distinct");
  });
});

// ─── decideNotificationAction ────────────────────────────────────────────────

describe("decideNotificationAction", () => {
  const NOW = Date.now();
  const FRESH = new Date(NOW - 30_000);        // 30 s ago — well within 2-min window
  const STALE = new Date(NOW - STALE_CLAIM_MS - 1000); // just past threshold

  function existing(
    status: "pending" | "sending" | "sent" | "failed" | "skipped",
    claimedAt: Date | null = null,
  ): ExistingOrderSummary {
    return { notificationStatus: status, notificationClaimedAt: claimedAt };
  }

  test("STALE_CLAIM_MS aliases STALE_PENDING_MS", () => {
    assert.equal(STALE_CLAIM_MS, STALE_PENDING_MS);
  });

  test("sent → conflict_sent", () => {
    assert.equal(decideNotificationAction(existing("sent"), NOW), "conflict_sent");
  });

  test("skipped → conflict_sent (visible idempotent success, no email retry)", () => {
    assert.equal(decideNotificationAction(existing("skipped"), NOW), "conflict_sent");
  });

  test("failed → claim_failed", () => {
    assert.equal(decideNotificationAction(existing("failed"), NOW), "claim_failed");
  });

  test("pending (unclaimed) → claim_pending", () => {
    assert.equal(decideNotificationAction(existing("pending"), NOW), "claim_pending");
  });

  test("fresh sending claim → processing (another attempt owns it)", () => {
    assert.equal(decideNotificationAction(existing("sending", FRESH), NOW), "processing");
  });

  test("stale sending claim (past threshold) → reclaim_stale_claim", () => {
    assert.equal(decideNotificationAction(existing("sending", STALE), NOW), "reclaim_stale_claim");
  });

  test("sending with null claimedAt → reclaim_stale_claim (defensive)", () => {
    assert.equal(decideNotificationAction(existing("sending", null), NOW), "reclaim_stale_claim");
  });

  test("sending exactly at threshold boundary → reclaim_stale_claim (>= check)", () => {
    // claimedAt = exactly STALE_CLAIM_MS ago → ageMs = STALE_CLAIM_MS
    // Function uses >=, so this IS stale; DB lte() also picks it up.
    const exactBoundary = new Date(NOW - STALE_CLAIM_MS);
    assert.equal(decideNotificationAction(existing("sending", exactBoundary), NOW), "reclaim_stale_claim");
  });

  test("sending one ms past threshold → reclaim_stale_claim", () => {
    const oneOver = new Date(NOW - STALE_CLAIM_MS - 1);
    assert.equal(decideNotificationAction(existing("sending", oneOver), NOW), "reclaim_stale_claim");
  });

  test("custom staleClaimMs is respected", () => {
    const customStale = 5_000; // 5 seconds
    const row = new Date(NOW - 6_000); // 6 s ago — stale for 5-s threshold
    assert.equal(
      decideNotificationAction(existing("sending", row), NOW, customStale),
      "reclaim_stale_claim",
    );
    const row2 = new Date(NOW - 4_000); // 4 s ago — not yet stale
    assert.equal(
      decideNotificationAction(existing("sending", row2), NOW, customStale),
      "processing",
    );
  });

  test("sent is unaffected by age — always conflict_sent", () => {
    assert.equal(decideNotificationAction(existing("sent", STALE), NOW), "conflict_sent");
  });
});

// ─── Exact claim identity: stale-A / new-B completion race (pure simulation) ──

describe("exact claim identity — stale-A / new-B completion race", () => {
  type NotifStatus = "pending" | "sending" | "sent" | "failed";

  interface Row {
    notificationStatus: NotifStatus;
    notificationClaimToken: string | null;
  }

  /**
   * Simulate the conditional completion UPDATE the route performs:
   *   UPDATE ... SET status=<target>, token=null
   *   WHERE notificationClaimToken = <attemptToken>
   *     AND notificationStatus = 'sending'
   * Returns true iff the row was actually mutated (matched).
   */
  function completeAttempt(
    row: Row,
    attemptToken: string,
    target: "sent" | "failed",
  ): boolean {
    if (row.notificationStatus === "sending" && row.notificationClaimToken === attemptToken) {
      row.notificationStatus = target;
      row.notificationClaimToken = null;
      return true;
    }
    return false;
  }

  /**
   * Simulate a reclaim UPDATE that rotates the token (stale claim / failed):
   * returns the new token if it matched, else null.
   */
  function reclaim(row: Row, newToken: string, expected: NotifStatus): string | null {
    if (row.notificationStatus === expected) {
      row.notificationStatus = "sending";
      row.notificationClaimToken = newToken;
      return newToken;
    }
    return null;
  }

  test("stale attempt A cannot overwrite a newer claim B", () => {
    // A claims the row (token A)
    const tokenA = makeClaimToken();
    const row: Row = { notificationStatus: "sending", notificationClaimToken: tokenA };

    // A stalls. Its claim expires and B reclaims it (rotates token → B).
    const tokenB = makeClaimToken();
    const reclaimed = reclaim(row, tokenB, "sending");
    assert.equal(reclaimed, tokenB);
    assert.equal(row.notificationClaimToken, tokenB);

    // A finally finishes sending and tries to mark 'sent' with its OLD token.
    const aMatched = completeAttempt(row, tokenA, "sent");
    assert.equal(aMatched, false, "A must NOT mutate a row owned by B");
    assert.equal(row.notificationStatus, "sending", "row still owned by B");
    assert.equal(row.notificationClaimToken, tokenB, "B's token intact");

    // B then completes successfully with its own token.
    const bMatched = completeAttempt(row, tokenB, "sent");
    assert.equal(bMatched, true, "B completes its own claim");
    assert.equal(row.notificationStatus, "sent");
    assert.equal(row.notificationClaimToken, null, "token cleared on completion");
  });

  test("stale attempt A's FAILURE update also cannot clobber B's claim", () => {
    const tokenA = makeClaimToken();
    const row: Row = { notificationStatus: "sending", notificationClaimToken: tokenA };
    const tokenB = makeClaimToken();
    reclaim(row, tokenB, "sending");

    // A's email failed; it tries to mark 'failed' with its stale token.
    const aMatched = completeAttempt(row, tokenA, "failed");
    assert.equal(aMatched, false, "stale failure must not overwrite B");
    assert.equal(row.notificationStatus, "sending");
    assert.equal(row.notificationClaimToken, tokenB);
  });

  test("the owning attempt succeeds when no reclaim happened", () => {
    const tokenA = makeClaimToken();
    const row: Row = { notificationStatus: "sending", notificationClaimToken: tokenA };
    const matched = completeAttempt(row, tokenA, "sent");
    assert.equal(matched, true);
    assert.equal(row.notificationStatus, "sent");
    assert.equal(row.notificationClaimToken, null);
  });

  test("A cannot complete after B already sent (idempotent no-op for A)", () => {
    const tokenA = makeClaimToken();
    const row: Row = { notificationStatus: "sending", notificationClaimToken: tokenA };
    const tokenB = makeClaimToken();
    reclaim(row, tokenB, "sending");
    completeAttempt(row, tokenB, "sent"); // B sends

    // A wakes up and tries to complete with its old token → no match
    const aMatched = completeAttempt(row, tokenA, "sent");
    assert.equal(aMatched, false);
    assert.equal(row.notificationStatus, "sent", "final state is B's success");
  });

  test("reclaim only succeeds from the expected prior state", () => {
    const row: Row = { notificationStatus: "sent", notificationClaimToken: null };
    // Cannot reclaim a 'sent' row as if it were 'failed'
    const t = reclaim(row, makeClaimToken(), "failed");
    assert.equal(t, null, "reclaim must not touch a sent row");
    assert.equal(row.notificationStatus, "sent");
  });

  test("two concurrent reclaimers: only the first rotation wins", () => {
    // Row is 'failed'; two requests both try to reclaim.
    const row: Row = { notificationStatus: "failed", notificationClaimToken: null };
    const tokenX = makeClaimToken();
    const tokenY = makeClaimToken();

    const first = reclaim(row, tokenX, "failed"); // succeeds: failed → sending(X)
    assert.equal(first, tokenX);

    // Second reclaimer expects 'failed' but row is now 'sending' → no match
    const second = reclaim(row, tokenY, "failed");
    assert.equal(second, null, "second reclaimer loses the race");
    assert.equal(row.notificationClaimToken, tokenX, "X owns the claim");
  });
});

// ─── Status transition matrix ─────────────────────────────────────────────────

describe("isAllowedTransition", () => {
  test("novo → potrjeno", () => assert.equal(isAllowedTransition("novo", "potrjeno"), true));
  test("novo → zavrnjeno", () => assert.equal(isAllowedTransition("novo", "zavrnjeno"), true));
  test("potrjeno → prevzeto", () => assert.equal(isAllowedTransition("potrjeno", "prevzeto"), true));
  test("potrjeno → zavrnjeno", () => assert.equal(isAllowedTransition("potrjeno", "zavrnjeno"), true));

  test("novo → prevzeto is NOT allowed", () => assert.equal(isAllowedTransition("novo", "prevzeto"), false));
  test("potrjeno → novo is NOT allowed", () => assert.equal(isAllowedTransition("potrjeno", "novo"), false));
  test("prevzeto → potrjeno is NOT allowed", () => assert.equal(isAllowedTransition("prevzeto", "potrjeno"), false));
  test("prevzeto → zavrnjeno is NOT allowed (terminal)", () => assert.equal(isAllowedTransition("prevzeto", "zavrnjeno"), false));
  test("prevzeto → novo is NOT allowed (terminal)", () => assert.equal(isAllowedTransition("prevzeto", "novo"), false));
  test("zavrnjeno → novo is NOT allowed (terminal)", () => assert.equal(isAllowedTransition("zavrnjeno", "novo"), false));
  test("zavrnjeno → potrjeno is NOT allowed (terminal)", () => assert.equal(isAllowedTransition("zavrnjeno", "potrjeno"), false));
  test("zavrnjeno → prevzeto is NOT allowed (terminal)", () => assert.equal(isAllowedTransition("zavrnjeno", "prevzeto"), false));
  test("unknown from-status is NOT allowed", () => assert.equal(isAllowedTransition("bogus", "potrjeno"), false));
});

describe("isTerminal", () => {
  test("prevzeto is terminal", () => assert.equal(isTerminal("prevzeto"), true));
  test("zavrnjeno is terminal", () => assert.equal(isTerminal("zavrnjeno"), true));
  test("novo is not terminal", () => assert.equal(isTerminal("novo"), false));
  test("potrjeno is not terminal", () => assert.equal(isTerminal("potrjeno"), false));
});

// ─── Rate limiter ─────────────────────────────────────────────────────────────

describe("ProcessLocalRateLimiter", () => {
  test("allows requests below limit", () => {
    const rl = new ProcessLocalRateLimiter({ limit: 3, windowMs: 60_000 });
    assert.equal(rl.allow("key1"), true);
    assert.equal(rl.allow("key1"), true);
    assert.equal(rl.allow("key1"), true);
  });

  test("blocks the request AT the limit boundary", () => {
    const rl = new ProcessLocalRateLimiter({ limit: 2, windowMs: 60_000 });
    rl.allow("key2");
    rl.allow("key2");
    assert.equal(rl.allow("key2"), false);
  });

  test("different keys are independent", () => {
    const rl = new ProcessLocalRateLimiter({ limit: 1, windowMs: 60_000 });
    assert.equal(rl.allow("keyA"), true);
    assert.equal(rl.allow("keyA"), false);
    assert.equal(rl.allow("keyB"), true);
  });

  test("window resets allow new requests", () => {
    const rl = new ProcessLocalRateLimiter({ limit: 1, windowMs: 1 });
    rl.allow("keyReset");
    assert.equal(rl.allow("keyReset"), false);
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        assert.equal(rl.allow("keyReset"), true, "should allow after window reset");
        resolve();
      }, 10);
    });
  });

  test("cleanup removes expired buckets", () => {
    const rl = new ProcessLocalRateLimiter({ limit: 5, windowMs: 1 });
    rl.allow("keyClean");
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        rl.cleanup();
        assert.equal(rl.allow("keyClean"), true);
        resolve();
      }, 10);
    });
  });

  test("20 rapid requests from the same key are throttled at limit=5", () => {
    const rl = new ProcessLocalRateLimiter({ limit: 5, windowMs: 60_000 });
    let allowed = 0;
    for (let i = 0; i < 20; i++) {
      if (rl.allow("rapid")) allowed++;
    }
    assert.equal(allowed, 5, "exactly 5 should be allowed");
  });
});

// ─── Retention helpers ────────────────────────────────────────────────────────

describe("makeDeleteAfter", () => {
  test("returns a date approximately 90 days in the future", () => {
    const before = Date.now();
    const deleteAfter = makeDeleteAfter();
    const after = Date.now();
    const expectedMs = ORDER_RETENTION_DAYS * 24 * 60 * 60 * 1000;
    assert.ok(
      deleteAfter.getTime() >= before + expectedMs &&
        deleteAfter.getTime() <= after + expectedMs,
    );
  });

  test("ORDER_RETENTION_DAYS is 90", () => assert.equal(ORDER_RETENTION_DAYS, 90));
});

// ─── validateGuestField ───────────────────────────────────────────────────────

describe("validateGuestField", () => {
  test("accepts a valid non-blank string", () => {
    const r = validateGuestField("+386 41 123 456", "guestPhone", 50);
    assert.equal(r.ok, true);
    if (r.ok) assert.equal(r.value, "+386 41 123 456");
  });

  test("trims surrounding whitespace", () => {
    const r = validateGuestField("  Ana  ", "guestName", 200);
    assert.equal(r.ok, true);
    if (r.ok) assert.equal(r.value, "Ana");
  });

  test("rejects empty string", () => {
    const r = validateGuestField("", "guestPhone", 50);
    assert.equal(r.ok, false);
  });

  test("rejects whitespace-only string", () => {
    const r = validateGuestField("   \t\n", "guestPhone", 50);
    assert.equal(r.ok, false);
  });

  test("rejects non-string", () => {
    const r = validateGuestField(null, "guestName", 200);
    assert.equal(r.ok, false);
  });

  test("rejects string exceeding maxLen", () => {
    const r = validateGuestField("a".repeat(201), "guestName", 200);
    assert.equal(r.ok, false);
  });

  test("accepts string exactly at maxLen", () => {
    const r = validateGuestField("a".repeat(100), "guestUnit", 100);
    assert.equal(r.ok, true);
  });
});

// ─── buildEmailHeaders ────────────────────────────────────────────────────────

describe("buildEmailHeaders", () => {
  test("sets Content-Type to application/json", () => {
    const headers = buildEmailHeaders("some-order-ref-uuid");
    assert.equal(headers["Content-Type"], "application/json");
  });

  test("uses the exact documented header name 'Idempotency-Key' (not 'Resend-Idempotency-Key')", () => {
    const orderRef = "550e8400-e29b-41d4-a716-446655440000";
    const headers = buildEmailHeaders(orderRef);
    assert.ok(
      "Idempotency-Key" in headers,
      "header 'Idempotency-Key' must be present",
    );
    assert.ok(
      !("Resend-Idempotency-Key" in headers),
      "non-standard 'Resend-Idempotency-Key' must NOT be present",
    );
  });

  test("Idempotency-Key value equals the orderRef", () => {
    const orderRef = "test-order-ref-12345";
    const headers = buildEmailHeaders(orderRef);
    assert.equal(headers["Idempotency-Key"], orderRef);
  });

  test("different orderRefs produce different Idempotency-Key values", () => {
    const h1 = buildEmailHeaders("ref-aaa");
    const h2 = buildEmailHeaders("ref-bbb");
    assert.notEqual(h1["Idempotency-Key"], h2["Idempotency-Key"]);
  });
});

// ─── buildEmailBody ───────────────────────────────────────────────────────────

describe("buildEmailBody", () => {
  const BASE_PAYLOAD: OrderEmailPayload = {
    to: "host@example.com",
    tenantName: "Kmetija Testna",
    orderRef: "aaaabbbb-cccc-dddd-eeee-ffff00001111",
    itemTitle: "Bio jabolka",
    qty: 3,
    price: "25 €",
    priceUnit: "dan",
    guestName: "Ana Novak",
    guestPhone: "+386 41 123 456",
    guestUnit: "B-14",
    guestNote: null,
  };

  test("uses itemTitle from snapshot, not a live request value", () => {
    const body = buildEmailBody(BASE_PAYLOAD, "no-reply@smart360.com");
    const html = body["html"] as string;
    assert.ok(html.includes("Bio jabolka"), "snapshot item title must appear in email");
  });

  test("shows required full name as the first data row", () => {
    const body = buildEmailBody(BASE_PAYLOAD, "no-reply@smart360.com");
    const html = body["html"] as string;
    const nameIndex = html.indexOf("Ime in priimek");
    const itemIndex = html.indexOf("Artikel");
    assert.ok(nameIndex >= 0, "full-name label must appear");
    assert.ok(html.includes("Ana Novak"), "full-name value must appear");
    assert.ok(nameIndex < itemIndex, "full name must be the first data row");
  });

  test("quantity and accommodation unit are separate rows (approved template)", () => {
    const body = buildEmailBody(BASE_PAYLOAD, "no-reply@smart360.com");
    const html = body["html"] as string;
    assert.match(html, /Količina<\/td><td[^>]*>3</, "quantity row must appear");
    assert.ok(!html.includes("3 × B-14"), "guest accommodation unit must not be treated as a product unit");
    assert.match(html, /Enota<\/td><td[^>]*>B-14</, "guest unit must be its own row");
  });

  test("snapshot price renders as 'Cena' row in guest-guide format", () => {
    const body = buildEmailBody(BASE_PAYLOAD, "no-reply@smart360.com");
    const html = body["html"] as string;
    assert.match(html, /Cena<\/td><td[^>]*>25 € \/ dan</, "price row must render as '25 € / dan'");
  });

  test("price row is omitted when snapshot has no price", () => {
    const body = buildEmailBody({ ...BASE_PAYLOAD, price: null }, "no-reply@smart360.com");
    const html = body["html"] as string;
    assert.ok(!html.includes("Cena"), "no price row without a snapshot price");
  });

  test("approved design: seven-cell band, marked tenant kicker, orange CTA", () => {
    const body = buildEmailBody(BASE_PAYLOAD, "no-reply@smart360.com");
    const html = body["html"] as string;
    assert.equal((html.match(/height:5px;line-height:5px;font-size:0;background:/g) ?? []).length, 7);
    assert.ok(html.includes("background:#E8801B"), "approved orange CTA must be present");
    assert.ok(html.includes("color:#150C03"), "approved dark CTA text must be present");
    assert.ok(html.includes("/brand/smart360-znak-40.png"), "hosted mark must be present");
    assert.ok(html.includes("Kmetija Testna"), "brand kicker is the tenant name");
    assert.match(html, /<a href="https?:\/\/[^"]*\/admin"/, "CTA links the plain portal login page");
    assert.ok(!/href="[^"]*token/i.test(html), "no auto-login or token links");
    assert.equal((html.match(/<img/g) ?? []).length, 1, "only the hosted brand mark");
    assert.ok(!html.includes(BASE_PAYLOAD.orderRef), "email stays short; order reference is available in the portal");
  });

  test("carries a plain-text alternative that reads correctly on its own", () => {
    const body = buildEmailBody(BASE_PAYLOAD, "no-reply@smart360.com");
    const text = body["text"] as string;
    assert.ok(text.includes("Novo naročilo"), "text version has the title");
    assert.ok(text.includes("Ime in priimek: Ana Novak"), "text version has data rows");
    assert.ok(!text.includes("<"), "text version contains no HTML");
  });

  test("guestNote row is omitted when null", () => {
    const body = buildEmailBody({ ...BASE_PAYLOAD, guestNote: null }, "from@example.com");
    const html = body["html"] as string;
    assert.ok(!html.includes("Opomba gosta"), "note row should not appear when guestNote is null");
  });

  test("guestNote row appears when provided", () => {
    const body = buildEmailBody(
      { ...BASE_PAYLOAD, guestNote: "Prosim brez pesticidov." },
      "from@example.com",
    );
    const html = body["html"] as string;
    assert.ok(html.includes("Opomba gosta"), "note label must appear");
    assert.ok(html.includes("Prosim brez pesticidov."), "note content must appear");
  });

  test("uses the approved display name and verified sender address", () => {
    const body = buildEmailBody(BASE_PAYLOAD, ORDER_EMAIL_FROM_ADDRESS);
    assert.equal(
      body["from"],
      `${ORDER_EMAIL_FROM_NAME} <${ORDER_EMAIL_FROM_ADDRESS}>`,
    );
  });

  test("reply-to is the approved monitored inbox", () => {
    const body = buildEmailBody(BASE_PAYLOAD, ORDER_EMAIL_FROM_ADDRESS);
    assert.equal(body["reply_to"], "webvisit360@gmail.com");
  });

  test("to is an array containing the payload.to address", () => {
    const body = buildEmailBody(BASE_PAYLOAD, "from@example.com");
    assert.deepEqual(body["to"], ["host@example.com"]);
  });

  test("subject follows the approved file: 'Novo naročilo · <enota> · <artikel>'", () => {
    const body = buildEmailBody(BASE_PAYLOAD, "from@example.com");
    const subject = body["subject"] as string;
    assert.equal(subject, "Novo naročilo · B-14 · Bio jabolka");
    assert.ok(!subject.includes("narudžba"), "Croatian copy must not appear");
  });

  test("inbox preview line follows the approved file", () => {
    const body = buildEmailBody(BASE_PAYLOAD, "from@example.com");
    const html = body["html"] as string;
    assert.ok(
      html.includes("Ana Novak, 3 × · odprite portal za potrditev"),
      "hidden preheader must match '<gost>, <n> × · odprite portal za potrditev'",
    );
  });

  test("HTML uses Slovenian copy: 'naročilo'", () => {
    const body = buildEmailBody(BASE_PAYLOAD, "from@example.com");
    const html = body["html"] as string;
    assert.ok(html.includes("naročilo"), "html must use Slovenian copy");
    assert.ok(!html.includes("narudžba"), "Croatian copy must not appear");
  });
});

// ─── Stored-snapshot retry payload (pure simulation) ─────────────────────────

describe("stored-snapshot retry semantics", () => {
  /**
   * Simulates building an email payload from the STORED order row only.
   * In the real route, this always comes from canonical.snapshotXxx fields —
   * never from the current request or live item/tenant lookups.
   */
  function buildPayloadFromSnapshot(stored: {
    snapshotTenantEmail: string | null;
    snapshotTenantName: string | null;
    orderRef: string;
    snapshotTitle: string | null;
    snapshotPrice: string | null;
    snapshotPriceUnit: string | null;
    snapshotFulfillment: string | null;
    snapshotProducerName: string | null;
    qty: number;
    guestName: string;
    guestPhone: string;
    guestUnit: string;
    guestNote: string | null;
  }): OrderEmailPayload {
    return {
      to: stored.snapshotTenantEmail ?? "",
      tenantName: stored.snapshotTenantName ?? "",
      orderRef: stored.orderRef,
      itemTitle: stored.snapshotTitle,
      qty: stored.qty,
      price: stored.snapshotPrice,
      priceUnit: stored.snapshotPriceUnit,
      guestName: stored.guestName,
      guestPhone: stored.guestPhone,
      guestUnit: stored.guestUnit,
      guestNote: stored.guestNote,
    };
  }

  const storedOrder = {
    snapshotTenantEmail: "original-host@farm.si",
    snapshotTenantName: "Kmetija Original",
    orderRef: "orig-ref-uuid-1234",
    snapshotTitle: "Domač med",
    snapshotPrice: "8 €",
    snapshotPriceUnit: "kg",
    snapshotFulfillment: "Prevzem vsak petek.",
    snapshotProducerName: "Čebelar Kovač",
    qty: 2,
    guestName: "Janez Novak",
    guestPhone: "041 000 111",
    guestUnit: "0.5 kg",
    guestNote: null,
  };

  test("retry payload uses stored snapshotTenantEmail, not current tenant email", () => {
    const payload = buildPayloadFromSnapshot(storedOrder);
    assert.equal(payload.to, "original-host@farm.si");
  });

  test("retry payload uses stored snapshotTitle, not current item title", () => {
    const payload = buildPayloadFromSnapshot(storedOrder);
    assert.equal(payload.itemTitle, "Domač med");
  });

  test("retry payload uses stored orderRef", () => {
    const payload = buildPayloadFromSnapshot(storedOrder);
    assert.equal(payload.orderRef, "orig-ref-uuid-1234");
    // Ensure idempotency header is tied to orderRef
    const headers = buildEmailHeaders(payload.orderRef);
    assert.equal(headers["Idempotency-Key"], "orig-ref-uuid-1234");
  });

  test("retry payload uses stored guest fields", () => {
    const payload = buildPayloadFromSnapshot(storedOrder);
    assert.equal(payload.guestUnit, "0.5 kg");
    assert.equal(payload.qty, 2);
    assert.equal(payload.guestPhone, "041 000 111");
  });
});

// ─── Conditional failure/sent state expectations ──────────────────────────────

describe("conditional state update expectations (pure simulation)", () => {
  type NotifStatus = "pending" | "sending" | "sent" | "failed";

  interface Row {
    status: NotifStatus;
    token: string | null;
  }

  /**
   * Simulate the conditional failure update.
   * Contract: only 'sending' owned by THIS token → 'failed' (token cleared).
   * Never touches a row whose token differs (a newer claim) or a non-'sending' row.
   */
  function applyFailureUpdate(row: Row, myToken: string): boolean {
    if (row.status === "sending" && row.token === myToken) {
      row.status = "failed";
      row.token = null;
      return true;
    }
    return false;
  }

  /**
   * Simulate the conditional success update.
   * Contract: only 'sending' owned by THIS token → 'sent' (token cleared).
   * If it matched 0 rows, the route re-reads: 'sent' → success; else 425.
   */
  function applySuccessUpdate(
    row: Row,
    myToken: string,
  ): { matched: boolean; isSuccess: boolean } {
    if (row.status === "sending" && row.token === myToken) {
      row.status = "sent";
      row.token = null;
      return { matched: true, isSuccess: true };
    }
    // Lost ownership — re-read semantics: already 'sent' counts as success.
    return { matched: false, isSuccess: row.status === "sent" };
  }

  // Failure update
  test("failure update changes owned 'sending' → 'failed' and clears token", () => {
    const row: Row = { status: "sending", token: "tok" };
    assert.equal(applyFailureUpdate(row, "tok"), true);
    assert.equal(row.status, "failed");
    assert.equal(row.token, null);
  });

  test("failure update does NOT overwrite a row owned by a different token", () => {
    const row: Row = { status: "sending", token: "newer" };
    assert.equal(applyFailureUpdate(row, "stale"), false);
    assert.equal(row.status, "sending");
    assert.equal(row.token, "newer");
  });

  test("failure update does NOT overwrite 'sent'", () => {
    const row: Row = { status: "sent", token: null };
    assert.equal(applyFailureUpdate(row, "any"), false);
    assert.equal(row.status, "sent");
  });

  // Success update
  test("success update changes owned 'sending' → 'sent' and clears token", () => {
    const row: Row = { status: "sending", token: "tok" };
    const r = applySuccessUpdate(row, "tok");
    assert.equal(r.matched, true);
    assert.equal(r.isSuccess, true);
    assert.equal(row.status, "sent");
    assert.equal(row.token, null);
  });

  test("success update on already-sent row (token rotated) → still success", () => {
    const row: Row = { status: "sent", token: null };
    const r = applySuccessUpdate(row, "stale");
    assert.equal(r.matched, false);
    assert.equal(r.isSuccess, true);
  });

  test("success update when another claim now owns 'sending' → not success (425)", () => {
    const row: Row = { status: "sending", token: "newer" };
    const r = applySuccessUpdate(row, "stale");
    assert.equal(r.matched, false);
    assert.equal(r.isSuccess, false);
    assert.equal(row.status, "sending", "newer claim untouched");
  });

  test("success update on 'failed' row (unexpected) → not success", () => {
    const row: Row = { status: "failed", token: null };
    const r = applySuccessUpdate(row, "stale");
    assert.equal(r.isSuccess, false);
  });
});

// ─── stripMarkup ─────────────────────────────────────────────────────────────

describe("stripMarkup", () => {
  test("removes HTML tags", () => {
    assert.equal(stripMarkup("<p>hello</p>"), "hello");
    assert.equal(stripMarkup("<b>bold</b> text"), "bold text");
    assert.equal(stripMarkup("<a href='x'>link</a>"), "link");
  });

  test("decodes common HTML entities", () => {
    assert.equal(stripMarkup("&amp;"), "&");
    assert.equal(stripMarkup("&lt;&gt;"), "<>");
    assert.equal(stripMarkup("&quot;"), '"');
    // &nbsp; in context: surrounding text forces a space
    assert.equal(stripMarkup("a&nbsp;b"), "a b");
  });

  test("collapses multiple spaces", () => {
    assert.equal(stripMarkup("a  b   c"), "a b c");
  });

  test("trims leading/trailing whitespace", () => {
    assert.equal(stripMarkup("  hello  "), "hello");
  });

  test("passes plain text unchanged (modulo trim)", () => {
    assert.equal(stripMarkup("vsak dan 8–12h"), "vsak dan 8–12h");
  });
});

// ─── hasDeliveryKeyword ───────────────────────────────────────────────────────

describe("hasDeliveryKeyword", () => {
  // Slovenian
  test("detects 'prevzem'", () => assert.equal(hasDeliveryKeyword("Prevzem ob nakupu."), true));
  test("detects 'dostava'", () => assert.equal(hasDeliveryKeyword("Dostava vsak ponedeljek."), true));
  test("detects 'prinesemo'", () => assert.equal(hasDeliveryKeyword("Prinesemo do vaše sobe."), true));

  // English
  test("detects 'pickup'", () => assert.equal(hasDeliveryKeyword("Pickup available daily."), true));
  test("detects 'delivery'", () => assert.equal(hasDeliveryKeyword("Free delivery included."), true));
  test("detects 'pick up' (two words)", () => assert.equal(hasDeliveryKeyword("You can pick up from reception."), true));

  // Italian
  test("detects 'consegna'", () => assert.equal(hasDeliveryKeyword("Consegna gratuita."), true));
  test("detects 'ritiro'", () => assert.equal(hasDeliveryKeyword("Ritiro presso la reception."), true));

  // German
  test("detects 'Abholung'", () => assert.equal(hasDeliveryKeyword("Abholung täglich möglich."), true));
  test("detects 'Lieferung'", () => assert.equal(hasDeliveryKeyword("Lieferung frei Haus."), true));

  // Negative cases
  test("random price text has no keyword", () => assert.equal(hasDeliveryKeyword("5 € pro kg"), false));
  test("producer name has no keyword", () => assert.equal(hasDeliveryKeyword("Kmetija Novak"), false));
  test("item title has no keyword", () => assert.equal(hasDeliveryKeyword("Bio jabolka"), false));
  test("generic timing text is not a fulfillment promise", () => assert.equal(hasDeliveryKeyword("Naročite vsak dan do 10h."), false));
  test("generic order timing is not a fulfillment promise", () => assert.equal(hasDeliveryKeyword("Sveže ob naročilu."), false));
  test("empty string is false", () => assert.equal(hasDeliveryKeyword(""), false));
});

// ─── extractFulfillmentSentence ───────────────────────────────────────────────

describe("extractFulfillmentSentence", () => {
  test("returns DEFAULT_FULFILLMENT when all fields are null", () => {
    assert.equal(extractFulfillmentSentence(null, null, null), DEFAULT_FULFILLMENT);
  });

  test("returns DEFAULT_FULFILLMENT when no field contains a delivery keyword", () => {
    assert.equal(
      extractFulfillmentSentence("Domači med iz Logaške doline.", "Pridelano brez pesticidov.", ["100% naravno"]),
      DEFAULT_FULFILLMENT,
    );
  });

  test("DEFAULT_FULFILLMENT is the correct Slovenian fallback", () => {
    assert.equal(DEFAULT_FULFILLMENT, "Prevzem pri gostitelju.");
  });

  test("extracts a delivery sentence from body", () => {
    const result = extractFulfillmentSentence(
      "<p>Bio jabolka. Prevzem vsak dan od 8 do 12h.</p>",
      null,
      null,
    );
    assert.match(result, /Prevzem vsak dan od 8 do 12h/);
    assert.notEqual(result, DEFAULT_FULFILLMENT);
  });

  test("extracts a delivery sentence from noteText when body has none", () => {
    const result = extractFulfillmentSentence(
      "Okusna jabolka iz naše sadovnjaka.",
      "<p>Dostava vsak ponedeljek do 10h.</p>",
      null,
    );
    assert.match(result, /Dostava vsak ponedeljek do 10h/);
  });

  test("extracts from bullets when body and noteText have none", () => {
    const result = extractFulfillmentSentence(
      null,
      null,
      ["Bio certifikat", "Pickup at the farm gate daily", "Free range"],
    );
    assert.match(result, /Pickup at the farm gate daily/);
  });

  test("strips HTML markup before keyword search", () => {
    const result = extractFulfillmentSentence(
      "<p>Prevzem <strong>pri recepciji</strong> med 9 in 18h.</p>",
      null,
      null,
    );
    assert.match(result, /Prevzem pri recepciji med 9 in 18h/);
  });

  test("body takes priority over noteText", () => {
    const result = extractFulfillmentSentence(
      "Dostava vsak dan.",
      "Pickup at reception.",
      null,
    );
    assert.match(result, /Dostava vsak dan/);
  });

  test("producerNote is NOT examined — null inputs → default", () => {
    // The contract: producerNote is never passed to this function.
    // Producer text without delivery keywords → always returns default.
    const producerNoteContent = "Kmetija Novak, Idrija. Ekološko kmetijstvo.";
    assert.equal(
      extractFulfillmentSentence(producerNoteContent, null, null),
      DEFAULT_FULFILLMENT,
    );
  });

  test("adds trailing period if the sentence lacks one", () => {
    const result = extractFulfillmentSentence("Prevzem vsak dan od 8 do 12h", null, null);
    assert.ok(result.endsWith("."));
  });

  test("does not double period if sentence already ends with one", () => {
    const result = extractFulfillmentSentence("Prevzem vsak dan od 8 do 12h.", null, null);
    assert.ok(!result.endsWith(".."));
  });

  test("English delivery keyword detected in body", () => {
    const result = extractFulfillmentSentence("Fresh produce. Delivery to your room daily.", null, null);
    assert.match(result, /Delivery to your room daily/);
  });

  test("German delivery keyword detected in noteText", () => {
    const result = extractFulfillmentSentence(null, "Täglich frisch. Abholung um 9 Uhr möglich.", null);
    assert.match(result, /Abholung um 9 Uhr/);
  });

  test("Italian delivery keyword detected in bullet", () => {
    const result = extractFulfillmentSentence(null, null, ["Prodotto biologico", "Consegna gratuita in camera"]);
    assert.match(result, /Consegna gratuita in camera/);
  });
});
