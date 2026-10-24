import assert from "node:assert/strict";
import test from "node:test";
import {
  BORDO, MODRA, contrastRatio, deriveSimplePalette, resolveGuestDesign, resolveSimplePalette,
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

// Golden: every token of the approved sheet (attached_assets/barvna-izpeljava_*.html).
const SHEET: [string, string][] = [
  ["#407075", "#01717A #015862 #01313B #1D3942 #C8E4E7 #DBF0F2 #A2BFD1"],
  ["#C03028", "#AE2F27 #882325 #530B19 #51232C #F1D7D3 #FAE6E3 #D9ACBA"],
  ["#E07B20", "#964D00 #793801 #4C1900 #50271A #EED9CB #F7E8DD #DCAEA8"],
  ["#93B021", "#596D00 #405601 #1A3300 #213C19 #DBE1CC #E9EEDE #A2C5A9"],
  ["#2E8B57", "#0F7644 #015C39 #013425 #133C32 #CFE4D5 #E0F0E5 #94C6BF"],
  ["#1897B0", "#026F83 #015669 #013041 #1B3847 #C9E4EB #DCEFF5 #A2BED8"],
  ["#2563EB", "#2D5CC0 #284796 #11265D #223357 #D4DEF3 #E3ECFA #A9BBDF"],
  ["#7C3AED", "#6A4AB7 #4D3B91 #25215C #2A3057 #DEDBF1 #EBE9F9 #A9BBDF"],
  ["#E85BA8", "#A32F71 #7D255D #49103D #482644 #EFD6E1 #F8E6ED #CBB0D1"],
  ["#F6DFCC", "#885627 #6B4221 #412210 #452E24 #EDDACA #F7E8DD #D3B2AB"],
  ["#101B2E", "#456396 #394C76 #1E2A47 #2B3448 #D3DFF3 #E3ECFA #AEBBD5"],
  ["#8B8E93", "#55647D #434D62 #252B39 #2F343E #D6DFED #E4ECF8 #B4BBC8"],
  ["#B23476", "#A42E6C #7E2559 #4A0F3A #492542 #EFD6E0 #F8E5EC #CCAFD0"],
  ["#344FB2", "#3D59BD #294794 #12265C #233357 #D5DEF3 #E5EBFB #A9BBDF"],
];
const KEYS = ["tile1", "tile15", "tile2", "bg", "stroke", "txt", "tint"] as const;
test("golden: all seven tokens match the approved sheet", () => {
  for (const [base, want] of SHEET) {
    const p = deriveSimplePalette(base);
    assert.equal(KEYS.map((k) => p[k]).join(" "), want, base);
  }
});

const blend = (fg: string, bg: string, a: number) => "#" + [1, 3, 5].map((i) =>
  Math.round(parseInt(fg.slice(i, i + 2), 16) * a + parseInt(bg.slice(i, i + 2), 16) * (1 - a)).toString(16).padStart(2, "0")).join("").toUpperCase();

test("AA >= 4.5 for formula pairs and rendered opacity (sheet + production #4C7060 + edges)", () => {
  for (const base of [...SHEET.map((x) => x[0]), "#4C7060", "#000000", "#FFFFFF", "#808080", "#FFFF00", "#00FF00"]) {
    const p = deriveSimplePalette(base);
    for (const [fg, bg] of [[p.stroke, p.tile15], [p.stroke, p.tile2], [p.txt, p.bg], [p.tint, p.bg], [p.adr, p.bg],
      [blend(p.txt, p.bg, 0.85), p.bg]]) assert.ok(contrastRatio(fg, bg) >= 4.5, `${base} ${fg}/${bg}`);
  }
});

test("near-grey and pure grey handling", () => {
  assert.deepEqual(deriveSimplePalette("#000000"), deriveSimplePalette("#FFFFFF"));
  assert.deepEqual(deriveSimplePalette("#808080"), deriveSimplePalette("#333333"));
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
