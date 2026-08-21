export const HERO_FULL_WIDTH_THRESHOLD = 0.8;
export const HERO_SIDE_BLUR_HEIGHT = 0.78;

export type LivingGuideHeroBranch = "full-bleed" | "side-blur";

export type LivingGuideHeroLayout = {
  branch: LivingGuideHeroBranch;
  naturalHeight: number;
  thresholdHeight: number;
  heroHeight: number;
};

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