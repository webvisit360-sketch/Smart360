/**
 * Live-tour presentational UI (guest GPX entry).
 *
 * PRIVACY: everything rendered here comes from on-device state owned by
 * `useLiveTour` (memory + localStorage). No position, time or result is ever
 * sent to the server by this UI.
 *
 * Kept free of the hook itself so it can be rendered statically in tests.
 */
// Explicit React import: node --test (tsx) uses the classic JSX runtime.
import React from "react";
import type { UiTranslator } from "../guest/i18n";

export type LiveTourStatus = "moving" | "auto-paused" | "manual-paused" | "finished";
export type LiveTourWake = "idle" | "requesting" | "held" | "unavailable";
export type LiveTourPlatform = "ios" | "android" | "other";
export type LiveTourMetrics = { movingMs: number; pausedMs: number; elapsedMs: number; distanceM: number };

export function formatTourDuration(ms: number) {
  const total = Math.max(0, Math.floor((Number.isFinite(ms) ? ms : 0) / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (v: number) => String(v).padStart(2, "0");
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

export function formatTourDistance(m: number) {
  const v = Number.isFinite(m) ? Math.max(0, m) : 0;
  return v < 1000 ? `${Math.round(v)} m` : `${(v / 1000).toFixed(2).replace(".", ",")} km`;
}

const STATUS_KEY: Record<LiveTourStatus, string> = {
  moving: "UI.lg.liveTour.status.moving",
  "auto-paused": "UI.lg.liveTour.status.autoPaused",
  "manual-paused": "UI.lg.liveTour.status.manualPaused",
  finished: "UI.lg.liveTour.status.finished",
};

/** Wake-lock indicator: muted line while held, platform instruction card when unavailable. */
export function LiveTourWakeNotice({ wakeStatus, platform, t }: { wakeStatus: LiveTourWake; platform: LiveTourPlatform; t: UiTranslator }) {
  if (wakeStatus === "held") return <p className="s360-tour-wake" data-testid="status-tour-wake-held">{t("UI.lg.liveTour.wake.held")}</p>;
  if (wakeStatus === "requesting") return <p className="s360-tour-wake" data-testid="status-tour-wake-requesting">{t("UI.lg.liveTour.wake.requesting")}</p>;
  if (wakeStatus !== "unavailable") return null;
  return (
    <div className="s360-tour-card" role="note" data-testid={`card-tour-wake-${platform}`}>
      <strong>{t("UI.lg.liveTour.wake.unavailableTitle")}</strong>
      <p>{t(`UI.lg.liveTour.wake.${platform}`)}</p>
    </div>
  );
}

export function LiveTourStats({ metrics, t, compact = false }: { metrics: LiveTourMetrics; t: UiTranslator; compact?: boolean }) {
  const rows: Array<[string, string, string]> = [
    ["net", t("UI.lg.liveTour.net"), formatTourDuration(metrics.movingMs)],
    ["paused", t("UI.lg.liveTour.paused"), formatTourDuration(metrics.pausedMs)],
    ["total", t("UI.lg.liveTour.total"), formatTourDuration(metrics.elapsedMs)],
    ["distance", t("UI.lg.liveTour.distance"), formatTourDistance(metrics.distanceM)],
  ];
  return (
    <dl className={`s360-tour-stats${compact ? " is-compact" : ""}`}>
      {rows.map(([id, label, value]) => (
        <div key={id} className={id === "net" ? "is-net" : undefined}>
          <dt>{label}</dt><dd data-testid={`text-tour-${id}`}>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Compact overlay pinned on the fullscreen map. */
export function LiveTourOverlay({ metrics, status, t, wakeStatus = "idle", platform = "other" }: { metrics: LiveTourMetrics; status: LiveTourStatus; t: UiTranslator; wakeStatus?: LiveTourWake; platform?: LiveTourPlatform }) {
  return (
    <div className="s360-tour-overlay" data-testid="overlay-tour-timer" aria-live="off">
      <span className="s360-tour-overlay-label">{t("UI.lg.liveTour.net")}</span>
      <span className="s360-tour-overlay-net" data-testid="text-tour-overlay-net">{formatTourDuration(metrics.movingMs)}</span>
      <span className="s360-tour-overlay-sub" data-testid="text-tour-overlay-paused">
        {t("UI.lg.liveTour.paused")} {formatTourDuration(metrics.pausedMs)} · {t(STATUS_KEY[status])}
      </span>
      <LiveTourWakeNotice wakeStatus={wakeStatus} platform={platform} t={t} />
    </div>
  );
}

/**
 * Split recorded points into [lon,lat] segments at `segmentStarts`, matching the
 * GPX/image export: manual resume, reload and GPS gaps are never bridged.
 */
export function tourSegments(points: Array<{ lat: number; lon: number }>, segmentStarts?: number[]): number[][][] {
  const starts = [...new Set([0, ...(segmentStarts ?? [])])].filter((i) => i >= 0 && i < points.length).sort((a, b) => a - b);
  const out: number[][][] = [];
  starts.forEach((s, i) => {
    const seg = points.slice(s, starts[i + 1] ?? points.length).map((p) => [p.lon, p.lat]);
    if (seg.length) out.push(seg);
  });
  return out;
}

/** Hook geoError codes → existing localized geo keys. Unknown codes fall back to "unavailable". */
const GEO_KEYS: Record<string, string> = {
  "geo-denied": "UI.lg.gpx.geo.denied",
  "geo-timeout": "UI.lg.gpx.geo.timeout",
  "geo-unavailable": "UI.lg.gpx.geo.unavailable",
  "geo-unsupported": "UI.lg.gpx.geo.unsupported",
};
export function tourGeoErrorKey(code: string) {
  return GEO_KEYS[code] ?? (code.startsWith("UI.") ? code : "UI.lg.gpx.geo.unavailable");
}

export type LiveTourPanelProps = {
  t: UiTranslator;
  status: LiveTourStatus | null;
  metrics: LiveTourMetrics;
  pointCount: number;
  wakeStatus: LiveTourWake;
  platform: LiveTourPlatform;
  geoError: string | null;
  exporting: "image" | "gpx" | null;
  exportError: boolean;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onFinish: () => void;
  onReset: () => void;
  onFullscreen: () => void;
  onDownloadImage: () => void;
  onDownloadGpx: () => void;
};

export function LiveTourPanel(p: LiveTourPanelProps) {
  const { t, status } = p;
  const geo = p.geoError ? <div role="alert" className="s360-tour-error" data-testid="status-tour-geo-error">{t(tourGeoErrorKey(p.geoError))}</div> : null;
  const privacy = <p className="s360-tour-fine" data-testid="text-tour-privacy">{t("UI.lg.liveTour.privacy")}</p>;

  if (!status) {
    return (
      <div className="s360-tour" data-testid="panel-tour-idle">
        <button type="button" className="s360-tour-btn s360-tour-btn--primary" onClick={p.onStart} data-testid="button-tour-start">
          <span className="s360-tour-play" aria-hidden="true" />{t("UI.lg.liveTour.start")}
        </button>
        {geo}
        {privacy}
      </div>
    );
  }

  if (status === "finished") {
    return (
      <div className="s360-tour s360-tour--result" data-testid="panel-tour-result">
        <h3>{t("UI.lg.liveTour.summaryTitle")}</h3>
        <LiveTourStats metrics={p.metrics} t={t} />
        <p className="s360-tour-legend">
          <span className="s360-tour-key s360-tour-key--planned" aria-hidden="true" />{t("UI.lg.liveTour.planned")}
          <span className="s360-tour-key s360-tour-key--recorded" aria-hidden="true" />{t("UI.lg.liveTour.recorded")}
        </p>
        <div className="s360-tour-row">
          <button type="button" className="s360-tour-btn s360-tour-btn--primary" disabled={p.exporting !== null} onClick={p.onDownloadImage} data-testid="button-tour-download-image">
            {p.exporting === "image" ? t("UI.lg.liveTour.exporting") : t("UI.lg.liveTour.downloadImage")}
          </button>
          <button type="button" className="s360-tour-btn" disabled={p.exporting !== null || p.pointCount === 0} onClick={p.onDownloadGpx} data-testid="button-tour-download-gpx">
            {p.exporting === "gpx" ? t("UI.lg.liveTour.exporting") : t("UI.lg.liveTour.downloadGpx")}
          </button>
        </div>
        {p.exportError && <div role="alert" className="s360-tour-error" data-testid="status-tour-export-error">{t("UI.lg.liveTour.exportError")}</div>}
        <button type="button" className="s360-tour-link" onClick={p.onReset} data-testid="button-tour-reset">{t("UI.lg.liveTour.reset")}</button>
        {privacy}
      </div>
    );
  }

  const manual = status === "manual-paused";
  return (
    <div className="s360-tour s360-tour--live" data-testid="panel-tour-live" data-status={status}>
      <div className="s360-tour-status">
        <span className={`s360-tour-dot is-${status}`} aria-hidden="true" />
        <span data-testid="status-tour">{t(STATUS_KEY[status])}</span>
        {p.pointCount === 0 && <span className="s360-tour-muted" data-testid="status-tour-waiting-gps">· {t("UI.lg.liveTour.waitingGps")}</span>}
      </div>
      <LiveTourStats metrics={p.metrics} t={t} />
      <div className="s360-tour-row">
        <button type="button" className="s360-tour-btn" onClick={manual ? p.onResume : p.onPause} data-testid={manual ? "button-tour-resume" : "button-tour-pause"}>
          {manual ? t("UI.lg.liveTour.resume") : t("UI.lg.liveTour.pause")}
        </button>
        <button type="button" className="s360-tour-btn s360-tour-btn--primary" onClick={p.onFinish} data-testid="button-tour-finish">{t("UI.lg.liveTour.finish")}</button>
      </div>
      <button type="button" className="s360-tour-link" onClick={p.onFullscreen} data-testid="button-tour-fullscreen">{t("UI.lg.liveTour.fullscreen")}</button>
      {geo}
      <LiveTourWakeNotice wakeStatus={p.wakeStatus} platform={p.platform} t={t} />
      <p className="s360-tour-fine s360-tour-fine--warn" data-testid="text-tour-background">{t("UI.lg.liveTour.background")}</p>
      {privacy}
    </div>
  );
}
