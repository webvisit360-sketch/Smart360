// Panoramic entry photos — shared, side-effect-free rules for admin + guest.

type MediaLike = { kind?: string | null; isPanorama?: boolean | null };

/** Videos can never be panoramas, whatever the stored flag says. */
export function canMarkPanorama(media: MediaLike | null | undefined): boolean {
  return !!media && (media.kind ?? "image") !== "video";
}

export function isPanoramaMedia(media: MediaLike | null | undefined): boolean {
  return canMarkPanorama(media) && media!.isPanorama === true;
}

/** Preserves order inside both groups. */
export function splitPanoramaMedia<T extends MediaLike>(media: T[] | null | undefined): { regular: T[]; panoramas: T[] } {
  const regular: T[] = [];
  const panoramas: T[] = [];
  for (const entry of media ?? []) (isPanoramaMedia(entry) ? panoramas : regular).push(entry);
  return { regular, panoramas };
}

/** Upload flag: only photo files chosen through the panorama option get it. */
export function panoramaUploadFlag(file: { type: string; name: string }, wantPanorama: boolean): boolean {
  if (!wantPanorama) return false;
  if (file.type.startsWith("video/") || /\.(mp4|webm|mov|m4v)$/i.test(file.name)) return false;
  return file.type.startsWith("image/");
}

/** Allowed translateX range for an image of width imgW in a viewport viewW. */
export function panoramaPanBounds(imgW: number, viewW: number): { min: number; max: number } {
  if (!(imgW > viewW)) {
    const centred = (viewW - Math.max(0, imgW)) / 2;
    return { min: centred, max: centred };
  }
  return { min: viewW - imgW, max: 0 };
}

export function clampPanoramaPan(x: number, imgW: number, viewW: number): number {
  const { min, max } = panoramaPanBounds(imgW, viewW);
  return Math.min(max, Math.max(min, x));
}

export function centredPanoramaPan(imgW: number, viewW: number): number {
  const { min, max } = panoramaPanBounds(imgW, viewW);
  return (min + max) / 2;
}

export const PANORAMA_EDGE_SWIPE_PX = 72;

/**
 * Raw (unclamped) drag position after a gesture → navigation intent.
 * Dragging past the left edge (content moves right) asks for the previous
 * panorama, past the right edge for the next — only when one exists.
 */
export function panoramaEdgeIntent(
  rawX: number,
  imgW: number,
  viewW: number,
  index: number,
  count: number,
  threshold = PANORAMA_EDGE_SWIPE_PX,
): "prev" | "next" | null {
  const { min, max } = panoramaPanBounds(imgW, viewW);
  if (rawX - max > threshold && index > 0) return "prev";
  if (min - rawX > threshold && index < count - 1) return "next";
  return null;
}

export function stepPanoramaIndex(index: number, count: number, dir: "prev" | "next"): number {
  if (count <= 0) return 0;
  const next = dir === "next" ? index + 1 : index - 1;
  return Math.max(0, Math.min(count - 1, next));
}

type Lang = "sl" | "en" | "de" | "it" | "fr" | "nl" | "hr";
const L = {
  strip: { sl: "Panorame", en: "Panoramas", de: "Panoramen", it: "Panorami", fr: "Panoramas", nl: "Panorama's", hr: "Panorame" },
  open: { sl: "Odpri panoramo {n} od {c}", en: "Open panorama {n} of {c}", de: "Panorama {n} von {c} öffnen", it: "Apri panorama {n} di {c}", fr: "Ouvrir le panorama {n} sur {c}", nl: "Panorama {n} van {c} openen", hr: "Otvori panoramu {n} od {c}" },
  viewer: { sl: "Panorama na celem zaslonu", en: "Full-screen panorama", de: "Panorama im Vollbild", it: "Panorama a schermo intero", fr: "Panorama en plein écran", nl: "Panorama op volledig scherm", hr: "Panorama preko cijelog zaslona" },
  prev: { sl: "Prejšnja panorama", en: "Previous panorama", de: "Vorheriges Panorama", it: "Panorama precedente", fr: "Panorama précédent", nl: "Vorige panorama", hr: "Prethodna panorama" },
  next: { sl: "Naslednja panorama", en: "Next panorama", de: "Nächstes Panorama", it: "Panorama successivo", fr: "Panorama suivant", nl: "Volgende panorama", hr: "Sljedeća panorama" },
  close: { sl: "Zapri panoramo", en: "Close panorama", de: "Panorama schließen", it: "Chiudi panorama", fr: "Fermer le panorama", nl: "Panorama sluiten", hr: "Zatvori panoramu" },
  pan: { sl: "Povlecite levo ali desno za ogled", en: "Drag left or right to look around", de: "Nach links oder rechts ziehen", it: "Trascina a sinistra o a destra", fr: "Faites glisser à gauche ou à droite", nl: "Sleep naar links of rechts", hr: "Povucite lijevo ili desno" },
  counter: { sl: "Panorama {n} od {c}", en: "Panorama {n} of {c}", de: "Panorama {n} von {c}", it: "Panorama {n} di {c}", fr: "Panorama {n} sur {c}", nl: "Panorama {n} van {c}", hr: "Panorama {n} od {c}" },
} as const;
export type PanoramaLabelKey = keyof typeof L;

export function panoramaLabel(key: PanoramaLabelKey, lang: string, n?: number, c?: number): string {
  const table = L[key] as Record<Lang, string>;
  const text = table[(lang as Lang)] ?? table.sl;
  return text.replace("{n}", String(n ?? "")).replace("{c}", String(c ?? ""));
}
export const PANORAMA_LANGS: readonly Lang[] = ["sl", "en", "de", "it", "fr", "nl", "hr"];
export const PANORAMA_LABEL_KEYS = Object.keys(L) as PanoramaLabelKey[];
