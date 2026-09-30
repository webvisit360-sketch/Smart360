/** Pure free-tour UI pieces (no hook, no CSS, no map) — statically testable. */
// Explicit React import: node --test (tsx) uses the classic JSX runtime.
import React from "react";
import type { UiTranslator } from "../guest/i18n";
import { distanceMeters } from "../../lib/live-tour";

export type FreeTourActivity = "cycling" | "hiking";

/** Published tenant flag only; default OFF (missing/any non-true value → off). */
export function isTourRecordingEnabled(tenant: unknown): boolean {
  return (tenant as { tourRecordingEnabled?: boolean } | null)?.tourRecordingEnabled === true;
}

export function formatAscent(m: number | null | undefined, na: string) {
  return m == null || !Number.isFinite(m) ? na : `${Math.round(Math.max(0, m))} m`;
}

/** Idle intro: activity choice (labels only) + start. Pure, testable. */
export function FreeTourIntro({ t, activity, onActivity, onStart }: { t: UiTranslator; activity: FreeTourActivity; onActivity: (a: FreeTourActivity) => void; onStart: () => void }) {
  return (
    <div className="s360-free-intro" data-testid="panel-free-tour-idle">
      <fieldset className="s360-free-activity">
        <legend>{t("UI.lg.freeTour.chooseActivity")}</legend>
        {(["cycling", "hiking"] as const).map((a) => (
          <label key={a} className={`s360-free-choice${activity === a ? " is-on" : ""}`} data-testid={`option-free-activity-${a}`}>
            <input type="radio" name="s360-free-activity" value={a} checked={activity === a} onChange={() => onActivity(a)} data-testid={`radio-free-activity-${a}`} />
            <span>{t(a === "cycling" ? "UI.lg.gpx.cycling" : "UI.lg.gpx.hiking")}</span>
          </label>
        ))}
      </fieldset>
      <button type="button" className="s360-tour-btn s360-tour-btn--primary" onClick={onStart} data-testid="button-free-tour-start">
        <span className="s360-tour-play" aria-hidden="true" />{t("UI.lg.freeTour.start")}
      </button>
      <p className="s360-tour-fine" data-testid="text-free-tour-privacy">{t("UI.lg.liveTour.privacy")}</p>
    </div>
  );
}

export function FreeTourAscent({ t, ascentM }: { t: UiTranslator; ascentM: number | null | undefined }) {
  return (
    <dl className="s360-tour-stats is-compact s360-free-ascent">
      <div><dt>{t("UI.lg.freeTour.ascent")}</dt><dd data-testid="text-free-tour-ascent">{formatAscent(ascentM, t("UI.lg.gpx.unavailable"))}</dd></div>
    </dl>
  );
}

export function FreeTourOmitted({ t, count }: { t: UiTranslator; count: number | null | undefined }) {
  if (!count || count <= 0) return null;
  return <p role="note" className="s360-tour-card" data-testid="text-free-tour-omitted">{t("UI.lg.freeTour.omittedSegments", { count })}</p>;
}

export type RecordedProfilePoint = { lat: number; lon: number; altitude?: number | null };

/** Cumulative-distance elevation series of recorded points; segment breaks become gaps. */
export function recordedProfileData(points: RecordedProfilePoint[], segmentStarts: number[] = []) {
  const starts = new Set(segmentStarts);
  const out: Array<{ distanceKm: number; elevationM: number | null }> = [];
  let d = 0;
  points.forEach((p, i) => {
    if (i > 0) {
      d += distanceMeters(points[i - 1]!, p);
      if (starts.has(i)) out.push({ distanceKm: d / 1000, elevationM: null });
    }
    const ele = typeof p.altitude === "number" && Number.isFinite(p.altitude) ? p.altitude : null;
    out.push({ distanceKm: d / 1000, elevationM: ele });
  });
  return out;
}
