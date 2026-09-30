// All tour positions and timestamps remain on the guest's device. Never send this state to an API.
export type TourPoint = { lat: number; lon: number; accuracy: number; timestamp: number; altitude?: number | null };
export type TourStatus = 'moving' | 'auto-paused' | 'manual-paused' | 'finished';
export type TourState = {
  status: TourStatus;
  startedAt: number;
  updatedAt: number;
  finishedAt?: number;
  movingMs: number;
  pausedMs: number;
  distanceM: number;
  points: TourPoint[];
  /** Index of each first point after a GPS gap. Never draw/export an artificial bridge. */
  segmentStarts: number[];
  lastFixAt: number | null;
  stationarySince: number | null;
  stopPoint: TourPoint | null;
};
export type TourMetrics = { movingMs: number; pausedMs: number; elapsedMs: number; distanceM: number };

export const MAX_ACCURACY_M = 30;
export const STOP_DWELL_MS = 20_000; // Two or more accurate fixes within 12m for 20 seconds.
export const STOP_RADIUS_M = 12;
export const RESUME_RADIUS_M = 30;
export const GPS_GAP_MS = 30_000; // No moving-time credit beyond 30s without an accurate fix.
export const TRACK_GAP_MS = 30_000; // A longer gap begins a new recorded segment.

export function distanceMeters(a: Pick<TourPoint, 'lat' | 'lon'>, b: Pick<TourPoint, 'lat' | 'lon'>): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLon = (b.lon - a.lon) * rad;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 6371000 * 2 * Math.asin(Math.min(1, Math.sqrt(x)));
}

export function startTour(now: number): TourState {
  return {
    status: 'moving', startedAt: now, updatedAt: now, movingMs: 0, pausedMs: 0,
    distanceM: 0, points: [], segmentStarts: [0], lastFixAt: null,
    stationarySince: null, stopPoint: null,
  };
}

/** Account by wall timestamps, assigning missing-GPS intervals to pause, not fabricated movement. */
export function advanceTour(state: TourState, now: number): TourState {
  if (state.status === 'finished' || !Number.isFinite(now) || now <= state.updatedAt) return state;
  const movingEnd = state.status === 'moving' && state.lastFixAt !== null
    ? Math.max(state.updatedAt, Math.min(now, state.lastFixAt + GPS_GAP_MS)) : state.updatedAt;
  const moving = movingEnd - state.updatedAt;
  return {
    ...state, updatedAt: now,
    movingMs: state.movingMs + moving,
    pausedMs: state.pausedMs + (now - state.updatedAt - moving),
  };
}

export function tourMetrics(state: TourState | null, now: number): TourMetrics {
  if (!state) return { movingMs: 0, pausedMs: 0, elapsedMs: 0, distanceM: 0 };
  const current = advanceTour(state, now);
  return {
    movingMs: current.movingMs, pausedMs: current.pausedMs,
    elapsedMs: current.updatedAt - current.startedAt, distanceM: current.distanceM,
  };
}

export function pauseTour(state: TourState, now: number): TourState {
  if (state.status === 'finished' || state.status === 'manual-paused') return state;
  return { ...advanceTour(state, now), status: 'manual-paused', stationarySince: null, stopPoint: null };
}
export function resumeTour(state: TourState, now: number): TourState {
  if (state.status !== 'manual-paused') return state;
  // A resumed watch must establish a new fix. Never credit unobserved time or bridge across pause.
  return { ...advanceTour(state, now), status: 'moving', lastFixAt: null, stationarySince: null, stopPoint: null };
}
export function finishTour(state: TourState, now: number): TourState {
  if (state.status === 'finished') return state;
  const next = advanceTour(state, now);
  return { ...next, status: 'finished', finishedAt: next.updatedAt, stationarySince: null };
}

/** Reload/recovery is an explicit track boundary, even when the last fix was recent. */
export function recoverTour(state: TourState, now: number): TourState {
  if (state.status === 'finished') return state;
  return { ...advanceTour(state, now), lastFixAt: null,
    stationarySince: null, stopPoint: state.status === 'auto-paused' ? state.stopPoint : null };
}

export function recordTourPoint(state: TourState, point: TourPoint): TourState {
  if (state.status === 'finished' || !Number.isFinite(point.timestamp) ||
      !Number.isFinite(point.lat) || !Number.isFinite(point.lon) ||
      !Number.isFinite(point.accuracy) || point.accuracy < 0 || point.accuracy > MAX_ACCURACY_M ||
      Math.abs(point.lat) > 90 || Math.abs(point.lon) > 180 ||
      (point.altitude != null && !Number.isFinite(point.altitude)) ||
      point.timestamp <= state.updatedAt || (state.lastFixAt !== null && point.timestamp <= state.lastFixAt)) return state;
  const next = advanceTour(state, point.timestamp);
  const previous = state.points.at(-1);
  const gap = state.lastFixAt === null || point.timestamp - state.lastFixAt > TRACK_GAP_MS;
  const step = previous && !gap ? distanceMeters(previous, point) : 0;
  // Discard improbable jumps; do not turn a GPS teleport into distance or a resume event.
  if (previous && !gap && step / ((point.timestamp - previous.timestamp) / 1000) > 45) return next;
  const movement = !!previous && !gap && step >= Math.max(8, Math.min(previous.accuracy, point.accuracy));
  const points = !previous || gap || movement ? [...state.points, point] : state.points;
  const segmentStarts = gap && previous ? [...state.segmentStarts, points.length - 1] : state.segmentStarts;
  // Auto-pause stops the timer, not the traveled-track recorder: count accurate
  // steps inside the circle and the step which exits it. Manual pause records neither.
  const distanceM = state.distanceM + (movement && state.status !== 'manual-paused' ? step : 0);
  if (state.status === 'manual-paused') {
    // Manual pause deliberately does not record track/distance; resume starts a fresh segment.
    return { ...next, lastFixAt: point.timestamp };
  }
  if (gap && state.status !== 'auto-paused') {
    return { ...next, points, segmentStarts, distanceM, lastFixAt: point.timestamp,
      status: 'moving', stationarySince: null, stopPoint: null };
  }
  if (state.status === 'auto-paused') {
    // Only an accurate fix outside the literal 30m stop circle resumes, even after a long gap.
    if (state.stopPoint && distanceMeters(state.stopPoint, point) > RESUME_RADIUS_M) {
      return { ...next, points, segmentStarts, distanceM, lastFixAt: point.timestamp,
        status: 'moving', stationarySince: null, stopPoint: null };
    }
    return { ...next, points, segmentStarts, distanceM, lastFixAt: point.timestamp };
  }
  // Candidate starts on the first repeated position; an actual 20s dwell is required.
  const near = previous && distanceMeters(previous, point) <= STOP_RADIUS_M + point.accuracy;
  const nearAnchor = state.stopPoint && distanceMeters(state.stopPoint, point) <= STOP_RADIUS_M + point.accuracy;
  // Reset the anchor when walking away in small successive steps. Otherwise a later true stop
  // could never satisfy the radius of an obsolete anchor.
  const stationarySince = near ? (nearAnchor ? state.stationarySince ?? point.timestamp : point.timestamp) : null;
  const stopPoint = near ? (nearAnchor ? state.stopPoint : previous) : null;
  if (stationarySince !== null && stopPoint &&
      distanceMeters(stopPoint, point) <= STOP_RADIUS_M + point.accuracy &&
      point.timestamp - stationarySince >= STOP_DWELL_MS) {
    // Reclassify the observed stationary dwell as paused rather than moving.
    const credit = Math.min(point.timestamp - stationarySince, next.movingMs);
    return { ...next, points, segmentStarts, distanceM, lastFixAt: point.timestamp,
      status: 'auto-paused', stationarySince: null, stopPoint,
      movingMs: next.movingMs - credit, pausedMs: next.pausedMs + credit };
  }
  return { ...next, points, segmentStarts, distanceM, lastFixAt: point.timestamp,
    stationarySince, stopPoint };
}

const STORAGE_VERSION = 1;
export function tourStorageKey(key: string): string { return `smart360:live-tour:v${STORAGE_VERSION}:${encodeURIComponent(key)}`; }
type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
const validPoint = (p: TourPoint): boolean => !!p && Number.isFinite(p.lat) && Math.abs(p.lat) <= 90 &&
  Number.isFinite(p.lon) && Math.abs(p.lon) <= 180 && Number.isFinite(p.accuracy) &&
  p.accuracy >= 0 && p.accuracy <= MAX_ACCURACY_M && Number.isFinite(p.timestamp) &&
  (p.altitude == null || Number.isFinite(p.altitude));
export function loadTour(key: string, storage?: StorageLike): TourState | null {
  try {
    const raw = (storage ?? window.localStorage).getItem(tourStorageKey(key));
    if (!raw) return null;
    const envelope = JSON.parse(raw);
    if (envelope.version !== STORAGE_VERSION) return null;
    const s: TourState = envelope.state;
    if (!s || !(['moving', 'auto-paused', 'manual-paused', 'finished'] as unknown[]).includes(s.status) ||
        ![s.startedAt, s.updatedAt, s.movingMs, s.pausedMs, s.distanceM].every(v => Number.isFinite(v) && v >= 0) ||
        s.updatedAt < s.startedAt || !Array.isArray(s.points) || s.points.length > 200000 ||
        !s.points.every(validPoint) || !Array.isArray(s.segmentStarts) || s.segmentStarts[0] !== 0 ||
        !s.segmentStarts.every((n, i) => Number.isInteger(n) && n >= 0 && n < Math.max(1, s.points.length) &&
          (i === 0 || n > s.segmentStarts[i - 1])) ||
        !(s.lastFixAt === null || Number.isFinite(s.lastFixAt)) ||
        !(s.stationarySince === null || Number.isFinite(s.stationarySince)) ||
        !(s.stopPoint === null || validPoint(s.stopPoint)) ||
        (s.status === 'finished' && !Number.isFinite(s.finishedAt))) return null;
    return s;
  } catch { return null; } // localStorage may be blocked by browser/privacy settings.
}
export function saveTour(key: string, state: TourState | null, storage?: StorageLike): void {
  try {
    const target = storage ?? window.localStorage;
    if (state) target.setItem(tourStorageKey(key), JSON.stringify({ version: STORAGE_VERSION, state }));
    else target.removeItem(tourStorageKey(key));
  } catch { /* Best effort on-device backup only. */ }
}