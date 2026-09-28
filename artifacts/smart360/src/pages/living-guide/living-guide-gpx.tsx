import { useEffect, useMemo, useRef, useState } from "react";
import type { Map as MapLibreMap, Marker as MapLibreMarker } from "maplibre-gl";
import mapWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { OPENFREEMAP_ATTRIBUTION_LINKS, OPENFREEMAP_STYLE_URL } from "@/lib/map-provider";
import { boundedProfile, boundedSegments, gpxDownloadUrl, type GpxRoute } from "@/lib/gpx-route";
import type { UiTranslator } from "../guest/i18n";
import "./living-guide-gpx.css";

const ROUTE_COLOR = "#157347";

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

function RouteMap({ route, t }: { route: GpxRoute; t: UiTranslator }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const meRef = useRef<MapLibreMarker | null>(null);
  const watchRef = useRef<number | null>(null);
  const [loadError, setLoadError] = useState("");
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState("");
  const segments = useMemo(() => boundedSegments(route), [route]);

  useEffect(() => {
    let disposed = false;
    let observer: ResizeObserver | undefined;
    const markers: MapLibreMarker[] = [];
    const all = segments.flat();
    if (!all.length) return;
    void import("maplibre-gl").then(({ Map, Marker, LngLatBounds, setWorkerUrl }) => {
      if (disposed || !containerRef.current) return;
      setWorkerUrl(mapWorkerUrl);
      const bounds = all.reduce((b, p) => b.extend(p), new LngLatBounds(all[0]!, all[0]!));
      const map = new Map({
        container: containerRef.current,
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
      observer.observe(containerRef.current);
    }).catch((error: unknown) => {
      console.error("[gpx-map] init failed", error);
      if (!disposed) setLoadError(t("UI.lg.gpx.mapError"));
    });
    return () => {
      disposed = true;
      observer?.disconnect();
      markers.forEach((m) => m.remove());
      meRef.current?.remove();
      meRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [segments]);

  const stopWatch = () => {
    if (watchRef.current !== null) navigator.geolocation?.clearWatch(watchRef.current);
    watchRef.current = null;
    meRef.current?.remove();
    meRef.current = null;
    setLocating(false);
  };

  useEffect(() => () => {
    if (watchRef.current !== null) navigator.geolocation?.clearWatch(watchRef.current);
    watchRef.current = null;
  }, []);

  const toggleLocation = () => {
    setGeoError("");
    if (locating) { stopWatch(); return; }
    if (!("geolocation" in navigator)) { setGeoError(t("UI.lg.gpx.geo.unsupported")); return; }
    setLocating(true);
    watchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const map = mapRef.current;
        if (!map) return;
        const lngLat: [number, number] = [pos.coords.longitude, pos.coords.latitude];
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

  return (
    <div className="s360-gpx-map-wrap">
      <div ref={containerRef} className="s360-gpx-map" role="application" aria-label={t("UI.lg.gpx.mapLabel")} />
      <button type="button" className={`s360-gpx-locate${locating ? " is-on" : ""}`} aria-pressed={locating} onClick={toggleLocation}>
        <span className="s360-gpx-locate-dot" aria-hidden="true" />
        {locating ? t("UI.lg.gpx.hideLocation") : t("UI.lg.gpx.showLocation")}
      </button>
      {loadError && <div role="alert" className="s360-gpx-alert">{loadError}</div>}
      {geoError && <div role="alert" className="s360-gpx-alert s360-gpx-alert--bottom">{geoError}</div>}
      <div className="s360-gpx-attrib">
        {OPENFREEMAP_ATTRIBUTION_LINKS.map((link) => (
          <a key={link.href} href={link.href} target="_blank" rel="noreferrer">{link.label}</a>
        ))}
      </div>
    </div>
  );
}

function ElevationProfile({ route, t }: { route: GpxRoute; t: UiTranslator }) {
  const data = useMemo(() => boundedProfile(route), [route]);
  const withElevation = data.filter((p) => p.elevationM != null).length;
  const segmentCount = new Set((route.profile || []).map((p) => p.segment)).size;
  const missing = data.length - withElevation - Math.max(0, segmentCount - 1);
  if (!data.length || withElevation === 0) {
    return <p className="s360-gpx-note">{t("UI.lg.gpx.noElevation")}</p>;
  }
  return (
    <figure className="s360-gpx-profile">
      <figcaption>{t("UI.lg.gpx.profile")}</figcaption>
      <div style={{ width: "100%", height: 150 }}>
        <ResponsiveContainer>
          <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 14, left: 0 }}>
            <CartesianGrid stroke="var(--line)" vertical={false} />
            <XAxis
              dataKey="distanceKm" type="number" domain={[0, "dataMax"]}
              tickFormatter={(v: number) => num(v, v < 10 ? 1 : 0)}
              tick={{ fontSize: 10, fill: "var(--tx2)" }} stroke="var(--line)"
              label={{ value: t("UI.lg.gpx.axisDistance"), position: "insideBottom", offset: -8, fontSize: 10, fill: "var(--tx2)" }}
            />
            <YAxis
              dataKey="elevationM" type="number" domain={["dataMin - 20", "dataMax + 20"]} width={44}
              tickFormatter={(v: number) => `${Math.round(v)}`}
              tick={{ fontSize: 10, fill: "var(--tx2)" }} stroke="var(--line)"
              label={{ value: t("UI.lg.gpx.axisElevation"), angle: -90, position: "insideLeft", offset: 14, fontSize: 10, fill: "var(--tx2)" }}
            />
            <Tooltip
              formatter={(v: unknown) => (typeof v !== "number" ? t("UI.lg.gpx.unavailable") : `${Math.round(v)} m`)}
              labelFormatter={(v: unknown) => `${num(Number(v), 2)} km`}
              contentStyle={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 10, fontSize: 12 }}
            />
            <Area type="monotone" dataKey="elevationM" stroke={ROUTE_COLOR} strokeWidth={2} fill={ROUTE_COLOR} fillOpacity={0.14} connectNulls={false} isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      {missing > 0 && <p className="s360-gpx-note">{t("UI.lg.gpx.partialElevation")}</p>}
    </figure>
  );
}

export function LivingGuideGpxRoute({ route, slug, itemId, t, variant = "lg", heading }: { route: GpxRoute | null | undefined; slug: string; itemId: string; t: UiTranslator; variant?: "lg" | "legacy"; heading?: string }) {
  const lg = variant === "lg";
  if (!route || !route.fileId) return null;
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
      <RouteMap route={route} t={t} />
      <dl className="s360-gpx-stats">
        {stats.map(([label, value]) => (
          <div key={label}><dt>{label}</dt><dd className={value === na ? "is-na" : undefined}>{value}</dd></div>
        ))}
      </dl>
      <ElevationProfile route={route} t={t} />
      <div className={lg ? "lg2-actions" : undefined}>
        <a className={lg ? "lg2-primary-button lg2-secondary-button" : "s360-gpx-download"} href={gpxDownloadUrl(slug, itemId, route.fileId)} download={route.filename || true}>
          {lg && <svg aria-hidden="true"><use href="#lg-i-doc" /></svg>}{t("UI.lg.action.gpx")}
        </a>
      </div>
    </section>
  );
}
