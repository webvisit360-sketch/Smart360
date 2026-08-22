export function calculatePinchZoom(
  currentScale: number,
  currentX: number,
  currentY: number,
  startDistance: number,
  currentDistance: number,
  startScale: number,
  center: { x: number; y: number },
  minScale = 1,
  maxScale = 5
) {
  let scale = startScale * (currentDistance / startDistance);
  scale = Math.max(minScale, Math.min(maxScale, scale));
  return { scale };
}

export function clampPan(
  x: number, 
  y: number, 
  scale: number, 
  containerW: number, 
  containerH: number, 
  contentW: number, 
  contentH: number
) {
  const scaledW = contentW * scale;
  const scaledH = contentH * scale;

  const maxX = scaledW > containerW ? (scaledW - containerW) / 2 : 0;
  const maxY = scaledH > containerH ? (scaledH - containerH) / 2 : 0;

  return {
    x: Math.min(Math.max(x, -maxX), maxX),
    y: Math.min(Math.max(y, -maxY), maxY)
  };
}