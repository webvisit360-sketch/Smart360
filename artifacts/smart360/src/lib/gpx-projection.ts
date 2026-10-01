import { distanceMeters } from "./live-tour";
import type { GpxRoute } from "./gpx-route";

export const OFF_ROUTE_M = 150;
type Coordinate = [number, number]; // longitude, latitude
export type RouteProjection = { distanceKm: number; perpendicularM: number; segment: number };

/**
 * Geometry and profile are independently sampled by the server. For each segment,
 * map the fraction of the bounded geometry's cumulative length onto the original
 * profile's first/last distance. The server's distance never includes the gap
 * between segments; neither does this projection. Intermediate accuracy is
 * limited by geometry sampling, coordinate rounding and profile sampling.
 */
export function nearestRouteGeometry(
  segments: Coordinate[][],
  fix: { lat: number; lon: number },
) {
  if (!Number.isFinite(fix.lat) || !Number.isFinite(fix.lon) ||
      Math.abs(fix.lat) > 90 || Math.abs(fix.lon) > 180) return null;
  let nearest: { perpendicularM: number; segment: number; alongM: number; segmentLengthM: number } | null = null;
  segments.forEach((points, segment) => {
    let cumulative = 0;
    let candidate: { perpendicularM: number; segment: number; alongM: number; segmentLengthM: number } | null = null;
    for (let i = 0; i < points.length; i++) {
      const a = points[i]!;
      if (!Number.isFinite(a[0]) || !Number.isFinite(a[1])) continue;
      if (i === 0) {
        if (points.length === 1) candidate = { perpendicularM: distanceMeters(fix, { lat: a[1], lon: a[0] }), segment, alongM: 0, segmentLengthM: 0 };
        continue;
      }
      const b = points[i - 1]!;
      if (!Number.isFinite(b[0]) || !Number.isFinite(b[1])) continue;
      // Local equirectangular plane in metres around the fix; interpolate and clamp
      // on each individual edge, never between distinct GPX segments.
      const scaleX = 111195 * Math.cos(fix.lat * Math.PI / 180);
      const scaleY = 111195;
      const ax = (b[0] - fix.lon) * scaleX, ay = (b[1] - fix.lat) * scaleY;
      const dx = (a[0] - b[0]) * scaleX, dy = (a[1] - b[1]) * scaleY;
      const length2 = dx * dx + dy * dy;
      const fraction = length2 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / length2)) : 0;
      const perpendicularM = Math.hypot(ax + dx * fraction, ay + dy * fraction);
      const edgeM = distanceMeters({ lat: b[1], lon: b[0] }, { lat: a[1], lon: a[0] });
      const hit = { perpendicularM, segment, alongM: cumulative + edgeM * fraction, segmentLengthM: 0 };
      if (!candidate || perpendicularM < candidate.perpendicularM) candidate = hit;
      cumulative += edgeM;
    }
    if (candidate) {
      candidate.segmentLengthM = cumulative;
      if (!nearest || candidate.perpendicularM < nearest.perpendicularM) nearest = candidate;
    }
  });
  if (!nearest) return null;
  const hit: { perpendicularM: number; segment: number; alongM: number; segmentLengthM: number } = nearest;
  return hit;
}

export function projectRoutePosition(
  segments: Coordinate[][],
  profile: GpxRoute["profile"],
  fix: { lat: number; lon: number },
): RouteProjection | null {
  const hit = nearestRouteGeometry(segments, fix);
  if (!hit) return null;
  const samples = (profile || []).filter(p => p.segment === hit.segment && Number.isFinite(p.distanceKm));
  // A route without profile distances cannot safely locate a dot on the chart.
  if (!samples.length) return null;
  const first = samples[0]!.distanceKm, last = samples[samples.length - 1]!.distanceKm;
  if (last < first) return null;
  return {
    segment: hit.segment,
    perpendicularM: hit.perpendicularM,
    distanceKm: first + (last - first) * (hit.segmentLengthM ? hit.alongM / hit.segmentLengthM : 0),
  };
}

/** Only interpolate between valid elevation samples inside the same GPX segment. */
export function elevationAtDistance(profile: Array<{ segment: number; distanceKm: number; elevationM: number | null }>, segment: number, distanceKm: number): number | null {
  const points = (profile || []).filter(p => p.segment === segment && Number.isFinite(p.distanceKm));
  for (let i = 0; i < points.length; i++) {
    const p = points[i]!;
    if (Math.abs(distanceKm - p.distanceKm) < 1e-7) return p.elevationM != null && Number.isFinite(p.elevationM) ? p.elevationM : null;
    const next = points[i + 1];
    if (next && p.distanceKm < distanceKm && distanceKm < next.distanceKm) {
      if (p.elevationM == null || next.elevationM == null || !Number.isFinite(p.elevationM) || !Number.isFinite(next.elevationM)) return null;
      return p.elevationM + (next.elevationM - p.elevationM) * (distanceKm - p.distanceKm) / (next.distanceKm - p.distanceKm);
    }
  }
  return null;
}