import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { Map as MapLibreMap, Marker as MapLibreMarker } from "maplibre-gl";
import mapWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import { Area, AreaChart, CartesianGrid, ReferenceDot, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { OPENFREEMAP_ATTRIBUTION_LINKS, OPENFREEMAP_STYLE_URL } from "@/lib/map-provider";
import { boundedProfile, boundedSegments, gpxDownloadUrl, type GpxRoute } from "@/lib/gpx-route";
import { elevationAtDistance, OFF_ROUTE_M, projectRoutePosition } from "@/lib/gpx-projection";
import { MAX_ACCURACY_M } from "@/lib/live-tour";
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

function RouteMap({ route, t, tourPoints, tourSegmentStarts, tourActive, currentPosition, onPositionChange, fullscreen, onExitFullscreen, overlay, profileStrip }: {
  route: GpxRoute;
  t: UiTranslator;
  /** On-device recorded positions (never sent to the server). */
  tourPoints?: TourPoint[];
  /** Indices where a new recorded segment begins (resume / reload / GPS gap). */
  tourSegmentStarts?: number[];
  /** While a tour is live, the tour hook owns geolocation; the ordinary locate watch is off. */
  tourActive?: boolean;
  currentPosition?: TourPoint | null;
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
  const segments = useMemo(() => boundedSegments(route), [route]);

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
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [fullscreen, onExitFullscreen]);

  useEffect(() => {
    let disposed = false;
    let observer: ResizeObserver | undefined;
    const markers: MapLibreMarker[] = [];
    const all = segments.flat();
    if (!all.length || !mapEl) return;
    void import("maplibre-gl").then(({ Map, Marker, LngLatBounds, setWorkerUrl }) => {
      if (disposed) return;
      setWorkerUrl(mapWorkerUrl);
      const bounds = all.reduce((b, p) => b.extend(p), new LngLatBounds(all[0]!, all[0]!));
      const map = new Map({
        container: mapEl,
        style: OPENFREEMAP_STYLE_URL,
        bounds,
        fitBoundsOptions: { padding: 28, maxZoom: 16 },
        attributionControl: false,
        cooperativeGestures: true,
      });
      mapRef.current = map;
      map.on("load", () => {
        setLoadError("");
        // The container may have been sized after construction (sheet
        // animation), so refit once the style is ready.
        map.resize();
        map.fitBounds(bounds, { padding: { top: 56, right: 28, bottom: 28, left: 28 }, maxZoom: 16, duration: 0 });
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
      const first = segments[0]![0]!;
      const lastSeg = segments[segments.length - 1]!;
      const last = lastSeg[lastSeg.length - 1]!;
      markers.push(new Marker({ element: markerEl("start", t("UI.lg.gpx.start")) }).setLngLat(first).addTo(map));
      markers.push(new Marker({ element: markerEl("end", t("UI.lg.gpx.end")) }).setLngLat(last).addTo(map));
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
  }, [segments, mapEl]);

  // Draw the recorded path + tour position marker from tour positions.
  const points = tourPoints ?? [];
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded) return;
    const coords = tourSegments(points, tourSegmentStarts);
    const src = map.getSource("tour") as { setData?: (d: unknown) => void } | undefined;
    src?.setData?.({ type: "Feature", properties: {}, geometry: { type: "MultiLineString", coordinates: coords } });
    if (!tourActive || !currentPosition) { tourMeRef.current?.remove(); tourMeRef.current = null; return; }
    const lngLat: [number, number] = [currentPosition.lon, currentPosition.lat];
    if (tourMeRef.current) { tourMeRef.current.setLngLat(lngLat); return; }
    void import("maplibre-gl").then(({ Marker }) => {
      if (!mapRef.current || tourMeRef.current) return;
      tourMeRef.current = new Marker({ element: markerEl("me", t("UI.lg.gpx.you")) }).setLngLat(lngLat).addTo(mapRef.current);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points.length, currentPosition?.lat, currentPosition?.lon, tourSegmentStarts?.join(","), tourActive, loaded]);

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

  if (!segments.length) return null;

  const attrib = (
    <div className="s360-gpx-attrib">
      {OPENFREEMAP_ATTRIBUTION_LINKS.map((link) => (
        <a key={link.href} href={link.href} target="_blank" rel="noreferrer">{link.label}</a>
      ))}
    </div>
  );

  return (
    <>
      <div className="s360-gpx-map-wrap">
        <div ref={inlineSlotRef} className="s360-gpx-slot" />
        {!tourActive && !fullscreen && (
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
          <div className="s360-tour-toolbar">
          {overlay}
          <button type="button" className="s360-gpx-full-exit" onClick={onExitFullscreen} data-testid="button-tour-exit-fullscreen">
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
