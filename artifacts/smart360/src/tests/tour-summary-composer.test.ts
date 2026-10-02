import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { startTour, type TourPoint } from '../lib/live-tour';
import { buildTourSummaryModel, elevationProfile, retainedGpsMaxSpeed, summaryLabels, type TourSummaryInput } from '../lib/tour-summary-model';
import { drawSummaryStrip, encodeWithSchematicFallback, SUMMARY_BRAND, SUMMARY_LAYOUT, SUMMARY_STRIP, summaryFooter, summarySvgImageSource } from '../lib/tour-summary-render';

test('export strip uses exact owner stops, full width and 11 logical / 22 native pixels immediately above map', () => {
  const stops: Array<[number, string]> = [];
  const rectangles: number[][] = [];
  const axes: number[][] = [];
  drawSummaryStrip({
    createLinearGradient: (...a: number[]) => { axes.push(a); return { addColorStop: (n: number, c: string) => stops.push([n, c]) }; },
    fillRect: (...r: number[]) => rectangles.push(r),
  } as unknown as CanvasRenderingContext2D);
  assert.deepEqual(stops, [[0, '#E8862E'], [0.3, '#2F72C4'], [0.55, '#3E9E4E'], [0.8, '#F5C62E'], [1, '#E8862E']]);
  assert.deepEqual(axes, [[0, 0, SUMMARY_LAYOUT.width, 0]]);
  assert.deepEqual(rectangles, [[0, 101, SUMMARY_LAYOUT.width, 11]]);
  assert.equal(SUMMARY_LAYOUT.mapY, 112);
  assert.equal(SUMMARY_STRIP.height * SUMMARY_LAYOUT.scale, 22);
});

const origin = Date.UTC(2026, 9, 1, 10, 53);
const point = (seconds: number, meters: number, altitude: number | null = 600): TourPoint => ({
  lat: 46, lon: 14 + meters / (111195 * Math.cos(46 * Math.PI / 180)),
  timestamp: origin + seconds * 1000, accuracy: 3, altitude, altitudeAccuracy: 5,
});
function fixture(activity: 'hiking' | 'running' | 'cycling' = 'hiking'): TourSummaryInput {
  const state = startTour(origin, activity);
  state.points = [point(0, 0, 400), point(10, 100, 612), point(20, 200, 500)];
  return { state, metrics: { movingMs: 1200000, pausedMs: 600000, elapsedMs: 1800000, distanceM: 5000, ascentM: 241 }, plannedSegments: [], tourName: 'Jutranji pohod', tenantName: 'Turizem Drobež', lang: 'sl' };
}
test('authoritative counters, net-time averages and activity-specific grid', () => {
  for (const activity of ['hiking', 'running', 'cycling'] as const) {
    const m = buildTourSummaryModel(fixture(activity));
    assert.equal(m.stats.find(s => s.key === 'distance')?.value, '5,00');
    assert.equal(m.stats.find(s => s.key === 'ascent')?.value, '241');
    assert.equal(m.stats.find(s => s.key === 'altitude')?.value, '612');
    assert.equal(m.stats.find(s => s.key === 'speed')?.value, '15,0');
    assert.equal(m.stats.find(s => s.key === 'net')?.value, '20:00');
    assert.equal(m.stats.find(s => s.key === 'elapsed')?.value, '30:00');
    assert.deepEqual(m.stats.slice(6).map(s => s.key), activity === 'cycling' ? ['speed', 'maxSpeed'] : activity === 'running' ? ['pace', 'speed'] : ['speed', 'pace']);
    if (activity !== 'cycling') assert.equal(m.stats.find(s => s.key === 'pace')?.value, '4:00');
  }
});
test('calorie cell requires valid profile AND a positive finite estimate, never zero kcal', () => {
  const input = fixture(); input.metrics.caloriesKcal = 270;
  assert.equal(buildTourSummaryModel(input).stats.length, 8);
  input.state.calorieProfile = { weightKg: 70 };
  assert.equal(buildTourSummaryModel(input).stats.at(-1)?.value, '~270');
  input.metrics.caloriesKcal = 91;
  assert.equal(buildTourSummaryModel(input).stats.at(-1)?.value, '~90');
  for (const value of [0, -1, NaN, Infinity, null, undefined]) {
    input.metrics.caloriesKcal = value;
    assert.equal(buildTourSummaryModel(input).stats.length, 8);
  }
  input.metrics.caloriesKcal = 0.1;
  assert.equal(buildTourSummaryModel(input).stats.at(-1)?.value, '<1');
});
test('retained GPS interval maximum rejects gap bridges, teleports, jitter and bad accuracy', () => {
  const { state } = fixture('cycling');
  assert.ok(Math.abs(retainedGpsMaxSpeed(state)! - 36) < 0.1);
  state.points = [point(0, 0), point(10, 10000), point(11, 10001)];
  assert.equal(retainedGpsMaxSpeed(state), null);
  state.points = [point(0, 0), point(10, 100)];
  state.segmentStarts = [0, 1];
  assert.equal(retainedGpsMaxSpeed(state), null);
  state.segmentStarts = [0]; state.points[1].accuracy = 100;
  assert.equal(retainedGpsMaxSpeed(state), null);
  state.points = [point(0, 0), point(40, 100)];
  assert.equal(retainedGpsMaxSpeed(state), null);
});
test('elevation strip is gap-aware and never substitutes planned elevation for measured stats', () => {
  const input = fixture();
  input.state.points = [point(0, 0, 100), point(10, 20, null), point(20, 40, 200), point(25, 2000, 300)];
  input.state.segmentStarts = [0, 3];
  const profile = elevationProfile(input.state);
  assert.deepEqual(profile.map(r => r.map(p => p.elevation)), [[100], [200], [300]]);
  assert.ok(profile[2][0].distance < 60, 'no artificial distance bridge between GPS segments');
  input.state.points = [];
  input.plannedSegments = [[{ lat: 46, lon: 14, ele: 1000 }]];
  assert.equal(buildTourSummaryModel(input).stats.find(s => s.key === 'altitude')?.value, '—');
  assert.equal(elevationProfile(input.state).length, 0);
});
test('SL/EN/DE/IT labels and localized dates; zero moving time never gives infinite values', () => {
  const dates = new Set<string>();
  for (const lang of ['sl', 'en', 'de', 'it']) {
    const input = fixture(); input.lang = lang; input.metrics.movingMs = 0;
    const model = buildTourSummaryModel(input);
    assert.equal(model.stats.find(s => s.key === 'speed')?.value, '—');
    assert.equal(model.stats.find(s => s.key === 'pace')?.value, '—');
    assert.ok(model.labels.schematic && model.activity && model.labels.noElevation);
    dates.add(model.date);
  }
  assert.equal(dates.size, 4);
  assert.equal(summaryLabels('sl-SI').distance, 'Razdalja');
});
test('tainted map is discarded and encoded again using fresh schematic canvas', async () => {
  const wanted = new Blob(['png'], { type: 'image/png' }), kinds: string[] = [];
  const result = await encodeWithSchematicFallback(kind => {
    kinds.push(kind);
    return { toBlob(callback: BlobCallback) {
      if (kind === 'map') throw new DOMException('Tainted', 'SecurityError');
      callback(wanted);
    } } as HTMLCanvasElement;
  }, true);
  assert.deepEqual(kinds, ['map', 'schematic']);
  assert.equal(result.blob, wanted);
  assert.equal(result.mapKind, 'schematic');
  assert.doesNotMatch(summaryFooter('schematic', 'Shematski prikaz poti'), /©|OpenStreetMap/);
  assert.match(summaryFooter('map', ''), /© OpenFreeMap · OpenMapTiles · © OpenStreetMap contributors/);
});
test('map success preserves exact Blob; null map uses schematic; abort never generates download', async () => {
  const blob = new Blob(['exact']); const calls: string[] = [];
  const draw = (kind: 'map' | 'schematic') => { calls.push(kind); return { toBlob(cb: BlobCallback) { cb(blob); } } as HTMLCanvasElement; };
  assert.equal((await encodeWithSchematicFallback(draw, true)).blob, blob);
  assert.deepEqual(calls, ['map']);
  calls.length = 0;
  assert.equal((await encodeWithSchematicFallback(draw, false)).mapKind, 'schematic');
  assert.deepEqual(calls, ['schematic']);
  const ctrl = new AbortController(); ctrl.abort();
  await assert.rejects(encodeWithSchematicFallback(draw, true, ctrl.signal), { name: 'AbortError' });
});
test('2x backing store and byte-identical canonical faceted SVG / exact licensed Archivo 800 brand asset', () => {
  assert.equal(SUMMARY_LAYOUT.scale, 2);
  assert.equal(SUMMARY_LAYOUT.width * SUMMARY_LAYOUT.scale, 1080);
  assert.equal(SUMMARY_BRAND.color, '#121A14');
  assert.equal(SUMMARY_BRAND.weight, 800);
  assert.equal(SUMMARY_BRAND.letterSpacingEm, .02);
  assert.deepEqual(readFileSync(new URL('../../public/fonts/Archivo-800.ttf', import.meta.url)), readFileSync(new URL('../../../api-server/assets/Archivo-800.ttf', import.meta.url)));
  assert.deepEqual(readFileSync(new URL('../assets/tour-summary/Archivo-800.ttf', import.meta.url)), readFileSync(new URL('../../../api-server/assets/Archivo-800.ttf', import.meta.url)));
  assert.equal(SUMMARY_BRAND.svg, '/brand/smart360-kolobar-faceted.svg');
  const canonical = readFileSync(new URL('../../public/brand/smart360-kolobar-faceted.svg', import.meta.url));
  assert.deepEqual(readFileSync(new URL('../assets/tour-summary/smart360-kolobar-faceted.svg', import.meta.url)), canonical);
  const svg = canonical.toString('utf8');
  assert.match(svg, /<svg/);
  const renderer = readFileSync(new URL('../lib/tour-summary-render.ts', import.meta.url), 'utf8');
  assert.match(renderer, /ctx.scale\(scale, scale\)/);
  assert.match(renderer, /width \* scale, height \* scale/);
  assert.match(renderer, /new FontFace/);
  assert.match(renderer, /eager: true, query: '\?url&inline'/);
  assert.doesNotMatch(renderer, /smart360-kolobar-temno/);
  assert.match(renderer, /artwork\['\.\.\/assets\/tour-summary\/smart360-kolobar-faceted\.svg'\]/);
  assert.match(renderer, /eager: true, query: '\?raw'/);
  assert.match(renderer, /ctx.drawImage\(img, 0, 4, 72, 72\)/);
});

test('standalone SVG adapter adds only missing namespace without changing canonical artwork', () => {
  const canonical = readFileSync(new URL('../../public/brand/smart360-kolobar-faceted.svg', import.meta.url), 'utf8');
  const decode = (source: string) => decodeURIComponent(source.slice(source.indexOf(',') + 1));
  const adapted = decode(summarySvgImageSource(canonical));
  assert.equal(adapted, canonical.replace(/<svg\b/, '<svg xmlns="http://www.w3.org/2000/svg"'));
  assert.equal(decode(summarySvgImageSource(adapted)), adapted, 'already namespaced sources are unchanged');
  assert.equal(adapted.replace(' xmlns="http://www.w3.org/2000/svg"', ''), canonical, 'all artwork bytes survive serialization');
});