export type ImageDimensionMetadata = {
  width?: number | null;
  height?: number | null;
  orientation?: number | null;
};

/**
 * Sharp's rotate() applies EXIF orientation before storing image variants.
 * Orientations 5–8 swap the display axes, so persist the post-rotation shape.
 */
export function orientedImageDimensions(
  metadata: ImageDimensionMetadata,
): { width: number; height: number } | null {
  const width = Number(metadata.width);
  const height = Number(metadata.height);
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0
  ) {
    return null;
  }

  const orientation = Number(metadata.orientation ?? 1);
  const swapsAxes = orientation >= 5 && orientation <= 8;
  return swapsAxes
    ? { width: Math.round(height), height: Math.round(width) }
    : { width: Math.round(width), height: Math.round(height) };
}