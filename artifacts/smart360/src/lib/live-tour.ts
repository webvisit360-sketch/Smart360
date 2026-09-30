// All tour positions and timestamps remain on the guest's device. Never send this state to an API.
export type TourPoint = { lat: number; lon: number; accuracy: number; timestamp: number; altitude?: number | null; altitudeAccuracy?: number | null };
export type TourStatus = 'moving' | 'auto-paused' | 'manual-paused' | 'finished';
export type TourActivity = 'cycling' | 'hiking';
export type TourState = {
  activity: TourActivity;
  status: TourStatus;
  startedAt: number;
  updatedAt: number;
  finishedAt?: number;
  movingMs: number;
  pausedMs: number;
  distanceM: number;
  ascentM: number;
  points: TourPoint[];
  /** Index of each first point after a GPS gap. Never draw/export an artificial bridge. */
  segmentStarts: number[];
  /** Number of complete old segments omitted once the segment cap is reached. */
  omittedSegments: number;
  lastFixAt: number | null;
  /** Last accepted accurate fix; never infer distance from simplified track points. */
  lastFixPoint: TourPoint | null;
  /** Last distance-counted fix (or first fix of a segment); independent of track thinning. */
  distanceAnchor: TourPoint | null;
  ascentBaseline: number | null;
  ascentBaselineAt: number | null;
  stationarySince: number | null;
  stopPoint: TourPoint | null;
};
export type TourMetrics = { movingMs: number; pausedMs: number; elapsedMs: number; distanceM: number; ascentM?: number };

export const MAX_TRACK_POINTS = 4096;
// Match the server GPX import limit so even an all-day export remains uploadable.
export const MAX_TRACK_SEGMENTS = 100;
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

export function startTour(now: number, activity: TourActivity = 'hiking'): TourState {
  return {
    activity, status: 'moving', startedAt: now, updatedAt: now, movingMs: 0, pausedMs: 0,
    distanceM: 0, ascentM: 0, points: [], segmentStarts: [0], omittedSegments: 0,
    lastFixAt: null, lastFixPoint: null, distanceAnchor: null, ascentBaseline: null, ascentBaselineAt: null,
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
  if (!state) return { movingMs: 0, pausedMs: 0, elapsedMs: 0, distanceM: 0, ascentM: 0 };
  const current = advanceTour(state, now);
  return {
    movingMs: current.movingMs, pausedMs: current.pausedMs,
    elapsedMs: current.updatedAt - current.startedAt, distanceM: current.distanceM, ascentM: current.ascentM,
  };
}

export function pauseTour(state: TourState, now: number): TourState {
  if (state.status === 'finished' || state.status === 'manual-paused') return state;
  return { ...advanceTour(state, now), status: 'manual-paused', stationarySince: null, stopPoint: null,
    distanceAnchor: null, ascentBaseline: null, ascentBaselineAt: null };
}
export function resumeTour(state: TourState, now: number): TourState {
  if (state.status !== 'manual-paused') return state;
  // A resumed watch must establish a new fix. Never credit unobserved time or bridge across pause.
  return { ...advanceTour(state, now), status: 'moving', lastFixAt: null, lastFixPoint: null, distanceAnchor: null,
    ascentBaseline: null, ascentBaselineAt: null, stationarySince: null, stopPoint: null };
}
export function finishTour(state: TourState, now: number): TourState {
  if (state.status === 'finished') return state;
  const next = advanceTour(state, now);
  return { ...next, status: 'finished', finishedAt: next.updatedAt, stationarySince: null };
}

/** Reload/recovery is an explicit track boundary, even when the last fix was recent. */
export function recoverTour(state: TourState, now: number): TourState {
  if (state.status === 'finished') return state;
  return { ...advanceTour(state, now), lastFixAt: null, lastFixPoint: null, distanceAnchor: null,
    ascentBaseline: null, ascentBaselineAt: null,
    stationarySince: null, stopPoint: state.status === 'auto-paused' ? state.stopPoint : null };
}

/** Min-error progressive polyline simplification; pinned endpoints never cross GPS gaps.
 * Removal cost penalizes both shape deviation and lost polyline length. */
function thinTrack(points: TourPoint[], starts: number[]): { points: TourPoint[]; starts: number[] } {
  const n = points.length;
  const prev = Array.from({ length: n }, (_, i) => i - 1);
  const next = Array.from({ length: n }, (_, i) => i + 1);
  const pinned = new Uint8Array(n);
  for (let s = 0; s < starts.length; s++) {
    pinned[starts[s]] = 1;
    pinned[(starts[s + 1] ?? n) - 1] = 1;
  }
  type Entry = { index: number; cost: number; version: number };
  const heap: Entry[] = [];
  const version = new Uint32Array(n);
  const cost = (i: number): number => {
    const a = points[prev[i]], b = points[i], c = points[next[i]];
    const ab = distanceMeters(a, b), bc = distanceMeters(b, c), ac = distanceMeters(a, c);
    const rad = Math.PI / 180;
    const x = (b.lon - a.lon) * rad * Math.cos((a.lat + c.lat) * rad / 2) * 6371000;
    const y = (b.lat - a.lat) * rad * 6371000;
    const dx = (c.lon - a.lon) * rad * Math.cos((a.lat + c.lat) * rad / 2) * 6371000;
    const dy = (c.lat - a.lat) * rad * 6371000;
    const t = Math.max(0, Math.min(1, (x * dx + y * dy) / (dx * dx + dy * dy || 1)));
    return Math.hypot(x - t * dx, y - t * dy) + 2 * Math.max(0, ab + bc - ac);
  };
  const push = (i: number) => {
    if (i < 0 || i >= n || pinned[i] || prev[i] < 0 || next[i] >= n) return;
    const item = { index: i, cost: cost(i), version: ++version[i] };
    heap.push(item);
    for (let at = heap.length - 1; at > 0;) {
      const parent = (at - 1) >> 1;
      if (heap[parent].cost <= item.cost) break;
      heap[at] = heap[parent]; at = parent;
      heap[at] = item;
    }
  };
  const pop = (): Entry => {
    const first = heap[0], last = heap.pop()!;
    if (heap.length) {
      let at = 0;
      while (at * 2 + 1 < heap.length) {
        let child = at * 2 + 1;
        if (child + 1 < heap.length && heap[child + 1].cost < heap[child].cost) child++;
        if (last.cost <= heap[child].cost) break;
        heap[at] = heap[child]; at = child;
      }
      heap[at] = last;
    }
    return first;
  };
  for (let i = 0; i < n; i++) push(i);
  // Leave headroom so compaction is infrequent, not repeated on each GPS update.
  const target = Math.max(starts.length * 2, MAX_TRACK_POINTS - 1024);
  let count = n;
  while (count > target && heap.length) {
    const item = pop(), i = item.index;
    if (version[i] !== item.version || pinned[i]) continue;
    next[prev[i]] = next[i]; prev[next[i]] = prev[i];
    version[i]++;
    count--;
    push(prev[i]); push(next[i]);
  }
  const retained: TourPoint[] = [], boundaries: number[] = [];
  let segment = 0;
  for (let i = 0; i < n; i++) {
    if (starts[segment] === i) { boundaries.push(retained.length); segment++; }
    if (pinned[i] || version[i] === 0 || (next[i] <= n && prev[i] >= -1 &&
      (prev[i] < 0 || next[prev[i]] === i))) retained.push(points[i]);
  }
  return { points: retained, starts: boundaries };
}

function appendTrack(state: TourState, point: TourPoint, gap: boolean, movement: boolean) {
  if (!gap && !movement && state.points.length) return { points: state.points, segmentStarts: state.segmentStarts, omittedSegments: state.omittedSegments };
  let points = [...state.points, point];
  let segmentStarts = gap && state.points.length ? [...state.segmentStarts, points.length - 1] : state.segmentStarts;
  let omittedSegments = state.omittedSegments;
  // Only whole old segments are discarded. Never connect their neighbours with an invented line.
  if (segmentStarts.length > MAX_TRACK_SEGMENTS) {
    const from = segmentStarts[1], to = segmentStarts[2];
    points = [...points.slice(0, from), ...points.slice(to)];
    segmentStarts = [0, ...segmentStarts.slice(2).map(index => index - (to - from))];
    omittedSegments++;
  }
  if (points.length > MAX_TRACK_POINTS) ({ points, starts: segmentStarts } = thinTrack(points, segmentStarts));
  return { points, segmentStarts, omittedSegments };
}

export function recordTourPoint(state: TourState, point: TourPoint): TourState {
  if (state.status === 'finished' || !Number.isFinite(point.timestamp) ||
      !Number.isFinite(point.lat) || !Number.isFinite(point.lon) ||
      !Number.isFinite(point.accuracy) || point.accuracy < 0 || point.accuracy > MAX_ACCURACY_M ||
      Math.abs(point.lat) > 90 || Math.abs(point.lon) > 180 ||
       (point.altitude != null && !Number.isFinite(point.altitude)) ||
       (point.altitudeAccuracy != null && (!Number.isFinite(point.altitudeAccuracy) || point.altitudeAccuracy < 0)) ||
      point.timestamp <= state.updatedAt || (state.lastFixAt !== null && point.timestamp <= state.lastFixAt)) return state;
  const next = advanceTour(state, point.timestamp);
  const previous = state.lastFixPoint;
  const gap = state.lastFixAt === null || point.timestamp - state.lastFixAt > TRACK_GAP_MS;
  const rawStep = previous && !gap ? distanceMeters(previous, point) : 0;
  // Discard improbable jumps; do not turn a GPS teleport into distance or a resume event.
  if (previous && !gap && rawStep / ((point.timestamp - previous.timestamp) / 1000) > 45) return next;
  // Accumulate small real steps until their displacement exceeds the jitter floor.
  // The raw fix is only for per-update speed and stop detection, never the distance threshold;
  // the anchor is a raw fix independent of the progressively simplified retained track.
  const anchor = !gap ? state.distanceAnchor : null;
  const step = anchor ? distanceMeters(anchor, point) : 0;
  const movement = !!anchor && step >= Math.max(8, Math.min(anchor.accuracy, point.accuracy));
  const distanceAnchor = gap || !anchor || movement ? point : anchor;
  const { points, segmentStarts, omittedSegments } = state.status === 'manual-paused'
    ? { points: state.points, segmentStarts: state.segmentStarts, omittedSegments: state.omittedSegments }
    : appendTrack(state, point, gap, movement);
  // Auto-pause stops the timer, not the traveled-track recorder: count accurate
  // steps inside the circle and the step which exits it. Manual pause records neither.
  const distanceM = state.distanceM + (movement && state.status !== 'manual-paused' ? step : 0);
  const altitudeUsable = point.altitude != null && Math.abs(point.altitude) <= 12000 && point.accuracy <= 15 &&
    (point.altitudeAccuracy == null || point.altitudeAccuracy <= 20);
  const baseline = !gap && altitudeUsable && state.ascentBaseline !== null ? state.ascentBaseline : null;
  const rise = baseline === null ? 0 : point.altitude! - baseline;
  // Reject vertical teleports and sub-3m noise. Descents reset the baseline.
  const validRise = rise > 0 && state.ascentBaselineAt !== null &&
    rise / ((point.timestamp - state.ascentBaselineAt) / 1000) <= 8;
  const ascentM = state.ascentM + (state.status !== 'manual-paused' && rise >= 3 && validRise ? rise : 0);
  const ascentBaseline = state.status === 'manual-paused' || !altitudeUsable ? null :
    baseline === null || rise <= -3 || (rise >= 3 && validRise) ? point.altitude! : baseline;
  const ascentBaselineAt = ascentBaseline === null ? null :
    ascentBaseline === point.altitude ? point.timestamp : state.ascentBaselineAt;
  const recorded = { points, segmentStarts, omittedSegments, distanceM, ascentM,
    ascentBaseline, ascentBaselineAt, lastFixAt: point.timestamp, lastFixPoint: point, distanceAnchor };
  if (state.status === 'manual-paused') {
    // Manual pause deliberately does not record track/distance; resume starts a fresh segment.
    return { ...next, lastFixAt: point.timestamp, lastFixPoint: point, distanceAnchor: null };
  }
  if (gap && state.status !== 'auto-paused') {
    return { ...next, ...recorded,
      status: 'moving', stationarySince: null, stopPoint: null };
  }
  if (state.status === 'auto-paused') {
    // Only an accurate fix outside the literal 30m stop circle resumes, even after a long gap.
    if (state.stopPoint && distanceMeters(state.stopPoint, point) > RESUME_RADIUS_M) {
      return { ...next, ...recorded,
        status: 'moving', stationarySince: null, stopPoint: null };
    }
    return { ...next, ...recorded };
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
    return { ...next, ...recorded,
      status: 'auto-paused', stationarySince: null, stopPoint,
      movingMs: next.movingMs - credit, pausedMs: next.pausedMs + credit };
  }
  return { ...next, ...recorded,
    stationarySince, stopPoint };
}

const STORAGE_VERSION = 1;
export function tourStorageKey(key: string): string { return `smart360:live-tour:v${STORAGE_VERSION}:${encodeURIComponent(key)}`; }
type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
const validPoint = (p: TourPoint): boolean => !!p && Number.isFinite(p.lat) && Math.abs(p.lat) <= 90 &&
  Number.isFinite(p.lon) && Math.abs(p.lon) <= 180 && Number.isFinite(p.accuracy) &&
  p.accuracy >= 0 && p.accuracy <= MAX_ACCURACY_M && Number.isFinite(p.timestamp) &&
  (p.altitude == null || Number.isFinite(p.altitude)) &&
  (p.altitudeAccuracy == null || Number.isFinite(p.altitudeAccuracy) && p.altitudeAccuracy >= 0);
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
    // Existing v1 local backups had no activity, raw-fix or ascent fields.
    const activity: TourActivity = s.activity === 'cycling' ? 'cycling' : 'hiking';
    const normalized = { ...s, activity, ascentM: Number.isFinite(s.ascentM) && s.ascentM >= 0 ? s.ascentM : 0,
      omittedSegments: Number.isInteger(s.omittedSegments) && s.omittedSegments >= 0 ? s.omittedSegments : 0,
      lastFixPoint: s.lastFixPoint && validPoint(s.lastFixPoint) ? s.lastFixPoint :
        s.points.at(-1)?.timestamp === s.lastFixAt ? s.points.at(-1)! : null,
      distanceAnchor: s.distanceAnchor && validPoint(s.distanceAnchor) ? s.distanceAnchor :
        s.lastFixAt === null ? null : s.points.at(-1) ?? null,
      ascentBaseline: Number.isFinite(s.ascentBaseline) ? s.ascentBaseline : null,
      ascentBaselineAt: Number.isFinite(s.ascentBaselineAt) ? s.ascentBaselineAt : null };
    // Legacy backups may be large; compact before any future save.
    let { points, segmentStarts } = normalized;
    let omittedSegments = normalized.omittedSegments;
    if (segmentStarts.length > MAX_TRACK_SEGMENTS) {
      const remove = segmentStarts.length - MAX_TRACK_SEGMENTS;
      const from = segmentStarts[1], to = segmentStarts[remove + 1];
      points = [...points.slice(0, from), ...points.slice(to)];
      segmentStarts = [0, ...segmentStarts.slice(remove + 1).map(n => n - (to - from))];
      omittedSegments += remove;
    }
    while (points.length > MAX_TRACK_POINTS) ({ points, starts: segmentStarts } = thinTrack(points, segmentStarts));
    return { ...normalized, points, segmentStarts, omittedSegments };
  } catch { return null; } // localStorage may be blocked by browser/privacy settings.
}
export function saveTour(key: string, state: TourState | null, storage?: StorageLike): void {
  try {
    const target = storage ?? window.localStorage;
    if (state) target.setItem(tourStorageKey(key), JSON.stringify({ version: STORAGE_VERSION, state }));
    else target.removeItem(tourStorageKey(key));
  } catch { /* Best effort on-device backup only. */ }
}