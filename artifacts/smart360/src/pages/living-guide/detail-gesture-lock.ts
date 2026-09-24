export type DetailGestureAxis = "horizontal" | "vertical";

export type DetailGestureLock = {
  startX: number;
  startY: number;
  axis: DetailGestureAxis | null;
};

// A tie belongs to the sheet. Once chosen, ownership never changes mid-gesture.
export function lockDetailGesture(
  gesture: DetailGestureLock,
  x: number,
  y: number,
  threshold = 6,
): DetailGestureAxis | null {
  if (gesture.axis) return gesture.axis;
  const dx = Math.abs(x - gesture.startX);
  const dy = Math.abs(y - gesture.startY);
  if (Math.max(dx, dy) < threshold) return null;
  gesture.axis = dx > dy ? "horizontal" : "vertical";
  return gesture.axis;
}