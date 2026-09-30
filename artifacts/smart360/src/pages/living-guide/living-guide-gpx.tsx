import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { Map as MapLibreMap, Marker as MapLibreMarker } from "maplibre-gl";
import mapWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import { Area, AreaChart, CartesianGrid, ReferenceDot, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { OPENFREEMAP_ATTRIBUTION_LINKS, OPENFREEMAP_STYLE_URL } from "@/lib/map-provider";
import { boundedProfile, boundedSegments, gpxDownloadUrl, type GpxRoute } from "@/lib/gpx-route";
import { elevationAtDistance, OFF_ROUTE_M, projectRoutePosition } from "@/lib/gpx-projection";
import { MAX_ACCURACY_M } from "@/lib/live-tour";
import { courseIdentity, nextCourseBearing, sessionCourseMode, shortestBearing, type CourseMode } from "@/lib/tour-course";
import { recordedProfileData, type RecordedProfilePoint } from "./living-guide-free-tour-view";
import type { UiTranslator } from "../guest/i18n";
import { useLiveTour } from "@/hooks/use-live-tour";
import { downloadTourGpx, downloadTourImage } from "@/lib/live-tour-export";
import { LiveTourOverlay, LiveTourPanel, formatTourDistance, formatTourDuration, tourSegments } from "./living-guide-live-tour";
import "./living-guide-gpx.css";

const ROUTE_COLOR = "#157347";
/** Recorded path uses the existing CGP ink token, not a new colour. */
const RECORDED_COLOR = "#121A14";

function num(value: number, digits: number) {
  return value.toFixed(digits).replace(".", ",");
}

function markerEl(kind: "start" | "end" | "me", label: string) {
  const el = document.createElement("div");
  el.setAttribute("aria-label", label);
  el.setAttribute("role", "img");
  el.className = `s360-gpx-marker s360-gpx-marker--${kind}`;
  if (kind !== "me") el.textContent = kind === "start" ? "S" : "C";
  return el;
}

type TourPoint = { lat: number; lon: number };

export function RouteMap({ route, t, freeMode = false, fallbackCenter, tourPoints, tourSegmentStarts, tourActive, tourStatus, tourKey, tourStartedAt, currentPosition, onPositionChange, fullscreen, onExitFullscreen, overlay, profileStrip }: {
  route?: GpxRoute | null;
  t: UiTranslator;
  /** Free recording: no planned GPX; map follows recorded geometry. */
  freeMode?: boolean;
  /** [lon, lat] used before the first fix in free mode. */
  fallbackCenter?: [number, number] | null;
  /** On-device recorded positions (never sent to the server). */
  tourPoints?: TourPoint[];
  /** Indices where a new recorded segment begins (resume / reload / GPS gap). */
  tourSegmentStarts?: number[];
  /** While a tour is live, the tour hook owns geolocation; the ordinary locate watch is off. */
  tourActive?: boolean;
  tourStatus?: "moving" | "auto-paused" | "manual-paused" | "finished" | null;
  tourKey?: string;
  tourStartedAt?: number | null;
  currentPosition?: TourPoint & { heading?: number | null; speed?: number | null } | null;
  onPositionChange: (position: TourPoint | null) => void;
  fullscreen?: boolean;
  onExitFullscreen?: () => void;
  overlay?: ReactNode;
  profileStrip?: ReactNode;
}) {
  // The MapLibre container is a detached element moved between the inline slot
  // and the body-level fullscreen slot, so the same map instance (and tiles)
  // survives the switch and escapes transformed/clipping sheet ancestors.
  const [mapEl] = useState(() => (typeof document === "undefined" ? null : document.createElement("div")));
  const inlineSlotRef = useRef<HTMLDivElement>(null);
  const fullSlotRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const meRef = useRef<MapLibreMarker | null>(null);
  const tourMeRef = useRef<MapLibreMarker | null>(null);
  const watchRef = useRef<number | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState("");
  const segments = useMemo(() => (route ? boundedSegments(route) : []), [route]);
  const exitRef = useRef<HTMLButtonElement>(null);
  const centerRef = useRef(fallbackCenter);
  const identity = courseIdentity(tourKey ?? "", tourStartedAt, !!tourActive);
  const [preference, setPreference] = useState<{ identity: string | null; mode: CourseMode }>(() => {
    let stored: string | null = null;
    try { stored = window.localStorage.getItem("s360:tour-camera"); } catch { /* storage may be disabled */ }
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as { identity?: string; mode?: string };
        if (parsed.identity === identity && (parsed.mode === "north" || parsed.mode === "course"))
          return { identity, mode: parsed.mode };
      } catch { /* ignore stale storage */ }
    }
    return { identity, mode: identity ? "course" : "north" };
  });
  const mode = sessionCourseMode(identity, preference.identity, preference.mode);
  const [mapBearing, setMapBearing] = useState(0);
  const lastCourseBearing = useRef(0);
  const setCameraMode = (next: CourseMode) => {
    if (!identity) return;
    setPreference({ identity, mode: next });
    try { window.localStorage.setItem("s360:tour-camera", JSON.stringify({ identity, mode: next })); } catch { /* memory still works */ }
    if (next === "north") {
      mapRef.current?.easeTo({ bearing: shortestBearing(mapRef.current.getBearing(), 0), duration: 300 });
    }
  };

  useLayoutEffect(() => {
    if (!mapEl) return;
    mapEl.className = "s360-gpx-map";
    mapEl.setAttribute("role", "application");
    mapEl.setAttribute("aria-label", t("UI.lg.gpx.mapLabel"));
    mapEl.setAttribute("data-testid", "map-gpx");
    const slot = fullscreen ? fullSlotRef.current : inlineSlotRef.current;
    if (slot && mapEl.parentElement !== slot) slot.appendChild(mapEl);
    mapRef.current?.resize();
  }, [mapEl, fullscreen, t]);

  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onExitFullscreen?.(); };
    const prev = document.body.style.overflow;
    const opener = document.activeElement as HTMLElement | null;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    requestAnimationFrame(() => exitRef.current?.focus());
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prev; if (opener?.isConnected) opener.focus(); };
  }, [fullscreen, onExitFullscreen]);

  useEffect(() => {
    let disposed = false;
    let observer: ResizeObserver | undefined;
    const markers: MapLibreMarker[] = [];
    const all = segments.flat();
    if (!mapEl || (!all.length && !freeMode)) return;
    void import("maplibre-gl").then(({ Map, Marker, LngLatBounds, setWorkerUrl }) => {
      if (disposed) return;
      setWorkerUrl(mapWorkerUrl);
      const bounds = all.length ? all.reduce((b, p) => b.extend(p), new LngLatBounds(all[0]!, all[0]!)) : null;
      const map = new Map({
        container: mapEl,
        style: OPENFREEMAP_STYLE_URL,
        ...(bounds
          ? { bounds, fitBoundsOptions: { padding: 28, maxZoom: 16 } }
          : { center: centerRef.current ?? [14.5058, 46.0569], zoom: centerRef.current ? 13 : 7 }),
        attributionControl: false,
        cooperativeGestures: true,
      });
      mapRef.current = map;
      map.on("rotate", () => {
        setMapBearing(map.getBearing());
        if (import.meta.env.DEV) mapEl.dataset.cameraBearing = String(map.getBearing());
      });
      if (import.meta.env.DEV) map.on("move", () => {
        const center = map.getCenter();
        mapEl.dataset.cameraCenter = JSON.stringify([center.lng, center.lat]);
        mapEl.dataset.cameraZoom = String(map.getZoom());
      });
      map.on("load", () => {
        setLoadError("");
        // The container may have been sized after construction (sheet
        // animation), so refit once the style is ready.
        map.resize();
        if (bounds) map.fitBounds(bounds, { padding: { top: 56, right: 28, bottom: 28, left: 28 }, maxZoom: 16, duration: 0 });
        map.addSource("gpx", {
          type: "geojson",
          data: { type: "Feature", properties: {}, geometry: { type: "MultiLineString", coordinates: segments } },
        });
        map.addLayer({ id: "gpx-casing", type: "line", source: "gpx", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#FFFFFF", "line-width": 7 } });
        map.addLayer({ id: "gpx-line", type: "line", source: "gpx", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": ROUTE_COLOR, "line-width": 4 } });
        // Recorded tour path (on-device only), drawn over the planned track.
        map.addSource("tour", { type: "geojson", data: { type: "Feature", properties: {}, geometry: { type: "MultiLineString", coordinates: [] } } });
        map.addLayer({ id: "tour-casing", type: "line", source: "tour", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#FFFFFF", "line-width": 6 } });
        map.addLayer({ id: "tour-line", type: "line", source: "tour", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": RECORDED_COLOR, "line-width": 3, "line-dasharray": [2, 1.4] } });
        setLoaded(true);
      });
      map.on("error", (event) => {
        // Surface the real root cause in the console; keep guest text localized.
        console.error("[gpx-map]", event.error ?? event);
        setLoadError(t("UI.lg.gpx.mapError"));
      });
      if (segments.length) {
        const first = segments[0]![0]!;
        const lastSeg = segments[segments.length - 1]!;
        const last = lastSeg[lastSeg.length - 1]!;
        markers.push(new Marker({ element: markerEl("start", t("UI.lg.gpx.start")) }).setLngLat(first).addTo(map));
        markers.push(new Marker({ element: markerEl("end", t("UI.lg.gpx.end")) }).setLngLat(last).addTo(map));
      }
      observer = new ResizeObserver(() => map.resize());
      observer.observe(mapEl);
    }).catch((error: unknown) => {
      console.error("[gpx-map] init failed", error);
      if (!disposed) setLoadError(t("UI.lg.gpx.mapError"));
    });
    return () => {
      disposed = true;
      setLoaded(false);
      observer?.disconnect();
      markers.forEach((m) => m.remove());
      meRef.current?.remove();
      meRef.current = null;
      tourMeRef.current?.remove();
      tourMeRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [segments, mapEl, freeMode]);

  // Draw the recorded path + tour position marker from tour positions.
  const points = tourPoints ?? [];
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded) return;
    const coords = tourSegments(points, tourSegmentStarts);
    const src = map.getSource("tour") as { setData?: (d: unknown) => void } | undefined;
    src?.setData?.({ type: "Feature", properties: {}, geometry: { type: "MultiLineString", coordinates: coords } });
    if (freeMode && !(tourActive && mode === "course")) followRecorded(map, coords, tourActive ? currentPosition ?? null : null);
    if (!tourActive || !currentPosition) { tourMeRef.current?.remove(); tourMeRef.current = null; return; }
    const lngLat: [number, number] = [currentPosition.lon, currentPosition.lat];
    if (tourMeRef.current) {
      tourMeRef.current.setLngLat(lngLat);
      tourMeRef.current.getElement().classList.toggle("s360-gpx-marker--course", mode === "course");
      return;
    }
    void import("maplibre-gl").then(({ Marker }) => {
      if (!mapRef.current || tourMeRef.current) return;
      const el = markerEl("me", t("UI.lg.gpx.you"));
      el.classList.toggle("s360-gpx-marker--course", mode === "course");
      tourMeRef.current = new Marker({ element: el, rotationAlignment: "viewport" }).setLngLat(lngLat).addTo(mapRef.current);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points.length, currentPosition?.lat, currentPosition?.lon, tourSegmentStarts?.join(","), tourActive, loaded, mode]);

  // The live tour's single GPS watch supplies course and position. Never derive
  // direction from the route or recorded track; invalid/slow fixes retain bearing.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded || !identity || !currentPosition || mode !== "course") return;
    const bearing = nextCourseBearing(lastCourseBearing.current, currentPosition.heading, currentPosition.speed, tourStatus === "moving", mode);
    lastCourseBearing.current = bearing;
    map.easeTo({
      center: [currentPosition.lon, currentPosition.lat],
      bearing: shortestBearing(map.getBearing(), bearing),
      offset: [0, Math.round(map.getContainer().clientHeight * 0.16)],
      zoom: Math.max(map.getZoom(), 15),
      duration: 300,
    });
  }, [loaded, identity, mode, tourStatus, currentPosition]);

  useEffect(() => {
    lastCourseBearing.current = 0;
    if (!identity) mapRef.current?.jumpTo({ bearing: 0 });
  }, [identity]);

  // Free mode: refit only when the path/position leaves the visible area (or
  // on the first fix / after finishing) — never on every fix, never recreate.
  const fittedRef = useRef<"none" | "live" | "final">("none");
  const followRecorded = (map: MapLibreMap, coords: number[][][], pos: TourPoint | null) => {
    const flat = coords.flat();
    if (pos) flat.push([pos.lon, pos.lat]);
    if (!flat.length) { fittedRef.current = "none"; return; }
    let w = Infinity, s = Infinity, e = -Infinity, n = -Infinity;
    for (const [lon, lat] of flat) { w = Math.min(w, lon!); e = Math.max(e, lon!); s = Math.min(s, lat!); n = Math.max(n, lat!); }
    const view = map.getBounds();
    const inside = view.contains([w, s]) && view.contains([e, n]);
    const phase = tourActive ? "live" : "final";
    if (inside && fittedRef.current === phase) return;
    fittedRef.current = phase;
    if (w === e && s === n) map.jumpTo({ center: [w, s], zoom: Math.max(map.getZoom(), 15) });
    else map.fitBounds([[w, s], [e, n]], { padding: { top: 64, right: 36, bottom: 44, left: 36 }, maxZoom: 16, duration: tourActive ? 400 : 0 });
  };

  const stopWatch = () => {
    if (watchRef.current !== null) navigator.geolocation?.clearWatch(watchRef.current);
    watchRef.current = null;
    meRef.current?.remove();
    meRef.current = null;
    setLocating(false);
    onPositionChange(null);
  };

  useEffect(() => () => {
    if (watchRef.current !== null) navigator.geolocation?.clearWatch(watchRef.current);
    watchRef.current = null;
  }, []);

  // Avoid a parallel watch: the tour hook owns geolocation while a tour is live.
  useEffect(() => {
    if (tourActive) { stopWatch(); setGeoError(""); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tourActive]);

  const toggleLocation = () => {
    setGeoError("");
    if (locating) { stopWatch(); return; }
    if (!("geolocation" in navigator)) { setGeoError(t("UI.lg.gpx.geo.unsupported")); return; }
    setLocating(true);
    watchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const map = mapRef.current;
        if (!map) return;
        if (!Number.isFinite(pos.coords.accuracy) || pos.coords.accuracy < 0 ||
            pos.coords.accuracy > MAX_ACCURACY_M ||
            !Number.isFinite(pos.coords.latitude) || !Number.isFinite(pos.coords.longitude) ||
            Math.abs(pos.coords.latitude) > 90 || Math.abs(pos.coords.longitude) > 180) return;
        const lngLat: [number, number] = [pos.coords.longitude, pos.coords.latitude];
        onPositionChange({ lat: pos.coords.latitude, lon: pos.coords.longitude });
        if (!meRef.current) {
          void import("maplibre-gl").then(({ Marker }) => {
            if (!mapRef.current || watchRef.current === null) return;
            meRef.current = new Marker({ element: markerEl("me", t("UI.lg.gpx.you")) }).setLngLat(lngLat).addTo(mapRef.current);
          });
        } else {
          meRef.current.setLngLat(lngLat);
        }
      },
      (err) => {
        stopWatch();
        setGeoError(t(err.code === 1 ? "UI.lg.gpx.geo.denied" : err.code === 3 ? "UI.lg.gpx.geo.timeout" : "UI.lg.gpx.geo.unavailable"));
      },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 },
    );
  };

  if (!segments.length && !freeMode) return null;

  const attrib = (
    <div className="s360-gpx-attrib">
      {OPENFREEMAP_ATTRIBUTION_LINKS.map((link) => (
        <a key={link.href} href={link.href} target="_blank" rel="noreferrer">{link.label}</a>
      ))}
    </div>
  );
  const cameraControls = identity && (
    <div className="s360-gpx-camera-controls">
      <button type="button" className="s360-gpx-camera-toggle" aria-pressed={mode === "course"} data-testid="button-tour-course-toggle"
        onClick={() => setCameraMode(mode === "course" ? "north" : "course")}>
        {t(mode === "course" ? "UI.lg.gpx.northUp" : "UI.lg.gpx.courseUp")}
      </button>
      {Math.abs(mapBearing) > 0.5 && (
        <button type="button" className="s360-gpx-compass" aria-label={t("UI.lg.gpx.northUp")} data-testid="button-tour-compass"
          onClick={() => setCameraMode("north")}>
          <span style={{ transform: `rotate(${-mapBearing}deg)` }} aria-hidden="true">▲</span>N
        </button>
      )}
    </div>
  );

  return (
    <>
      <div className="s360-gpx-map-wrap">
        <div ref={inlineSlotRef} className="s360-gpx-slot" />
        {!fullscreen && cameraControls}
        {!tourActive && !fullscreen && !freeMode && (
          <button type="button" className={`s360-gpx-locate${locating ? " is-on" : ""}`} aria-pressed={locating} onClick={toggleLocation} data-testid="button-gpx-locate">
            <span className="s360-gpx-locate-dot" aria-hidden="true" />
            {locating ? t("UI.lg.gpx.hideLocation") : t("UI.lg.gpx.showLocation")}
          </button>
        )}
        {loadError && <div role="alert" className="s360-gpx-alert">{loadError}</div>}
        {geoError && <div role="alert" className="s360-gpx-alert s360-gpx-alert--bottom">{geoError}</div>}
        {!fullscreen && attrib}
      </div>
      {fullscreen && typeof document !== "undefined" && createPortal(
        <div className="s360-gpx-full" data-s360-tour-portal="" role="dialog" aria-modal="true" aria-label={t("UI.lg.liveTour.fullscreen")} data-testid="dialog-tour-fullscreen">
          <div ref={fullSlotRef} className="s360-gpx-slot" />
          {cameraControls}
          <div className="s360-tour-toolbar">
          {overlay}
          <button ref={exitRef} type="button" className="s360-gpx-full-exit" onClick={onExitFullscreen} data-testid="button-tour-exit-fullscreen">
            {t("UI.lg.liveTour.exitFullscreen")}
          </button>
          </div>
          {profileStrip}
          {attrib}
        </div>,
        document.body,
      )}
    </>
  );
}

function ElevationProfile({ route, t, projection, compact = false }: { route: GpxRoute; t: UiTranslator; projection: ReturnType<typeof projectRoutePosition>; compact?: boolean }) {
  const data = useMemo(() => boundedProfile(route), [route]);
  const withElevation = data.filter((p) => p.elevationM != null).length;
  const segmentCount = new Set((route.profile || []).map((p) => p.segment)).size;
  const missing = data.length - withElevation - Math.max(0, segmentCount - 1);
  const offRoute = projection !== null && projection.perpendicularM > OFF_ROUTE_M;
  // Interpolate from the exact sampled series displayed below, not from omitted
  // server profile points: the dot must sit on the actual rendered linear stroke.
  const elevation = projection && !offRoute ? elevationAtDistance(data, projection.segment, projection.distanceKm) : null;
  const remaining = projection && !offRoute ? Math.max(0, (route.profile?.at(-1)?.distanceKm ?? 0) - projection.distanceKm) : null;
  if (!data.length || withElevation === 0) {
    return compact ? null : <p className="s360-gpx-note">{t("UI.lg.gpx.noElevation")}</p>;
  }
  return (
    <figure className={`s360-gpx-profile${compact ? " s360-gpx-profile--compact" : ""}`} data-testid={compact ? "profile-fullscreen" : "profile-normal"}>
      <figcaption>{t("UI.lg.gpx.profile")}
        {offRoute ? <strong data-testid="profile-offroute">{t("UI.lg.gpx.offRoute")}</strong> :
          remaining !== null && <strong data-testid="profile-remaining">{t("UI.lg.gpx.remaining", { distance: num(remaining, 1) })}</strong>}
      </figcaption>
      <div style={{ width: "100%", height: compact ? 84 : 150 }}>
        <ResponsiveContainer>
          <AreaChart data={data} margin={{ top: 8, right: 8, bottom: compact ? 0 : 14, left: 0 }}>
            <CartesianGrid stroke="var(--line)" vertical={false} />
            <XAxis
              dataKey="distanceKm" type="number" domain={[0, "dataMax"]}
              hide={compact}
              tickFormatter={(v: number) => num(v, v < 10 ? 1 : 0)}
              tick={{ fontSize: 10, fill: "var(--tx2)" }} stroke="var(--line)"
              label={{ value: t("UI.lg.gpx.axisDistance"), position: "insideBottom", offset: -8, fontSize: 10, fill: "var(--tx2)" }}
            />
            <YAxis
              dataKey="elevationM" type="number" domain={["dataMin - 20", "dataMax + 20"]} width={44}
              hide={compact}
              tickFormatter={(v: number) => `${Math.round(v)}`}
              tick={{ fontSize: 10, fill: "var(--tx2)" }} stroke="var(--line)"
              label={{ value: t("UI.lg.gpx.axisElevation"), angle: -90, position: "insideLeft", offset: 14, fontSize: 10, fill: "var(--tx2)" }}
            />
            <Tooltip
              formatter={(v: unknown) => (typeof v !== "number" ? t("UI.lg.gpx.unavailable") : `${Math.round(v)} m`)}
              labelFormatter={(v: unknown) => `${num(Number(v), 2)} km`}
              contentStyle={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 10, fontSize: 12 }}
            />
            <Area type="linear" dataKey="elevationM" stroke={ROUTE_COLOR} strokeWidth={2} fill={ROUTE_COLOR} fillOpacity={0.14} connectNulls={false} isAnimationActive={false} />
            {projection && !offRoute && elevation !== null &&
              <ReferenceLine x={projection.distanceKm} stroke={ROUTE_COLOR} strokeWidth={1} strokeOpacity={0.65} ifOverflow="hidden" />}
            {projection && !offRoute && elevation !== null &&
              <ReferenceDot x={projection.distanceKm} y={elevation} r={5} fill={ROUTE_COLOR} stroke="#FFFFFF" strokeWidth={2} ifOverflow="hidden" isFront />}
          </AreaChart>
        </ResponsiveContainer>
      </div>
      {!compact && missing > 0 && <p className="s360-gpx-note">{t("UI.lg.gpx.partialElevation")}</p>}
    </figure>
  );
}

/** Live profile of the recorded path so far (same visual language as ElevationProfile). */
export function RecordedElevationProfile({ points, segmentStarts, t, compact = false }: { points: RecordedProfilePoint[]; segmentStarts?: number[]; t: UiTranslator; compact?: boolean }) {
  const data = useMemo(() => recordedProfileData(points, segmentStarts), [points, segmentStarts]);
  const withElevation = data.filter((p) => p.elevationM != null).length;
  if (withElevation < 2) {
    return compact ? null : <p className="s360-gpx-note" data-testid="text-free-profile-empty">{t("UI.lg.freeTour.profileWaiting")}</p>;
  }
  const last = data[data.length - 1]!;
  return (
    <figure className={`s360-gpx-profile${compact ? " s360-gpx-profile--compact" : ""}`} data-testid={compact ? "profile-free-fullscreen" : "profile-free-normal"}>
      <figcaption>{t("UI.lg.gpx.profile")} <strong>{t("UI.lg.freeTour.gpsApprox")}</strong></figcaption>
      <div style={{ width: "100%", height: compact ? 84 : 120 }}>
        <ResponsiveContainer>
          <AreaChart data={data} margin={{ top: 8, right: 8, bottom: compact ? 0 : 14, left: 0 }}>
            <CartesianGrid stroke="var(--line)" vertical={false} />
            <XAxis dataKey="distanceKm" type="number" domain={[0, "dataMax"]} hide={compact}
              tickFormatter={(v: number) => num(v, v < 10 ? 1 : 0)} tick={{ fontSize: 10, fill: "var(--tx2)" }} stroke="var(--line)" />
            <YAxis dataKey="elevationM" type="number" domain={["dataMin - 10", "dataMax + 10"]} width={40} hide={compact}
              tickFormatter={(v: number) => `${Math.round(v)}`} tick={{ fontSize: 10, fill: "var(--tx2)" }} stroke="var(--line)" />
            <Area type="linear" dataKey="elevationM" stroke={ROUTE_COLOR} strokeWidth={2} fill={ROUTE_COLOR} fillOpacity={0.14} connectNulls={false} isAnimationActive={false} />
            {last.elevationM != null && <ReferenceDot x={last.distanceKm} y={last.elevationM} r={5} fill={ROUTE_COLOR} stroke="#FFFFFF" strokeWidth={2} ifOverflow="hidden" isFront />}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}

export function LivingGuideGpxRoute(props: { route: GpxRoute | null | undefined; slug: string; itemId: string; t: UiTranslator; variant?: "lg" | "legacy"; heading?: string }) {
  if (!props.route || !props.route.fileId) return null;
  return <GpxRouteBody {...props} route={props.route} />;
}

function GpxRouteBody({ route, slug, itemId, t, variant = "lg", heading }: { route: GpxRoute; slug: string; itemId: string; t: UiTranslator; variant?: "lg" | "legacy"; heading?: string }) {
  const lg = variant === "lg";
  // All tour data is on-device only (memory + localStorage inside the hook).
  const tour = useLiveTour(`${slug}/${itemId}`);
  const [ordinaryPosition, setOrdinaryPosition] = useState<TourPoint | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [exporting, setExporting] = useState<"image" | "gpx" | null>(null);
  const [exportError, setExportError] = useState(false);
  const plannedSegments = useMemo(() => boundedSegments(route), [route]);
  const position = tour.currentPosition ?? ordinaryPosition;
  const projection = useMemo(() => position ? projectRoutePosition(plannedSegments, route.profile, position) : null, [plannedSegments, route.profile, position]);
  const status = tour.state?.status ?? null;
  const tourActive = status !== null && status !== "finished";
  const exitFullscreen = useCallback(() => setFullscreen(false), []);
  useEffect(() => { if (!tourActive) setFullscreen(false); }, [tourActive]);
  const tourName = heading || route.filename?.replace(/\.gpx$/i, "") || t("UI.lg.gpx.title");

  const onDownloadGpx = () => {
    if (!tour.state) return;
    setExportError(false);
    setExporting("gpx");
    try { downloadTourGpx(tour.state, tourName); }
    catch (error) { console.error("[live-tour] gpx export failed", error); setExportError(true); }
    finally { setExporting(null); }
  };
  const onDownloadImage = async () => {
    if (!tour.state) return;
    setExportError(false);
    setExporting("image");
    const m = tour.metrics;
    try {
      await downloadTourImage(tour.state, m, plannedSegments, {
        title: t("UI.lg.liveTour.summaryTitle"),
        routeName: tourName,
        net: t("UI.lg.liveTour.net"),
        paused: t("UI.lg.liveTour.paused"),
        elapsed: t("UI.lg.liveTour.total"),
        distance: t("UI.lg.liveTour.distance"),
        planned: t("UI.lg.liveTour.planned"),
        recorded: t("UI.lg.liveTour.recorded"),
        schematic: t("UI.lg.liveTour.schematic"),
        netValue: formatTourDuration(m.movingMs),
        pausedValue: formatTourDuration(m.pausedMs),
        elapsedValue: formatTourDuration(m.elapsedMs),
        distanceValue: formatTourDistance(m.distanceM),
      });
    } catch (error) {
      console.error("[live-tour] image export failed", error);
      setExportError(true);
    } finally { setExporting(null); }
  };
  const onReset = () => { setExportError(false); tour.reset(); };

  const na = t("UI.lg.gpx.unavailable");
  const m = (v: number | null | undefined) => (v == null || !Number.isFinite(v) ? na : `${Math.round(v)} m`);
  const duration = route.durationMinutes == null || !Number.isFinite(route.durationMinutes)
    ? na
    : (() => { const total = Math.round(route.durationMinutes!); const h = Math.floor(total / 60); const min = total % 60; return h ? `${h} h ${min} min` : `${min} min`; })();
  const stats: Array<[string, string]> = [
    [t("UI.lg.gpx.length"), route.distanceKm == null || !Number.isFinite(route.distanceKm) ? na : `${num(route.distanceKm, 1)} km`],
    [t("UI.lg.gpx.ascent"), m(route.ascentM)],
    [t("UI.lg.gpx.descent"), m(route.descentM)],
    [t("UI.lg.gpx.minElevation"), m(route.minElevationM)],
    [t("UI.lg.gpx.maxElevation"), m(route.maxElevationM)],
    [t("UI.lg.gpx.estimatedTime"), duration],
  ];
  return (
    <section className={`s360-gpx${lg ? "" : " s360-gpx--legacy"}`} aria-label={t("UI.lg.gpx.title")} data-testid="lg-gpx-route">
      <div className="s360-gpx-head">
        <h2>{heading || t("UI.lg.gpx.title")}</h2>
        <span className={lg ? "lg2-chip" : "s360-gpx-chip"}>{t(route.activity === "cycling" ? "UI.lg.gpx.cycling" : "UI.lg.gpx.hiking")}</span>
      </div>
      <RouteMap
        route={route}
        t={t}
        tourPoints={tour.state?.points}
        tourSegmentStarts={tour.state?.segmentStarts}
        tourActive={tourActive}
        tourStatus={status}
        tourKey={`${slug}/${itemId}`}
        tourStartedAt={tour.state?.startedAt}
        currentPosition={tour.currentPosition}
        onPositionChange={setOrdinaryPosition}
        fullscreen={fullscreen}
        onExitFullscreen={exitFullscreen}
        overlay={status && status !== "finished" ? <LiveTourOverlay metrics={tour.metrics} status={status} t={t} wakeStatus={tour.wakeStatus} platform={tour.platform} /> : null}
        profileStrip={fullscreen && <ElevationProfile route={route} t={t} projection={projection} compact />}
      />
      <LiveTourPanel
        t={t}
        status={status}
        metrics={tour.metrics}
        pointCount={tour.state?.points.length ?? 0}
        wakeStatus={tour.wakeStatus}
        platform={tour.platform}
        geoError={tour.geoError}
        exporting={exporting}
        exportError={exportError}
        onStart={() => { setExportError(false); tour.start(); }}
        onPause={tour.pause}
        onResume={tour.resume}
        onFinish={tour.finish}
        onReset={onReset}
        onFullscreen={() => setFullscreen(true)}
        onDownloadImage={() => { void onDownloadImage(); }}
        onDownloadGpx={onDownloadGpx}
      />
      <dl className="s360-gpx-stats">
        {stats.map(([label, value]) => (
          <div key={label}><dt>{label}</dt><dd className={value === na ? "is-na" : undefined}>{value}</dd></div>
        ))}
      </dl>
      <ElevationProfile route={route} t={t} projection={projection} />
      <div className={lg ? "lg2-actions" : undefined}>
        <a className={lg ? "lg2-primary-button lg2-secondary-button" : "s360-gpx-download"} href={gpxDownloadUrl(slug, itemId, route.fileId)} download={route.filename || true}>
          {lg && <svg aria-hidden="true"><use href="#lg-i-doc" /></svg>}{t("UI.lg.action.gpx")}
        </a>
      </div>
    </section>
  );
}
