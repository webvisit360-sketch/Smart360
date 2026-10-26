import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, tenantsTable, smartxstayImportRunsTable as runs } from "@workspace/db";
import router from "../routes/adminSmartxstayImport";
import { createAdminGateForTests } from "../lib/actorGate";
import { logger } from "../lib/logger";

test("real import HTTP routes: operator can cancel legacy run; host cannot step/cancel; no background start", async () => {
  const [tenant] = await db.insert(tenantsTable).values({ slug: `import-http-${randomUUID()}`, name: "Synthetic HTTP test" }).returning();
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.actor = req.get("x-fixture-actor") === "host"
      ? { kind: "host", tenantId: tenant.id, hostUserId: randomUUID() }
      : { kind: "owner" };
    req.log = logger;
    next();
  });
  app.use("/api", (req, res, next) => createAdminGateForTests(req.actor!)(req, res, next));
  app.use("/api", router);
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(r => server.once("listening", r));
  const base = `http://127.0.0.1:${(server.address() as any).port}/api/admin/tenants/${tenant.id}/smartxstay-imports`;
  const post = (path: string, host = false, body?: object) => fetch(base + path, { method: "POST", headers: { "content-type": "application/json", "x-fixture-actor": host ? "host" : "owner" }, body: JSON.stringify(body || {}) });
  try {
    const cleanupUrl = base.replace(/smartxstay-imports$/, "smartxstay-cleanup");
    for (const method of ["GET", "POST"]) {
      const denied = await fetch(cleanupUrl, { method, headers: { "content-type": "application/json", "x-fixture-actor": "host" }, ...(method === "POST" ? { body: JSON.stringify({ approvals: [] }) } : {}) });
      assert.ok([403, 404].includes(denied.status), "cleanup is operator-only");
    }
    assert.equal((await fetch(cleanupUrl)).status, 200);
    assert.equal((await fetch(cleanupUrl, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ approvals: [] }) })).status, 200);
    const [legacy] = await db.insert(runs).values({ tenantId: tenant.id, sourceUrl: "https://app.smartxstay.com/gen/s/fixture", status: "importing" }).returning();
    for (const action of ["step", "cancel"]) {
      const denied = await post(`/${legacy.id}/${action}`, true);
      assert.ok([403, 404].includes(denied.status));
    }
    assert.equal((await db.select().from(runs).where(eq(runs.id, legacy.id)))[0].status, "importing");
    assert.equal((await post(`/${legacy.id}/cancel`)).status, 200);
    const created = await post("", false, { url: "https://app.smartxstay.com/gen/s/fixture" });
    assert.equal(created.status, 202);
    const { id } = await created.json() as { id: string };
    const state = (await db.select().from(runs).where(eq(runs.id, id)))[0];
    assert.equal(state.status, "preparing");
    assert.deepEqual(state.checkpoint, { version: 1 });
    const history = await (await fetch(base)).json() as { id: string; checkpoint?: unknown }[];
    assert.equal(history[0].id, id);
    assert.equal(history[0].checkpoint, undefined);
  } finally {
    await new Promise<void>((resolve, reject) => server.close(e => e ? reject(e) : resolve()));
    await db.delete(runs).where(eq(runs.tenantId, tenant.id));
    await db.delete(tenantsTable).where(eq(tenantsTable.id, tenant.id));
  }
});
