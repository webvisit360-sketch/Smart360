import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListCreatorSources,
  getListCreatorSourcesQueryKey,
  useProposeCreatorSources,
  useDecideCreatorSource,
  useApproveCreatorSourceList,
  useStartCreatorRun,
  useGetLatestCreatorRun,
  getGetLatestCreatorRunQueryKey,
} from "@workspace/api-client-react";
import { Loader2, Plus, Trash2, CheckCircle2, XCircle, AlertTriangle, Play, Undo2 } from "lucide-react";
import { AdminButton as Button } from "@/components/ui/button";
import { AdminCard as Card, AdminCardContent as CardContent, AdminCardHeader as CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { KreatorProposalQueue } from "./kreator-proposal-queue";

const SOURCE_KINDS = [
  "official_tourism",
  "municipality",
  "park",
  "museum",
  "gastronomy",
  "other"
];

type CreatorSourceOutcome = {
  sourceId: string;
  label: string;
  url: string;
  status: "completed" | "partial" | "failed";
  attemptedPages: number;
  storedPages: number;
  skippedPages: number;
  facts: number;
  error: string | null;
  failedPages: Array<{ url: string; reason: string }>;
};

const SOURCE_FAILURE_REASON_SL: Record<string, string> = {
  "run-budget-exhausted": "Odgovor strani je presegel dovoljeni podatkovni obseg za ta vir.",
  "source-byte-cap": "Stran je presegla dovoljeni podatkovni obseg za ta vir.",
  "network": "Strani ni bilo mogoče prenesti ali pa je zahteva potekla.",
  "response-too-large": "Odgovor strani je bil prevelik.",
  "content-type": "Stran ni vrnila podprte besedilne ali HTML-vsebine.",
  "robots-disallowed": "Pravila robots.txt ne dovoljujejo branja te strani.",
  "robots-uncertain": "Dovoljenja robots.txt ni bilo mogoče zanesljivo potrditi.",
  "redirect-not-approved": "Stran je preusmerila na neodobreno spletno mesto.",
  "private-destination": "Cilj povezave ni javno dostopen.",
  "invalid-url": "Povezava ni veljavna.",
  "infrastructure-error": "Med tehnično obdelavo vira je prišlo do napake.",
};

function readCreatorSourceOutcomes(report: unknown): CreatorSourceOutcome[] {
  if (!report || typeof report !== "object") return [];
  const sourceOutcomes = (report as { sourceOutcomes?: unknown }).sourceOutcomes;
  if (!Array.isArray(sourceOutcomes)) return [];
  return sourceOutcomes.filter((outcome): outcome is CreatorSourceOutcome => {
    if (!outcome || typeof outcome !== "object") return false;
    const value = outcome as Partial<CreatorSourceOutcome>;
    return typeof value.sourceId === "string"
      && typeof value.label === "string"
      && typeof value.url === "string"
      && ["completed", "partial", "failed"].includes(value.status ?? "")
      && typeof value.attemptedPages === "number"
      && typeof value.storedPages === "number"
      && typeof value.skippedPages === "number"
      && typeof value.facts === "number"
      && Array.isArray(value.failedPages)
      && value.failedPages.every((page) =>
        page
        && typeof page === "object"
        && typeof page.url === "string"
        && typeof page.reason === "string"
      );
  });
}

function readCreatorRunError(report: unknown): string | null {
  if (!report || typeof report !== "object") return null;
  const error = (report as { error?: unknown }).error;
  return typeof error === "string" && error.trim() ? error.trim() : null;
}

function sourceOutcomeMessage(outcome: CreatorSourceOutcome): string | null {
  if (outcome.status === "completed") return null;
  const firstFailure = outcome.failedPages[0];
  if (firstFailure) {
    const reason = SOURCE_FAILURE_REASON_SL[firstFailure.reason]
      ?? "Strani ni bilo mogoče obdelati zaradi zabeležene tehnične napake.";
    return `Vir »${outcome.label}« ni bil v celoti obdelan. Stran ${firstFailure.url}: ${reason}`;
  }
  return `Vir »${outcome.label}« ni bil v celoti obdelan. ${outcome.error ?? "Razlog ni bil zabeležen."}`;
}

export function KreatorSourceList({ tenantId, tenantName, origin }: { tenantId: string; tenantName: string; origin?: { latitude: number; longitude: number } }) {
  const queryClient = useQueryClient();
  const sourcesQuery = useListCreatorSources(tenantId, {
    query: { queryKey: getListCreatorSourcesQueryKey(tenantId) }
  });
  const runQuery = useGetLatestCreatorRun(tenantId, {
    query: {
      queryKey: getGetLatestCreatorRunQueryKey(tenantId),
      refetchInterval: (query) => query.state.data?.status === 'running' ? 2000 : false,
    }
  });

  const [newRows, setNewRows] = useState<Array<{ id: string; label: string; kind: string; url: string }>>([]);

  const proposeMutation = useProposeCreatorSources({
    mutation: {
      onSuccess: () => {
        setNewRows([]);
        queryClient.invalidateQueries({ queryKey: getListCreatorSourcesQueryKey(tenantId) });
      }
    }
  });

  const decideMutation = useDecideCreatorSource({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListCreatorSourcesQueryKey(tenantId) });
      }
    }
  });

  const approveListMutation = useApproveCreatorSourceList({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListCreatorSourcesQueryKey(tenantId) });
      }
    }
  });

  const startRunMutation = useStartCreatorRun({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetLatestCreatorRunQueryKey(tenantId) });
        queryClient.invalidateQueries({ queryKey: getListCreatorSourcesQueryKey(tenantId) });
      }
    }
  });

  const sourcesList = sourcesQuery.data;
  const sources = sourcesList?.sources ?? [];
  const isListApproved = sourcesList?.approval?.approved === true;
  const runSourceOutcomes = readCreatorSourceOutcomes(runQuery.data?.report);
  const sourceOutcomeWarnings = runSourceOutcomes
    .map(sourceOutcomeMessage)
    .filter((message): message is string => Boolean(message));
  const recordedRunError = readCreatorRunError(runQuery.data?.report);

  const proposed = sources.filter(s => s.status === 'proposed');
  const approved = sources.filter(s => s.status === 'approved');
  const rejected = sources.filter(s => s.status === 'rejected' || s.status === 'revoked');

  const pendingDecisions = proposed.length > 0 || newRows.length > 0;

  
  const addRow = () => {
    setNewRows(prev => [...prev, { id: crypto.randomUUID(), label: "", kind: "official_tourism", url: "" }]);
  };

  const removeRow = (id: string) => {
    setNewRows(prev => prev.filter(r => r.id !== id));
  };

  const updateRow = (id: string, field: string, value: string) => {
    setNewRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
  };

  const submitProposals = () => {
    const validRows = newRows.filter(r => r.label.trim() && r.url.trim());
    if (validRows.length === 0) return;
    proposeMutation.mutate({
      id: tenantId,
      data: {
        sources: validRows.map(r => ({ label: r.label.trim(), sourceKind: r.kind, url: r.url.trim() }))
      }
    });
  };

  const handleDecision = (sourceId: string, decision: 'approve' | 'reject' | 'revoke') => {
    decideMutation.mutate({ id: tenantId, sourceId, decision });
  };

  const isListReadyToApprove = sources.length > 0 && proposed.length === 0 && newRows.length === 0 && approved.length > 0;
  
  const isStartRunEnabled = isListApproved && approved.length > 0 && proposed.length === 0 && runQuery.data?.status !== 'running';

  const error = (proposeMutation.error as any)?.data?.error 
    || (decideMutation.error as any)?.data?.error 
    || (approveListMutation.error as any)?.data?.error 
    || (startRunMutation.error as any)?.data?.error;

  return (
    <div className="mt-6 max-w-[880px] space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl font-bold">1. korak: Ročni vnos uradnih virov</CardTitle>
          <p className="text-sm text-muted-foreground">Upravljajte uradne turistične in občinske vire vsebine za izluščevanje predlogov. Dodajte veljavne povezave.</p>
        </CardHeader>
        <CardContent className="space-y-6">
          {error && (
            <div className="flex items-start gap-2 rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-sm font-semibold text-destructive">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          {sourcesQuery.isLoading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Nalagam vire...
            </div>
          )}

          {!sourcesQuery.isLoading && (
            <div className="space-y-4">
              {sources.map(source => (
                <div key={source.id} className={`flex flex-col gap-3 rounded-xl border p-4 ${source.status === 'rejected' || source.status === 'revoked' ? 'bg-muted/50 border-dashed opacity-75' : 'bg-card'}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold truncate">{source.label}</h4>
                        <span className="rounded-full bg-background px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground border">
                          {source.status}
                        </span>
                        <span className="rounded-full bg-background px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground border">
                          {source.sourceKind}
                        </span>
                      </div>
                      <a href={source.url} target="_blank" rel="noreferrer" className="mt-1 block text-sm text-primary hover:underline truncate">
                        {source.url}
                      </a>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {source.status === 'proposed' && (
                        <>
                          <Button variant="outline" size="sm" onClick={() => handleDecision(source.id, 'approve')} disabled={decideMutation.isPending} className="text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 border-emerald-200">
                            <CheckCircle2 className="mr-1.5 h-4 w-4" /> Odobri
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => handleDecision(source.id, 'reject')} disabled={decideMutation.isPending} className="text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/20">
                            <XCircle className="mr-1.5 h-4 w-4" /> Zavrni
                          </Button>
                        </>
                      )}
                      {source.status === 'approved' && (
                        <Button variant="outline" size="sm" onClick={() => handleDecision(source.id, 'revoke')} disabled={decideMutation.isPending} className="text-amber-700 hover:text-amber-800 hover:bg-amber-50 border-amber-200">
                          <Undo2 className="mr-1.5 h-4 w-4" /> Prekliči odobritev
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {newRows.map(row => (
                <div key={row.id} className="flex flex-col gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <h4 className="font-bold text-sm">Nov vir</h4>
                    <Button variant="ghost" size="sm" onClick={() => removeRow(row.id)} className="h-8 px-2 text-muted-foreground">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="grid gap-4 md:grid-cols-[1fr_200px]">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-muted-foreground">Oznaka</label>
                      <Input value={row.label} onChange={e => updateRow(row.id, 'label', e.target.value)} placeholder="Npr. Občina Bled" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-muted-foreground">Vrsta</label>
                      <Select value={row.kind} onValueChange={v => updateRow(row.id, 'kind', v)}>
                        <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {SOURCE_KINDS.map(k => (
                            <SelectItem key={k} value={k}>{k}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <label className="text-xs font-bold text-muted-foreground">URL</label>
                      <Input value={row.url} onChange={e => updateRow(row.id, 'url', e.target.value)} placeholder="https://..." />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Button variant="outline" onClick={addRow} disabled={proposeMutation.isPending} className="gap-2 border-dashed">
              <Plus className="h-4 w-4" /> Dodaj predlog
            </Button>
            {newRows.length > 0 && (
              <Button onClick={submitProposals} disabled={proposeMutation.isPending || newRows.some(r => !r.label || !r.url)}>
                {proposeMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Shrani predloge
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="bg-muted/30 border-muted">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold">2. korak: Branje virov</h3>
              <p className="text-sm text-muted-foreground mt-1">Potrdite zbrani seznam in zaženite izluščevanje predlogov iz virov.</p>
            </div>
            
            <div className="flex flex-wrap items-center gap-3">
              <Button 
                variant="outline"
                disabled={!isListReadyToApprove || approveListMutation.isPending || isListApproved}
                onClick={() => approveListMutation.mutate({ id: tenantId })}
                className="gap-2 bg-white"
              >
                {approveListMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                {isListApproved ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : null}
                Potrdi seznam
              </Button>
              <Button 
                disabled={!isStartRunEnabled || startRunMutation.isPending}
                onClick={() => startRunMutation.mutate({ id: tenantId })}
                className="gap-2"
              >
                {(startRunMutation.isPending || runQuery.data?.status === 'running') ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
                Zaženi branje virov
              </Button>
            </div>
          </div>
          
          {runQuery.data && (
            <div className="mt-4 rounded-lg bg-white p-4 border text-sm space-y-2">
              <div className="flex justify-between items-center font-bold border-b pb-2 mb-2">
                <span>Status branja</span>
                <span className="uppercase text-xs tracking-wider">{runQuery.data.status}</span>
              </div>
              <p className="text-muted-foreground">Začeto: {new Date(runQuery.data.startedAt).toLocaleString('sl-SI')}</p>
              {runQuery.data.completedAt && (
                <p className="text-muted-foreground">Končano: {new Date(runQuery.data.completedAt).toLocaleString('sl-SI')}</p>
              )}
              {runSourceOutcomes.length > 0 && (
                <div className="space-y-2 border-t pt-3">
                  <p className="font-bold">Izidi po virih</p>
                  {runSourceOutcomes.map((outcome) => (
                    <div key={outcome.sourceId} className="rounded-md border p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-semibold">{outcome.label}</span>
                        <span className="text-xs font-bold uppercase tracking-wider">
                          {outcome.status === "completed"
                            ? "uspešno"
                            : outcome.status === "partial"
                            ? "delno uspešno"
                            : "neuspešno"}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Prebrane strani: {outcome.storedPages}; preskočene strani: {outcome.skippedPages}; najdena dejstva: {outcome.facts}
                      </p>
                      {sourceOutcomeMessage(outcome) && (
                        <p className="mt-2 text-sm font-semibold text-destructive">
                          {sourceOutcomeMessage(outcome)}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {(runQuery.data?.status === 'completed') && (
        <>
          {sourceOutcomeWarnings.length > 0 && (
            <div className="mt-8 rounded-xl border border-amber-300 bg-amber-50 p-6 text-amber-950">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                <h3 className="font-bold text-lg">Branje je končano z opozorili</h3>
              </div>
              {sourceOutcomeWarnings.map((message) => (
                <p key={message} className="mt-2 text-sm">{message}</p>
              ))}
              <p className="mt-3 text-sm">
                Preostali odobreni viri so bili obdelani; neuspeh tega vira ni ustavil celotnega zagona.
              </p>
            </div>
          )}
          <KreatorProposalQueue tenantId={tenantId} tenantName={tenantName} origin={origin} />
        </>
      )}
      {(runQuery.data?.status === 'failed') && (
        <div className="mt-8 rounded-xl border border-destructive/20 bg-destructive/5 p-6 text-center text-destructive">
          <AlertTriangle className="mx-auto h-8 w-8 mb-2" />
          <h3 className="font-bold text-lg">Branje virov ni uspelo</h3>
          {sourceOutcomeWarnings.length > 0 ? (
            sourceOutcomeWarnings.map((message) => (
              <p key={message} className="mt-2 text-sm">{message}</p>
            ))
          ) : (
            <p className="mt-2 text-sm">
              Zagon se je ustavil zaradi sistemske napake
              {recordedRunError ? `: ${recordedRunError}` : "."}
              {" "}V tem starejšem zapisu vir napake ni bil zabeležen.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
