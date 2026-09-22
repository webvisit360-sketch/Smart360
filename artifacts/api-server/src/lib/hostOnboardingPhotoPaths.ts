export function hostOnboardingRawObjectPath(
  tenantId: string,
  onboardingId: string,
  photoId: string,
): string {
  return `/objects/host-onboarding/${tenantId}/${onboardingId}/${photoId}.raw`;
}

export function hostOnboardingSanitizedObjectPath(
  tenantId: string,
  onboardingId: string,
  photoId: string,
): string {
  return `/objects/host-onboarding/${tenantId}/${onboardingId}/${photoId}.sanitized.jpg`;
}

/**
 * Cleanup must remove both exact keys: a signed raw key may be recreated until
 * its short-lived PUT URL expires, while the DB points only at the final key.
 */
export function hostOnboardingObjectCounterpart(path: string): string | null {
  if (path.endsWith(".raw")) return `${path.slice(0, -4)}.sanitized.jpg`;
  if (path.endsWith(".sanitized.jpg")) {
    return `${path.slice(0, -".sanitized.jpg".length)}.raw`;
  }
  return null;
}