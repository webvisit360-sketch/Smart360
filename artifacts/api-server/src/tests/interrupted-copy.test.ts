import test from "node:test";
import assert from "node:assert/strict";
import { fork } from "node:child_process";
import { once } from "node:events";
import { File } from "@google-cloud/storage";
import { eq } from "drizzle-orm";
import { db, tenantsTable, tenantCopyJobsTable, tenantSlugReservationsTable, publishedSnapshotsTable } from "@workspace/db";
import app from "../app";
import { objectStorageClient } from "../lib/objectStorage";
import { seedDuplicateFixture, cleanupDuplicateFixture, assertDev } from "./fixtures/duplicate-project-fixture";

test("SIGKILL leaves a durable hidden copy; cleanup failure is retryable and removes every object", { timeout: 120000 }, async t => {
  assertDev();
  const f = await seedDuplicateFixture();
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address() as { port: number };
  const base = `http://127.0.0.1:${address.port}/api`;
  const headers = { cookie: `__Host-s360_admin=${f.token}`, "content-type": "application/json" };
  try {
    // Mid-media interruption AND after GPX has reached storage, before final commit.
    for (const stopAfter of [1, 5]) {
      const slug = `dup-${f.key}-kill-${stopAfter}`;
      const worker = fork(new URL("./fixtures/interrupted-copy-worker.ts", import.meta.url), [f.sourceId, slug, String(stopAfter)], {
        execArgv: ["--import", "tsx/esm"], stdio: ["ignore", "ignore", "inherit", "ipc"],
      });
      try {
        const [message] = await Promise.race([
          once(worker, "message"),
          once(worker, "exit").then(() => { throw new Error("Copy worker exited before pause"); }),
          new Promise<never>((_, reject) => { const timer = setTimeout(() => reject(new Error("Worker timeout")), 45000); timer.unref(); }),
        ]);
        assert.equal(message.copied, stopAfter);
        const [stub] = await db.select().from(tenantsTable).where(eq(tenantsTable.slug, slug));
        assert.equal(stub.copyState, "copying");
        assert.equal(stub.isPublished, false);
        const [job] = await db.select().from(tenantCopyJobsTable).where(eq(tenantCopyJobsTable.tenantId, stub.id));
        assert.equal(job.objectManifest.length, 5);
        const cleanupUrl = `${base}/admin/tenants/${stub.id}/incomplete-copy`;
        assert.equal((await fetch(cleanupUrl, { method: "DELETE" })).status, 401);
        if (stopAfter === 1) {
          const login = await fetch(`${base}/admin/host/login`, {
            method: "POST", headers: { "content-type": "application/json" },
            body: JSON.stringify({ email: f.hostEmail, password: f.password }),
          });
          assert.equal(login.status, 200);
          const cookie = /__Host-s360_host=[^;]+/.exec(login.headers.get("set-cookie") ?? "")?.[0];
          assert.ok(cookie);
          assert.equal((await fetch(cleanupUrl, { method: "DELETE", headers: { cookie } })).status, 404);
        }
        assert.equal((await fetch(cleanupUrl, { method: "DELETE", headers })).status, 409, "active copy cannot be cleaned");
        for (const path of [`/public/tenants/${slug}`, `/public/tenants/${slug}?preview=1`]) {
          assert.equal((await fetch(base + path, { headers })).status, 404);
        }
        for (const method of ["GET", "PATCH", "DELETE"]) {
          assert.equal((await fetch(`${base}/admin/tenants/${stub.id}`, { method, headers,
            ...(method === "PATCH" ? { body: JSON.stringify({ isPublished: true, publishNow: true }) } : {}),
          })).status, 409);
        }
        assert.equal((await db.select().from(publishedSnapshotsTable).where(eq(publishedSnapshotsTable.tenantId, stub.id))).length, 0);
        const exited = once(worker, "exit");
        worker.kill("SIGKILL");
        await exited;
        // Wait for PostgreSQL to notice the killed session and release its lock.
        await new Promise(resolve => setTimeout(resolve, 150));
        const listed = await (await fetch(`${base}/admin/tenants`, { headers })).json() as any[];
        assert.equal(listed.find(row => row.id === stub.id)?.copyState, "copying");
        if (stopAfter === 1) {
          const deletion = t.mock.method(File.prototype, "delete", async () => { throw new Error("Synthetic storage outage"); });
          try { assert.equal((await fetch(cleanupUrl, { method: "DELETE", headers })).status, 503); }
          finally { deletion.mock.restore(); }
          assert.equal((await db.select().from(tenantsTable).where(eq(tenantsTable.id, stub.id)))[0].copyState, "copying");
          assert.equal((await db.select().from(tenantCopyJobsTable).where(eq(tenantCopyJobsTable.tenantId, stub.id))).length, 1);
        }
        assert.equal((await fetch(cleanupUrl, { method: "DELETE", headers })).status, 204);
        assert.equal((await fetch(cleanupUrl, { method: "DELETE", headers })).status, 204, "cleanup is idempotent");
        for (const [table, column] of [
          [tenantsTable, tenantsTable.id], [tenantCopyJobsTable, tenantCopyJobsTable.tenantId],
          [tenantSlugReservationsTable, tenantSlugReservationsTable.tenantId], [publishedSnapshotsTable, publishedSnapshotsTable.tenantId],
        ] as const) {
          assert.equal((await db.select().from(table).where(eq(column, stub.id))).length, 0);
        }
        for (const object of job.objectManifest) {
          assert.equal((await objectStorageClient.bucket(object.bucket).file(object.name).exists())[0], false);
        }
        const sourceObjects = await objectStorageClient.bucket(f.bucketName).getFiles({ prefix: f.prefix });
        assert.equal(sourceObjects[0].length, 4, "source media untouched");
        console.log("INTERRUPTED_COPY_ZERO_PROOF", JSON.stringify({ stopAfter, plannedObjects: 5, remainingObjects: 0, remainingTenant: 0, remainingJob: 0, remainingSlug: 0 }));
      } finally {
        if (worker.exitCode === null && worker.signalCode === null) {
          const exited = once(worker, "exit"); worker.kill("SIGKILL"); await exited;
        }
      }
    }
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve()));
    console.log("INTERRUPTED_COPY_FIXTURE_CLEANUP", JSON.stringify(await cleanupDuplicateFixture(f)));
  }
});