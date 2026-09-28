import type { GpxRoute } from "@workspace/api-client-react";

export type { GpxRoute };
export type GpxActivity = GpxRoute["activity"];

export const GPX_MAX_BYTES = 5 * 1024 * 1024;
export const GPX_MAX_GEOMETRY_POINTS = 400;
export const GPX_MAX_PROFILE_POINTS = 300;

/** Public, published original file. Respects the app base prefix. */
export function gpxDownloadUrl(slug: string, itemId: string, fileId: string): string {
  const base = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");
  return `${base}/api/public/tenants/${encodeURIComponent(slug)}/items/${encodeURIComponent(itemId)}/gpx/${encodeURIComponent(fileId)}`;
}

/** Defensive client-side cap (server already bounds): keeps segment gaps + endpoints. */
export function boundedSegments(route: GpxRoute): Array<Array<[number, number]>> {
  const segments = (route.segments || []).filter((s) => s.length > 0);
  const total = segments.reduce((sum, s) => sum + s.length, 0);
  const stride = Math.max(1, Math.ceil(total / GPX_MAX_GEOMETRY_POINTS));
  return segments.map((segment) =>
    segment
      .filter((_, i) => i === 0 || i === segment.length - 1 || i % stride === 0)
      .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lon))
      .map((p) => [p.lon, p.lat] as [number, number]),
  ).filter((s) => s.length > 0);
}

export type ProfilePoint = { distanceKm: number; elevationM: number | null };

/** Profile with a null break between segments so the chart shows gaps. */
export function boundedProfile(route: GpxRoute): ProfilePoint[] {
  const src = route.profile || [];
  const stride = Math.max(1, Math.ceil(src.length / GPX_MAX_PROFILE_POINTS));
  const out: ProfilePoint[] = [];
  let lastSegment: number | null = null;
  src.forEach((p, i) => {
    if (i !== 0 && i !== src.length - 1 && i % stride !== 0) return;
    if (lastSegment !== null && p.segment !== lastSegment) {
      out.push({ distanceKm: p.distanceKm, elevationM: null });
    }
    lastSegment = p.segment;
    out.push({ distanceKm: p.distanceKm, elevationM: p.elevationM ?? null });
  });
  return out;
}
