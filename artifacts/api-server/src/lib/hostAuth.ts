import crypto from "node:crypto";
import type { Request, Response } from "express";
import { hash as argonHash, verify as argonVerify } from "@node-rs/argon2";
import {
  db,
  hostUsersTable,
  hostMembershipsTable,
  hostSessionsTable,
  hostPasswordResetsTable,
  hostAuthEventsTable,
  tenantsTable,
  type HostUser,
} from "@workspace/db";
import { and, eq, gt, isNull, sql } from "drizzle-orm";

/**
 * Host account authentication (Instruction #28, CHECKPOINT 2).
 *
 * - Argon2id, m=64 MiB, t=3, p=1 (OWASP-recommended profile; the library and
 *   algorithm are the same ones already used for the owner's recovery codes).
 * - Sessions mirror the owner's proven pattern: raw 256-bit token only in the
 *   __Host- cookie, SHA-256 hash in the DB, revocable server-side.
 * - NO hard account lockout (approved CP1 follow-up #2): a stranger who knows
 *   a host's e-mail must not be able to lock the host out. Instead:
 *     per-IP process-local throttle (10 failures / 15 min), plus
 *     per-ACCOUNT capped exponential backoff stored in the DB (cross-instance):
 *     after the 3rd consecutive failure 1 s, then 2 s, 4 s … capped at 60 s.
 *   The legitimate host is never delayed more than 60 seconds; an attacker is
 *   serialized to ~1 guess/minute/account no matter how many IPs they use.
 */

export const HOST_SESSION_COOKIE = "__Host-s360_host";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const RESET_TTL_MS = 60 * 60 * 1000; // 60 minutes, single use

export const ARGON2ID_PARAMS = {
  algorithm: 2, // Argon2id
  memoryCost: 65536, // 64 MiB
  timeCost: 3,
  parallelism: 1,
} as const;

export const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_LENGTH = 200;

export function validateNewPassword(pw: unknown): { ok: true; value: string } | { ok: false; error: string } {
  if (typeof pw !== "string") return { ok: false, error: "Geslo manjka." };
  if (pw.length < PASSWORD_MIN_LENGTH)
    return { ok: false, error: `Geslo mora imeti vsaj ${PASSWORD_MIN_LENGTH} znakov.` };
  if (pw.length > PASSWORD_MAX_LENGTH) return { ok: false, error: "Geslo je predolgo." };
  return { ok: true, value: pw };
}

export function normalizeEmail(email: unknown): string | null {
  if (typeof email !== "string") return null;
  const v = email.trim().toLowerCase();
  if (v.length < 5 || v.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return null;
  return v;
}

function sha256(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export async function hashPassword(password: string): Promise<string> {
  return argonHash(password, ARGON2ID_PARAMS);
}

// Verified against when the account does not exist or has no password yet, so
// the request costs the same time either way (no user enumeration by timing).
let dummyHashPromise: Promise<string> | null = null;
function dummyHash(): Promise<string> {
  dummyHashPromise ??= argonHash(crypto.randomBytes(32).toString("hex"), ARGON2ID_PARAMS);
  return dummyHashPromise;
}

// ---------- Per-IP throttle (process-local, same pattern as owner login) ----------

const ipAttempts = new Map<string, { count: number; resetAt: number }>();
export function hostLoginIpLimited(ip: string, record = true): boolean {
  const now = Date.now();
  const entry = ipAttempts.get(ip);
  if (!entry || entry.resetAt < now) {
    if (record) ipAttempts.set(ip, { count: 1, resetAt: now + 15 * 60 * 1000 });
    return false;
  }
  if (entry.count >= 10) return true;
  if (record) entry.count += 1;
  return false;
}

const resetIpAttempts = new Map<string, { count: number; resetAt: number }>();
function resetRequestIpLimited(ip: string): boolean {
  const now = Date.now();
  const entry = resetIpAttempts.get(ip);
  if (!entry || entry.resetAt < now) {
    resetIpAttempts.set(ip, { count: 1, resetAt: now + 60 * 60 * 1000 });
    return false;
  }
  if (entry.count >= 5) return true;
  entry.count += 1;
  return false;
}

/** Test hook: clears process-local limiter state. */
export function _clearHostRateLimiters(): void {
  ipAttempts.clear();
  resetIpAttempts.clear();
}

// ---------- Per-account capped exponential backoff ----------

export function backoffDelayMs(consecutiveFailures: number): number {
  if (consecutiveFailures < 3) return 0;
  return Math.min(2 ** (consecutiveFailures - 3), 60) * 1000;
}

function backoffActive(user: HostUser, now: number): boolean {
  if (!user.lastFailedAt) return false;
  return now < user.lastFailedAt.getTime() + backoffDelayMs(user.failedLoginCount);
}

// ---------- Audit ----------

async function audit(
  type: string,
  hostUserId: string | null,
  req: Request | null,
  detail?: string,
): Promise<void> {
  await db.insert(hostAuthEventsTable).values({
    hostUserId,
    type,
    detail: detail ?? null,
    ip: req?.ip ?? null,
    userAgent: req?.get("user-agent") ?? null,
  });
}

// ---------- Sessions ----------

async function createHostSession(hostUserId: string, req: Request, res: Response): Promise<void> {
  const token = crypto.randomBytes(32).toString("base64url");
  await db.insert(hostSessionsTable).values({
    hostUserId,
    tokenHash: sha256(token),
    ip: req.ip ?? null,
    userAgent: req.get("user-agent") ?? null,
    expiresAt: new Date(Date.now() + SESSION_TTL_MS),
  });
  res.cookie(HOST_SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "strict",
    secure: true,
    maxAge: SESSION_TTL_MS,
    path: "/",
  });
}

export type HostActorRow = {
  hostUserId: string;
  tenantId: string;
  email: string;
  sessionId: string;
};

export async function findHostActor(req: Request): Promise<HostActorRow | null> {
  const cookies = (req as Request & { cookies?: Record<string, string> }).cookies;
  const token = cookies?.[HOST_SESSION_COOKIE];
  if (!token) return null;
  const [row] = await db
    .select({
      sessionId: hostSessionsTable.id,
      expiresAt: hostSessionsTable.expiresAt,
      hostUserId: hostUsersTable.id,
      email: hostUsersTable.email,
      tenantId: hostMembershipsTable.tenantId,
    })
    .from(hostSessionsTable)
    .innerJoin(hostUsersTable, eq(hostUsersTable.id, hostSessionsTable.hostUserId))
    .innerJoin(hostMembershipsTable, eq(hostMembershipsTable.hostUserId, hostUsersTable.id))
    .where(eq(hostSessionsTable.tokenHash, sha256(token)))
    .limit(1);
  if (!row || row.expiresAt.getTime() <= Date.now()) return null;
  return {
    hostUserId: row.hostUserId,
    tenantId: row.tenantId,
    email: row.email,
    sessionId: row.sessionId,
  };
}

export async function destroyHostSession(req: Request, res: Response): Promise<void> {
  const actor = await findHostActor(req);
  if (actor) {
    await db.delete(hostSessionsTable).where(eq(hostSessionsTable.id, actor.sessionId));
    await audit("logout", actor.hostUserId, req);
  }
  res.clearCookie(HOST_SESSION_COOKIE, { path: "/" });
}

// ---------- Login ----------

export type LoginResult =
  | { ok: true; tenantId: string; email: string }
  | { ok: false; status: 401 | 429 };

export async function loginHost(
  emailRaw: unknown,
  passwordRaw: unknown,
  req: Request,
  res: Response,
): Promise<LoginResult> {
  const ip = req.ip ?? "unknown";
  if (hostLoginIpLimited(ip)) return { ok: false, status: 429 };
  const email = normalizeEmail(emailRaw);
  const password = typeof passwordRaw === "string" ? passwordRaw : "";
  if (!email || !password) {
    await argonVerify(await dummyHash(), password || "x").catch(() => false);
    return { ok: false, status: 401 };
  }
  const [row] = await db
    .select({
      user: hostUsersTable,
      tenantId: hostMembershipsTable.tenantId,
    })
    .from(hostUsersTable)
    .innerJoin(hostMembershipsTable, eq(hostMembershipsTable.hostUserId, hostUsersTable.id))
    .where(eq(hostUsersTable.email, email))
    .limit(1);
  if (!row || !row.user.passwordHash) {
    await argonVerify(await dummyHash(), password).catch(() => false);
    return { ok: false, status: 401 };
  }
  const now = Date.now();
  if (backoffActive(row.user, now)) {
    // Deliberately NOT counted as a failure: early retries must not be able
    // to stretch the window (that would be the lockout DoS we rejected).
    return { ok: false, status: 401 };
  }
  let verified = false;
  try {
    verified = await argonVerify(row.user.passwordHash, password);
  } catch {
    verified = false;
  }
  if (!verified) {
    await db
      .update(hostUsersTable)
      .set({
        failedLoginCount: sql`${hostUsersTable.failedLoginCount} + 1`,
        lastFailedAt: new Date(),
      })
      .where(eq(hostUsersTable.id, row.user.id));
    await audit("login_failed", row.user.id, req);
    return { ok: false, status: 401 };
  }
  await db
    .update(hostUsersTable)
    .set({ failedLoginCount: 0, lastFailedAt: null, lastLoginAt: new Date() })
    .where(eq(hostUsersTable.id, row.user.id));
  await createHostSession(row.user.id, req, res);
  await audit("login", row.user.id, req);
  return { ok: true, tenantId: row.tenantId, email };
}

// ---------- Password change (authenticated host) ----------

export async function changeHostPassword(
  actor: HostActorRow,
  currentRaw: unknown,
  nextRaw: unknown,
  req: Request,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const next = validateNewPassword(nextRaw);
  if (!next.ok) return { ok: false, error: next.error };
  const [user] = await db
    .select()
    .from(hostUsersTable)
    .where(eq(hostUsersTable.id, actor.hostUserId))
    .limit(1);
  if (!user?.passwordHash) return { ok: false, error: "Trenutno geslo ni nastavljeno." };
  const current = typeof currentRaw === "string" ? currentRaw : "";
  let verified = false;
  try {
    verified = await argonVerify(user.passwordHash, current);
  } catch {
    verified = false;
  }
  if (!verified) return { ok: false, error: "Trenutno geslo ni pravilno." };
  const newHash = await hashPassword(next.value);
  // One atomic step, CONDITIONAL on the hash we just verified: if a reset (or
  // another change) rewrote the password in the meantime, this writes nothing
  // — a stale session can never reinstate its own password after a reset.
  const changed = await db.transaction(async (tx) => {
    const updated = await tx
      .update(hostUsersTable)
      .set({ passwordHash: newHash, passwordChangedAt: new Date() })
      .where(
        and(
          eq(hostUsersTable.id, user.id),
          eq(hostUsersTable.passwordHash, user.passwordHash!),
        ),
      )
      .returning({ id: hostUsersTable.id });
    if (updated.length === 0) return false;
    // Everyone else is signed out; the session that changed the password stays.
    await tx
      .delete(hostSessionsTable)
      .where(
        and(
          eq(hostSessionsTable.hostUserId, user.id),
          sql`${hostSessionsTable.id} <> ${actor.sessionId}`,
        ),
      );
    return true;
  });
  if (!changed) return { ok: false, error: "Geslo se je medtem spremenilo. Prijavite se znova." };
  await audit("password_changed", user.id, req);
  return { ok: true };
}

// ---------- Password reset (self-service, single-use, 60 min) ----------

export type ResetIssue = { token: string; hostUserId: string; email: string } | null;

/**
 * Issues a reset token when the account exists and limits allow it. ALWAYS
 * returns without revealing whether the account exists — callers must respond
 * uniformly. DB-backed per-account limit (3/hour) holds across instances.
 */
export async function issueHostPasswordReset(emailRaw: unknown, req: Request | null): Promise<ResetIssue> {
  const email = normalizeEmail(emailRaw);
  if (!email) return null;
  if (req && resetRequestIpLimited(req.ip ?? "unknown")) return null;
  const token = crypto.randomBytes(32).toString("base64url");
  // The 3/hour quota is reserved TRANSACTIONALLY: the account row is locked,
  // so concurrent requests serialize and cannot each pass a stale count.
  return db.transaction(async (tx) => {
    const [user] = await tx
      .select()
      .from(hostUsersTable)
      .where(eq(hostUsersTable.email, email))
      .limit(1)
      .for("update");
    if (!user) return null;
    const since = new Date(Date.now() - 60 * 60 * 1000);
    const recent = await tx
      .select({ id: hostAuthEventsTable.id })
      .from(hostAuthEventsTable)
      .where(
        and(
          eq(hostAuthEventsTable.type, "reset_requested"),
          eq(hostAuthEventsTable.hostUserId, user.id),
          gt(hostAuthEventsTable.createdAt, since),
        ),
      );
    if (recent.length >= 3) return null;
    await tx.insert(hostPasswordResetsTable).values({
      hostUserId: user.id,
      tokenHash: sha256(token),
      expiresAt: new Date(Date.now() + RESET_TTL_MS),
    });
    // The audit row IS the quota counter — it must commit with the token.
    await tx.insert(hostAuthEventsTable).values({
      hostUserId: user.id,
      type: "reset_requested",
      detail: null,
      ip: req?.ip ?? null,
      userAgent: req?.get("user-agent") ?? null,
    });
    return { token, hostUserId: user.id, email: user.email };
  });
}

export async function consumeHostPasswordReset(
  tokenRaw: unknown,
  passwordRaw: unknown,
  req: Request | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const next = validateNewPassword(passwordRaw);
  if (!next.ok) return { ok: false, error: next.error };
  const token = typeof tokenRaw === "string" ? tokenRaw.trim() : "";
  if (token.length < 20) return { ok: false, error: "Povezava ni veljavna ali je potekla." };
  const newHash = await hashPassword(next.value);
  // ONE transaction: burn the token, set the password and revoke every
  // session together. Either the reset fully happens or the token stays
  // valid — no half-state where the token is burned but nothing changed.
  const burnedUserId = await db.transaction(async (tx) => {
    // Atomic single use: two racing submissions cannot both pass this UPDATE.
    const [burned] = await tx
      .update(hostPasswordResetsTable)
      .set({ usedAt: new Date() })
      .where(
        and(
          eq(hostPasswordResetsTable.tokenHash, sha256(token)),
          isNull(hostPasswordResetsTable.usedAt),
          gt(hostPasswordResetsTable.expiresAt, new Date()),
        ),
      )
      .returning();
    if (!burned) return null;
    await tx
      .update(hostUsersTable)
      .set({
        passwordHash: newHash,
        passwordChangedAt: new Date(),
        failedLoginCount: 0,
        lastFailedAt: null,
      })
      .where(eq(hostUsersTable.id, burned.hostUserId));
    // A reset proves control of the mailbox, not of existing sessions: sign out everything.
    await tx
      .delete(hostSessionsTable)
      .where(eq(hostSessionsTable.hostUserId, burned.hostUserId));
    return burned.hostUserId;
  });
  if (!burnedUserId) return { ok: false, error: "Povezava ni veljavna ali je potekla." };
  await audit("reset_completed", burnedUserId, req);
  return { ok: true };
}

// ---------- Owner-side account management (never touches passwords) ----------

export type HostAccountView = {
  email: string;
  hasPassword: boolean;
  lastLoginAt: string | null;
  createdAt: string;
};

export async function getHostAccountForTenant(tenantId: string): Promise<HostAccountView | null> {
  const [row] = await db
    .select({ user: hostUsersTable })
    .from(hostMembershipsTable)
    .innerJoin(hostUsersTable, eq(hostUsersTable.id, hostMembershipsTable.hostUserId))
    .where(eq(hostMembershipsTable.tenantId, tenantId))
    .limit(1);
  if (!row) return null;
  return {
    email: row.user.email,
    hasPassword: !!row.user.passwordHash,
    lastLoginAt: row.user.lastLoginAt?.toISOString() ?? null,
    createdAt: row.user.createdAt.toISOString(),
  };
}

export async function upsertHostAccountForTenant(
  tenantId: string,
  emailRaw: unknown,
  req: Request | null,
): Promise<{ ok: true; created: boolean; email: string } | { ok: false; status: number; error: string }> {
  const email = normalizeEmail(emailRaw);
  if (!email) return { ok: false, status: 400, error: "Neveljaven e-naslov." };
  const [tenant] = await db
    .select({ id: tenantsTable.id })
    .from(tenantsTable)
    .where(eq(tenantsTable.id, tenantId))
    .limit(1);
  if (!tenant) return { ok: false, status: 404, error: "Not found" };
  const [taken] = await db
    .select({ id: hostUsersTable.id })
    .from(hostUsersTable)
    .where(eq(hostUsersTable.email, email))
    .limit(1);
  const [membership] = await db
    .select()
    .from(hostMembershipsTable)
    .where(eq(hostMembershipsTable.tenantId, tenantId))
    .limit(1);
  if (membership) {
    if (taken && taken.id !== membership.hostUserId) {
      return { ok: false, status: 409, error: "Ta e-naslov že uporablja drug račun." };
    }
    await db
      .update(hostUsersTable)
      .set({ email })
      .where(eq(hostUsersTable.id, membership.hostUserId));
    await audit("email_changed", membership.hostUserId, req, email);
    return { ok: true, created: false, email };
  }
  if (taken) {
    // The account exists for ANOTHER tenant. One tenant per account is the
    // current product rule (host_memberships_user_unique) — adding a second
    // membership row is the approved future multi-property path, not today's.
    return { ok: false, status: 409, error: "Ta e-naslov že uporablja drug račun." };
  }
  const [user] = await db
    .insert(hostUsersTable)
    .values({ email, passwordHash: null })
    .returning();
  await db.insert(hostMembershipsTable).values({ hostUserId: user!.id, tenantId });
  await audit("account_created", user!.id, req, email);
  return { ok: true, created: true, email };
}
