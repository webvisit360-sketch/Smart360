/**
 * HTTP boundary regression: the real static web server queries the real API
 * and returns a document-level 301 after a confirmed A → B → C publication.
 * Only throwaway development-DB rows are created; no live account is used.
 * Run after building smart360 (dist/public/index.html must exist).
 */
import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { spawn, type ChildProcess } from "node:child_process";
import { createServer } from "node:net";
import { access } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { eq } from "drizzle-orm";
import {
  adminSessionsTable,
  changelogTable,
  db,
  tenantAliasesTable,
  tenantSlugReservationsTable,
  tenantsTable,
} from "@workspace/db";
import app from "../app";
import { _setLifecycleDeliveryOverride } from "../lib/lifecycleEmails";

const webServerFile = fileURLToPath(new URL("../../../smart360/server.mjs", import.meta.url));
const webIndex = new URL("../../../smart360/dist/public/index.html", import.meta.url);

async function freePort(): Promise<number> {
  const socket = createServer();
  socket.listen(0, "127.0.0.1");
  await once(socket, "listening");
  const address = socket.address();
  assert.ok(address && typeof address === "object");
  await new Promise<void>((resolve, reject) => socket.close((error) => error ? reject(error) : resolve()));
  return address.port;
}

async function request(base: string, method: string, path: string, cookie?: string, body?: unknown) {
  return fetch(`${base}/api${path}`, {
    method,
    redirect: "manual",
    headers: {
      ...(cookie ? { cookie } : {}),
      ...(body !== undefined ? { "content-type": "application/json" } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

async function webRequest(base: string, path: string, method = "GET") {
  return fetch(`${base}${path}`, { method, redirect: "manual" });
}

test("real static HTML server issues A → C and B → C HTTP 301, including deep paths", async (t) => {
  if (process.env.NODE_ENV === "production") throw new Error("Refusing to create HTTP test fixtures in production");
  await access(webIndex).catch(() => {
    throw new Error("Build smart360 before running this HTTP boundary test: dist/public/index.html is missing");
  });

  const api = app.listen(0, "127.0.0.1");
  await once(api, "listening");
  const apiAddress = api.address();
  assert.ok(apiAddress && typeof apiAddress === "object");
  const apiBase = `http://127.0.0.1:${apiAddress.port}`;
  let web: ChildProcess | undefined;
  let tenantId: string | undefined;
  let sessionId: string | undefined;
  _setLifecycleDeliveryOverride(async () => ({ ok: true }));
  t.after(async () => {
    if (web && web.exitCode === null) {
      const exited = once(web, "exit");
      web.kill();
      await exited;
    }
    _setLifecycleDeliveryOverride(null);
    if (tenantId) {
      await db.delete(changelogTable).where(eq(changelogTable.tenantId, tenantId));
      await db.delete(tenantsTable).where(eq(tenantsTable.id, tenantId));
      await db.delete(tenantAliasesTable).where(eq(tenantAliasesTable.tenantId, tenantId));
      await db.delete(tenantSlugReservationsTable).where(eq(tenantSlugReservationsTable.tenantId, tenantId));
    }
    if (sessionId) await db.delete(adminSessionsTable).where(eq(adminSessionsTable.id, sessionId));
    await new Promise<void>((resolve) => api.close(() => resolve()));
  });

  const token = randomBytes(32).toString("base64url");
  const [session] = await db.insert(adminSessionsTable)
    .values({ tokenHash: createHash("sha256").update(token).digest("hex"), expiresAt: new Date(Date.now() + 3600_000) })
    .returning({ id: adminSessionsTable.id });
  sessionId = session!.id;
  const cookie = `__Host-s360_admin=${token}`;
  const suffix = randomUUID().slice(0, 12);
  const A = `web-http-a-${suffix}`, B = `web-http-b-${suffix}`, C = `web-http-c-${suffix}`;
  const created = await request(apiBase, "POST", "/admin/tenants", cookie, {
    name: `HTTP fixture ${suffix}`, slug: A, type: "kamp",
  });
  assert.equal(created.status, 201, await created.clone().text());
  tenantId = (await created.json() as { id: string }).id;

  const port = await freePort();
  const webBase = `http://127.0.0.1:${port}`;
  web = spawn(process.execPath, [webServerFile], {
    env: { ...process.env, NODE_ENV: "test", PORT: String(port), SMART360_INTERNAL_API_ORIGIN: apiBase },
    stdio: "ignore",
  });
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    if (web.exitCode !== null) throw new Error(`Static web server exited: ${web.exitCode}`);
    try {
      const health = await webRequest(webBase, "/healthz");
      if (health.status === 200) { ready = true; break; }
    } catch { /* waiting for the child listener */ }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  assert.ok(ready, "static web server did not become ready");

  const publish = async (oldSlug?: string, nextSlug?: string) => {
    const previewResponse = await request(apiBase, "GET", `/admin/tenants/${tenantId}/publish-preview`, cookie);
    assert.equal(previewResponse.status, 200);
    const preview = await previewResponse.json() as { token: string; changed: string[] };
    if (oldSlug && nextSlug) {
      assert.ok(preview.changed.includes(
        `Stari naslov ${oldSlug} bo za vedno preusmerjen na ${nextSlug}. Natisnjene QR kode bodo delovale še naprej.`,
      ), "confirmation must include the backend's exact old→new warning before publication");
    }
    const published = await request(apiBase, "PATCH", `/admin/tenants/${tenantId}`, cookie,
      { isPublished: true, publishNow: true, publishToken: preview.token });
    assert.equal(published.status, 200, await published.clone().text());
  };
  await publish();
  assert.equal((await webRequest(webBase, `/${A}/c/guide?lang=it`)).status, 200);

  for (const [oldSlug, nextSlug] of [[A, B], [B, C]] as const) {
    const draft = await request(apiBase, "PATCH", `/admin/tenants/${tenantId}`, cookie, { slug: nextSlug });
    assert.equal(draft.status, 200, await draft.clone().text());
    const saved = await draft.json() as { slug: string; draftSlug: string | null };
    assert.equal(saved.slug, oldSlug);
    assert.equal(saved.draftSlug, nextSlug);
    assert.equal((await webRequest(webBase, `/${oldSlug}/c/guide?lang=it`)).status, 200,
      "saving a draft must keep the live web URL");
    const draftLookup = await request(apiBase, "GET", `/public/slug-redirect/${oldSlug}`);
    assert.equal(draftLookup.status, 200);
    assert.deepEqual(await draftLookup.json(), { canonicalSlug: null },
      "a published canonical URL must not become an alias until confirmation");
    await publish(oldSlug, nextSlug);
  }

  for (const oldSlug of [A, B]) {
    for (const path of [`/${oldSlug}/c/guide?lang=it&x=1`, `/g/${oldSlug}/c/guide?lang=it&x=1`]) {
      const response = await webRequest(webBase, path);
      assert.equal(response.status, 301, `${path} must redirect before HTML`);
      assert.equal(response.headers.get("location"), `/${C}/c/guide?lang=it&x=1`);
      assert.equal(response.headers.get("cache-control"), "no-store");
    }
    const head = await webRequest(webBase, `/${oldSlug}/`, "HEAD");
    assert.equal(head.status, 301);
    assert.equal(head.headers.get("location"), `/${C}/`);
    const manifest = await request(apiBase, "GET", `/public/tenants/${oldSlug}/manifest.webmanifest?lang=it`);
    assert.equal(manifest.status, 301);
    assert.equal(manifest.headers.get("location"), `/api/public/tenants/${C}/manifest.webmanifest?lang=it`);
  }
  assert.equal((await webRequest(webBase, `/${C}/c/guide?lang=it`)).status, 200);
});