import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  advanceTour, finishTour, loadTour, pauseTour, recordTourPoint, resumeTour,
  recoverTour, saveTour, startTour, tourMetrics, tourStorageKey,
  MAX_TRACK_POINTS, MAX_TRACK_SEGMENTS, distanceMeters, type TourPoint, type TourState,
} from '../lib/live-tour';
import { tourGpx as exportGpx } from '../lib/live-tour-export';
import { parseGpx } from '../../../api-server/src/lib/gpxParser';
import { TourWakeController } from '../hooks/use-live-tour';

const origin = 1_800_000_000_000;
const point = (ms: number, metersEast = 0, accuracy = 3): TourPoint => ({
  lat: 46, lon: 14 + metersEast / (111_195 * Math.cos(46 * Math.PI / 180)),
  accuracy, timestamp: origin + ms,
});
const fix = (s: TourState, ms: number, x: number, accuracy = 3) => recordTourPoint(s, point(ms, x, accuracy));
const consistent = (s: TourState) => {
  const m = tourMetrics(s, s.updatedAt);
  assert.equal(m.movingMs + m.pausedMs, m.elapsedMs);
  assert.ok(m.movingMs >= 0 && m.pausedMs >= 0);
};

test('stationary candidate needs full 20 seconds; within 30m remains paused; >30m exits immediately', () => {
  let s = startTour(origin);
  s = fix(s, 1000, 0);
  s = fix(s, 5000, 3);
  s = fix(s, 24000, 4);
  assert.equal(s.status, 'moving');
  s = fix(s, 25000, 3);
  assert.equal(s.status, 'auto-paused');
  assert.equal(s.movingMs, 4000); // The 20s stationary dwell, not the initial 4s, is pause.
  s = fix(s, 30000, 20);
  assert.equal(s.status, 'auto-paused');
  s = fix(s, 31000, 33, 3);
  assert.equal(s.status, 'moving');
  assert.ok(s.distanceM >= 0);
  consistent(s);
  const done = finishTour(s, origin + 34000);
  assert.equal(done.status, 'finished');
  assert.equal(done.finishedAt, origin + 34000);
  consistent(done);
  assert.deepEqual(advanceTour(done, origin + 99000), done);
});

test('deterministic browser simulation: move, dwell, auto-pause, exit, finish accounting', () => {
  let s = fix(startTour(origin), 1000, 0);
  s = fix(s, 11000, 25);
  s = fix(s, 12000, 25);
  s = fix(s, 32000, 25);
  assert.equal(s.status, 'auto-paused');
  s = fix(s, 34000, 60);
  assert.equal(s.status, 'moving');
  s = finishTour(s, origin + 40000);
  assert.deepEqual(tourMetrics(s, origin + 50000), {
    movingMs: 17000, pausedMs: 23000, elapsedMs: 40000,
     distanceM: s.distanceM, ascentM: s.ascentM,
  });
  assert.ok(s.distanceM > 59 && s.distanceM < 61);
});

test('steady small walking steps abandon old anchor, later stationary dwell pauses', () => {
  let s = fix(startTour(origin), 1000, 0);
  for (let i = 1; i <= 8; i++) {
    s = fix(s, 1000 + i * 5000, i * 9);
    assert.equal(s.status, 'moving');
  }
  s = fix(s, 46000, 73);
  s = fix(s, 66000, 74);
  assert.equal(s.status, 'auto-paused');
  consistent(s);
});

test('one-meter-per-second walking fixes accumulate beyond jitter threshold and survive backup', () => {
  let s = startTour(origin);
  const memory = new Map<string, string>();
  const storage = { getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => { memory.set(key, value); },
    removeItem: (key: string) => { memory.delete(key); } };
  for (let second = 1; second <= 60; second++) {
    s = recordTourPoint(s, { ...point(second * 1000, second, 3),
      altitude: 400 + second * 0.4, altitudeAccuracy: 5 });
    if (second === 30) {
      saveTour('walking', s, storage);
      s = loadTour('walking', storage)!; // Continued recording, not reload/recover boundary.
    }
  }
  assert.equal(s.status, 'moving');
  // At most one sub-8m partial step at the tail remains below the jitter threshold.
  assert.ok(s.distanceM >= 50 && s.distanceM <= 60, `walking distance ${s.distanceM}m`);
  assert.ok(s.points.length >= 6, `retained ${s.points.length} points`);
  assert.ok(s.ascentM >= 20 && s.ascentM <= 25, `ascent ${s.ascentM}m`);
  assert.equal(s.distanceAnchor?.timestamp, s.points.at(-1)?.timestamp);
  const parsed = parseGpx(Buffer.from(exportGpx(s, 'Walking')), 'hiking');
  assert.ok(parsed.distanceKm > 0.05 && parsed.profile.length > 1);
});

test('low quality fixes cannot resume; gap remains paused within circle and begins new segment', () => {
  let s = fix(startTour(origin), 1000, 0);
  s = fix(s, 5000, 2);
  s = fix(s, 25000, 2);
  assert.equal(s.status, 'auto-paused');
  const old = s;
  s = fix(s, 27000, 200, 31);
  assert.equal(s, old);
  s = fix(s, 120000, 5);
  assert.equal(s.status, 'auto-paused');
  assert.equal(s.segmentStarts.length, 2);
  assert.equal(s.distanceM, old.distanceM);
  s = fix(s, 121000, 34);
  assert.equal(s.status, 'moving');
  consistent(s);
});

test('no GPS wait/gaps credited as movement; long gap does not bridge distance', () => {
  let s = startTour(origin);
   assert.deepEqual(tourMetrics(s, origin + 50000), { movingMs: 0, pausedMs: 50000, elapsedMs: 50000, distanceM: 0, ascentM: 0 });
  s = fix(s, 50000, 0);
  s = fix(s, 51000, 10);
  assert.ok(s.distanceM > 8);
  const before = s.distanceM;
  s = fix(s, 120000, 1000);
  assert.equal(s.distanceM, before);
  assert.equal(s.segmentStarts.length, 2);
  const m = tourMetrics(s, origin + 150000);
  assert.equal(m.movingMs + m.pausedMs, m.elapsedMs);
  assert.ok(m.pausedMs >= 89000);
});

test('manual pause counts time as pause, records no path/distance, resume splits segments', () => {
  let s = fix(startTour(origin), 1000, 0);
  s = fix(s, 11000, 25);
  s = pauseTour(s, origin + 12000);
  const distance = s.distanceM;
  const length = s.points.length;
  s = fix(s, 15000, 60);
  assert.equal(s.distanceM, distance);
  assert.equal(s.points.length, length);
  s = resumeTour(s, origin + 16000);
  s = fix(s, 17000, 75);
  assert.equal(s.distanceM, distance);
  assert.equal(s.segmentStarts.length, 2);
  assert.equal((exportGpx(s, '<Tour&') .match(/<trkseg>/g) || []).length, 2);
  assert.match(exportGpx(s, '<Tour&'), /&lt;Tour&amp;/);
  consistent(s);
});

test('reload recovery splits track immediately without a fabricated short bridge', () => {
  let s = fix(startTour(origin), 1000, 0);
  s = fix(s, 3000, 9);
  const distance = s.distanceM;
  s = recoverTour(s, origin + 4000);
  s = fix(s, 5000, 100);
  assert.equal(s.distanceM, distance);
  assert.equal(s.segmentStarts.length, 2);
  consistent(s);
});

test('versioned backup rejects corrupt/unknown data, blocks storage failures, isolates keys', () => {
  const memory = new Map<string, string>();
  const storage = {
    getItem: (k: string) => memory.get(k) ?? null,
    setItem: (k: string, v: string) => { memory.set(k, v); },
    removeItem: (k: string) => { memory.delete(k); },
  };
  const s = startTour(origin);
  saveTour('item/1', s, storage);
  assert.deepEqual(loadTour('item/1', storage), s);
  assert.equal(loadTour('item/2', storage), null);
  memory.set(tourStorageKey('item/1'), JSON.stringify({ version: 99, state: s }));
  assert.equal(loadTour('item/1', storage), null);
  memory.set(tourStorageKey('item/1'), JSON.stringify({ version: 1, state: { ...s, points: [{ lat: 999, lon: 0, timestamp: 1, accuracy: 3 }] } }));
  assert.equal(loadTour('item/1', storage), null);
  memory.set(tourStorageKey('item/1'), '{');
  assert.equal(loadTour('item/1', storage), null);
  const blocked = { getItem: (): string | null => { throw Error('blocked'); },
    setItem: (): void => { throw Error('blocked'); }, removeItem: (): void => { throw Error('blocked'); } };
  assert.equal(loadTour('a', blocked), null);
  assert.doesNotThrow(() => saveTour('a', s, blocked));
  assert.doesNotThrow(() => saveTour('a', null, blocked));
});

test('all-day track simplifies progressively without changing raw distance; GPX imports into our server parser', () => {
  let s = startTour(origin, 'cycling');
  const original: TourPoint[] = [];
  const east = (x: number) => 14 + x / (111_195 * Math.cos(46 * Math.PI / 180));
  const north = (y: number) => 46 + y / 111_195;
  for (let i = 0; i < 12_000; i++) {
    // 16 hours of sampled, winding road with a pronounced detour; each step is realistic.
    const x = i * 12, y = 250 * Math.sin(i / 180);
    const p: TourPoint = { lat: north(y), lon: east(x), accuracy: 3,
      altitude: 400 + 6 * Math.floor(i / 150), altitudeAccuracy: 6,
      timestamp: origin + 1000 + i * 4800 };
    original.push(p);
    s = recordTourPoint(s, p);
  }
  assert.equal(s.activity, 'cycling');
  assert.ok(s.points.length <= MAX_TRACK_POINTS);
  assert.deepEqual(s.points[0], original[0]);
  assert.deepEqual(s.points.at(-1), original.at(-1));
  assert.equal(s.segmentStarts.length, 1);
  const rawDistance = original.slice(1).reduce((sum, p, i) => sum + distanceMeters(original[i], p), 0);
  assert.ok(Math.abs(s.distanceM - rawDistance) / rawDistance < 0.001);
  const retainedLength = s.points.slice(1).reduce((sum, p, i) => sum + distanceMeters(s.points[i], p), 0);
  assert.ok(Math.abs(retainedLength - rawDistance) / rawDistance < 0.02,
    `retained track lost too much length: ${retainedLength}/${rawDistance}`);
  // Ensure important winding shape survives, rather than simply retaining equally spaced endpoints.
  const apex = original[283];
  assert.ok(Math.min(...s.points.map(p => distanceMeters(p, apex))) < 40);
  assert.ok(s.ascentM >= 470 && s.ascentM <= 480);
  const gpx = exportGpx(finishTour(s, s.updatedAt + 1000), 'A&B');
  assert.match(gpx, /<ele>400<\/ele><time>/);
  assert.match(gpx, /<name>A&amp;B<\/name>/);
  const parsed = parseGpx(Buffer.from(gpx), 'cycling');
  assert.equal(parsed.segments.length, 1);
  // Importer intentionally resamples its rendered preview to 400; its derived stats
  // are computed from all retained GPX points before that preview sampling.
  assert.equal(parsed.segments[0].length, Math.min(400, s.points.length));
  assert.ok(Math.abs(parsed.distanceKm * 1000 - retainedLength) < 5);
});

test('many pause gaps stay within both memory and uploadable GPX segment limits with no fabricated bridges', () => {
  let s = startTour(origin);
  for (let i = 0; i < 220; i++) {
    // Each gap starts a new segment. Preserve the first and newest segments,
    // omit complete old segments when there are too many, never join across omissions.
    s = recordTourPoint(s, point(1_000 + i * 60_000, i * 1000));
    s = recordTourPoint(s, point(5_000 + i * 60_000, i * 1000 + 12));
  }
  assert.equal(s.segmentStarts.length, MAX_TRACK_SEGMENTS);
  assert.equal(s.omittedSegments, 220 - MAX_TRACK_SEGMENTS);
  assert.ok(s.points.length <= MAX_TRACK_POINTS);
  assert.equal(s.distanceM > 2600 && s.distanceM < 2700, true);
  assert.deepEqual(s.points.slice(0, 2), [point(1000, 0), point(5000, 12)]);
  assert.deepEqual(s.points.at(-1), point(5_000 + 219 * 60_000, 219_000 + 12));
  const parsed = parseGpx(Buffer.from(exportGpx(s, 'Gaps')), 'hiking');
  assert.equal(parsed.segments.length, MAX_TRACK_SEGMENTS);
  assert.ok(parsed.distanceKm < 3); // Not the hundreds of km between separate segments.
  assert.ok(JSON.stringify(s).length < 600_000);
});

test('simplification pins both endpoints of every surviving GPS segment', () => {
  let s = startTour(origin);
  const endpoints: TourPoint[] = [];
  for (let segment = 0; segment < 5; segment++) {
    for (let i = 0; i < 1200; i++) {
      const p = point(1000 + segment * 7_000_000 + i * 5000, segment * 100_000 + i * 12);
      s = recordTourPoint(s, p);
      if (i === 0 || i === 1199) endpoints.push(p);
    }
  }
  assert.ok(s.points.length <= MAX_TRACK_POINTS);
  assert.deepEqual(s.segmentStarts.map(i => s.points[i]), endpoints.filter((_, i) => i % 2 === 0));
  assert.deepEqual(s.segmentStarts.map((_, i) => s.points[(s.segmentStarts[i + 1] ?? s.points.length) - 1]),
    endpoints.filter((_, i) => i % 2 === 1));
  assert.equal(parseGpx(Buffer.from(exportGpx(s, 'Segments')), 'hiking').segments.length, 5);
});

test('altitude noise, missing or poor vertical accuracy, GPS gap, manual pause and old backups', () => {
  const p = (ms: number, x: number, altitude: number | null, altitudeAccuracy = 5): TourPoint =>
    ({ ...point(ms, x), altitude, altitudeAccuracy });
  let s = startTour(origin);
  s = recordTourPoint(s, p(1000, 0, 100));
  s = recordTourPoint(s, p(5000, 10, 102));
  s = recordTourPoint(s, p(9000, 20, 105));
  assert.equal(s.ascentM, 5);
  s = recordTourPoint(s, p(13000, 30, 150, 60)); // poor altitude quality
  s = recordTourPoint(s, p(17000, 40, 110));
  assert.equal(s.ascentM, 5);
  s = pauseTour(s, origin + 18000);
  s = recordTourPoint(s, p(22000, 50, 150));
  s = resumeTour(s, origin + 23000);
  s = recordTourPoint(s, p(24000, 100, 300));
  s = recordTourPoint(s, p(28000, 110, 306));
  assert.equal(s.ascentM, 11);
  s = recordTourPoint(s, p(90000, 1000, 600));
  assert.equal(s.ascentM, 11);
  const memory = new Map<string, string>();
  const storage = { getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, v: string) => { memory.set(key, v); },
    removeItem: (key: string) => { memory.delete(key); } };
  const old: Record<string, unknown> = { ...s };
  for (const key of ['activity', 'ascentM', 'ascentBaseline', 'ascentBaselineAt', 'lastFixPoint', 'omittedSegments']) delete old[key];
  memory.set(tourStorageKey('legacy'), JSON.stringify({ version: 1, state: old }));
  const loaded = loadTour('legacy', storage)!;
  assert.equal(loaded.activity, 'hiking');
  assert.equal(loaded.ascentM, 0);
  assert.equal(loaded.lastFixPoint?.timestamp, s.lastFixAt);
  saveTour('legacy', loaded, storage);
  assert.deepEqual(loadTour('legacy', storage), loaded);
});

test('wake API absent reports unavailable; release while visible retries once', async () => {
  let listener = () => {};
  let count = 0;
  const controller = new TourWakeController({
    visible: () => true,
    request: async () => { count++; throw Error('absent'); },
    onVisibility: callback => { listener = callback; return () => {}; },
  }, () => {});
  controller.activate();
  await Promise.resolve(); await Promise.resolve();
  assert.equal(controller.status, 'unavailable');
  assert.equal(count, 1);
  controller.dispose();
  void listener;
});

test('wake held, automatic release retries once; hidden releases and visible reacquires', async () => {
  let visible = true;
  let notifyVisibility = () => {};
  const sentinels: { released: boolean; release(): Promise<void>; emit(): void; addEventListener(type: 'release', listener: () => void): void }[] = [];
  const controller = new TourWakeController({
    visible: () => visible,
    request: async () => {
      let onRelease = () => {};
      const sentinel = {
        released: false,
        async release() { this.released = true; onRelease(); },
        emit() { this.released = true; onRelease(); },
        addEventListener(_type: 'release', listener: () => void) { onRelease = listener; },
      };
      sentinels.push(sentinel);
      return sentinel;
    },
    onVisibility: listener => { notifyVisibility = listener; return () => {}; },
  }, () => {});
  controller.activate();
  await Promise.resolve();
  assert.equal(controller.status, 'held');
  sentinels[0].emit();
  await Promise.resolve();
  assert.equal(sentinels.length, 2);
  assert.equal(controller.status, 'held');
  sentinels[1].emit();
  await Promise.resolve();
  assert.equal(controller.status, 'unavailable');
  assert.equal(sentinels.length, 2);
  visible = false; notifyVisibility();
  visible = true; notifyVisibility();
  await Promise.resolve();
  assert.equal(controller.status, 'held');
  visible = false; notifyVisibility();
  assert.equal(sentinels[2].released, true);
  assert.equal(controller.status, 'idle');
  visible = true; notifyVisibility();
  await Promise.resolve();
  assert.equal(controller.status, 'held');
  controller.dispose();
  assert.equal(sentinels[3].released, true);
});

test('failed reacquisition after visibility return shows unavailable', async () => {
  let visible = true;
  let visibility = () => {};
  let requests = 0;
  const sentinel = { released: false, async release() { this.released = true; }, addEventListener() {} };
  const controller = new TourWakeController({
    visible: () => visible,
    request: async () => { if (++requests > 1) throw Error('denied'); return sentinel; },
    onVisibility: listener => { visibility = listener; return () => {}; },
  }, () => {});
  controller.activate();
  await Promise.resolve();
  assert.equal(controller.status, 'held');
  visible = false; visibility();
  assert.equal(sentinel.released, true);
  visible = true; visibility();
  await Promise.resolve(); await Promise.resolve();
  assert.equal(controller.status, 'unavailable');
  controller.dispose();
});

test('in-flight wake request resolving after finish is immediately released', async () => {
  let resolve!: (s: { released: boolean; release(): Promise<void>; addEventListener(): void }) => void;
  const controller = new TourWakeController({
    visible: () => true,
    request: () => new Promise(r => { resolve = r; }),
    onVisibility: () => () => {},
  }, () => {});
  controller.activate();
  assert.equal(controller.status, 'requesting');
  controller.deactivate();
  const sentinel = { released: false, async release() { this.released = true; }, addEventListener() {} };
  resolve(sentinel);
  await Promise.resolve(); await Promise.resolve();
  assert.equal(sentinel.released, true);
  assert.equal(controller.status, 'idle');
  controller.dispose();
});