import { distanceMeters, MAX_ACCURACY_M, TRACK_GAP_MS, type TourPoint, type TourState, type TourMetrics } from './live-tour';
import { validProfile } from './tour-calories';

export type SummaryPoint = { lat: number; lon: number; ele?: number | null };
export type TourSummaryInput = {
  state: TourState; metrics: TourMetrics; plannedSegments: SummaryPoint[][];
  tourName: string; tenantName: string; lang: string; signal?: AbortSignal;
};
import { extendCatalog } from "./guest-catalogs";
import { LANGUAGE_LOCALES, guideLanguage } from "@workspace/guide-languages";
export const SUMMARY_LABELS = extendCatalog({
  sl: { locale: 'sl-SI', tour: 'Moja tura', cycling: 'Kolesarjenje', running: 'Tek', hiking: 'Pohodništvo', distance: 'Razdalja', ascent: 'Vzpon', altitude: 'Najv. višina', net: 'Neto čas', paused: 'Premori', elapsed: 'Skupni čas', speed: 'Povp. hitrost', maxSpeed: 'Najv. hitrost (GPS)', pace: 'Tempo', calories: 'Poraba (ocena)', schematic: 'Shematski prikaz poti', noRoute: 'Ni zabeležene poti', noElevation: 'Višinski podatki niso na voljo' },
  en: { locale: 'en-GB', tour: 'My tour', cycling: 'Cycling', running: 'Running', hiking: 'Hiking', distance: 'Distance', ascent: 'Elevation gain', altitude: 'Max. elevation', net: 'Moving time', paused: 'Paused', elapsed: 'Elapsed time', speed: 'Avg. speed', maxSpeed: 'Max. speed (GPS)', pace: 'Pace', calories: 'Energy (estimate)', schematic: 'Schematic route diagram', noRoute: 'No recorded route', noElevation: 'Elevation data unavailable' },
  de: { locale: 'de-DE', tour: 'Meine Tour', cycling: 'Radfahren', running: 'Laufen', hiking: 'Wandern', distance: 'Distanz', ascent: 'Aufstieg', altitude: 'Max. Höhe', net: 'Bewegungszeit', paused: 'Pausen', elapsed: 'Gesamtzeit', speed: 'Ø Geschwindigkeit', maxSpeed: 'Max. Tempo (GPS)', pace: 'Pace', calories: 'Energie (geschätzt)', schematic: 'Schematische Routendarstellung', noRoute: 'Keine aufgezeichnete Route', noElevation: 'Keine Höhendaten verfügbar' },
  it: { locale: 'it-IT', tour: 'La mia escursione', cycling: 'Ciclismo', running: 'Corsa', hiking: 'Escursionismo', distance: 'Distanza', ascent: 'Dislivello positivo', altitude: 'Altitudine max.', net: 'Tempo in movimento', paused: 'Pause', elapsed: 'Tempo totale', speed: 'Velocità media', maxSpeed: 'Velocità max. (GPS)', pace: 'Passo', calories: 'Energia (stima)', schematic: 'Rappresentazione schematica', noRoute: 'Nessun percorso registrato', noElevation: 'Dati altimetrici non disponibili' },
});
export function summaryLabels(lang: string) {
  const language = guideLanguage(lang.toLowerCase().split("-")[0]);
  return { ...SUMMARY_LABELS[language], locale: LANGUAGE_LOCALES[language] };
}
export function validCoordinate(p: SummaryPoint): boolean {
  return Number.isFinite(p.lat) && Number.isFinite(p.lon) && Math.abs(p.lat) <= 90 && Math.abs(p.lon) <= 180;
}
export function recordedSegments(state: TourState): TourPoint[][] {
  const starts = new Set(state.segmentStarts);
  const segments: TourPoint[][] = [];
  let run: TourPoint[] = [];
  state.points.forEach((p, i) => {
    const previous = state.points[i - 1];
    if (starts.has(i) || !validCoordinate(p) || (previous && (p.timestamp <= previous.timestamp || p.timestamp - previous.timestamp > TRACK_GAP_MS))) {
      if (run.length) segments.push(run);
      run = [];
    }
    if (validCoordinate(p)) run.push(p);
  });
  if (run.length) segments.push(run);
  return segments;
}
export function validElevation(p: TourPoint): boolean {
  return p.altitude != null && Number.isFinite(p.altitude) && Math.abs(p.altitude) <= 12000 &&
    (p.altitudeAccuracy == null || (p.altitudeAccuracy >= 0 && p.altitudeAccuracy <= 20));
}
/** Retained-fix interval estimate, NOT raw sensor/instantaneous maximum.
 * Reject gaps, inaccurate fixes, jitter and the recorder's >45m/s teleport limit.
 * Thinned intervals may understate the true maximum; no unobserved speed is invented. */
export function retainedGpsMaxSpeed(state: TourState): number | null {
  let max: number | null = null;
  for (const run of recordedSegments(state)) for (let i = 1; i < run.length; i++) {
    const a = run[i - 1], b = run[i], seconds = (b.timestamp - a.timestamp) / 1000;
    if (![a, b].every(p => Number.isFinite(p.accuracy) && p.accuracy >= 0 && p.accuracy <= MAX_ACCURACY_M) || seconds < 1 || seconds > TRACK_GAP_MS / 1000) continue;
    const meters = distanceMeters(a, b), speed = meters / seconds;
    if (meters < Math.max(8, Math.min(a.accuracy, b.accuracy)) || speed > 45) continue;
    max = Math.max(max ?? 0, speed * 3.6);
  }
  return max;
}
export function summaryDuration(ms: number): string {
  const s = Math.floor(Math.max(0, ms) / 1000);
  return s >= 3600 ? `${Math.floor(s / 3600)}:${String(Math.floor(s / 60) % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}` :
    `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}
export type SummaryStat = { key: string; label: string; value: string; unit: string };
export function buildTourSummaryModel(input: TourSummaryInput) {
  const { state, metrics: m } = input, l = summaryLabels(input.lang);
  const number = (v: number, digits = 0) => new Intl.NumberFormat(l.locale, { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(v);
  const stat = (key: string, label: string, value: string, unit = ''): SummaryStat => ({ key, label, value, unit });
  const elevation = state.points.filter(validElevation).map(p => p.altitude!);
  const speed = m.movingMs > 0 && m.distanceM > 0 ? m.distanceM / m.movingMs * 3600 : null;
  const paceSeconds = m.distanceM > 0 && m.movingMs > 0 ? Math.round(m.movingMs / m.distanceM) : null;
  const average = stat('speed', l.speed, speed == null ? '—' : number(speed, 1), 'km/h');
  const pace = stat('pace', l.pace, paceSeconds == null ? '—' : `${Math.floor(paceSeconds / 60)}:${String(paceSeconds % 60).padStart(2, '0')}`, '/km');
  const max = retainedGpsMaxSpeed(state);
  const stats = [
    stat('distance', l.distance, number(m.distanceM / 1000, 2), 'km'),
    stat('ascent', l.ascent, m.ascentM == null ? '—' : number(m.ascentM), 'm'),
    stat('altitude', l.altitude, elevation.length ? number(Math.max(...elevation)) : '—', 'm'),
    stat('net', l.net, summaryDuration(m.movingMs)),
    stat('paused', l.paused, summaryDuration(m.pausedMs)),
    stat('elapsed', l.elapsed, summaryDuration(m.elapsedMs)),
    ...(state.activity === 'cycling' ? [average, stat('maxSpeed', l.maxSpeed, max == null ? '—' : `~${number(max, 1)}`, 'km/h')] :
      state.activity === 'running' ? [pace, average] : [average, pace]),
  ];
  const kcal = m.caloriesKcal;
  if (validProfile(state.calorieProfile).weightKg !== undefined && kcal != null && Number.isFinite(kcal) && kcal > 0) {
    // Match the existing ten-kcal presentation while never rounding a positive estimate to zero.
    stats.push(stat('calories', l.calories, kcal < 1 ? '<1' : `~${number(kcal >= 5 ? Math.round(kcal / 10) * 10 : kcal)}`, 'kcal'));
  }
  const segments = recordedSegments(state);
  return {
    labels: l, stats, segments,
    route: segments.length ? segments.map(run => run.map(p => ({ lat: p.lat, lon: p.lon }))) : input.plannedSegments,
    title: input.tourName.trim() || l.tour,
    date: new Intl.DateTimeFormat(l.locale, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(state.startedAt)),
    activity: l[state.activity],
  };
}
/** Separate runs at GPS/altitude gaps; cumulative distance never crosses a gap. */
export function elevationProfile(state: TourState): Array<Array<{ distance: number; elevation: number }>> {
  const result: Array<Array<{ distance: number; elevation: number }>> = [];
  let distance = 0;
  for (const segment of recordedSegments(state)) {
    let run: Array<{ distance: number; elevation: number }> = [];
    segment.forEach((p, i) => {
      if (i) distance += distanceMeters(segment[i - 1], p);
      if (!validElevation(p)) { if (run.length) result.push(run); run = []; }
      else run.push({ distance, elevation: p.altitude! });
    });
    if (run.length) result.push(run);
    // Small explicit discontinuity keeps adjacent retained segments visibly separate.
    distance += 10;
  }
  return result;
}