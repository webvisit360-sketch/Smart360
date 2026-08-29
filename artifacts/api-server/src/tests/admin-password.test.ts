import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import type { Request, Response } from "express";
import { eq } from "drizzle-orm";
import {
  db,
  adminAuthEventsTable,
  adminPasswordCredentialsTable,
  adminPasswordStateTable,
  adminRecoveryCodesTable,
  adminSessionsTable,
} from "@workspace/db";
import {
  ADMIN_ARGON2ID_PARAMS,
  ADMIN_EMAIL,
  SESSION_COOKIE,
  _setAdminPasswordVerifierOverride,
  adminPasswordBackoffMs,
  hashAdminPassword,
  issueRecoveryCodes,
  loginAdminPassword,
  recordRecoveryAttempt,
  resetAdminPasswordWithRecovery,
  setOrChangeAdminPassword,
} from "../lib/adminAuth";
import {
  ADMIN_SECURITY_MAILBOX,
  _setAdminSecurityDeliveryOverride,
  sendAdminSecurityEmail,
} from "../lib/adminSecurityEmail";

const tokenHash = (value: string) => crypto.createHash("sha256").update(value).digest("hex");

function request(
  ip: string,
  cookie?: string,
): Request {
  return {
    ip,
    cookies: cookie ? { [SESSION_COOKIE]: cookie } : {},
    get: (name: string) => (name.toLowerCase() === "user-agent" ? "admin-password-test" : undefined),
  } as unknown as Request;
}

function response() {
  let cookie: string | null = null;
  const res = {
    cookie: (_name: string, value: string) => {
      cookie = value;
      return res;
    },
  } as unknown as Response;
  return { res, cookie: () => cookie };
}

async function clearPasswordEvidence(): Promise<void> {
  await db.delete(adminSessionsTable);
  await db.delete(adminPasswordCredentialsTable);
  await db.delete(adminPasswordStateTable);
  await db
    .delete(adminAuthEventsTable)
    .where(eq(adminAuthEventsTable.type, "password_login_attempt"));
  await db
    .delete(adminAuthEventsTable)
    .where(eq(adminAuthEventsTable.type, "recovery_attempt"));
}

test("operator password security scope", { concurrency: false }, async (t) => {
  await clearPasswordEvidence();
  t.after(async () => {
    _setAdminPasswordVerifierOverride(null);
    _setAdminSecurityDeliveryOverride(null);
    await clearPasswordEvidence();
    await db.delete(adminRecoveryCodesTable);
  });

  await t.test("Argon2id parameters and delay curve are pinned", async () => {
    assert.deepEqual(ADMIN_ARGON2ID_PARAMS, {
      algorithm: 2,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 1,
    });
    const hash = await hashAdminPassword("zelo-varno-geslo-123");
    assert.match(hash, /^\$argon2id\$/);
    assert.ok(hash.includes("m=65536,t=3,p=1"));
    assert.deepEqual(
      [0, 1, 2, 3, 4, 5, 9, 99].map(adminPasswordBackoffMs),
      [0, 0, 0, 1000, 2000, 4000, 60000, 60000],
    );
  });

  await t.test("missing credential takes the dummy verification path and is audited", async () => {
    let dummySeen = false;
    _setAdminPasswordVerifierOverride(async (_hash, _password, dummy) => {
      dummySeen = dummy;
      return false;
    });
    const out = response();
    const result = await loginAdminPassword(ADMIN_EMAIL, "napačno", request("198.51.100.1"), out.res);
    assert.deepEqual(result, { ok: false, status: 401 });
    assert.equal(dummySeen, true);
    const rows = await db
      .select()
      .from(adminAuthEventsTable)
      .where(eq(adminAuthEventsTable.type, "password_login_attempt"));
    assert.equal(rows.filter((row) => row.detail === "failure").length, 1);
    assert.ok(rows.every((row) => !row.detail?.includes("napačno")));
  });

  await t.test("overlong login passwords are rejected before verification", async () => {
    let verified = false;
    _setAdminPasswordVerifierOverride(async () => {
      verified = true;
      return false;
    });
    const result = await loginAdminPassword(
      ADMIN_EMAIL,
      "x".repeat(201),
      request("198.51.100.99"),
      response().res,
    );
    assert.deepEqual(result, { ok: false, status: 400 });
    assert.equal(verified, false);
  });

  await t.test("five DB-persisted failures enforce the hard IP limit", async () => {
    await clearPasswordEvidence();
    await db.insert(adminPasswordCredentialsTable).values({
      passwordHash: await hashAdminPassword("pravilno-geslo-123"),
    });
    _setAdminPasswordVerifierOverride(async () => false);
    for (let i = 0; i < 5; i += 1) {
      await db
        .update(adminPasswordStateTable)
        .set({ lastFailedAt: new Date(0) })
        .where(eq(adminPasswordStateTable.singleton, true));
      const result = await loginAdminPassword(
        ADMIN_EMAIL,
        "napačno",
        request("198.51.100.2"),
        response().res,
      );
      assert.equal(result.ok, false);
      if (!result.ok) assert.equal(result.status, 401);
    }
    await db
      .update(adminPasswordStateTable)
      .set({ lastFailedAt: new Date(0) })
      .where(eq(adminPasswordStateTable.singleton, true));
    const blocked = await loginAdminPassword(
      ADMIN_EMAIL,
      "napačno",
      request("198.51.100.2"),
      response().res,
    );
    assert.deepEqual(blocked, { ok: false, status: 429 });
    const blockedAgain = await loginAdminPassword(
      ADMIN_EMAIL,
      "napačno",
      request("198.51.100.2"),
      response().res,
    );
    assert.deepEqual(blockedAgain, { ok: false, status: 429 });
    const rows = await db
      .select()
      .from(adminAuthEventsTable)
      .where(eq(adminAuthEventsTable.type, "password_login_attempt"));
    assert.equal(rows.filter((row) => row.detail === "failure").length, 5);
    assert.equal(rows.filter((row) => row.detail === "rate_limited").length, 1);
  });

  await t.test("early retry does not extend delay; success resets state and creates session", async () => {
    await db.delete(adminAuthEventsTable).where(eq(adminAuthEventsTable.type, "password_login_attempt"));
    await db
      .update(adminPasswordStateTable)
      .set({ failedLoginCount: 3, lastFailedAt: new Date() })
      .where(eq(adminPasswordStateTable.singleton, true));
    let verifications = 0;
    _setAdminPasswordVerifierOverride(async () => {
      verifications += 1;
      return true;
    });
    const [before] = await db.select().from(adminPasswordStateTable);
    const delayed = await loginAdminPassword(
      ADMIN_EMAIL,
      "pravilno-geslo-123",
      request("198.51.100.3"),
      response().res,
    );
    assert.equal(delayed.ok, false);
    const [after] = await db.select().from(adminPasswordStateTable);
    assert.equal(after!.lastFailedAt!.getTime(), before!.lastFailedAt!.getTime());
    assert.equal(verifications, 0);

    await db
      .update(adminPasswordStateTable)
      .set({ lastFailedAt: new Date(0) })
      .where(eq(adminPasswordStateTable.singleton, true));
    const out = response();
    const success = await loginAdminPassword(
      ADMIN_EMAIL,
      "pravilno-geslo-123",
      request("198.51.100.3"),
      out.res,
    );
    assert.equal(success.ok, true);
    assert.ok(out.cookie());
    const [state] = await db.select().from(adminPasswordStateTable);
    assert.equal(state!.failedLoginCount, 0);
    assert.equal((await db.select().from(adminSessionsTable)).length, 1);
  });

  await t.test("recovery burns one code, resets password/failures, revokes sessions and creates a fresh session", async () => {
    _setAdminPasswordVerifierOverride(null);
    const [code] = await issueRecoveryCodes(1);
    const reserved = await recordRecoveryAttempt("198.51.100.4", "admin-password-test");
    assert.equal(reserved.allowed, true);
    assert.ok(reserved.attemptId);
    await db.insert(adminSessionsTable).values({
      tokenHash: tokenHash("old-session"),
      expiresAt: new Date(Date.now() + 60_000),
    });
    await db
      .update(adminPasswordStateTable)
      .set({ failedLoginCount: 8, lastFailedAt: new Date() })
      .where(eq(adminPasswordStateTable.singleton, true));
    const out = response();
    const result = await resetAdminPasswordWithRecovery(
      code,
      "obnovljeno-geslo-123",
      reserved.attemptId!,
      request("198.51.100.4"),
      out.res,
    );
    assert.equal(result.ok, true);
    assert.ok(out.cookie());
    assert.equal((await db.select().from(adminSessionsTable)).length, 1);
    const [state] = await db.select().from(adminPasswordStateTable);
    assert.equal(state!.failedLoginCount, 0);
    const [burned] = await db.select().from(adminRecoveryCodesTable);
    assert.ok(burned!.usedAt);
    const [attempt] = await db
      .select()
      .from(adminAuthEventsTable)
      .where(eq(adminAuthEventsTable.id, reserved.attemptId!));
    assert.equal(attempt!.detail, "success");
  });

  await t.test("authenticated change is conditional and revokes every other session", async () => {
    const current = "obnovljeno-geslo-123";
    const currentToken = "current-session";
    await db.insert(adminSessionsTable).values([
      {
        tokenHash: tokenHash(currentToken),
        expiresAt: new Date(Date.now() + 60_000),
      },
      {
        tokenHash: tokenHash("other-session"),
        expiresAt: new Date(Date.now() + 60_000),
      },
    ]);
    const wrong = await setOrChangeAdminPassword(
      "ni-pravo",
      "naslednje-geslo-123",
      request("198.51.100.5", currentToken),
    );
    assert.equal(wrong.ok, false);
    const changed = await setOrChangeAdminPassword(
      current,
      "naslednje-geslo-123",
      request("198.51.100.5", currentToken),
    );
    assert.equal(changed.ok, true);
    assert.equal((await db.select().from(adminSessionsTable)).length, 1);
  });

  await t.test("security notifications use the permanent mailbox without real delivery", async () => {
    const bodies: Record<string, unknown>[] = [];
    _setAdminSecurityDeliveryOverride(async (body) => {
      bodies.push(body);
      return { ok: true };
    });
    for (const event of [
      "password_changed",
      "password_recovered",
      "passkey_enrolled",
      "recovery_codes_replaced",
    ] as const) {
      assert.equal(await sendAdminSecurityEmail(event), true);
    }
    assert.equal(bodies.length, 4);
    assert.ok(bodies.every((body) => JSON.stringify(body.to) === JSON.stringify([ADMIN_SECURITY_MAILBOX])));
    assert.ok(bodies.every((body) => body.from === "Smart360 <info@webvisit360.com>"));
  });
});