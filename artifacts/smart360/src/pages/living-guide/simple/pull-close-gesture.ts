export type PullAxis = "pending" | "down" | "native";

/** First decisive movement owns the gesture for its entire lifetime. */
export function pullAxis(axis: PullAxis, dx: number, dy: number, scrollTop: number): PullAxis {
  if (axis !== "pending" || Math.max(Math.abs(dx), Math.abs(dy)) < 8) return axis;
  return dy > 0 && dy > Math.abs(dx) * 1.5 && scrollTop <= 0 ? "down" : "native";
}
