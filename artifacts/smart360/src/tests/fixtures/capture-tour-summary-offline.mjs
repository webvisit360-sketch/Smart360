// Browser regression against the already-running dev preview; never starts a server.
import { chromium } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || execFileSync('which', ['chromium'], { encoding: 'utf8' }).trim(),
  headless: true, args: ['--no-sandbox'],
});
try {
  const context = await browser.newContext({ viewport: { width: 1100, height: 1640 }, serviceWorkers: 'block' });
  const page = await context.newPage();
  const base = process.env.TOUR_SUMMARY_BASE_URL || 'http://127.0.0.1:80';
  // Serve a blank, same-origin page: no UI component is allowed to prime the brand cache.
  await page.route(`${base}/__tour-summary-offline-test`, route => route.fulfill({
    contentType: 'text/html', body: '<html><body style="margin:0;background:white"></body></html>',
  }));
  await page.goto(`${base}/__tour-summary-offline-test`);
  await page.evaluate(async () => {
    window.composer = await import('/src/lib/tour-summary-render.ts');
    window.engine = await import('/src/lib/live-tour.ts');
  });
  assert.equal(await page.evaluate(() => [...document.fonts].some(f => f.family === 'TourArchivo')), false,
    'Archivo must not be previously loaded');
  const requested = [];
  context.on('request', request => requested.push(request.url()));
  await context.setOffline(true);
  const output = await page.evaluate(async () => {
    const start = Date.UTC(2026, 9, 1, 10);
    const state = window.engine.startTour(start, 'hiking');
    state.points = [
      { lat: 46, lon: 14, accuracy: 3, timestamp: start, altitude: 400, altitudeAccuracy: 5 },
      { lat: 46.001, lon: 14.002, accuracy: 3, timestamp: start + 20000, altitude: 430, altitudeAccuracy: 5 },
    ];
    const result = await window.composer.createTourSummaryImage({
      state, metrics: { distanceM: 190, ascentM: 30, movingMs: 120000, pausedMs: 0, elapsedMs: 120000 },
      plannedSegments: [], tourName: 'Prvi izvoz brez povezave', tenantName: 'Smart360', lang: 'sl',
    });
    const image = new Image();
    image.src = URL.createObjectURL(result.blob);
    await image.decode();
    document.body.append(image);
    const c = document.createElement('canvas');
    c.width = result.width; c.height = result.height;
    const ctx = c.getContext('2d'); ctx.drawImage(image, 0, 0);
    // Actual rendered footer: exact dark brand pixels plus original colored sign.
    const footer = ctx.getImageData(52, 1488, 370, 80).data;
    let ink = 0, color = 0, white = 0;
    for (let i = 0; i < footer.length; i += 4) {
      const [r, g, b] = footer.slice(i, i + 3);
      if (r === 18 && g === 26 && b === 20) ink++;
      if (Math.max(r, g, b) - Math.min(r, g, b) > 60) color++;
      if (r === 255 && g === 255 && b === 255) white++;
    }
    const bytes = new Uint8Array(await result.blob.arrayBuffer());
    return {
      width: result.width, height: result.height, kind: result.mapKind, size: result.blob.size,
      fontLoaded: [...document.fonts].some(f => f.family === 'TourArchivo' && f.status === 'loaded'),
      ink, color, white, png: Array.from(bytes),
    };
  });
  assert.equal(output.kind, 'schematic');
  assert.equal(output.width, 1080); assert.equal(output.height, 1612);
  assert.ok(output.size > 20000); assert.equal(output.fontLoaded, true);
  assert.ok(output.ink > 1000 && output.color > 500 && output.white > 10000, 'sharp original sign and exact dark wordmark on white');
  assert.deepEqual(requested, [], 'first offline composition must make ZERO network requests');
  await mkdir('screenshots', { recursive: true });
  await writeFile('screenshots/tour-summary-first-offline.png', Buffer.from(output.png));
  await page.screenshot({ path: 'screenshots/tour-summary-first-offline-browser.png', fullPage: true });
  console.log(JSON.stringify({ ...output, png: undefined, networkRequests: requested.length }));
  await context.close();
} finally { await browser.close(); }