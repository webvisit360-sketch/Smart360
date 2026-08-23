import {
  getGetDistanceReviewQueryKey, useApproveDistanceReviewBulk, useApproveDistanceReviewRow,
  useGetDistanceReview, useRunDistanceReview, useSetDistanceReviewRowLink,
  useSetDistanceReviewRowValue, useSkipDistanceReviewRow,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useState } from "react";

const fmt = (meters: number | null | undefined) => meters == null ? "—" : meters >= 1000 ? `${(meters / 1000).toLocaleString("sl-SI", { maximumFractionDigits: 1 })} km` : `${Math.round(meters)} m`;
const source = (value: string | null | undefined) => value === "link" ? "povezava" : value === "coordinates" ? "koordinate" : value === "geocoded" ? "naslov" : "—";

export function DistanceReview({ tenantId }: { tenantId: string }) {
  const client = useQueryClient(); const [running, setRunning] = useState(false); const [progress, setProgress] = useState("");
  const { data, isLoading } = useGetDistanceReview(tenantId);
  const refresh = () => client.invalidateQueries({ queryKey: getGetDistanceReviewQueryKey(tenantId) });
  const mutations = { approve: useApproveDistanceReviewRow({ mutation: { onSuccess: refresh } }), skip: useSkipDistanceReviewRow({ mutation: { onSuccess: refresh } }), value: useSetDistanceReviewRowValue({ mutation: { onSuccess: refresh } }), link: useSetDistanceReviewRowLink({ mutation: { onSuccess: refresh } }), bulk: useApproveDistanceReviewBulk({ mutation: { onSuccess: refresh } }) };
  const run = useRunDistanceReview();
  const compute = async () => {
    setRunning(true); try { let previous = Infinity; let result; do { result = await run.mutateAsync({ id: tenantId, data: { limit: 20 } }); setProgress(`Obdelano: ${result.processed}; preostane: ${result.remaining}`); if (result.remaining > 0 && (result.processed === 0 || result.remaining >= previous)) { setProgress("Izračun se ni premaknil. Preverite neuspešne vnose."); break; } previous = result.remaining; } while (result.remaining > 0); await refresh(); } finally { setRunning(false); }
  };
  if (isLoading) return <p className="text-sm text-muted-foreground">Nalagam predloge …</p>;
  if (!data?.tenantReady) return <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">Najprej shranite polno Google Maps povezavo namestitve, da se določijo izhodiščne koordinate.</p>;
  return <div className="space-y-3"><div className="flex flex-wrap gap-2"><Button onClick={compute} disabled={running}>{running ? "Izračunavam …" : "Izračunaj predloge"}</Button><Button variant="outline" onClick={async () => { await run.mutateAsync({ id: tenantId, data: { limit: 20, retryFailed: true } }); await refresh(); }}>Poskusi znova neuspešne</Button><Button variant="outline" onClick={() => mutations.bulk.mutate({ id: tenantId, data: { confidence: "high" } })}>Potrdi vse zanesljive (high)</Button></div>{progress && <p className="text-sm text-muted-foreground">{progress}</p>}
    <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left"><th>Vnos / Kategorija</th><th>Predlog</th><th>Vir</th><th>Naslov</th><th>Preveri</th><th>Dejanja</th></tr></thead><tbody>{data.rows.map((row) => <tr key={row.itemId} className="border-b align-top"><td className="py-2">{row.itemTitle ?? "Brez naslova"}<br/><span className="text-muted-foreground">{row.categoryLabel}</span></td><td>{fmt(row.distanceMeters)}{row.status === "manual" && " · Ročno"}{row.durationMinutes != null && ` · ${Math.round(row.durationMinutes)} min`}{row.error && <div className="text-destructive">{row.error}</div>}</td><td>{source(row.source)}</td><td>{row.resolvedAddress ?? "—"}</td><td>{row.mapsCheckUrl && <a className="underline" href={row.mapsCheckUrl} target="_blank" rel="noopener noreferrer">Odpri</a>}</td><td className="space-x-1 whitespace-nowrap">{row.id && row.status !== "manual" ? <><Button size="sm" onClick={() => mutations.approve.mutate({ id: tenantId, rowId: row.id! })}>Potrdi</Button><Button size="sm" variant="outline" onClick={() => { const v = prompt("Razdalja v metrih", row.distanceMeters?.toString() ?? ""); if (v && Number.isFinite(Number(v))) mutations.value.mutate({ id: tenantId, rowId: row.id!, data: { distanceMeters: Number(v) } }); }}>Uredi</Button><Button size="sm" variant="outline" onClick={() => { const v = prompt("Polna Google Maps povezava"); if (v) mutations.link.mutate({ id: tenantId, rowId: row.id!, data: { mapUrl: v } }); }}>Prilepi povezavo</Button><Button size="sm" variant="ghost" onClick={() => mutations.skip.mutate({ id: tenantId, rowId: row.id! })}>Preskoči</Button></> : row.status === "manual" ? <span>Ročno</span> : <span>Še ni izračunano</span>}</td></tr>)}</tbody></table></div></div>;
}