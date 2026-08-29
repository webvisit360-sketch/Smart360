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
  adminPasswordCredentialsTable,
  adminPasswordStateTable,
  type AdminUser,
  type AdminCredential,
} from "@workspace/db";
import { eq, lt, and, isNull, gt, desc, sql } from "drizzle-orm";

const SESSION_COOKIE = "__Host-s360_admin";
export { SESSION_COOKIE };
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const ENROLL_TTL_MS = 15 * 60 * 1000; // 15 minutes
const CHALLENGE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export const ADMIN_EMAIL = "smart360hq@gmail.com";

const ARGON2ID = { algorithm: 2 } as const; // argon2id
export const ADMIN_ARGON2ID_PARAMS = {
  algorithm: 2,
  memoryCost: 65536,
  timeCost: 3,
  parallelism: 1,
} as const;
export const ADMIN_PASSWORD_MIN_LENGTH = 12;
const ADMIN_PASSWORD_MAX_LENGTH = 200;

function sha256(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function validateAdminPassword(
  value: unknown,
): { ok: true; value: string } | { ok: false; error: string } {
  if (typeof value !== "string") return { ok: false, error: "Vnesite novo geslo." };
  if (value.length < ADMIN_PASSWORD_MIN_LENGTH) {
    return {
      ok: false,
      error: `Geslo mora imeti vsaj ${ADMIN_PASSWORD_MIN_LENGTH} znakov.`,
    };
  }
  if (value.length > ADMIN_PASSWORD_MAX_LENGTH) {
    return { ok: false, error: "Geslo je predolgo." };
  }
  return { ok: true, value };
}

export function adminPasswordBackoffMs(failures: number): number {
  if (failures < 3) return 0;
  return Math.min(2 ** (failures - 3), 60) * 1000;
}

export async function hashAdminPassword(password: string): Promise<string> {
  return argonHash(password, ADMIN_ARGON2ID_PARAMS);
}

// A valid hash with the exact production cost profile. It is not a credential;
// keeping it constant avoids making the first missing-account request pay an
// extra hash operation (which would itself create a timing distinction).
const DUMMY_PASSWORD_HASH =
  "$argon2id$v=19$m=65536,t=3,p=1$vxKAUGYBuC/qYkW24IboGQ$1Y0YPDKkV8EBvWrItesthHQFAR3+G0MnktDqridD/1Q";

type PasswordVerifier = (
  hash: string,
  password: string,
  dummy: boolean,
) => Promise<boolean>;
let passwordVerifierOverride: PasswordVerifier | null = null;
/** Test hook. Production always uses Argon2 verification. */
export function _setAdminPasswordVerifierOverride(fn: PasswordVerifier | null): void {
  passwordVerifierOverride = fn;
}

async function verifyPassword(hash: string, password: string, dummy: boolean): Promise<boolean> {
  if (passwordVerifierOverride) return passwordVerifierOverride(hash, password, dummy);
  try {
    return await argonVerify(hash, password);
  } catch {
    return false;
  }
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
const LOCK_ADMIN_SESSIONS = 729403;

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
  await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(${LOCK_ADMIN_SESSIONS})`);
    await tx.insert(adminSessionsTable).values({
      tokenHash: sha256(token),
      ip: req.ip ?? null,
      userAgent: req.get("user-agent") ?? null,
      expiresAt: new Date(Date.now() + SESSION_TTL_MS),
    });
  });
  setSessionCookie(res, token);
}

function setSessionCookie(res: Response, token: string): void {
  // __Host- prefix requires Secure + Path=/ + no Domain; the preview/prod are always HTTPS.
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "strict",
    secure: true,
    maxAge: SESSION_TTL_MS,
    path: "/",
  });
}

export async function findSessionId(req: Request): Promise<string | null> {
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

export async function countActiveSessions(): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(adminSessionsTable)
    .where(gt(adminSessionsTable.expiresAt, new Date()));
  return row?.count ?? 0;
}

export async function revokeAllSessions(): Promise<number> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(${LOCK_ADMIN_SESSIONS})`);
    const removed = await tx
      .delete(adminSessionsTable)
      .returning({
        active: sql<boolean>`${adminSessionsTable.expiresAt} > NOW()`,
      });
    return removed.filter((session) => session.active).length;
  });
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

// ---------- Operator password ----------

const LOCK_PASSWORD_LOGIN = 729403;
const passkeyAttempts = new Map<string, { count: number; resetAt: number }>();
/** Existing passkey ceremony throttle; password attempts use the DB path below. */
export function loginRateLimited(ip: string, record = true): boolean {
  const now = Date.now();
  const entry = passkeyAttempts.get(ip);
  if (!entry || entry.resetAt < now) {
    if (record) passkeyAttempts.set(ip, { count: 1, resetAt: now + 15 * 60 * 1000 });
    return false;
  }
  if (entry.count >= 10) return true;
  if (record) entry.count += 1;
  return false;
}

export type AdminPasswordLoginResult =
  | { ok: true }
  | { ok: false; status: 400 | 401 | 429; retryAfterSeconds?: number };

/**
 * Verifies the operator password under a cross-instance advisory lock.
 * The audit row pessimistically reserves the IP attempt before Argon2 runs, so
 * concurrent bursts cannot pass a stale quota check. Any DB/audit failure
 * aborts the request (fail closed).
 */
export async function loginAdminPassword(
  emailRaw: unknown,
  passwordRaw: unknown,
  req: Request,
  res: Response,
): Promise<AdminPasswordLoginResult> {
  const ip = req.ip ?? "unknown";
  const userAgent = req.get("user-agent") ?? null;
  const email = typeof emailRaw === "string" ? emailRaw.trim().toLowerCase() : "";
  const password = typeof passwordRaw === "string" ? passwordRaw : "";
  if (password.length > ADMIN_PASSWORD_MAX_LENGTH) {
    return { ok: false, status: 400 };
  }
  const token = crypto.randomBytes(32).toString("base64url");
  const result = await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(${LOCK_PASSWORD_LOGIN})`);
    await tx
      .insert(adminPasswordStateTable)
      .values({ singleton: true })
      .onConflictDoNothing();
    const [state] = await tx
      .select()
      .from(adminPasswordStateTable)
      .where(eq(adminPasswordStateTable.singleton, true))
      .limit(1)
      .for("update");
    if (!state) throw new Error("Operator password state unavailable");

    const delay = adminPasswordBackoffMs(state.failedLoginCount);
    const remaining = state.lastFailedAt
      ? state.lastFailedAt.getTime() + delay - Date.now()
      : 0;
    if (remaining > 0) {
      // Early retries do not verify, count as failures, or extend the delay.
      return {
        ok: false as const,
        status: 401 as const,
        retryAfterSeconds: Math.max(1, Math.ceil(remaining / 1000)),
      };
    }

    const since = new Date(Date.now() - 15 * 60 * 1000);
    const failures = await tx
      .select({ id: adminAuthEventsTable.id })
      .from(adminAuthEventsTable)
      .where(
        and(
          eq(adminAuthEventsTable.type, "password_login_attempt"),
          eq(adminAuthEventsTable.detail, "failure"),
          eq(adminAuthEventsTable.ip, ip),
          gt(adminAuthEventsTable.createdAt, since),
        ),
      );
    if (failures.length >= 5) {
      // Keep blocked attempts observable without allowing unauthenticated
      // callers to amplify the audit table indefinitely.
      const [recentLimited] = await tx
        .select({ id: adminAuthEventsTable.id })
        .from(adminAuthEventsTable)
        .where(
          and(
            eq(adminAuthEventsTable.type, "password_login_attempt"),
            eq(adminAuthEventsTable.detail, "rate_limited"),
            eq(adminAuthEventsTable.ip, ip),
            gt(adminAuthEventsTable.createdAt, new Date(Date.now() - 10 * 60 * 1000)),
          ),
        )
        .limit(1);
      if (!recentLimited) {
        await tx.insert(adminAuthEventsTable).values({
          type: "password_login_attempt",
          detail: "rate_limited",
          ip,
          userAgent,
        });
      }
      return { ok: false as const, status: 429 as const };
    }

    const [attempt] = await tx
      .insert(adminAuthEventsTable)
      .values({
        type: "password_login_attempt",
        detail: "failure",
        ip,
        userAgent,
      })
      .returning({ id: adminAuthEventsTable.id });
    if (!attempt) throw new Error("Password login attempt could not be reserved");

    const [credential] = await tx
      .select()
      .from(adminPasswordCredentialsTable)
      .where(eq(adminPasswordCredentialsTable.singleton, true))
      .limit(1);
    const useDummy = email !== ADMIN_EMAIL || !credential;
    const hash = useDummy ? DUMMY_PASSWORD_HASH : credential.passwordHash;
    const verified = await verifyPassword(hash, password || "x", useDummy);
    if (!verified || useDummy) {
      await tx
        .update(adminPasswordStateTable)
        .set({
          failedLoginCount: sql`${adminPasswordStateTable.failedLoginCount} + 1`,
          lastFailedAt: new Date(),
        })
        .where(eq(adminPasswordStateTable.singleton, true));
      return { ok: false as const, status: 401 as const };
    }

    await tx
      .update(adminAuthEventsTable)
      .set({ detail: "success" })
      .where(eq(adminAuthEventsTable.id, attempt.id));
    await tx
      .update(adminPasswordStateTable)
      .set({ failedLoginCount: 0, lastFailedAt: null })
      .where(eq(adminPasswordStateTable.singleton, true));
    await tx.execute(sql`SELECT pg_advisory_xact_lock(${LOCK_ADMIN_SESSIONS})`);
    await tx.insert(adminSessionsTable).values({
      tokenHash: sha256(token),
      ip,
      userAgent,
      expiresAt: new Date(Date.now() + SESSION_TTL_MS),
    });
    return { ok: true as const };
  });
  if (result.ok) setSessionCookie(res, token);
  return result;
}

export async function adminPasswordStatus(): Promise<{ hasPassword: boolean }> {
  const [row] = await db
    .select({ singleton: adminPasswordCredentialsTable.singleton })
    .from(adminPasswordCredentialsTable)
    .where(eq(adminPasswordCredentialsTable.singleton, true))
    .limit(1);
  return { hasPassword: !!row };
}

export async function setOrChangeAdminPassword(
  currentRaw: unknown,
  nextRaw: unknown,
  req: Request,
): Promise<{ ok: true; initial: boolean } | { ok: false; error: string }> {
  const next = validateAdminPassword(nextRaw);
  if (!next.ok) return next;
  const [credential] = await db
    .select()
    .from(adminPasswordCredentialsTable)
    .where(eq(adminPasswordCredentialsTable.singleton, true))
    .limit(1);
  if (credential) {
    const current = typeof currentRaw === "string" ? currentRaw : "";
    if (!(await verifyPassword(credential.passwordHash, current || "x", false))) {
      return { ok: false, error: "Trenutno geslo ni pravilno." };
    }
  }
  const newHash = await hashAdminPassword(next.value);
  const currentSessionId = await findSessionId(req);
  if (!currentSessionId) return { ok: false, error: "Prijavna seja je potekla. Prijavite se znova." };
  const changed = await db.transaction(async (tx) => {
    if (credential) {
      const rows = await tx
        .update(adminPasswordCredentialsTable)
        .set({ passwordHash: newHash, changedAt: new Date() })
        .where(
          and(
            eq(adminPasswordCredentialsTable.singleton, true),
            eq(adminPasswordCredentialsTable.passwordHash, credential.passwordHash),
          ),
        )
        .returning({ singleton: adminPasswordCredentialsTable.singleton });
      if (rows.length === 0) return false;
    } else {
      const rows = await tx
        .insert(adminPasswordCredentialsTable)
        .values({ singleton: true, passwordHash: newHash })
        .onConflictDoNothing()
        .returning({ singleton: adminPasswordCredentialsTable.singleton });
      if (rows.length === 0) return false;
    }
    await tx
      .insert(adminPasswordStateTable)
      .values({ singleton: true, failedLoginCount: 0, lastFailedAt: null })
      .onConflictDoUpdate({
        target: adminPasswordStateTable.singleton,
        set: { failedLoginCount: 0, lastFailedAt: null },
      });
    await tx
      .delete(adminSessionsTable)
      .where(sql`${adminSessionsTable.id} <> ${currentSessionId}`);
    await tx.insert(adminAuthEventsTable).values({
      type: credential ? "password_changed" : "password_set",
      detail: null,
      ip: req.ip ?? null,
      userAgent: req.get("user-agent") ?? null,
    });
    return true;
  });
  if (!changed) {
    return { ok: false, error: "Geslo se je medtem spremenilo. Osvežite stran in poskusite znova." };
  }
  return { ok: true, initial: !credential };
}

export async function resetAdminPasswordWithRecovery(
  codeRaw: unknown,
  nextRaw: unknown,
  recoveryAttemptId: string,
  req: Request,
  res: Response,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const next = validateAdminPassword(nextRaw);
  if (!next.ok) return next;
  const normalized = typeof codeRaw === "string" ? normalizeRecoveryCode(codeRaw) : "";
  if (normalized.length < 8) return { ok: false, error: "Obnovitvena koda ni veljavna." };
  const codes = await db
    .select()
    .from(adminRecoveryCodesTable)
    .where(isNull(adminRecoveryCodesTable.usedAt));
  let matchedId: string | null = null;
  for (const row of codes) {
    if (await verifyPassword(row.codeHash, normalized, false)) {
      matchedId = row.id;
      break;
    }
  }
  if (!matchedId) return { ok: false, error: "Obnovitvena koda ni veljavna." };
  const newHash = await hashAdminPassword(next.value);
  const token = crypto.randomBytes(32).toString("base64url");
  const reset = await db.transaction(async (tx) => {
    const [burned] = await tx
      .update(adminRecoveryCodesTable)
      .set({ usedAt: new Date() })
      .where(
        and(
          eq(adminRecoveryCodesTable.id, matchedId!),
          isNull(adminRecoveryCodesTable.usedAt),
        ),
      )
      .returning({ id: adminRecoveryCodesTable.id });
    if (!burned) return false;
    await tx
      .insert(adminPasswordCredentialsTable)
      .values({ singleton: true, passwordHash: newHash })
      .onConflictDoUpdate({
        target: adminPasswordCredentialsTable.singleton,
        set: { passwordHash: newHash, changedAt: new Date() },
      });
    await tx
      .insert(adminPasswordStateTable)
      .values({ singleton: true, failedLoginCount: 0, lastFailedAt: null })
      .onConflictDoUpdate({
        target: adminPasswordStateTable.singleton,
        set: { failedLoginCount: 0, lastFailedAt: null },
      });
    await tx.execute(sql`SELECT pg_advisory_xact_lock(${LOCK_ADMIN_SESSIONS})`);
    await tx.delete(adminSessionsTable);
    await tx.insert(adminSessionsTable).values({
      tokenHash: sha256(token),
      ip: req.ip ?? null,
      userAgent: req.get("user-agent") ?? null,
      expiresAt: new Date(Date.now() + SESSION_TTL_MS),
    });
    await tx.insert(adminAuthEventsTable).values({
      type: "password_recovered",
      detail: null,
      ip: req.ip ?? null,
      userAgent: req.get("user-agent") ?? null,
    });
    const marked = await tx
      .update(adminAuthEventsTable)
      .set({ detail: "success" })
      .where(
        and(
          eq(adminAuthEventsTable.id, recoveryAttemptId),
          eq(adminAuthEventsTable.type, "recovery_attempt"),
          eq(adminAuthEventsTable.detail, "failure"),
        ),
      )
      .returning({ id: adminAuthEventsTable.id });
    if (marked.length !== 1) {
      throw new Error("Recovery attempt evidence could not be finalized");
    }
    return true;
  });
  if (!reset) return { ok: false, error: "Obnovitvena koda je bila že uporabljena." };
  setSessionCookie(res, token);
  return { ok: true };
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
): Promise<
  | { allowed: true; attemptId: string }
  | { allowed: false; attemptId: null }
> {
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
    if (!row) throw new Error("Recovery attempt could not be reserved");
    return { allowed: true, attemptId: row.id };
  });
}

/** Counts for the admin UI — never the values. */
export async function recoveryCodeCounts(): Promise<{ active: number; consumed: number }> {
  const rows = await db
    .select({ usedAt: adminRecoveryCodesTable.usedAt })
    .from(adminRecoveryCodesTable);
  const consumed = rows.filter((r) => r.usedAt !== null).length;
  return { active: rows.length - consumed, consumed };
}
