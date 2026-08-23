/**
 * Guest payload cache: the per-(tenant, lang) cache must serve within its TTL
 * and must be dropped SYNCHRONOUSLY by invalidateTenantCache() — the hook
 * every admin save route already calls. A host must never see stale content
 * after saving.
 *
 * Uses the real Express app on an ephemeral port and the real dev database
 * (tenant meli-pu), mutating tenants.name and restoring it afterwards.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { eq } from "drizzle-orm";
import { db, tenantsTable } from "@workspace/db";

import { EventEmitter } from "node:events";

import app from "../app";
import { invalidateTenantCache } from "../routes/publicTenants";
import { makeAdminMutationInvalidator } from "../routes/index";

const SLUG = "meli-pu";

test("payload cache serves within TTL and invalidates immediately on the admin-save hook", async (t) => {
  const server = app.listen(0);
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const base = `http://127.0.0.1:${address.port}`;
  t.after(() => new Promise<void>((r) => server.close(() => r())));

  const [tenant] = await db
    .select()
    .from(tenantsTable)
    .where(eq(tenantsTable.slug, SLUG));
  assert.ok(tenant, `dev tenant ${SLUG} must exist`);
  assert.ok(tenant.isPublished, `dev tenant ${SLUG} must be published`);
  const originalName = tenant.name;
  const changedName = `${originalName} [cache-test]`;

  t.after(async () => {
    await db
      .update(tenantsTable)
      .set({ name: originalName })
      .where(eq(tenantsTable.id, tenant.id));
    invalidateTenantCache();
  });

  const getName = async (): Promise<string> => {
    const res = await fetch(`${base}/api/public/tenants/${SLUG}`);
    assert.equal(res.status, 200);
    const body = (await res.json()) as { name: string };
    return body.name;
  };

  // Start from a clean process-local cache, then warm it.
  invalidateTenantCache();
  assert.equal(await getName(), originalName);

  // Mutate the DB behind the cache's back: within the TTL the cached copy
  // must still be served (this proves the cache actually short-circuits).
  await db
    .update(tenantsTable)
    .set({ name: changedName })
    .where(eq(tenantsTable.id, tenant.id));
  assert.equal(
    await getName(),
    originalName,
    "second request within TTL must come from the cache",
  );

  // The admin-save hook must make the change visible IMMEDIATELY.
  invalidateTenantCache();
  assert.equal(
    await getName(),
    changedName,
    "after invalidateTenantCache() the very next request must be fresh",
  );

  // Preview requests bypass the cache entirely (operator sees the DB as-is).
  // An unauthenticated preview flag is ignored, so it must hit the cache path
  // and still return the (now fresh) cached copy — not an error.
  const previewRes = await fetch(
    `${base}/api/public/tenants/${SLUG}?preview=1`,
  );
  assert.equal(previewRes.status, 200);
});

/**
 * The centralized invalidation middleware is what guarantees "a host never
 * sees stale content after saving": every successful mutating /admin request
 * must clear the guest caches, and nothing else may evict them.
 */
test("makeAdminMutationInvalidator clears caches exactly on successful admin mutations", () => {
  const run = (
    method: string,
    path: string,
    statusCode: number,
  ): number => {
    let calls = 0;
    const middleware = makeAdminMutationInvalidator(() => {
      calls += 1;
    });
    const res = new EventEmitter() as EventEmitter & { statusCode: number };
    res.statusCode = statusCode;
    let nextCalled = false;
    middleware(
      { method, path } as never,
      res as never,
      () => {
        nextCalled = true;
      },
    );
    assert.ok(nextCalled, "middleware must always pass through");
    res.emit("finish");
    return calls;
  };

  // Successful admin mutations invalidate — POST/PATCH/PUT/DELETE alike.
  assert.equal(run("POST", "/admin/items/abc/media", 200), 1);
  assert.equal(run("PATCH", "/admin/sections/abc", 200), 1);
  assert.equal(run("DELETE", "/admin/media/abc", 204), 1);
  assert.equal(run("POST", "/admin/tenants/abc/hero/upload", 201), 1);

  // Failed admin mutations must NOT invalidate (nothing changed).
  assert.equal(run("POST", "/admin/items/abc/media", 401), 0);
  assert.equal(run("PATCH", "/admin/tenants/abc", 400), 0);

  // Reads and guest endpoints must never evict the hot guest cache.
  assert.equal(run("GET", "/admin/tenants", 200), 0);
  assert.equal(run("POST", "/public/tenants/meli-pu/orders", 201), 0);
  assert.equal(run("POST", "/orders", 201), 0);
});
