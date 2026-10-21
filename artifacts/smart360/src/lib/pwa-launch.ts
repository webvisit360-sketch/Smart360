export const PWA_RESUME_THRESHOLD_MS = 30_000;

/** A per-document lifecycle machine. Does not own navigation or tour state. */
export function createPwaLaunchPolicy(reset: () => void, now = Date.now) {
  let started = false;
  let hiddenAt: number | null = null;
  let lastShownAt: number | null = null;
  return {
    hide() {
      hiddenAt ??= now();
    },
    show(restored = false) {
      const at = now();
      const elapsed = hiddenAt === null ? null : at - hiddenAt;
      const unobservedRestore = restored && elapsed === null && lastShownAt !== null
        && (at - lastShownAt >= PWA_RESUME_THRESHOLD_MS || at < lastShownAt);
      const fresh = !started || (elapsed !== null && (elapsed >= PWA_RESUME_THRESHOLD_MS || elapsed < 0))
        || unobservedRestore;
      started = true;
      hiddenAt = null;
      lastShownAt = at;
      if (fresh) reset();
      return fresh;
    },
  };
}
