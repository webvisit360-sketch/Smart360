import {
  getGetDistanceReviewQueryKey, useApproveDistanceReviewBulk, useApproveDistanceReviewRow,
  useGetDistanceReview, useRevertDistanceReviewRow, useRunDistanceReview,
  useSetDistanceReviewRowLink, useSetDistanceReviewRowValue, useSkipDistanceReviewRow,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useState } from "react";

const fmt = (meters: number | null | undefined) => meters == null ? "—" : meters >= 1000 ? `${(meters / 1000).toLocaleString("sl-SI", { maximumFractionDigits: 1 })} km` : `${Math.round(meters)} m`;
const source = (value: string | null | undefined) => value === "link" ? "povezava" : value === "coordinates" ? "koordinate" : value === "geocoded" ? "naslov" : "—";

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  pending: { label: "Predlog", className: "bg-blue-100 text-blue-900" },
  approved: { label: "Potrjeno", className: "bg-green-100 text-green-900" },
  manual: { label: "Ročno", className: "bg-violet-100 text-violet-900" },
  skipped: { label: "Preskočeno", className: "bg-gray-100 text-gray-700" },
  failed: { label: "Ni uspelo", className: "bg-red-100 text-red-900" },
  new: { label: "Še ni izračunano", className: "bg-gray-100 text-gray-500" },
};
const Badge = ({ status }: { status: string }) => {
  const badge = STATUS_BADGE[status] ?? STATUS_BADGE["new"]!;
  return <span className={`inline-block whitespace-nowrap rounded px-1.5 py-0.5 text-xs font-medium ${badge.className}`}>{badge.label}</span>;
};

export function DistanceReview({ tenantId }: { tenantId: string }) {
  const client = useQueryClient(); const [running, setRunning] = useState(false); const [progress, setProgress] = useState("");
  const { data, isLoading } = useGetDistanceReview(tenantId);
  const refresh = () => client.invalidateQueries({ queryKey: getGetDistanceReviewQueryKey(tenantId) });
  const mutations = {
    approve: useApproveDistanceReviewRow({ mutation: { onSuccess: refresh } }),
    skip: useSkipDistanceReviewRow({ mutation: { onSuccess: refresh } }),
    value: useSetDistanceReviewRowValue({ mutation: { onSuccess: refresh } }),
    link: useSetDistanceReviewRowLink({ mutation: { onSuccess: refresh } }),
    revert: useRevertDistanceReviewRow({ mutation: { onSuccess: refresh } }),
    bulk: useApproveDistanceReviewBulk({ mutation: { onSuccess: refresh } }),
  };
  const run = useRunDistanceReview();
  const compute = async () => {
    setRunning(true); try { let previous = Infinity; let total = 0; let result; do { result = await run.mutateAsync({ id: tenantId, data: { limit: 20 } }); total += result.processed; setProgress(`Na novo izračunano: ${total} · preostane: ${result.remaining}`); if (result.remaining > 0 && (result.processed === 0 || result.remaining >= previous)) { setProgress("Izračun se ni premaknil. Preverite neuspešne vnose."); break; } previous = result.remaining; } while (result.remaining > 0); if (result.remaining === 0) { const skipped = result.counts.skipped + result.counts.manual; setProgress(`Končano — na novo izračunanih: ${total}${skipped > 0 ? ` · nespremenjenih ali ročnih (preskočeno): ${skipped}` : ""}`); } await refresh(); } finally { setRunning(false); }
  };
  if (isLoading) return <p className="text-sm text-muted-foreground">Nalagam predloge …</p>;
  if (!data?.tenantReady) return <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">Najprej shranite polno Google Maps povezavo namestitve, da se določijo izhodiščne koordinate.</p>;
  const tally = data.rows.reduce<Record<string, number>>((acc, row) => { acc[row.status] = (acc[row.status] ?? 0) + 1; return acc; }, {});
  return <div className="space-y-3">
    <div className="flex flex-wrap gap-2">
      <Button onClick={compute} disabled={running}>{running ? "Izračunavam …" : "Izračunaj predloge"}</Button>
      <Button variant="outline" onClick={async () => { await run.mutateAsync({ id: tenantId, data: { limit: 20, retryFailed: true } }); await refresh(); }}>Poskusi znova neuspešne</Button>
      <Button variant="outline" onClick={() => mutations.bulk.mutate({ id: tenantId, data: { confidence: "high" } })}>Potrdi vse zanesljive (high)</Button>
    </div>
    {progress && <p className="text-sm text-muted-foreground">{progress}</p>}
    <p className="text-sm">
      <span className="font-medium">Čaka pregled: {tally["pending"] ?? 0}</span>
      {" · "}Potrjeno: {tally["approved"] ?? 0}
      {" · "}Ročno: {tally["manual"] ?? 0}
      {" · "}Neuspešno: {tally["failed"] ?? 0}
      {(tally["skipped"] ?? 0) > 0 && <> · Preskočeno: {tally["skipped"]}</>}
      {(tally["new"] ?? 0) > 0 && <> · Še ni izračunano: {tally["new"]}</>}
    </p>
    <div className="overflow-x-auto"><table className="w-full text-sm">
      <thead><tr className="border-b text-left">
        <th className="px-3 py-2 font-medium">Vnos / Kategorija</th>
        <th className="px-3 py-2 font-medium">Stanje</th>
        <th className="px-3 py-2 font-medium">Predlog</th>
        <th className="px-3 py-2 font-medium">Vir</th>
        <th className="px-3 py-2 font-medium">Naslov</th>
        <th className="px-3 py-2 font-medium">Preveri</th>
        <th className="px-3 py-2 font-medium">Dejanja</th>
      </tr></thead>
      <tbody>{data.rows.map((row) => {
        const decided = row.status === "approved" || row.status === "manual" || row.status === "skipped";
        return <tr key={row.itemId} className="border-b align-top">
          <td className="px-3 py-2">{row.itemTitle ?? "Brez naslova"}<br/><span className="text-muted-foreground">{row.categoryLabel}</span></td>
          <td className="px-3 py-2"><Badge status={row.status} /></td>
          <td className="px-3 py-2">{fmt(row.distanceMeters)}{row.durationMinutes != null && row.status !== "manual" && ` · ${Math.round(row.durationMinutes)} min`}{row.error && <div className="text-destructive">{row.error}</div>}</td>
          <td className="px-3 py-2">{source(row.source)}</td>
          <td className="px-3 py-2">{row.resolvedAddress ?? "—"}</td>
          <td className="px-3 py-2">{row.mapsCheckUrl && <a className="underline" href={row.mapsCheckUrl} target="_blank" rel="noopener noreferrer">Odpri</a>}</td>
          <td className="space-x-1 whitespace-nowrap px-3 py-2">
            {row.status === "pending" && row.id && <>
              <Button size="sm" onClick={() => mutations.approve.mutate({ id: tenantId, rowId: row.id! })}>Potrdi</Button>
              <Button size="sm" variant="outline" onClick={() => { const v = prompt("Razdalja v metrih", row.distanceMeters?.toString() ?? ""); if (v && Number.isFinite(Number(v))) mutations.value.mutate({ id: tenantId, rowId: row.id!, data: { distanceMeters: Number(v) } }); }}>Uredi</Button>
              <Button size="sm" variant="outline" onClick={() => { const v = prompt("Polna Google Maps povezava"); if (v) mutations.link.mutate({ id: tenantId, rowId: row.id!, data: { mapUrl: v } }); }}>Prilepi povezavo</Button>
              <Button size="sm" variant="ghost" onClick={() => mutations.skip.mutate({ id: tenantId, rowId: row.id! })}>Preskoči</Button>
            </>}
            {row.status === "failed" && row.id && <>
              <Button size="sm" variant="outline" onClick={() => { const v = prompt("Polna Google Maps povezava"); if (v) mutations.link.mutate({ id: tenantId, rowId: row.id!, data: { mapUrl: v } }); }}>Prilepi povezavo</Button>
              <Button size="sm" variant="outline" onClick={() => { const v = prompt("Razdalja v metrih"); if (v && Number.isFinite(Number(v))) mutations.value.mutate({ id: tenantId, rowId: row.id!, data: { distanceMeters: Number(v) } }); }}>Uredi</Button>
              <Button size="sm" variant="ghost" onClick={() => mutations.skip.mutate({ id: tenantId, rowId: row.id! })}>Preskoči</Button>
            </>}
            {decided && (row.id
              ? <Button size="sm" variant="ghost" onClick={() => mutations.revert.mutate({ id: tenantId, rowId: row.id! })}>Razveljavi</Button>
              : <span className="text-muted-foreground">Ročno v urejevalniku</span>)}
            {row.status === "new" && <span className="text-muted-foreground">Še ni izračunano</span>}
          </td>
        </tr>;
      })}</tbody>
    </table></div>
  </div>;
}
