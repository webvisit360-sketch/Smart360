export const HERO_FULL_WIDTH_THRESHOLD = 0.89;
export const HERO_SIDE_BLUR_HEIGHT = 0.89;
export const HERO_GALLERY_MIN_HEIGHT = 0.45;
export const HERO_GALLERY_MAX_HEIGHT = 0.89;

export type LivingGuideHeroBranch = "full-bleed" | "side-blur";

export type LivingGuideHeroLayout = {
  branch: LivingGuideHeroBranch;
  naturalHeight: number;
  thresholdHeight: number;
  heroHeight: number;
};

export type LivingGuideUniformGalleryLayout = {
  naturalHeights: number[];
  medianHeight: number;
  minHeight: number;
  maxHeight: number;
  heroHeight: number;
};

export function mediaAspectFromDimensions(
  width: unknown,
  height: unknown,
): number | null {
  const numericWidth = Number(width);
  const numericHeight = Number(height);
  if (
    !Number.isFinite(numericWidth) ||
    !Number.isFinite(numericHeight) ||
    numericWidth <= 0 ||
    numericHeight <= 0
  ) {
    return null;
  }
  return numericWidth / numericHeight;
}

export function calculateLivingGuideHeroLayout({
  containerWidth,
  imageAspect,
  viewportHeight,
}: {
  containerWidth: number;
  imageAspect: number;
  viewportHeight: number;
}): LivingGuideHeroLayout | null {
  if (
    !Number.isFinite(containerWidth) ||
    !Number.isFinite(imageAspect) ||
    !Number.isFinite(viewportHeight) ||
    containerWidth <= 0 ||
    imageAspect <= 0 ||
    viewportHeight <= 0
  ) {
    return null;
  }

  const naturalHeight = containerWidth / imageAspect;
  const thresholdHeight = viewportHeight * HERO_FULL_WIDTH_THRESHOLD;
  const sideBlur = naturalHeight > thresholdHeight;

  return {
    branch: sideBlur ? "side-blur" : "full-bleed",
    naturalHeight,
    thresholdHeight,
    heroHeight: Math.max(
      1,
      sideBlur
        ? Math.floor(viewportHeight * HERO_SIDE_BLUR_HEIGHT)
        : Math.round(naturalHeight),
    ),
  };
}

export function calculateLivingGuideUniformGalleryLayout({
  containerWidth,
  imageAspects,
  viewportHeight,
}: {
  containerWidth: number;
  imageAspects: readonly (number | null | undefined)[];
  viewportHeight: number;
}): LivingGuideUniformGalleryLayout | null {
  if (
    !Number.isFinite(containerWidth) ||
    !Number.isFinite(viewportHeight) ||
    containerWidth <= 0 ||
    viewportHeight <= 0 ||
    imageAspects.length < 2
  ) {
    return null;
  }

  if (
    imageAspects.some(
      (aspect) => !Number.isFinite(aspect) || (aspect ?? 0) <= 0,
    )
  ) {
    return null;
  }

  const naturalHeights = imageAspects.map(
    (aspect) => containerWidth / Number(aspect),
  );
  const sortedHeights = [...naturalHeights].sort((left, right) => left - right);
  const middle = Math.floor(sortedHeights.length / 2);
  const medianHeight =
    sortedHeights.length % 2 === 0
      ? (sortedHeights[middle - 1] + sortedHeights[middle]) / 2
      : sortedHeights[middle];
  const minHeight = viewportHeight * HERO_GALLERY_MIN_HEIGHT;
  const maxHeight = viewportHeight * HERO_GALLERY_MAX_HEIGHT;

  return {
    naturalHeights,
    medianHeight,
    minHeight,
    maxHeight,
    heroHeight: Math.min(
      Math.floor(maxHeight),
      Math.max(
        Math.ceil(minHeight),
        Math.round(Math.min(maxHeight, Math.max(minHeight, medianHeight))),
      ),
    ),
  };
}

export function nearestGalleryIndex(
  scrollLeft: number,
  frameWidth: number,
  slideCount: number,
): number {
  if (
    !Number.isFinite(scrollLeft) ||
    !Number.isFinite(frameWidth) ||
    !Number.isFinite(slideCount) ||
    frameWidth <= 0 ||
    slideCount <= 1
  ) {
    return 0;
  }

  return Math.max(
    0,
    Math.min(slideCount - 1, Math.round(scrollLeft / frameWidth)),
  );
}