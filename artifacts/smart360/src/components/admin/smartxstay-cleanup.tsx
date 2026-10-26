import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { previewSmartxstayCleanup, applySmartxstayCleanup, type SmartxstayCleanupReport } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { sanitizeHtml } from "@/lib/sanitize";

export function SmartxstayCleanup({ tenantId, disabled }: { tenantId: string; disabled?: boolean }) {
  const [report, setReport] = useState<SmartxstayCleanupReport | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [applied, setApplied] = useState(false);
  const [error, setError] = useState("");
  const client = useQueryClient();
  const preview = async () => {
    setBusy(true); setError(""); setReport(null); setSelected([]); setApplied(false);
    try {
      const result = await previewSmartxstayCleanup(tenantId);
      setReport(result);
      setSelected(result.entries.filter(e => e.status === "ready").map(e => e.id));
    } catch (e) { setError(e instanceof Error ? e.message : "Pregled ni uspel."); }
    finally { setBusy(false); }
  };
  return <section className="space-y-3 border-t pt-4">
    <Button type="button" variant="outline" disabled={disabled || busy} onClick={preview}>Počisti uvožene osnutke</Button>
    <Button type="button" variant="outline" disabled={disabled || busy} onClick={async () => {
      setBusy(true); setError(""); setReport(null); setSelected([]);
      try {
        const result = await applySmartxstayCleanup(tenantId, { approvals: [], action: "restoreAddresses" });
        setReport(result); setApplied(true);
        await client.invalidateQueries();
      } catch (e) { setError(e instanceof Error ? e.message : "Obnova naslovov ni uspela."); }
      finally { setBusy(false); }
    }}>Vrni naslove</Button>
    <p className="text-sm text-muted-foreground">»Vrni naslove« obnovi pomotoma odstranjene naslovne vrstice iz evidence čiščenja, brez oznake »Naslov«. Drugi popravki ostanejo. Naknadno spremenjeno besedilo se zaradi varnosti preskoči in navede v rezultatu.</p>
    <p className="text-sm text-muted-foreground">Preglejte predlagane spremembe uvoženih osnutkov, tudi že objavljenih vnosov. Vse so izbrane; posamezne vnose lahko odznačite. Odstrani se samo oznaka »Naslov«, dejanski naslov ostane. Objavljeni posnetek ostane nedotaknjen. Nič se ne izbriše trajno ali samodejno objavi. Koš in spremenjeni vnosi s kontrolno vsoto se preskočijo.</p>
    <p className="text-sm">Spremembe so v osnutku — za goste veljajo po ponovni objavi.</p>
    {error && <p role="alert">{error}</p>}
    {report && <div className="space-y-3">
      <p role="status">{applied ? "Rezultat" : "Predogled"}: spremenjeno {report.changed} · preskočeno {report.skipped} · nespremenjeno {report.untouched} · pripravljeno {report.ready}</p>
      {applied && <p role="status">Spremembe so v osnutku — za goste veljajo po ponovni objavi.</p>}
      {report.entries.map(entry => <details key={entry.id} className="rounded-lg border p-3">
        <summary className="cursor-pointer font-medium">{entry.title} — {entry.reason}</summary>
        {entry.legacy && <p className="my-2 text-sm">Opozorilo: prvotni uvoz nima kontrolne vsote. Ni mogoče ugotoviti, ali je bila vsebina že ročno urejena. Preglejte razlike; s »Potrdi vse« odobrite tudi izbrane stare vnose.</p>}
        {entry.changes.map(change => <div key={`${change.field}-${change.lang}`} className="my-3 space-y-2">
          <p className="text-sm font-medium">{change.lang.toUpperCase()} · {change.operations.join("; ") || "Brez sprememb"}</p>
          {change.warnings.map(w => <p key={w} className="text-sm">{w}</p>)}
          <div className="grid gap-3 md:grid-cols-2">
            {[["Prej", change.before], ["Potem", change.after]].map(([label, html]) => <div key={label} className="min-w-0 rounded border p-3">
              <h4 className="font-semibold">{label}</h4>
              <div className="prose prose-sm max-w-none break-words pointer-events-none" dangerouslySetInnerHTML={{ __html: sanitizeHtml(html) }} />
              <details><summary className="text-xs cursor-pointer">Izvorni HTML</summary><pre className="whitespace-pre-wrap break-all text-xs">{html}</pre></details>
            </div>)}
          </div>
        </div>)}
        {!applied && entry.status === "ready" && <label className="flex gap-2 items-start text-sm font-medium">
          <input type="checkbox" checked={selected.includes(entry.id)} disabled={busy} onChange={e => setSelected(ids => e.target.checked ? [...ids, entry.id] : ids.filter(id => id !== entry.id))} />
          Vključi ta vnos
        </label>}
      </details>)}
      {!applied && <Button type="button" disabled={busy || !selected.length} onClick={async () => {
        setBusy(true); setError("");
        try {
          const result = await applySmartxstayCleanup(tenantId, { approvals: report.entries.filter(e => selected.includes(e.id)).map(e => ({ id: e.id, token: e.token, legacyApproved: e.legacy })) });
          setReport(result); setApplied(true); setSelected([]);
          await client.invalidateQueries();
        } catch (e) { setError(e instanceof Error ? e.message : "Čiščenje ni uspelo."); }
        finally { setBusy(false); }
      }}>Potrdi vse ({selected.length})</Button>}
    </div>}
  </section>;
}
