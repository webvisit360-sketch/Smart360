import assert from "node:assert/strict";
import test from "node:test";
import {
  BORDO, MODRA, contrastRatio, deltaEOK, deriveSimplePalette, resolveGuestDesign, resolveSimplePalette,
} from "../pages/living-guide/simple/simple-palette";
import { buildSimpleSections, simpleHeroUrl, simpleLabelSize } from "../pages/living-guide/simple/simple-tiles";
import { SIMPLE_COPY } from "../pages/living-guide/simple/simple-copy";
import { simpleFixtureTenant } from "../pages/living-guide/simple/simple-fixture-data";
import { readFileSync } from "node:fs";
import { tenantSavePayload } from "../lib/tenant-publication-flow";


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

test("custom derivation is deterministic (OKLCH, tile1 derived, adr aliases txt)", () => {
  const a = deriveSimplePalette("#2E8B6A");
  assert.deepEqual(a, deriveSimplePalette("#2e8b6a"));
  assert.equal(a.adr, a.txt);
  for (const v of Object.values(a)) assert.match(v, /^#[0-9A-F]{6}$/);
});

// Golden v2: all 14 samples of the approved sheet (attached_assets/barvna-izpeljava_1792834926623.html).
const SHEET: [string, string, number][] = [
  ["#48A1D4", "#2584B5 #25668F #16395A #30435B #CCE2F0 #DEEEF8 #ABBBDC", 0.094],
  ["#4C7060", "#28775A #1B5D49 #00362D #1E3D38 #CDE5D9 #DEF0E7 #9DC3C3", 0.041],
  ["#407075", "#02757E #015B65 #00333E #1F3B44 #C8E4E7 #DBF0F2 #A2BFD1", 0.034],
  ["#C03028", "#B93A31 #912D2D #59111E #582931 #F1D7D3 #FAE6E3 #D9ACBA", 0.017],
  ["#E07B20", "#BD6202 #994902 #602403 #623729 #EED9CB #F7E8DD #DCAEA8", 0.091],
  ["#93B021", "#6D8401 #4F6A02 #214001 #2D4926 #DBE1CC #E9EEDE #A2C5A9", 0.138],
  ["#2E8B57", "#2E8B57 #1C6D48 #00402E #20483D #CFE4D5 #E0F0E5 #94C6BF", 0.000],
  ["#1897B0", "#0389A0 #056A81 #013D51 #284656 #C9E4EB #DCEFF5 #A2BED8", 0.045],
  ["#2563EB", "#3A6ACF #3252A2 #182D65 #2A3A60 #D4DEF3 #E3ECFA #A9BBDF", 0.050],
  ["#7C3AED", "#7556C4 #56459C #2A2763 #31375F #DEDBF1 #EBE9F9 #A9BBDF", 0.082],
  ["#E85BA8", "#C54F8F #983F75 #5A204D #5A3756 #EFD6E1 #F8E6ED #CBB0D1", 0.078],
  ["#F6DFCC", "#A47142 #825736 #502F1D #553D33 #EDDACA #F7E8DD #D3B2AB", 0.331],
  ["#101B2E", "#163160 #14244A #07112B #0F1729 #D3DFF3 #E3ECFA #AEBBD5", 0.110],
  ["#8B8E93", "#6D7D97 #576177 #313847 #3E434D #D6DFED #E4ECF8 #B4BBC8", 0.070],
];
const KEYS = ["tile1", "tile15", "tile2", "bg", "stroke", "txt", "tint"] as const;
test("golden: all seven tokens match the approved sheet", () => {
  for (const [base, want, de] of SHEET) {
    const p = deriveSimplePalette(base);
    assert.equal(KEYS.map((k) => p[k]).join(" "), want, base);
    assert.equal(deltaEOK(base, p.tile1).toFixed(3), de.toFixed(3), base + " deltaE");
  }
});

test("v2: tile1 follows the chosen lightness (owner samples) and formula reproduces sheet presets", () => {
  assert.equal(deriveSimplePalette("#48A1D4").tile1, "#2584B5");
  assert.equal(deriveSimplePalette("#4C7060").tile1, "#28775A");
  assert.equal(deriveSimplePalette("#2E8B57").tile1, "#2E8B57");
  assert.deepEqual(KEYS.map((k) => deriveSimplePalette("#344FB2")[k]).join(" "), "#344FB2 #223F8B #0E2156 #1E2D50 #D5DEF3 #E5EBFB #A9BBDF");
  assert.deepEqual(KEYS.map((k) => deriveSimplePalette("#B23476")[k]).join(" "), "#AF3976 #872D61 #4F153F #4F2B48 #EFD6E0 #F8E5EC #CCAFD0");
  // lighter choice -> lighter tile (monotone relative derivation)
  assert.ok(contrastRatio(deriveSimplePalette("#101B2E").tile1, "#000000") < contrastRatio(deriveSimplePalette("#2E8B57").tile1, "#000000"));
});

const blend = (fg: string, bg: string, a: number) => "#" + [1, 3, 5].map((i) =>
  Math.round(parseInt(fg.slice(i, i + 2), 16) * a + parseInt(bg.slice(i, i + 2), 16) * (1 - a)).toString(16).padStart(2, "0")).join("").toUpperCase();

test("AA >= 4.5 for formula pairs and rendered opacity (all 14 sheet samples + edges)", () => {
  for (const base of [...SHEET.map((x) => x[0]), "#000000", "#FFFFFF", "#808080", "#FFFF00", "#00FF00"]) {
    const p = deriveSimplePalette(base);
    for (const [fg, bg] of [[p.stroke, p.tile15], [p.stroke, p.tile2], [p.txt, p.bg], [p.tint, p.bg], [p.adr, p.bg],
      [blend(p.txt, p.bg, 0.85), p.bg]]) assert.ok(contrastRatio(fg, bg) >= 4.5, `${base} ${fg}/${bg}`);
  }
});

test("near-grey and pure grey handling", () => {
  // v2: pure greys share the cool hue + 0.045 chroma (pale tokens identical);
  // lightness follows the choice, floored at L 0.32 (black) and AA-capped (white).
  const k = deriveSimplePalette("#000000"), w = deriveSimplePalette("#FFFFFF"), g = deriveSimplePalette("#808080");
  for (const t of ["stroke", "txt", "tint"] as const) { assert.equal(k[t], w[t]); assert.equal(g[t], w[t]); }
  assert.equal(k.tile1, "#28324A");
  assert.ok(contrastRatio(w.tile1, k.tile1) > 2, "white choice yields a lighter tile than black");
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
