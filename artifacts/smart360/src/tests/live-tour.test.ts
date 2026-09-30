import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  advanceTour, finishTour, loadTour, pauseTour, recordTourPoint, resumeTour,
  recoverTour, saveTour, startTour, tourMetrics, tourStorageKey,
  type TourPoint, type TourState,
} from '../lib/live-tour';
import { tourGpx as exportGpx } from '../lib/live-tour-export';
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
    distanceM: s.distanceM,
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
  assert.deepEqual(tourMetrics(s, origin + 50000), { movingMs: 0, pausedMs: 50000, elapsedMs: 50000, distanceM: 0 });
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