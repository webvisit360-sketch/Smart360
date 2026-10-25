import assert from "node:assert/strict";
import test from "node:test";
import { normalizeSystemTileVisibility, systemTileVisible } from "../pages/living-guide/system-tile-visibility";
import { buildSimpleSections, type SimpleRuntime } from "../pages/living-guide/simple/simple-tiles";
import { menuRowIds } from "../pages/living-guide/living-guide-menu-model";
import { tenantSavePayload } from "../lib/tenant-publication-flow";

const rt: SimpleRuntime = { hasWeather: true, hasContact: true, installAvailable: true, hasOrderable: false, recordingEnabled: false, mapHref: null };
const homeIds = (v: unknown, r: Partial<SimpleRuntime> = {}) =>
  buildSimpleSections([], "sl", { ...rt, ...r, systemTileVisibility: v })[0].tiles.map((t) => t.id);

test("absent object or key defaults to visible", () => {
  assert.deepEqual(normalizeSystemTileVisibility(undefined), { notices: true, weather: true, sos: true, contact: true, install: true, about: true, program: true });
  assert.equal(systemTileVisible({}, "sos"), true);
  assert.equal(systemTileVisible({ systemTileVisibility: { weather: false } }, "sos"), true);
  assert.equal(systemTileVisible({ systemTileVisibility: { weather: false } }, "weather"), false);
});

test("Enostaven home grid hides each disabled system tile", () => {
  assert.deepEqual(homeIds(null), ["notices", "weather", "sos", "contact", "install", "about"]);
  for (const key of ["notices", "weather", "sos", "contact", "install", "about"]) {
    assert.ok(!homeIds({ [key]: false }).includes(key), key);
  }
});

test("runtime gates still apply when visibility is true (install hidden standalone)", () => {
  assert.ok(!homeIds({ install: true }, { installAvailable: false }).includes("install"));
  assert.ok(!homeIds({ weather: true }, { hasWeather: false }).includes("weather"));
});

test("home section disappears when all system tiles are hidden", () => {
  const all = { notices: false, weather: false, sos: false, contact: false, install: false, about: false };
  assert.ok(!buildSimpleSections([], "sl", { ...rt, systemTileVisibility: all }).some((s) => s.key === "home"));
});

test("Trend menu gates about and install", () => {
  assert.deepEqual(menuRowIds(true, false), ["language", "profile", "install", "help"]);
  assert.deepEqual(menuRowIds(false, true), ["language", "profile", "help", "about"]);
  assert.deepEqual(menuRowIds(true, false, false), ["language", "profile", "install"]);
});

test("host save payload carries systemTileVisibility only with content permission", () => {
  const snap = { customDomain: "", email: "", mapUrl: "", wifiSsid: "", wifiPass: "", notificationChannel: "email", notificationWhatsappPhone: "", systemTileVisibility: { sos: false } } as any;
  assert.deepEqual((tenantSavePayload(snap, "1", false, true) as any).systemTileVisibility, { sos: false });
  assert.equal((tenantSavePayload(snap, "1", false, false) as any).systemTileVisibility, undefined);
});
