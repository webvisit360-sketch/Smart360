/**
 * Free tour recording ("Posnemi svojo turo"): record a NEW route without a
 * planned GPX. Same engine as the GPX live tour (useLiveTour: geolocation,
 * Wake Lock, auto-pause). PRIVACY: all state stays on this device.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { UiTranslator } from "../guest/i18n";
import { useLiveTour } from "@/hooks/use-live-tour";
import { downloadTourGpx, downloadTourImage } from "@/lib/live-tour-export";
import { LiveTourOverlay, LiveTourPanel, formatTourDistance, formatTourDuration } from "./living-guide-live-tour";
import { NO_PLANNED_SEGMENTS } from "./living-guide-tour-summary";
import { TourProfileControl, useTourProfile } from "./living-guide-tour-profile";
import { RecordedElevationProfile, RouteMap } from "./living-guide-gpx";
import "./living-guide-free-tour.css";
import { TourWeatherStrip } from "./living-guide-weather";
import { GUIDED_COPY, guidedSummaryEligible } from "@/lib/guided-tour-preflight";
import { summaryLang } from "./living-guide-tour-summary";

import { FreeTourAscent, FreeTourIntro, FreeTourOmitted, formatAscent, type FreeTourActivity } from "./living-guide-free-tour-view";

export { isTourRecordingEnabled } from "./living-guide-free-tour-view";

export function FreeTourRecorder({ slug, t, center, tenantName = "", lang = "sl", viewVisible = true, viewKey = "" }: { slug: string; t: UiTranslator; center?: [number, number] | null; tenantName?: string; lang?: string; viewVisible?: boolean; viewKey?: string }) {
  const [chosen, setChosen] = useState<FreeTourActivity>("hiking");
  const tour = useLiveTour(`${slug}/free-tour`, { ephemeralFinished: true });
  const profile = useTourProfile();
  const startWith = (activity: FreeTourActivity) => profile.start(snapshot => { setExportError(false); setShortNotice(false); tour.start(activity, snapshot); });
  const state = tour.state as (NonNullable<typeof tour.state> & { activity?: FreeTourActivity; omittedSegments?: number }) | null;
  const activity: FreeTourActivity = state?.activity ?? (state ? "hiking" : chosen);
  const ascentM = (tour.metrics as typeof tour.metrics & { ascentM?: number }).ascentM;
  const status = state?.status ?? null;
  const [shortNotice, setShortNotice] = useState(false);
  const previousView = useRef(viewKey);
  const shortFinished = status === "finished" && !guidedSummaryEligible(tour.metrics.distanceM);
  useEffect(() => {
    const changedView = previousView.current !== viewKey;
    previousView.current = viewKey;
    if (shortFinished) { tour.reset(); setShortNotice(true); }
    else if ((!viewVisible || changedView) && status === "finished") tour.reset();
  }, [shortFinished, viewVisible, viewKey, status, tour.reset]);
  const tourActive = status !== null && status !== "finished";
  const [fullscreen, setFullscreen] = useState(false);
  const [exporting, setExporting] = useState<"image" | "gpx" | null>(null);
  const [exportError, setExportError] = useState(false);
  const exitFullscreen = useCallback(() => setFullscreen(false), []);
  useEffect(() => { if (!tourActive) setFullscreen(false); }, [tourActive]);
  useEffect(() => { setFullscreen(false); }, [viewVisible, viewKey]);
  const activityLabel = t(`UI.lg.gpx.${activity}`);
  const name = `${t("UI.lg.freeTour.routeName")} · ${activityLabel}`;
  const na = t("UI.lg.gpx.unavailable");

  const onDownloadGpx = () => {
    if (!state) return;
    setExportError(false); setExporting("gpx");
    try { downloadTourGpx(state, name); }
    catch (error) { console.error("[free-tour] gpx export failed", error); setExportError(true); }
    finally { setExporting(null); }
  };
  const onDownloadImage = async () => {
    if (!state) return;
    setExportError(false); setExporting("image");
    const m = tour.metrics;
    try {
      await downloadTourImage(state, m, [], {
        title: t("UI.lg.freeTour.summaryTitle"), routeName: name,
        net: t("UI.lg.liveTour.net"), paused: t("UI.lg.liveTour.paused"), elapsed: t("UI.lg.liveTour.total"),
        distance: t("UI.lg.liveTour.distance"), planned: t("UI.lg.liveTour.planned"), recorded: t("UI.lg.liveTour.recorded"),
        schematic: t("UI.lg.liveTour.schematic"), ascent: t("UI.lg.freeTour.ascent"),
        calories: t("UI.lg.calories.kcal"), approx: t("UI.lg.calories.approx"),
        netValue: formatTourDuration(m.movingMs), pausedValue: formatTourDuration(m.pausedMs),
        elapsedValue: formatTourDuration(m.elapsedMs), distanceValue: formatTourDistance(m.distanceM),
        ascentValue: formatAscent(ascentM, na),
      });
    } catch (error) { console.error("[free-tour] image export failed", error); setExportError(true); }
    finally { setExporting(null); }
  };

  const points = state?.points ?? [];
  return (
    <section className="s360-free lg2-card-surface" aria-labelledby="s360-free-title" data-testid="card-free-tour" data-status={status ?? "idle"} data-activity={activity}>
      <header className="s360-free-head">
        <span className="s360-free-icon" aria-hidden="true"><svg><use href="#lg-i-pin" /></svg></span>
        <div>
          <h2 id="s360-free-title">{t("UI.lg.freeTour.title")}</h2>
          {status ? <span className="lg2-chip" data-testid="text-free-tour-activity">{activityLabel}</span>
            : <p>{t("UI.lg.freeTour.intro")}</p>}
        </div>
      </header>
      {!status && <TourWeatherStrip />}
      {shortNotice && <p role="status" className="s360-tour-fine" data-testid="text-free-tour-short">{GUIDED_COPY[summaryLang(lang)].short}</p>}
      {!status && <FreeTourIntro t={t} activity={chosen} onActivity={setChosen} onStart={() => startWith(chosen)} />}
      {status !== "finished" && <TourProfileControl t={t} activity={activity} tourActive={tourActive} controller={profile} />}
      {status && !shortFinished && (
        <>
          {tourActive && <>
          <div className="s360-free-map" data-testid="map-free-tour">
            <RouteMap
              freeMode
              viewScope={`${viewKey}:${viewVisible}`}
              fallbackCenter={center ?? null}
              t={t}
              tourPoints={points}
              tourSegmentStarts={state?.segmentStarts}
              tourActive={tourActive}
              tourStatus={status}
              tourKey={`${slug}/free-tour`}
              tourStartedAt={state?.startedAt}
              currentPosition={tour.currentPosition}
              onPositionChange={() => undefined}
              fullscreen={fullscreen}
              onEnterFullscreen={() => setFullscreen(true)}
              onExitFullscreen={exitFullscreen}
              overlay={tourActive && status ? <LiveTourOverlay metrics={tour.metrics} status={status} t={t} wakeStatus={tour.wakeStatus} platform={tour.platform} /> : null}
              profileStrip={fullscreen && <RecordedElevationProfile points={points} segmentStarts={state?.segmentStarts} t={t} compact />}
            />
            {points.length === 0 && tourActive && <p className="s360-free-map-wait" data-testid="text-free-map-waiting">{t("UI.lg.freeTour.mapWaiting")}</p>}
          </div>
          <FreeTourAscent t={t} ascentM={ascentM} />
          <FreeTourOmitted t={t} count={state?.omittedSegments} />
          <RecordedElevationProfile points={points} segmentStarts={state?.segmentStarts} t={t} />
          </>}
          <LiveTourPanel
            t={t} status={status} metrics={tour.metrics} pointCount={points.length}
            wakeStatus={tour.wakeStatus} platform={tour.platform} geoError={tour.geoError}
            exporting={exporting} exportError={exportError} hasPlannedRoute={false}
            onStart={() => startWith(activity)} onPause={tour.pause} onResume={tour.resume} onFinish={tour.finish}
            onReset={() => { setExportError(false); tour.reset(); }}
            onFullscreen={() => setFullscreen(true)}
            onDownloadImage={() => { void onDownloadImage(); }}
            onDownloadGpx={onDownloadGpx}
            summary={state && status === "finished" ? { state, plannedSegments: NO_PLANNED_SEGMENTS, tourName: name, tenantName, lang } : undefined}
          />
        </>
      )}
    </section>
  );
}
