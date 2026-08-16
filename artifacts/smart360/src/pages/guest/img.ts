// Photos are stored in two widths (620 for tiles, 1400 for gallery/lightbox).
// For URLs served by our storage route, append the width the browser needs;
// external or legacy URLs pass through untouched.
export function imgSrc(url: string | null | undefined, w: 620 | 1400): string {
  if (!url) return "/img/foto.jpg";
  if (url.startsWith("/api/storage/img/")) return `${url}?w=${w}`;
  return url;
}

type MediaLike = { url: string; kind?: string | null; posterUrl?: string | null };

/**
 * The image that stands in for a media entry (tile, card, thumbnail).
 * A video is represented by its server-generated poster frame — the video
 * file itself must never be downloaded just to draw a tile.
 */
export function mediaImgSrc(m: MediaLike | null | undefined, w: 620 | 1400): string {
  if (!m) return "/img/foto.jpg";
  if (m.kind === "video") return imgSrc(m.posterUrl, w);
  return imgSrc(m.url, w);
}

export function isVideoMedia(m: MediaLike | null | undefined): boolean {
  return m?.kind === "video";
}
