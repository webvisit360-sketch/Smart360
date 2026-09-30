import { SaxesParser, type SaxesTagNS } from "saxes";

export const MAX_GPX_BYTES = 5 * 1024 * 1024;
const MAX_POINTS = 150_000;
const MAX_SEGMENTS = 100;
const GPX_NAMESPACES = new Set(["", "http://www.topografix.com/GPX/1/0", "http://www.topografix.com/GPX/1/1"]);
const EARTH_RADIUS_KM = 6371.0088;

export type GpxDerived = {
  segments: Array<Array<{ lat: number; lon: number }>>;
  profile: Array<{ distanceKm: number; elevationM: number | null; segment: number }>;
  distanceKm: number;
  ascentM: number | null;
  descentM: number | null;
  minElevationM: number | null;
  maxElevationM: number | null;
  durationMinutes: number | null;
};

type Point = { lat: number; lon: number; elevationM: number | null; distanceKm: number };
type Element = { local: string; uri: string };

function invalid(message: string): never {
  throw new Error(`Neveljavna datoteka GPX: ${message}`);
}

function coordinate(value: string | undefined, limit: number): number {
  if (value === undefined || !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(value.trim())) {
    invalid("koordinate morajo biti veljavna števila.");
  }
  const result = Number(value);
  if (!Number.isFinite(result) || Math.abs(result) > limit) {
    invalid("koordinate so zunaj dovoljenega območja.");
  }
  return result;
}

function lengthKm(a: Point, b: Point): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLon = (b.lon - a.lon) * rad;
  const h = Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.asin(Math.sqrt(Math.min(1, h)));
}

function round(value: number, decimals: number): number {
  return Number(value.toFixed(decimals));
}

/** Allocate samples globally, reserving both endpoints of every non-singleton segment. */
function sampleCounts(segments: Point[][], cap: number): number[] {
  const counts = segments.map((segment) => Math.min(2, segment.length));
  let available = cap - counts.reduce((sum, count) => sum + count, 0);
  while (available > 0) {
    let best = -1;
    let bestRatio = -1;
    for (let i = 0; i < segments.length; i++) {
      if (counts[i] >= segments[i]!.length) continue;
      const ratio = (segments[i]!.length - 1) / Math.max(1, counts[i]! - 1);
      if (ratio > bestRatio) {
        bestRatio = ratio;
        best = i;
      }
    }
    if (best < 0) break;
    counts[best]!++;
    available--;
  }
  return counts;
}

function sampled<T>(points: T[], count: number): T[] {
  if (count === points.length) return points;
  if (count === 1) return [points[0]!];
  return Array.from({ length: count }, (_, i) => points[Math.round(i * (points.length - 1) / (count - 1))]!);
}

/** Strict, non-resolving XML parser. Original track points live only during this call. */
export function parseGpx(buffer: Buffer, activity: "cycling" | "hiking" | "running"): GpxDerived {
  if (!Buffer.isBuffer(buffer) || !buffer.length) invalid("datoteka je prazna.");
  if (buffer.length > MAX_GPX_BYTES) invalid("datoteka presega omejitev 5 MB.");
  if (activity !== "cycling" && activity !== "hiking" && activity !== "running") invalid("vrsta dejavnosti ni podprta.");
  let xml: string;
  try {
    xml = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(buffer);
  } catch {
    invalid("kodiranje mora biti UTF-8.");
  }
  if (xml.charCodeAt(0) === 0xfeff) xml = xml.slice(1);

  const segments: Point[][] = [];
  const stack: Element[] = [];
  let currentPoint: Point | null = null;
  let elevationText = "";
  let distanceKm = 0;
  let ascentM = 0;
  let descentM = 0;
  let minElevationM: number | null = null;
  let maxElevationM: number | null = null;
  let missingElevation = false;
  let pointCount = 0;
  let rootSeen = false;
  const parser = new SaxesParser({ xmlns: true });
  const isGpx = (element: Element | undefined, name: string) =>
    element?.local === name && GPX_NAMESPACES.has(element.uri);

  parser.on("xmldecl", (declaration) => {
    if (declaration.encoding && !/^utf-?8$/i.test(declaration.encoding)) {
      invalid("kodiranje mora biti UTF-8.");
    }
  });
  parser.on("doctype", () => invalid("deklaracije DOCTYPE in entitete niso dovoljene."));
  parser.on("opentag", (tag: SaxesTagNS) => {
    const element = { local: tag.local, uri: tag.uri };
    const parent = stack.at(-1);
    const grandparent = stack.at(-2);
    if (stack.length === 0) {
      if (rootSeen || !isGpx(element, "gpx")) invalid("koren dokumenta mora biti GPX.");
      rootSeen = true;
    }
    const trackSegment = isGpx(element, "trkseg") && isGpx(parent, "trk") && isGpx(grandparent, "gpx");
    const route = isGpx(element, "rte") && isGpx(parent, "gpx");
    if (trackSegment || route) {
      if (segments.length >= MAX_SEGMENTS) invalid("pot ima preveč odsekov (največ 100).");
      segments.push([]);
    }
    const trackPoint = isGpx(element, "trkpt") && isGpx(parent, "trkseg") &&
      isGpx(grandparent, "trk") && isGpx(stack.at(-3), "gpx");
    const routePoint = isGpx(element, "rtept") && isGpx(parent, "rte") && isGpx(grandparent, "gpx");
    if (trackPoint || routePoint) {
      if (++pointCount > MAX_POINTS) invalid("pot vsebuje preveč točk.");
      const attributes = Object.values(tag.attributes);
      const lat = attributes.find((a) => a.local === "lat" && a.uri === "")?.value;
      const lon = attributes.find((a) => a.local === "lon" && a.uri === "")?.value;
      currentPoint = { lat: coordinate(lat, 90), lon: coordinate(lon, 180), elevationM: null, distanceKm: 0 };
    }
    if (isGpx(element, "ele") && (isGpx(parent, "trkpt") || isGpx(parent, "rtept")) && currentPoint) {
      elevationText = "";
    }
    stack.push(element);
  });
  const appendElevation = (text: string) => {
    if (isGpx(stack.at(-1), "ele") && currentPoint) {
      elevationText += text;
      if (elevationText.length > 64) invalid("višina ni veljavno število.");
    }
  };
  parser.on("text", appendElevation);
  parser.on("cdata", appendElevation);
  parser.on("closetag", (tag: SaxesTagNS) => {
    const element = stack.pop();
    const parent = stack.at(-1);
    if (isGpx(element, "ele") && (isGpx(parent, "trkpt") || isGpx(parent, "rtept")) && currentPoint) {
      const value = elevationText.trim();
      if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(value)) invalid("višina ni veljavno število.");
      const elevation = Number(value);
      if (!Number.isFinite(elevation) || Math.abs(elevation) > 12000) invalid("višina je zunaj dovoljenega območja.");
      currentPoint.elevationM = elevation;
    }
    if ((isGpx(element, "trkpt") || isGpx(element, "rtept")) && currentPoint) {
      const segment = segments.at(-1)!;
      const previous = segment.at(-1);
      if (previous) {
        distanceKm += lengthKm(previous, currentPoint);
        if (previous.elevationM !== null && currentPoint.elevationM !== null) {
          const delta = currentPoint.elevationM - previous.elevationM;
          if (delta > 0) ascentM += delta;
          else descentM -= delta;
        }
      }
      currentPoint.distanceKm = distanceKm;
      segment.push(currentPoint);
      if (currentPoint.elevationM === null) missingElevation = true;
      else {
        minElevationM = Math.min(minElevationM ?? Infinity, currentPoint.elevationM);
        maxElevationM = Math.max(maxElevationM ?? -Infinity, currentPoint.elevationM);
      }
      currentPoint = null;
    }
    // The saxes closing event enforces matching XML tags; stack tracks GPX context.
    if (tag.local !== element?.local || tag.uri !== element.uri) invalid("struktura XML ni veljavna.");
  });
  try {
    parser.write(xml).close();
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Neveljavna datoteka GPX:")) throw error;
    invalid("XML je poškodovan ali vsebuje nedovoljene entitete.");
  }
  if (!rootSeen || pointCount === 0) invalid("pot ne vsebuje nobene točke.");
  const populated = segments.filter((segment) => segment.length > 0);
  const geometryCounts = sampleCounts(populated, 400);
  const profileCounts = sampleCounts(populated, 300);
  const totalAscent = missingElevation ? null : round(ascentM, 2);
  return {
    segments: populated.map((segment, i) => sampled(segment, geometryCounts[i]!).map(
      ({ lat, lon }) => ({ lat: round(lat, 6), lon: round(lon, 6) }),
    )),
    profile: populated.flatMap((segment, i) => sampled(segment, profileCounts[i]!).map(
      ({ distanceKm: distance, elevationM }) => ({
        distanceKm: round(distance, 5),
        elevationM: elevationM === null ? null : round(elevationM, 2),
        segment: i,
      }),
    )),
    distanceKm: round(distanceKm, 5),
    ascentM: totalAscent,
    descentM: missingElevation ? null : round(descentM, 2),
    minElevationM,
    maxElevationM,
    durationMinutes: missingElevation ? null
      : round((distanceKm / (activity === "cycling" ? 15 : activity === "running" ? 10 : 5) + ascentM / 600) * 60, 2),
  };
}