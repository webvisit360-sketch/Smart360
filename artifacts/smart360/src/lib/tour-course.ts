/** Camera preference belongs to one recording, never to the route or the next recording. */
export type CourseMode = "course" | "north";
export function courseIdentity(key: string, startedAt: number | null | undefined, active: boolean): string | null {
  return active && startedAt != null && Number.isFinite(startedAt) ? `${key}:${startedAt}` : null;
}
export function sessionCourseMode(identity: string | null, savedIdentity: string | null, savedMode: CourseMode): CourseMode {
  return identity && identity === savedIdentity ? savedMode : identity ? "course" : "north";
}
export function nextCourseBearing(previous: number, heading: number | null | undefined, speed: number | null | undefined, moving: boolean, mode: CourseMode): number {
  if (!moving || mode !== "course" || typeof heading !== "number" || !Number.isFinite(heading) ||
      heading < 0 || heading > 360 || typeof speed !== "number" || !Number.isFinite(speed) || speed <= 1) return previous;
  return heading === 360 ? 0 : heading;
}
/** Unwrap the target around the current angle before asking MapLibre to animate. */
export function shortestBearing(current: number, target: number): number {
  return current + (((target - current + 540) % 360 + 360) % 360 - 180);
}