import assert from "node:assert/strict";
import test from "node:test";
import {
  BORDO, MODRA, deriveSimplePalette, resolveGuestDesign, resolveSimplePalette,
} from "../pages/living-guide/simple/simple-palette";
import { buildSimpleSections, simpleHeroUrl, simpleLabelSize } from "../pages/living-guide/simple/simple-tiles";
import { SIMPLE_COPY } from "../pages/living-guide/simple/simple-copy";
import { simpleFixtureTenant } from "../pages/living-guide/simple/simple-fixture-data";
import { readFileSync } from "node:fs";
import { hexToHslForTest } from "./enostaven-hsl";
import { tenantSavePayload } from "../lib/tenant-publication-flow";

const hexDist = (a: string, b: string) => {
  const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [x, y] = [p(a), p(b)];
  return Math.max(...x.map((v, i) => Math.abs(v - y[i])));
};

test("presets are copied exactly from the references", () => {
  assert.deepEqual(BORDO, { bg: "#4C2545", tile1: "#B23476", tile15: "#8A2A61", tile2: "#521445", stroke: "#C2DCF8", txt: "#D5E7FD", tint: "#CBA8D8", adr: "#D9BCD4" });
  assert.deepEqual(MODRA, { bg: "#24344F", tile1: "#344FB2", tile15: "#2A3F8A", tile2: "#142152", stroke: "#DDE3EE", txt: "#E8EDF6", tint: "#A8BED8", adr: "#BCCDD9" });
});

test("NULL design = trend, NULL palette = bordo, invalid custom falls back", () => {
  assert.equal(resolveGuestDesign(null), "trend");
  assert.equal(resolveGuestDesign("simple"), "simple");
  assert.equal(resolveSimplePalette(null, null), BORDO);
  assert.equal(resolveSimplePalette("modra", null), MODRA);
  assert.equal(resolveSimplePalette("custom", "nope"), BORDO);
});

test("custom derivation is deterministic and reproduces bordo from its own base", () => {
  const a = deriveSimplePalette("#2E8B6A");
  assert.deepEqual(a, deriveSimplePalette("#2e8b6a"));
  assert.equal(a.tile1, "#2E8B6A");
  const self = deriveSimplePalette(BORDO.tile1);
  for (const key of Object.keys(BORDO) as (keyof typeof BORDO)[]) {
    assert.ok(hexDist(self[key], BORDO[key]) <= 1, `${key}: ${self[key]} vs ${BORDO[key]}`);
  }
  for (const v of Object.values(a)) assert.match(v, /^#[0-9A-F]{6}$/);
});

const rt = { hasWeather: true, hasContact: true, installAvailable: true, hasOrderable: true, recordingEnabled: true, mapHref: "https://maps" };

test("Drobež tiles mirror the reference sheet", () => {
  const t = simpleFixtureTenant("drobez", "bordo", null);
  const s = buildSimpleSections(t.sections, "sl", rt);
  assert.deepEqual(s.map((x) => x.title), ["Domov", "Nastanitev", "Ponudba", "Okolica", "Sporočila"]);
  assert.deepEqual(s.map((x) => x.tiles.map((y) => y.label)), [
    ["Obvestila", "Vreme", "Pomoč in SOS", "Kontakt", "Dodaj na začetni zaslon", "O vodniku"],
    ["Dobrodošli", "Nastanitve", "Wi-Fi", "Hišni red", "Navodila", "Prijava / odjava", "Parkiranje"],
    ["Ponudba s cenami", "Domači izdelki", "Naročilo"],
    ["Znamenitosti", "Pohodi", "Kolesarjenje", "Program", "Posnemi turo", "Zemljevid"],
    ["Sporočila"],
  ]);
  assert.deepEqual(s[1].tiles.map((x) => x.icon), ["house", "building", "wifi", "doc", "gear", "clock", "parking"]);
  assert.ok(!s.flatMap((x) => x.tiles).some((x) => /profil/i.test(x.label)), "no profile tile");
});

test("Meli Pu tiles mirror the reference sheet", () => {
  const t = simpleFixtureTenant("melipu", "modra", null);
  const s = buildSimpleSections(t.sections, "sl", { ...rt, recordingEnabled: false });
  assert.deepEqual(s[1].tiles.map((x) => x.icon), ["house", "bed", "door", "ac", "wifi", "doc", "parking"]);
  assert.deepEqual(s[3].tiles.map((x) => x.icon), ["beach", "mountain", "bike", "trips", "calendar", "pin"]);
});

test("hidden categories and empty sections are not tiles", () => {
  const t = simpleFixtureTenant("drobez", "bordo", null);
  t.sections[1].categories.forEach((c: any) => { c.isVisible = false; });
  const s = buildSimpleSections(t.sections, "sl", { ...rt, hasOrderable: false });
  assert.ok(!s.some((x) => x.key === "offer"));
});

test("all runtime labels exist in 7 languages; longest stays within 3 lines budget", () => {
  for (const [key, row] of Object.entries(SIMPLE_COPY)) {
    assert.deepEqual(Object.keys(row).sort(), ["de", "en", "fr", "hr", "it", "nl", "sl"], key);
  }
  // ~95px tile, 10px uppercase Lato 700 ≈ 13 chars/line → 3 lines ≈ 39 chars.
  const tileKeys = ["notices", "weather", "sos", "contact", "install", "about", "orders", "record", "map", "messages"] as const;
  for (const k of tileKeys) for (const v of Object.values(SIMPLE_COPY[k])) assert.ok(v.length <= 39, `${k}: ${v}`);
});

test("host autosave carries the design fields", () => {
  const snap: any = { slug: "x", customDomain: "", email: "", mapUrl: "", wifiSsid: "", wifiPass: "", notificationWhatsappPhone: "", guestDesign: "simple", simplePalette: "custom", simpleBaseColor: "#112233" };
  const p: any = tenantSavePayload(snap, "2", false, true);
  assert.equal(p.guestDesign, "simple");
  assert.equal(p.simplePalette, "custom");
  assert.equal(p.simpleBaseColor, "#112233");
  const contactsOnly: any = tenantSavePayload(snap, "2", false, false);
  assert.equal(contactsOnly.guestDesign, undefined);
});

test("custom pale tokens keep bordo's relative headroom to white; dark tokens keep lightness ratio", () => {
  const ref = hexToHslForTest(BORDO.tile1)[2];
  for (const baseHex of ["#2E8B6A", "#1A3C8F", "#D98A1E"]) {
    const p = deriveSimplePalette(baseHex);
    const lb = hexToHslForTest(baseHex)[2];
    for (const k of ["stroke", "txt", "tint", "adr"] as const) {
      const want = 1 - (1 - lb) * ((1 - hexToHslForTest(BORDO[k])[2]) / (1 - ref));
      assert.ok(Math.abs(hexToHslForTest(p[k])[2] - want) < 0.01, `${baseHex} ${k}`);
    }
    for (const k of ["bg", "tile15", "tile2"] as const) {
      const want = lb * (hexToHslForTest(BORDO[k])[2] / ref);
      assert.ok(Math.abs(hexToHslForTest(p[k])[2] - want) < 0.01, `${baseHex} ${k}`);
    }
  }
});

test("black, white and gray bases are safe", () => {
  const black = deriveSimplePalette("#000000");
  assert.equal(black.bg, "#000000");
  const white = deriveSimplePalette("#FFFFFF");
  for (const k of ["stroke", "txt", "tint", "adr"] as const) assert.equal(white[k], "#FFFFFF");
  for (const v of Object.values(deriveSimplePalette("#808080"))) assert.match(v, /^#([0-9A-F]{2})\1\1$/);
});

test("long labels shrink instead of clipping", () => {
  assert.equal(simpleLabelSize("Wi-Fi"), 10);
  assert.ok(simpleLabelSize("Zum Startbildschirm hinzufügen") < 10);
  assert.equal(simpleLabelSize("Toevoegen aan beginscherm extra lang"), 8);
  const css = readFileSync(new URL("../pages/living-guide/simple/living-guide-simple.css", import.meta.url), "utf8");
  assert.doesNotMatch(css, /line-clamp/);
});

test("map tile prefers the in-app map view; hero prefers livingGuideHeroUrl", () => {
  const t = simpleFixtureTenant("drobez", "bordo", null);
  const map = buildSimpleSections(t.sections, "sl", { ...rt, hasSiteMap: true }).flatMap((s) => s.tiles).find((x) => x.id === "map");
  assert.deepEqual(map?.action, { kind: "map", href: "https://maps", siteMap: true });
  assert.equal(simpleHeroUrl({ livingGuideHeroUrl: "/a", heroUrl: "/b" }), "/a");
  assert.equal(simpleHeroUrl({ heroUrl: "/b" }), "/b");
});

test("shell wiring: simple cover skips identification, recorder has no chips, contact opens sheet", () => {
  const src = readFileSync(new URL("../pages/living-guide/LivingGuideGuestShell.tsx", import.meta.url), "utf8");
  assert.match(src, /<SimpleCoverView [^\n]*onOpen=\{\(\) => navigate\(`\/\$\{slug\}\/home`\)\}/);
  assert.match(src, /action\.kind === "record"\) \{ setSimpleRecorderMounted\(true\); setShowSimpleRecorder\(true\); \}/);
  assert.match(src, /<SimpleFullView[\s\S]{0,200}<FreeTourRecorder/);
  assert.match(src, /action\.kind === "contact"\) setShowSimpleContact\(true\)/);
  assert.match(src, /<TenantContactRows tenant=\{tenant\} t=\{t\} \/>\s*<\/SimpleSheet>/);
  const css = readFileSync(new URL("../pages/living-guide/simple/living-guide-simple.css", import.meta.url), "utf8");
  for (const w of ["700", "900"]) for (const sub of ["latin", "latin-ext"]) assert.ok(css.includes(`lato-${w}-${sub}.woff2`));
  const flags = readFileSync(new URL("../pages/living-guide/simple/LanguageFlags.tsx", import.meta.url), "utf8");
  for (const f of ["si", "gb", "de", "it", "fr", "nl", "hr"]) assert.ok(flags.includes(`@/assets/flags/${f}.svg`));
});
