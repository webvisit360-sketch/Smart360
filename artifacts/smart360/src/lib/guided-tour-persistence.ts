import { loadTour, recoverTour, saveTour, tourStorageKey, type TourState } from './live-tour';

type TourStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
type EnumerableStorage = TourStorage & Pick<Storage, 'key' | 'length'>;

/** Guided results belong to the current view, not a later visit. Active backups
 * and the default/free-recording persistence policy remain unchanged. */
export function loadTourForView(
  key: string, now: number, ephemeralFinished = false, storage?: TourStorage,
): TourState | null {
  const saved = loadTour(key, storage);
  if (ephemeralFinished && saved?.status === 'finished') {
    saveTour(key, null, storage);
    return null;
  }
  const recovered = saved && recoverTour(saved, now);
  if (recovered && recovered !== saved) saveTour(key, recovered, storage);
  return recovered;
}

export function saveTourForView(
  key: string, state: TourState | null, ephemeralFinished = false, storage?: TourStorage,
): void {
  saveTour(key, ephemeralFinished && state?.status === 'finished' ? null : state, storage);
}

/** Run at app startup, even when the guest never opens the old route again.
 * Only this version's slug/itemId backups are ours; free-tour and other data
 * are deliberately excluded. Snapshot keys before removing to avoid skipping. */
export function purgeFinishedGuidedTours(storage?: EnumerableStorage): void {
  try {
    const target = storage ?? window.localStorage;
    const prefix = tourStorageKey('');
    const keys = Array.from({ length: target.length }, (_, i) => target.key(i));
    for (const key of keys) {
      if (!key?.startsWith(prefix)) continue;
      try {
        const parts = decodeURIComponent(key.slice(prefix.length)).split('/');
        if (parts.length !== 2 || parts.some(part => !part) || parts[1] === 'free-tour') continue;
        const envelope = JSON.parse(target.getItem(key) ?? 'null');
        if (envelope?.version === 1 && envelope.state?.status === 'finished') target.removeItem(key);
      } catch { /* A malformed or inaccessible unrelated entry must not block startup. */ }
    }
  } catch { /* Private-mode storage may be unavailable. In-memory recording still works. */ }
}