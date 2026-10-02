import assert from "node:assert/strict";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import { guestOfflineConfig, renderGuestServiceWorker, renderLegacyGuestServiceWorker, type GuestOfflineConfig } from "../lib/guestServiceWorker";

const origin = "https://example.test";
const api = "/api/public/tenants/alpine-lodge";
const scope = "/alpine-lodge/";
const gpx = `${api}/items/item-1/gpx/file-1`;
const payload = { id: "tenant-1", slug: "alpine-lodge", guestUiMode: "living-guide", title: "Published" };
const config: GuestOfflineConfig = {
  tenantId: "tenant-1", slug: "alpine-lodge", version: "v1",
  languages: ["sl", "en", "de", "it"], gpx: [gpx], essentials: ["/logo.png"],
};
const keyOf = (input: string | { url: string }) => new URL(typeof input === "string" ? input : input.url, origin).href;

class MemoryCache {
  values = new Map<string, Response>();
  constructor(private readonly storage: MemoryStorage, readonly name: string) {}
  async match(key: string | Request) { return this.values.get(keyOf(key))?.clone(); }
  async put(key: string | Request, response: Response) {
    if (this.storage.failWrites || (this.storage.failMeta && this.name.endsWith("media-meta"))) throw new Error("QuotaExceededError");
    this.values.set(keyOf(key), response.clone());
  }
  async delete(key: string | Request) { return this.values.delete(keyOf(key)); }
  async keys() { return [...this.values.keys()].map((url) => new Request(url)); }
}
class MemoryStorage {
  stores = new Map<string, MemoryCache>();
  failWrites = false;
  failMeta = false;
  async open(name: string) {
    let cache = this.stores.get(name);
    if (!cache) { cache = new MemoryCache(this, name); this.stores.set(name, cache); }
    return cache;
  }
  async keys() { return [...this.stores.keys()]; }
  async delete(name: string) { return this.stores.delete(name); }
}

function harness(options: { config?: GuestOfflineConfig; storage?: MemoryStorage; firstInstall?: boolean } = {}) {
  const cfg = options.config ?? config;
  const handlers = new Map<string, (event: any) => void>();
  const storage = options.storage ?? new MemoryStorage();
  const calls: { url: string; init: any }[] = [];
  const messages: any[] = [];
  const unrelatedMessages: any[] = [];
  const clients = new Map([
    ["guest", { type: "window", url: origin + scope, postMessage: (message: any) => messages.push(message) }],
    ["other", { type: "window", url: origin + "/other-tenant/", postMessage: (message: any) => unrelatedMessages.push(message) }],
    ["admin", { type: "window", url: origin + "/admin/", postMessage: (message: any) => unrelatedMessages.push(message) }],
    ["map-worker", { type: "worker", url: origin + "/assets/maplibre-gl-worker-test.js", postMessage: (message: any) => unrelatedMessages.push(message) }],
  ]);
  let offline = false;
  let unregistered = false;
  let claimed = false;
  let skipped = false;
  let clock = 0;
  const routes = new Map<string, () => Response | Promise<Response>>([
    [origin + api, () => Response.json(payload)],
    [origin + scope, () => new Response('<script type="module" src="/assets/index-ab.js"></script><link href="/assets/index.css" rel="stylesheet">')],
    [origin + "/assets/index-ab.js", () => new Response('import "./shared.js";const guest=()=>import("./LivingGuideGuestShell-1.js");const admin=()=>import("./admin-router-1.js");const token=()=>import("./password-token-page-1.js")')],
    [origin + "/assets/shared.js", () => new Response("export const shared = 1")],
    [origin + "/assets/LivingGuideGuestShell-1.js", () => new Response('const map=()=>import("./map.js"); const deps=["assets/map.css","assets/map.js"];')],
    [origin + "/assets/map.js", () => new Response("export const map = 1")],
    [origin + "/assets/map.css", () => new Response('body{font-family:test}@font-face{src:url("./font.woff2")}')],
    [origin + "/assets/font.woff2", () => new Response("font")],
    [origin + "/assets/index.css", () => new Response("body{}")],
    [origin + gpx, () => new Response("<gpx><trk/></gpx>")],
    [origin + "/logo.png", () => new Response("logo")],
  ]);
  for (const lang of config.languages) routes.set(origin + api + "?lang=" + lang, () => Response.json({ ...payload, lang }));
  const fetch = async (input: string | { url: string }, init?: unknown) => {
    const url = keyOf(input); calls.push({ url, init });
    if (offline) throw new TypeError("Network unavailable");
    return routes.get(url)?.() ?? new Response("not found", { status: 404 });
  };
  const script = renderGuestServiceWorker(cfg);
  runInNewContext(script, {
    self: {
      location: { origin },
      addEventListener: (name: string, handler: (event: any) => void) => handlers.set(name, handler),
      skipWaiting: async () => { skipped = true; },
      registration: { active: options.firstInstall ? null : {}, unregister: async () => { unregistered = true; } },
      clients: { claim: async () => { claimed = true; }, get: async (id: string) => clients.get(id), matchAll: async () => [...clients.values()] },
    },
    URL, Response, Request, fetch, caches: storage,
    Date: { now: () => ++clock },
  });
  async function lifecycle(name: string) {
    let work = Promise.resolve();
    handlers.get(name)!({ waitUntil: (promise: Promise<void>) => { work = promise; } });
    await work;
  }
  async function message(data: unknown, clientId = "guest") {
    let work = Promise.resolve();
    handlers.get("message")!({ data, source: clients.get(clientId), waitUntil: (promise: Promise<void>) => { work = promise; } });
    await work;
  }
  function request(path: string, options: { mode?: string; method?: string; destination?: string; clientId?: string; range?: boolean; referrer?: string } = {}) {
    let work: Promise<Response> | undefined;
    handlers.get("fetch")!({
      request: { url: keyOf(path), method: options.method ?? "GET", mode: options.mode ?? "cors", destination: options.destination ?? "", referrer: options.referrer ?? "", headers: new Headers(options.range ? { Range: "bytes=1-2" } : {}) },
      clientId: options.clientId ?? "guest", respondWith: (promise: Promise<Response>) => { work = promise; },
    });
    return work;
  }
  return { script, storage, routes, calls, messages, unrelatedMessages, lifecycle, message, request,
    offline: (value: boolean) => { offline = value; }, state: () => ({ unregistered, claimed, skipped }) };
}

test("first installation activates without network warmup; page INIT then fills offline caches", async () => {
  const h = harness({ firstInstall: true });
  await h.lifecycle("install");
  await h.lifecycle("activate");
  assert.equal(h.calls.length, 0);
  assert.deepEqual(h.state(), { unregistered: false, claimed: true, skipped: true });
  await h.message({ type: "LG_OFFLINE_INIT", slug: config.slug, lang: "sl" });
  assert.ok(h.calls.some(call => call.url === origin + scope));
  h.offline(true);
  assert.equal((await h.request(scope, { mode: "navigate" }))?.status, 200);
});

test("update lifecycle precaches guest shell graph, every language and published GPX, not admin/galleries/tiles", async () => {
  const h = harness();
  await h.lifecycle("install"); await h.lifecycle("activate");
  assert.deepEqual(h.state(), { unregistered: false, claimed: true, skipped: true });
  for (const path of [scope, gpx, "/assets/index-ab.js", "/assets/LivingGuideGuestShell-1.js", "/assets/map.js", "/assets/map.css", "/assets/font.woff2"]) {
    assert.ok(h.calls.some((call) => call.url === origin + path), path);
  }
  assert.ok(!h.calls.some((call) => /admin|password-token-page|gallery|openfreemap/.test(call.url)));
  h.offline(true);
  const doc = await h.request(scope + "c/category", { mode: "navigate" });
  assert.equal(doc?.status, 200);
  assert.match(await doc!.text(), /index-ab/);
  assert.match(await (await h.request(gpx))!.text(), /<gpx>/);
  for (const lang of config.languages) {
    assert.equal(((await (await h.request(api + "?lang=" + lang))!.json()) as { lang: string }).lang, lang);
  }
  assert.equal((await h.request("/assets/map.js", { destination: "script" }))!.status, 200);
  assert.ok(h.messages.some((message) => message.type === "LG_OFFLINE_STATUS" && message.offline));
  assert.equal(h.unrelatedMessages.length, 0);
  h.offline(false);
  await h.request(api);
  assert.equal(h.messages.at(-1).offline, false);
});

test("absolute exclusions: mutations, admin, weather, all non-content APIs, aliases, preview, range", async () => {
  const h = harness();
  for (const path of [
    "/admin/", "/portal/", "/alpine-lodge/admin/", "/alpine-lodge", "/old-slug/",
    api + "/weather", api + "/orders", api + "/messages", api + "/sign-in", api + "/search",
    api + "/manifest.webmanifest", api + "/sw.js", "/api/public/slug-redirect/alpine-lodge",
    "/api/public/tenant-by-domain", "/api/public/tenants/other-tenant", api + "?preview=true",
    api + "?lang=xx", api + "/items/unknown/gpx/file", scope + "?preview=1",
  ]) assert.equal(h.request(path, { mode: "navigate" }), undefined, path);
  assert.equal(h.request(api, { method: "POST" }), undefined);
  assert.equal(h.request(api, { range: true }), undefined);
  assert.equal(h.request("/assets/admin-router-1.js", { destination: "script" }), undefined);
  assert.equal(h.request("/assets/password-token-page-1.js", { destination: "script" }), undefined);
  assert.equal(h.request("https://unrelated.test/data.json"), undefined);
});

test("a controlled guest cannot leak cached content into another tenant/admin client", async () => {
  const h = harness(); await h.lifecycle("install"); h.offline(true);
  await assert.rejects(h.request(api, { clientId: "other" })!, /Network unavailable/);
  await assert.rejects(h.request(gpx, { clientId: "admin" })!, /Network unavailable/);
  await assert.rejects(h.request("/logo.png", { destination: "image", clientId: "unknown" })!, /Network unavailable/);
  const before = h.calls.length;
  await h.message({ type: "LG_OFFLINE_INIT", slug: config.slug, lang: "en" }, "other");
  await h.message({ type: "LG_OFFLINE_INIT", slug: "other-tenant", lang: "en" });
  assert.equal(h.calls.length, before);
  assert.equal(h.unrelatedMessages.length, 0);
});

test("cold MapLibre asset fetch works only for a scoped window, never a dedicated worker/referrer exception", async () => {
  const first = harness();
  const worker = "/assets/maplibre-gl-worker-test.js";
  first.routes.set(origin + "/assets/map.js", () => new Response(`const workerUrl="${worker}";`));
  first.routes.set(origin + worker, () => new Response("self.onmessage=()=>{}"));
  await first.lifecycle("install"); await first.lifecycle("activate");
  // The window fetches cached source before creating its local Blob worker.
  // Restart the SW so an empty-destination fetch cannot rely on shellAssets.
  const cold = harness({ storage: first.storage }); cold.offline(true);
  for (const destination of ["", "worker", "script"]) {
    const response = await cold.request(worker, {
      clientId: "guest", destination,
    });
    assert.equal(await response!.text(), "self.onmessage=()=>{}", destination);
  }
  for (const clientId of ["other", "admin", "", "missing", "map-worker"]) {
    await assert.rejects(cold.request(worker, {
      clientId, destination: "worker", referrer: origin + scope,
    })!, /Network unavailable/, "non-scoped/non-window client cannot borrow a scoped referrer");
  }
  for (const referrer of ["", "about:client", origin + "/admin/", origin + "/other-tenant/", "https://foreign.test" + scope]) {
    await assert.rejects(cold.request(worker, {
      clientId: "", destination: "worker", referrer,
    })!, /Network unavailable/);
  }
  await assert.rejects(cold.request("/assets/maplibre-gl-worker-uncached.js", {
    clientId: "", destination: "worker", referrer: origin + scope,
  })!, /Network unavailable/);
  await assert.rejects(cold.request(gpx, {
    clientId: "", referrer: origin + scope,
  })!, /Network unavailable/, "bootstrap exception cannot access tenant API content");
});

test("network errors fall back but HTTP failures/redirects preserve status and redirects retire old scope", async () => {
  for (const status of [401, 403, 500, 503]) {
    const h = harness(); await h.lifecycle("install");
    h.routes.set(origin + api, () => new Response("real error", { status }));
    assert.equal((await h.request(api))!.status, status);
  }
  const h = harness(); await h.lifecycle("install");
  h.routes.set(origin + scope, () => new Response(null, { status: 301, headers: { location: "/renamed/" } }));
  const response = await h.request(scope, { mode: "navigate" });
  assert.equal(response!.status, 301); assert.equal(response!.headers.get("location"), "/renamed/");
  assert.equal(h.state().unregistered, true);
  assert.equal((await h.storage.keys()).length, 0);
  assert.equal(h.calls.at(-1)!.init.redirect, "manual");
  h.offline(true);
  await assert.rejects(h.request(scope, { mode: "navigate" })!, /Network unavailable/);
});

test("hourly refresh discovers rename and non-Living-Guide, purges/unregisters without altering worker URL 301", async () => {
  for (const result of [() => new Response(null, { status: 301 }), () => Response.json({ ...payload, slug: "renamed" }), () => Response.json({ ...payload, guestUiMode: "legacy" }), () => new Response(null, { status: 404 })]) {
    const h = harness(); await h.lifecycle("install");
    h.routes.set(origin + api, result);
    await h.message({ type: "LG_OFFLINE_REFRESH", slug: config.slug, lang: "en" });
    assert.equal(h.state().unregistered, true);
    assert.equal((await h.storage.keys()).length, 0);
  }
});

test("stable tenant identity purges old slug and prior snapshot only, leaves unrelated tenants intact", async () => {
  const h = harness(); await h.lifecycle("install");
  await h.storage.open("lg-offline:tenant-1:old-slug:v0:content");
  await h.storage.open("lg-offline:tenant-2:other:v0:content");
  const next = harness({ config: { ...config, version: "v2" }, storage: h.storage });
  next.routes.set(origin + api, () => Response.json({ ...payload, title: "New publish" }));
  await next.lifecycle("install"); await next.lifecycle("activate");
  const keys = await h.storage.keys();
  assert.ok(!keys.some((key) => key.includes(":v1:") || key.includes(":old-slug:")));
  assert.ok(keys.includes("lg-offline:tenant-2:other:v0:content"));
  next.offline(true);
  assert.equal(((await (await next.request(api))!.json()) as { title: string }).title, "New publish");
  assert.notEqual(h.script, next.script);
  assert.ok(next.messages.some((message) => message.type === "LG_OFFLINE_VERSION" && message.version === "v2"));
});

test("old worker in-flight refresh cannot resurrect content after new worker activation", async () => {
  const first = harness(); await first.lifecycle("install"); await first.lifecycle("activate");
  let release!: () => void, started!: () => void;
  const pending = new Promise<void>((resolve) => { release = resolve; });
  const reached = new Promise<void>((resolve) => { started = resolve; });
  first.routes.set(origin + gpx, async () => {
    started(); await pending; return new Response("<gpx>old late response</gpx>");
  });
  const refresh = first.message({ type: "LG_OFFLINE_REFRESH", slug: config.slug, lang: "sl" });
  await reached;
  const next = harness({ config: { ...config, version: "v2" }, storage: first.storage });
  await next.lifecycle("install"); await next.lifecycle("activate");
  release(); await refresh;
  assert.ok(!(await first.storage.keys()).some((name) => name.includes(":v1:")), "late old fetch must not recreate v1 caches");
  // Runtime restarts do not get a second activate event; persisted ownership
  // must still block the old version rather than relying on a local boolean.
  const restartedOld = harness({ storage: first.storage });
  await restartedOld.message({ type: "LG_OFFLINE_REFRESH", slug: config.slug, lang: "sl" });
  assert.equal(restartedOld.calls.length, 0);
  assert.ok(!(await first.storage.keys()).some((name) => name.includes(":v1:")));
});

test("activation between old ownership check and cache open cleans up late reads and writes", async () => {
  for (const offline of [false, true]) {
    const first = harness(); await first.lifecycle("install"); await first.lifecycle("activate");
    first.offline(offline);
    const open = first.storage.open.bind(first.storage);
    let release!: () => void, started!: () => void, paused = false;
    const pending = new Promise<void>((resolve) => { release = resolve; });
    const reached = new Promise<void>((resolve) => { started = resolve; });
    first.storage.open = async (name) => {
      if (name.endsWith(":v1:content") && !paused) {
        paused = true; started(); await pending;
      }
      return open(name);
    };
    const inFlight = first.request(api);
    await reached;
    const next = harness({ config: { ...config, version: "v2" }, storage: first.storage });
    await next.lifecycle("install"); await next.lifecycle("activate");
    release();
    if (offline) await assert.rejects(inFlight!, /Network unavailable/);
    else assert.equal((await inFlight)!.status, 200);
    assert.ok(!(await first.storage.keys()).some((name) => name.includes(":v1:")));
  }
});

test("INIT replays genuine prior fallback status after the provider subscribes, then clears after success", async () => {
  const h = harness(); await h.lifecycle("install"); await h.lifecycle("activate");
  h.offline(true);
  await h.request(scope, { mode: "navigate" });
  h.messages.length = 0; // Listener mounted after the navigation's message.
  await h.message({ type: "LG_OFFLINE_INIT", slug: config.slug, lang: "sl" });
  assert.equal(h.messages[0].type, "LG_OFFLINE_STATUS");
  assert.equal(h.messages[0].offline, true);
  h.offline(false);
  await h.message({ type: "LG_OFFLINE_REFRESH", slug: config.slug, lang: "sl" });
  assert.equal(h.messages.at(-1).offline, false);
});

test("quota failures never fail successful shell/content/media responses, metadata failure leaves no orphan", async () => {
  const h = harness(); h.storage.failWrites = true;
  await h.lifecycle("install");
  assert.equal((await h.request(api))!.status, 200);
  assert.equal((await h.request(scope, { mode: "navigate" }))!.status, 200);
  assert.equal((await h.request("/logo.png", { destination: "image" }))!.status, 200);
  h.storage.failWrites = false; h.storage.failMeta = true;
  await h.request("/logo.png", { destination: "image" });
  const media = await h.storage.open("lg-offline:tenant-1:alpine-lodge:media");
  assert.equal(media.values.size, 0);
});

test("combined browsed image/tile LRU is <=50MiB including metadata and refreshes on hits", async () => {
  const h = harness();
  const paths = ["/image-a.jpg", "https://tiles.openfreemap.org/planet/1/1/1.pbf", "/image-c.jpg", "/image-d.jpg"];
  for (const path of paths) h.routes.set(keyOf(path), () => new Response(new Uint8Array(17 * 1024 * 1024)));
  await h.request(paths[0], { destination: "image" });
  await h.request(paths[1]);
  h.offline(true); await h.request(paths[0], { destination: "image" }); h.offline(false);
  await h.request(paths[2], { destination: "image" });
  const media = await h.storage.open("lg-offline:tenant-1:alpine-lodge:media");
  assert.ok(media.values.has(keyOf(paths[0])));
  assert.ok(!media.values.has(keyOf(paths[1])), "least recently used tile evicted before browsed image");
  const meta = await h.storage.open("lg-offline:tenant-1:alpine-lodge:media-meta");
  const records = await Promise.all([...meta.values.values()].map(async (value) => await value.clone().json() as { bytes: number }));
  assert.ok(records.reduce((sum, value) => sum + value.bytes, 0) <= 50 * 1024 * 1024);
  assert.equal(meta.values.size, media.values.size);
});

test("browsed public storage photo variants use scoped media LRU without opening generic API caching", async () => {
  const h = harness();
  const image = "/api/storage/img/alpine-lodge/browsed-photo.webp?w=1400";
  h.routes.set(origin + image, () => new Response("stored image variant", { headers: { "content-type": "image/webp" } }));
  assert.equal(h.request(image), undefined, "fetch/API requests do not qualify as browsed images");
  assert.equal(h.request(image, { mode: "navigate" }), undefined);
  assert.equal(h.request(image, { destination: "image", method: "POST" }), undefined);
  assert.equal(h.request(image, { destination: "image", range: true }), undefined);
  for (const path of ["/api/storage/img/", "/api/storage/private/photo", "/api/admin/photo", api + "/weather"]) {
    assert.equal(h.request(path, { destination: "image" }), undefined, path);
  }
  assert.equal(await (await h.request(image, { destination: "image" }))!.text(), "stored image variant");
  const media = await h.storage.open("lg-offline:tenant-1:alpine-lodge:media");
  const meta = await h.storage.open("lg-offline:tenant-1:alpine-lodge:media-meta");
  assert.ok(media.values.has(origin + image));
  assert.ok(meta.values.has(origin + image));
  h.offline(true);
  assert.equal(await (await h.request(image, { destination: "image" }))!.text(), "stored image variant");
  await assert.rejects(h.request(image, { destination: "image", clientId: "other" })!, /Network unavailable/);
  await assert.rejects(h.request(image, { destination: "image", clientId: "admin" })!, /Network unavailable/);
});

test("failed media replacement keeps the prior body and ledger, including metadata-write rollback", async () => {
  for (const failure of ["body", "metadata"]) {
    const h = harness();
    await h.request("/logo.png", { destination: "image" });
    const media = await h.storage.open("lg-offline:tenant-1:alpine-lodge:media");
    const meta = await h.storage.open("lg-offline:tenant-1:alpine-lodge:media-meta");
    const previousLedger = await (await meta.match(origin + "/logo.png"))!.text();
    h.routes.set(origin + "/logo.png", () => new Response("replacement image with more bytes"));
    if (failure === "body") h.storage.failWrites = true;
    else h.storage.failMeta = true;
    const response = await h.request("/logo.png", { destination: "image" });
    assert.equal(await response!.text(), "replacement image with more bytes", "network response must succeed");
    assert.equal(await (await media.match(origin + "/logo.png"))!.text(), "logo", failure);
    assert.equal(await (await meta.match(origin + "/logo.png"))!.text(), previousLedger, failure);
    assert.equal(media.values.size, meta.values.size);
    h.storage.failWrites = false; h.storage.failMeta = false; h.offline(true);
    assert.equal(await (await h.request("/logo.png", { destination: "image" }))!.text(), "logo");
  }
});

test("failed replacement rollback removes both body and old metadata, never an orphan ledger", async () => {
  const h = harness();
  await h.request("/logo.png", { destination: "image" });
  const media = await h.storage.open("lg-offline:tenant-1:alpine-lodge:media");
  const meta = await h.storage.open("lg-offline:tenant-1:alpine-lodge:media-meta");
  const originalPut = media.put.bind(media);
  let writes = 0;
  media.put = async (key, response) => {
    if (++writes === 2) throw new Error("QuotaExceededError during rollback");
    return originalPut(key, response);
  };
  h.storage.failMeta = true;
  h.routes.set(origin + "/logo.png", () => new Response("new network image"));
  assert.equal(await (await h.request("/logo.png", { destination: "image" }))!.text(), "new network image");
  assert.equal(media.values.size, 0);
  assert.equal(meta.values.size, 0);
});

test("oversized essentials and unmeasurable opaque responses are network-only", async () => {
  const h = harness();
  h.routes.set(origin + "/logo.png", () => new Response(new Uint8Array(2 * 1024 * 1024)));
  await h.lifecycle("install");
  const media = await h.storage.open("lg-offline:tenant-1:alpine-lodge:media");
  assert.equal(media.values.size, 0);
  h.routes.set(origin + "/opaque.jpg", () => {
    const response = new Response("opaque"); Object.defineProperty(response, "type", { value: "opaque" }); return response;
  });
  assert.equal((await h.request("/opaque.jpg", { destination: "image" }))!.type, "opaque");
  assert.equal(media.values.size, 0);
});

test("snapshot config includes only public digest, route IDs and lightweight root essentials", () => {
  const languages = { sl: { tree: { ...payload, logoUrl: "/logo.png", heroUrl: "/hero.jpg",
    sections: [{ items: [{ id: "one", gpxRoute: { fileId: "gpx-one" }, images: ["/gallery.jpg"] }] }] } } };
  const publishedAt = "2026-07-01T12:00:00.000Z";
  const first = guestOfflineConfig("tenant-1", "alpine-lodge", languages, publishedAt);
  assert.ok(first.essentials.includes("/brand/smart360-znak-40.png?v=faceted-1"));
  assert.ok(first.essentials.includes("/brand/smart360-kolobar-faceted.svg"));
  assert.ok(first.essentials.includes("/brand/ikona-smart360-home-192.png?v=faceted-1"));
  assert.ok(first.essentials.includes("/brand/ikona-smart360-512.png?v=faceted-1"));
  assert.ok(first.essentials.every(url => !/temno|crisp-3/.test(url)));
  const second = guestOfflineConfig("tenant-1", "alpine-lodge", { sl: { tree: { ...languages.sl.tree, name: "New publish" } } }, publishedAt);
  assert.notEqual(first.version, second.version);
  assert.deepEqual(first.gpx, [api + "/items/one/gpx/gpx-one"]);
  assert.ok(first.essentials.includes("/hero.jpg"));
  assert.ok(!first.essentials.includes("/gallery.jpg"));
  assert.ok(!renderGuestServiceWorker(first).includes("guestAccess"));
});

test("identical-content republish changes worker version and bytes using atomic publication identity", () => {
  const languages = { sl: { tree: payload } };
  const first = guestOfflineConfig("tenant-1", "alpine-lodge", languages, "2026-07-01T12:00:00.000Z");
  const same = guestOfflineConfig("tenant-1", "alpine-lodge", languages, "2026-07-01T12:00:00.000Z");
  const republished = guestOfflineConfig("tenant-1", "alpine-lodge", languages, "2026-07-01T12:00:01.000Z");
  assert.equal(first.version, same.version);
  assert.notEqual(first.version, republished.version);
  assert.notEqual(renderGuestServiceWorker(first), renderGuestServiceWorker(republished));
});

test("Swipe/legacy keeps its scoped pass-through installation with no caching or offline API interception", async () => {
  const handlers = new Map<string, (event: any) => void>();
  let skipped = false, claimed = false, offline = false;
  const script = renderLegacyGuestServiceWorker("alpine-lodge");
  runInNewContext(script, {
    URL,
    self: {
      location: { origin },
      addEventListener: (name: string, handler: (event: any) => void) => handlers.set(name, handler),
      skipWaiting: () => { skipped = true; },
      clients: { claim: async () => { claimed = true; } },
    },
    fetch: async () => {
      if (offline) throw new Error("Network unavailable");
      return new Response(null, { status: 301, headers: { location: "/new-slug/" } });
    },
    // Any accidental cache access immediately fails this regression.
    caches: new Proxy({}, { get() { throw new Error("Legacy must not use CacheStorage"); } }),
  });
  handlers.get("install")!({});
  let activation: Promise<void> | undefined;
  handlers.get("activate")!({ waitUntil: (promise: Promise<void>) => { activation = promise; } });
  await activation;
  assert.ok(skipped && claimed);
  for (const [path, mode, method, expected] of [
    [scope, "navigate", "GET", true],
    [scope + "category", "navigate", "GET", true],
    ["/alpine-lodge", "navigate", "GET", false],
    ["/other-tenant/", "navigate", "GET", false],
    ["/admin/", "navigate", "GET", false],
    [scope + "admin/", "navigate", "GET", false],
    [api, "cors", "GET", false],
    [api + "/weather", "cors", "GET", false],
    [gpx, "cors", "GET", false],
    [scope, "navigate", "POST", false],
    [scope + "image.jpg", "navigate", "GET", false],
  ] as const) {
    let response: Promise<Response> | undefined;
    handlers.get("fetch")!({
      request: { url: origin + path, mode, method },
      respondWith: (promise: Promise<Response>) => { response = promise; },
    });
    assert.equal(!!response, expected, path);
    if (response) assert.equal((await response).status, 301);
  }
  offline = true;
  let failed: Promise<Response> | undefined;
  handlers.get("fetch")!({
    request: { url: origin + scope, mode: "navigate", method: "GET" },
    respondWith: (promise: Promise<Response>) => { failed = promise; },
  });
  await assert.rejects(failed!, /Network unavailable/);
  assert.ok(!script.includes("LG_OFFLINE"));
});