export type CreatorDependency = "openai" | "overpass" | "nominatim" | "osrm";

export type CreatorDependencyAttempt = {
  dependency: CreatorDependency;
  operation: string;
  attempt: number;
  ok: boolean;
  httpStatus: number | null;
  durationMs: number;
  rawElementCount: number | null;
  filteredElementCount: number | null;
  query: string | null;
  error: string | null;
};

export type CreatorDependencyRecorder = (attempt: CreatorDependencyAttempt) => void;

export function creatorDependencyError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/[\r\n\t]+/g, " ").slice(0, 500);
}