import { useEffect, useRef, useState } from "react";
import type { Map as MapLibreMap, Marker as MapLibreMarker } from "maplibre-gl";
import mapWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import {
  OPENFREEMAP_ATTRIBUTION_LINKS,
  OPENFREEMAP_STYLE_URL,
} from "@/lib/map-provider";

type Coordinates = { latitude: number; longitude: number };

export function OpenFreeMap({
  latitude,
  longitude,
  zoom,
  onPlace,
  ariaLabel,
  className = "h-56 w-full",
}: Coordinates & {
  zoom: number;
  onPlace?: (latitude: number, longitude: number) => void;
  ariaLabel: string;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markerRef = useRef<MapLibreMarker | null>(null);
  const onPlaceRef = useRef(onPlace);
  const [loadError, setLoadError] = useState("");

  onPlaceRef.current = onPlace;

  useEffect(() => {
    let disposed = false;
    let resizeObserver: ResizeObserver | undefined;

    void import("maplibre-gl").then(({ Map, Marker, NavigationControl, setWorkerUrl }) => {
      if (disposed || !containerRef.current) return;

      // Bundle the worker explicitly: Vite's optimized module directory does not
      // contain MapLibre's sibling worker module.
      setWorkerUrl(mapWorkerUrl);
      const map = new Map({
        container: containerRef.current,
        style: OPENFREEMAP_STYLE_URL,
        center: [longitude, latitude],
        zoom,
        attributionControl: false,
      });
      const marker = new Marker({ color: "#157347", draggable: Boolean(onPlaceRef.current) })
        .setLngLat([longitude, latitude])
        .addTo(map);

      mapRef.current = map;
      markerRef.current = marker;
      map.addControl(new NavigationControl({ showCompass: false }), "top-left");
      map.on("load", () => setLoadError(""));
      map.on("error", (event) => {
        const reason = event.error?.message;
        setLoadError(reason
          ? `Zemljevida OpenFreeMap ni bilo mogoče naložiti: ${reason}`
          : "Zemljevida OpenFreeMap ni bilo mogoče naložiti.");
      });
      map.on("click", (event) => {
        if (!onPlaceRef.current) return;
        marker.setLngLat(event.lngLat);
        onPlaceRef.current(event.lngLat.lat, event.lngLat.lng);
      });
      marker.on("dragend", () => {
        const point = marker.getLngLat();
        onPlaceRef.current?.(point.lat, point.lng);
      });

      resizeObserver = new ResizeObserver(() => map.resize());
      resizeObserver.observe(containerRef.current);
    }).catch((error: unknown) => {
      if (disposed) return;
      const reason = error instanceof Error ? error.message : "";
      setLoadError(reason
        ? `Zemljevida OpenFreeMap ni bilo mogoče zagnati: ${reason}`
        : "Zemljevida OpenFreeMap ni bilo mogoče zagnati.");
    });

    return () => {
      disposed = true;
      resizeObserver?.disconnect();
      markerRef.current?.remove();
      markerRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const marker = markerRef.current;
    if (!map || !marker) return;
    marker.setLngLat([longitude, latitude]);
    map.setCenter([longitude, latitude]);
  }, [latitude, longitude]);

  return (
    <div className={`relative overflow-hidden bg-[#d9ddd5] ${className}`}>
      <div
        ref={containerRef}
        role="application"
        aria-label={ariaLabel}
        className="absolute inset-0"
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
        data-testid="openfreemap-map"
      />
      {loadError && (
        <div
          role="alert"
          className="absolute inset-x-3 top-3 z-10 rounded-lg border border-destructive/30 bg-white/95 p-3 text-xs font-semibold text-destructive shadow"
        >
          {loadError}
        </div>
      )}
      <div
        className="absolute bottom-0 right-0 z-10 flex flex-wrap justify-end gap-x-1 bg-white/95 px-1.5 py-1 text-[10px] font-semibold text-slate-700"
        aria-label="Viri zemljevida"
      >
        {OPENFREEMAP_ATTRIBUTION_LINKS.map((link) => (
          <a
            key={link.href}
            href={link.href}
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-2"
          >
            {link.label}
          </a>
        ))}
      </div>
    </div>
  );
}