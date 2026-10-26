import assert from "node:assert/strict";
import test from "node:test";
import {
  BORDO, MODRA, contrastRatio, deltaEOK, deriveSimplePalette, deriveSimplePaletteV3, resolveGuestDesign, resolveSimplePalette, simplePaletteStyle,
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

test("custom derivation is deterministic (OKLCH, adr aliases txt)", () => {
  const a = deriveSimplePalette("#2E8B6A");
  assert.deepEqual(a, deriveSimplePalette("#2e8b6a"));
  assert.equal(a.adr, a.txt);
  for (const v of Object.values(a)) assert.match(v, /^#[0-9A-F]{6}$/);
});

// Golden v3: all 14 samples + the AA table of the approved sheet
// (attached_assets/barvna-izpeljava_1_1792836375569.html), parsed from the sheet itself.
const SHEET_HTML = readFileSync(new URL("../../../../attached_assets/barvna-izpeljava_1_1792836375569.html", import.meta.url), "utf8");
const ROWS = [...SHEET_HTML.matchAll(/<tr><td>[^<]*\((#[0-9A-F]{6})\)<\/td>((?:<td>[^<]*<\/td>)+)<\/tr>/g)].map((m) => ({
  base: m[1], cells: [...m[2].matchAll(/<td>([^<]*)<\/td>/g)].map((x) => x[1]),
  toks: [...SHEET_HTML.match(new RegExp(`<span><i>tile1</i> ${m[1]}</span>.*?</div>`))![0].matchAll(/<i>(\w+)<\/i> (#\w+)/g)].map((x) => x[2]).join(" "),
}));
const KEYS = ["tile1", "tile15", "tile2", "bg", "stroke", "txt", "tint"] as const;
test("golden v3: 14 samples, seven tokens and the full deltaE/ink/AA table match the sheet", () => {
  assert.equal(ROWS.length, 14);
  for (const r of ROWS) {
    const d = deriveSimplePaletteV3(r.base), p = d.tokens;
    assert.equal(KEYS.map((k) => p[k]).join(" "), r.toks, r.base);
    const got = [d.deltaE.toFixed(3), d.tileInk, d.outsideInk,
      ...[[p.stroke, p.tile15], [p.stroke, p.tile2], [p.stroke, p.tile1], [p.txt, p.bg], [p.tint, p.bg]].map(([f, g]) => contrastRatio(f, g).toFixed(2))];
    assert.deepEqual(got, r.cells, r.base + " table");
  }
});

test("v3: tile1 is exactly the pick; formula reproduces the sheet's preset cards; presets untouched", () => {
  for (const b of ["#48A1D4", "#4C7060", "#F6DFCC", "#101B2E", "#FFFF00", "#000000"]) {
    assert.equal(deriveSimplePalette(b).tile1, b); assert.equal(deltaEOK(b, deriveSimplePalette(b).tile1), 0);
  }
  assert.equal(KEYS.map((k) => deriveSimplePaletteV3("#344FB2").tokens[k]).join(" "), "#344FB2 #223F8B #0E2156 #1E2D50 #D5DEF3 #E5EBFB #A9BBDF");
  assert.equal(KEYS.map((k) => deriveSimplePaletteV3("#B23476").tokens[k]).join(" "), "#B23476 #872D61 #4F153F #4F2B48 #EFD6E0 #F8E5EC #CCAFD0");
  assert.equal(simplePaletteStyle(BORDO)["--s-ink"], undefined);
  assert.equal(simplePaletteStyle(MODRA)["--s-ink"], undefined);
  assert.equal(simplePaletteStyle(deriveSimplePaletteV3("#E07B20").tokens)["--s-ink"], "#230D01");
});

const blend = (fg: string, bg: string, a: number) => "#" + [1, 3, 5].map((i) =>
  Math.round(parseInt(fg.slice(i, i + 2), 16) * a + parseInt(bg.slice(i, i + 2), 16) * (1 - a)).toString(16).padStart(2, "0")).join("").toUpperCase();

test("v3 AA: labels >=4.5 on tile15/tile2, icons >=3 on tile1, outside >=4.5 (custom opacity 1) — samples + edges", () => {
  for (const base of [...ROWS.map((x) => x.base), "#000000", "#FFFFFF", "#808080", "#FFFF00", "#00FF00", "#00FFFF", "#FF00FF"]) {
    const p = deriveSimplePalette(base);
    for (const [fg, bg] of [[p.stroke, p.tile15], [p.stroke, p.tile2], [p.txt, p.bg], [p.tint, p.bg], [p.adr, p.bg]])
      assert.ok(contrastRatio(fg, bg) >= 4.5, `${base} ${fg}/${bg}`);
    assert.ok(contrastRatio(p.stroke, p.tile1) >= 3, `${base} icon`);
    // custom renders .lgs-small at opacity 1 (dark ink at .85 would fail, e.g. #48A1D4)
    assert.equal(simplePaletteStyle(p)["--s-small-opacity"], "1");
  }
  assert.ok(contrastRatio(blend("#051017", "#687C97", 0.85), "#687C97") < 4.5, "why custom opacity is 1");
  for (const p of [BORDO, MODRA]) {
    assert.equal(simplePaletteStyle(p)["--s-small-opacity"], undefined);
    assert.ok(contrastRatio(blend(p.txt, p.bg, 0.85), p.bg) >= 4.5);
  }
});

test("custom-only adaptive ink in CSS; preset fallbacks stay white", () => {
  const css = readFileSync(new URL("../pages/living-guide/simple/living-guide-simple.css", import.meta.url), "utf8");
  assert.match(css, /\.lgs-tile svg \{[^}]*color: var\(--s-ink, var\(--s-stroke\)\); fill: var\(--s-ink, #FFFFFF\)/);
  assert.match(css, /\.lgs-tile svg\.ln \{[^}]*stroke: var\(--s-ink, #FFFFFF\)/);
  assert.match(css, /\.lgs-home-controls--trend \.lgs-return360 \{[^}]*color:#fff/);
  assert.match(css, /\.lg2-app:not\(\.lgs-root\) \.lg-back-circle \{[^}]*color:#fff/);
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
  assert.equal(simpleLabelSize("Wi-Fi"), 12.5);
  assert.equal(simpleLabelSize("KOLESARJENJE"), 10);
  assert.equal(simpleLabelSize("ZNAMENITOSTI"), 10);
  assert.equal(simpleLabelSize("DODAJ NA ZAČETNI ZASLON"), 12.5);
  assert.equal(simpleLabelSize("WIDE", () => 83), 10);
  assert.equal(simpleLabelSize("NARROW", () => 82), 12.5);
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
