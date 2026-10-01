/**
 * Run against the ALREADY-RUNNING development preview:
 * SMART360_E2E_URL=https://... PLAYWRIGHT_CHROMIUM_EXECUTABLE=$(command -v chromium)
 * pnpm exec playwright test --config playwright.smart360.config.ts sos-integration --project chromium
 * Synthetic GPS only. This suite neither publishes nor writes tenant data.
 */
import { test, expect, type Page } from "@playwright/test";
import { sosT } from "../src/pages/living-guide/sos/sos-i18n";
import { smsText } from "../src/pages/living-guide/sos/sos-model";
import { writeFile } from "node:fs/promises";

type Traffic = { kind: string; url: string; body: string };

async function mockDevice(page: Page, state: "active" | "acquiring" | "denied" = "active", moving = false) {
  await page.addInitScript(({ state, moving }) => {
    const device = {
      next: 0, watches: [] as number[], cleared: [] as number[],
      copies: [] as string[], shares: [] as ShareData[], beacons: [] as { url: string; body: string }[],
    };
    (window as any).__sosTestDevice = device;
    const timers = new Map<number, ReturnType<typeof setInterval>>();
    const geo = {
      watchPosition(success: PositionCallback, error?: PositionErrorCallback) {
        const id = ++device.next;
        device.watches.push(id);
        if (state === "denied") {
          setTimeout(() => error?.({ code: 1, message: "Fixture denied", PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 }), 10);
        } else if (state === "active") {
          let tick = 0;
          const emit = () => success({
            coords: { latitude: 46.35812791 + (moving ? tick++ * .00001 : 0), longitude: 14.83294713, accuracy: 8,
              altitude: 312, altitudeAccuracy: 8, heading: 0, speed: moving ? 4.4 : 2 },
            timestamp: Date.now(),
          } as GeolocationPosition);
          setTimeout(emit, 10);
          timers.set(id, setInterval(emit, 250));
        }
        return id;
      },
      clearWatch(id: number) { device.cleared.push(id); clearInterval(timers.get(id)); timers.delete(id); },
      getCurrentPosition(success: PositionCallback, error?: PositionErrorCallback) { return geo.watchPosition(success, error); },
    };
    Object.defineProperty(navigator, "geolocation", { configurable: true, value: geo });
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async (text: string) => { device.copies.push(text); } } });
    Object.defineProperty(navigator, "share", { configurable: true, value: async (data: ShareData) => { device.shares.push(data); } });
    const originalBeacon = navigator.sendBeacon.bind(navigator);
    navigator.sendBeacon = (url, data) => {
      device.beacons.push({ url: String(url), body: typeof data === "string" ? data : String(data ?? "") });
      return originalBeacon(url, data);
    };
  }, { state, moving });
}

function collectTraffic(page: Page) {
  const traffic: Traffic[] = [];
  // Request events include fetch/XHR, forms, images, tiles, workers and beacons.
  page.on("request", request => traffic.push({ kind: request.resourceType(), url: request.url(), body: request.postData() ?? "" }));
  page.on("websocket", socket => socket.on("framesent", frame =>
    traffic.push({ kind: "websocket", url: socket.url(), body: String(frame.payload) })));
  return traffic;
}

async function fixture(page: Page, query = "") {
  await page.goto(`/e2e/sos-integration-harness.html?${query}`);
}
const overlay = (page: Page) => page.locator(".sos-overlay");
const emergencyCall = (page: Page) => overlay(page).locator('a[href="tel:112"]');
const closeSos = (page: Page) => overlay(page).locator(".sos-close").click();

async function smsGeometry(page: Page) {
  const geometry = await overlay(page).evaluate(view => {
    const measure = (selector: string) => {
      const element = view.querySelector<HTMLElement>(selector);
      if (!element) return null;
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return {
        x: rect.x, y: rect.y, width: rect.width, height: rect.height,
        right: rect.right, bottom: rect.bottom, fontSize: style.fontSize,
        lineHeight: style.lineHeight, color: style.color, background: style.backgroundColor,
        borderRadius: style.borderRadius, fontWeight: style.fontWeight,
        opacity: style.opacity,
      };
    };
    const call = view.querySelector('a[href="tel:112"]')!;
    return {
      viewport: { width: innerWidth, height: innerHeight },
      overflow: {
        document: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        overlay: view.scrollWidth - view.clientWidth,
      },
      call: measure(".call112")!,
      reassurance: measure(".call-reassurance")!,
      immediatelyAfterCall: call.nextElementSibling?.matches(".call-reassurance"),
      denied: measure(".denied-reassurance"),
      deniedHeading: measure(".seek .st"),
      sms: measure('[data-testid="link-sos-sms"], [data-testid="button-sos-sms"]'),
      copy: measure(".secrow button:not([data-testid])"),
      hint: measure(".sms-hint"),
    };
  });
  expect(geometry.overflow.document, "Document has no horizontal overflow").toBe(0);
  expect(geometry.overflow.overlay, "SOS overlay has no horizontal overflow").toBe(0);
  expect(geometry.immediatelyAfterCall).toBe(true);
  expect(geometry.reassurance.fontSize).toBe("11px");
  expect(geometry.reassurance.lineHeight).toBe("16.5px");
  expect(geometry.reassurance.color).toBe("rgb(142, 154, 172)");
  expect(geometry.reassurance.y - geometry.call.bottom).toBeCloseTo(10, 1);
  expect(geometry.reassurance.x).toBe(geometry.call.x);
  expect(geometry.reassurance.width).toBe(geometry.call.width);
  expect(geometry.call.background).toBe("rgb(214, 69, 65)");
  if (geometry.denied) {
    expect(geometry.denied.fontSize).toBe("12px");
    expect(geometry.denied.lineHeight).toBe("18px");
    expect(geometry.denied.color).toBe("rgb(142, 154, 172)");
    expect(geometry.denied.y - geometry.deniedHeading!.bottom).toBeCloseTo(6, 1);
  }
  if (geometry.sms) {
    expect(geometry.sms.background).toBe("rgb(18, 27, 43)");
    expect(geometry.sms.color).toBe("rgb(242, 245, 249)");
    expect(geometry.sms.fontSize).toBe("13px");
    expect(geometry.sms.fontWeight).toBe("700");
    expect(geometry.sms.borderRadius).toBe("14px");
    expect(geometry.sms.y).toBeGreaterThanOrEqual(geometry.reassurance.bottom);
    expect(geometry.sms.x).toBeGreaterThanOrEqual(0);
    expect(geometry.sms.right).toBeLessThanOrEqual(geometry.viewport.width);
    if (geometry.copy) {
      expect(geometry.sms.y).toBe(geometry.copy.y);
      expect(geometry.sms.width).toBeCloseTo(geometry.copy.width, 1);
      expect(geometry.sms.height).toBe(geometry.copy.height);
      expect(geometry.sms.background).toBe(geometry.copy.background);
    }
  }
  if (geometry.hint) {
    expect(geometry.hint.fontSize).toBe("11px");
    expect(geometry.hint.color).toBe("rgb(142, 154, 172)");
    expect(geometry.hint.y).toBeGreaterThanOrEqual(geometry.sms!.bottom);
    expect(geometry.sms!.opacity).toBe("0.45");
  }
  return geometry;
}

for (const lang of ["sl", "en", "de", "it"]) {
  test(`SOS SMS fixture ${lang}: real fixes enabled, no-fix disabled, denied hidden`, async ({ page }, testInfo) => {
    const t = sosT(lang);
    const measurements = [];
    for (const state of ["active", "poor", "stale", "acquiring", "unsupported", "denied"]) {
      await test.step(state, async () => {
        await page.setViewportSize({ width: 390, height: 844 });
        await page.goto(`/__sos-fixture?state=${state}&lang=${lang}&os=ios`);
        const view = overlay(page);
        await expect(view).toBeVisible();
        await expect(view.getByTestId("text-sos-call-reassurance")).toHaveText(t.callReassurance);
        await expect(view.locator('a[href="tel:112"] + .call-reassurance')).toHaveText(t.callReassurance);
        await expect(view.locator(".guide .g").first()).toHaveText(t.guide[0].join(""));
        const smsLink = view.getByTestId("link-sos-sms");
        const smsDisabled = view.getByTestId("button-sos-sms");
        if (state === "denied") {
          await expect(view.getByTestId("text-sos-denied-reassurance")).toHaveText(t.deniedReassurance);
          await expect(smsLink).toHaveCount(0);
          await expect(smsDisabled).toHaveCount(0);
          await expect(view.locator('[href^="sms:"]')).toHaveCount(0);
          await expect(view.getByTestId("text-sos-sms-hint")).toHaveCount(0);
        } else if (state === "acquiring" || state === "unsupported") {
          if (state === "unsupported") await expect(view.locator('[role="alert"]')).toContainText(t.unsupportedTitle);
          await expect(smsDisabled).toBeDisabled();
          await expect(smsDisabled).toHaveText(t.sms);
          await expect(smsDisabled).toHaveAttribute("aria-describedby", "sos-sms-hint");
          await expect(view.getByTestId("text-sos-sms-hint")).toHaveText(t.smsHint);
          await expect(smsLink).toHaveCount(0);
          await expect(view.locator('[href^="sms:"]')).toHaveCount(0);
        } else {
          await expect(smsLink).toHaveText(t.sms);
          await expect(smsLink).toHaveAttribute("title", t.smsManual);
          await expect(smsDisabled).toHaveCount(0);
          await expect(view.getByTestId("text-sos-sms-hint")).toHaveCount(0);
          const href = await smsLink.getAttribute("href");
          expect(href).toMatch(/^sms:112&body=/);
          expect(decodeURIComponent(href!.slice("sms:112&body=".length))).toBe(smsText({
            lat: 46.35812, lon: 14.83294, altitude: 612, accuracy: state === "poor" ? 140 : 8,
          }));
          if (state !== "poor") {
            await expect(view.locator(".secrow > *")).toHaveCount(3);
            await expect(view.locator(".secrow > *").nth(2)).toHaveAttribute("href", href!);
          }
        }
        await expect(emergencyCall(page)).toBeVisible();
        await expect(emergencyCall(page)).not.toHaveAttribute("aria-disabled", "true");
        measurements.push({ state, ...await smsGeometry(page) });
        if (lang === "sl" && (state === "active" || state === "denied")) {
          const screenshotPath = `reports/sos/sms-${state}-390x844.jpg`;
          await page.screenshot({ path: screenshotPath });
          await testInfo.attach(`sms-${state}-390x844`, { path: screenshotPath, contentType: "image/jpeg" });
        }
        await page.setViewportSize({ width: 320, height: 844 });
        measurements.push({ state, ...await smsGeometry(page) });
        if (lang === "de" && state === "active") {
          const screenshotPath = "reports/sos/sms-active-de-320x844.png";
          await page.screenshot({ path: screenshotPath });
          await testInfo.attach("sms-active-de-320x844", { path: screenshotPath, contentType: "image/png" });
        }
      });
    }
    const geometryPath = `reports/sos/sms-fixture-${lang}-geometry.json`;
    await writeFile(geometryPath, JSON.stringify(measurements, null, 2));
    await testInfo.attach("sms-geometry", { path: geometryPath, contentType: "application/json" });
  });
}

for (const device of [
  { name: "iPhone", ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)", touches: 5, prefix: "sms:112&body=" },
  { name: "iPad desktop UA", ua: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) Version/18.0 Safari/605.1.15", touches: 5, prefix: "sms:112&body=" },
  { name: "Android", ua: "Mozilla/5.0 (Linux; Android 14)", touches: 5, prefix: "sms:112?body=" },
]) {
  test(`SOS SMS composer URI: ${device.name}, no automatic send or outgoing position`, async ({ page }, testInfo) => {
    await mockDevice(page);
    await page.addInitScript(({ ua, touches }) => {
      Object.defineProperty(navigator, "userAgent", { configurable: true, value: ua });
      Object.defineProperty(navigator, "maxTouchPoints", { configurable: true, value: touches });
    }, device);
    const traffic = collectTraffic(page);
    await fixture(page);
    await page.locator(".soscard button").click();
    const link = overlay(page).getByTestId("link-sos-sms");
    await expect(link).toBeVisible();
    const href = await link.getAttribute("href");
    expect(href).toMatch(new RegExp(`^${device.prefix.replace(/[?&]/g, "\\$&")}`));
    expect(decodeURIComponent(href!.slice(device.prefix.length))).toBe(smsText({
      lat: 46.35812791, lon: 14.83294713, altitude: 312, accuracy: 8,
    }));
    expect(decodeURIComponent(href!.slice(device.prefix.length))).toMatch(/^[\x20-\x7e]+$/);
    // Capture the native protocol destination without launching an external app.
    await link.evaluate(element => {
      element.addEventListener("click", event => {
        event.preventDefault();
        (window as any).__sosComposerDestination = (element as HTMLAnchorElement).getAttribute("href");
      }, { once: true });
    });
    await link.click();
    expect(await page.evaluate(() => (window as any).__sosComposerDestination)).toBe(href);
    expect(traffic.filter(row => /46\.358|14\.832/.test(decodeURIComponent(`${row.url} ${row.body}`)))).toEqual([]);
    const observed = await page.evaluate(() => (window as any).__sosTestDevice);
    expect(observed.beacons).toEqual([]);
    expect(observed.copies).toEqual([]);
    expect(observed.shares).toEqual([]);
    const evidencePath = `reports/sos/sms-composer-${device.name.toLowerCase().replace(/\s+/g, "-")}.json`;
    await writeFile(evidencePath, JSON.stringify({
      href, decoded: decodeURIComponent(href!.slice(device.prefix.length)), traffic, observed,
    }, null, 2));
    await testInfo.attach("sms-composer-intent-and-traffic", { path: evidencePath, contentType: "application/json" });
  });
}

for (const lang of ["sl", "en", "de", "it"]) {
  for (const state of ["acquiring", "active", "denied"] as const) {
    test(`SOS Help ${lang}: ${state}, 112 always available and existing contacts retained`, async ({ page }, testInfo) => {
      await mockDevice(page, state);
      const traffic = collectTraffic(page);
      await fixture(page, `lang=${lang}`);
      const help = page.getByTestId("emergency-help-sheet");
      await expect(help.locator('a[href="tel:112"]')).toBeVisible();
      await expect(help.locator('a[href="tel:113"]')).toBeVisible();
      const contactsBefore = await help.locator(".lg2-emergency-contacts").textContent();
      await help.locator(".soscard button").click();
      await expect(overlay(page)).toBeVisible();
      await expect(overlay(page).locator("#sos-title")).toHaveText(sosT(lang).title);
      await expect(emergencyCall(page)).toContainText(sosT(lang).call);
      await expect(emergencyCall(page)).toBeVisible();
      await expect(emergencyCall(page)).not.toHaveAttribute("aria-disabled", "true");
      if (state === "active") {
        await expect(overlay(page)).toContainText("46.35813");
        await expect(overlay(page)).toContainText("14.83295");
        await overlay(page).locator(".secrow button").nth(0).click();
        await overlay(page).locator(".secrow button").nth(1).click();
        const device = await page.evaluate(() => (window as any).__sosTestDevice);
        expect(device.copies[0]).toContain("N 46.35813, E 14.83295");
        expect(device.copies[0]).toContain("±8 m");
        expect(JSON.stringify(device.shares[0])).toContain("46.35813");
      }
      await closeSos(page);
      await expect(overlay(page)).toHaveCount(0);
      expect(await help.locator(".lg2-emergency-contacts").textContent()).toBe(contactsBefore);
      const device = await page.evaluate(() => (window as any).__sosTestDevice);
      expect(device.cleared).toContain(device.watches[0]);
      traffic.push(...device.beacons.map((b: { url: string; body: string }) => ({ kind: "beacon", ...b })));
      // Exact raw and displayed decimal/DMS forms, not generic "lat" substrings.
      const leaks = traffic.filter(row => /46\.358|14\.832|46[°%]|14[°%]/.test(decodeURIComponent(`${row.url} ${row.body}`)));
      expect(leaks, "No synthetic SOS coordinates in any outgoing traffic").toEqual([]);
      await testInfo.attach("all-outgoing-traffic", { body: JSON.stringify(traffic, null, 2), contentType: "application/json" });
    });
  }
}

test("SOS post-close cleanup and outgoing privacy across all languages and states", async ({ browser }, testInfo) => {
  // Focused continuation after the original matrix already verified rendering,
  // 112 and copy/share but stopped at a textContent/innerText fixture mismatch.
  for (const lang of ["sl", "en", "de", "it"]) {
    for (const state of ["acquiring", "active", "denied"] as const) {
      await test.step(`${lang}/${state}`, async () => {
        const page = await browser.newPage();
        try {
          await mockDevice(page, state);
          const traffic = collectTraffic(page);
          await fixture(page, `lang=${lang}`);
          const contacts = page.locator(".lg2-emergency-contacts");
          const before = await contacts.textContent();
          await page.locator(".soscard button").click();
          await expect.poll(() => page.evaluate(() => (window as any).__sosTestDevice.watches.length)).toBe(1);
          if (state === "active") await expect(overlay(page)).toContainText("46.35813");
          await closeSos(page);
          await expect(overlay(page)).toHaveCount(0);
          expect(await contacts.textContent()).toBe(before);
          const device = await page.evaluate(() => (window as any).__sosTestDevice);
          expect(device.cleared).toEqual(device.watches);
          traffic.push(...device.beacons.map((b: { url: string; body: string }) => ({ kind: "beacon", ...b })));
          expect(traffic.filter(row => /46\.358|14\.832|46[°%]|14[°%]/.test(decodeURIComponent(`${row.url} ${row.body}`)))).toEqual([]);
          await testInfo.attach(`all-outgoing-traffic-${lang}-${state}`, { body: JSON.stringify(traffic, null, 2), contentType: "application/json" });
        } finally { await page.close(); }
      });
    }
  }
});

test("SOS orientation absent without tenant coordinates", async ({ page }) => {
  await mockDevice(page);
  await fixture(page, "noCoordinates=1");
  await page.locator(".soscard button").click();
  await expect(overlay(page)).toContainText("46.35813");
  await expect(overlay(page).locator(".near")).toHaveCount(0);
});

for (const surface of ["gpx", "free"]) {
  test(`${surface}: SOS overlay retains recorder, timer and fullscreen map`, async ({ page }, testInfo) => {
    await mockDevice(page, "active", true);
    const traffic = collectTraffic(page);
    await fixture(page, `surface=${surface}`);
    if (surface === "free") {
      await page.getByRole("tab", { name: "Snemanje tur", exact: true }).click();
      await page.getByTestId("button-free-tour-start").click();
    } else {
      await page.getByTestId("button-tour-start").click();
    }
    // First-tour calorie profile is optional and unrelated to SOS.
    await page.getByTestId("button-tour-profile-skip").click();
    await expect(page.getByTestId("panel-tour-live")).toBeVisible();
    await page.getByTestId("button-tour-fullscreen").click();
    const full = page.getByTestId("dialog-tour-fullscreen");
    await expect(full).toBeVisible();
    await full.locator(".sos-mapbtn").click();
    await expect(overlay(page)).toBeVisible();
    const readRecording = () => page.evaluate(() => {
      const key = Object.keys(localStorage).find(key => key.startsWith("smart360:live-tour:"));
      return key ? JSON.parse(localStorage.getItem(key)!).state : null;
    });
    const recordingBefore = await readRecording();
    const before = await page.getByTestId("text-tour-overlay-net").textContent();
    await expect.poll(async () => (await readRecording())?.points.length).toBeGreaterThan(recordingBefore.points.length);
    const after = await page.getByTestId("text-tour-overlay-net").textContent();
    expect(after).not.toBe(before);
    const deviceOpen = await page.evaluate(() => (window as any).__sosTestDevice);
    expect(deviceOpen.watches).toHaveLength(2);
    expect(deviceOpen.cleared).not.toContain(deviceOpen.watches[0]);
    const recordingDuring = await readRecording();
    expect(recordingDuring.startedAt).toBe(recordingBefore.startedAt);
    expect(recordingDuring.segmentStarts).toEqual(recordingBefore.segmentStarts);
    expect(recordingDuring.distanceM).toBeGreaterThan(recordingBefore.distanceM);
    // Escape closes SOS, not the underlying fullscreen dialog/detail.
    await page.keyboard.press("Escape");
    await expect(overlay(page)).toHaveCount(0);
    await expect(full).toBeVisible();
    const deviceClosed = await page.evaluate(() => (window as any).__sosTestDevice);
    expect(deviceClosed.cleared).toContain(deviceClosed.watches[1]);
    expect(deviceClosed.cleared).not.toContain(deviceClosed.watches[0]);
    await expect(page.getByTestId("panel-tour-live")).toHaveAttribute("data-status", "moving");
    const recordingAfter = await readRecording();
    expect(recordingAfter.startedAt).toBe(recordingBefore.startedAt);
    expect(recordingAfter.points.length).toBeGreaterThanOrEqual(recordingDuring.points.length);
    traffic.push(...deviceClosed.beacons.map((b: { url: string; body: string }) => ({ kind: "beacon", ...b })));
    expect(traffic.filter(row => /46\.35[89]|14\.832|46[°%]|14[°%]/.test(decodeURIComponent(`${row.url} ${row.body}`)))).toEqual([]);
    await testInfo.attach(`all-outgoing-traffic-${surface}`, { body: JSON.stringify(traffic, null, 2), contentType: "application/json" });
  });
}

for (const surface of ["gpx", "free"]) {
  for (const viewport of [{ width: 390, height: 844 }, { width: 320, height: 640 }]) {
    test(`${surface}: SOS control collision check ${viewport.width}x${viewport.height}`, async ({ page }, testInfo) => {
      await page.setViewportSize(viewport);
      await mockDevice(page, "active", true);
      await fixture(page, `surface=${surface}`);
      if (surface === "free") {
        await page.getByRole("tab", { name: "Snemanje tur", exact: true }).click();
        await page.getByTestId("button-free-tour-start").click();
      } else await page.getByTestId("button-tour-start").click();
      await page.getByTestId("button-tour-profile-skip").click();
      await page.getByTestId("button-tour-fullscreen").click();
      const full = page.getByTestId("dialog-tour-fullscreen");
      await expect(full).toBeVisible();
      await expect(full.locator(".s360-gpx-profile--compact")).toBeVisible();
      const sos = await full.locator(".sos-mapbtn").boundingBox();
      expect(sos).not.toBeNull();
      const controls = [
        ".s360-gpx-full-exit", ".s360-gpx-camera-controls",
        ".s360-tour-toolbar", ".s360-gpx-profile--compact",
      ];
      const measurements = [];
      for (const selector of controls) {
        const control = full.locator(selector);
        await expect(control).toBeVisible();
        const rect = await control.boundingBox();
        expect(rect).not.toBeNull();
        const width = Math.max(0, Math.min(sos!.x + sos!.width, rect!.x + rect!.width) - Math.max(sos!.x, rect!.x));
        const height = Math.max(0, Math.min(sos!.y + sos!.height, rect!.y + rect!.height) - Math.max(sos!.y, rect!.y));
        measurements.push({ selector, rect, intersectionArea: width * height });
      }
      const name = `tour-${surface}-${viewport.width}x${viewport.height}`;
      const screenshotPath = `reports/sos/${name}.png`;
      await page.screenshot({ path: screenshotPath });
      await writeFile(`reports/sos/${name}-geometry.json`, JSON.stringify({ viewport, sos, controls: measurements }, null, 2));
      await testInfo.attach(name, { path: screenshotPath, contentType: "image/png" });
      expect(sos!.x).toBeGreaterThanOrEqual(0);
      expect(sos!.y).toBeGreaterThanOrEqual(0);
      expect(sos!.x + sos!.width).toBeLessThanOrEqual(viewport.width);
      expect(sos!.y + sos!.height).toBeLessThanOrEqual(viewport.height);
      expect(measurements.filter(control => control.intersectionArea > 0), "SOS must not overlap existing visible controls").toEqual([]);
    });
  }
}

test("SOS unavailable share copies coordinates and maps URL; clipboard failure exposes manual text", async ({ page }) => {
  await mockDevice(page);
  await fixture(page);
  await page.locator(".soscard button").click();
  await expect(overlay(page)).toContainText("46.35813");
  await overlay(page).locator(".secrow button").nth(0).click();
  await page.evaluate(() => Object.defineProperty(navigator, "share", { configurable: true, value: undefined }));
  await overlay(page).locator(".secrow button").nth(1).click();
  const copies = await page.evaluate(() => (window as any).__sosTestDevice.copies);
  const expected = `${copies[0]}\nhttps://www.google.com/maps/search/?api=1&query=46.35813,14.83295`;
  expect(copies[0]).toBe("N 46.35813, E 14.83295 (±8 m)");
  expect(copies[1]).toBe(expected);
  await page.evaluate(() => {
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async () => { throw new Error("Synthetic clipboard denial"); } } });
    document.execCommand = () => false;
  });
  await overlay(page).locator(".secrow button").nth(1).click();
  await expect(overlay(page).locator(".sos-manual")).toBeVisible();
  await expect(overlay(page).locator(".sos-manual")).toHaveValue(expected);
  await expect(emergencyCall(page)).toBeVisible();
});