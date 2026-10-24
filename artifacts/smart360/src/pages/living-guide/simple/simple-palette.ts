// Enostaven palettes. Bordo and modra are copied verbatim from the binding
// references; "custom" derives every token from one base colour with the
// approved OKLCH formula (barvna-izpeljava sheet).

export type SimplePaletteTokens = {
  bg: string; tile1: string; tile15: string; tile2: string;
  stroke: string; txt: string; tint: string; adr: string;
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
/** Step 4: oklch -> sRGB hex, reducing C by 0.001 until inside the sRGB gamut. */
function oklchToHex(L: number, C: number, H: number): string {
  let c = C, lin = oklchToLinear(L, c, H);
  while (!inGamut(lin) && c > 0) { c = Math.max(0, c - 0.001); lin = oklchToLinear(L, c, H); }
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

/**
 * Approved OKLCH derivation (attached_assets/barvna-izpeljava_*.html), 1:1.
 * tile1 is derived (L 0.50), not the raw base. The sheet defines no `adr`
 * token: for custom palettes adr is an alias of txt (documented decision).
 */
export function deriveSimplePalette(baseHex: string): SimplePaletteTokens {
  const [, Cb, Hb] = srgbToOklch(baseHex.trim().toUpperCase());
  const nearGrey = Cb < 0.02;
  const H = Cb < 0.005 ? COOL : Hb;
  const C = nearGrey ? 0.045 : Math.min(0.165, Math.max(0.09, Cb));
  const tile1 = oklchToHex(0.5, C, H);
  const tile15 = oklchToHex(0.42, C * 0.82, toward(H, COOL, 4));
  const tile2 = oklchToHex(0.29, C * 0.62, toward(H, COOL, 12));
  const bg = oklchToHex(0.325, Math.min(C * 0.42, 0.075), toward(H, COOL, 18));
  // Step 5: raise L by 0.01 until every pair on the rounded hex reaches 4.5:1.
  const lift = (L: number, c: number, h: number, against: string[]) => {
    let l = L, hex = oklchToHex(l, c, h);
    while (l < 1 && against.some((o) => contrastRatio(hex, o) < AA)) { l = Math.min(1, +(l + 0.01).toFixed(4)); hex = oklchToHex(l, c, h); }
    return hex;
  };
  const stroke = lift(0.9, Math.min(0.03, C * 0.5), H, [tile15, tile2]);
  const txt = lift(0.94, Math.min(0.022, C * 0.4), H, [bg]);
  const tint = lift(0.79, Math.min(0.055, C * 0.45), toward(H, COOL, 30), [bg]);
  return { bg, tile1, tile15, tile2, stroke, txt, tint, adr: txt };
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
  return {
    "--s-bg": tokens.bg, "--s-tile1": tokens.tile1, "--s-tile15": tokens.tile15,
    "--s-tile2": tokens.tile2, "--s-stroke": tokens.stroke, "--s-txt": tokens.txt,
    "--s-tint": tokens.tint, "--s-adr": tokens.adr,
  };
}
