// Photos are stored in two widths (620 for tiles, 1400 for gallery/lightbox).
// For URLs served by our storage route, append the width the browser needs;
// external or legacy URLs pass through untouched.
export function imgSrc(url: string | null | undefined, w: 620 | 1400): string {
  if (!url) return "/img/foto.jpg";
  if (url.startsWith("/api/storage/img/")) return `${url}?w=${w}`;
  return url;
}
