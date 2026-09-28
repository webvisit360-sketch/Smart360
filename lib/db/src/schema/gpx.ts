/** Bounded derived data only. Original GPX bytes live in private object storage. */
export type GpxRoute = {
  version: 1;
  fileId: string;
  filename: string;
  environment: "development" | "production";
  byteSize: number;
  sha256: string;
  activity: "cycling" | "hiking";
  segments: Array<Array<{ lat: number; lon: number }>>;
  profile: Array<{ distanceKm: number; elevationM: number | null; segment: number }>;
  distanceKm: number;
  ascentM: number | null;
  descentM: number | null;
  minElevationM: number | null;
  maxElevationM: number | null;
  durationMinutes: number | null;
};