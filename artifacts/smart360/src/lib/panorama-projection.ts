/** Owner-approved heuristic, not a claim that arbitrary cropped photos encode
 * a known field of view. All other aspect ratios retain the flat viewer. */
export function isSphericalPanorama(width: number | null | undefined, height: number | null | undefined): boolean {
  return !!width && !!height && Number.isFinite(width) && Number.isFinite(height) &&
    width > 0 && height > 0 && Math.abs(width / height - 2) <= 0.04;
}
