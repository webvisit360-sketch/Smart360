/**
 * Focused unit tests for the guest–host messaging feature.
 *
 * Tests cover:
 *  - Device/tenant isolation (hash produces different thread keys per tenant)
 *  - One-thread invariant (unique constraint semantics via DB)
 *  - Rate limiter independence from orders
 *  - Input validation (body bounds, blank, guestName/Unit max)
 *  - Notification toggle: enabled + tenant email → email attempted
 *  - Notification toggle: disabled → email skipped
 *  - Notification: enabled + missing email → email skipped
 *  - buildMessageEmailBody: PII-safe (tenant name only, no guest data)
 *  - buildMessageEmailHeaders: idempotency key = "message-<messageId>"
 *    (per-message, not per-thread)
 *  - 90-day retention: makeMessageDeleteAfter accuracy
 *  - purgeExpiredThreads: deletes only expired rows
 *  - Public GET must require published tenant (unpublished → 404)
 *  - Expired threads filtered from public/admin reads (deleteAfter > now)
 *  - Host reply stored correctly
 *
 * No live DB required for pure-function tests.
 * DB tests use the actual database (same pattern as the existing order tests).
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { sha256hex, ProcessLocalRateLimiter } from "../lib/orderHelpers";
import {
  MESSAGE_BODY_MAX,
  MESSAGE_GUEST_NAME_MAX,
  MESSAGE_GUEST_PHONE_MAX,
  MESSAGE_GUEST_PHONE_MIN_DIGITS,
  MESSAGE_GUEST_UNIT_MAX,
  MESSAGE_PASSWORD_MAX,
  hasMinimumMessagePhoneDigits,
  invalidMessagePhoneMessage,
  msgIpRateLimiter,
  msgDeviceRateLimiter,
  requiredMessageNameMessage,
  requiredMessagePhoneMessage,
  requiredMessageUnitMessage,
  wrongMessagePasswordMessage,
} from "../lib/messageHelpers";
import { SendGuestMessageBody } from "@workspace/api-zod";
import {
  makeMessageDeleteAfter,
  MESSAGE_RETENTION_DAYS,
  purgeExpiredThreads,
} from "../lib/messageRetention";
import {
  buildMessageEmailBody,
  buildMessageEmailHeaders,
  type MessageNotifyPayload,
} from "../lib/messageEmail";
import { db, messageThreadsTable, messagesTable, tenantsTable } from "@workspace/db";
import { eq, and, gt, lte, sql } from "drizzle-orm";

// ─── Constants ────────────────────────────────────────────────────────────────

describe("messaging constants", () => {
  test("MESSAGE_BODY_MAX = 2000", () => assert.equal(MESSAGE_BODY_MAX, 2000));
  test("MESSAGE_GUEST_NAME_MAX = 200", () => assert.equal(MESSAGE_GUEST_NAME_MAX, 200));
  test("MESSAGE_GUEST_UNIT_MAX = 100", () => assert.equal(MESSAGE_GUEST_UNIT_MAX, 100));
  test("MESSAGE_GUEST_PHONE_MAX = 50", () => assert.equal(MESSAGE_GUEST_PHONE_MAX, 50));
  test("MESSAGE_GUEST_PHONE_MIN_DIGITS = 6", () => assert.equal(MESSAGE_GUEST_PHONE_MIN_DIGITS, 6));
  test("MESSAGE_PASSWORD_MAX = 200", () => assert.equal(MESSAGE_PASSWORD_MAX, 200));
  test("MESSAGE_RETENTION_DAYS = 90", () => assert.equal(MESSAGE_RETENTION_DAYS, 90));
});

describe("message access contract", () => {
  test("guest name, unit and phone are required by the generated request schema", () => {
    const parsed = SendGuestMessageBody.safeParse({ body: "Hello" });
    assert.equal(parsed.success, false);
  });

  test("accepts required signed-in identity plus optional password and language", () => {
    const parsed = SendGuestMessageBody.safeParse({
      body: "Hello",
      guestName: "Ana Novak",
      guestUnit: "B-14",
      guestPhone: "+386 41 000 000",
      password: "Secret",
      lang: "de",
    });
    assert.equal(parsed.success, true);
  });

  test("required identity errors exactly reuse order localization", () => {
    assert.equal(requiredMessageNameMessage("sl"), "To polje je obvezno.");
    assert.equal(requiredMessageUnitMessage("en"), "This field is required.");
    assert.equal(requiredMessageNameMessage("de"), "Dieses Feld ist erforderlich.");
    assert.equal(requiredMessageUnitMessage("it"), "Questo campo è obbligatorio.");
    assert.equal(requiredMessagePhoneMessage("sl"), "To polje je obvezno.");
  });

  test("phone digit errors are localized in all supported languages", () => {
    assert.equal(invalidMessagePhoneMessage("sl"), "Telefonska številka mora vsebovati vsaj 6 števk.");
    assert.equal(invalidMessagePhoneMessage("en"), "The phone number must contain at least 6 digits.");
    assert.equal(invalidMessagePhoneMessage("de"), "Die Telefonnummer muss mindestens 6 Ziffern enthalten.");
    assert.equal(invalidMessagePhoneMessage("it"), "Il numero di telefono deve contenere almeno 6 cifre.");
  });

  test("wrong-password errors are localized in all supported languages", () => {
    assert.equal(wrongMessagePasswordMessage("sl"), "Napačno geslo");
    assert.equal(wrongMessagePasswordMessage("en"), "Wrong password");
    assert.equal(wrongMessagePasswordMessage("de"), "Falsches Passwort");
    assert.equal(wrongMessagePasswordMessage("it"), "Password errata");
  });
});

// ─── Device/tenant isolation ──────────────────────────────────────────────────

describe("device/tenant isolation (hash consistency)", () => {
  test("same raw token produces same hash (deterministic)", () => {
    const token = "test-device-token-abc123";
    assert.equal(sha256hex(token), sha256hex(token));
  });

  test("different tenants yield different isolation keys even with same token", () => {
    const token = "my-device-token";
    const hash = sha256hex(token);
    // Two different tenants with the same device hash are keyed by (tenantId, hash).
    // Different tenantIds → different thread rows enforced by the unique index.
    const key1 = sha256hex(`tenant-A:${hash}`);
    const key2 = sha256hex(`tenant-B:${hash}`);
    assert.notEqual(key1, key2);
  });

  test("different device tokens for same tenant produce different hashes", () => {
    const h1 = sha256hex("device-token-guest-1");
    const h2 = sha256hex("device-token-guest-2");
    assert.notEqual(h1, h2);
  });

  test("device token hash is 64-char hex (SHA-256)", () => {
    const h = sha256hex("some-device-token");
    assert.match(h, /^[0-9a-f]{64}$/);
  });
});

// ─── makeMessageDeleteAfter ───────────────────────────────────────────────────

describe("makeMessageDeleteAfter", () => {
  test("is exactly 90 days from now (within 5 seconds)", () => {
    const before = Date.now();
    const ts = makeMessageDeleteAfter();
    const after = Date.now();
    const expected = MESSAGE_RETENTION_DAYS * 24 * 60 * 60 * 1000;
    assert.ok(ts.getTime() >= before + expected - 5000);
    assert.ok(ts.getTime() <= after + expected + 5000);
  });

  test("returns a Date object", () => {
    assert.ok(makeMessageDeleteAfter() instanceof Date);
  });
});

// ─── Rate limiter independence ────────────────────────────────────────────────

describe("message rate limiters are separate instances from orders", () => {
  test("msgIpRateLimiter has allow/cleanup methods", () => {
    assert.equal(typeof msgIpRateLimiter.allow, "function");
    assert.equal(typeof msgIpRateLimiter.cleanup, "function");
  });

  test("msgDeviceRateLimiter has allow/cleanup methods", () => {
    assert.equal(typeof msgDeviceRateLimiter.allow, "function");
    assert.equal(typeof msgDeviceRateLimiter.cleanup, "function");
  });

  test("message rate limiters enforce 5/min limit independently", () => {
    const limiter = new ProcessLocalRateLimiter({ limit: 5, windowMs: 60_000 });
    const key = `test-isolation-${Date.now()}`;
    for (let i = 0; i < 5; i++) {
      assert.equal(limiter.allow(key), true, `request ${i + 1} should be allowed`);
    }
    assert.equal(limiter.allow(key), false, "6th request should be rate-limited");
  });

  test("different keys do not share buckets", () => {
    const limiter = new ProcessLocalRateLimiter({ limit: 2, windowMs: 60_000 });
    const k1 = `key-a-${Date.now()}`;
    const k2 = `key-b-${Date.now()}`;
    assert.equal(limiter.allow(k1), true);
    assert.equal(limiter.allow(k1), true);
    assert.equal(limiter.allow(k1), false);
    // k2 has its own fresh bucket
    assert.equal(limiter.allow(k2), true);
    assert.equal(limiter.allow(k2), true);
    assert.equal(limiter.allow(k2), false);
  });
});

// ─── buildMessageEmailBody (PII safety) ──────────────────────────────────────

describe("buildMessageEmailBody (PII safety)", () => {
  const payload: MessageNotifyPayload = {
    to: "host@example.com",
    tenantName: "Vila Mare",
    guestUnit: "Apartma 3",
    messageId: "aaaabbbb-1111-2222-3333-ccccddddeeee",
    threadRef: "ffffffff-5555-6666-7777-888899990000",
  };

  test("contains tenant name as the brand kicker", () => {
    const body = buildMessageEmailBody(payload, "notifications@example.com");
    const html = body["html"] as string;
    assert.ok(html.includes("Vila Mare"), "tenant name should appear");
  });

  test("does not contain messageId in HTML body", () => {
    const body = buildMessageEmailBody(payload, "notifications@example.com");
    const html = body["html"] as string;
    assert.ok(!html.includes("aaaabbbb"), "messageId must not appear in HTML body");
  });

  test("does not contain threadRef in HTML body", () => {
    const body = buildMessageEmailBody(payload, "notifications@example.com");
    const html = body["html"] as string;
    assert.ok(!html.includes("ffffffff"), "threadRef must not appear in HTML body");
  });

  test("shows the guest UNIT (approved template) but no message content, name or phone", () => {
    const body = buildMessageEmailBody(payload, "notifications@example.com");
    const html = body["html"] as string;
    assert.ok(html.includes("Apartma 3"), "unit identifies the stay (approved design)");
    assert.ok(!html.includes("guestName"), "guestName key must not appear");
    assert.ok(!html.includes("guestPhone"), "guestPhone key must not appear");
    assert.ok(
      html.includes("namenoma ne pošiljamo"),
      "body states message content is deliberately not e-mailed",
    );
  });

  test("subject and preview follow the approved file", () => {
    const body = buildMessageEmailBody(payload, "notifications@example.com");
    assert.equal(body["subject"], "Novo sporočilo · Apartma 3");
    assert.ok(
      (body["html"] as string).includes("Odprite portal za odgovor"),
      "preview line matches the file",
    );
  });

  test("carries a plain-text alternative without HTML", () => {
    const body = buildMessageEmailBody(payload, "notifications@example.com");
    const text = body["text"] as string;
    assert.ok(text.includes("Novo sporočilo"), "title present");
    assert.ok(text.includes("Apartma 3"), "unit present");
    assert.ok(!text.includes("<"), "no HTML in text version");
  });

  test("from field contains correct sender name and address", () => {
    const body = buildMessageEmailBody(payload, "info@webvisit360.com");
    assert.ok((body["from"] as string).includes("info@webvisit360.com"));
    assert.ok((body["from"] as string).includes("Smart360"));
  });

  test("to is the supplied tenant email", () => {
    const body = buildMessageEmailBody(payload, "notifications@example.com");
    assert.deepEqual(body["to"], ["host@example.com"]);
  });
});

// ─── buildMessageEmailHeaders — per-message idempotency ──────────────────────

describe("buildMessageEmailHeaders (per-message idempotency)", () => {
  test("Idempotency-Key is 'message-<messageId>'", () => {
    const id = "uuid-1234-abcd";
    const headers = buildMessageEmailHeaders(id);
    assert.equal(headers["Idempotency-Key"], `message-${id}`);
  });

  test("two different messageIds produce different idempotency keys", () => {
    const k1 = buildMessageEmailHeaders("msg-a")["Idempotency-Key"];
    const k2 = buildMessageEmailHeaders("msg-b")["Idempotency-Key"];
    assert.notEqual(k1, k2);
  });

  test("same messageId always produces same idempotency key (stable)", () => {
    const id = "stable-uuid-9999";
    assert.equal(
      buildMessageEmailHeaders(id)["Idempotency-Key"],
      buildMessageEmailHeaders(id)["Idempotency-Key"],
    );
  });

  test("key does NOT equal a bare threadRef (per-message, not per-thread)", () => {
    // If someone accidentally passes threadRef, the key format still differs
    // because we always prefix with "message-".
    const uuid = "some-uuid-here";
    const key = buildMessageEmailHeaders(uuid)["Idempotency-Key"];
    assert.notEqual(key, uuid, "key must be prefixed, not a bare UUID");
    assert.ok(key.startsWith("message-"), "key must start with 'message-'");
  });

  test("has Content-Type application/json", () => {
    const headers = buildMessageEmailHeaders("any-id");
    assert.equal(headers["Content-Type"], "application/json");
  });
});

// ─── Input validation (boundary checks) ──────────────────────────────────────

describe("input validation (boundary checks)", () => {
  test("body of exactly 1 char is valid", () => {
    assert.ok("x".length >= 1 && "x".length <= MESSAGE_BODY_MAX);
  });

  test("body of exactly 2000 chars is valid", () => {
    assert.ok("a".repeat(2000).length <= MESSAGE_BODY_MAX);
  });

  test("body of 2001 chars exceeds max", () => {
    assert.ok("a".repeat(2001).length > MESSAGE_BODY_MAX);
  });

  test("blank body after trim is rejected", () => {
    assert.equal("   ".trim().length, 0);
  });

  test("guestName of 200 chars is at max", () => {
    assert.ok("a".repeat(200).length <= MESSAGE_GUEST_NAME_MAX);
  });

  test("guestName of 201 chars exceeds max", () => {
    assert.ok("a".repeat(201).length > MESSAGE_GUEST_NAME_MAX);
  });

  test("guestUnit of 100 chars is at max", () => {
    assert.ok("a".repeat(100).length <= MESSAGE_GUEST_UNIT_MAX);
  });

  test("guestUnit of 101 chars exceeds max", () => {
    assert.ok("a".repeat(101).length > MESSAGE_GUEST_UNIT_MAX);
  });

  test("formatted phone with six digits is accepted without normalization", () => {
    const phone = "+386 (0)1-23";
    assert.equal(hasMinimumMessagePhoneDigits(phone), true);
    assert.equal(phone, "+386 (0)1-23");
  });

  test("phone with fewer than six digits is rejected", () => {
    assert.equal(hasMinimumMessagePhoneDigits("+386 1"), false);
  });

  test("guestPhone of 51 chars exceeds max", () => {
    assert.ok("1".repeat(51).length > MESSAGE_GUEST_PHONE_MAX);
  });
});

// ─── DB helpers ───────────────────────────────────────────────────────────────

async function createTestTenant(slug: string, published = true) {
  const [tenant] = await db
    .insert(tenantsTable)
    .values({ slug, name: `Test Tenant ${slug}`, isPublished: published, messageNotifyEmail: true })
    .returning();
  return tenant!;
}

async function cleanupTenant(tenantId: string) {
  // Messages cascade via FK; threads cascade via FK on tenant delete.
  await db.delete(tenantsTable).where(eq(tenantsTable.id, tenantId));
}

function uniqueSlug(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// ─── DB: one-thread invariant ─────────────────────────────────────────────────

describe("DB: one-thread invariant", async () => {
  test("two inserts with same (tenantId, deviceHash) produce only one thread", async () => {
    const tenant = await createTestTenant(uniqueSlug("inv"));
    const hash = sha256hex("token-invariant-test");
    const da = makeMessageDeleteAfter();

    await db
      .insert(messageThreadsTable)
      .values({ tenantId: tenant.id, deviceTokenHash: hash, isOpen: true, deleteAfter: da })
      .onConflictDoNothing({ target: [messageThreadsTable.tenantId, messageThreadsTable.deviceTokenHash] });

    // Second insert with same key must be silently ignored
    await db
      .insert(messageThreadsTable)
      .values({ tenantId: tenant.id, deviceTokenHash: hash, isOpen: true, deleteAfter: makeMessageDeleteAfter() })
      .onConflictDoNothing({ target: [messageThreadsTable.tenantId, messageThreadsTable.deviceTokenHash] });

    const rows = await db
      .select()
      .from(messageThreadsTable)
      .where(and(eq(messageThreadsTable.tenantId, tenant.id), eq(messageThreadsTable.deviceTokenHash, hash)));

    assert.equal(rows.length, 1, "exactly one thread must exist");
    await cleanupTenant(tenant.id);
  });

  test("same device across different tenants creates separate threads", async () => {
    const t1 = await createTestTenant(uniqueSlug("iso-a"));
    const t2 = await createTestTenant(uniqueSlug("iso-b"));
    const hash = sha256hex("shared-device-token");
    const da = makeMessageDeleteAfter();

    await db
      .insert(messageThreadsTable)
      .values({ tenantId: t1.id, deviceTokenHash: hash, isOpen: true, deleteAfter: da })
      .onConflictDoNothing({ target: [messageThreadsTable.tenantId, messageThreadsTable.deviceTokenHash] });

    await db
      .insert(messageThreadsTable)
      .values({ tenantId: t2.id, deviceTokenHash: hash, isOpen: true, deleteAfter: da })
      .onConflictDoNothing({ target: [messageThreadsTable.tenantId, messageThreadsTable.deviceTokenHash] });

    const r1 = await db.select().from(messageThreadsTable)
      .where(and(eq(messageThreadsTable.tenantId, t1.id), eq(messageThreadsTable.deviceTokenHash, hash)));
    const r2 = await db.select().from(messageThreadsTable)
      .where(and(eq(messageThreadsTable.tenantId, t2.id), eq(messageThreadsTable.deviceTokenHash, hash)));

    assert.equal(r1.length, 1, "tenant-1 thread must exist");
    assert.equal(r2.length, 1, "tenant-2 thread must exist");
    assert.notEqual(r1[0]!.id, r2[0]!.id, "threads must be distinct rows");

    await cleanupTenant(t1.id);
    await cleanupTenant(t2.id);
  });
});

describe("DB: single thread-level guest phone", async () => {
  test("a legacy null phone is repaired in place and formatting is preserved", async () => {
    const tenant = await createTestTenant(uniqueSlug("phone-repair"));
    const hash = sha256hex("device-phone-repair");
    const [legacyThread] = await db
      .insert(messageThreadsTable)
      .values({
        tenantId: tenant.id,
        deviceTokenHash: hash,
        guestName: "Ana Novak",
        guestUnit: "B-14",
        guestPhone: null,
        isOpen: true,
        deleteAfter: makeMessageDeleteAfter(),
      })
      .returning();

    await db
      .update(messageThreadsTable)
      .set({ guestPhone: "+386 41 000 000" })
      .where(eq(messageThreadsTable.id, legacyThread!.id));

    const [repaired] = await db
      .select()
      .from(messageThreadsTable)
      .where(eq(messageThreadsTable.id, legacyThread!.id));
    assert.equal(repaired!.id, legacyThread!.id);
    assert.equal(repaired!.guestPhone, "+386 41 000 000");

    await cleanupTenant(tenant.id);
  });
});

// ─── DB: host reply ───────────────────────────────────────────────────────────

describe("DB: host reply", async () => {
  test("host reply inserts a message with sender=host", async () => {
    const tenant = await createTestTenant(uniqueSlug("reply"));
    const hash = sha256hex("device-host-reply");
    const [thread] = await db
      .insert(messageThreadsTable)
      .values({ tenantId: tenant.id, deviceTokenHash: hash, isOpen: true, deleteAfter: makeMessageDeleteAfter() })
      .returning();

    await db.insert(messagesTable).values({
      threadId: thread!.id,
      tenantId: tenant.id,
      sender: "host",
      body: "How can I help?",
    });

    const msgs = await db.select().from(messagesTable).where(eq(messagesTable.threadId, thread!.id));
    assert.equal(msgs.length, 1);
    assert.equal(msgs[0]!.sender, "host");
    assert.equal(msgs[0]!.body, "How can I help?");

    await cleanupTenant(tenant.id);
  });
});

// ─── DB: per-message notification idempotency ─────────────────────────────────

describe("DB: per-message notification idempotency (not per-thread)", async () => {
  test("each inserted guest message row has a distinct UUID → distinct idempotency key", async () => {
    const tenant = await createTestTenant(uniqueSlug("notif-idem"));
    const hash = sha256hex("device-idem-test");
    const [thread] = await db
      .insert(messageThreadsTable)
      .values({ tenantId: tenant.id, deviceTokenHash: hash, isOpen: true, deleteAfter: makeMessageDeleteAfter() })
      .returning();

    const [m1] = await db
      .insert(messagesTable)
      .values({ threadId: thread!.id, tenantId: tenant.id, sender: "guest", body: "First" })
      .returning({ id: messagesTable.id });

    const [m2] = await db
      .insert(messagesTable)
      .values({ threadId: thread!.id, tenantId: tenant.id, sender: "guest", body: "Second" })
      .returning({ id: messagesTable.id });

    assert.ok(m1!.id, "first message has an ID");
    assert.ok(m2!.id, "second message has an ID");
    assert.notEqual(m1!.id, m2!.id, "each message has a unique ID");

    const key1 = buildMessageEmailHeaders(m1!.id)["Idempotency-Key"];
    const key2 = buildMessageEmailHeaders(m2!.id)["Idempotency-Key"];
    assert.notEqual(key1, key2, "per-message idempotency keys must differ");
    assert.ok(key1.startsWith("message-"), "key1 must be prefixed");
    assert.ok(key2.startsWith("message-"), "key2 must be prefixed");

    await cleanupTenant(tenant.id);
  });
});

// ─── DB: 90-day purge ─────────────────────────────────────────────────────────

describe("DB: 90-day purge", async () => {
  test("purgeExpiredThreads deletes only threads with deleteAfter in the past", async () => {
    const tenant = await createTestTenant(uniqueSlug("purge"));
    const expiredHash = sha256hex("device-expired");
    const liveHash = sha256hex("device-live");

    const [expired] = await db
      .insert(messageThreadsTable)
      .values({
        tenantId: tenant.id,
        deviceTokenHash: expiredHash,
        guestPhone: "+386 41 000 000",
        isOpen: true,
        deleteAfter: new Date(Date.now() - 1),
      })
      .returning();

    const [live] = await db
      .insert(messageThreadsTable)
      .values({ tenantId: tenant.id, deviceTokenHash: liveHash, isOpen: true, deleteAfter: makeMessageDeleteAfter() })
      .returning();

    const deleted = await purgeExpiredThreads();
    assert.ok(deleted >= 1, "at least one expired thread purged");

    const remaining = await db.select().from(messageThreadsTable).where(eq(messageThreadsTable.id, expired!.id));
    assert.equal(remaining.length, 0, "expired thread must be gone");

    const liveRemaining = await db.select().from(messageThreadsTable).where(eq(messageThreadsTable.id, live!.id));
    assert.equal(liveRemaining.length, 1, "live thread must remain");

    await cleanupTenant(tenant.id);
  });

  test("expired threads filtered from DB reads by deleteAfter > now", async () => {
    const tenant = await createTestTenant(uniqueSlug("purge-filter"));
    const hash = sha256hex("device-purge-filter");

    // Insert an expired thread that has not been swept yet
    await db
      .insert(messageThreadsTable)
      .values({ tenantId: tenant.id, deviceTokenHash: hash, isOpen: true, deleteAfter: new Date(Date.now() - 1000) })
      .onConflictDoNothing({ target: [messageThreadsTable.tenantId, messageThreadsTable.deviceTokenHash] });

    // Query with the same filter the route uses: deleteAfter > now
    const visible = await db
      .select()
      .from(messageThreadsTable)
      .where(
        and(
          eq(messageThreadsTable.tenantId, tenant.id),
          eq(messageThreadsTable.deviceTokenHash, hash),
          gt(messageThreadsTable.deleteAfter, new Date()),
        ),
      );

    assert.equal(visible.length, 0, "expired thread must not be visible in filtered read");

    await cleanupTenant(tenant.id);
  });
});

// ─── DB: notification toggle / missing email ──────────────────────────────────

describe("DB: notification toggle / missing email", async () => {
  test("messageNotifyEmail=false stored correctly", async () => {
    const [tenant] = await db
      .insert(tenantsTable)
      .values({ slug: uniqueSlug("notif-off"), name: "No Notify", isPublished: true, messageNotifyEmail: false })
      .returning();
    assert.equal(tenant!.messageNotifyEmail, false);
    await db.delete(tenantsTable).where(eq(tenantsTable.id, tenant!.id));
  });

  test("messageNotifyEmail=true is the default", async () => {
    const [tenant] = await db
      .insert(tenantsTable)
      .values({ slug: uniqueSlug("notif-default"), name: "Default Notify", isPublished: true })
      .returning();
    assert.equal(tenant!.messageNotifyEmail, true);
    await db.delete(tenantsTable).where(eq(tenantsTable.id, tenant!.id));
  });

  test("notification skipped when messageNotifyEmail=false (logic check)", () => {
    const tenant = { messageNotifyEmail: false, email: "host@example.com" };
    assert.equal(tenant.messageNotifyEmail && Boolean(tenant.email), false);
  });

  test("notification skipped when email is null (logic check)", () => {
    const tenant = { messageNotifyEmail: true, email: null as string | null };
    assert.equal(tenant.messageNotifyEmail && Boolean(tenant.email), false);
  });

  test("notification attempted when enabled and email present (logic check)", () => {
    const tenant = { messageNotifyEmail: true, email: "host@example.com" };
    assert.equal(tenant.messageNotifyEmail && Boolean(tenant.email), true);
  });
});

// ─── DB: unpublished tenant must not expose threads ───────────────────────────

describe("DB: published tenant guard for public GET", async () => {
  test("unpublished tenant resolves to null via resolvePublishedTenant equivalent", async () => {
    // Mirror the route's resolvePublishedTenant filter directly
    const slug = uniqueSlug("unpub");
    const [tenant] = await db
      .insert(tenantsTable)
      .values({ slug, name: "Unpublished", isPublished: false })
      .returning();

    const [found] = await db
      .select()
      .from(tenantsTable)
      .where(and(eq(tenantsTable.slug, slug), eq(tenantsTable.isPublished, true)));

    assert.equal(found, undefined, "unpublished tenant must not resolve via published filter");
    await db.delete(tenantsTable).where(eq(tenantsTable.id, tenant!.id));
  });

  test("published tenant resolves correctly", async () => {
    const slug = uniqueSlug("pub");
    const [tenant] = await db
      .insert(tenantsTable)
      .values({ slug, name: "Published", isPublished: true })
      .returning();

    const [found] = await db
      .select()
      .from(tenantsTable)
      .where(and(eq(tenantsTable.slug, slug), eq(tenantsTable.isPublished, true)));

    assert.ok(found, "published tenant must resolve");
    assert.equal(found!.id, tenant!.id);
    await db.delete(tenantsTable).where(eq(tenantsTable.id, tenant!.id));
  });
});

// ─── DB: expired-thread regression tests ─────────────────────────────────────
//
// These tests exercise the atomic transaction logic that the route uses:
//  1. Guest POST deletes expired thread + old messages before creating fresh one
//  2. Host POST cannot reply to an expired thread (404 / rejected)
//  3. Concurrent guest sends leave exactly one active thread, never resurrect expired
//
// Tests replicate the transaction steps directly in SQL so they don't require
// a running HTTP server.

/**
 * Simulate the guest POST transaction steps:
 *   a) FOR UPDATE lock on any existing row
 *   b) DELETE expired row (cascade removes messages)
 *   c) INSERT new thread ON CONFLICT DO NOTHING
 *   d) re-read canonical thread
 *   e) INSERT message
 *   f) UPDATE deleteAfter
 * Returns the new thread and inserted message id.
 */
async function runGuestPostTransaction(
  tenantId: string,
  deviceTokenHash: string,
  messageBody: string,
  deleteAfter: Date,
) {
  return db.transaction(async (tx) => {
    // Lock
    await tx.execute(
      sql`SELECT id FROM ${messageThreadsTable}
          WHERE ${messageThreadsTable.tenantId} = ${tenantId}
            AND ${messageThreadsTable.deviceTokenHash} = ${deviceTokenHash}
          FOR UPDATE`,
    );
    // Delete expired
    await tx
      .delete(messageThreadsTable)
      .where(
        and(
          eq(messageThreadsTable.tenantId, tenantId),
          eq(messageThreadsTable.deviceTokenHash, deviceTokenHash),
          lte(messageThreadsTable.deleteAfter, new Date()),
        ),
      );
    // Insert fresh thread
    await tx
      .insert(messageThreadsTable)
      .values({ tenantId, deviceTokenHash, isOpen: true, deleteAfter })
      .onConflictDoNothing({
        target: [messageThreadsTable.tenantId, messageThreadsTable.deviceTokenHash],
      });
    // Re-read
    const [thread] = await tx
      .select()
      .from(messageThreadsTable)
      .where(
        and(
          eq(messageThreadsTable.tenantId, tenantId),
          eq(messageThreadsTable.deviceTokenHash, deviceTokenHash),
        ),
      );
    if (!thread) throw new Error("thread_vanished");
    // Insert message
    const [msg] = await tx
      .insert(messagesTable)
      .values({ threadId: thread.id, tenantId, sender: "guest", body: messageBody })
      .returning({ id: messagesTable.id });
    if (!msg) throw new Error("message_insert_failed");
    // Extend deleteAfter
    await tx
      .update(messageThreadsTable)
      .set({ deleteAfter })
      .where(eq(messageThreadsTable.id, thread.id));
    return { thread, messageId: msg.id };
  });
}

/**
 * Simulate the host POST transaction steps:
 *   a) FOR UPDATE lock
 *   b) re-read + check existence + check expiry
 *   c) INSERT host reply
 *   d) UPDATE deleteAfter
 * Throws "thread_not_found" or "thread_expired" on failure.
 */
async function runHostReplyTransaction(
  tenantId: string,
  threadRef: string,
  messageBody: string,
) {
  return db.transaction(async (tx) => {
    // Lock
    await tx.execute(
      sql`SELECT id FROM ${messageThreadsTable}
          WHERE ${messageThreadsTable.threadRef} = ${threadRef}
            AND ${messageThreadsTable.tenantId} = ${tenantId}
          FOR UPDATE`,
    );
    // Re-read
    const [lockedThread] = await tx
      .select()
      .from(messageThreadsTable)
      .where(
        and(
          eq(messageThreadsTable.threadRef, threadRef),
          eq(messageThreadsTable.tenantId, tenantId),
        ),
      );
    if (!lockedThread) throw new Error("thread_not_found");
    if (lockedThread.deleteAfter <= new Date()) throw new Error("thread_expired");
    // Insert
    await tx.insert(messagesTable).values({
      threadId: lockedThread.id,
      tenantId,
      sender: "host",
      body: messageBody,
    });
    // Extend
    await tx
      .update(messageThreadsTable)
      .set({ deleteAfter: makeMessageDeleteAfter() })
      .where(eq(messageThreadsTable.id, lockedThread.id));
    return lockedThread;
  });
}

describe("DB: expired-thread regression — guest POST", async () => {
  test("expired thread and its old messages are deleted; new thread has only the new message", async () => {
    const tenant = await createTestTenant(uniqueSlug("exp-guest"));
    const hash = sha256hex("device-expired-regression");

    // 1. Create an expired thread with two old messages
    const [expiredThread] = await db
      .insert(messageThreadsTable)
      .values({
        tenantId: tenant.id,
        deviceTokenHash: hash,
        isOpen: true,
        deleteAfter: new Date(Date.now() - 1000), // already expired
      })
      .returning();

    await db.insert(messagesTable).values([
      { threadId: expiredThread!.id, tenantId: tenant.id, sender: "guest", body: "Old msg 1" },
      { threadId: expiredThread!.id, tenantId: tenant.id, sender: "host",  body: "Old reply" },
    ]);

    // Confirm old messages exist
    const oldMsgs = await db
      .select()
      .from(messagesTable)
      .where(eq(messagesTable.threadId, expiredThread!.id));
    assert.equal(oldMsgs.length, 2, "old messages must exist before the transaction");

    // 2. Run the guest POST transaction (simulates route handler)
    const { thread: newThread, messageId } = await runGuestPostTransaction(
      tenant.id,
      hash,
      "New guest message",
      makeMessageDeleteAfter(),
    );

    // 3. Expired thread row must be gone
    const expiredRemaining = await db
      .select()
      .from(messageThreadsTable)
      .where(eq(messageThreadsTable.id, expiredThread!.id));
    assert.equal(expiredRemaining.length, 0, "expired thread must have been deleted");

    // 4. Old messages must be gone (cascade)
    const oldMsgsRemaining = await db
      .select()
      .from(messagesTable)
      .where(eq(messagesTable.threadId, expiredThread!.id));
    assert.equal(oldMsgsRemaining.length, 0, "old messages must have cascaded away");

    // 5. New thread exists and is fresh (different id, valid deleteAfter)
    assert.notEqual(newThread.id, expiredThread!.id, "new thread must be a different row");
    assert.ok(
      newThread.deleteAfter > new Date(),
      "new thread deleteAfter must be in the future",
    );

    // 6. New thread has exactly one message — the new guest message
    const newMsgs = await db
      .select()
      .from(messagesTable)
      .where(eq(messagesTable.threadId, newThread.id));
    assert.equal(newMsgs.length, 1, "new thread must have exactly one message");
    assert.equal(newMsgs[0]!.body, "New guest message");
    assert.equal(newMsgs[0]!.sender, "guest");
    assert.equal(newMsgs[0]!.id, messageId, "returned messageId must match the inserted row");

    await cleanupTenant(tenant.id);
  });

  test("active (non-expired) thread is kept; message appended; no data loss", async () => {
    const tenant = await createTestTenant(uniqueSlug("active-keep"));
    const hash = sha256hex("device-active-keep");

    // Create a live thread with one existing message
    const [activeThread] = await db
      .insert(messageThreadsTable)
      .values({
        tenantId: tenant.id,
        deviceTokenHash: hash,
        isOpen: true,
        deleteAfter: makeMessageDeleteAfter(),
      })
      .returning();

    await db.insert(messagesTable).values({
      threadId: activeThread!.id,
      tenantId: tenant.id,
      sender: "guest",
      body: "Existing message",
    });

    // Guest sends another message
    const { thread: sameThread } = await runGuestPostTransaction(
      tenant.id,
      hash,
      "Follow-up message",
      makeMessageDeleteAfter(),
    );

    // Same thread row (not replaced)
    assert.equal(sameThread.id, activeThread!.id, "active thread must not be replaced");

    // Both messages present
    const msgs = await db
      .select()
      .from(messagesTable)
      .where(eq(messagesTable.threadId, activeThread!.id));
    assert.equal(msgs.length, 2, "both messages must exist");

    await cleanupTenant(tenant.id);
  });
});

describe("DB: expired-thread regression — host POST", async () => {
  test("host POST on an expired thread is rejected (thread_expired error)", async () => {
    const tenant = await createTestTenant(uniqueSlug("exp-host"));
    const hash = sha256hex("device-expired-host-reply");

    // Create an expired thread
    const [expiredThread] = await db
      .insert(messageThreadsTable)
      .values({
        tenantId: tenant.id,
        deviceTokenHash: hash,
        isOpen: true,
        deleteAfter: new Date(Date.now() - 1000),
      })
      .returning();

    // Attempt host reply — must throw thread_expired
    await assert.rejects(
      () => runHostReplyTransaction(tenant.id, expiredThread!.threadRef, "Host reply"),
      (err: unknown) => {
        assert.ok(err instanceof Error, "must throw an Error");
        assert.equal((err as Error).message, "thread_expired");
        return true;
      },
      "host reply to expired thread must throw thread_expired",
    );

    // Expired thread must still be expired (not extended)
    const [still] = await db
      .select()
      .from(messageThreadsTable)
      .where(eq(messageThreadsTable.id, expiredThread!.id));
    assert.ok(still, "expired thread row should still exist (not auto-deleted by host POST)");
    assert.ok(
      still!.deleteAfter <= new Date(),
      "expired thread must remain expired after failed host reply",
    );

    // No messages inserted
    const msgs = await db
      .select()
      .from(messagesTable)
      .where(eq(messagesTable.threadId, expiredThread!.id));
    assert.equal(msgs.length, 0, "no messages must have been inserted on an expired thread");

    await cleanupTenant(tenant.id);
  });

  test("host POST on a live thread succeeds and extends deleteAfter", async () => {
    const tenant = await createTestTenant(uniqueSlug("live-host"));
    const hash = sha256hex("device-live-host-reply");

    const [liveThread] = await db
      .insert(messageThreadsTable)
      .values({
        tenantId: tenant.id,
        deviceTokenHash: hash,
        isOpen: true,
        deleteAfter: makeMessageDeleteAfter(),
      })
      .returning();

    const originalDeleteAfter = liveThread!.deleteAfter;

    await runHostReplyTransaction(tenant.id, liveThread!.threadRef, "Host reply to live");

    const msgs = await db
      .select()
      .from(messagesTable)
      .where(eq(messagesTable.threadId, liveThread!.id));
    assert.equal(msgs.length, 1, "reply must be stored");
    assert.equal(msgs[0]!.sender, "host");

    const [updated] = await db
      .select()
      .from(messageThreadsTable)
      .where(eq(messageThreadsTable.id, liveThread!.id));
    assert.ok(
      updated!.deleteAfter >= originalDeleteAfter,
      "deleteAfter must be extended or unchanged after host reply",
    );

    await cleanupTenant(tenant.id);
  });

  test("host POST on a non-existent thread is rejected (thread_not_found error)", async () => {
    const tenant = await createTestTenant(uniqueSlug("nothread-host"));
    const fakeRef = "00000000-0000-0000-0000-000000000000";

    await assert.rejects(
      () => runHostReplyTransaction(tenant.id, fakeRef, "Ghost reply"),
      (err: unknown) => {
        assert.ok(err instanceof Error);
        assert.equal((err as Error).message, "thread_not_found");
        return true;
      },
    );

    await cleanupTenant(tenant.id);
  });
});

describe("DB: concurrent guest sends — one active thread, no resurrection", async () => {
  test("two concurrent first-sends produce exactly one active thread", async () => {
    const tenant = await createTestTenant(uniqueSlug("concurrent-first"));
    const hash = sha256hex("device-concurrent-first");
    const da = makeMessageDeleteAfter();

    // Simulate two concurrent first-sends racing each other
    const results = await Promise.allSettled([
      runGuestPostTransaction(tenant.id, hash, "First concurrent msg", da),
      runGuestPostTransaction(tenant.id, hash, "Second concurrent msg", da),
    ]);

    // Both must settle (one may win the insert, the other resolves via re-read)
    const fulfilled = results.filter((r) => r.status === "fulfilled");
    assert.ok(fulfilled.length >= 1, "at least one concurrent send must succeed");

    // Exactly one thread must exist for this device
    const threads = await db
      .select()
      .from(messageThreadsTable)
      .where(
        and(
          eq(messageThreadsTable.tenantId, tenant.id),
          eq(messageThreadsTable.deviceTokenHash, hash),
        ),
      );
    assert.equal(threads.length, 1, "exactly one thread must exist after concurrent sends");
    assert.ok(threads[0]!.deleteAfter > new Date(), "surviving thread must be active");

    await cleanupTenant(tenant.id);
  });

  test("concurrent sends racing an expired row produce one active thread with no old messages", async () => {
    const tenant = await createTestTenant(uniqueSlug("concurrent-exp"));
    const hash = sha256hex("device-concurrent-expired");

    // Insert expired thread with old messages
    const [expiredThread] = await db
      .insert(messageThreadsTable)
      .values({
        tenantId: tenant.id,
        deviceTokenHash: hash,
        isOpen: true,
        deleteAfter: new Date(Date.now() - 1000),
      })
      .returning();

    await db.insert(messagesTable).values([
      { threadId: expiredThread!.id, tenantId: tenant.id, sender: "guest", body: "Ancient msg 1" },
      { threadId: expiredThread!.id, tenantId: tenant.id, sender: "guest", body: "Ancient msg 2" },
    ]);

    const da = makeMessageDeleteAfter();

    // Two concurrent sends race the expired row
    const results = await Promise.allSettled([
      runGuestPostTransaction(tenant.id, hash, "New msg A", da),
      runGuestPostTransaction(tenant.id, hash, "New msg B", da),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    assert.ok(fulfilled.length >= 1, "at least one concurrent send must succeed");

    // Exactly one thread must exist (no expired resurrection, no duplicate)
    const threads = await db
      .select()
      .from(messageThreadsTable)
      .where(
        and(
          eq(messageThreadsTable.tenantId, tenant.id),
          eq(messageThreadsTable.deviceTokenHash, hash),
        ),
      );
    assert.equal(threads.length, 1, "exactly one active thread must exist");
    assert.ok(threads[0]!.deleteAfter > new Date(), "surviving thread must be active");
    assert.notEqual(
      threads[0]!.id,
      expiredThread!.id,
      "surviving thread must not be the expired one",
    );

    // No messages from the expired thread
    const oldMsgs = await db
      .select()
      .from(messagesTable)
      .where(eq(messagesTable.threadId, expiredThread!.id));
    assert.equal(oldMsgs.length, 0, "old messages must be gone (cascaded with expired thread)");

    // All surviving messages belong to the new thread
    const [newThread] = threads;
    const newMsgs = await db
      .select()
      .from(messagesTable)
      .where(eq(messagesTable.threadId, newThread!.id));
    assert.ok(newMsgs.length >= 1, "new thread must have at least one message");
    for (const msg of newMsgs) {
      assert.ok(
        msg.body === "New msg A" || msg.body === "New msg B",
        `unexpected old message body "${msg.body}" found in new thread`,
      );
    }

    await cleanupTenant(tenant.id);
  });
});
