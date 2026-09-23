export const LUCIDE_ICON_PREFIX = "lucide:";
export const DEFAULT_CATEGORY_ICON = `${LUCIDE_ICON_PREFIX}star`;

export function normalizeSlovenian(value: string): string {
  return value
    .toLocaleLowerCase("sl")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const FALLBACK_ICONS = ["star", "tag", "sparkles"] as const;

const MATCHES: ReadonlyArray<readonly [readonly string[], readonly [string, string, string]]> = [
  [["kuhinj", "kulinar", "hran"], ["utensils", "chef-hat", "cooking-pot"]],
  [["koles", "kolo"], ["bike", "route", "map"]],
  [["bazen", "vod"], ["waves", "droplets", "life-buoy"]],
  [["trgovin"], ["shopping-bag", "shopping-cart", "store"]],
  [["parkir", "parking", "avto", "car", "vozil", "kljuc", "key"], ["car", "circle-parking", "key-round"]],
  [["spalnic", "sob", "apart", "postelj", "bed"], ["bed", "bed-double", "bed-single"]],
  [["wifi", "internet", "omrez"], ["wifi", "router", "radio-tower"]],
  [["pravil", "navodil"], ["clipboard-list", "book-open", "scroll-text"]],
  [["zajtrk", "restavr", "kav", "pijac"], ["coffee", "croissant", "soup"]],
  [["zdrav", "lekarn", "zdravnik"], ["heart-pulse", "cross", "pill"]],
  [["izlet", "pohod", "sprehod"], ["mountain", "footprints", "signpost"]],
  [["otrok", "igr", "druzin"], ["baby", "toy-brick", "gamepad-2"]],
  [["wellness", "savn", "spa"], ["sparkles", "bath", "heater"]],
  [["kontakt", "telefon", "klic"], ["phone", "mail", "message-circle"]],
  [["dogod", "glasb", "koncert"], ["calendar-days", "music", "party-popper"]],
  [["pranj", "peril", "praln"], ["washing-machine", "shirt", "wind"]],
  [["zvezd", "star"], ["star", "sparkles", "award"]],
  [["oznak", "tag"], ["tag", "tags", "bookmark"]],
  [["blesc", "iskric", "spark"], ["sparkles", "wand-sparkles", "star"]],
];

/** Returns exactly three stable DB keys without browser or icon-library code. */
export function suggestCategoryIcons(name: string): [string, string, string] {
  const normalized = normalizeSlovenian(name);
  const match = MATCHES.find(([stems]) =>
    stems.some((stem) => normalized.split(" ").some((word) => word.startsWith(stem))),
  );
  const icons = match?.[1] ?? FALLBACK_ICONS;
  return icons.map((icon) => `${LUCIDE_ICON_PREFIX}${icon}`) as [string, string, string];
}

/** Best match for automatic/server-side assignment. */
export function suggestCategoryIcon(name: string): string {
  return suggestCategoryIcons(name)[0];
}

export function lucideIconName(key?: string | null): string | null {
  if (!key?.startsWith(LUCIDE_ICON_PREFIX)) return null;
  const name = key.slice(LUCIDE_ICON_PREFIX.length);
  return /^[a-z0-9-]+$/.test(name) ? name : null;
}

export function lucideIconKey(name: string): string {
  return `${LUCIDE_ICON_PREFIX}${name}`;
}