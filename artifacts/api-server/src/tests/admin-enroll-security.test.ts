import test from "node:test";
import assert from "node:assert/strict";
import type { Request, Response } from "express";
import { and, eq, like } from "drizzle-orm";
import {
  db,
  adminAuthEventsTable,
  adminCredentialsTable,
  adminEnrollTokensTable,
  adminRecoveryCodesTable,
  adminSecurityEmailsTable,
  adminSessionsTable,
} from "@workspace/db";
import {
  createEnrollToken,
  beginEnrollRequest,
  completeEnrollRequest,
  finalizeEnrollRegistration,
  inspectEnrollToken,
  recordEnrollOutcome,
  SESSION_COOKIE,
} from "../lib/adminAuth";
import {
  _setAdminSecurityDeliveryOverride,
  sendAdminSecurityEmail,
} from "../lib/adminSecurityEmail";

const req = {
  ip: "198.51.100.88",
  get: (name: string) => name.toLowerCase() === "user-agent" ? "enroll-security-test" : undefined,
} as unknown as Request;

function response() {
  let cookie: { name: string; value: string } | null = null;
  const res = {
    cookie: (name: string, value: string) => {
      cookie = { name, value };
      return res;
    },
  } as unknown as Response;
  return { res, cookie: () => cookie };
}

const credential = (id: string) => ({
  credentialId: id,
  publicKey: "test-public-key",
  counter: 0,
  transports: "[]",
  deviceName: "Test key",
});

async function clean() {
  await db.delete(adminSecurityEmailsTable);
  await db.delete(adminSessionsTable);
  await db.delete(adminRecoveryCodesTable);
  await db.delete(adminCredentialsTable);
  await db.delete(adminEnrollTokensTable);
  await db.delete(adminAuthEventsTable).where(like(adminAuthEventsTable.type, "enroll%"));
}

test("operator enrolment security scope", { concurrency: false }, async (t) => {
  await clean();
  t.after(async () => {
    _setAdminSecurityDeliveryOverride(null);
    await clean();
  });

  await t.test("new issuance invalidates every older unused token and records the hash", async () => {
    const first = await createEnrollToken("recovery");
    const second = await createEnrollToken("shell");
    assert.equal((await inspectEnrollToken(first)).status, "already_used");
    assert.equal((await inspectEnrollToken(second)).status, "valid");
    const issued = await db
      .select()
      .from(adminAuthEventsTable)
      .where(eq(adminAuthEventsTable.type, "enroll_token_issued"));
    assert.equal(issued.length, 2);
    assert.ok(issued.every((row) => row.detail?.includes("token_hash:")));
  });

  await t.test("shell registers atomically without creating a session", async () => {
    const token = await createEnrollToken("shell");
    const target = response();
    const result = await finalizeEnrollRegistration(
      token, credential("shell-credential"), req, target.res,
    );
    assert.equal(result?.source, "shell");
    assert.equal(result?.authenticated, false);
    assert.equal(result?.recoveryCodes?.length, 10);
    assert.equal(target.cookie(), null);
    assert.equal((await db.select().from(adminSessionsTable)).length, 0);
    const [audit] = await db
      .select()
      .from(adminAuthEventsTable)
      .where(eq(adminAuthEventsTable.type, "enroll"));
    assert.match(audit?.detail ?? "", /outcome:success source:shell token_hash:/);
  });

  await t.test("recovery enrolment keeps its approved fresh session", async () => {
    const token = await createEnrollToken("recovery");
    const target = response();
    const result = await finalizeEnrollRegistration(
      token, credential("recovery-credential"), req, target.res,
    );
    assert.equal(result?.authenticated, true);
    assert.equal(target.cookie()?.name, SESSION_COOKIE);
    assert.equal((await db.select().from(adminSessionsTable)).length, 1);
  });

  await t.test("a failed credential insert rolls back token burn and audit", async () => {
    const token = await createEnrollToken("shell");
    const target = response();
    await assert.rejects(() => finalizeEnrollRegistration(
      token, credential("shell-credential"), req, target.res,
    ));
    const state = await inspectEnrollToken(token);
    assert.equal(state.status, "valid");
    const successes = await db
      .select()
      .from(adminAuthEventsTable)
      .where(and(
        eq(adminAuthEventsTable.type, "enroll"),
        like(adminAuthEventsTable.detail, `%token_hash:${state.tokenHash}%`),
      ));
    assert.equal(successes.length, 0);
  });

  await t.test("failed attempts trigger the persistent noise limiter", async () => {
    for (let i = 0; i < 10; i++) assert.ok(await beginEnrollRequest(req));
    assert.equal(await beginEnrollRequest(req), null);
    const successful = await beginEnrollRequest({ ...req, ip: "198.51.100.89" } as Request);
    assert.ok(successful);
    await completeEnrollRequest(successful!);
    assert.ok(await beginEnrollRequest({ ...req, ip: "198.51.100.89" } as Request));
  });

  await t.test("security mail stores provider id or a visible failed outcome", async () => {
    _setAdminSecurityDeliveryOverride(async () => ({ ok: true, providerMessageId: "email_security_1" }));
    assert.equal(await sendAdminSecurityEmail("passkey_enrolled"), true);
    _setAdminSecurityDeliveryOverride(async () => ({ ok: false }));
    assert.equal(await sendAdminSecurityEmail("password_changed"), false);
    const rows = await db.select().from(adminSecurityEmailsTable);
    assert.deepEqual(rows.map((row) => row.deliveryStatus).sort(), ["accepted", "failed"]);
    assert.equal(rows.find((row) => row.deliveryStatus === "accepted")?.providerMessageId, "email_security_1");
  });
});