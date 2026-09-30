import type { StyleSpecification } from "maplibre-gl";

/** Local drawing surface only: no alternate provider, tile URLs or prefetch. */
export const OFFLINE_ROUTE_STYLE: StyleSpecification = {
  version: 8,
  sources: {},
  layers: [{
    id: "offline-background",
    type: "background",
    paint: { "background-color": "#F4F6F2" },
  }],
};

export function createInitialRouteStyleFallback(map: {
  getStyle: () => StyleSpecification | undefined;
  setStyle: (style: StyleSpecification, options: { diff: boolean }) => unknown;
}) {
  let applied = false;
  return () => {
    // A parsed style is usable even while its tiles/sprites are still loading
    // or failing. Keep it, including all geography available from the cache.
    if (applied || map.getStyle()) return false;
    applied = true;
    map.setStyle(OFFLINE_ROUTE_STYLE, { diff: false });
    return true;
  };
}