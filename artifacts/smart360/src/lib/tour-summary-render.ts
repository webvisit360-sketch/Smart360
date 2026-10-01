import { buildTourSummaryModel, elevationProfile, type TourSummaryInput } from './tour-summary-model';
import { captureTourMap, prepareTourMapSegments } from './tour-summary-map';

export type { TourSummaryInput } from './tour-summary-model';
export type TourSummaryImage = { blob: Blob; fileName: string; width: number; height: number; mapKind: 'map' | 'schematic' };
// Draw vectors/text directly into a 2x backing store, never enlarge a 1x card.
export const SUMMARY_LAYOUT = { width: 540, height: 806, scale: 2, mapY: 112, mapHeight: 296, profileY: 408, statsY: 490, footerY: 726 } as const;
export const SUMMARY_STRIP = {
  height: 7,
  stops: [[0, '#E8862E'], [0.30, '#2F72C4'], [0.55, '#3E9E4E'], [0.80, '#F5C62E'], [1, '#E8862E']],
} as const;
/** Export-only branding; never a separate app UI decoration. */
export function drawSummaryStrip(ctx: CanvasRenderingContext2D) {
  const gradient = ctx.createLinearGradient(0, 0, SUMMARY_LAYOUT.width, 0);
  for (const [offset, color] of SUMMARY_STRIP.stops) gradient.addColorStop(offset, color);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, SUMMARY_LAYOUT.mapY - SUMMARY_STRIP.height, SUMMARY_LAYOUT.width, SUMMARY_STRIP.height);
}
export const SUMMARY_BRAND = { svg: '/brand/smart360-kolobar-faceted.svg', font: '/fonts/Archivo-800.ttf', color: '#121A14', weight: 800, letterSpacingEm: 0.02 } as const;
const GREEN = '#157347', INK = '#121A14', MUTED = '#66716A';
const attribution = '© OpenFreeMap · OpenMapTiles · © OpenStreetMap contributors';
export function summaryFooter(mapKind: 'map' | 'schematic', schematic: string): string {
  return mapKind === 'map' ? attribution : schematic;
}
function abort(signal?: AbortSignal) { if (signal?.aborted) throw new DOMException('Aborted', 'AbortError'); }
function context(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D is unavailable.');
  return ctx;
}
function canvas(width: number, height: number) {
  const c = document.createElement('canvas'); c.width = width; c.height = height; return c;
}
function fit(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, width: number, bold = false) {
  ctx.font = `${bold ? '800' : '400'} ${size}px ${bold ? '"TourArchivo", ' : ''}Arial, sans-serif`;
  while (ctx.measureText(text).width > width && size > 8) {
    size -= 0.5; ctx.font = `${bold ? '800' : '400'} ${size}px ${bold ? '"TourArchivo", ' : ''}Arial, sans-serif`;
  }
  ctx.fillText(text, x, y);
}
let brandPromise: Promise<HTMLCanvasElement> | undefined;
/** Canonical artwork stays byte-for-byte intact on disk. Standalone SVG images
 * require the XML namespace that an inline HTML SVG can omit. Add only that
 * serialization attribute to the in-memory image source, never alter artwork. */
export function summarySvgImageSource(svg: string): string {
  const standalone = /<svg\b[^>]*\sxmlns\s*=/.test(svg)
    ? svg
    : svg.replace(/<svg\b/, '<svg xmlns="http://www.w3.org/2000/svg"');
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(standalone)}`;
}
/** Eager Vite imports become data URLs in the loaded module, including the 119KB
 * font (explicit inline bypasses assetsInlineLimit). No font/SVG request at compose
 * time, even when the first composition is offline. Kept inside a function so
 * pure model/encoder Node tests do not need Vite's import.meta.glob transform. */
function bundledBrandAssets() {
  const assets = import.meta.glob<string>([
    '../assets/tour-summary/Archivo-800.ttf',
  ], { eager: true, query: '?url&inline', import: 'default' });
  const artwork = import.meta.glob<string>([
    '../assets/tour-summary/smart360-kolobar-faceted.svg',
  ], { eager: true, query: '?raw', import: 'default' });
  const font = assets['../assets/tour-summary/Archivo-800.ttf'];
  const source = artwork['../assets/tour-summary/smart360-kolobar-faceted.svg'];
  if (!font?.startsWith('data:') || !source?.includes('<svg')) throw new Error('Bundled SMART360 brand assets are unavailable.');
  const svg = summarySvgImageSource(source);
  return { font, svg };
}
/** Original SVG + locally bundled exact Archivo 800, rasterized on white at export resolution. */
async function brandLockup(): Promise<HTMLCanvasElement> {
  if (!brandPromise) brandPromise = (async () => {
    const assets = bundledBrandAssets();
    const font = await new FontFace('TourArchivo', `url("${assets.font}")`, { weight: '800' }).load();
    document.fonts.add(font);
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve(); img.onerror = () => reject(new Error('Original SMART360 brand asset could not be loaded.'));
      img.src = assets.svg;
    });
    const c = canvas(370, 80), ctx = context(c);
    ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(img, 0, 4, 72, 72);
    ctx.fillStyle = SUMMARY_BRAND.color; ctx.font = '800 40px "TourArchivo"'; ctx.textBaseline = 'alphabetic';
    let x = 90;
    for (const letter of 'SMART360') {
      ctx.fillText(letter, x, 54);
      x += ctx.measureText(letter).width + 40 * SUMMARY_BRAND.letterSpacingEm;
    }
    ctx.fillStyle = MUTED;
    ctx.font = '18px Arial, sans-serif';
    ctx.fillText('smart360.info', 90, 77);
    return c;
  })().catch(error => { brandPromise = undefined; throw error; });
  return brandPromise;
}
function drawSchematic(ctx: CanvasRenderingContext2D, segments: number[][][], noRoute: string) {
  const { width, mapY: y, mapHeight: height } = SUMMARY_LAYOUT;
  ctx.fillStyle = '#EEF2EA'; ctx.fillRect(0, y, width, height);
  ctx.strokeStyle = '#DFE6DC'; ctx.lineWidth = 0.5;
  for (let x = 0; x <= width; x += 30) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + height); ctx.stroke(); }
  for (let row = y; row < y + height; row += 30) { ctx.beginPath(); ctx.moveTo(0, row); ctx.lineTo(width, row); ctx.stroke(); }
  const points = segments.flat();
  if (!points.length) { ctx.fillStyle = MUTED; fit(ctx, noRoute, 26, y + height / 2, 17, width - 52); return; }
  const xs = points.map(p => p[0]), ys = points.map(p => p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const cos = Math.max(0.01, Math.cos((minY + maxY) / 2 * Math.PI / 180));
  const scale = Math.min((width - 88) / Math.max((maxX - minX) * cos, 0.00001), (height - 80) / Math.max(maxY - minY, 0.00001));
  const project = (p: number[]) => [width / 2 + (p[0] - (minX + maxX) / 2) * cos * scale, y + height / 2 - (p[1] - (minY + maxY) / 2) * scale];
  ctx.lineWidth = 4; ctx.strokeStyle = GREEN; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (const run of segments) {
    ctx.beginPath(); run.forEach((p, i) => { const [x, py] = project(p); if (!i) ctx.moveTo(x, py); else ctx.lineTo(x, py); }); ctx.stroke();
  }
  const pin = (p: number[], label: string, color: string, offset = 0) => {
    const [x, py] = project(p); ctx.beginPath(); ctx.arc(x + offset, py, 13, 0, Math.PI * 2);
    ctx.fillStyle = color; ctx.fill(); ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#FFFFFF'; ctx.font = '800 12px "TourArchivo"'; ctx.textAlign = 'center'; ctx.fillText(label, x + offset, py + 4); ctx.textAlign = 'left';
  };
  const first = points[0], last = points[points.length - 1];
  const overlapping = Math.hypot(...project(first).map((n, i) => n - project(last)[i])) < 28;
  pin(first, 'S', GREEN, overlapping ? -15 : 0); pin(last, 'C', '#B03A36', overlapping ? 15 : 0);
}
function drawProfile(ctx: CanvasRenderingContext2D, input: TourSummaryInput, empty: string) {
  const runs = elevationProfile(input.state), all = runs.flat();
  if (!all.length) { ctx.fillStyle = MUTED; fit(ctx, empty, 26, 454, 12, 488); return; }
  const min = Math.min(...all.map(p => p.elevation)), max = Math.max(...all.map(p => p.elevation));
  const total = Math.max(1, ...all.map(p => p.distance));
  const project = (p: typeof all[number]) => [26 + p.distance / total * 488, 476 - (p.elevation - min) / Math.max(10, max - min) * 51];
  for (const run of runs) {
    const points = run.map(project);
    if (points.length === 1) { ctx.fillStyle = GREEN; ctx.beginPath(); ctx.arc(points[0][0], points[0][1], 2, 0, Math.PI * 2); ctx.fill(); continue; }
    ctx.beginPath(); ctx.moveTo(points[0][0], 480);
    points.forEach(([x, y]) => ctx.lineTo(x, y));
    ctx.lineTo(points[points.length - 1][0], 480); ctx.closePath(); ctx.fillStyle = 'rgba(21,115,71,.14)'; ctx.fill();
    ctx.beginPath(); points.forEach(([x, y], i) => { if (!i) ctx.moveTo(x, y); else ctx.lineTo(x, y); });
    ctx.strokeStyle = GREEN; ctx.lineWidth = 2; ctx.stroke();
  }
}
export function encodeSummaryCanvas(c: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    try { c.toBlob(blob => blob ? resolve(blob) : reject(new Error('PNG encoding failed.')), 'image/png'); }
    catch (error) { reject(error); }
  });
}
/** A tainted map can taint its destination. Always retry on a FRESH card, not by clearing it. */
export async function encodeWithSchematicFallback(
  draw: (kind: 'map' | 'schematic') => HTMLCanvasElement, hasMap: boolean, signal?: AbortSignal,
): Promise<{ blob: Blob; mapKind: 'map' | 'schematic' }> {
  abort(signal);
  if (hasMap) {
    try { const blob = await encodeSummaryCanvas(draw('map')); abort(signal); return { blob, mapKind: 'map' }; }
    catch (error) { abort(signal); if ((error as Error)?.name === 'AbortError') throw error; }
  }
  const blob = await encodeSummaryCanvas(draw('schematic')); abort(signal);
  return { blob, mapKind: 'schematic' };
}
export async function createTourSummaryImage(input: TourSummaryInput): Promise<TourSummaryImage> {
  abort(input.signal);
  const model = buildTourSummaryModel(input);
  const brand = await brandLockup();
  abort(input.signal);
  const segments = prepareTourMapSegments(model.route);
  let map: Awaited<ReturnType<typeof captureTourMap>> = null;
  try { map = await captureTourMap({ segments: model.route, width: 1080, height: 592, signal: input.signal }); }
  catch { abort(input.signal); /* Provider failure has a visible, labeled local fallback. */ }
  abort(input.signal);
  const draw = (kind: 'map' | 'schematic') => {
    const { width, height, scale } = SUMMARY_LAYOUT;
    const c = canvas(width * scale, height * scale), ctx = context(c);
    ctx.scale(scale, scale); ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = INK; fit(ctx, model.title, 26, 43, 29, 488, true);
    ctx.fillStyle = MUTED; fit(ctx, `${model.date} · ${model.activity}`, 26, 69, 15, 488);
    ctx.fillStyle = GREEN; fit(ctx, input.tenantName, 26, 93, 15, 488, true);
    if (kind === 'map' && map) ctx.drawImage(map.canvas, 0, 112, 540, 296);
    else drawSchematic(ctx, segments, model.labels.noRoute);
    // Paint last so schematic border antialiasing cannot bleed into the 14px band.
    drawSummaryStrip(ctx);
    drawProfile(ctx, input, model.labels.noElevation);
    model.stats.forEach((s, i) => {
      const x = 26 + (i % 3) * 169, y = 510 + Math.floor(i / 3) * 72;
      ctx.fillStyle = MUTED; fit(ctx, s.label, x, y, 13, 155);
      ctx.fillStyle = INK;
      fit(ctx, `${s.value}${s.unit ? ` ${s.unit}` : ''}`, x, y + 30, 24, 155, true);
    });
    ctx.strokeStyle = '#ECEFEA'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, 726); ctx.lineTo(540, 726); ctx.stroke();
    ctx.drawImage(brand, 26, 744, 185, 40);
    ctx.fillStyle = MUTED;
    if (kind === 'map') {
      fit(ctx, '© OpenFreeMap · OpenMapTiles', 270, 759, 10, 244);
      fit(ctx, '© OpenStreetMap contributors', 270, 776, 10, 244);
    } else fit(ctx, summaryFooter(kind, model.labels.schematic), 260, 769, 10, 254);
    return c;
  };
  const result = await encodeWithSchematicFallback(draw, !!map, input.signal);
  const name = model.title.replace(/[^\p{L}\p{N} ._-]/gu, '').trim().slice(0, 100) || 'tour';
  return { ...result, fileName: `${name}.png`, width: SUMMARY_LAYOUT.width * 2, height: SUMMARY_LAYOUT.height * 2 };
}