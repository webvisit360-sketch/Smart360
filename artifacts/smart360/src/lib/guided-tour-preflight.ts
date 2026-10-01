import { nearestRouteGeometry } from "./gpx-projection";

export type PreflightFix = { lat: number; lon: number; accuracy: number };
export type PreflightState = { status: "waiting" | "denied" | "unsupported" | "near" | "far"; distanceM: number | null };
export function guidedPreflight(segments: [number, number][][], fix: PreflightFix | null, error?: "denied" | "unsupported" | null): PreflightState {
  if (error) return { status: error, distanceM: null };
  if (!fix || !Number.isFinite(fix.accuracy) || fix.accuracy < 0 || fix.accuracy > 100) return { status: "waiting", distanceM: null };
  const hit = nearestRouteGeometry(segments, fix);
  if (!hit) return { status: "waiting", distanceM: null };
  return { status: hit.perpendicularM <= 250 ? "near" : "far", distanceM: hit.perpendicularM };
}
export const guidedSummaryEligible = (distanceM: number) => Number.isFinite(distanceM) && distanceM >= 50;
export const GUIDED_COPY = {
  sl: { waiting: "Pridobivam lokacijo …", far: (d: string) => `Od najbližje točke ture ste oddaljeni ${d}.`, short: "Tura je bila prekratka za povzetek." },
  en: { waiting: "Acquiring location …", far: (d: string) => `You are ${d} from the nearest point of the route.`, short: "The tour was too short for a summary." },
  de: { waiting: "Standort wird ermittelt …", far: (d: string) => `Sie sind ${d} vom nächsten Punkt der Route entfernt.`, short: "Die Tour war zu kurz für eine Zusammenfassung." },
  it: { waiting: "Acquisizione della posizione …", far: (d: string) => `Ti trovi a ${d} dal punto più vicino del percorso.`, short: "Il tour era troppo breve per un riepilogo." },
};
export function formatGuidedDistance(m: number, lang: keyof typeof GUIDED_COPY): string {
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toLocaleString(lang, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} km`;
}