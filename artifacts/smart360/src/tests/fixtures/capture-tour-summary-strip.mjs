// Focused export-brand regression using the already-running fixture, no server/DB.
import { chromium } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';

const OUT = process.env.TOUR_SUMMARY_OUT || 'reports/znak-final';
const base = process.env.TOUR_SUMMARY_BASE_URL || 'http://127.0.0.1:80';
const stops = [[0, '#E8862E'], [0.3, '#2F72C4'], [0.55, '#3E9E4E'], [0.8, '#F5C62E'], [1, '#E8862E']];
const sha = bytes => createHash('sha256').update(Buffer.from(bytes)).digest('hex');
await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || execFileSync('which', ['chromium'], { encoding: 'utf8' }).trim(),
  headless: true,
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const report = { runs: {}, svg: null, failures: [] };
try {
  for (const blocked of [false, true]) {
    const kind = blocked ? 'schematic' : 'map';
    const context = await browser.newContext({ viewport: { width: 1200, height: 1800 }, acceptDownloads: true, serviceWorkers: 'block' });
    if (blocked) await context.route(/openfreemap|tiles\./, route => route.abort());
    await context.addInitScript(() => {
      window.__summaryGradients = [];
      window.__summaryTexts = [];
      const linear = CanvasRenderingContext2D.prototype.createLinearGradient;
      CanvasRenderingContext2D.prototype.createLinearGradient = function (...coords) {
        const gradient = linear.apply(this, coords);
        const record = { coords, stops: [] };
        window.__summaryGradients.push(record);
        const add = gradient.addColorStop.bind(gradient);
        gradient.addColorStop = (offset, color) => { record.stops.push([offset, color]); add(offset, color); };
        return gradient;
      };
      const fill = CanvasRenderingContext2D.prototype.fillText;
      CanvasRenderingContext2D.prototype.fillText = function (text, ...args) {
        const metrics = this.measureText(text);
        window.__summaryTexts.push({
          text: String(text), font: this.font, args,
          inkBottom: args[1] + metrics.actualBoundingBoxDescent,
        });
        return fill.call(this, text, ...args);
      };
    });
    const page = await context.newPage();
    await page.goto(`${base}/src/tests/fixtures/tour-summary.html?mode=guided&lang=sl&activity=hiking`);
    await page.getByTestId('img-tour-summary').waitFor({ timeout: 60000 });
    const result = await page.evaluate(async () => {
      const img = document.querySelector('[data-testid="img-tour-summary"]');
      const module = await import('/src/lib/tour-summary-render.ts');
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0);
      const pixel = (x, y) => Array.from(ctx.getImageData(x, y, 1, 1).data);
      const row = y => Array.from(ctx.getImageData(0, y, canvas.width, 1).data);
      const rows = Array.from({ length: 14 }, (_, i) => row(210 + i));
      // Chromium dithers gradients by one channel unit between scanlines.
      const rowDeviation = rows.map(r => Math.max(...r.map((v, i) => Math.abs(v - rows[0][i]))));
      const footer = ctx.getImageData(142, 1544, 150, 25).data;
      let websiteInk = 0, websiteSolidInk = 0;
      for (let i = 0; i < footer.length; i += 4) {
        if (footer[i] < 240 && footer[i + 1] < 240 && footer[i + 2] < 240) websiteInk++;
        if (footer[i] === 102 && footer[i + 1] === 113 && footer[i + 2] === 106) websiteSolidInk++;
      }
      return {
        bytes: Array.from(new Uint8Array(await (await fetch(img.src)).arrayBuffer())),
        kind: img.dataset.mapKind, dimensions: [canvas.width, canvas.height],
        strip: module.SUMMARY_STRIP, layout: module.SUMMARY_LAYOUT,
        gradients: window.__summaryGradients.filter(g => g.coords.join(',') === '0,0,540,0'),
        stripRowDeviation: rowDeviation,
        boundaryPixels: [209, 210, 223, 224].map(y => [y, pixel(540, y)]),
        samples: [0, 324, 594, 864, 1079].map(x => [x, pixel(x, 215)]),
        tenantText: window.__summaryTexts.filter(t => t.args[0] === 26 && t.args[1] === 93),
        websiteText: window.__summaryTexts.filter(t => t.text === 'smart360.info'),
        websiteInk, websiteSolidInk,
      };
    });
    await writeFile(`${OUT}/${kind}-observed.json`, JSON.stringify({ ...result, bytes: undefined }, null, 2));
    await writeFile(`${OUT}/${kind}-export.png`, Buffer.from(result.bytes));
    assert.equal(result.kind, kind, 'real-map and blocked-tile exports must use their requested map modes');
    assert.deepEqual(result.dimensions, [1080, 1612]);
    assert.equal(result.strip.height, 7);
    assert.equal(result.strip.height * result.layout.scale, 14);
    assert.deepEqual(result.strip.stops, stops);
    assert.equal(result.layout.mapY, 112);
    assert.ok(result.gradients.length > 0);
    for (const gradient of result.gradients) assert.deepEqual(gradient.stops, stops);
    if (!result.stripRowDeviation.every(d => d <= 1)) report.failures.push(`${kind}: strip row color deviation ${JSON.stringify(result.stripRowDeviation)}; map/grid may overpaint row 223`);
    assert.notDeepEqual(result.boundaryPixels[0][1], result.boundaryPixels[1][1], 'strip starts at 210px');
    assert.notDeepEqual(result.boundaryPixels[2][1], result.boundaryPixels[3][1], 'strip ends before 224px map');
    assert.equal(result.tenantText.length, 1);
    assert.ok(result.tenantText[0].inkBottom < 101, 'tenant ink must finish above the strip at logical y=101');
    for (let i = 0; i < stops.length; i++) {
      const rgb = stops[i][1].slice(1).match(/../g).map(v => parseInt(v, 16));
      assert.ok(rgb.every((v, channel) => Math.abs(v - result.samples[i][1][channel]) <= 1), 'raster stop color ±1 for pixel-center interpolation');
    }
    assert.equal(result.websiteText.length, 1);
    assert.ok(result.websiteInk > 100 && result.websiteSolidInk > 20, 'website has actual sharp native-resolution ink');
    const [download] = await Promise.all([
      page.waitForEvent('download'), page.getByTestId('button-tour-download-image').click(),
    ]);
    const downloadBytes = await readFile(await download.path());
    assert.deepEqual(Buffer.from(result.bytes), downloadBytes, 'preview and download must be byte-identical');
    await writeFile(`${OUT}/${kind}-export.png`, downloadBytes);
    await page.getByTestId('img-tour-summary').screenshot({ path: `${OUT}/${kind}-preview.png` });
    // Display original PNG at its native 2x resolution for close visual evidence.
    await page.evaluate(() => {
      const img = document.querySelector('[data-testid="img-tour-summary"]');
      document.body.replaceChildren(img);
      document.body.style.cssText = 'margin:0;padding:0;background:white';
      img.style.cssText = 'display:block;width:1080px;max-width:none;height:1612px';
    });
    const nativeDisplay = await page.getByTestId('img-tour-summary').boundingBox();
    assert.equal(nativeDisplay.width, 1080);
    assert.equal(nativeDisplay.height, 1612);
    await page.getByTestId('img-tour-summary').screenshot({ path: `${OUT}/${kind}-native-100-percent.png` });
    await page.screenshot({ path: `${OUT}/${kind}-strip.png`, clip: { x: 0, y: 185, width: 1080, height: 65 } });
    await page.screenshot({ path: `${OUT}/${kind}-footer.png`, clip: { x: 30, y: 1470, width: 1020, height: 120 } });
    report.runs[kind] = {
      ...result, bytes: undefined, nativeDisplay,
      stripNativeBounds: { x: 0, y: 210, width: 1080, height: 14 },
      tenantGapLogical: 105 - result.tenantText[0].inkBottom,
      previewSha256: sha(result.bytes), downloadSha256: sha(downloadBytes), downloadName: download.suggestedFilename(),
    };
    await context.close();
  }
  const page = await browser.newPage({ viewport: { width: 600, height: 600 } });
  await page.goto(`${base}/src/tests/fixtures/tour-summary.html`);
  await page.setContent('<body style="margin:0;background:white"><img width="600" height="600"></body>');
  report.svg = await page.evaluate(async () => {
    const module = await import('/src/lib/tour-summary-render.ts');
    const canonical = await (await fetch(module.SUMMARY_BRAND.svg)).text();
    const img = document.querySelector('img');
    img.src = module.summarySvgImageSource(canonical);
    await img.decode();
    const c = document.createElement('canvas'); c.width = c.height = 1000;
    const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0, 1000, 1000);
    return [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map(degrees => {
      const angle = degrees * Math.PI / 180;
      const x = Math.round(500 + 480 * Math.sin(angle)), y = Math.round(500 - 480 * Math.cos(angle));
      const rgb = Array.from(ctx.getImageData(x, y, 1, 1).data).slice(0, 3);
      return { degreesClockwiseFromTop: degrees, hex: '#' + rgb.map(v => v.toString(16).padStart(2, '0')).join('').toUpperCase() };
    });
  });
  await page.screenshot({ path: `${OUT}/canonical-svg.png` });
  await writeFile(`${OUT}/verification.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  assert.deepEqual(report.failures, [], 'all twenty-two strip rows must remain unobscured');
} finally { await browser.close(); }