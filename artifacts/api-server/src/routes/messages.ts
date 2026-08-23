/**
 * Guest–host messaging routes.
 *
 * Public:
 *   GET  /public/tenants/:slug/messages   — device-scoped thread view (204 if none)
 *   POST /public/tenants/:slug/messages   — guest sends a message (rate-limited)
 *
 * Admin (requireAdmin middleware):
 *   GET  /admin/tenants/:tenantId/messages                     — list all threads
 *   POST /admin/tenants/:tenantId/messages/:threadRef          — host reply
 *
 * Security contract:
 * - One durable thread per (tenantId, deviceTokenHash) via unique DB constraint.
 * - Raw device token never stored or logged; SHA-256 hash used for all lookups.
 * - Both public GET and POST require a published tenant — unpublished tenants
 *   cannot expose existing threads to any device.
 * - Guest reads/writes only their own thread for the specified tenant.
 * - Admin endpoints are guarded by requireAdmin; tenant isolation enforced by
 *   checking the thread's tenantId against the path param.
 * - guestName / guestUnit / guestPhone stored on thread for host context; never
 *   in email or logs.
 * - messageNotifyEmail controls the notification bell only, not feature availability.
 * - Rate limit: 5/min per IP and 5/min per device (separate from orders).
 * - Retention: deleteAfter = now + 90 days; extended on each new message. All
 *   public and admin list reads filter out threads with deleteAfter <= now so
 *   expired rows never surface between daily sweeps.
 * - Email idempotency key: "message-<messageId>" — one notification per inserted
 *   guest message row, not per thread. Every guest message may ring the bell.
 *
 * Concurrency & expiry safety:
 * - Guest POST runs entirely inside a serializable transaction. It locks the
 *   thread row (or the insert point) via SELECT … FOR UPDATE, deletes any
 *   expired row before inserting a fresh thread, and appends the message — all
 *   atomically. This prevents an expired thread from being silently revived and
 *   ensures old messages are purged before a new conversation starts.
 * - Host POST also runs inside a transaction with a FOR UPDATE lock on the
 *   thread row so it cannot race the retention sweep. An expired thread returns
 *   404 and is never replied to or extended.
 * - Email dispatch is always outside the DB transaction so a Resend timeout
 *   cannot hold a DB connection open.
 */
import { Router, type IRouter } from "express";
import { and, asc, desc, eq, gt, lte, sql } from "drizzle-orm";
import {
  db,
  tenantsTable,
  messageThreadsTable,
  messagesTable,
} from "@workspace/db";
import {
  GetGuestMessagesResponse,
  SendGuestMessageBody,
  SendGuestMessageResponse,
  ListTenantThreadsResponse,
  PostHostReplyBody,
  PostHostReplyResponse,
} from "@workspace/api-zod";
import { requireAdmin } from "../lib/adminAuth";
import { logger } from "../lib/logger";
import {
  sha256hex,
  DEVICE_TOKEN_MIN,
  DEVICE_TOKEN_MAX,
  matchesOrderPassword,
} from "../lib/orderHelpers";
import {
  msgIpRateLimiter,
  msgDeviceRateLimiter,
  MESSAGE_BODY_MAX,
  MESSAGE_GUEST_NAME_MAX,
  MESSAGE_GUEST_PHONE_MAX,
  MESSAGE_GUEST_UNIT_MAX,
  hasMinimumMessagePhoneDigits,
  invalidMessagePhoneMessage,
  requiredMessageNameMessage,
  requiredMessagePhoneMessage,
  requiredMessageUnitMessage,
  wrongMessagePasswordMessage,
} from "../lib/messageHelpers";
import { makeMessageDeleteAfter } from "../lib/messageRetention";
import { sendMessageNotification, messageEmailFrom } from "../lib/messageEmail";

const router: IRouter = Router();

function firstParam(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v) ?? "";
}

function serialize<T>(value: T): unknown {
  return JSON.parse(JSON.stringify(value));
}

// ─── Formatters ───────────────────────────────────────────────────────────────

function formatMessages(rows: typeof messagesTable.$inferSelect[]) {
  return rows.map((m) => ({
    id: m.id,
    sender: m.sender,
    body: m.body,
    createdAt: m.createdAt.toISOString(),
  }));
}

function formatGuestThreadView(
  thread: typeof messageThreadsTable.$inferSelect,
  messages: typeof messagesTable.$inferSelect[],
) {
  return GetGuestMessagesResponse.parse(
    serialize({
      threadRef: thread.threadRef,
      isOpen: thread.isOpen,
      messages: formatMessages(messages),
      createdAt: thread.createdAt.toISOString(),
      updatedAt: thread.updatedAt.toISOString(),
    }),
  );
}

function formatAdminThreadView(
  thread: typeof messageThreadsTable.$inferSelect,
  messages: typeof messagesTable.$inferSelect[],
) {
  return {
    threadRef: thread.threadRef,
    tenantId: thread.tenantId,
    guestName: thread.guestName,
    guestUnit: thread.guestUnit,
    guestPhone: thread.guestPhone,
    isOpen: thread.isOpen,
    messages: formatMessages(messages),
    createdAt: thread.createdAt.toISOString(),
    updatedAt: thread.updatedAt.toISOString(),
    deleteAfter: thread.deleteAfter.toISOString(),
  };
}

// ─── DB helpers ───────────────────────────────────────────────────────────────

/**
 * Resolve a published tenant by slug. Returns null when not found or not
 * published. Used for both public GET and public POST so unpublished tenants
 * cannot expose existing threads to any device.
 */
async function resolvePublishedTenant(slug: string) {
  const [tenant] = await db
    .select()
    .from(tenantsTable)
    .where(and(eq(tenantsTable.slug, slug), eq(tenantsTable.isPublished, true)));
  return tenant ?? null;
}

async function getThreadMessages(threadId: string) {
  return db
    .select()
    .from(messagesTable)
    .where(eq(messagesTable.threadId, threadId))
    .orderBy(asc(messagesTable.createdAt));
}

// ─── Public: GET /public/tenants/:slug/messages ───────────────────────────────

router.get(
  "/public/tenants/:slug/messages",
  async (req, res): Promise<void> => {
    const slug = firstParam(req.params["slug"]);

    // Device token validation
    const rawDeviceToken = req.headers["x-device-token"];
    if (
      typeof rawDeviceToken !== "string" ||
      rawDeviceToken.length < DEVICE_TOKEN_MIN ||
      rawDeviceToken.length > DEVICE_TOKEN_MAX
    ) {
      res.status(400).json({
        error: `x-device-token header is required (${DEVICE_TOKEN_MIN}-${DEVICE_TOKEN_MAX} chars)`,
      });
      return;
    }
    const deviceTokenHash = sha256hex(rawDeviceToken);

    // Resolve published tenant — unpublished tenants must not expose threads.
    const tenant = await resolvePublishedTenant(slug);
    if (!tenant) {
      res.status(404).json({ error: "Tenant not found or not published" });
      return;
    }

    // Look up thread for this device. Filter by deleteAfter > now so expired
    // threads do not surface between daily sweeps.
    const [thread] = await db
      .select()
      .from(messageThreadsTable)
      .where(
        and(
          eq(messageThreadsTable.tenantId, tenant.id),
          eq(messageThreadsTable.deviceTokenHash, deviceTokenHash),
          gt(messageThreadsTable.deleteAfter, new Date()),
        ),
      );

    if (!thread) {
      res.status(204).end();
      return;
    }

    const messages = await getThreadMessages(thread.id);
    res.json(formatGuestThreadView(thread, messages));
  },
);

// ─── Public: POST /public/tenants/:slug/messages ──────────────────────────────

router.post(
  "/public/tenants/:slug/messages",
  async (req, res): Promise<void> => {
    const slug = firstParam(req.params["slug"]);

    // Device token validation
    const rawDeviceToken = req.headers["x-device-token"];
    if (
      typeof rawDeviceToken !== "string" ||
      rawDeviceToken.length < DEVICE_TOKEN_MIN ||
      rawDeviceToken.length > DEVICE_TOKEN_MAX
    ) {
      res.status(400).json({
        error: `x-device-token header is required (${DEVICE_TOKEN_MIN}-${DEVICE_TOKEN_MAX} chars)`,
      });
      return;
    }
    const deviceTokenHash = sha256hex(rawDeviceToken);

    // Rate limiting (separate from orders)
    const ip = req.ip ?? "unknown";
    if (!msgIpRateLimiter.allow(ip)) {
      res.status(429).json({ error: "Too many requests from this IP" });
      return;
    }
    if (!msgDeviceRateLimiter.allow(deviceTokenHash)) {
      res.status(429).json({ error: "Too many requests from this device" });
      return;
    }

    // Signed-in identity checks happen before the generated schema so missing
    // and whitespace-only values receive the same localized required-field
    // messages as orders. Both rate limiters intentionally run first.
    const submittedLang =
      req.body &&
      typeof req.body === "object" &&
      typeof req.body.lang === "string"
        ? req.body.lang
        : undefined;
    const submittedGuestName =
      req.body &&
      typeof req.body === "object" &&
      typeof req.body.guestName === "string"
        ? req.body.guestName.trim()
        : "";
    const submittedGuestUnit =
      req.body &&
      typeof req.body === "object" &&
      typeof req.body.guestUnit === "string"
        ? req.body.guestUnit.trim()
        : "";
    const submittedGuestPhone =
      req.body &&
      typeof req.body === "object" &&
      typeof req.body.guestPhone === "string"
        ? req.body.guestPhone.trim()
        : "";
    if (!submittedGuestName) {
      res.status(400).json({
        code: "MESSAGE_NAME_REQUIRED",
        error: requiredMessageNameMessage(submittedLang),
      });
      return;
    }
    if (!submittedGuestUnit) {
      res.status(400).json({
        code: "MESSAGE_UNIT_REQUIRED",
        error: requiredMessageUnitMessage(submittedLang),
      });
      return;
    }
    if (!submittedGuestPhone) {
      res.status(400).json({
        code: "MESSAGE_PHONE_REQUIRED",
        error: requiredMessagePhoneMessage(submittedLang),
      });
      return;
    }

    // Remaining body validation
    const parsed = SendGuestMessageBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const body = parsed.data.body.trim();
    if (!body) {
      res.status(400).json({ error: "body must not be blank" });
      return;
    }
    if (body.length > MESSAGE_BODY_MAX) {
      res.status(400).json({ error: `body max ${MESSAGE_BODY_MAX} characters` });
      return;
    }

    // Identity and credential checks deliberately happen after both rate
    // limiters so failed sign-in attempts count toward the same 5/min budget.
    const guestName = parsed.data.guestName.trim();
    const guestUnit = parsed.data.guestUnit.trim();
    const guestPhone = parsed.data.guestPhone.trim();
    if (guestName.length > MESSAGE_GUEST_NAME_MAX) {
      res.status(400).json({ error: `guestName max ${MESSAGE_GUEST_NAME_MAX}` });
      return;
    }
    if (guestUnit.length > MESSAGE_GUEST_UNIT_MAX) {
      res.status(400).json({ error: `guestUnit max ${MESSAGE_GUEST_UNIT_MAX}` });
      return;
    }
    if (!hasMinimumMessagePhoneDigits(guestPhone)) {
      res.status(400).json({
        code: "MESSAGE_PHONE_INVALID",
        error: invalidMessagePhoneMessage(parsed.data.lang),
      });
      return;
    }
    if (guestPhone.length > MESSAGE_GUEST_PHONE_MAX) {
      res.status(400).json({ error: `guestPhone max ${MESSAGE_GUEST_PHONE_MAX}` });
      return;
    }

    // Resolve published tenant — same guard as GET
    const tenant = await resolvePublishedTenant(slug);
    if (!tenant) {
      res.status(404).json({ error: "Tenant not found or not published" });
      return;
    }
    if (!matchesOrderPassword(tenant.orderPassword, parsed.data.password)) {
      res.status(403).json({
        code: "INVALID_GUEST_PASSWORD",
        error: wrongMessagePasswordMessage(parsed.data.lang),
      });
      return;
    }

    const deleteAfter = makeMessageDeleteAfter();
    const tenantId = tenant.id;

    /**
     * Atomic guest-message transaction.
     *
     * Strategy: advisory-style row lock via SELECT … FOR UPDATE on any existing
     * thread for this (tenantId, deviceTokenHash). This serialises all concurrent
     * sends — both concurrent first-sends (no row yet) and concurrent sends that
     * race a retention sweep (row may be expired).
     *
     * Steps inside the transaction:
     * 1. Lock the existing thread row if present (FOR UPDATE).
     * 2. If the row is expired (deleteAfter <= now), DELETE it so the cascade
     *    removes all old messages — the old conversation is gone.
     * 3. INSERT a new thread row (ON CONFLICT DO NOTHING handles the case where
     *    another concurrent first-send already inserted it within this same txn
     *    window — the unique index serialises that last mile).
     * 4. Re-read the canonical thread (guaranteed non-expired after steps 2–3).
     * 5. Check isOpen; reject with 409 if closed.
     * 6. Update optional context fields and extend deleteAfter.
     * 7. Insert the message row and capture its id.
     *
     * Email dispatch happens OUTSIDE the transaction so a Resend timeout
     * cannot hold a DB connection open.
     */
    let insertedMessageId: string;
    let thread: typeof messageThreadsTable.$inferSelect;

    try {
      const result = await db.transaction(async (tx) => {
        // Step 1: lock any existing thread row for this device+tenant.
        // FOR UPDATE prevents another concurrent request from reading a stale
        // (possibly expired) snapshot and then making conflicting writes.
        await tx.execute(
          sql`
            SELECT id FROM ${messageThreadsTable}
            WHERE ${messageThreadsTable.tenantId} = ${tenantId}
              AND ${messageThreadsTable.deviceTokenHash} = ${deviceTokenHash}
            FOR UPDATE
          `,
        );

        // Step 2: delete an expired thread (if any) so its old messages are
        // purged before the new conversation starts. The FK cascade removes all
        // messages belonging to the expired thread.
        await tx
          .delete(messageThreadsTable)
          .where(
            and(
              eq(messageThreadsTable.tenantId, tenantId),
              eq(messageThreadsTable.deviceTokenHash, deviceTokenHash),
              lte(messageThreadsTable.deleteAfter, new Date()),
            ),
          );

        // Step 3: insert a fresh thread if none exists. ON CONFLICT DO NOTHING
        // is the last-mile guard for two concurrent first-sends: one wins the
        // INSERT, the other is silently skipped and will resolve via step 4.
        await tx
          .insert(messageThreadsTable)
          .values({
            tenantId,
            deviceTokenHash,
            guestName,
            guestUnit,
            guestPhone,
            isOpen: true,
            deleteAfter,
          })
          .onConflictDoNothing({
            target: [
              messageThreadsTable.tenantId,
              messageThreadsTable.deviceTokenHash,
            ],
          });

        // Step 4: read the canonical (now guaranteed current) thread.
        const [currentThread] = await tx
          .select()
          .from(messageThreadsTable)
          .where(
            and(
              eq(messageThreadsTable.tenantId, tenantId),
              eq(messageThreadsTable.deviceTokenHash, deviceTokenHash),
            ),
          );

        if (!currentThread) {
          // Should be unreachable: insert succeeded or pre-existed after delete.
          throw new Error("thread_vanished");
        }

        // Step 5: check thread is open.
        if (!currentThread.isOpen) {
          throw new Error("thread_closed");
        }

        // Step 6: extend deleteAfter and refresh the required signed-in name,
        // unit and phone. This also repairs a legacy device thread on its next
        // authenticated guest send.
        const updateFields: Record<string, unknown> = { deleteAfter };
        if (guestName !== currentThread.guestName) {
          updateFields["guestName"] = guestName;
        }
        if (guestUnit !== currentThread.guestUnit) {
          updateFields["guestUnit"] = guestUnit;
        }
        if (guestPhone !== currentThread.guestPhone) {
          updateFields["guestPhone"] = guestPhone;
        }
        await tx
          .update(messageThreadsTable)
          .set(updateFields)
          .where(eq(messageThreadsTable.id, currentThread.id));

        // Step 7: insert the new message row.
        const [msg] = await tx
          .insert(messagesTable)
          .values({
            threadId: currentThread.id,
            tenantId,
            sender: "guest",
            body,
          })
          .returning({ id: messagesTable.id });

        if (!msg) {
          throw new Error("message_insert_failed");
        }

        return { thread: currentThread, messageId: msg.id };
      });

      thread = result.thread;
      insertedMessageId = result.messageId;
    } catch (err) {
      const errName = err instanceof Error ? err.constructor.name : "UnknownError";
      const msg = err instanceof Error ? err.message : "";
      if (msg === "thread_closed") {
        res.status(409).json({ error: "Thread is closed — no new messages accepted" });
        return;
      }
      if (msg === "thread_vanished") {
        logger.error({ tenantId, errName }, "[messages] thread vanished after upsert");
        res.status(500).json({ error: "Internal error" });
        return;
      }
      logger.error({ tenantId, errName }, "[messages] guest message transaction failed");
      res.status(500).json({ error: "Internal error" });
      return;
    }

    logger.info(
      { messageId: insertedMessageId, threadRef: thread.threadRef, tenantId },
      "[messages] guest message stored",
    );

    // Send PII-safe notification email (best-effort; never blocks the response).
    // Idempotency key = "message-<messageId>" — one bell per guest message row.
    // Email dispatch is OUTSIDE the transaction.
    if (tenant.messageNotifyEmail && tenant.email) {
      try {
        messageEmailFrom(); // throws if ORDER_EMAIL_FROM not configured
        const capturedMessageId = insertedMessageId;
        const capturedThreadRef = thread.threadRef;
        void sendMessageNotification({
          to: tenant.email,
          tenantName: tenant.name,
          guestUnit,
          messageId: capturedMessageId,
          threadRef: capturedThreadRef,
        }).then((result) => {
          if (!result.ok) {
            logger.warn(
              { messageId: capturedMessageId, threadRef: capturedThreadRef },
              "[messages] notification email failed (best-effort)",
            );
          }
        });
      } catch {
        // messageEmailFrom() threw — ORDER_EMAIL_FROM not configured; skip
        logger.warn(
          { messageId: insertedMessageId, threadRef: thread.threadRef },
          "[messages] notification email skipped (sender not configured)",
        );
      }
    }

    // Re-read the updated thread and all messages for the response.
    const [updatedThread] = await db
      .select()
      .from(messageThreadsTable)
      .where(eq(messageThreadsTable.id, thread.id));
    const messages = await getThreadMessages(thread.id);

    res
      .status(201)
      .json(
        SendGuestMessageResponse.parse(
          serialize(formatGuestThreadView(updatedThread!, messages)),
        ),
      );
  },
);

// ─── Admin: GET /admin/tenants/:tenantId/messages ─────────────────────────────

router.get(
  "/admin/tenants/:tenantId/messages",
  requireAdmin,
  async (req, res): Promise<void> => {
    const tenantId = firstParam(req.params["tenantId"]);

    const [tenant] = await db
      .select({ id: tenantsTable.id })
      .from(tenantsTable)
      .where(eq(tenantsTable.id, tenantId));
    if (!tenant) {
      res.status(404).json({ error: "Tenant not found" });
      return;
    }

    // Filter by deleteAfter and by the complete signed-in identity invariant.
    // Legacy incomplete rows remain retained for their normal lifetime but can
    // never surface as an identity-less thread in the portal.
    const threads = await db
      .select()
      .from(messageThreadsTable)
      .where(
        and(
          eq(messageThreadsTable.tenantId, tenantId),
          gt(messageThreadsTable.deleteAfter, new Date()),
          sql`length(btrim(${messageThreadsTable.guestName})) > 0`,
          sql`length(btrim(${messageThreadsTable.guestUnit})) > 0`,
        ),
      )
      .orderBy(desc(messageThreadsTable.updatedAt));

    const result = await Promise.all(
      threads.map(async (thread) => {
        const msgs = await getThreadMessages(thread.id);
        return formatAdminThreadView(thread, msgs);
      }),
    );

    res.json(ListTenantThreadsResponse.parse(serialize(result)));
  },
);

// ─── Admin: POST /admin/tenants/:tenantId/messages/:threadRef ─────────────────

router.post(
  "/admin/tenants/:tenantId/messages/:threadRef",
  requireAdmin,
  async (req, res): Promise<void> => {
    const tenantId = firstParam(req.params["tenantId"]);
    const threadRef = firstParam(req.params["threadRef"]);

    // Validate tenant
    const [tenant] = await db
      .select({ id: tenantsTable.id })
      .from(tenantsTable)
      .where(eq(tenantsTable.id, tenantId));
    if (!tenant) {
      res.status(404).json({ error: "Tenant not found" });
      return;
    }

    // Validate body
    const parsed = PostHostReplyBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const body = parsed.data.body.trim();
    if (!body) {
      res.status(400).json({ error: "body must not be blank" });
      return;
    }
    if (body.length > MESSAGE_BODY_MAX) {
      res.status(400).json({ error: `body max ${MESSAGE_BODY_MAX} characters` });
      return;
    }

    /**
     * Atomic host-reply transaction.
     *
     * Lock the thread row FOR UPDATE so the retention sweep cannot delete it
     * between our expiry check and the INSERT. An expired thread returns 404
     * and is never extended or replied to.
     */
    let thread: typeof messageThreadsTable.$inferSelect;
    let replyThreadId: string;

    try {
      const result = await db.transaction(async (tx) => {
        // Lock the thread row to prevent a race with the retention sweep.
        await tx.execute(
          sql`
            SELECT id FROM ${messageThreadsTable}
            WHERE ${messageThreadsTable.threadRef} = ${threadRef}
              AND ${messageThreadsTable.tenantId} = ${tenantId}
            FOR UPDATE
          `,
        );

        // Re-read after acquiring the lock: check existence and expiry together.
        const [lockedThread] = await tx
          .select()
          .from(messageThreadsTable)
          .where(
            and(
              eq(messageThreadsTable.threadRef, threadRef),
              eq(messageThreadsTable.tenantId, tenantId),
              sql`length(btrim(${messageThreadsTable.guestName})) > 0`,
              sql`length(btrim(${messageThreadsTable.guestUnit})) > 0`,
            ),
          );

        if (!lockedThread) {
          throw new Error("thread_not_found");
        }

        // Reject expired threads — host may not reply to or revive them.
        if (lockedThread.deleteAfter <= new Date()) {
          throw new Error("thread_expired");
        }

        // Insert host reply.
        await tx.insert(messagesTable).values({
          threadId: lockedThread.id,
          tenantId,
          sender: "host",
          body,
        });

        // Extend deleteAfter since there is new activity.
        const newDeleteAfter = makeMessageDeleteAfter();
        await tx
          .update(messageThreadsTable)
          .set({ deleteAfter: newDeleteAfter })
          .where(eq(messageThreadsTable.id, lockedThread.id));

        return { thread: lockedThread };
      });

      thread = result.thread;
      replyThreadId = thread.id;
    } catch (err) {
      const errName = err instanceof Error ? err.constructor.name : "UnknownError";
      const msg = err instanceof Error ? err.message : "";
      if (msg === "thread_not_found" || msg === "thread_expired") {
        res.status(404).json({ error: "Thread not found" });
        return;
      }
      logger.error({ threadRef, tenantId, errName }, "[messages] host reply transaction failed");
      res.status(500).json({ error: "Internal error" });
      return;
    }

    logger.info(
      { threadRef: thread.threadRef, tenantId },
      "[messages] host reply stored",
    );

    // Re-read updated thread + messages
    const [updatedThread] = await db
      .select()
      .from(messageThreadsTable)
      .where(eq(messageThreadsTable.id, replyThreadId));
    const messages = await getThreadMessages(replyThreadId);

    res
      .status(201)
      .json(
        PostHostReplyResponse.parse(
          serialize(formatAdminThreadView(updatedThread!, messages)),
        ),
      );
  },
);

export default router;
