/* Smart360 Living Guide offline b62fb477fba47f8f */
const CFG = {"tenantId":"177e633a-6030-4eca-8ce8-e0a0afdff599","slug":"turizem-drobez","version":"68e23e58c305845c45c3c5fb","languages":["de","en","it","sl"],"gpx":["/api/public/tenants/turizem-drobez/items/144fe650-4b5d-44c4-9911-18c9a4d62ea9/gpx/f40384b7-08f9-4511-af14-1f4cf3a7fd7e"],"essentials":["/brand/smart360-znak-40.png?v=faceted-1","/brand/smart360-kolobar-faceted.svg","/brand/ikona-smart360-home-192.png?v=faceted-1","/brand/ikona-smart360-512.png?v=faceted-1"]};

const ORIGIN = self.location.origin;
const SCOPE = "/" + CFG.slug + "/";
const API = "/api/public/tenants/" + CFG.slug;
const FAMILY = "lg-offline:" + encodeURIComponent(CFG.tenantId) + ":";
const PREFIX = FAMILY + CFG.slug + ":";
const SHELL = PREFIX + CFG.version + ":shell";
const CONTENT = PREFIX + CFG.version + ":content";
const MEDIA = PREFIX + "media";
const META = PREFIX + "media-meta";
// An empty cache is a quota-light cross-worker ownership sentinel. It survives
// worker termination; a runtime-local flag cannot stop an obsolete warm() job.
const OWNERS = FAMILY + "owner:";
const OWNER = OWNERS + CFG.slug + ":" + CFG.version;
const LIMIT = 50 * 1024 * 1024;
const ESSENTIAL_LIMIT = 1024 * 1024;
let retired = false;
let installing = false;
let obsolete = false;
let lastOffline;
let mediaQueue = Promise.resolve();
let warming = null;
const allowedGpx = new Set(CFG.gpx);
const shellAssets = new Set();
const absolute = (value, base = ORIGIN) => new URL(value, base).href;
const safe = (response) => response && response.ok && !response.redirected &&
  response.type !== "opaqueredirect" && response.type !== "opaque";
const redirect = (response) => response && (response.redirected ||
  response.type === "opaqueredirect" || (response.status >= 300 && response.status < 400));
async function ownsCaches() {
  if (retired || obsolete) return false;
  if (installing) return true; // A waiting version may fill only its new version caches.
  try {
    const owners = (await caches.keys()).filter((name) => name.startsWith(OWNERS));
    if (owners.some((name) => name !== OWNER)) obsolete = true;
  } catch { return false; }
  return !obsolete;
}
function scopeUrl(value) {
  try {
    const u = new URL(value);
    return u.origin === ORIGIN && u.pathname.startsWith(SCOPE) &&
      !/\/(?:api|admin|host|portal)(?:\/|$)/i.test(u.pathname) &&
      !u.searchParams.has("preview");
  } catch { return false; }
}
async function sourceAllowed(event) {
  if (event.request.mode === "navigate") return scopeUrl(event.request.url);
  if (!event.clientId) return false;
  try {
    const client = await self.clients.get(event.clientId);
    return !!client && client.type === "window" && scopeUrl(client.url);
  } catch { return false; }
}
async function notify(offline) {
  if (!await ownsCaches() || installing) return;
  lastOffline = offline;
  try {
    for (const client of await self.clients.matchAll({ type: "window", includeUncontrolled: true })) {
      if (scopeUrl(client.url)) client.postMessage({ type: "LG_OFFLINE_STATUS", offline, slug: CFG.slug });
    }
  } catch {}
}
async function purge(names) {
  for (const name of names) { try { await caches.delete(name); } catch {} }
}
async function retire() {
  if (!await ownsCaches()) return; // Never unregister the newer active worker.
  retired = true;
  try { await purge((await caches.keys()).filter((name) => name.startsWith(PREFIX) || name === OWNER)); } catch {}
  try { await self.registration.unregister(); } catch {}
}
async function read(name, key) {
  if (!await ownsCaches()) return undefined;
  try {
    const response = await (await caches.open(name)).match(key);
    if (!await ownsCaches()) {
      if (name === SHELL || name === CONTENT) await caches.delete(name);
      return undefined;
    }
    return response;
  } catch { return undefined; }
}
async function put(name, key, response) {
  if (!safe(response) || !await ownsCaches()) return;
  try {
    await (await caches.open(name)).put(key, response.clone());
    // Activation can run between the first ownership check and open()/put().
    // Cleanup after the write prevents an old in-flight job resurrecting its cache.
    if (!await ownsCaches() && (name === SHELL || name === CONTENT)) await caches.delete(name);
  } catch {}
}
function serializedMedia(work) {
  const task = mediaQueue.then(work, work).catch(() => {});
  mediaQueue = task;
  return task;
}
async function mediaEntries(meta) {
  const entries = [];
  for (const key of await meta.keys()) {
    try {
      const value = await (await meta.match(key)).json();
      if (Number.isFinite(value.bytes) && Number.isFinite(value.used)) entries.push({ key, ...value });
    } catch {}
  }
  return entries.sort((a, b) => a.used - b.used);
}
function saveMedia(key, response, maxBytes = LIMIT) {
  return serializedMedia(async () => {
    // Opaque bodies cannot be measured (and browsers pad them by megabytes).
    // Network-only is safer than pretending their zero-length Blob costs zero.
    if (!safe(response) || !await ownsCaches()) return;
    // Waiting updates leave the incumbent's shared LRU alone. A first install
    // has no owner yet and can precache its lightweight essentials immediately.
    if (installing && (await caches.keys()).some((name) => name.startsWith(OWNERS))) return;
    const bytes = (await response.clone().arrayBuffer()).byteLength + 1024 + key.length * 4;
    if (bytes > Math.min(maxBytes, LIMIT)) return;
    const cache = await caches.open(MEDIA), meta = await caches.open(META);
    let entries = await mediaEntries(meta);
    let total = entries.reduce((sum, item) => sum + item.bytes, 0);
    const old = entries.find((item) => item.key.url === key);
    const previous = old ? await cache.match(key) : undefined;
    if (old) { total -= old.bytes; entries = entries.filter((item) => item !== old); }
    const evict = async () => {
      const item = entries.shift();
      if (!item) return false;
      await cache.delete(item.key);
      await meta.delete(item.key);
      total -= item.bytes;
      return true;
    };
    while (total + bytes > LIMIT) if (!await evict()) return;
    // A quota error may precede our own cap, especially on iOS. Retry after eviction.
    for (;;) {
      if (!await ownsCaches()) return;
      try {
        await cache.put(key, response.clone());
      } catch {
        // Cache.put is atomic. A failed replacement leaves the prior response
        // and its metadata intact; do not delete either or evict more of the guide.
        if (previous) return;
        if (!await evict()) return;
        continue;
      }
      try {
        await meta.put(key, new Response(JSON.stringify({ bytes, used: Date.now() }),
          { headers: { "content-type": "application/json" } }));
        return;
      } catch {
        // Metadata.put is atomic too: its failure retains the previous ledger.
        // Roll back the body to match that ledger whenever storage permits.
        if (previous) {
          try { await cache.put(key, previous.clone()); return; } catch {}
        }
        // No recoverable prior body: discard both sides of this failed write.
        try { await cache.delete(key); await meta.delete(key); } catch {}
        if (previous) return;
        if (!await evict()) return;
      }
    }
  });
}
async function mediaRead(key) {
  let result;
  await serializedMedia(async () => {
    result = await read(MEDIA, key);
    if (!result) return;
    try {
      const meta = await caches.open(META), entry = await meta.match(key);
      if (!entry) { await (await caches.open(MEDIA)).delete(key); result = undefined; return; }
      const data = await entry.json();
      await meta.put(key, new Response(JSON.stringify({ ...data, used: Date.now() })));
    } catch {} // A hit remains useful even if updating its timestamp fails.
  });
  return result;
}
function payloadUrl(url) {
  return url.origin === ORIGIN && url.pathname === API &&
    [...url.searchParams.keys()].every((key) => key === "lang") &&
    (!url.searchParams.has("lang") || CFG.languages.includes(url.searchParams.get("lang")));
}
function kind(request) {
  const url = new URL(request.url);
  if (request.method !== "GET" || request.headers?.has("range")) return null;
  if (url.origin === ORIGIN && url.pathname.startsWith("/api/")) {
    // Public stored-photo variants are images, not application API payloads.
    // Only a real browsed image request gets the scoped, quota-bounded media path.
    if (request.destination === "image" && /^\/api\/storage\/img\/[^/].*/.test(url.pathname)) return "media";
    if (payloadUrl(url)) return "content";
    if (!url.search && allowedGpx.has(url.pathname)) return "content";
    return null;
  }
  if (url.origin === ORIGIN && /\/(?:admin|host|portal)(?:\/|$)/i.test(url.pathname)) return null;
  if (request.mode === "navigate") {
    return scopeUrl(url.href) && !/\.[^/]+$/.test(url.pathname) ? "document" : null;
  }
  if (shellAsset(url.href) && (["script", "style", "font", "worker"].includes(request.destination) ||
      shellAssets.has(url.href) || mapWorkerAsset(url.href))) return "shell";
  // No tile-area or gallery prefetch. Only resources actually requested by this client.
  if (url.protocol === "https:" && (url.hostname === "tiles.openfreemap.org" ||
      url.hostname === "tiles-eu.openfreemap.org")) return "media";
  if (request.destination === "image" && (url.origin === ORIGIN || url.protocol === "https:")) return "media";
  return null;
}
function shellAsset(value) {
  const url = new URL(value, ORIGIN);
  return url.origin === ORIGIN && /^\/assets\/[^?#]+\.(?:m?js|css|woff2?|ttf)$/.test(url.pathname) &&
    !/(?:admin|portal|password-token-page|host-router|landing|fixture|enquiry|privacy|terms)/i.test(url.pathname);
}
function mapWorkerAsset(value) {
  const url = new URL(value, ORIGIN);
  return url.origin === ORIGIN && !url.search &&
    /^\/assets\/maplibre-gl-worker-[a-zA-Z0-9_-]+\.js$/.test(url.pathname);
}
async function canonicalCheck() {
  // Manual redirects preserve historical 301s; never follow them into another scope.
  try {
    const response = await fetch(API, { redirect: "manual", cache: "no-store", credentials: "omit" });
    if (redirect(response) || response.status === 404 || response.status === 410) { await retire(); return false; }
    if (safe(response)) {
      const payload = await response.clone().json();
      if (payload.slug !== CFG.slug || payload.id !== CFG.tenantId || payload.guestUiMode !== "living-guide") {
        await retire(); return false;
      }
    }
    return !retired;
  } catch { return !retired; } // Offline cannot discover a rename.
}
async function networkFirst(request, category, event) {
  if (!await sourceAllowed(event) || !await ownsCaches()) return fetch(request);
  const name = category === "content" ? CONTENT : SHELL;
  const key = request.url;
  let response;
  try { response = await fetch(request, { redirect: "manual" }); }
  catch (error) {
    if (retired) throw error;
    let cached = category === "media" ? await mediaRead(key) : await read(name, key);
    if (!cached && category === "document") cached = await read(SHELL, absolute(SCOPE));
    if (cached && !retired) { await notify(true); return cached; }
    throw error;
  }
  // HTTP errors and redirects are real network responses, never stale-cache successes.
  if (redirect(response)) {
    if (category === "document" || payloadUrl(new URL(key))) await retire();
    return response;
  }
  if ((response.status === 404 || response.status === 410) &&
      (category === "document" || payloadUrl(new URL(key)))) await retire();
  if (safe(response)) {
    if (payloadUrl(new URL(key))) {
      try {
        const payload = await response.clone().json();
        if (payload.slug !== CFG.slug || payload.id !== CFG.tenantId || payload.guestUiMode !== "living-guide") {
          await retire(); return response;
        }
      } catch { return response; }
    }
    if (category === "media") await saveMedia(key, response);
    else await put(name, key, response);
    if (category === "document" || category === "content") await notify(false);
  }
  return response;
}
async function fetchShell(value, visited) {
  const url = absolute(value);
  if (!shellAsset(url) || visited.has(url) || !await ownsCaches()) return;
  visited.add(url); shellAssets.add(url);
  try {
    const response = await fetch(url, { redirect: "manual", credentials: "omit" });
    if (!safe(response)) return;
    await put(SHELL, url, response);
    if (!/\.(?:m?js|css)(?:\?|$)/.test(url)) return;
    const text = await response.text();
    // Vite static imports, lazy import(), and __vite__mapDeps filename arrays.
    // Restrict discovery to emitted assets, excluding isolated non-guest chunks.
    const deps = new Set();
    const quoted = /["']([^"'\s]+\.(?:m?js|css|woff2?|ttf)(?:\?[^"'\s]*)?)["']/g;
    for (const match of text.matchAll(quoted)) {
      const path = match[1];
      if (!path.startsWith(".") && !path.startsWith("/") && !path.startsWith("assets/")) continue;
      const dep = absolute(path, path.startsWith("assets/") ? ORIGIN + "/" : url);
      if (shellAsset(dep)) deps.add(dep);
    }
    const cssUrls = /url\(\s*["']?([^"')\s]+)["']?\s*\)/g;
    if (/\.css(?:\?|$)/.test(url)) for (const match of text.matchAll(cssUrls)) {
      const dep = absolute(match[1], url);
      if (shellAsset(dep)) deps.add(dep);
    }
    for (const dep of deps) await fetchShell(dep, visited);
  } catch {}
}
async function lightweight(response) {
  if (!safe(response) || !response.body) return null;
  if (Number(response.headers.get("content-length")) > ESSENTIAL_LIMIT) {
    void response.body.cancel().catch(() => {}); return null;
  }
  // Stop unknown/chunked large heroes too, rather than downloading a full gallery-sized image.
  const reader = response.body.getReader(), chunks = [];
  let size = 0;
  for (;;) {
    const part = await reader.read();
    if (part.done) break;
    size += part.value.byteLength;
    if (size > ESSENTIAL_LIMIT) { void reader.cancel().catch(() => {}); return null; }
    chunks.push(part.value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return new Response(bytes, { status: response.status, headers: response.headers });
}
async function warm(lang) {
  if (warming) return warming;
  warming = (async () => {
    if (!await ownsCaches()) return;
    if (!await canonicalCheck()) return;
    const visited = new Set();
    try {
      const response = await fetch(SCOPE, { redirect: "manual", credentials: "omit" });
      if (redirect(response)) { await retire(); return; }
      if (safe(response)) {
        await put(SHELL, absolute(SCOPE), response);
        const html = await response.text();
        for (const match of html.matchAll(/<(?:script|link)\b[^>]*(?:src|href)=["']([^"']+)["'][^>]*>/gi)) {
          await fetchShell(absolute(match[1], ORIGIN + SCOPE), visited);
        }
      }
    } catch {}
    const langs = [...new Set([lang, ...CFG.languages])].filter((value) => CFG.languages.includes(value));
    const urls = [API, ...langs.map((value) => API + "?lang=" + value), ...CFG.gpx];
    for (const path of urls) {
      if (!await ownsCaches()) return;
      try {
        const response = await fetch(path, { redirect: "manual", credentials: "omit", cache: "no-store" });
        if (redirect(response) && path.split("?")[0] === API) { await retire(); return; }
        if (safe(response)) {
          if (path.split("?")[0] === API) {
            const payload = await response.clone().json();
            if (payload.slug !== CFG.slug || payload.id !== CFG.tenantId || payload.guestUiMode !== "living-guide") {
              await retire(); return;
            }
          }
          await put(CONTENT, absolute(path), response);
          if (path === API) await notify(false);
        }
        // An offline refresh is itself an actual fallback only when cached content exists.
      } catch { if (await read(CONTENT, absolute(path))) await notify(true); }
    }
    for (const path of CFG.essentials) {
      if (!await ownsCaches()) return;
      try {
        const url = absolute(path);
        if (!/^https?:$/.test(new URL(url).protocol)) continue;
        const response = await fetch(url, { redirect: "manual", mode: "cors", credentials: "omit" });
        const small = await lightweight(response);
        if (small) await saveMedia(url, small, ESSENTIAL_LIMIT);
      } catch {}
    }
  })().catch(() => {}).finally(() => { warming = null; });
  return warming;
}
self.addEventListener("install", (event) => {
  installing = true;
  // First installation must not wait for the entire offline asset graph.
  // The page's ready/controllerchange handlers send LG_OFFLINE_INIT after
  // activation. Updates still warm before replacing an existing offline copy.
  event.waitUntil((async () => {
    if (self.registration.active) await warm("sl");
    await self.skipWaiting();
  })());
});
self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    installing = false;
    if (retired) return;
    try {
      await caches.open(OWNER);
      await purge((await caches.keys()).filter((name) => name.startsWith(FAMILY) &&
        ![SHELL, CONTENT, MEDIA, META, OWNER].includes(name)));
    } catch {}
    if (retired) return;
    await self.clients.claim();
    try {
      for (const client of await self.clients.matchAll({ type: "window", includeUncontrolled: true })) {
        if (scopeUrl(client.url)) client.postMessage({ type: "LG_OFFLINE_VERSION", slug: CFG.slug, version: CFG.version });
      }
    } catch {}
  })());
});
self.addEventListener("message", (event) => {
  const message = event.data;
  if (!message || message.slug !== CFG.slug || !scopeUrl(event.source?.url)) return;
  if (message.type !== "LG_OFFLINE_INIT" && message.type !== "LG_OFFLINE_REFRESH") return;
  event.waitUntil((async () => {
    if (message.type === "LG_OFFLINE_INIT" && typeof lastOffline === "boolean") await notify(lastOffline);
    await warm(CFG.languages.includes(message.lang) ? message.lang : "sl");
  })());
});
self.addEventListener("fetch", (event) => {
  const category = kind(event.request);
  if (category) event.respondWith(networkFirst(event.request, category, event));
});
