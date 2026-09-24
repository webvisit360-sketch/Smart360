import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { createServer as createTcpServer, type AddressInfo } from "node:net";
import { readFile } from "node:fs/promises";
import { request } from "node:http";
import { resolve } from "node:path";
import express from "express";
import { eq } from "drizzle-orm";
import { db, tenantsTable } from "@workspace/db";
import { ensureTenantPublication } from "../lib/publishedSnapshots";
import publicTenants, { invalidateTenantCache } from "../routes/publicTenants";

const webRoot = resolve(import.meta.dirname, "../../../smart360");

async function availablePort(): Promise<number> {
  const socket = createTcpServer().listen(0, "127.0.0.1");
  await new Promise<void>((ok) => socket.once("listening", ok));
  const port = (socket.address() as AddressInfo).port;
  await new Promise<void>((ok) => socket.close(() => ok()));
  return port;
}

async function waitForStatic(origin: string, child: ReturnType<typeof spawn>): Promise<void> {
  for (let i = 0; i < 80; i++) {
    if (child.exitCode !== null) throw new Error(`Static server exited (${child.exitCode})`);
    try {
      if ((await fetch(`${origin}/healthz`)).ok) return;
    } catch { /* Not listening yet. */ }
    await new Promise((ok) => setTimeout(ok, 100));
  }
  throw new Error("Static server did not become healthy");
}

function getWithHost(url: string, host: string): Promise<{ status: number; body: string }> {
  return new Promise((resolveResult, reject) => {
    const req = request(url, { headers: { host } }, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (chunk: Buffer) => chunks.push(chunk));
      res.on("end", () => resolveResult({ status: res.statusCode ?? 0, body: Buffer.concat(chunks).toString() }));
      res.on("error", reject);
    });
    req.on("error", reject);
    req.end();
  });
}

test("real HTTP: two published tenant manifests, raw production HTML, admin and unavailable guest", async () => {
  // Fixture writes are exclusively to disposable development tenants. No
  // credentials, production URL, or existing tenant data is touched.
  assert.notEqual(process.env.NODE_ENV, "production", "Refusing fixture writes in production");
  assert.ok(!process.env.REPLIT_DEPLOYMENT, "Refusing fixture writes in a deployment");
  const index = await readFile(resolve(webRoot, "dist/public/index.html"), "utf8");
  assert.match(index, /<!-- PWA_HEAD -->/, "Build the web artifact before this HTTP test");
  const id = randomUUID().slice(0, 12);
  const specs = [
    { slug: `pwatest-a-${id}`, name: "Vodnik Planina" },
    { slug: `pwatest-b-${id}`, name: "Vodnik Obala" },
  ];
  const created: string[] = [];
  const api = express();
  api.use("/api", publicTenants);
  const listener = api.listen(0, "127.0.0.1");
  await new Promise<void>((ok) => listener.once("listening", ok));
  const apiOrigin = `http://127.0.0.1:${(listener.address() as AddressInfo).port}`;
  const webOrigin = `http://127.0.0.1:${await availablePort()}`;
  const child = spawn(process.execPath, [resolve(webRoot, "server.mjs")], {
    env: { ...process.env, PORT: new URL(webOrigin).port, NODE_ENV: "test" },
    stdio: "ignore",
  });
  try {
    for (const { slug, name } of specs) {
      const [row] = await db.insert(tenantsTable).values({ slug, name, isPublished: true }).returning();
      assert.ok(row);
      created.push(row.id);
      await ensureTenantPublication(row.id);
    }
    await waitForStatic(webOrigin, child);
    for (const { slug, name } of specs) {
      const response = await fetch(`${apiOrigin}/api/public/tenants/${slug}/manifest.webmanifest`);
      assert.equal(response.status, 200, slug);
      assert.match(response.headers.get("content-type") ?? "", /manifest\+json/);
      const manifest = await response.json() as {
        name: string; short_name: string; start_url: string; scope: string;
        icons: { src: string; sizes: string; purpose: string }[];
      };
      assert.equal(manifest.name, name);
      assert.equal(manifest.short_name, name);
      assert.equal(manifest.start_url, `/${slug}/`);
      assert.equal(manifest.scope, `/${slug}/`);
      assert.deepEqual(manifest.icons.map(({ sizes, purpose }) => [sizes, purpose]), [
        ["192x192", "any"], ["512x512", "any"], ["192x192", "maskable"], ["512x512", "maskable"],
      ]);
      assert.ok(manifest.icons.every((icon) => icon.src.includes("crisp-3")));
      const initial = (await (await fetch(`${webOrigin}/${slug}/c/deep-link?preview=1`)).text()).split("</head>")[0];
      assert.match(initial, new RegExp(`rel="manifest" href="/api/public/tenants/${slug}/manifest.webmanifest"`));
      assert.doesNotMatch(initial, /href="\/manifest\.webmanifest"|apple-mobile-web-app-title" content="Smart360"/);
      assert.match(initial, /rel="apple-touch-icon" sizes="180x180" href="\/brand\/ikona-smart360-180.png\?v=crisp-3"/);
    }
    const legacy = (await (await fetch(`${webOrigin}/g/${specs[0]!.slug}/c/deep-link`)).text()).split("</head>")[0];
    assert.match(legacy, new RegExp(`/api/public/tenants/${specs[0]!.slug}/manifest.webmanifest`));
    assert.doesNotMatch(legacy, /href="\/manifest\.webmanifest"/);

    const domain = `fixture-guest-${id}.example.com`;
    await db.update(tenantsTable).set({ customDomain: domain }).where(eq(tenantsTable.id, created[0]!));
    invalidateTenantCache();
    const customHead = (await getWithHost(`${webOrigin}/`, domain)).body.split("</head>")[0];
    assert.ok(customHead.includes(`/api/public/tenants/${domain}/manifest.webmanifest`));
    assert.doesNotMatch(customHead, /href="\/manifest\.webmanifest"/);
    const customManifest = await getWithHost(`${apiOrigin}/api/public/tenants/${domain}/manifest.webmanifest`, domain);
    assert.equal(customManifest.status, 200);
    assert.equal((JSON.parse(customManifest.body) as { start_url: string }).start_url, `/${specs[0]!.slug}/`);

    const admin = (await (await fetch(`${webOrigin}/admin`)).text()).split("</head>")[0];
    assert.match(admin, /rel="manifest" href="\/manifest\.webmanifest"/);
    assert.match(admin, /apple-mobile-web-app-title" content="Smart360"/);
    for (const route of ["/", "/admin/login", "/portal/povabilo", "/portal/ponastavitev", "/pogoji", "/povprasevanje", "/zasebnost", "/__living-guide/tokens"]) {
      const platformHead = (await (await fetch(`${webOrigin}${route}`)).text()).split("</head>")[0];
      assert.match(platformHead, /rel="manifest" href="\/manifest\.webmanifest"/, route);
      assert.doesNotMatch(platformHead, /\/api\/public\/tenants\/[^"]+\/manifest\.webmanifest/, route);
    }
    const platformManifest = await (await fetch(`${webOrigin}/manifest.webmanifest`)).json() as {
      start_url: string; icons: { sizes: string; purpose: string; src: string }[];
    };
    assert.equal(platformManifest.start_url, "/admin");
    assert.deepEqual(platformManifest.icons.map(({ sizes, purpose }) => [sizes, purpose]), [
      ["192x192", "any"], ["512x512", "any"], ["192x192", "maskable"], ["512x512", "maskable"],
    ]);
    assert.ok(platformManifest.icons.every(icon => icon.src.includes("crisp-3")));
    const unavailable = (await (await fetch(`${webOrigin}/pwatest-unavailable/`)).text()).split("</head>")[0];
    assert.match(unavailable, /href="\/api\/public\/tenants\/pwatest-unavailable\/manifest\.webmanifest"/);
    assert.doesNotMatch(unavailable, /href="\/manifest\.webmanifest"|apple-mobile-web-app-title" content="Smart360"/);
    assert.equal((await fetch(`${apiOrigin}/api/public/tenants/pwatest-unavailable/manifest.webmanifest`)).status, 404);

    const touch = await fetch(`${webOrigin}/brand/ikona-smart360-180.png?v=crisp-3`);
    assert.equal(touch.status, 200);
    const bytes = Buffer.from(await touch.arrayBuffer());
    assert.equal(bytes.subarray(1, 4).toString(), "PNG");
    assert.deepEqual([bytes.readUInt32BE(16), bytes.readUInt32BE(20)], [180, 180]);
  } finally {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill("SIGTERM");
      await new Promise<void>((ok) => child.once("exit", () => ok()));
    }
    await new Promise<void>((ok) => listener.close(() => ok()));
    invalidateTenantCache();
    for (const tenantId of created) await db.delete(tenantsTable).where(eq(tenantsTable.id, tenantId));
  }
});