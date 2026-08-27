/**
 * CHECKPOINT 2 host authentication suite (Instruction #28).
 *
 * Proves the credential-handling claims in the CP2 report:
 *  - passwords stored ONLY as Argon2id (m=64MiB, t=3, p=1) hashes;
 *  - session cookie carries a random token whose SHA-256 hash (never the
 *    token) is stored;
 *  - uniform login failures (no account-existence oracle);
 *  - per-account capped exponential backoff instead of a lockout;
 *  - per-IP process throttle;
 *  - password change requires the current password and revokes other sessions;
 *  - full reset flow: uniform request, single-use 60-min token, hashed at
 *    rest, all sessions revoked on success (delivery stubbed here; one real
 *    delivery is verified separately).
 */
import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { once } from "node:events";
import type { Request } from "express";
import { eq } from "drizzle-orm";
import {
  db,
  tenantsTable,
  hostUsersTable,
  hostMembershipsTable,
  hostSessionsTable,
  hostPasswordResetsTable,
  changelogTable,
} from "@workspace/db";
import app from "../app";
import {
  hashPassword,
  backoffDelayMs,
  hostLoginIpLimited,
  _clearHostRateLimiters,
  upsertHostAccountForTenant,
  getHostAccountForTenant,
  issueHostPasswordReset,
  issueHostInviteForTenant,
} from "../lib/hostAuth";
import {
  _setHostResetDeliveryOverride,
  buildResetEmailBody,
  resetLink,
  HOST_RESET_FROM_NAME,
} from "../lib/hostResetEmail";

const sha256 = (v: string) => crypto.createHash("sha256").update(v).digest("hex");

test("backoff curve: none before 3 failures, doubling, capped at 60 s", () => {
  assert.equal(backoffDelayMs(0), 0);
  assert.equal(backoffDelayMs(2), 0);
  assert.equal(backoffDelayMs(3), 1000);
  assert.equal(backoffDelayMs(4), 2000);
  assert.equal(backoffDelayMs(5), 4000);
  assert.equal(backoffDelayMs(9), 64000 > 60000 ? 60000 : 64000); // capped
  assert.equal(backoffDelayMs(50), 60000);
});

test("per-IP throttle: 10 attempts per window, then limited", () => {
  _clearHostRateLimiters();
  const ip = "203.0.113.77";
  for (let i = 0; i < 10; i++) {
    assert.equal(hostLoginIpLimited(ip), false, `attempt ${i + 1} allowed`);
  }
  assert.equal(hostLoginIpLimited(ip), true, "11th attempt limited");
  _clearHostRateLimiters();
});

test("reset e-mail is addressed to the host and carries the token link", () => {
  const body = buildResetEmailBody(
    "gostitelj@example.com",
    resetLink("TOKEN123"),
    `${HOST_RESET_FROM_NAME} <info@webvisit360.com>`,
  );
  assert.deepEqual(body.to, ["gostitelj@example.com"]);
  assert.ok(body.from.startsWith(HOST_RESET_FROM_NAME));
  assert.ok(body.html.includes("token=TOKEN123"));
  assert.ok(body.subject.length > 0);
});

test("CP2 host auth end-to-end", async (t) => {
  _clearHostRateLimiters();
  const server = app.listen(0);
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const base = `http://127.0.0.1:${address.port}`;

  const stamp = Date.now().toString(36);
  const email = `cp2-auth-${stamp}@example.com`;
  const password = "zacetno-geslo-1";

  const [tenant] = await db
    .insert(tenantsTable)
    .values({ slug: `cp2-auth-${stamp}`, name: "CP2 Auth" })
    .returning({ id: tenantsTable.id });
  const tenantId = tenant!.id;
  const [user] = await db
    .insert(hostUsersTable)
    .values({ email, passwordHash: await hashPassword(password) })
    .returning({ id: hostUsersTable.id });
  const userId = user!.id;
  await db.insert(hostMembershipsTable).values({ hostUserId: userId, tenantId });

  t.after(async () => {
    _setHostResetDeliveryOverride(null);
    await db.delete(changelogTable).where(eq(changelogTable.tenantId, tenantId));
    await db.delete(hostUsersTable).where(eq(hostUsersTable.id, userId));
    await db.delete(tenantsTable).where(eq(tenantsTable.id, tenantId));
    await new Promise<void>((r) => server.close(() => r()));
  });

  const login = async (mail: string, pw: string) =>
    fetch(`${base}/api/admin/host/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: mail, password: pw }),
    });

  const cookieOf = (res: Response): string => {
    const m = /__Host-s360_host=([^;]+)/.exec(res.headers.get("set-cookie") ?? "");
    assert.ok(m, "expected session cookie");
    return `__Host-s360_host=${m![1]}`;
  };

  await t.test("password at rest is Argon2id with the documented parameters", async () => {
    const [row] = await db.select({ hash: hostUsersTable.passwordHash })
      .from(hostUsersTable).where(eq(hostUsersTable.id, userId));
    assert.ok(row!.hash!.startsWith("$argon2id$"), "must be Argon2id");
    assert.ok(row!.hash!.includes("m=65536,t=3,p=1"), "m=64MiB, t=3, p=1");
    assert.ok(!row!.hash!.includes(password), "plaintext never stored");
  });

  await t.test("login failures are uniform (no account-existence oracle)", async () => {
    _clearHostRateLimiters();
    const unknown = await login(`nihce-${stamp}@example.com`, "karkoli-123");
    const wrongPw = await login(email, "napacno-geslo-1");
    assert.equal(unknown.status, 401);
    assert.equal(wrongPw.status, 401);
    assert.deepEqual(await unknown.json(), await wrongPw.json(), "identical bodies");
    assert.equal(unknown.headers.get("set-cookie"), null, "no cookie on failure");
    // reset the failure counter for the next subtests
    await db.update(hostUsersTable)
      .set({ failedLoginCount: 0, lastFailedAt: null })
      .where(eq(hostUsersTable.id, userId));
  });

  await t.test("session token is stored only as SHA-256; logout revokes it", async () => {
    _clearHostRateLimiters();
    const res = await login(email, password);
    assert.equal(res.status, 200);
    const cookie = cookieOf(res);
    const raw = cookie.split("=")[1]!;
    const rows = await db.select({ tokenHash: hostSessionsTable.tokenHash })
      .from(hostSessionsTable).where(eq(hostSessionsTable.hostUserId, userId));
    assert.ok(rows.some((r) => r.tokenHash === sha256(raw)), "hash stored");
    assert.ok(rows.every((r) => r.tokenHash !== raw), "raw token never stored");

    const out = await fetch(`${base}/api/admin/host/logout`, { method: "POST", headers: { cookie } });
    assert.equal(out.status, 204);
    const after = await fetch(`${base}/api/admin/host/session`, { headers: { cookie } });
    assert.deepEqual(await after.json(), { authenticated: false });
  });

  await t.test("backoff: correct password is rejected while the account is cooling down", async () => {
    _clearHostRateLimiters();
    await db.update(hostUsersTable)
      .set({ failedLoginCount: 6, lastFailedAt: new Date() })
      .where(eq(hostUsersTable.id, userId));
    const during = await login(email, password);
    assert.equal(during.status, 401, "within backoff window even the right password waits");

    await db.update(hostUsersTable)
      .set({ lastFailedAt: new Date(Date.now() - 70_000) })
      .where(eq(hostUsersTable.id, userId));
    const after = await login(email, password);
    assert.equal(after.status, 200, "after the (capped 60 s) delay login succeeds");
    const [row] = await db.select({ n: hostUsersTable.failedLoginCount })
      .from(hostUsersTable).where(eq(hostUsersTable.id, userId));
    assert.equal(row!.n, 0, "success resets the failure counter");
  });

  await t.test("password change: wrong current fails; other sessions revoked", async () => {
    _clearHostRateLimiters();
    const s1 = cookieOf(await login(email, password));
    const s2 = cookieOf(await login(email, password));

    const bad = await fetch(`${base}/api/admin/host/password`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: s2 },
      body: JSON.stringify({ currentPassword: "ni-pravo-geslo", newPassword: "novo-geslo-22" }),
    });
    assert.equal(bad.status, 400);

    const short = await fetch(`${base}/api/admin/host/password`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: s2 },
      body: JSON.stringify({ currentPassword: password, newPassword: "kratko" }),
    });
    assert.equal(short.status, 400, "8-character minimum enforced");

    const ok = await fetch(`${base}/api/admin/host/password`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: s2 },
      body: JSON.stringify({ currentPassword: password, newPassword: "novo-geslo-22" }),
    });
    assert.equal(ok.status, 204);

    const s1Check = await fetch(`${base}/api/admin/host/session`, { headers: { cookie: s1 } });
    assert.deepEqual(await s1Check.json(), { authenticated: false }, "other session revoked");
    const s2Check = await fetch(`${base}/api/admin/host/session`, { headers: { cookie: s2 } });
    assert.equal(((await s2Check.json()) as { authenticated: boolean }).authenticated, true,
      "the session that changed the password survives");

    const back = await fetch(`${base}/api/admin/host/password`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: s2 },
      body: JSON.stringify({ currentPassword: "novo-geslo-22", newPassword: password }),
    });
    assert.equal(back.status, 204);
  });

  await t.test("reset flow: uniform request, hashed single-use token, sessions revoked", async () => {
    _clearHostRateLimiters();
    const captured: Array<{ to: string[]; html: string }> = [];
    _setHostResetDeliveryOverride(async (body) => {
      captured.push({ to: body.to, html: body.html });
      return { ok: true };
    });

    const alive = cookieOf(await login(email, password));

    const unknown = await fetch(`${base}/api/admin/host/reset/request`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: `nihce-${stamp}@example.com` }),
    });
    assert.equal(unknown.status, 200, "uniform response for unknown account");
    assert.equal(captured.length, 0, "nothing sent for unknown account");

    const known = await fetch(`${base}/api/admin/host/reset/request`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email }),
    });
    assert.equal(known.status, 200);
    assert.deepEqual(await known.json(), await unknown.json(), "identical bodies");
    assert.equal(captured.length, 1);
    assert.deepEqual(captured[0]!.to, [email], "mail goes to the HOST address");
    const tokenMatch = /token=([A-Za-z0-9_%-]+)/.exec(captured[0]!.html);
    assert.ok(tokenMatch, "mail contains the token link");
    const token = decodeURIComponent(tokenMatch![1]!);

    const [stored] = await db.select({ tokenHash: hostPasswordResetsTable.tokenHash })
      .from(hostPasswordResetsTable).where(eq(hostPasswordResetsTable.hostUserId, userId));
    assert.equal(stored!.tokenHash, sha256(token), "only the hash is at rest");

    const weak = await fetch(`${base}/api/admin/host/reset/confirm`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token, newPassword: "kratko" }),
    });
    assert.equal(weak.status, 400, "weak password rejected without burning the token");

    const good = await fetch(`${base}/api/admin/host/reset/confirm`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": "198.51.100.41",
        "user-agent": "reset-confirm-test-agent",
      },
      body: JSON.stringify({ token, newPassword: "cisto-novo-geslo-9" }),
    });
    assert.equal(good.status, 204);

    const reuse = await fetch(`${base}/api/admin/host/reset/confirm`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": "198.51.100.41",
        "user-agent": "reset-confirm-test-agent",
      },
      body: JSON.stringify({ token, newPassword: "se-eno-geslo-10" }),
    });
    assert.equal(reuse.status, 400, "token is single-use");
    const resetAuditRows = await db
      .select({
        actorType: changelogTable.actorType,
        actorLabel: changelogTable.actorLabel,
        actorId: changelogTable.actorId,
        actorEmail: changelogTable.actorEmail,
        requestIp: changelogTable.requestIp,
        detail: changelogTable.detail,
        summary: changelogTable.summary,
      })
      .from(changelogTable)
      .where(eq(changelogTable.tenantId, tenantId));
    const resetAudit = resetAuditRows.filter(
      (row) => row.summary === "Stranka je potrdila ponastavitev gesla.",
    );
    assert.equal(resetAudit.length, 1, "only a successful reset confirmation is logged");
    assert.deepEqual(
      resetAudit[0],
      {
        actorType: "host",
        actorLabel: "Stranka",
        actorId: null,
        actorEmail: null,
        requestIp: "198.51.100.41",
        detail: null,
        summary: "Stranka je potrdila ponastavitev gesla.",
      },
      "the confirmation is attributed to Stranka with only the request IP",
    );
    assert.ok(
      !JSON.stringify(resetAudit[0]).includes(token) &&
        !JSON.stringify(resetAudit[0]).includes("cisto-novo-geslo-9") &&
        !JSON.stringify(resetAudit[0]).includes(email) &&
        !JSON.stringify(resetAudit[0]).includes(userId) &&
        !JSON.stringify(resetAudit[0]).includes("reset-confirm-test-agent"),
      "the changelog excludes token, password, e-mail, host ID, and user-agent",
    );

    const aliveCheck = await fetch(`${base}/api/admin/host/session`, { headers: { cookie: alive } });
    assert.deepEqual(await aliveCheck.json(), { authenticated: false },
      "reset revokes ALL sessions");

    _clearHostRateLimiters();
    assert.equal((await login(email, password)).status, 401, "old password dead");
    _clearHostRateLimiters();
    // clear backoff bookkeeping from the failed old-password probe
    await db.update(hostUsersTable)
      .set({ failedLoginCount: 0, lastFailedAt: null })
      .where(eq(hostUsersTable.id, userId));
    assert.equal((await login(email, "cisto-novo-geslo-9")).status, 200, "new password works");

    // per-account cap: 3 requests/hour (1 used above)
    await fetch(`${base}/api/admin/host/reset/request`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ email }),
    });
    await fetch(`${base}/api/admin/host/reset/request`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ email }),
    });
    assert.equal(captured.length, 3, "second and third request still delivered");
    const capped = await issueHostPasswordReset(email, null);
    assert.equal(capped, null, "fourth request within the hour is silently capped");
  });

  await t.test("invite activation changelog is host-attributed and excludes credentials", async (t) => {
    const [inviteTenant] = await db
      .insert(tenantsTable)
      .values({ slug: `cp2-invite-audit-${stamp}`, name: "CP2 Invite Audit" })
      .returning({ id: tenantsTable.id });
    const inviteEmail = `cp2-invite-audit-${stamp}@example.com`;
    const [inviteUser] = await db
      .insert(hostUsersTable)
      .values({ email: inviteEmail, passwordHash: null })
      .returning({ id: hostUsersTable.id });
    await db.insert(hostMembershipsTable).values({
      hostUserId: inviteUser!.id,
      tenantId: inviteTenant!.id,
    });
    t.after(async () => {
      await db.delete(changelogTable).where(eq(changelogTable.tenantId, inviteTenant!.id));
      await db.delete(hostUsersTable).where(eq(hostUsersTable.id, inviteUser!.id));
      await db.delete(tenantsTable).where(eq(tenantsTable.id, inviteTenant!.id));
    });

    const issued = await issueHostInviteForTenant(
      inviteTenant!.id,
      "welcome",
      { actor: { kind: "owner" }, ip: "127.0.0.1", get: () => undefined } as unknown as Request,
    );
    assert.ok(issued.ok);
    if (!issued.ok) return;

    const invalid = await fetch(`${base}/api/admin/host/invite/confirm`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": "198.51.100.42" },
      body: JSON.stringify({ token: "invalid-invite-token-value", newPassword: "novo-vabilo-geslo" }),
    });
    assert.equal(invalid.status, 400);

    const activated = await fetch(`${base}/api/admin/host/invite/confirm`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": "198.51.100.42",
        "user-agent": "invite-confirm-test-agent",
      },
      body: JSON.stringify({ token: issued.token, newPassword: "novo-vabilo-geslo" }),
    });
    assert.equal(activated.status, 204);
    const reused = await fetch(`${base}/api/admin/host/invite/confirm`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": "198.51.100.42" },
      body: JSON.stringify({ token: issued.token, newPassword: "drugo-vabilo-geslo" }),
    });
    assert.equal(reused.status, 400);

    const rows = await db
      .select()
      .from(changelogTable)
      .where(eq(changelogTable.tenantId, inviteTenant!.id));
    assert.equal(rows.length, 1, "failed and reused invite tokens write no changelog");
    const [row] = rows;
    assert.equal(row!.actorType, "host");
    assert.equal(row!.actorLabel, "Stranka");
    assert.equal(row!.requestIp, "198.51.100.42");
    assert.equal(row!.detail, null);
    assert.equal(row!.actorId, null);
    assert.equal(row!.actorEmail, null);
    assert.ok(
      !JSON.stringify(row).includes(issued.token) &&
        !JSON.stringify(row).includes("novo-vabilo-geslo") &&
        !JSON.stringify(row).includes(inviteEmail) &&
        !JSON.stringify(row).includes(inviteUser!.id) &&
        !JSON.stringify(row).includes("invite-confirm-test-agent"),
      "the invite changelog contains no sensitive request or account data",
    );
  });

  await t.test("owner-side account management (library level)", async () => {
    const [tenantC] = await db
      .insert(tenantsTable)
      .values({ slug: `cp2-auth-c-${stamp}`, name: "CP2 Auth C" })
      .returning({ id: tenantsTable.id });
    t.after(async () => {
      const acct = await getHostAccountForTenant(tenantC!.id);
      if (acct) {
        await db.delete(hostUsersTable).where(eq(hostUsersTable.email, acct.email));
      }
      await db.delete(tenantsTable).where(eq(tenantsTable.id, tenantC!.id));
    });

    const created = await upsertHostAccountForTenant(tenantC!.id, `cp2-c-${stamp}@example.com`, null);
    assert.ok(created.ok && created.created, "account created without a password");
    const view = await getHostAccountForTenant(tenantC!.id);
    assert.equal(view!.hasPassword, false, "owner never sets a password");

    const conflict = await upsertHostAccountForTenant(tenantC!.id, email, null);
    assert.ok(!conflict.ok && conflict.status === 409,
      "an e-mail already bound to another tenant's account is rejected");

    const changed = await upsertHostAccountForTenant(tenantC!.id, `cp2-c2-${stamp}@example.com`, null);
    assert.ok(changed.ok && !changed.created, "e-mail change updates the same account");
  });
});
