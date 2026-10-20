// Enostaven palettes. Bordo and modra are copied verbatim from the binding
// references; "custom" derives every token from one base colour (= tile1)
// by replaying the bordo palette's HSL relationships to its own tile1.

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

type Hsl = [number, number, number];
function hexToHsl(hex: string): Hsl {
  const n = parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}
function hslToHex([h, s, l]: Hsl): string {
  const hue = ((h % 360) + 360) % 360 / 360;
  const f = (p: number, q: number, t: number) => {
    if (t < 0) t += 1; if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  let r = l, g = l, b = l;
  if (s > 0) {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = f(p, q, hue + 1 / 3); g = f(p, q, hue); b = f(p, q, hue - 1 / 3);
  }
  const x = (v: number) => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, "0");
  return `#${x(r)}${x(g)}${x(b)}`.toUpperCase();
}
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** Pale tokens (outline/text) are measured by their distance to white. */
export const SIMPLE_PALE_TOKENS = ["stroke", "txt", "tint", "adr"] as const;

/**
 * Deterministic derivation; every token keeps its bordo relationship to tile1:
 *  - hue: bordo hue offset added to the base hue;
 *  - saturation: bordo ratio S(token)/S(tile1) times base S (clamped);
 *  - dark tokens (bg/tile15/tile2) lightness: L = Lbase * L(token)/L(tile1);
 *  - pale tokens lightness keep the same *relative headroom to white*:
 *      1 - L = (1 - Lbase) * (1 - L(token)) / (1 - L(tile1)).
 * Edges are safe: a black base (L=0) gives black dark tokens and the bordo
 * headroom ratio for pale tokens; a white base (L=1) gives pale tokens = white
 * and dark tokens at the bordo ratio of white. Gray bases (S=0) stay gray.
 * Results are clamped to [0,1] and rounded to #RRGGBB, so bordo's own tile1
 * reproduces bordo within one RGB step.
 */
export function deriveSimplePalette(baseHex: string): SimplePaletteTokens {
  const baseUpper = baseHex.trim().toUpperCase();
  const base = hexToHsl(baseUpper);
  const ref = hexToHsl(BORDO.tile1);
  const out = {} as SimplePaletteTokens;
  const pale = new Set<keyof SimplePaletteTokens>(SIMPLE_PALE_TOKENS);
  for (const key of Object.keys(BORDO) as (keyof SimplePaletteTokens)[]) {
    if (key === "tile1") { out.tile1 = baseUpper; continue; }
    const tok = hexToHsl(BORDO[key]);
    const h = base[0] + (tok[0] - ref[0]);
    const s = clamp01(base[1] * (tok[1] / ref[1]));
    const l = pale.has(key)
      ? clamp01(1 - (1 - base[2]) * ((1 - tok[2]) / (1 - ref[2])))
      : clamp01(base[2] * (tok[2] / ref[2]));
    out[key] = hslToHex([h, s, l]);
  }
  return out;
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
