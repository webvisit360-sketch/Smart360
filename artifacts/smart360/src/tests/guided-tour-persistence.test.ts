import assert from 'node:assert/strict';
import { test } from 'node:test';
import { finishTour, loadTour, saveTour, startTour, tourStorageKey } from '../lib/live-tour';
import { loadTourForView, purgeFinishedGuidedTours, saveTourForView } from '../lib/guided-tour-persistence';

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    get length() { return data.size; },
    key: (i: number) => [...data.keys()][i] ?? null,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { data.set(key, value); },
    removeItem: (key: string) => { data.delete(key); },
  };
}
const done = () => finishTour(startTour(1000), 10000);

test('app startup purges guided and free finished leftovers, preserves active/unrelated/malformed data', () => {
  const storage = memoryStorage();
  for (const id of ['home/route-a', 'home/route-b', 'another/route-c']) saveTour(id, done(), storage);
  saveTour('home/free-tour', done(), storage);
  saveTour('home/active', startTour(1000), storage);
  storage.setItem('other', '{"state":{"status":"finished"}}');
  storage.setItem(tourStorageKey('home/broken'), '{bad');
  storage.setItem('smart360:live-tour:v1:%broken', '{"state":{"status":"finished"}}');
  const before = storage.length;
  purgeFinishedGuidedTours(storage);
  assert.equal(storage.length, before - 4);
  assert.equal(loadTour('home/route-a', storage), null);
  assert.equal(loadTour('home/route-b', storage), null);
  assert.equal(loadTour('another/route-c', storage), null);
  assert.equal(loadTour('home/free-tour', storage), null);
  assert.equal(loadTour('home/active', storage)?.status, 'moving');
  assert.equal(storage.getItem('other'), '{"state":{"status":"finished"}}');
  purgeFinishedGuidedTours(storage);
  assert.equal(storage.length, before - 4);
});

test('guided hydration expires finished results even outside main startup', () => {
  const storage = memoryStorage();
  saveTour('home/route', done(), storage);
  assert.equal(loadTourForView('home/route', 999999, true, storage), null);
  assert.equal(storage.getItem(tourStorageKey('home/route')), null);
});

test('guided finish removes its backup without modifying the current in-memory result', () => {
  const storage = memoryStorage();
  saveTourForView('home/route', startTour(1000), true, storage);
  const result = done();
  saveTourForView('home/route', result, true, storage);
  assert.equal(result.status, 'finished');
  assert.equal(storage.getItem(tourStorageKey('home/route')), null);
  assert.equal(loadTourForView('home/route', 20000, true, storage), null);
  saveTourForView('home/route', null, true, storage);
  assert.equal(loadTourForView('home/route', 30000, true, storage), null);
});

test('free recorder expires old finished backups and never persists a new result', () => {
  const storage = memoryStorage();
  saveTour('home/free-tour', done(), storage);
  assert.equal(loadTourForView('home/free-tour', 999999, true, storage), null);
  saveTourForView('home/free-tour', done(), true, storage);
  assert.equal(loadTour('home/free-tour', storage), null);
});

test('free recorder moving and paused states survive startup and reload', () => {
  for (const status of ['moving', 'manual-paused', 'auto-paused'] as const) {
    const storage = memoryStorage();
    saveTourForView('home/free-tour', {...startTour(1000), status, distanceM: 321}, true, storage);
    purgeFinishedGuidedTours(storage);
    const recovered = loadTourForView('home/free-tour', 5000, true, storage);
    assert.equal(recovered?.status, status);
    assert.equal(recovered?.distanceM, 321);
  }
});

test('guided active backups recover with existing status and data intact', () => {
  const storage = memoryStorage();
  saveTourForView('home/route', { ...startTour(1000), distanceM: 321 }, true, storage);
  const recovered = loadTourForView('home/route', 5000, true, storage);
  assert.equal(recovered?.status, 'moving');
  assert.equal(recovered?.distanceM, 321);
  assert.equal(loadTour('home/route', storage)?.status, 'moving');
});

test('unavailable local storage does not prevent startup', () => {
  const storage = memoryStorage();
  Object.defineProperty(storage, 'length', { get() { throw new Error('Storage denied'); } });
  assert.doesNotThrow(() => purgeFinishedGuidedTours(storage));
});