import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { getGetPublicTenantUrl } from "@workspace/api-client-react";
import {
  canRegisterLivingGuideWorker,
  canRegisterGuestWorker,
  isOfflineFailure,
  offlineCopy,
  OFFLINE_COPY,
  reduceOfflineState,
} from "../pages/living-guide/living-guide-offline-model";
import { registerLivingGuideWorker, registerPassthroughGuestWorker, subscribeLivingGuideOfflineStatus } from "../pages/living-guide/living-guide-worker-registration";

test("only an actual fallback claims a saved copy; online clears immediately", () => {
  const initial = { cached: false, disconnected: false };
  const offline = reduceOfflineState(initial, { type: "offline" });
  assert.deepEqual(offline, { cached: false, disconnected: true });
  assert.deepEqual(reduceOfflineState(initial, { type: "network-failure" }), offline);
  const cached = reduceOfflineState(offline, { type: "status", offline: true });
  assert.deepEqual(cached, { cached: true, disconnected: true });
  assert.deepEqual(reduceOfflineState(cached, { type: "online" }), initial);
  assert.deepEqual(reduceOfflineState(cached, { type: "status", offline: false }), initial);
});

test("banner and retry copy cover all four languages, with exact Slovenian banner", () => {
  assert.equal(offlineCopy("sl").banner, "Ni povezave — vodnik deluje iz shranjene kopije.");
  assert.equal(offlineCopy("unsupported"), OFFLINE_COPY.sl);
  assert.equal(new Set(Object.values(OFFLINE_COPY).map((copy) => copy.banner)).size, 7);
  assert.equal(new Set(Object.values(OFFLINE_COPY).map((copy) => copy.retry)).size, 7);
});

test("network drop is friendly even when the browser still reports online; HTTP errors retain their semantics", () => {
  for (const error of [new TypeError("Failed to fetch"), new TypeError("Load failed"), new Error("Network request failed")]) {
    assert.equal(isOfflineFailure(error, true), true);
  }
  assert.equal(isOfflineFailure(new Error("other"), false), true);
  assert.equal(isOfflineFailure({ status: 403, message: "Forbidden" }, false), false);
  assert.equal(isOfflineFailure({ status: 429 }, true), false);
  assert.equal(isOfflineFailure(new Error("Order response did not include a reference"), true), false);
  assert.equal(isOfflineFailure({ name: "AbortError" }, true), false);
});

test("registration excludes previews, alias slugs, custom-domain root and legacy modes", () => {
  const canonical = { slug: "test-guide", tenantSlug: "test-guide", mode: "living-guide", pathname: "/test-guide/home", search: "?lang=en" };
  assert.equal(canRegisterLivingGuideWorker(canonical), true);
  assert.equal(canRegisterGuestWorker({ ...canonical, mode: "swipe" }), true);
  assert.equal(canRegisterGuestWorker({ ...canonical, mode: "legacy" }), true);
  assert.equal(canRegisterGuestWorker({ ...canonical, pathname: "/" }), false);
  assert.equal(canRegisterGuestWorker({ ...canonical, search: "?preview=1" }), false);
  for (const patch of [
    { mode: "swipe" }, { mode: "legacy" }, { mode: undefined },
    { tenantSlug: "renamed" }, { pathname: "/" }, { pathname: "/test-guide" },
    { pathname: "/test-guide-other/home" }, { search: "?preview=1" },
    { search: "?preview=0" }, { search: "?ui=living-guide" },
  ]) assert.equal(canRegisterLivingGuideWorker({ ...canonical, ...patch }), false);
});

test("Swipe/legacy retains registration and hourly updates without any offline protocol", async () => {
  const originals = ["window", "document", "navigator"].map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const);
  let updates = 0;
  let posts = 0;
  let interval: (() => void) | undefined;
  const registration = {
    active: { postMessage: () => { posts++; } },
    update: async () => { updates++; },
  };
  const doc = Object.assign(new EventTarget(), { visibilityState: "visible" });
  const sw = Object.assign(new EventTarget(), {
    controller: registration.active,
    ready: Promise.resolve(registration),
    register: async (path: string, options: any) => {
      assert.equal(path, "/api/public/tenants/legacy-guide/sw.js");
      assert.deepEqual(options, { scope: "/legacy-guide/", updateViaCache: "none" });
      return registration;
    },
  });
  Object.defineProperty(globalThis, "window", { configurable: true, value: {
    setInterval: (callback: () => void, ms: number) => {
      assert.equal(ms, 60 * 60_000);
      interval = callback;
      return 123;
    },
    clearInterval: () => {},
  } });
  Object.defineProperty(globalThis, "document", { configurable: true, value: doc });
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: { serviceWorker: sw } });
  try {
    const cleanup = registerPassthroughGuestWorker("legacy-guide");
    await new Promise((resolve) => setImmediate(resolve));
    interval?.();
    doc.dispatchEvent(new Event("visibilitychange"));
    sw.dispatchEvent(new Event("controllerchange"));
    assert.equal(updates, 2);
    assert.equal(posts, 0);
    doc.visibilityState = "hidden";
    interval?.();
    assert.equal(updates, 2);
    cleanup();
    doc.visibilityState = "visible";
    doc.dispatchEvent(new Event("visibilitychange"));
    assert.equal(updates, 2);
  } finally {
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});

test("first visit primes controller and ready active, refreshes hourly/visible, and cleans up without reload", async () => {
  const originals = ["window", "document", "navigator"].map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const);
  const sent: Array<{ target: string; type: string; slug: string; lang: string }> = [];
  const worker = (target: string) => ({
    scriptURL: "https://example.test/api/public/tenants/test-guide/sw.js",
    postMessage: (message: any) => sent.push({ target, ...message }),
  });
  const controller = worker("controller");
  const active = worker("active");
  let updates = 0;
  let versions = 0;
  let interval: (() => void) | undefined;
  let intervalCleared = false;
  let registered = false;
  const registration = { scope: "https://example.test/test-guide/", active, update: async () => { updates++; } };
  const sw = Object.assign(new EventTarget(), {
    controller,
    ready: Promise.resolve(registration),
    register: async (path: string, options: any) => {
      assert.equal(path, "/api/public/tenants/test-guide/sw.js");
      assert.deepEqual(options, { scope: "/test-guide/", updateViaCache: "none" });
      registered = true;
      return registration;
    },
  });
  const doc = Object.assign(new EventTarget(), { visibilityState: "visible" });
  Object.defineProperty(globalThis, "window", { configurable: true, value: {
    location: { origin: "https://example.test" },
    setInterval: (callback: () => void, milliseconds: number) => {
      assert.equal(milliseconds, 60 * 60_000);
      interval = callback;
      return 123;
    },
    clearInterval: () => { intervalCleared = true; },
  } });
  Object.defineProperty(globalThis, "document", { configurable: true, value: doc });
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: { serviceWorker: sw } });
  try {
    const cleanup = registerLivingGuideWorker("test-guide", "de", () => { versions++; });
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(registered, true);
    assert.ok(sent.some((message) => message.target === "controller" && message.type === "LG_OFFLINE_INIT"));
    assert.ok(sent.some((message) => message.target === "active" && message.type === "LG_OFFLINE_INIT"));
    assert.ok(sent.every((message) => message.slug === "test-guide" && message.lang === "de"));
    const beforeClaim = sent.length;
    sw.dispatchEvent(new Event("controllerchange"));
    assert.ok(sent.length > beforeClaim);
    interval?.();
    doc.dispatchEvent(new Event("visibilitychange"));
    assert.equal(updates, 2);
    assert.ok(sent.some((message) => message.type === "LG_OFFLINE_REFRESH"));
    doc.visibilityState = "hidden";
    interval?.();
    assert.equal(updates, 2);
    for (const slug of ["other", "test-guide", "test-guide"]) {
      sw.dispatchEvent(new MessageEvent("message", { data: { type: "LG_OFFLINE_VERSION", slug, version: "v2" } }));
    }
    assert.equal(versions, 1);
    cleanup();
    const count = sent.length;
    sw.dispatchEvent(new Event("controllerchange"));
    assert.equal(sent.length, count);
    assert.equal(intervalCleared, true);
  } finally {
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});

test("weather suppression precedes cached-query display and mutations never queue for reconnect", () => {
  const source = (name: string) => readFileSync(new URL(`../pages/living-guide/${name}`, import.meta.url), "utf8");
  const weather = source("living-guide-weather.tsx");
  assert.match(weather, /enabled: !disconnected && !useOverride/);
  assert.match(weather, /const weather = disconnected \? null : usableWeather/);
  for (const filename of ["living-guide-messages.tsx", "living-guide-order-sheet.tsx"]) {
    const component = source(filename);
    assert.match(component, /networkMode: "always"/);
    assert.match(component, /retry: false/);
    assert.match(component, /isOfflineFailure\(error, navigator.onLine\)/);
    assert.match(component, /offlineCopy\(lang\)\.retry/);
  }
  const css = source("living-guide-guest.css");
  const banner = css.slice(css.indexOf(".lg2-offline-banner {"), css.indexOf(".lg2-app:has(> .lg2-offline-banner) >"));
  assert.match(banner, /background: var\(--card\)/);
  assert.match(banner, /color: var\(--tx2\)/);
  assert.doesNotMatch(banner, /amber|#F2B135|#DD9A2B/i);
});

test("non-guest routes are lazy imports, not eager guest-shell dependencies", () => {
  const app = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");
  for (const component of ["Landing", "AdminRouter", "PasswordTokenPage", "TermsPage", "EnquiryPage", "PrivacyPage"]) {
    assert.match(app, new RegExp(`const ${component} = lazy\\(`));
    assert.doesNotMatch(app, new RegExp(`import (?:\\{ )?${component}`));
  }
});

test("published tenant URLs omit preview entirely; genuine previews retain bypass", () => {
  for (const isPreview of [false, true]) {
    const url = new URL(getGetPublicTenantUrl("test-guide", {
      lang: "en", preview: isPreview ? true : undefined,
    }), "https://example.test");
    assert.equal(url.searchParams.has("preview"), isPreview);
    assert.equal(url.searchParams.get("preview"), isPreview ? "true" : null);
    assert.equal(url.searchParams.get("lang"), "en");
  }
  for (const file of ["../App.tsx", "../pages/guest/guest-layout.tsx"]) {
    const source = readFileSync(new URL(file, import.meta.url), "utf8");
    assert.match(source, /preview: isPreview \? true : undefined/);
    assert.doesNotMatch(source, /preview: isPreview\s*[,}]/);
  }
});

test("lazy offline provider subscribes before replay handshake, recovering a missed cold-boot fallback", () => {
  const originals = ["window", "navigator"].map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const);
  const statuses: boolean[] = [];
  const sw = Object.assign(new EventTarget(), {
    controller: {
      scriptURL: "https://example.test/api/public/tenants/test-guide/sw.js",
      postMessage: (message: any) => {
        assert.deepEqual(message, { type: "LG_OFFLINE_INIT", slug: "test-guide", lang: "it" });
        // Synchronous response intentionally stresses subscribe-before-request.
        sw.dispatchEvent(new MessageEvent("message", {
          data: { type: "LG_OFFLINE_STATUS", slug: "test-guide", offline: true },
        }));
      },
    },
  });
  Object.defineProperty(globalThis, "window", { configurable: true, value: {
    location: { origin: "https://example.test", pathname: "/test-guide/messages", search: "?lang=it" },
  } });
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: { serviceWorker: sw, onLine: true } });
  try {
    // Navigation fallback broadcast happened before the lazy provider existed.
    sw.dispatchEvent(new MessageEvent("message", {
      data: { type: "LG_OFFLINE_STATUS", slug: "test-guide", offline: true },
    }));
    assert.deepEqual(statuses, []);
    const cleanup = subscribeLivingGuideOfflineStatus("test-guide", "it", (offline) => statuses.push(offline));
    assert.deepEqual(statuses, [true]);
    sw.dispatchEvent(new MessageEvent("message", {
      data: { type: "LG_OFFLINE_STATUS", slug: "other", offline: false },
    }));
    assert.deepEqual(statuses, [true]);
    cleanup();
    sw.dispatchEvent(new MessageEvent("message", {
      data: { type: "LG_OFFLINE_STATUS", slug: "test-guide", offline: false },
    }));
    assert.deepEqual(statuses, [true]);
  } finally {
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});

test("cold category/item links render the detail layer without SPA history and normalize safe Home return", () => {
  const shell = readFileSync(new URL("../pages/living-guide/LivingGuideGuestShell.tsx", import.meta.url), "utf8");
  assert.match(shell, /\(detailPresentationRequested \|\| screen === "detail"\) && canRenderDetailSheet/);
  assert.match(shell, /screen === "detail" \? "home" : screen/);
  assert.match(shell, /if \(screen === "detail" && !detailPresentationRequested\)/);
  assert.match(shell, /detailSourceLocationRef\.current = `\/\$\{slug\}\/home`/);
  assert.match(shell, /livingGuideDirectEntry: true/);
  assert.match(shell, /if \(window\.history\.state\?\.livingGuideDirectEntry\) \{\s*closePresentedView\(`\/\$\{slug\}\/home`\)/);
});

test("Living Guide cover never eagerly requests unopened category/item galleries", () => {
  const shell = readFileSync(new URL("../pages/living-guide/LivingGuideGuestShell.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(shell, /detailHeroUrls|preloadedDetailImagesRef|new Image\(/);
  // Preserve the existing first-screen readiness gate for the viewed detail.
  assert.match(shell, /firstScreenImages\.map\(\(image\) => image\.decode\(\)/);
  assert.match(shell, /<CoverView tenant=\{tenant\}/);
});