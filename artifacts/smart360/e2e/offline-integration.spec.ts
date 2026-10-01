/**
 * One focused suite against an isolated HTTP fixture, complete production App,
 * and actual generated tenant SW. No page.route, DB edits, or real publication.
 * Run from workspace root:
 * pnpm exec playwright test --config artifacts/smart360/e2e/playwright.offline.config.ts
 */
import { test, expect, type Page, type APIRequestContext, type BrowserContext } from "@playwright/test";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { OFFLINE_COPY } from "../src/pages/living-guide/living-guide-offline-model";

const reports = "artifacts/smart360/reports/offline";
async function offline(context: BrowserContext, request: APIRequestContext, down: boolean) {
  await request.post("/__fixture/transport", { data: { down } });
  await context.setOffline(down);
}
test.beforeEach(async ({ request }) => {
  await request.post("/__fixture/transport", { data: { down: false } });
});
test.afterEach(async ({ request }) => {
  await request.post("/__fixture/transport", { data: { down: false } });
});
async function control(request: APIRequestContext, slug: string, changes: Record<string, unknown>) {
  expect((await request.post("/__fixture/control", { data: { slug, ...changes } })).ok()).toBeTruthy();
}
async function instrument(page: Page) {
  await page.addInitScript(() => {
    const evidence = { outbound: [] as any[], inbound: [] as any[], hourly: [] as (() => void)[] };
    (window as any).__offlineEvidence = evidence;
    navigator.serviceWorker.addEventListener("message", event => {
      if (event.data?.type === "OFFLINE_FIXTURE_BOOTSTRAP") evidence.inbound.push(event.data);
    });
    const post = ServiceWorker.prototype.postMessage;
    ServiceWorker.prototype.postMessage = function (message: any, ...args: any[]) {
      evidence.outbound.push(message);
      return (post as any).call(this, message, ...args);
    };
    const interval = window.setInterval.bind(window);
    window.setInterval = ((callback: any, delay?: number, ...args: any[]) => {
      if (delay === 60 * 60_000) evidence.hourly.push(() => callback(...args));
      return interval(callback, delay, ...args);
    }) as typeof window.setInterval;
    // Synthetic local GPS only; no recorded guest data or remote positions.
    let next = 0;
    const watches = new Map<number, number>();
    Object.defineProperty(navigator, "geolocation", { value: {
      watchPosition(success: PositionCallback) {
        const id = ++next; let tick = 0;
        const emit = () => success({
          coords: { latitude: 46.1245 + tick++ * .000025, longitude: 14.461,
            accuracy: 5, altitude: 455 + tick, altitudeAccuracy: 5, heading: 0, speed: 4.4 },
          timestamp: Date.now(),
        } as GeolocationPosition);
        setTimeout(emit, 20); watches.set(id, interval(emit, 500)); return id;
      },
      clearWatch(id: number) { clearInterval(watches.get(id)); watches.delete(id); },
      getCurrentPosition(success: PositionCallback) {
        success({ coords: { latitude: 46.1245, longitude: 14.461, accuracy: 5 }, timestamp: Date.now() } as GeolocationPosition);
      },
    } });
  });
}
async function inventory(page: Page) {
  return page.evaluate(async () => {
    const result: Record<string, string[]> = {};
    for (const name of await caches.keys()) result[name] = (await (await caches.open(name)).keys()).map(r => new URL(r.url).pathname + new URL(r.url).search);
    return result;
  });
}
async function visit(page: Page, slug: string, lang = "sl") {
  await instrument(page);
  await page.goto(`/${slug}/?lang=${lang}`);
  await expect(page.getByTestId("screen-cover")).toBeVisible();
  await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller?.scriptURL ?? ""), { timeout: 45_000 }).toContain(`/${slug}/sw.js`);
  await expect.poll(async () => Object.entries(await inventory(page))
    .filter(([name]) => name.includes(`:${slug}:`) && name.endsWith(":content")).flatMap(([, keys]) => keys)
    .filter(key => key.includes("/gpx/")).length).toBe(1);
}
async function snap(page: Page, name: string) {
  // Visibility does not imply unobscured: startup splash can cover a mounted
  // guide/banner for ~3 seconds. Never accept screenshots of that overlay.
  await expect(page.locator(".guest-entry-splash")).toHaveCount(0, { timeout: 10_000 });
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  });
  if (name.startsWith("banner-")) {
    const banner = page.getByTestId("banner-guide-offline");
    await expect(banner).toBeVisible();
    await expect.poll(() => banner.evaluate(element => {
      const rect = element.getBoundingClientRect();
      const hit = document.elementFromPoint(rect.left + rect.width / 2, 10);
      return !!hit && (hit === element || element.contains(hit));
    }), { message: "Offline banner must win real hit testing at its horizontal center, y=10" }).toBe(true);
  }
  await mkdir(reports, { recursive: true });
  await page.screenshot({ path: `${reports}/${name}.png` });
}
async function proveMapDrawing(page: Page, surface: "gpx" | "free") {
  const mapElement = page.getByTestId("map-gpx");
  // This is the live DOM MapLibre marker, not Recharts' elevation reference dot.
  await expect(mapElement.locator(".s360-gpx-marker--me")).toBeVisible();
  const marker = await mapElement.locator(".s360-gpx-marker--me").boundingBox();
  expect(marker!.width).toBeGreaterThan(0);
  expect(marker!.x).toBeGreaterThanOrEqual(0);
  expect(marker!.y).toBeGreaterThanOrEqual(0);
  expect(marker!.x + marker!.width).toBeLessThanOrEqual(390);
  expect(marker!.y + marker!.height).toBeLessThanOrEqual(844);
  const inspect = () => mapElement.evaluate(async element => {
    const map = (element as any).__offlineTestMap;
    if (!map?.getLayer("tour-line")) return null;
    return new Promise<any>(resolve => {
      map.once("render", () => {
        const canvas = map.getCanvas() as HTMLCanvasElement;
        const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
        if (!gl) return resolve({ error: "WebGL context unavailable" });
        const pixels = new Uint8Array(gl.drawingBufferWidth * gl.drawingBufferHeight * 4);
        gl.readPixels(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
        let plannedPixels = 0, recordedPixels = 0, neutralPixels = 0;
        for (let i = 0; i < pixels.length; i += 4) {
          const matches = (r: number, g: number, b: number) =>
            Math.abs(pixels[i]! - r) < 5 && Math.abs(pixels[i + 1]! - g) < 5 && Math.abs(pixels[i + 2]! - b) < 5 && pixels[i + 3]! > 240;
          if (matches(21, 115, 71)) plannedPixels++;
          if (matches(18, 26, 20)) recordedPixels++;
          if (matches(244, 246, 242)) neutralPixels++;
        }
        const style = map.getStyle();
        resolve({
          plannedPixels, recordedPixels, neutralPixels,
          sourceGeometry: {
            planned: style.sources.gpx?.data?.geometry,
            recorded: style.sources.tour?.data?.geometry,
          },
          plannedRenderedFeatures: map.queryRenderedFeatures({ layers: ["gpx-line"] }).length,
          recordedRenderedFeatures: map.queryRenderedFeatures({ layers: ["tour-line"] }).length,
          neutralFallback: !!map.getLayer("offline-background"),
          canvas: { width: canvas.width, height: canvas.height },
        });
      });
      map.triggerRepaint();
    });
  });
  await mkdir(reports, { recursive: true });
  try {
    await expect.poll(async () => (await inspect())?.recordedPixels ?? 0).toBeGreaterThan(2);
  } finally {
    await writeFile(`${reports}/offline-${surface}-map-diagnostic.json`, JSON.stringify({
      render: await inspect(),
      workerRequests: await page.evaluate(() => (window as any).__offlineEvidence.inbound),
    }, null, 2));
  }
  if (surface === "gpx") await expect.poll(async () => (await inspect())?.plannedPixels ?? 0).toBeGreaterThan(30);
  const evidence = await inspect();
  expect(evidence.neutralFallback).toBe(true);
  expect(evidence.neutralPixels).toBeGreaterThan(1000);
  expect(evidence.recordedRenderedFeatures).toBeGreaterThan(0);
  expect(evidence.sourceGeometry.recorded.coordinates.flat().length).toBeGreaterThan(3);
  if (surface === "gpx") {
    expect(evidence.plannedRenderedFeatures).toBeGreaterThan(0);
    expect(evidence.sourceGeometry.planned.coordinates.flat()).toHaveLength(4);
  }
  await mkdir(reports, { recursive: true });
  await writeFile(`${reports}/offline-${surface}-map-evidence.json`, JSON.stringify({ marker, ...evidence }, null, 2));
}
async function proveColdBrandImages(page: Page) {
  const assets = ["/brand/smart360-znak-40.png", "/brand/smart360-kolobar-temno.svg"];
  const keys = Object.values(await inventory(page)).flat();
  for (const asset of assets) expect(keys).toContain(asset);
  expect(await page.evaluate(async assets => Promise.all(assets.map(src => new Promise<boolean>(resolve => {
    const img = new Image();
    img.onload = () => resolve(img.naturalWidth > 0);
    img.onerror = () => resolve(false);
    img.src = src;
  }))), assets)).toEqual([true, true]);
}
async function recordTour(page: Page, surface: "gpx" | "free") {
  if (surface === "free") {
    await page.getByRole("tab", { name: "Kolesarjenje", exact: true }).click();
    await page.getByTestId("button-free-tour-start").click();
  } else {
    await expect(page.getByTestId("profile-normal")).toBeVisible();
    await expect(page.getByTestId("profile-normal").locator(".recharts-area")).toBeVisible();
    await page.getByTestId("button-tour-start").click();
  }
  const profile = page.getByTestId("button-tour-profile-skip");
  if (await profile.isVisible()) await profile.click();
  await expect(page.getByTestId("panel-tour-live")).toHaveAttribute("data-status", "moving");
  const state = () => page.evaluate(() => {
    const key = Object.keys(localStorage).find(k => k.startsWith("smart360:live-tour:"));
    return key ? JSON.parse(localStorage.getItem(key)!).state : null;
  });
  await expect.poll(async () => (await state())?.points.length ?? 0).toBeGreaterThan(3);
  const first = await state();
  await expect.poll(async () => (await state())?.distanceM ?? 0).toBeGreaterThan(first.distanceM);
  await page.getByTestId("button-tour-fullscreen").click();
  const timer = page.getByTestId("text-tour-overlay-net");
  const before = await timer.textContent();
  await expect.poll(() => timer.textContent()).not.toBe(before);
  await proveMapDrawing(page, surface);
  await snap(page, `offline-${surface}-timer`);
  if (surface === "gpx") {
    await expect(page.getByTestId("profile-fullscreen").locator(".recharts-reference-dot")).toBeVisible();
  }
  await page.locator(".s360-gpx-full-exit").click();
  await page.getByTestId("button-tour-finish").click();
  await expect(page.getByTestId("panel-tour-result")).toBeVisible();
  for (const format of ["gpx", "image"] as const) {
    const downloaded = page.waitForEvent("download");
    await page.getByTestId(`button-tour-download-${format}`).click();
    const download = await downloaded;
    const path = `${reports}/${surface}-${download.suggestedFilename()}`;
    await download.saveAs(path);
    const bytes = await readFile(path);
    expect(bytes.byteLength).toBeGreaterThan(100);
    if (format === "gpx") expect(bytes.toString()).toContain("<trkpt");
    else expect(bytes.subarray(1, 4).toString()).toBe("PNG");
  }
}

test("one online visit caches complete App dependencies; cold offline Explore navigation, GPX profile/position/timer and exports", async ({ page, context, request }, info) => {
  const slug = "offline-tour";
  await visit(page, slug);
  const cache = await inventory(page);
  const shell = Object.entries(cache).filter(([name]) => name.endsWith(":shell")).flatMap(([, keys]) => keys);
  expect(shell.some(key => /\.js$/.test(key))).toBeTruthy();
  expect(shell.some(key => /\.css$/.test(key))).toBeTruthy();
  expect(shell.filter(key => /admin|portal|host-router|landing|fixture/i.test(key))).toEqual([]);
  // Disable HTTP disk/memory cache, so successful offline rendering proves SW dependencies.
  const cdp = await context.newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.clearBrowserCache");
  await cdp.detach();
  await offline(context, request, true);
  await page.goto(`/${slug}/s/explore?lang=sl`);
  await proveColdBrandImages(page);
  await expect(page.getByTestId("banner-guide-offline")).toHaveText(OFFLINE_COPY.sl.banner);
  await page.getByRole("tab", { name: "Pohodništvo", exact: true }).click();
  await page.getByRole("button", { name: "TEST pohod A", exact: true }).click();
  await recordTour(page, "gpx");
  const original = await page.evaluate(async slug => (await fetch(`/api/public/tenants/${slug}/items/i-hike-1/gpx/fixture-gpx`)).text(), slug);
  expect(original).toContain("<trkpt");
  // A fresh document direct detail URL must not rely on in-memory sheet history.
  await page.goto(`/${slug}/c/c-hike/i/i-hike-1?lang=sl`);
  await expect(page.getByTestId("profile-normal")).toBeVisible();
  await expect(page.getByTestId("banner-guide-offline")).toBeVisible();
  await snap(page, "offline-gpx-cold-detail");
  await info.attach("real-cache-inventory", { body: JSON.stringify(cache, null, 2), contentType: "application/json" });
});

test("free recording works on first offline opening and exports GPX/image", async ({ page, context, request }) => {
  await visit(page, "offline-free");
  await offline(context, request, true);
  await page.goto("/offline-free/s/explore?lang=sl");
  await proveColdBrandImages(page);
  await recordTour(page, "free");
});

for (const lang of ["sl", "en", "de", "it"] as const) {
  test(`${lang}: real fallback banner is slim/neutral, disappears online; message fails locally without outbox`, async ({ page, context, request }) => {
    const slug = `offline-copy-${lang}`;
    await visit(page, slug, lang);
    await offline(context, request, true);
    await page.goto(`/${slug}/messages?lang=${lang}`);
    const banner = page.getByTestId("banner-guide-offline");
    await expect(banner).toHaveText(OFFLINE_COPY[lang].banner);
    const style = await banner.evaluate(el => {
      const css = getComputedStyle(el), app = getComputedStyle(el.closest(".lg2-app")!);
      return { background: css.backgroundColor, color: css.color, card: app.getPropertyValue("--card").trim(),
        text: app.getPropertyValue("--tx2").trim(), height: el.getBoundingClientRect().height,
        top: el.getBoundingClientRect().top, fontSize: css.fontSize };
    });
    expect(style.height).toBeLessThan(75);
    expect(style.top).toBeLessThan(2);
    const rgb = style.background.match(/\d+/g)!.map(Number);
    expect(Math.max(...rgb.slice(0, 3)) - Math.min(...rgb.slice(0, 3))).toBeLessThan(35);
    await mkdir(reports, { recursive: true });
    await writeFile(`${reports}/banner-${lang}-style.json`, JSON.stringify(style, null, 2));
    await snap(page, `banner-${lang}`);
    await page.getByTestId("messages-composer").locator("input").fill("Synthetic offline draft");
    await page.getByTestId("messages-composer").locator("input").press("Enter");
    await expect(page.getByTestId("messages-send-error")).toContainText(OFFLINE_COPY[lang].retry);
    await snap(page, `offline-message-${lang}`);
    await offline(context, request, false);
    await expect(banner).toHaveCount(0);
    const traffic = await (await request.get("/__fixture/traffic")).json();
    expect(traffic.filter((row: any) => row.method === "POST" && row.path.includes(slug))).toEqual([]);
  });

  test(`${lang}: offline order notice after real local guest sign-in; no queued submission on reconnect`, async ({ page, context, request }) => {
    const slug = `offline-order-${lang}`;
    await visit(page, slug, lang);
    await page.goto(`/${slug}/c/c-house/i/i-quiet?lang=${lang}`);
    await page.getByTestId("order-cta-i-quiet").click();
    // The real first-order flow collects local guest identity before OrderSheet.
    // This synthetic tenant requires no guest password; no admin login exists.
    const signin = page.locator('form[aria-labelledby="lg2-welcome-title"]');
    await signin.locator('input[autocomplete="off"]').fill("TEST");
    await signin.locator('input[autocomplete="name"]').fill("Synthetic visitor");
    await signin.getByTestId("guest-phone").fill("000000000");
    await signin.locator('button[type="submit"]').click();
    await expect(page.getByTestId("order-form")).toBeVisible();
    await offline(context, request, true);
    // Real form fields are filled to avoid native HTML validation preventing submit.
    const form = page.getByTestId("order-form");
    await form.getByTestId("input-guest-name").fill("Synthetic visitor");
    await form.getByTestId("input-guest-unit").fill("TEST");
    await form.getByTestId("input-guest-phone").fill("000000000");
    await form.locator('button[type="submit"]').click();
    await expect(form).toContainText(OFFLINE_COPY[lang].retry);
    await snap(page, `offline-order-${lang}`);
    await offline(context, request, false);
    const traffic = await (await request.get("/__fixture/traffic")).json();
    expect(traffic.filter((row: any) => row.method === "POST" && row.path.includes(slug))).toEqual([]);
  });
}

test("synthetic snapshot version changes: next online visit and actual hourly registration callback refresh", async ({ page, request }) => {
  const slug = "offline-version";
  await visit(page, slug);
  const original = Object.keys(await inventory(page)).find(k => k.endsWith(":content"));
  await control(request, slug, { revision: 2 });
  await page.reload();
  await expect(page.getByTestId("screen-cover")).toContainText("v2");
  await expect.poll(async () => Object.keys(await inventory(page)).filter(k => k.endsWith(":content")), { timeout: 45_000 }).not.toContain(original);
  const version2 = Object.keys(await inventory(page)).find(k => k.endsWith(":content"));
  await expect.poll(() => page.evaluate(() => (window as any).__offlineEvidence.hourly.length)).toBeGreaterThan(0);
  await control(request, slug, { revision: 3 });
  // Invoke the product's captured one-hour callback (not a forged message).
  await page.evaluate(() => (window as any).__offlineEvidence.hourly.forEach((fn: () => void) => fn()));
  await expect.poll(() => page.evaluate(() => (window as any).__offlineEvidence.outbound.some((m: any) => m.type === "LG_OFFLINE_REFRESH"))).toBeTruthy();
  await expect(page.getByTestId("screen-cover")).toContainText("v3", { timeout: 45_000 });
  await expect.poll(async () => Object.keys(await inventory(page)).filter(k => k.endsWith(":content"))).not.toContain(version2);
});

test("admin, API mutations, weather, other tenants and 301 never gain cache fallback; blank browser has no scope", async ({ page, context, browser, request }) => {
  const slug = "offline-safety";
  await visit(page, slug);
  const paths = ["/admin/settings", "/api/admin/tenants", `/api/public/tenants/${slug}/weather`,
    `/api/public/tenants/${slug}/messages`, "/api/public/tenants/other-tenant?lang=sl", "/fixture-301"];
  for (const path of paths) await page.evaluate(async path => { await fetch(path); }, path);
  await page.evaluate(async slug => { await fetch(`/api/public/tenants/${slug}/messages`, { method: "POST", body: "{}" }); }, slug);
  const keys = Object.values(await inventory(page)).flat();
  for (const path of paths) expect(keys).not.toContain(path);
  await offline(context, request, true);
  for (const path of paths) {
    expect(await page.evaluate(async path => { try { await fetch(path); return "network"; } catch { return "failed"; } }, path)).toBe("failed");
  }
  expect(await page.evaluate(async slug => { try { await fetch(`/api/public/tenants/${slug}/messages`, { method: "POST" }); return true; } catch { return false; } }, slug)).toBeFalsy();
  const outsider = await context.newPage();
  await offline(context, request, false);
  await outsider.goto("/unrelated-tenant/");
  expect(await outsider.evaluate(() => navigator.serviceWorker.controller?.scriptURL)).toBeUndefined();
  const blank = await browser.newContext();
  try {
    const fresh = await blank.newPage();
    await fresh.goto("http://127.0.0.1:4193/__fixture/health");
    expect(await fresh.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).length)).toBe(0);
    await blank.setOffline(true);
    await expect(fresh.goto(`http://127.0.0.1:4193/${slug}/`)).rejects.toThrow();
  } finally { await blank.close(); }
});

test("real cache media LRU under injected 16KiB cap and quota-denied writes degrade to network", async ({ page, request, context }) => {
  const slug = "offline-lru";
  await control(request, slug, { limit: 16 * 1024 });
  await visit(page, slug);
  const image = (name: string) => page.evaluate(name => new Promise<void>((resolve, reject) => {
    const img = new Image(); img.onload = () => resolve(); img.onerror = () => reject(new Error("image failed"));
    img.src = `/fixture-media/${name}.svg?bytes=5500`; document.body.append(img);
  }), name);
  await image("a"); await image("b");
  await offline(context, request, true);
  await image("a"); // actual cache hit touches A, so B must be evicted before A
  await offline(context, request, false);
  await image("c");
  const media = Object.entries(await inventory(page)).find(([name]) => name.endsWith(":media"))![1];
  expect(media.some(key => key.includes("/a.svg"))).toBeTruthy();
  expect(media.some(key => key.includes("/b.svg"))).toBeFalsy();
  expect(media.some(key => key.includes("/c.svg"))).toBeTruthy();
  const total = await page.evaluate(async () => {
    const name = (await caches.keys()).find(k => k.endsWith(":media-meta"))!;
    const cache = await caches.open(name);
    return (await Promise.all((await cache.keys()).map(async key => (await (await cache.match(key))!.json()).bytes))).reduce((a, b) => a + b, 0);
  });
  expect(total).toBeLessThanOrEqual(16 * 1024);
  await control(request, "offline-quota", { quota: true });
  await page.goto("/offline-quota/?lang=sl");
  await expect(page.getByTestId("screen-cover")).toContainText("offline-quota");
  await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller?.scriptURL ?? "")).toContain("offline-quota/sw.js");
  await page.reload();
  await expect(page.getByTestId("screen-cover")).toBeVisible();
  const quotaKeys = Object.entries(await inventory(page)).filter(([name]) => name.includes(":offline-quota:")).flatMap(([, keys]) => keys);
  expect(quotaKeys).toEqual([]);
});

test("synthetic slug rename retires old scope and purges old caches after canonical tombstone", async ({ page, request }) => {
  const slug = "offline-rename";
  await visit(page, slug);
  await control(request, slug, { renamed: `${slug}-renamed` });
  await page.evaluate(slug => navigator.serviceWorker.controller!.postMessage({ type: "LG_OFFLINE_REFRESH", slug, lang: "sl" }), slug);
  await expect.poll(async () => Object.keys(await inventory(page)).filter(name => name.includes(`:${slug}:`))).toEqual([]);
  await expect.poll(() => page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).map(r => r.scope))).toEqual([]);
  const response = await request.get(`/${slug}/`, { maxRedirects: 0 });
  expect(response.status()).toBe(301);
  await page.goto(`/${slug}-renamed/?lang=sl`);
  await expect(page.getByTestId("screen-cover")).toContainText(`${slug}-renamed`);
});

test("actual storage image endpoint is cached only once viewed and works with transport cut", async ({ page, context, request }) => {
  await visit(page, "offline-storage");
  const path = "/api/storage/img/synthetic-browsed-photo?w=1400";
  const load = () => page.evaluate(path => new Promise<void>((resolve, reject) => {
    const img = new Image(); img.onload = () => resolve(); img.onerror = () => reject(new Error("Viewed image unavailable"));
    img.src = path; document.body.append(img);
  }), path);
  expect(Object.values(await inventory(page)).flat()).not.toContain(path);
  await load();
  await expect.poll(async () => Object.values(await inventory(page)).flat()).toContain(path);
  await offline(context, request, true);
  const cdp = await context.newCDPSession(page);
  await cdp.send("Network.clearBrowserCache");
  await cdp.detach();
  await load();
});

test("cover revisit does not preload or cache an unopened full gallery", async ({ page }) => {
  await visit(page, "offline-gallery");
  await page.reload();
  await expect(page.getByTestId("screen-cover")).toBeVisible();
  // Wait for two paint frames and all requested image loads; never open the item.
  await page.evaluate(async () => {
    await Promise.all([...document.images].map(img => img.decode().catch(() => {})));
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  });
  const unviewed = Object.values(await inventory(page)).flat().filter(path => path.includes("unviewed-gallery"));
  expect(unviewed, "No unopened gallery may be precached by shell image warming").toEqual([]);
});