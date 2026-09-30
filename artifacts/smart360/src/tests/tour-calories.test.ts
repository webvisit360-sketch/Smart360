import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatCalories, loadTourProfile, saveTourProfile, segmentCalories } from '../lib/tour-calories';
import { finishTour, loadTour, pauseTour, recordTourPoint, resumeTour, saveTour, startTour, tourMetrics, type TourPoint } from '../lib/live-tour';
import { tourGpx } from '../lib/live-tour-export';
import { LiveTourStats } from '../pages/living-guide/living-guide-live-tour';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import { LIVING_GUIDE_UI } from '../pages/guest/i18n';

const origin = 1_800_000_000_000;
const point = (ms: number, east: number, altitude?: number): TourPoint => ({
  lat: 46, lon: 14 + east / (111195 * Math.cos(46 * Math.PI / 180)),
  timestamp: origin + ms, accuracy: 3, altitude, altitudeAccuracy: altitude == null ? null : 5,
});

test('hand references: 5 km flat run; 500 m hike climb; road 25 km/h; high-assist hill', () => {
  assert.equal(segmentCalories('running', { weightKg: 70 }, 5000, 1500, 0), 350);
  // 5 km and +500 m => grade 0.10. ACSM net: 70*5*(0.5 + 9*0.10) = 490 kcal.
  assert.ok(Math.abs(segmentCalories('hiking', { weightKg: 70 }, 5000, 4500, 0.1)! - 490) < 1e-9);
  // 20 km / 25 km/h = 2880s, v=6.944 m/s, rider+bike=79 kg.
  // F=79*9.81*.005 + .5*1.225*.32*v² = 13.325 N; W=F*20000/(.24*4184) ≈265.4 kcal.
  const bike = segmentCalories('cycling', { weightKg: 70, bike: 'road' }, 20000, 2880, 0)!;
  assert.ok(bike > 264 && bike < 267, String(bike));
  // +500m on 5km at 15km/h; electrical high assist leaves 30% human power.
  const ebike = segmentCalories('cycling', { weightKg: 70, bike: 'electric', assist: 'high' }, 5000, 1200, 0.1)!;
  const unassisted = segmentCalories('cycling', { weightKg: 70, bike: 'electric', assist: 'low' }, 5000, 1200, 0.1)!;
  assert.ok(ebike > 140 && ebike < 170, String(ebike));
  assert.ok(ebike < unassisted * 0.44, `${ebike} vs ${unassisted}`);
  assert.equal(formatCalories(350, 'approx.'), 'approx. 350 kcal');
});

test('paused fixes and GPS gaps burn zero; snapshot survives edits, reload and finish', () => {
  const profile = { weightKg: 70, bike: 'road' } as const;
  let s = startTour(origin, 'running', profile);
  s = recordTourPoint(s, point(1000, 0));
  s = recordTourPoint(s, point(11000, 30));
  const before = s.caloriesKcal;
  s = pauseTour(s, origin + 12000);
  s = recordTourPoint(s, point(22000, 120));
  assert.equal(s.caloriesKcal, before);
  s = resumeTour(s, origin + 23000);
  s = recordTourPoint(s, point(24000, 200));
  assert.equal(s.caloriesKcal, before);
  s = recordTourPoint(s, point(34000, 230));
  assert.ok(s.caloriesKcal! > before!);
  const mem = new Map<string, string>();
  const store = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => { mem.set(k, v); }, removeItem: (k: string) => { mem.delete(k); } };
  saveTour('test', s, store);
  assert.equal(loadTour('test', store)?.caloriesKcal, s.caloriesKcal);
  assert.equal(loadTour('test', store)?.calorieProfile?.weightKg, 70);
  assert.equal(finishTour(s, origin + 44000).caloriesKcal, s.caloriesKcal);
  assert.doesNotMatch(tourGpx(s, 'Test'), /calor|weight|profile|assist|kcal/i);
});

test('rolling 20m grade window sees a climb even with ordinary 11m GPS fixes; pause resets it', () => {
  let climb = startTour(origin, 'hiking', { weightKg: 70 });
  let flat = startTour(origin, 'hiking', { weightKg: 70 });
  for (let i = 0; i <= 12; i++) {
    climb = recordTourPoint(climb, point(1000 + i * 5000, i * 11, 400 + i * 0.55));
    flat = recordTourPoint(flat, point(1000 + i * 5000, i * 11, 400));
  }
  assert.ok(climb.smoothedGrade! > 0.04 && climb.smoothedGrade! < 0.06);
  assert.ok(climb.caloriesKcal! > flat.caloriesKcal! * 1.5, `${climb.caloriesKcal} vs ${flat.caloriesKcal}`);
  const paused = pauseTour(climb, origin + 62000);
  assert.equal(paused.gradeAnchor, null);
  assert.equal(paused.smoothedGrade, 0);
  const resumed = resumeTour(paused, origin + 63000);
  assert.equal(resumed.gradeAnchor, null);
  assert.equal(resumed.smoothedGrade, 0);
});

test('missing weight means no kcal in live/result markup and no kcal value for image export', () => {
  const s = startTour(origin, 'hiking', { age: 50, sex: 'female' });
  const metrics = tourMetrics(s, origin);
  assert.equal(metrics.caloriesKcal, null);
  assert.equal(formatCalories(metrics.caloriesKcal, 'approx.'), null);
  for (const lang of ['sl', 'en', 'de', 'it'] as const) {
    const t = (key: string) => LIVING_GUIDE_UI[key as keyof typeof LIVING_GUIDE_UI]?.[lang] ?? key;
    assert.doesNotMatch(renderToStaticMarkup(React.createElement(LiveTourStats, { metrics, t })), /kcal|calories/i);
  }
});

test('device profile persists through reload; denied storage returns explicit failure and safe recovery', () => {
  const mem = new Map<string, string>();
  const storage = { getItem: (key: string) => mem.get(key) ?? null, setItem: (key: string, v: string) => { mem.set(key, v); } };
  assert.equal(saveTourProfile({ weightKg: 72, sex: 'female', bike: 'electric', assist: 'high' }, storage), true);
  assert.deepEqual(loadTourProfile(storage), { weightKg: 72, sex: 'female', bike: 'electric', assist: 'high', age: undefined });
  const denied = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('denied'); } };
  assert.deepEqual(loadTourProfile(denied), {});
  assert.equal(saveTourProfile({ weightKg: 70 }, denied), false);
});