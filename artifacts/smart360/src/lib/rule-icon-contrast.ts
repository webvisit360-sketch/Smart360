// Rule-card icon colour (pravila-dizajn): tenant accent on light surfaces;
// on dark surfaces the accent only if >= 3:1, else lighten stepwise in HSL
// (hue + saturation kept, lightness x1.2 per step) until >= 3:1, else pale ink.

export type Rgb = [number, number, number];

export const RULE_ICON_MIN_CONTRAST = 3;
export const RULE_ICON_PALE_INK = "#E6ECF5";
export const DARK_SURFACE_LUMINANCE = 0.2;

export function parseColor(value: string | null | undefined): { rgb: Rgb; alpha: number } | null {
  if (!value) return null;
  const v = value.trim().toLowerCase();
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/.exec(v);
  if (hex) {
    const h = hex[1]!.length === 3 ? hex[1]!.split("").map((c) => c + c).join("") : hex[1]!;
    return { rgb: [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as Rgb, alpha: 1 };
  }
  const rgb = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/.exec(v);
  if (rgb) {
    const a = rgb[4] === undefined ? 1 : rgb[4].endsWith("%") ? parseFloat(rgb[4]) / 100 : parseFloat(rgb[4]);
    return { rgb: [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])].map((n) => Math.round(n)) as Rgb, alpha: a };
  }
  return null;
}

export function toHex([r, g, b]: Rgb): string {
  return "#" + [r, g, b].map((n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0")).join("").toUpperCase();
}

export function relativeLuminance([r, g, b]: Rgb): number {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

export function contrastRatio(a: Rgb, b: Rgb): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

function rgbToHsl([r, g, b]: Rgb): [number, number, number] {
  const R = r / 255, G = g / 255, B = b / 255;
  const max = Math.max(R, G, B), min = Math.min(R, G, B);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === R ? (G - B) / d + (G < B ? 6 : 0) : max === G ? (B - R) / d + 2 : (R - G) / d + 4;
  return [h / 6, s, l];
}

function hslToRgb([h, s, l]: [number, number, number]): Rgb {
  if (s === 0) return [l * 255, l * 255, l * 255].map(Math.round) as Rgb;
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const f = (t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return [f(h + 1 / 3), f(h), f(h - 1 / 3)].map((c) => Math.round(c * 255)) as Rgb;
}

/** One lightening step: same hue/saturation, lightness x1.2 (min +0.02). */
export function lightenStep(rgb: Rgb): Rgb {
  const [h, s, l] = rgbToHsl(rgb);
  return hslToRgb([h, s, Math.min(1, Math.max(l * 1.2, l + 0.02))]);
}

export function isDarkSurface(bg: Rgb): boolean {
  return relativeLuminance(bg) < DARK_SURFACE_LUMINANCE;
}

export type RuleIconTone = {
  color: string;
  contrast: number;
  steps: number;
  source: "accent" | "lightened" | "pale-ink";
};

export function ruleIconToneOnDark(accent: Rgb, bg: Rgb, maxSteps = 24): RuleIconTone {
  let current = accent;
  for (let steps = 0; steps <= maxSteps; steps++) {
    const c = contrastRatio(current, bg);
    if (c >= RULE_ICON_MIN_CONTRAST) {
      return { color: toHex(current), contrast: c, steps, source: steps === 0 ? "accent" : "lightened" };
    }
    const next = lightenStep(current);
    if (next.every((v, i) => v === current[i])) break;
    current = next;
  }
  const pale = parseColor(RULE_ICON_PALE_INK)!.rgb;
  return { color: RULE_ICON_PALE_INK, contrast: contrastRatio(pale, bg), steps: -1, source: "pale-ink" };
}
