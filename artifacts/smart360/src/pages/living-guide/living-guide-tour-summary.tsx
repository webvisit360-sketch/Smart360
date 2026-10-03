/**
 * Post-tour presentation: preview of the EXACT composed PNG blob + user-initiated
 * share / save. Everything stays on device; nothing is uploaded.
 */
// Explicit React import: node --test (tsx) uses the classic JSX runtime.
import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import * as tourExport from "@/lib/live-tour-export";

import { guideLanguage, type GuideLanguage } from "@workspace/guide-languages";
import { extendCatalog } from "../../lib/guest-catalogs";
export type SummaryLang = GuideLanguage;
import type { TourSummaryImage, TourSummaryInput } from "@/lib/live-tour-export";
import type { SummaryPoint } from "@/lib/tour-summary-model";
/** Planned point in composer order (object lat/lon/ele). Callers convert at their boundary. */
export type PlannedPoint = SummaryPoint;
/** Shared stable empty planned route (free tours) so effect deps stay referentially stable. */
export const NO_PLANNED_SEGMENTS: PlannedPoint[][] = [];
/** GeoJSON [lon,lat(,ele)] segments -> composer points. */
export function plannedFromLonLat(segments: number[][][]): PlannedPoint[][] {
  return segments.map(seg => seg.map(([lon, lat, ele]) => ({ lat, lon, ele: ele ?? null })));
}
type ComposeArgs = TourSummaryInput;
type ComposeResult = TourSummaryImage;

/** Guest shell provides tenant name + language to deeply nested GPX tours. */
export const TourSummaryContext = createContext<{ tenantName: string; lang: string }>({ tenantName: "", lang: "sl" });
export const useTourSummaryContext = () => useContext(TourSummaryContext);

export const SUMMARY_COPY = extendCatalog<Record<string, string>>({
  sl: { kicker: "Tura končana", heading: "Tvoj povzetek", title: "Povzetek ture", preparing: "Pripravljam sliko ture …", share: "Deli turo", save: "Shrani sliko", gpx: "Prenesi GPX", exporting: "Izvažam …", error: "Slike ture ni bilo mogoče pripraviti.", retry: "Poskusi znova", alt: "Slika povzetka ture", fallback: "Deljenje slik tu ni podprto — slika je shranjena v prenose.", saved: "Slika je shranjena.", note: "Slika nastane na napravi; na strežnik ne pošljemo ničesar. Zemljevid razkrije, kje si hodil, zato deliš sam — aplikacija nikoli sama." },
  en: { kicker: "Tour finished", heading: "Your summary", title: "Tour summary", preparing: "Preparing tour image …", share: "Share tour", save: "Save image", gpx: "Download GPX", exporting: "Exporting …", error: "The tour image could not be prepared.", retry: "Try again", alt: "Tour summary image", fallback: "Image sharing is not supported here — the image was saved to downloads.", saved: "Image saved.", note: "The image is created on your device; nothing is sent to our server. The map reveals where you went, so only you decide to share — the app never does." },
  de: { kicker: "Tour beendet", heading: "Deine Zusammenfassung", title: "Tourzusammenfassung", preparing: "Tourbild wird erstellt …", share: "Tour teilen", save: "Bild speichern", gpx: "GPX herunterladen", exporting: "Export läuft …", error: "Das Tourbild konnte nicht erstellt werden.", retry: "Erneut versuchen", alt: "Bild der Tourzusammenfassung", fallback: "Bilder teilen wird hier nicht unterstützt — das Bild wurde in die Downloads gespeichert.", saved: "Bild gespeichert.", note: "Das Bild entsteht auf deinem Gerät; an unseren Server wird nichts gesendet. Die Karte zeigt, wo du warst — teilen entscheidest nur du, nie die App." },
  it: { kicker: "Tour completato", heading: "Il tuo riepilogo", title: "Riepilogo del tour", preparing: "Preparazione dell'immagine …", share: "Condividi tour", save: "Salva immagine", gpx: "Scarica GPX", exporting: "Esportazione …", error: "Impossibile preparare l'immagine del tour.", retry: "Riprova", alt: "Immagine di riepilogo del tour", fallback: "La condivisione di immagini non è supportata qui — l'immagine è stata salvata nei download.", saved: "Immagine salvata.", note: "L'immagine nasce sul tuo dispositivo; non inviamo nulla al nostro server. La mappa mostra dove sei stato: decidi tu se condividere, mai l'app." },
});
export function summaryLang(lang: string | undefined): SummaryLang {
  return guideLanguage(lang);
}

type Prepared = { url: string; file: File; blob: Blob; width: number; height: number; mapKind: string };

export type TourSummaryShareProps = Omit<ComposeArgs, "signal" | "lang"> & {
  lang: string;
  onDownloadGpx: () => void;
  gpxDisabled?: boolean;
  exportingGpx?: boolean;
};

export function saveBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = fileName; a.rel = "noopener";
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/** Returns "shared" | "cancelled" | "fallback". Must be called from a user gesture. */
export async function shareTourFile(file: File, title: string): Promise<"shared" | "cancelled" | "fallback"> {
  const nav = typeof navigator !== "undefined" ? navigator as Navigator & { canShare?: (d: ShareData) => boolean } : null;
  const data: ShareData = { files: [file], title };
  let supported = false;
  try { supported = !!nav?.share && !!nav.canShare?.(data); } catch { supported = false; }
  if (supported && nav) {
    try { await nav.share(data); return "shared"; }
    catch (e) { if ((e as Error)?.name === "AbortError") return "cancelled"; }
  }
  saveBlob(file, file.name);
  return "fallback";
}

export function TourSummaryShare(p: TourSummaryShareProps) {
  const L = SUMMARY_COPY[summaryLang(p.lang)];
  const [prepared, setPrepared] = useState<Prepared | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [hint, setHint] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const argsRef = useRef(p);
  argsRef.current = p;

  useEffect(() => {
    const ctrl = new AbortController();
    let url: string | null = null;
    setPrepared(null); setFailed(false); setHint(null);
    const a = argsRef.current;
    tourExport.createTourSummaryImage({ state: a.state, metrics: a.metrics, plannedSegments: a.plannedSegments, tourName: a.tourName, tenantName: a.tenantName, lang: summaryLang(a.lang), signal: ctrl.signal })
      .then((r: ComposeResult) => {
        if (ctrl.signal.aborted) return;
        url = URL.createObjectURL(r.blob);
        const file = new File([r.blob], r.fileName, { type: "image/png" });
        setPrepared({ url, file, blob: r.blob, width: r.width, height: r.height, mapKind: String(r.mapKind) });
      })
      .catch((e: unknown) => { if (!ctrl.signal.aborted) { console.error("[tour-summary] compose failed", e); setFailed(true); } });
    return () => { ctrl.abort(); if (url) URL.revokeObjectURL(url); };
    // Identity deps: finished state + memoized planned geometry; metrics derive from state (read via ref).
  }, [p.state, p.plannedSegments, p.lang, p.tourName, p.tenantName, attempt]);

  const onShare = async () => {
    if (!prepared || sharing) return;
    setSharing(true); setHint(null);
    try { const r = await shareTourFile(prepared.file, p.tourName); if (r === "fallback") setHint(L.fallback); }
    catch (e) { console.error("[tour-summary] share failed", e); setHint(L.fallback); }
    finally { setSharing(false); }
  };
  const onSave = () => { if (prepared) { saveBlob(prepared.blob, prepared.file.name); setHint(L.saved); } };

  return (
    <div className="s360-sum" data-testid="tour-summary">
      <div className="s360-sum-frame" style={prepared ? { aspectRatio: `${prepared.width} / ${prepared.height}` } : undefined}>
        {prepared ? (
          <img className="s360-sum-img" src={prepared.url} alt={`${L.alt}: ${p.tourName}`} width={prepared.width} height={prepared.height} data-testid="img-tour-summary" data-map-kind={prepared.mapKind} />
        ) : failed ? (
          <div className="s360-sum-fail" role="alert" data-testid="status-tour-summary-error">
            <p>{L.error}</p>
            <button type="button" className="s360-tour-btn" onClick={() => setAttempt(n => n + 1)} data-testid="button-tour-summary-retry">{L.retry}</button>
          </div>
        ) : (
          <div className="s360-sum-skel" aria-busy="true" data-testid="status-tour-summary-loading">
            <span className="s360-sum-skel-map" /><span className="s360-sum-skel-line" /><span className="s360-sum-skel-grid" />
            <span className="s360-sum-sr">{L.preparing}</span>
          </div>
        )}
      </div>
      <button type="button" className="s360-tour-btn s360-tour-btn--primary s360-sum-share" disabled={!prepared || sharing} onClick={() => { void onShare(); }} data-testid="button-tour-share">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17 17 7M9 7h8v8" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
        {L.share}
      </button>
      <div className="s360-sum-row">
        <button type="button" className="s360-tour-btn" disabled={!prepared} onClick={onSave} data-testid="button-tour-download-image">{L.save}</button>
        <button type="button" className="s360-tour-btn" disabled={p.gpxDisabled || p.exportingGpx} onClick={p.onDownloadGpx} data-testid="button-tour-download-gpx">{p.exportingGpx ? L.exporting : L.gpx}</button>
      </div>
      {hint && <p className="s360-sum-hint" role="status" data-testid="status-tour-share-hint">{hint}</p>}
      <p className="s360-sum-note">{L.note}</p>
    </div>
  );
}
