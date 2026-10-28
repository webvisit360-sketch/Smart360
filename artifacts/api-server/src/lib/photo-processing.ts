import sharp from "sharp";

export const PHOTO_MAX_PIXELS = 60_000_000;
export const PANORAMA_MAX_PIXELS = 160_000_000;

export async function inspectPhoto(original: Buffer, panorama: boolean) {
  const limit = panorama ? PANORAMA_MAX_PIXELS : PHOTO_MAX_PIXELS;
  const meta = await sharp(original, { limitInputPixels: limit }).metadata();
  if (!meta.width || !meta.height || meta.width * meta.height > limit) {
    throw new Error(`Slika presega omejitev ${limit / 1_000_000} milijonov pik.`);
  }
  return meta;
}

/** Keep the existing variant URL/cache contract; panorama's gallery variant
 * has a larger bounded raster, thumbnails remain unchanged. */
export function photoVariant(original: Buffer, width: number, quality: number, panorama = false) {
  return sharp(original, panorama ? { limitInputPixels: PANORAMA_MAX_PIXELS } : {})
    .rotate()
    .resize(panorama && width === 1400
      ? { width: 8192, height: 4096, fit: "inside", withoutEnlargement: true }
      : { width, withoutEnlargement: true })
    .jpeg({ quality: panorama && width === 1400 ? 85 : quality, mozjpeg: true })
    .toBuffer();
}
