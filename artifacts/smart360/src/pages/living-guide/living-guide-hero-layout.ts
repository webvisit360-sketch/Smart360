export const HERO_FULL_WIDTH_THRESHOLD = 0.89;
export const HERO_SIDE_BLUR_HEIGHT = 0.89;
export const HERO_GALLERY_MIN_HEIGHT = 0.45;
export const HERO_GALLERY_MAX_HEIGHT = 0.89;
export const DETAIL_FALLBACK_ASPECT = 16 / 9;
// Keep the existing 390×844 framing, but scale it by width rather than
// browser chrome / viewport height. The sheet must expose the same crop too.
export const DETAIL_REFERENCE_WIDTH = 390;
export const DETAIL_REFERENCE_HEIGHT = 844;
export const DETAIL_PHOTO_REVEAL_RATIO = 406 / DETAIL_REFERENCE_WIDTH;

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

// Clipped carousel slides inside the animated detail view may never be
// considered visible by the browser's native lazy-image observer.
export function galleryImageLoading(
  index: number,
  activeIndex: number,
  layoutReady: boolean,
): "eager" | "lazy" {
  return !layoutReady || Math.abs(index - activeIndex) <= 1 ? "eager" : "lazy";
}

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

export function stableMediaAspect(
  width: unknown,
  height: unknown,
): {
  aspect: number;
  source: "payload" | "fallback";
} {
  const payloadAspect = mediaAspectFromDimensions(width, height);
  return payloadAspect === null
    ? { aspect: DETAIL_FALLBACK_ASPECT, source: "fallback" }
    : { aspect: payloadAspect, source: "payload" };
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
  const referenceHeight = containerWidth * DETAIL_REFERENCE_HEIGHT / DETAIL_REFERENCE_WIDTH;
  const thresholdHeight = referenceHeight * HERO_FULL_WIDTH_THRESHOLD;
  const sideBlur = naturalHeight > thresholdHeight;

  return {
    branch: sideBlur ? "side-blur" : "full-bleed",
    naturalHeight,
    thresholdHeight,
    heroHeight: Math.max(
      1,
      sideBlur
        ? referenceHeight * HERO_SIDE_BLUR_HEIGHT
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
  const referenceHeight = containerWidth * DETAIL_REFERENCE_HEIGHT / DETAIL_REFERENCE_WIDTH;
  const minHeight = referenceHeight * HERO_GALLERY_MIN_HEIGHT;
  const maxHeight = referenceHeight * HERO_GALLERY_MAX_HEIGHT;

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