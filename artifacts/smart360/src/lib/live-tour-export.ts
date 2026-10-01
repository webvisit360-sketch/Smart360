import type { TourMetrics, TourPoint, TourState } from './live-tour';
import { formatCalories } from './tour-calories';
export { createTourSummaryImage } from './tour-summary-render';
export type { TourSummaryImage, TourSummaryInput } from './tour-summary-render';

// Exports are generated entirely in the browser from local tour data; no positions leave the device.
const xml = (value: string) => value.replace(/[<>&"']/g, c =>
  ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[c] ?? c);
const safeName = (name: string) => (name.replace(/[^\p{L}\p{N} ._-]/gu, '').trim().slice(0, 100) || 'tour');
function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
export function tourGpx(state: TourState, name: string): string {
  const starts = new Set(state.segmentStarts);
  const segments: TourPoint[][] = [];
  state.points.forEach((point, index) => {
    if (starts.has(index) || !segments.length) segments.push([]);
    segments[segments.length - 1].push(point);
  });
  return `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<gpx version="1.1" creator="Smart360" xmlns="http://www.topografix.com/GPX/1/1"><trk><name>${xml(name)}</name>` +
    segments.map(segment => `<trkseg>${segment.map(point =>
      `<trkpt lat="${point.lat}" lon="${point.lon}">` +
       (point.altitude == null || Math.abs(point.altitude) > 12000 ? '' : `<ele>${point.altitude}</ele>`) +
      `<time>${new Date(point.timestamp).toISOString()}</time></trkpt>`).join('')}</trkseg>`).join('') +
    `</trk></gpx>`;
}
export function downloadTourGpx(state: TourState, name: string): void {
  download(new Blob([tourGpx(state, name)], { type: 'application/gpx+xml;charset=utf-8' }), `${safeName(name)}.gpx`);
}

const duration = (ms: number) => {
  const total = Math.floor(ms / 1000);
  return `${Math.floor(total / 3600).toString().padStart(2, '0')}:${Math.floor(total / 60 % 60).toString().padStart(2, '0')}:${(total % 60).toString().padStart(2, '0')}`;
};

/** Offline schematic, NOT a geographic tile map. plannedSegments use [lon,lat] GeoJSON order. */
export async function downloadTourImage(
  state: TourState, metrics: TourMetrics, plannedSegments: number[][][], labels: Record<string, string>,
): Promise<void> {
  const canvas = document.createElement('canvas');
  canvas.width = 1200;
  canvas.height = 900;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D is unavailable.');
  const css = getComputedStyle(document.documentElement);
  const color = (token: string, fallback: string) => {
    const raw = css.getPropertyValue(token).trim();
    return raw || fallback;
  };
  const background = color('--bg', '#FFFFFF');
  const foreground = color('--tx', '#121A14');
  const primary = color('--acc', '#157347');
  const muted = color('--tx2', '#66716A');
  ctx.fillStyle = background; ctx.fillRect(0, 0, 1200, 900);
  ctx.fillStyle = foreground; ctx.font = 'bold 46px sans-serif';
  ctx.fillText(labels.title || 'Tour', 64, 85);
  ctx.font = '24px sans-serif'; ctx.fillStyle = muted;
  ctx.fillText(new Date(state.startedAt).toLocaleString(), 64, 126);
  // The free-tour heading is generic; include its localized activity in the image.
  if (labels.routeName) ctx.fillText(labels.routeName, 64, 159);
  const stats: [string, string][] = [
    [labels.net || 'Moving', labels.netValue || duration(metrics.movingMs)],
    [labels.paused || 'Paused', labels.pausedValue || duration(metrics.pausedMs)],
    [labels.elapsed || 'Elapsed', labels.elapsedValue || duration(metrics.elapsedMs)],
    [labels.distance || 'Distance', labels.distanceValue || `${(metrics.distanceM / 1000).toFixed(2)} km`],
  ];
  if (labels.ascent && metrics.ascentM !== undefined) {
    stats.push([labels.ascent, labels.ascentValue || `${Math.round(metrics.ascentM)} m`]);
  }
  const kcal = formatCalories(metrics.caloriesKcal, labels.approx || 'approx.');
  if (kcal !== null) stats.push([labels.calories || 'Energy (approx.)', kcal]);
  const twoRows = stats.length === 6;
  stats.forEach(([label, value], i) => {
    const column = twoRows ? i % 3 : i;
    const row = twoRows ? Math.floor(i / 3) : 0;
    const cellWidth = 1072 / (twoRows ? 3 : stats.length);
    const x = 64 + column * cellWidth;
    const maxWidth = cellWidth - 20;
    ctx.font = stats.length >= 5 ? '18px sans-serif' : '21px sans-serif';
    ctx.fillStyle = muted;
    // Labels can be longer in SL/EN/DE/IT. Break on words rather than painting into the next cell.
    const words = label.split(/\s+/);
    const lines: string[] = [];
    for (const word of words) {
      const candidate = lines.length ? `${lines[lines.length - 1]} ${word}` : word;
      if (lines.length && ctx.measureText(candidate).width > maxWidth) lines.push(word);
      else if (lines.length) lines[lines.length - 1] = candidate;
      else lines.push(word);
    }
    lines.forEach((line, n) => ctx.fillText(line, x, (twoRows ? 190 + row * 105 : 196) + n * 21, maxWidth));
    ctx.font = stats.length >= 5 ? 'bold 27px sans-serif' : 'bold 32px sans-serif';
    ctx.fillStyle = foreground; ctx.fillText(value, x, twoRows ? 243 + row * 105 : 241, maxWidth);
  });
  ctx.strokeStyle = muted; ctx.lineWidth = 1; ctx.strokeRect(64, twoRows ? 380 : 285, 1072, twoRows ? 435 : 530);
  const recorded = state.points.map(p => [p.lon, p.lat]);
  const all = [...plannedSegments.flat(), ...recorded].filter(p =>
    Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1]));
  if (all.length) {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const [x, y] of all) {
      minX = Math.min(minX, x); maxX = Math.max(maxX, x);
      minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    }
    const cosLat = Math.max(0.01, Math.cos(((minY + maxY) / 2) * Math.PI / 180));
    const spanX = Math.max(0.00001, (maxX - minX) * cosLat);
    const spanY = Math.max(0.00001, maxY - minY);
    const scale = Math.min(960 / spanX, (twoRows ? 340 : 420) / spanY);
    const centerX = (minX + maxX) / 2, centerY = (minY + maxY) / 2;
    const draw = (segment: number[][]) => {
      let began = false;
      for (const p of segment) {
        if (!Number.isFinite(p?.[0]) || !Number.isFinite(p?.[1])) continue;
        const x = 600 + (p[0] - centerX) * cosLat * scale;
        const y = (twoRows ? 595 : 550) - (p[1] - centerY) * scale;
        if (!began) { ctx.moveTo(x, y); began = true; } else ctx.lineTo(x, y);
      }
    };
    ctx.lineWidth = 5; ctx.strokeStyle = primary; ctx.setLineDash([]);
    plannedSegments.forEach(segment => { ctx.beginPath(); draw(segment); ctx.stroke(); });
    ctx.setLineDash([9, 8]); ctx.strokeStyle = foreground; ctx.lineWidth = 7;
    const starts = [...state.segmentStarts, state.points.length];
    for (let i = 0; i < starts.length - 1; i++) {
      ctx.beginPath(); draw(recorded.slice(starts[i], starts[i + 1])); ctx.stroke();
    }
  }
  ctx.fillStyle = muted; ctx.font = '20px sans-serif';
  ctx.fillText(labels.schematic || 'Schematic route diagram · not a map', 64, 856);
  if (plannedSegments.some(segment => segment.length > 0)) {
    ctx.fillStyle = primary; ctx.fillRect(680, 840, 38, 5);
    ctx.fillStyle = foreground; ctx.fillText(labels.planned || 'Planned', 730, 851);
  }
  ctx.fillStyle = foreground; ctx.fillRect(910, 840, 38, 5);
  ctx.fillStyle = foreground; ctx.fillText(labels.recorded || 'Recorded', 960, 851);
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(result => result ? resolve(result) : reject(new Error('Image export failed.')), 'image/png'));
  download(blob, `${safeName(labels.title || 'tour')}.png`);
}