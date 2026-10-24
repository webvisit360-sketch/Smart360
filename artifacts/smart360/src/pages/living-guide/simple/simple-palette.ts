// Enostaven palettes. Bordo and modra are copied verbatim from the binding
// references; "custom" derives every token from one base colour with the
// approved OKLCH formula (barvna-izpeljava sheet).

export type SimplePaletteTokens = {
  bg: string; tile1: string; tile15: string; tile2: string;
  stroke: string; txt: string; tint: string; adr: string;
  /** v4 B (custom only): page-gradient bottom and tile-gradient top glow. */
  bg2?: string; glow?: string;
};
export type SimplePaletteKey = "bordo" | "modra" | "custom";
export type GuestDesign = "trend" | "simple";

export const BORDO: SimplePaletteTokens = {
  bg: "#4C2545", tile1: "#B23476", tile15: "#8A2A61", tile2: "#521445",
  stroke: "#C2DCF8", txt: "#D5E7FD", tint: "#CBA8D8", adr: "#D9BCD4",
};
export const MODRA: SimplePaletteTokens = {
  bg: "#24344F", tile1: "#344FB2", tile15: "#2A3F8A", tile2: "#142152",
  stroke: "#DDE3EE", txt: "#E8EDF6", tint: "#A8BED8", adr: "#BCCDD9",
};

const HEX = /^#([0-9a-f]{6})$/i;
export function isHexColor(value: unknown): value is string {
  return typeof value === "string" && HEX.test(value.trim());
}

// ---- OKLCH (Björn Ottosson standard matrices) ----
type Rgb = [number, number, number];
const toLin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const fromLin = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
function hexToRgb(hex: string): Rgb {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}
function srgbToOklch(hex: string): [number, number, number] {
  const [r, g, b] = hexToRgb(hex).map(toLin);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  const C = Math.hypot(A, B);
  const H = ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360;
  return [L, C, H];
}
function oklchToLinear(L: number, C: number, H: number): Rgb {
  const h = (H * Math.PI) / 180, A = C * Math.cos(h), B = C * Math.sin(h);
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}
const EPS = 1e-6;
const inGamut = (rgb: Rgb) => rgb.every((v) => v >= -EPS && v <= 1 + EPS);
/** v4 gamut test: gamma-encoded channel within [-0.0005, 1.0005] (then clipped). NOT stated in the
 *  sheet (it only says "gamut mapping"): INFERRED compatibility choice, reverse-engineered because
 *  the strict v3 test (linear ±1e-6) reproduces only 5/10 B cards (last-bit diffs) and this reproduces 10/10. */
const V4_TOL = 0.0005;
const gamma = (v: number) => (v < 0 ? -fromLin(-v) : fromLin(v));
const inGamutV4 = (rgb: Rgb) => rgb.every((v) => { const e = gamma(v); return e >= -V4_TOL && e <= 1 + V4_TOL; });
/** Step 4: oklch -> sRGB hex, reducing C by 0.001 until inside the sRGB gamut. */
function oklchToHex(L: number, C: number, H: number, gamut: (rgb: Rgb) => boolean = inGamut): string {
  let c = C, lin = oklchToLinear(L, c, H);
  while (!gamut(lin) && c > 0) { c = Math.max(0, c - 0.001); lin = oklchToLinear(L, c, H); }
  const x = (v: number) => Math.round(Math.min(1, Math.max(0, fromLin(Math.min(1, Math.max(0, v))))) * 255).toString(16).padStart(2, "0");
  return `#${x(lin[0])}${x(lin[1])}${x(lin[2])}`.toUpperCase();
}
function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map(toLin);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
/** WCAG 2.x contrast ratio between two #RRGGBB colours. */
export function contrastRatio(a: string, b: string): number {
  const x = luminance(a), y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
/** Shift hue h along the shorter arc toward anchor a, by at most m degrees. */
function toward(h: number, a: number, m: number): number {
  const d = ((a - h + 540) % 360) - 180;
  return (h + Math.sign(d) * Math.min(Math.abs(d), m) + 360) % 360;
}
const COOL = 265;
const AA = 4.5;

/** Pale tokens (outline/text). */
export const SIMPLE_PALE_TOKENS = ["stroke", "txt", "tint", "adr"] as const;

/** Step 8: ΔE_OK, Euclidean (L,a,b) distance between two #RRGGBB colours. */
export function deltaEOK(x: string, y: string): number {
  const lab = (h: string) => { const [L, C, H] = srgbToOklch(h.trim().toUpperCase()); const r = (H * Math.PI) / 180; return [L, C * Math.cos(r), C * Math.sin(r)]; };
  const p = lab(x), q = lab(y);
  return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
}

export type InkMode = "pale" | "dark";
export type SimplePaletteDerivation = { tokens: SimplePaletteTokens; tileInk: InkMode; outsideInk: InkMode; deltaE: number };

/** Ink search: walk L from `from` toward `to` by `step` until `ok(hex)`; null if never. */
function search(from: number, to: number, step: number, c: number, h: number, ok: (hex: string) => boolean): string | null {
  const dir = to >= from ? 1 : -1;
  for (let i = 0; ; i++) {
    const l = +(from + dir * step * i).toFixed(4);
    if (dir > 0 ? l > to + 1e-9 : l < to - 1e-9) return null;
    const hex = oklchToHex(l, c, h);
    if (ok(hex)) return hex;
  }
}

/**
 * Approved OKLCH derivation v3 (attached_assets/barvna-izpeljava_1_1792836375569.html), 1:1.
 * Step 3: tile1 IS the picked colour (deltaE 0). Steps 4-6: gradient/bg are relative
 * to L1 (with light-pick floors in dark-ink mode); ink is pale or dark per surface:
 * tile ink (stroke) needs >=4.5 on tile15+tile2 and >=3 on tile1; outside ink
 * (txt+tint) needs >=4.5 on bg. The sheet defines no `adr`: adr aliases txt.
 */
export function deriveSimplePaletteV3(baseHex: string): SimplePaletteDerivation {
  const base = baseHex.trim().toUpperCase();
  const [Lb, Cb, Hb] = srgbToOklch(base);                       // step 1
  const nearGrey = Cb < 0.02;                                    // step 2
  const H = Cb < 0.005 ? COOL : Hb;
  const Cd = nearGrey ? 0.045 : Math.min(0.165, Math.max(0.09, Cb));
  const tile1 = base, L1 = Lb;                                   // step 3
  const steps = (mode: InkMode) => {                             // step 4
    let d15 = Math.min(0.085, 0.16 * L1), d2 = Math.min(0.225, 0.42 * L1), dbg = Math.min(0.19, 0.35 * L1);
    if (mode === "dark") {
      d2 = Math.min(d2, L1 - Math.min(L1 - 0.02, 0.6));
      d15 = Math.min(d15, L1 - Math.min(L1 - 0.01, 0.63));
      dbg = Math.min(dbg, L1 - Math.min(L1 - 0.02, 0.58));
    }
    return {
      tile15: oklchToHex(L1 - d15, Cd * 0.82, toward(H, COOL, 4)),
      tile2: oklchToHex(L1 - d2, Cd * 0.62, toward(H, COOL, 12)),
      bg: oklchToHex(L1 - dbg, Math.min(Cd * 0.42, 0.075), toward(H, COOL, 18)),
    };
  };
  // step 5: tile ink
  const inkC = (m: number) => Math.min(m, Cd * 0.5);
  const tileOk = (t: { tile15: string; tile2: string }) => (hex: string) =>
    contrastRatio(hex, t.tile15) >= AA && contrastRatio(hex, t.tile2) >= AA && contrastRatio(hex, tile1) >= 3;
  let tileInk: InkMode = "pale";
  let t = steps("pale");
  let stroke = search(0.9, 0.985, 0.005, inkC(0.03), H, tileOk(t));
  if (!stroke) {
    tileInk = "dark"; t = steps("dark");
    stroke = search(0.25, 0.1, 0.005, inkC(0.045), H, tileOk(t)) ?? oklchToHex(0.1, inkC(0.045), H);
  }
  // step 6: outside ink against bg, pale pair first, else dark pair
  const onBg = (hex: string) => contrastRatio(hex, t.bg) >= AA;
  const txtC = Math.min(0.022, Cd * 0.4), tintC = Math.min(0.055, Cd * 0.45), tintH = toward(H, COOL, 30);
  let outsideInk: InkMode = "pale";
  let txt = search(0.94, 1, 0.01, txtC, H, onBg), tint = search(0.79, 1, 0.01, tintC, tintH, onBg);
  if (!txt || !tint) {
    outsideInk = "dark";
    txt = search(0.22, 0, 0.005, txtC, H, onBg) ?? oklchToHex(0, txtC, H);
    tint = search(0.35, 0, 0.01, tintC, tintH, onBg) ?? oklchToHex(0, tintC, tintH);
  }
  const tokens = { bg: t.bg, tile1, tile15: t.tile15, tile2: t.tile2, stroke, txt, tint, adr: txt };
  return { tokens, tileInk, outsideInk, deltaE: deltaEOK(base, tile1) };
}

/** v4 ink search: v3 walk, but L accumulates in floating point (l += step). NOT stated in the sheet:
 *  INFERRED compatibility choice. With v3's exact steps #FF7A00 picks pale #FFFFFF txt/tint (4.51:1);
 *  the B card shows dark ink, which this walk reproduces (0.79 + 21*0.01 overshoots 1, so L=1 is never tried). */
function searchV4(from: number, to: number, step: number, c: number, h: number, ok: (hex: string) => boolean): string | null {
  const dir = to >= from ? 1 : -1;
  for (let l = from; dir > 0 ? l <= to : l >= to; l += dir * step) {
    const hex = oklchToHex(l, c, h, inGamutV4);
    if (ok(hex)) return hex;
  }
  return null;
}

/**
 * Approved OKLCH derivation v4 B "ZIVO+" (attached_assets/barvna-izpeljava_2_1792841788636.html).
 * Changes vs v3 only: Cd = max(Cb, 0.09) with no upper cap (gamut mapping only); zero hue
 * drift everywhere (tile15, tile2, bg, bg2, glow and tint all use H); tile15 C*0.95,
 * tile2/bg/bg2 C*0.85; glow = oklch(min(.97, L1+g), Cd, H), g 0.04 -> 0.01 (0 = the pick)
 * until CR(stroke, glow) >= 3; bg2 = oklch(Lbg-s, Cd*0.85, H), s 0.07 -> 0.01 until txt
 * and tint >= 4.5 on bg2, else bg2 = bg (flat page). Pick, ink rules and L steps = v3.
 * The formulas above are the sheet's pseudocode; gamut tolerance and float walk are inferred (see below).
 */
export function deriveSimplePaletteV4(baseHex: string): SimplePaletteDerivation {
  const base = baseHex.trim().toUpperCase();
  const [Lb, Cb, Hb] = srgbToOklch(base);
  const nearGrey = Cb < 0.02;
  const H = Cb < 0.005 ? COOL : Hb;
  const Cd = nearGrey ? 0.045 : Math.max(0.09, Cb);
  const tile1 = base, L1 = Lb;
  const hex = (l: number, c: number) => oklchToHex(l, c, H, inGamutV4);
  const steps = (mode: InkMode) => {
    let d15 = Math.min(0.085, 0.16 * L1), d2 = Math.min(0.225, 0.42 * L1), dbg = Math.min(0.19, 0.35 * L1);
    if (mode === "dark") {
      d2 = Math.min(d2, L1 - Math.min(L1 - 0.02, 0.6));
      d15 = Math.min(d15, L1 - Math.min(L1 - 0.01, 0.63));
      dbg = Math.min(dbg, L1 - Math.min(L1 - 0.02, 0.58));
    }
    return { tile15: hex(L1 - d15, Cd * 0.95), tile2: hex(L1 - d2, Cd * 0.85), bg: hex(L1 - dbg, Cd * 0.85), Lbg: L1 - dbg };
  };
  const inkC = (m: number) => Math.min(m, Cd * 0.5);
  const tileOk = (t: { tile15: string; tile2: string }) => (h: string) =>
    contrastRatio(h, t.tile15) >= AA && contrastRatio(h, t.tile2) >= AA && contrastRatio(h, tile1) >= 3;
  let tileInk: InkMode = "pale";
  let t = steps("pale");
  let stroke = searchV4(0.9, 0.985, 0.005, inkC(0.03), H, tileOk(t));
  if (!stroke) {
    tileInk = "dark"; t = steps("dark");
    stroke = searchV4(0.25, 0.1, 0.005, inkC(0.045), H, tileOk(t)) ?? hex(0.1, inkC(0.045));
  }
  const onBg = (h: string) => contrastRatio(h, t.bg) >= AA;
  const txtC = Math.min(0.022, Cd * 0.4), tintC = Math.min(0.055, Cd * 0.45);
  let outsideInk: InkMode = "pale";
  let txt = searchV4(0.94, 1, 0.01, txtC, H, onBg), tint = searchV4(0.79, 1, 0.01, tintC, H, onBg);
  if (!txt || !tint) {
    outsideInk = "dark";
    txt = searchV4(0.22, 0, 0.005, txtC, H, onBg) ?? hex(0, txtC);
    tint = searchV4(0.35, 0, 0.01, tintC, H, onBg) ?? hex(0, tintC);
  }
  let glow = tile1;
  for (let g = 4; g >= 1; g--) {
    const h = hex(Math.min(0.97, L1 + g / 100), Cd);
    if (contrastRatio(stroke, h) >= 3) { glow = h; break; }
  }
  let bg2 = t.bg;
  for (let s = 7; s >= 1; s--) {
    const h = hex(t.Lbg - s / 100, Cd * 0.85);
    if (contrastRatio(txt, h) >= AA && contrastRatio(tint, h) >= AA) { bg2 = h; break; }
  }
  const tokens = { bg: t.bg, tile1, tile15: t.tile15, tile2: t.tile2, stroke, txt, tint, adr: txt, bg2, glow };
  return { tokens, tileInk, outsideInk, deltaE: deltaEOK(base, tile1) };
}

export function deriveSimplePalette(baseHex: string): SimplePaletteTokens {
  return deriveSimplePaletteV4(baseHex).tokens;
}

export function resolveGuestDesign(value: unknown): GuestDesign {
  return value === "simple" ? "simple" : "trend";
}

export function resolveSimplePalette(palette: unknown, baseColor: unknown): SimplePaletteTokens {
  if (palette === "modra") return MODRA;
  if (palette === "custom" && isHexColor(baseColor)) return deriveSimplePalette(baseColor);
  return BORDO;
}

export function simplePaletteStyle(tokens: SimplePaletteTokens): Record<string, string> {
  // Presets keep their hardcoded white icon/arrow look; only custom palettes get
  // the v3/v4 adaptive tile ink (--s-ink = stroke) for icons, arrows and tile CTAs.
  const custom = tokens !== BORDO && tokens !== MODRA;
  return {
    // Custom also renders .lgs-small at full opacity: dark outside ink at .85 drops below 4.5.
    // Owner override: the template pale outline never follows adaptive ink.
    ...(custom ? { "--s-ink": tokens.stroke, "--s-outline": BORDO.stroke, "--s-small-opacity": "1" } : {}),
    // v4 B: tile glow stop + page depth; presets never emit these (CSS falls back to tile1 / bg).
    ...(custom && tokens.glow ? {
      "--s-glow": tokens.glow,
      "--s-grad": "linear-gradient(180deg,var(--s-glow) 0%,var(--s-tile1) 20%,var(--s-tile15) 58%,var(--s-tile2) 100%)",
    } : {}),
    ...(custom && tokens.bg2 ? { "--s-bg2": tokens.bg2, "--s-page": "linear-gradient(180deg,var(--s-bg) 0%,var(--s-bg2) 100%)" } : {}),
    "--s-bg": tokens.bg, "--s-tile1": tokens.tile1, "--s-tile15": tokens.tile15,
    "--s-tile2": tokens.tile2, "--s-stroke": tokens.stroke, "--s-txt": tokens.txt,
    "--s-tint": tokens.tint, "--s-adr": tokens.adr,
  };
}
