// v4 B "ZIVO+" custom derivation: exact token equality with every B card of the READ-ONLY sheet
// attached_assets/barvna-izpeljava_2_1792841788636.html (8 picks + the 2 preset pass-through cards),
// AA guarantees, zero hue drift, four-stop gradient / page depth wiring, presets untouched.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import {
  BORDO, MODRA, contrastRatio, deriveSimplePalette, deriveSimplePaletteV4, simplePaletteStyle,
} from "../pages/living-guide/simple/simple-palette";

const SHEET = readFileSync(new URL("../../../../attached_assets/barvna-izpeljava_2_1792841788636.html", import.meta.url), "utf8");
const PAL_SRC = readFileSync(new URL("../pages/living-guide/simple/simple-palette.ts", import.meta.url), "utf8");
const CSS = readFileSync(new URL("../pages/living-guide/simple/living-guide-simple.css", import.meta.url), "utf8");
const K = ["tile1", "tile15", "tile2", "bg", "bg2", "glow", "stroke", "txt", "tint"] as const;
const text = SHEET.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");
const B_CARDS = [...text.matchAll(/B · ŽIVO\+ .{0,90}?(tile1 (#\w{6}) tile15 #\w+ tile2 #\w+ bg #\w+ bg2 #\w+ glow #\w+ stroke #\w+ txt #\w+ tint #\w+)/g)]
  .map((m) => ({ base: m[2], line: m[1] }));

test("sheet parse: 8 vivid picks + bordo/modra pass-through B cards (incl. #48A1D4)", () => {
  assert.equal(B_CARDS.length, 10);
  assert.deepEqual(B_CARDS.map((c) => c.base),
    ["#FF7A00", "#FF2D87", "#9BE011", "#00C2E0", "#2F5BFF", "#E8192C", "#8B2BFF", "#48A1D4", "#B23476", "#344FB2"]);
});

test("v4 B: all nine tokens equal the sheet's B card exactly (10/10)", () => {
  for (const c of B_CARDS) {
    const t = deriveSimplePaletteV4(c.base).tokens;
    assert.equal(K.map((k) => `${k} ${t[k]}`).join(" "), c.line, c.base);
    assert.deepEqual(deriveSimplePalette(c.base), t, "public derive = v4");
  }
});

test("v4 B: pick exact, AA text >=4.5 (bg and bg2), icon/glow >=3, flat page when outside ink is dark", () => {
  for (const base of [...B_CARDS.map((c) => c.base), "#000000", "#FFFFFF", "#808080", "#FFFF00", "#00FF00", "#00FFFF", "#FF00FF", "#101B2E", "#F6DFCC"]) {
    const d = deriveSimplePaletteV4(base), p = d.tokens;
    assert.equal(p.tile1, base.toUpperCase()); assert.equal(d.deltaE, 0);
    for (const bgc of [p.bg, p.bg2!]) for (const fg of [p.txt, p.tint, p.adr]) assert.ok(contrastRatio(fg, bgc) >= 4.5, `${base} ${fg}/${bgc}`);
    assert.ok(contrastRatio(p.stroke, p.tile15) >= 4.5 && contrastRatio(p.stroke, p.tile2) >= 4.5, `${base} label`);
    assert.ok(contrastRatio(p.stroke, p.tile1) >= 3, `${base} icon/pick`);
    assert.ok(contrastRatio(p.stroke, p.glow!) >= 3, `${base} icon/glow`);
    // Sheet prose says dark outside ink keeps the page flat; the sheet PSEUDOCODE (which all B cards
    // follow) is contrast-driven: depth shrinks only as far as AA requires. All 4 dark-ink B cards are
    // flat by that rule; very light picks (#FFFFFF, #FFFF00) keep safe depth. Pseudocode wins.
    if (["#FF7A00", "#9BE011", "#00C2E0", "#48A1D4"].includes(base)) assert.equal(p.bg2, p.bg, `${base} flat`);
  }
});

test("v4 B: zero hue drift — every derived chromatic token keeps the pick's hue (incl. tint)", () => {
  const hue = (hex: string) => { // OKLab hue via deltaE-free path: compare against pick using a/b angle
    const n = parseInt(hex.slice(1), 16), lin = [16, 8, 0].map((s) => { const c = ((n >> s) & 255) / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
    const [r, g, b] = lin, l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b), m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b), s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
    const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
    return { h: (Math.atan2(B, A) * 180 / Math.PI + 360) % 360, c: Math.hypot(A, B) };
  };
  for (const c of B_CARDS.slice(0, 8)) {
    const p = deriveSimplePaletteV4(c.base).tokens, h0 = hue(c.base).h;
    for (const k of ["tile15", "tile2", "bg", "bg2", "glow", "tint"] as const) {
      const x = hue(p[k]!); if (x.c < 0.03) continue; // 8-bit quantisation dominates near-neutral/near-black inks
      const d = Math.abs(((x.h - h0 + 540) % 360) - 180);
      assert.ok(d < 6, `${c.base} ${k} ${p[k]} drift ${d.toFixed(2)}°`); // v3 drifted up to 18° (bg) / 30° (tint)
    }
  }
});

test("v4 B wiring: custom emits four-stop gradient + page depth; presets emit nothing new", () => {
  const st = simplePaletteStyle(deriveSimplePalette("#48A1D4"));
  assert.equal(st["--s-glow"], "#55AEE1"); assert.equal(st["--s-bg2"], "#3A82AC");
  assert.equal(st["--s-grad"], "linear-gradient(180deg,var(--s-glow) 0%,var(--s-tile1) 20%,var(--s-tile15) 58%,var(--s-tile2) 100%)");
  assert.equal(st["--s-page"], "linear-gradient(180deg,var(--s-bg) 0%,var(--s-bg2) 100%)");
  for (const p of [BORDO, MODRA]) for (const k of ["--s-ink", "--s-glow", "--s-grad", "--s-bg2", "--s-page"]) assert.equal(simplePaletteStyle(p)[k], undefined);
  assert.equal((CSS.match(/background: var\(--s-grad, linear-gradient\(180deg,var\(--s-tile1\) 0%,var\(--s-tile15\) 52%,var\(--s-tile2\) 100%\)\)/g) ?? []).length, 2, "tile + open CTA");
  assert.match(CSS, /\.lgs-root \{\s*background: var\(--s-page, var\(--s-bg\)\);/);
  assert.match(CSS, /\.lgs-home \{[^}]*background: var\(--s-page, var\(--s-bg\)\);/);
  // dynamic background (weather skin) still overrides the page gradient; inset gap stays on --s-bg
  assert.match(CSS, /\.lgs-home\[data-weather-skin\] \{\s*background: var\(--lgw-bg\);/);
  assert.match(CSS, /\.lgs-root \.lgs-tile \{[^}]*box-shadow: inset 0 0 0 \.2525cqw var\(--s-bg\);/);
});

test("presets BORDO/MODRA source blocks are byte-identical to the approved hashes", () => {
  const sha = (n: string) => createHash("sha256").update(PAL_SRC.match(new RegExp(`export const ${n}: SimplePaletteTokens = \\{[\\s\\S]*?\\n\\};`))![0]).digest("hex");
  assert.equal(sha("BORDO"), "20ff4560cb96188b32de34b39cfdfc8e84569fd2c41591f403042e199af6dc62");
  assert.equal(sha("MODRA"), "a2314aba4465d63c52ad1754b42f86757f0bf838784ec53e1baf916197dbde95");
  const ser = (o: object) => createHash("sha256").update(JSON.stringify(o)).digest("hex");
  assert.equal(ser(BORDO), ser({ bg: "#4C2545", tile1: "#B23476", tile15: "#8A2A61", tile2: "#521445", stroke: "#C2DCF8", txt: "#D5E7FD", tint: "#CBA8D8", adr: "#D9BCD4" }));
  assert.equal(ser(MODRA), ser({ bg: "#24344F", tile1: "#344FB2", tile15: "#2A3F8A", tile2: "#142152", stroke: "#DDE3EE", txt: "#E8EDF6", tint: "#A8BED8", adr: "#BCCDD9" }));
});
