import crypto from "node:crypto";
import type { Request, Response, NextFunction } from "express";
import { hash as argonHash, verify as argonVerify } from "@node-rs/argon2";
import {
  db,
  adminUsersTable,
  adminSessionsTable,
  adminCredentialsTable,
  adminRecoveryCodesTable,
  adminEnrollTokensTable,
  adminChallengesTable,
  adminAuthEventsTable,
  type AdminUser,
  type AdminCredential,
} from "@workspace/db";
import { eq, lt, and, isNull, gt, desc, sql } from "drizzle-orm";

const SESSION_COOKIE = "__Host-s360_admin";
export { SESSION_COOKIE };
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const ENROLL_TTL_MS = 15 * 60 * 1000; // 15 minutes
const CHALLENGE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export const ADMIN_EMAIL = "pi4.doo@gmail.com";

const ARGON2ID = { algorithm: 2 } as const; // argon2id

function sha256(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

// ---------- Relying party configuration ----------

export function rpID(): string {
  // Deployed production (REPLIT_DEPLOYMENT set): ALWAYS the configured RP_ID —
  // deployments also expose a per-publish REPLIT_DEV_DOMAIN, which must be
  // ignored there. Development container: ALWAYS the dev domain, because the
  // configured RP_ID/RP_ORIGIN hold production values (smart360.info) and
  // honouring them in dev would break dev passkeys. RP_ID must be a
  // registrable suffix of the origin the browser is on.
  const deployed = !!process.env["REPLIT_DEPLOYMENT"];
  const dev = process.env["REPLIT_DEV_DOMAIN"];
  if (!deployed && dev) return dev;
  const configured = process.env["RP_ID"];
  if (configured) return configured;
  if (dev) return dev;
  throw new Error("RP_ID must be set");
}

export function rpOrigin(): string {
  // Mirror rpID(): configured value wins in deployments, dev domain wins in
  // the development container.
  const deployed = !!process.env["REPLIT_DEPLOYMENT"];
  const dev = process.env["REPLIT_DEV_DOMAIN"];
  if (!deployed && dev) return `https://${dev}`;
  const configured = process.env["RP_ORIGIN"];
  if (configured) return configured;
  return `https://${rpID()}`;
}

// ---------- Admin account ----------

export async function ensureAdminAccount(): Promise<void> {
  // The app has exactly one operator identity. Seed only an empty table:
  // changing ADMIN_EMAIL must never create a second operator beside the
  // existing account. ON CONFLICT also makes concurrent empty-table starts
  // harmless when both try to insert the same configured address.
  await db.execute(sql`
    INSERT INTO ${adminUsersTable} ("email", "display_name")
    SELECT ${ADMIN_EMAIL}, 'Upravitelj'
    WHERE NOT EXISTS (SELECT 1 FROM ${adminUsersTable})
    ON CONFLICT DO NOTHING
  `);
}

export async function getAdminUser(): Promise<AdminUser | undefined> {
  const [user] = await db.select().from(adminUsersTable).limit(1);
  return user;
}

// ---------- Credentials ----------

export async function listCredentials(): Promise<AdminCredential[]> {
  return db
    .select()
    .from(adminCredentialsTable)
    .orderBy(desc(adminCredentialsTable.createdAt));
}

export async function countUnusedRecoveryCodes(): Promise<number> {
  const rows = await db
    .select({ id: adminRecoveryCodesTable.id })
    .from(adminRecoveryCodesTable)
    .where(isNull(adminRecoveryCodesTable.usedAt));
  return rows.length;
}

// ---------- Recovery codes ----------

export function generateRecoveryCode(): string {
  // Format: XXXX-XXXX-XXXX (base32-like, unambiguous alphabet)
  const alphabet = "ABCDEFGHJKMNPQRSTVWXYZ23456789";
  const pick = () => alphabet[crypto.randomInt(alphabet.length)];
  const group = () => Array.from({ length: 4 }, pick).join("");
  return `${group()}-${group()}-${group()}`;
}

// Advisory-lock keys serialize security-critical writes across instances.
const LOCK_RECOVERY_ROTATE = 729401;
const LOCK_RECOVERY_ATTEMPT = 729402;

export async function issueRecoveryCodes(count = 10): Promise<string[]> {
  const codes = Array.from({ length: count }, generateRecoveryCode);
  const hashes = await Promise.all(
    codes.map((code) => argonHash(normalizeRecoveryCode(code), ARGON2ID)),
  );
  // Atomic replace: delete + insert under one transaction and an advisory
  // lock, so concurrent rotations serialize and exactly one set is active.
  // Codes are returned only after the commit.
  await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(${LOCK_RECOVERY_ROTATE})`);
    await tx.delete(adminRecoveryCodesTable);
    await tx.insert(adminRecoveryCodesTable).values(hashes.map((codeHash) => ({ codeHash })));
  });
  return codes;
}

function normalizeRecoveryCode(code: string): string {
  return code.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** Verifies and burns a recovery code. Returns true when a code matched. */
export async function consumeRecoveryCode(code: string): Promise<boolean> {
  const normalized = normalizeRecoveryCode(code);
  if (normalized.length < 8) return false;
  const rows = await db
    .select()
    .from(adminRecoveryCodesTable)
    .where(isNull(adminRecoveryCodesTable.usedAt));
  for (const row of rows) {
    let ok = false;
    try {
      ok = await argonVerify(row.codeHash, normalized);
    } catch {
      ok = false;
    }
    if (ok) {
      const [burned] = await db
        .update(adminRecoveryCodesTable)
        .set({ usedAt: new Date() })
        .where(
          and(
            eq(adminRecoveryCodesTable.id, row.id),
            isNull(adminRecoveryCodesTable.usedAt),
          ),
        )
        .returning();
      return !!burned;
    }
  }
  return false;
}

// ---------- Enrolment tokens (single-use, 15 minutes) ----------

export async function createEnrollToken(source: "shell" | "recovery"): Promise<string> {
  const token = crypto.randomBytes(32).toString("base64url");
  await db.insert(adminEnrollTokensTable).values({
    tokenHash: sha256(token),
    source,
    expiresAt: new Date(Date.now() + ENROLL_TTL_MS),
  });
  await db
    .delete(adminEnrollTokensTable)
    .where(lt(adminEnrollTokensTable.expiresAt, new Date()));
  return token;
}

/** Checks the token is valid without burning it (burn happens on successful registration). */
export async function isEnrollTokenValid(token: string): Promise<boolean> {
  const [row] = await db
    .select()
    .from(adminEnrollTokensTable)
    .where(
      and(
        eq(adminEnrollTokensTable.tokenHash, sha256(token)),
        isNull(adminEnrollTokensTable.usedAt),
        gt(adminEnrollTokensTable.expiresAt, new Date()),
      ),
    )
    .limit(1);
  return !!row;
}

/** Atomically burns a valid enroll token. Returns its source, or null. */
export async function consumeEnrollToken(token: string): Promise<"shell" | "recovery" | null> {
  const [row] = await db
    .update(adminEnrollTokensTable)
    .set({ usedAt: new Date() })
    .where(
      and(
        eq(adminEnrollTokensTable.tokenHash, sha256(token)),
        isNull(adminEnrollTokensTable.usedAt),
        gt(adminEnrollTokensTable.expiresAt, new Date()),
      ),
    )
    .returning();
  return row ? (row.source as "shell" | "recovery") : null;
}

// ---------- WebAuthn challenges (DB-backed, single use) ----------

export async function storeChallenge(
  type: "registration" | "authentication",
  challenge: string,
  context?: string,
): Promise<string> {
  const [row] = await db
    .insert(adminChallengesTable)
    .values({
      type,
      challenge,
      context: context ?? null,
      expiresAt: new Date(Date.now() + CHALLENGE_TTL_MS),
    })
    .returning();
  await db
    .delete(adminChallengesTable)
    .where(lt(adminChallengesTable.expiresAt, new Date()));
  return row!.id;
}

/** Atomically consumes a challenge by id. Returns { challenge, context } or null. */
export async function consumeChallenge(
  id: string,
  type: "registration" | "authentication",
): Promise<{ challenge: string; context: string | null } | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [row] = await db
    .delete(adminChallengesTable)
    .where(
      and(
        eq(adminChallengesTable.id, id),
        eq(adminChallengesTable.type, type),
        gt(adminChallengesTable.expiresAt, new Date()),
      ),
    )
    .returning();
  return row ? { challenge: row.challenge, context: row.context } : null;
}

// ---------- Sessions (server-side, revocable) ----------

export async function createSession(req: Request, res: Response): Promise<void> {
  const token = crypto.randomBytes(32).toString("base64url");
  await db.insert(adminSessionsTable).values({
    tokenHash: sha256(token),
    ip: req.ip ?? null,
    userAgent: req.get("user-agent") ?? null,
    expiresAt: new Date(Date.now() + SESSION_TTL_MS),
  });
  // __Host- prefix requires Secure + Path=/ + no Domain; the preview/prod are always HTTPS.
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "strict",
    secure: true,
    maxAge: SESSION_TTL_MS,
    path: "/",
  });
}

async function findSessionId(req: Request): Promise<string | null> {
  const cookies = (req as Request & { cookies?: Record<string, string> }).cookies;
  const token = cookies?.[SESSION_COOKIE];
  if (!token) return null;
  const [session] = await db
    .select()
    .from(adminSessionsTable)
    .where(eq(adminSessionsTable.tokenHash, sha256(token)))
    .limit(1);
  if (!session || session.expiresAt.getTime() <= Date.now()) return null;
  return session.id;
}

export async function isAuthenticated(req: Request): Promise<boolean> {
  return (await findSessionId(req)) !== null;
}

export async function destroyCurrentSession(req: Request, res: Response): Promise<void> {
  const id = await findSessionId(req);
  if (id) await db.delete(adminSessionsTable).where(eq(adminSessionsTable.id, id));
  res.clearCookie(SESSION_COOKIE, { path: "/" });
}

export async function revokeAllSessions(): Promise<void> {
  await db.delete(adminSessionsTable);
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  // The central admin gate (lib/actorGate.ts) resolves the actor — owner or
  // host — for every /admin request before any router runs, enforces the
  // deny-by-default fence for hosts, and opens the tenant-scoped DB context.
  // By the time a handler runs, "is authenticated" simply means "the gate
  // pinned an actor"; tenant scoping is the gate's and RLS's job, not this
  // function's.
  if (req.actor) {
    next();
    return;
  }
  res.status(401).json({ error: "Not authenticated" });
}

// ---------- Audit log ----------

export async function logAuthEvent(
  req: Request,
  type: string,
  detail?: string,
): Promise<void> {
  await db.insert(adminAuthEventsTable).values({
    type,
    detail: detail ?? null,
    ip: req.ip ?? null,
    userAgent: req.get("user-agent") ?? null,
  });
}

// ---------- Rate limiting (in-memory) ----------

const attempts = new Map<string, { count: number; resetAt: number }>();

function limited(key: string, max: number, windowMs: number, record: boolean): boolean {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || entry.resetAt < now) {
    if (record) attempts.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }
  if (entry.count >= max) return true;
  if (record) entry.count += 1;
  return false;
}

/** Login: 10 attempts / 15 minutes per IP. Only verify attempts count. */
export function loginRateLimited(ip: string, record = true): boolean {
  return limited(`login:${ip}`, 10, 15 * 60 * 1000, record);
}

/**
 * Recovery codes: max 5 real attempts per hour, per IP AND per account
 * (single-admin app, so the global count is the per-account count).
 *
 * Atomic + fail-closed: the whole check-and-reserve runs in one transaction
 * under an advisory lock, and the attempt row is inserted pessimistically as
 * "failure" BEFORE code verification — a concurrent burst cannot slip past
 * the limit, and an audit-write failure denies the attempt (the route 500s).
 * Blocked requests are audited too, but throttled (max one "rate_limited"
 * event per 10 minutes) so an attacker cannot flood the audit table.
 */
export async function recordRecoveryAttempt(
  ip: string,
  userAgent: string | null,
): Promise<{ allowed: boolean; attemptId: string | null }> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(${LOCK_RECOVERY_ATTEMPT})`);
    const since = new Date(Date.now() - 60 * 60 * 1000);
    const rows = await tx
      .select({
        ip: adminAuthEventsTable.ip,
        detail: adminAuthEventsTable.detail,
        createdAt: adminAuthEventsTable.createdAt,
      })
      .from(adminAuthEventsTable)
      .where(
        and(
          eq(adminAuthEventsTable.type, "recovery_attempt"),
          gt(adminAuthEventsTable.createdAt, since),
        ),
      );
    const real = rows.filter((r) => r.detail === "success" || r.detail === "failure");
    const limited = real.length >= 5 || real.filter((r) => r.ip === ip).length >= 5;
    if (limited) {
      const throttle = new Date(Date.now() - 10 * 60 * 1000);
      const recentlyLogged = rows.some(
        (r) => r.detail === "rate_limited" && r.createdAt > throttle,
      );
      if (!recentlyLogged) {
        await tx
          .insert(adminAuthEventsTable)
          .values({ type: "recovery_attempt", detail: "rate_limited", ip, userAgent });
      }
      return { allowed: false, attemptId: null };
    }
    const [row] = await tx
      .insert(adminAuthEventsTable)
      .values({ type: "recovery_attempt", detail: "failure", ip, userAgent })
      .returning();
    return { allowed: true, attemptId: row!.id };
  });
}

/** Flips a reserved attempt to success after the code actually matched. */
export async function markRecoveryAttemptSuccess(attemptId: string): Promise<void> {
  await db
    .update(adminAuthEventsTable)
    .set({ detail: "success" })
    .where(eq(adminAuthEventsTable.id, attemptId));
}

/** Counts for the admin UI — never the values. */
export async function recoveryCodeCounts(): Promise<{ active: number; consumed: number }> {
  const rows = await db
    .select({ usedAt: adminRecoveryCodesTable.usedAt })
    .from(adminRecoveryCodesTable);
  const consumed = rows.filter((r) => r.usedAt !== null).length;
  return { active: rows.length - consumed, consumed };
}
