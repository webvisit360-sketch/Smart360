import crypto from "node:crypto";
import type { Request, Response, NextFunction } from "express";
import { hash as argonHash, verify as argonVerify } from "@node-rs/argon2";
import {
  db,
  adminUsersTable,
  adminSessionsTable,
  adminPasswordResetsTable,
  type AdminUser,
} from "@workspace/db";
import { eq, lt, ne, and, isNull, gt } from "drizzle-orm";

const SESSION_COOKIE = "smart360_admin";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const RESET_TTL_MS = 30 * 60 * 1000; // 30 minutes

export const ADMIN_EMAIL_SEED = "pi4.doo@gmail.com";
export const MIN_PASSWORD_LENGTH = 12;

const ARGON2ID = { algorithm: 2 } as const; // 2 = argon2id

export function hashPassword(password: string): Promise<string> {
  return argonHash(password, ARGON2ID);
}

export async function verifyPassword(hashed: string, password: string): Promise<boolean> {
  try {
    return await argonVerify(hashed, password);
  } catch {
    return false;
  }
}

function sha256(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

/**
 * Ensures the single admin account exists and uses the configured email.
 * Initial password comes from ADMIN_PASSWORD (dev fallback: "smart360").
 */
export async function ensureAdminAccount(): Promise<void> {
  const [existing] = await db.select().from(adminUsersTable).limit(1);
  if (existing) {
    if (existing.email !== ADMIN_EMAIL_SEED) {
      await db
        .update(adminUsersTable)
        .set({ email: ADMIN_EMAIL_SEED })
        .where(eq(adminUsersTable.id, existing.id));
    }
    return;
  }
  const initial = process.env["ADMIN_PASSWORD"];
  if (!initial && process.env.NODE_ENV === "production") {
    throw new Error("ADMIN_PASSWORD must be set to create the admin account");
  }
  await db
    .insert(adminUsersTable)
    .values({
      email: ADMIN_EMAIL_SEED,
      passwordHash: await hashPassword(initial ?? "smart360"),
    })
    .onConflictDoNothing({ target: adminUsersTable.email });
}

export async function getAdminUser(): Promise<AdminUser | undefined> {
  const [user] = await db.select().from(adminUsersTable).limit(1);
  return user;
}

/** Accepts the account email; ADMIN_USER env value is tolerated for backward compatibility. */
export async function checkCredentials(
  username: string,
  password: string,
): Promise<AdminUser | null> {
  const user = await getAdminUser();
  if (!user) return null;
  const legacyUser = process.env["ADMIN_USER"];
  const nameOk =
    username.toLowerCase() === user.email.toLowerCase() ||
    (!!legacyUser && username === legacyUser);
  const passOk = await verifyPassword(user.passwordHash, password);
  return nameOk && passOk ? user : null;
}

// ---------- Sessions (server-side, revocable) ----------

export async function createSession(req: Request, res: Response): Promise<string> {
  const token = crypto.randomBytes(32).toString("base64url");
  const [session] = await db
    .insert(adminSessionsTable)
    .values({
      tokenHash: sha256(token),
      ip: req.ip ?? null,
      userAgent: req.get("user-agent") ?? null,
      expiresAt: new Date(Date.now() + SESSION_TTL_MS),
    })
    .returning();
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_TTL_MS,
    path: "/",
  });
  return session!.id;
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

/** Deletes every session except the current one (used after a password change). */
export async function revokeOtherSessions(req: Request): Promise<void> {
  const id = await findSessionId(req);
  if (id) {
    await db.delete(adminSessionsTable).where(ne(adminSessionsTable.id, id));
  } else {
    await db.delete(adminSessionsTable);
  }
}

export async function revokeAllSessions(): Promise<void> {
  await db.delete(adminSessionsTable);
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  isAuthenticated(req)
    .then((ok) => {
      if (!ok) {
        res.status(401).json({ error: "Not authenticated" });
        return;
      }
      next();
    })
    .catch(next);
}

// ---------- Password reset tokens ----------

export async function createResetToken(): Promise<string> {
  const token = crypto.randomBytes(32).toString("base64url");
  await db.insert(adminPasswordResetsTable).values({
    tokenHash: sha256(token),
    expiresAt: new Date(Date.now() + RESET_TTL_MS),
  });
  // Opportunistic cleanup of expired tokens.
  await db
    .delete(adminPasswordResetsTable)
    .where(lt(adminPasswordResetsTable.expiresAt, new Date()));
  return token;
}

/** Atomically consumes a valid, unused, unexpired token. Returns true on success. */
export async function consumeResetToken(token: string): Promise<boolean> {
  const [row] = await db
    .update(adminPasswordResetsTable)
    .set({ usedAt: new Date() })
    .where(
      and(
        eq(adminPasswordResetsTable.tokenHash, sha256(token)),
        isNull(adminPasswordResetsTable.usedAt),
        gt(adminPasswordResetsTable.expiresAt, new Date()),
      ),
    )
    .returning();
  return !!row;
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

// Login: 5 attempts / 15 minutes per IP.
export function loginRateLimited(ip: string): boolean {
  return limited(`login:${ip}`, 5, 15 * 60 * 1000, false);
}
export function recordLoginFailure(ip: string): void {
  limited(`login:${ip}`, 5, 15 * 60 * 1000, true);
}
export function resetLoginFailures(ip: string): void {
  attempts.delete(`login:${ip}`);
}

// Forgot password: 3 requests / hour per email and per IP (records on check).
export function forgotRateLimited(email: string, ip: string): boolean {
  const e = limited(`forgot:e:${email.toLowerCase()}`, 3, 60 * 60 * 1000, true);
  const i = limited(`forgot:i:${ip}`, 3, 60 * 60 * 1000, true);
  return e || i;
}
