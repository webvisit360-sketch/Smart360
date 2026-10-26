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
      setSelected(result.entries.filter(e => e.status === "ready" && !e.legacy).map(e => e.id));
    } catch (e) { setError(e instanceof Error ? e.message : "Pregled ni uspel."); }
    finally { setBusy(false); }
  };
  return <section className="space-y-3 border-t pt-4">
    <Button type="button" variant="outline" disabled={disabled || busy} onClick={preview}>Počisti uvožene osnutke</Button>
    <p className="text-sm text-muted-foreground">Najprej pregled razlik. Samo neobjavljeni uvoženi vnosi; nič se ne izbriše ali objavi. Spremenjeni vnosi s kontrolno vsoto se preskočijo.</p>
    {error && <p role="alert">{error}</p>}
    {report && <div className="space-y-3">
      <p role="status">{applied ? "Rezultat" : "Predogled"}: spremenjeno {report.changed} · preskočeno {report.skipped} · nespremenjeno {report.untouched} · pripravljeno {report.ready}</p>
      {report.entries.map(entry => <details key={entry.id} className="rounded-lg border p-3">
        <summary className="cursor-pointer font-medium">{entry.title} — {entry.reason}</summary>
        {entry.legacy && <p className="my-2 text-sm">Opozorilo: prvotni uvoz nima kontrolne vsote. Ni mogoče ugotoviti, ali je bila vsebina že ročno urejena. Preglejte vse razlike, preden posebej odobrite ta vnos.</p>}
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
          {entry.legacy ? "Pregledal/-a sem razlike in posebej odobrim čiščenje tega starega vnosa brez kontrolne vsote." : "Odobrim prikazane spremembe."}
        </label>}
      </details>)}
      {!applied && <Button type="button" disabled={busy || !selected.length} onClick={async () => {
        if (!window.confirm(`Počistim ${selected.length} izbranih osnutkov po prikazanih razlikah? Nič se ne objavi.`)) return;
        setBusy(true); setError("");
        try {
          const result = await applySmartxstayCleanup(tenantId, { approvals: report.entries.filter(e => selected.includes(e.id)).map(e => ({ id: e.id, token: e.token, legacyApproved: e.legacy })) });
          setReport(result); setApplied(true); setSelected([]);
          await client.invalidateQueries();
        } catch (e) { setError(e instanceof Error ? e.message : "Čiščenje ni uspelo."); }
        finally { setBusy(false); }
      }}>Potrdi čiščenje izbranih osnutkov ({selected.length})</Button>}
    </div>}
  </section>;
}
