import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useListSmartxstayImports, useStartSmartxstayImport, getListSmartxstayImportsQueryKey, stepSmartxstayImport, cancelSmartxstayImport } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SmartxstayCleanup } from "./smartxstay-cleanup";

export function SmartxstayImport({ tenantId }: { tenantId: string }) {
  const [url, setUrl] = useState("");
  const [stepError, setStepError] = useState("");
  const [retry, setRetry] = useState(0);
  const client = useQueryClient();
  const history = useListSmartxstayImports(tenantId, { query: { queryKey: getListSmartxstayImportsQueryKey(tenantId), refetchInterval: 3000 } });
  const mutation = useStartSmartxstayImport();
  const latest = history.data?.[0];
  const active = history.data?.find(x => ["preparing", "importing"].includes(x.status));
  const requestStep = async (runId: string, action: "step" | "cancel") => {
    return action === "step" ? stepSmartxstayImport(tenantId, runId) : cancelSmartxstayImport(tenantId, runId);
  };
  useEffect(() => {
    if (!active) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const advance = async () => {
      try {
        await requestStep(active.id, "step");
        if (stopped) return;
        setStepError("");
        const result = await history.refetch();
        if (!stopped && result.data?.some(r => r.id === active.id && ["preparing", "importing"].includes(r.status))) timer = setTimeout(advance, 300);
      } catch (error) {
        if (!stopped) setStepError(error instanceof Error ? error.message : "Povezava je prekinjena. Nadaljujte uvoz.");
      }
    };
    void advance();
    return () => { stopped = true; clearTimeout(timer); };
  }, [active?.id, retry, tenantId]);
  const busy = mutation.isPending || history.data?.some(x => ["preparing", "importing"].includes(x.status));
  useEffect(() => {
    if (latest?.status === "completed") void client.invalidateQueries({
      predicate: query => !String(query.queryKey[0]).includes("smartxstay-imports"),
    });
  }, [latest?.id, latest?.status, client]);
  return <Card>
    <CardHeader><CardTitle>Uvozi vsebino (smartxstay)</CardTitle></CardHeader>
    <CardContent className="space-y-4">
      <p className="text-sm text-muted-foreground">Samo operater. Vsebina in fotografije se dodajo v osnutek.
        Obstoječih vnosov ne prepišemo. Ponovitev preskoči že uvožene vnose. Nič se ne objavi.</p>
      <form className="flex gap-2 flex-wrap" onSubmit={event => {
        event.preventDefault();
        mutation.mutate({ id: tenantId, data: { url } }, { onSuccess: () => { void history.refetch(); } });
      }}>
        <label className="flex-1 min-w-60 text-sm">URL izvornega vodnika
          <Input type="url" value={url} onChange={e => setUrl(e.target.value)}
            placeholder="https://app.smartxstay.com/gen/s/…" required disabled={busy} />
        </label>
        <Button type="submit" className="self-end" disabled={busy || !url.trim()}>
          {busy ? "Uvoz poteka …" : "Uvozi v osnutek"}
        </Button>
      </form>
      {mutation.isError && <p role="alert">{mutation.error instanceof Error ? mutation.error.message : "Uvoza ni bilo mogoče začeti."}</p>}
      {history.isError && <p role="alert">Poročil ni bilo mogoče naložiti.</p>}
      {active && <div className="space-y-2">
        <p className="text-sm">Uvoz poteka po korakih. Pustite ta urejevalnik odprt. Po zaprtju se delo varno ustavi in nadaljuje ob ponovnem odprtju.</p>
        {stepError && <p role="alert">{stepError}</p>}
        <Button type="button" variant="outline" onClick={() => { setStepError(""); setRetry(n => n + 1); }}>Nadaljuj uvoz</Button>{" "}
        <Button type="button" variant="outline" onClick={async () => {
          if (!window.confirm("Prekličem uvoz in počistim neuporabljene datoteke? Že shranjeni osnutki in obstoječa vsebina ostanejo. Ponovitev preskoči že uvožene vnose.")) return;
          try {
            const body = await requestStep(active.id, "cancel");
            setStepError(body.busy ? "Preklic je zabeležen. Počakajte, da se trenutni korak zaključi." : "");
            setRetry(n => n + 1); await history.refetch();
          } catch (error) { setStepError(error instanceof Error ? error.message : "Preklic ni uspel."); }
        }}>Prekliči obtičani uvoz</Button>
      </div>}
      <SmartxstayCleanup key={tenantId} tenantId={tenantId} disabled={busy} />
      {history.data?.map(run => {
        const report = run.report;
        const numbers = ["sections", "categories", "entries", "images", "bytes", "sourceBytes"] as const;
        const labels = ["Nove sekcije", "Nove kategorije", "Novi vnosi", "Slike", "Shranjeni bajti", "Bajti HTML vira"];
        return <details key={run.id} open={run.id === latest?.id} className="rounded-lg border p-3">
          <summary className="cursor-pointer font-medium">
            {run.status === "completed" ? "Uvoz končan — osnutek" : run.status === "failed" ? "Uvoz ni uspel" : "Uvoz poteka"}
            {" · "}{new Date(run.createdAt).toLocaleString("sl-SI")}
          </summary>
          <p className="text-xs break-all mt-2">{run.sourceUrl}</p>
          {Boolean(report.error) && <p role="alert" className="mt-2">{String(report.error)}</p>}
          <dl className="grid grid-cols-2 sm:grid-cols-3 gap-3 my-3">
            {numbers.map((key, i) => <div key={key}><dt className="text-xs text-muted-foreground">{labels[i]}</dt><dd className="font-semibold">{Number(report[key] || 0).toLocaleString("sl-SI")}</dd></div>)}
          </dl>
          {["languages", "groups"].map(key => <div key={key} className="text-sm my-2">
            <h4 className="font-medium">{key === "languages" ? "Vnosi po jeziku" : "Vnosi po sekciji / kategoriji"}</h4>
            {Object.entries((report[key] || {}) as Record<string, number>).map(([label, count]) => <p key={label}>{label}: {count}</p>)}
          </div>)}
          {Array.isArray(report.skipped) && report.skipped.length > 0 && <details className="text-sm mt-3">
            <summary>Preskočeno / opozorila ({report.skipped.length})</summary>
            <ul className="list-disc pl-5">{report.skipped.map((text, index) => <li key={index}>{String(text)}</li>)}</ul>
          </details>}
        </details>;
      })}
    </CardContent>
  </Card>;
}
