/**
 * Living Guide — order routes.
 *
 * Public:
 *   POST /public/tenants/:slug/orders   — create order (rate-limited, idempotent)
 *   GET  /public/tenants/:slug/orders   — device-scoped visible order list
 *
 * Admin (requireAdmin middleware):
 *   GET   /admin/tenants/:id/orders         — list visible tenant orders
 *   PATCH /admin/orders/:orderRef/status    — status transition (race-safe)
 *
 * ── Atomic create flow with exact claim identity ─────────────────────────────
 *
 * Every send attempt owns a fresh cryptographically random claimToken and a
 * claimedAt timestamp. A row in 'sending' is owned by exactly one attempt (its
 * token). Completion updates gate on that token so a stale attempt can never
 * overwrite a newer claim (the stale-A / new-B completion race).
 *
 *  1. Validate headers, body, rate limits, tenant, item, emailFrom() config.
 *  2. Build all snapshot values; generate claimToken + claimedAt.
 *  3. INSERT … ON CONFLICT (idempotencyKey) DO NOTHING RETURNING, with the row
 *     born directly in notificationStatus='sending' owned by claimToken.
 *     - Returned row → we own the active claim.
 *     - No returned row → conflict exists; SELECT the canonical row.
 *  4. Decide action from the canonical row (decideNotificationAction):
 *     - conflict_sent       → 409 with existing public order
 *     - processing          → 425 (a FRESH active claim owns the row)
 *     - claim_failed        → atomic UPDATE WHERE notificationStatus='failed'
 *                             → 'sending' + rotate token
 *     - claim_pending       → atomic UPDATE WHERE notificationStatus='pending'
 *                             → 'sending' + rotate token
 *     - reclaim_stale_claim → atomic UPDATE WHERE notificationStatus='sending'
 *                             AND notificationClaimedAt <= staleThreshold
 *                             → 'sending' + rotate token (recovery reclaims ONLY
 *                             an expired active claim)
 *     If the atomic reclaim UPDATE touches 0 rows (lost race) → 425.
 *  5. Send email using ONLY the canonical stored snapshot fields.
 *     Idempotency-Key header = orderRef (Resend documented standard).
 *  6. Conditional completion update — gated on EXACT claim identity:
 *       WHERE orderRef AND notificationClaimToken=<this token>
 *             AND notificationStatus='sending'
 *     - Failure: → 'failed', clear token. If 0 rows (token rotated), do nothing.
 *     - Success: → 'sent', clear token. If 0 rows, re-read: if 'sent' already,
 *                succeed; else 425 (another claim now owns the row).
 *
 * ── Other rules ─────────────────────────────────────────────────────────────
 *  - x-device-token: required, 16–256 chars; SHA-256 hashed; never stored raw
 *  - x-idempotency-key: REQUIRED, 16–128 chars; missing = 400
 *  - qty must be Number.isInteger, 1–999
 *  - All guest strings trimmed before storage
 *  - guestPhone must contain at least six digits; original formatting is preserved
 *  - A configured tenant order password gates genuinely new orders only; it is
 *    trimmed, case-sensitive, never persisted with the order, and never logged
 *  - When tenant orderNotifyEmail=true, missing ORDER_EMAIL_FROM/email → 422
 *  - When disabled, notificationStatus='skipped' and no email attempt occurs
 *  - Only notificationStatus IN ('sent','skipped') + unexpired rows are visible
 *  - Status PATCH uses WHERE orderRef AND current_status (race-safe optimistic lock)
 *  - PII never logged; errors never echo request bodies
 */
import { Router, type IRouter } from "express";
import { and, desc, eq, gt, inArray, lte } from "drizzle-orm";
import {
  db,
  ordersTable,
  itemsTable,
  categoriesTable,
  sectionsTable,
  tenantsTable,
} from "@workspace/db";
import {
  CreateOrderBody,
  CreateOrderResponse,
  ListDeviceOrdersResponse,
  ListTenantOrdersResponse,
  UpdateOrderStatusBody,
  UpdateOrderStatusResponse,
} from "@workspace/api-zod";
import { requireAdmin } from "../lib/adminAuth";
import { logChange, orderStatusSummary } from "../lib/changelog";
import { logger } from "../lib/logger";
import {
  sha256hex,
  makeIdempotencyKey,
  makeDeleteAfter,
  makeClaimToken,
  isAllowedTransition,
  decideNotificationAction,
  STALE_CLAIM_MS,
  ipRateLimiter,
  deviceRateLimiter,
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
  matchesOrderPassword,
  requiredOrderFieldMessage,
  wrongOrderPasswordMessage,
} from "../lib/orderHelpers";
import { sendOrderEmail, emailFrom } from "../lib/orderEmail";
import { extractFulfillmentSentence } from "../lib/orderFulfillment";
import { dispatchNotification } from "../lib/notificationDispatcher";
import { isValidE164, isWhatsappConfigured } from "../lib/whatsapp";

const router: IRouter = Router();

function firstParam(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v) ?? "";
}

function serialize<T>(value: T): unknown {
  return JSON.parse(JSON.stringify(value));
}

// ─── Formatters ───────────────────────────────────────────────────────────────

function formatOrderPublic(order: typeof ordersTable.$inferSelect) {
  return CreateOrderResponse.parse(
    serialize({
      orderRef: order.orderRef,
      tenantId: order.tenantId,
      itemId: order.itemId,
      snapshotTitle: order.snapshotTitle,
      snapshotPrice: order.snapshotPrice,
      snapshotPriceUnit: order.snapshotPriceUnit,
      snapshotFulfillment: order.snapshotFulfillment,
      snapshotProducerName: order.snapshotProducerName,
      qty: order.qty,
      guestName: order.guestName,
      guestPhone: order.guestPhone,
      guestUnit: order.guestUnit,
      guestNote: order.guestNote,
      status: order.status,
      statusNote: order.statusNote,
      createdAt: order.createdAt.toISOString(),
      updatedAt: order.updatedAt.toISOString(),
    }),
  );
}

function formatOrderAdmin(order: typeof ordersTable.$inferSelect) {
  return UpdateOrderStatusResponse.parse(
    serialize({
      orderRef: order.orderRef,
      tenantId: order.tenantId,
      itemId: order.itemId,
      snapshotTitle: order.snapshotTitle,
      snapshotPrice: order.snapshotPrice,
      snapshotPriceUnit: order.snapshotPriceUnit,
      snapshotFulfillment: order.snapshotFulfillment,
      snapshotProducerName: order.snapshotProducerName,
      snapshotTenantName: order.snapshotTenantName,
      qty: order.qty,
      guestName: order.guestName,
      guestPhone: order.guestPhone,
      guestUnit: order.guestUnit,
      guestNote: order.guestNote,
      status: order.status,
      statusNote: order.statusNote,
      notificationStatus: order.notificationStatus,
      notificationSentAt: order.notificationSentAt?.toISOString() ?? null,
      createdAt: order.createdAt.toISOString(),
      updatedAt: order.updatedAt.toISOString(),
      deleteAfter: order.deleteAfter.toISOString(),
    }),
  );
}

// ─── DB helpers ───────────────────────────────────────────────────────────────

async function resolvePublishedTenant(slug: string) {
  const [tenant] = await db
    .select()
    .from(tenantsTable)
    .where(and(eq(tenantsTable.slug, slug), eq(tenantsTable.isPublished, true)));
  return tenant ?? null;
}

async function resolveEligibleItem(tenantId: string, itemId: string) {
  const [row] = await db
    .select({ item: itemsTable, tenantId: sectionsTable.tenantId })
    .from(itemsTable)
    .innerJoin(categoriesTable, eq(itemsTable.categoryId, categoriesTable.id))
    .innerJoin(sectionsTable, eq(categoriesTable.sectionId, sectionsTable.id))
    .where(eq(itemsTable.id, itemId));
  if (!row) return null;
  if (row.tenantId !== tenantId) return null;
  return row.item;
}

// ─── Public: create order ─────────────────────────────────────────────────────

router.post("/public/tenants/:slug/orders", async (req, res): Promise<void> => {
  const slug = firstParam(req.params["slug"]);

  // ── Device token ────────────────────────────────────────────────────────
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

  // ── Idempotency key (required) ───────────────────────────────────────────
  const rawIdempotencyKey = req.headers["x-idempotency-key"];
  if (
    typeof rawIdempotencyKey !== "string" ||
    rawIdempotencyKey.length < IDEMPOTENCY_KEY_MIN ||
    rawIdempotencyKey.length > IDEMPOTENCY_KEY_MAX
  ) {
    res.status(400).json({
      error: `x-idempotency-key header is required (${IDEMPOTENCY_KEY_MIN}-${IDEMPOTENCY_KEY_MAX} chars)`,
    });
    return;
  }

  // ── Rate limiting ────────────────────────────────────────────────────────
  const ip = req.ip ?? "unknown";
  if (!ipRateLimiter.allow(ip)) {
    res.status(429).json({ error: "Too many requests from this IP" });
    return;
  }
  if (!deviceRateLimiter.allow(deviceTokenHash)) {
    res.status(429).json({ error: "Too many requests from this device" });
    return;
  }

  // ── Body validation ──────────────────────────────────────────────────────
  const parsed = CreateOrderBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { itemId } = parsed.data;

  // Trim all guest string fields before any storage
  const guestName = parsed.data.guestName.trim();
  const guestPhone = parsed.data.guestPhone.trim();
  const guestUnit = parsed.data.guestUnit.trim();
  const guestNote = parsed.data.guestNote?.trim() ?? null;
  const submittedOrderPassword = parsed.data.orderPassword?.trim() ?? null;

  if (!guestName) {
    res.status(400).json({ error: requiredOrderFieldMessage(parsed.data.lang) });
    return;
  }
  if (!guestPhone) { res.status(400).json({ error: "guestPhone must not be blank" }); return; }
  if (!hasMinimumPhoneDigits(guestPhone)) {
    res.status(400).json({
      error: `guestPhone must contain at least ${GUEST_PHONE_MIN_DIGITS} digits`,
    });
    return;
  }
  if (!guestUnit) { res.status(400).json({ error: "guestUnit must not be blank" }); return; }
  if (guestName.length > GUEST_NAME_MAX) { res.status(400).json({ error: `guestName max ${GUEST_NAME_MAX}` }); return; }
  if (guestPhone.length > GUEST_PHONE_MAX) { res.status(400).json({ error: `guestPhone max ${GUEST_PHONE_MAX}` }); return; }
  if (guestUnit.length > GUEST_UNIT_MAX) { res.status(400).json({ error: `guestUnit max ${GUEST_UNIT_MAX}` }); return; }
  if (guestNote && guestNote.length > GUEST_NOTE_MAX) { res.status(400).json({ error: `guestNote max ${GUEST_NOTE_MAX}` }); return; }

  // qty must be a positive integer (not a float)
  const qty = parsed.data.qty;
  if (!Number.isInteger(qty) || qty < 1 || qty > 999) {
    res.status(400).json({ error: "qty must be a whole number between 1 and 999" });
    return;
  }

  // ── Resolve tenant ───────────────────────────────────────────────────────
  const tenant = await resolvePublishedTenant(slug);
  if (!tenant) {
    res.status(400).json({ error: "Tenant not found or not published" });
    return;
  }

  const idempotencyKey = makeIdempotencyKey(tenant.id, deviceTokenHash, rawIdempotencyKey);

  // Every send attempt (new insert OR reclaim) owns a fresh random claim token.
  // The row enters 'sending' with this token; only the attempt whose token
  // matches may later move the row to sent/failed.
  const claimToken = makeClaimToken();
  const claimedAt = new Date();

  // Resolve idempotency BEFORE applying current item/email configuration.
  // A retry belongs to the stored order policy and snapshots, even if the host
  // has since changed the toggle, email address, item visibility, or stock.
  const [preExisting] = await db
    .select()
    .from(ordersTable)
    .where(eq(ordersTable.idempotencyKey, idempotencyKey));

  let inserted: typeof ordersTable.$inferSelect | undefined;

  if (!preExisting) {
    if (!matchesOrderPassword(tenant.orderPassword, submittedOrderPassword)) {
      res.status(403).json({
        code: "INVALID_ORDER_PASSWORD",
        error: wrongOrderPasswordMessage(parsed.data.lang),
      });
      return;
    }

    // Current notification settings apply only to genuinely NEW orders.
    if (tenant.orderNotifyEmail) {
      try {
        emailFrom();
      } catch {
        res.status(422).json({
          error: "Pošiljatelj e-pošte za obvestila ni nastavljen.",
        });
        return;
      }
      if (!tenant.email) {
        res.status(422).json({
          error: "Obvestila ni mogoče dostaviti, ker nastanitev nima e-poštnega naslova.",
        });
        return;
      }
      if (tenant.notificationChannel === "whatsapp") {
        if (!isWhatsappConfigured()) {
          res.status(422).json({ error: "WhatsApp še ni nastavljen." });
          return;
        }
        if (
          !tenant.notificationWhatsappPhone ||
          !isValidE164(tenant.notificationWhatsappPhone)
        ) {
          res.status(422).json({
            error: "Za WhatsApp je zahtevana veljavna mednarodna številka E.164.",
          });
          return;
        }
      }
    }

    // ── Resolve item for a new order ────────────────────────────────────────
    const item = await resolveEligibleItem(tenant.id, itemId);
    if (!item) { res.status(400).json({ error: "Item not found" }); return; }
    if (!item.isVisible) { res.status(400).json({ error: "Item is not visible" }); return; }
    if (!item.orderEnabled) { res.status(400).json({ error: "Ordering is not enabled for this item" }); return; }
    if (item.soldOut) { res.status(400).json({ error: "Item is sold out" }); return; }

    // ── Build immutable snapshots ───────────────────────────────────────────
    const snapshotTitle = item.title ?? null;
    const snapshotPrice = item.price ?? null;
    const snapshotPriceUnit = item.priceUnit ?? null;
    const snapshotFulfillment = extractFulfillmentSentence(item.body, item.noteText, item.bullets);
    const snapshotProducerName = item.producerName ?? null;
    const snapshotTenantName = tenant.name;
    const snapshotTenantEmail = tenant.orderNotifyEmail ? tenant.email : null;
    const snapshotNotificationChannel = tenant.notificationChannel;
    const snapshotTenantWhatsappPhone = tenant.notificationWhatsappPhone;
    const deleteAfter = makeDeleteAfter();

    // Atomic INSERT … ON CONFLICT DO NOTHING keeps concurrent creates safe.
    // The conflict path below always reuses the winner's stored policy.
    const [created] = await db
      .insert(ordersTable)
      .values({
        tenantId: tenant.id,
        deviceTokenHash,
        idempotencyKey,
        itemId,
        snapshotTitle,
        snapshotPrice,
        snapshotPriceUnit,
        snapshotFulfillment,
        snapshotProducerName,
        snapshotTenantName,
        snapshotTenantEmail,
        snapshotNotificationChannel,
        snapshotTenantWhatsappPhone,
        qty,
        guestName,
        guestPhone,
        guestUnit,
        guestNote,
        status: "novo",
        notificationStatus: tenant.orderNotifyEmail ? "sending" : "skipped",
        notificationClaimToken: tenant.orderNotifyEmail ? claimToken : null,
        notificationClaimedAt: tenant.orderNotifyEmail ? claimedAt : null,
        deleteAfter,
      })
      .onConflictDoNothing({ target: ordersTable.idempotencyKey })
      .returning();
    inserted = created;
  }

  let canonical: typeof ordersTable.$inferSelect;

  if (inserted) {
    // We inserted — we own the active claim (token = claimToken)
    canonical = inserted;
    if (!tenant.orderNotifyEmail) {
      logger.info(
        { orderRef: canonical.orderRef, tenantId: tenant.id },
        "[orders] new order accepted; tenant email notification skipped",
      );
      res.status(201).json(formatOrderPublic(canonical));
      return;
    }
    logger.info(
      { orderRef: canonical.orderRef, tenantId: tenant.id },
      "[orders] new order row created and claimed for sending",
    );
  } else {
    // Existing before validation, or concurrent winner after INSERT conflict.
    const existing = preExisting ?? (
      await db
        .select()
        .from(ordersTable)
        .where(eq(ordersTable.idempotencyKey, idempotencyKey))
    )[0];
    if (!existing) {
      // Should be impossible (conflict means it exists) but handle defensively
      logger.error({ tenantId: tenant.id }, "[orders] conflict row vanished");
      res.status(500).json({ error: "Internal error" });
      return;
    }

    // ── Step 4: Decide action ───────────────────────────────────────────────
    const action = decideNotificationAction(existing);

    if (action === "conflict_sent") {
      // Already delivered — return the canonical order as idempotent success.
      // This covers a client retry after the first response was lost.
      res.status(200).json(formatOrderPublic(existing));
      return;
    }

    if (action === "processing") {
      // A fresh active claim owns the row — tell client to retry later
      res.status(425).json({
        error:
          "Order is being processed. Retry with the same idempotency key after a moment.",
      });
      return;
    }

    // A retry preserves the ORIGINAL per-order notification decision. Failed,
    // pending, and stale-sending rows were created with email enabled; current
    // tenant toggle/email changes must neither suppress nor relabel that attempt.
    if (!existing.snapshotTenantEmail) {
      res.status(422).json({
        error: "Shranjeni prejemnik obvestila o naročilu manjka.",
      });
      return;
    }
    try {
      emailFrom();
    } catch {
      res.status(422).json({
        error: "Pošiljatelj e-pošte za obvestila ni nastavljen.",
      });
      return;
    }

    // action ∈ { claim_failed, reclaim_stale_claim, claim_pending }
    // Each performs a conditional atomic UPDATE that rotates the claim token,
    // gated on the EXACT prior state expected for that action. A concurrent
    // reclaim that already rotated the token makes this UPDATE match 0 rows.
    const staleThreshold = new Date(Date.now() - STALE_CLAIM_MS);
    let claimed: typeof ordersTable.$inferSelect | undefined;

    if (action === "claim_failed") {
      // Reclaim a failed row: WHERE notificationStatus='failed'
      const [c] = await db
        .update(ordersTable)
        .set({
          notificationStatus: "sending",
          notificationClaimToken: claimToken,
          notificationClaimedAt: claimedAt,
          updatedAt: claimedAt,
        })
        .where(
          and(
            eq(ordersTable.idempotencyKey, idempotencyKey),
            eq(ordersTable.notificationStatus, "failed"),
          ),
        )
        .returning();
      claimed = c;
    } else if (action === "claim_pending") {
      // Reclaim an unclaimed pending row: WHERE notificationStatus='pending'
      const [c] = await db
        .update(ordersTable)
        .set({
          notificationStatus: "sending",
          notificationClaimToken: claimToken,
          notificationClaimedAt: claimedAt,
          updatedAt: claimedAt,
        })
        .where(
          and(
            eq(ordersTable.idempotencyKey, idempotencyKey),
            eq(ordersTable.notificationStatus, "pending"),
          ),
        )
        .returning();
      claimed = c;
    } else {
      // reclaim_stale_claim: recovery may reclaim ONLY an EXPIRED active claim.
      // WHERE notificationStatus='sending' AND notificationClaimedAt <= threshold
      const [c] = await db
        .update(ordersTable)
        .set({
          notificationStatus: "sending",
          notificationClaimToken: claimToken,
          notificationClaimedAt: claimedAt,
          updatedAt: claimedAt,
        })
        .where(
          and(
            eq(ordersTable.idempotencyKey, idempotencyKey),
            eq(ordersTable.notificationStatus, "sending"),
            lte(ordersTable.notificationClaimedAt, staleThreshold),
          ),
        )
        .returning();
      claimed = c;
    }

    if (!claimed) {
      // Lost the race — another request claimed (rotated the token) or already
      // completed. Client should retry with the same idempotency key.
      res.status(425).json({
        error:
          "Order is being processed by another request. Retry with the same idempotency key after a moment.",
      });
      return;
    }

    canonical = claimed;
    logger.info(
      { orderRef: canonical.orderRef, action },
      "[orders] claimed existing row for notification retry",
    );
  }

  // ── Step 5: Dispatch using ONLY immutable stored snapshot fields ─────────
  // Never use current request values, current item, or current tenant here.
  const dispatchResult = await dispatchNotification({
    tenantId: canonical.tenantId,
    kind: "order",
    notificationId: canonical.orderRef,
    channel: canonical.snapshotNotificationChannel === "whatsapp" ? "whatsapp" : "email",
    emailRecipient: canonical.snapshotTenantEmail,
    whatsappRecipient: canonical.snapshotTenantWhatsappPhone,
    whatsappPayload: {
      guestName: canonical.guestName,
      guestUnit: canonical.guestUnit,
      item: canonical.snapshotTitle ?? "—",
      quantity: canonical.qty,
      time: canonical.createdAt.toISOString(),
    },
    sendEmail: async () => {
      const result = await sendOrderEmail({
        to: canonical.snapshotTenantEmail ?? "",
        tenantName: canonical.snapshotTenantName ?? "",
        orderRef: canonical.orderRef,
        itemTitle: canonical.snapshotTitle,
        qty: canonical.qty,
        price: canonical.snapshotPrice,
        priceUnit: canonical.snapshotPriceUnit,
        guestName: canonical.guestName,
        guestPhone: canonical.guestPhone,
        guestUnit: canonical.guestUnit,
        guestNote: canonical.guestNote,
      });
      return result.ok
        ? { ok: true as const, providerMessageId: result.messageId }
        : { ok: false as const, providerError: result.providerError };
    },
  });

  // ── Step 6: Conditional completion update — gated on EXACT claim identity ──
  // Completion MUST match:
  //   orderRef AND notificationClaimToken=<this attempt's token>
  //            AND notificationStatus='sending'
  // If a newer attempt (B) reclaimed the row while this attempt (A) was sending,
  // B rotated the token, so A's completion UPDATE matches 0 rows and cannot
  // overwrite B's claim. This closes the stale-A / new-B completion race.

  if (!dispatchResult.ok) {
    // Failure: 'sending' (this token) → 'failed'; clear the token.
    const [failedRow] = await db
      .update(ordersTable)
      .set({
        notificationStatus: "failed",
        notificationClaimToken: null,
        notificationClaimedAt: null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(ordersTable.orderRef, canonical.orderRef),
          eq(ordersTable.notificationClaimToken, claimToken), // exact claim identity
          eq(ordersTable.notificationStatus, "sending"),
        ),
      )
      .returning();

    if (!failedRow) {
      // This attempt no longer owns the row (a newer claim rotated the token,
      // or another attempt already completed it). Do NOT mutate anything.
      logger.info(
        { orderRef: canonical.orderRef },
        "[orders] stale attempt: failure update matched no rows; ignoring",
      );
    }

    res.status(422).json({
      error:
        "Naročilo je shranjeno, vendar obvestila ni bilo mogoče dostaviti. " +
        "Poskusite znova z istim ključem idempotentnosti.",
    });
    return;
  }

  // Success: 'sending' (this token) → 'sent'; clear the token.
  const now = new Date();
  const [finalized] = await db
    .update(ordersTable)
    .set({
      notificationStatus: "sent",
      notificationSentAt: now,
      notificationClaimToken: null,
      notificationClaimedAt: null,
      updatedAt: now,
    })
    .where(
      and(
        eq(ordersTable.orderRef, canonical.orderRef),
        eq(ordersTable.notificationClaimToken, claimToken), // exact claim identity
        eq(ordersTable.notificationStatus, "sending"),
      ),
    )
    .returning();

  if (!finalized) {
    // This attempt lost ownership (token rotated by a newer claim, or a
    // concurrent attempt already completed). Re-read to determine the outcome.
    const [current] = await db
      .select()
      .from(ordersTable)
      .where(eq(ordersTable.orderRef, canonical.orderRef));
    if (current?.notificationStatus === "sent") {
      // The order was delivered (by this or a concurrent attempt) — success.
      // Provider idempotency (Idempotency-Key = orderRef) prevented a duplicate.
      logger.info(
        { orderRef: canonical.orderRef },
        "[orders] concurrent/rotated claim already sent; returning existing sent order",
      );
      res.status(201).json(formatOrderPublic(current));
      return;
    }
    // Another attempt now owns an active claim ('sending' with a different
    // token) or the row is 'failed'/gone — this stale attempt must not force a
    // result. Ask the client to retry with the same idempotency key.
    logger.info(
      { orderRef: canonical.orderRef },
      "[orders] stale attempt: success update matched no rows; another claim owns the row",
    );
    res.status(425).json({
      error:
        "Order is being processed by another request. Retry with the same idempotency key after a moment.",
    });
    return;
  }

  logger.info(
    { orderRef: finalized.orderRef, tenantId: tenant.id },
    "[orders] order confirmed and notification sent",
  );
  res.status(201).json(formatOrderPublic(finalized));
});

// ─── Public: list device orders ────────────────────────────────────────────────

router.get("/public/tenants/:slug/orders", async (req, res): Promise<void> => {
  const slug = firstParam(req.params["slug"]);

  const rawDeviceToken = req.headers["x-device-token"];
  if (typeof rawDeviceToken !== "string" || rawDeviceToken.length < DEVICE_TOKEN_MIN) {
    res.status(400).json({ error: "x-device-token header is required" });
    return;
  }
  const deviceTokenHash = sha256hex(rawDeviceToken);

  const [tenant] = await db
    .select({ id: tenantsTable.id })
    .from(tenantsTable)
    .where(eq(tenantsTable.slug, slug));
  if (!tenant) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  // Only notification-complete (sent or intentionally skipped) + not expired
  const rows = await db
    .select()
    .from(ordersTable)
    .where(
      and(
        eq(ordersTable.tenantId, tenant.id),
        eq(ordersTable.deviceTokenHash, deviceTokenHash),
        inArray(ordersTable.notificationStatus, ["sent", "skipped"]),
        gt(ordersTable.deleteAfter, new Date()),
      ),
    )
    .orderBy(desc(ordersTable.createdAt));

  const items = rows.map((order) => ({
    orderRef: order.orderRef,
    tenantId: order.tenantId,
    itemId: order.itemId,
    snapshotTitle: order.snapshotTitle,
    snapshotPrice: order.snapshotPrice,
    snapshotPriceUnit: order.snapshotPriceUnit,
    snapshotFulfillment: order.snapshotFulfillment,
    snapshotProducerName: order.snapshotProducerName,
    qty: order.qty,
    guestName: order.guestName,
    guestPhone: order.guestPhone,
    guestUnit: order.guestUnit,
    guestNote: order.guestNote,
    status: order.status,
    statusNote: order.statusNote,
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
  }));

  res.json(ListDeviceOrdersResponse.parse(serialize(items)));
});

// ─── Admin: list tenant orders ─────────────────────────────────────────────────

router.get("/admin/tenants/:id/orders", requireAdmin, async (req, res): Promise<void> => {
  const tenantId = firstParam(req.params["id"]);

  const [tenant] = await db
    .select({ id: tenantsTable.id })
    .from(tenantsTable)
    .where(eq(tenantsTable.id, tenantId));
  if (!tenant) {
    res.status(404).json({ error: "Tenant not found" });
    return;
  }

  const statusFilter =
    typeof req.query["status"] === "string" ? req.query["status"] : undefined;
  const validStatuses = new Set(["novo", "potrjeno", "prevzeto", "zavrnjeno"]);

  const conditions = [
    eq(ordersTable.tenantId, tenantId),
    inArray(ordersTable.notificationStatus, ["sent", "skipped"]),
    gt(ordersTable.deleteAfter, new Date()),
  ];
  if (statusFilter && validStatuses.has(statusFilter)) {
    conditions.push(eq(ordersTable.status, statusFilter));
  }

  const rows = await db
    .select()
    .from(ordersTable)
    .where(and(...conditions))
    .orderBy(desc(ordersTable.createdAt));

  const items = rows.map((order) => ({
    orderRef: order.orderRef,
    tenantId: order.tenantId,
    itemId: order.itemId,
    snapshotTitle: order.snapshotTitle,
    snapshotPrice: order.snapshotPrice,
    snapshotPriceUnit: order.snapshotPriceUnit,
    snapshotFulfillment: order.snapshotFulfillment,
    snapshotProducerName: order.snapshotProducerName,
    snapshotTenantName: order.snapshotTenantName,
    qty: order.qty,
    guestName: order.guestName,
    guestPhone: order.guestPhone,
    guestUnit: order.guestUnit,
    guestNote: order.guestNote,
    status: order.status,
    statusNote: order.statusNote,
    notificationStatus: order.notificationStatus,
    notificationSentAt: order.notificationSentAt?.toISOString() ?? null,
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
    deleteAfter: order.deleteAfter.toISOString(),
  }));

  res.json(ListTenantOrdersResponse.parse(serialize(items)));
});

// ─── Admin: patch order status (race-safe) ────────────────────────────────────

router.patch("/admin/orders/:orderRef/status", requireAdmin, async (req, res): Promise<void> => {
  const orderRef = firstParam(req.params["orderRef"]);

  const parsed = UpdateOrderStatusBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { status: toStatus } = parsed.data;
  const statusNote = parsed.data.statusNote?.trim() || null;
  if (statusNote && statusNote.length > STATUS_NOTE_MAX) {
    res.status(400).json({ error: `statusNote max ${STATUS_NOTE_MAX}` });
    return;
  }

  // Must be a sent (visible) and non-expired order
  const [order] = await db
    .select()
    .from(ordersTable)
    .where(
      and(
        eq(ordersTable.orderRef, orderRef),
        inArray(ordersTable.notificationStatus, ["sent", "skipped"]),
        gt(ordersTable.deleteAfter, new Date()),
      ),
    );

  if (!order) {
    res.status(404).json({ error: "Order not found" });
    return;
  }

  if (!isAllowedTransition(order.status, toStatus)) {
    res.status(400).json({
      error: `Cannot transition from '${order.status}' to '${toStatus}'`,
    });
    return;
  }

  // Race-safe: WHERE orderRef AND current status = expectedFrom
  const [updated] = await db.transaction(async (tx) => {
    const changed = await tx
      .update(ordersTable)
      .set({ status: toStatus, statusNote, updatedAt: new Date() })
      .where(
        and(
          eq(ordersTable.orderRef, orderRef),
          eq(ordersTable.status, order.status), // optimistic lock
        ),
      )
      .returning();
    if (changed[0]) {
      await tx
        .update(tenantsTable)
        .set({ hasUnpublishedChanges: true })
        .where(eq(tenantsTable.id, changed[0].tenantId));
    }
    return changed;
  });

  if (!updated) {
    // Concurrent update won — re-read current state and report
    const [current] = await db
      .select()
      .from(ordersTable)
      .where(eq(ordersTable.orderRef, orderRef));
    if (current) {
      res.status(400).json({
        error: `Status was concurrently updated to '${current.status}'; transition to '${toStatus}' is no longer valid`,
      });
    } else {
      res.status(404).json({ error: "Order not found" });
    }
    return;
  }

  logger.info({ orderRef, fromStatus: order.status, toStatus }, "[orders] status updated");
  await logChange({
    tenantId: updated.tenantId,
    action: "update",
    entity: "order-status",
    summary: orderStatusSummary(updated.orderRef, toStatus),
  });
  res.json(formatOrderAdmin(updated));
});

export default router;
