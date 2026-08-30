import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  getListCreatorProposalsQueryKey,
  getGetLatestCreatorRunQueryKey,
  useApproveCreatorProposal,
  useApproveCreatorProposalsBulk,
  useGetLatestCreatorRun,
  useEditCreatorProposal,
  useListCreatorCategoryOptions,
  useListCreatorProposals,
  useRejectCreatorProposal,
  useStartCreatorRun,
} from "@workspace/api-client-react";
import { AlertTriangle, CheckCircle2, Loader2, Pencil, Play, ShieldAlert, XCircle } from "lucide-react";
import { AdminButton as Button } from "@/components/ui/button";
import { AdminCard as Card, AdminCardContent as CardContent } from "@/components/ui/card";
import { formatSlovenianCount } from "@/lib/slovenian-plural";

const locationForms = {
  one: "lokacijo",
  two: "lokaciji",
  few: "lokacije",
  other: "lokacij",
} as const;

export function KreatorProposalQueue({
  tenantId,
  tenantName,
}: {
  tenantId: string;
  tenantName: string;
}) {
  const queryClient = useQueryClient();
  const queue = useListCreatorProposals(tenantId);
  const latestRun = useGetLatestCreatorRun(tenantId);
  const categoryOptions = useListCreatorCategoryOptions(tenantId);
  const [selected, setSelected] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editCategoryId, setEditCategoryId] = useState<string>("");
  const [editTranslations, setEditTranslations] = useState<Array<{ language: "sl" | "en" | "de" | "it"; name: string; description: string }>>([]);
  useEffect(() => {
    setSelected([]);
    setEditingId(null);
  }, [tenantId]);
  const queryKey = getListCreatorProposalsQueryKey(tenantId);
  const refresh = async () => {
    setSelected([]);
    await queryClient.invalidateQueries({ queryKey });
  };
  const approveOne = useApproveCreatorProposal({
    mutation: { onSuccess: refresh },
  });
  const approveBulk = useApproveCreatorProposalsBulk({
    mutation: { onSuccess: refresh },
  });
  const startRun = useStartCreatorRun({
    mutation: {
      onSuccess: async () => {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey }),
          queryClient.invalidateQueries({ queryKey: getGetLatestCreatorRunQueryKey(tenantId) }),
        ]);
      },
      onSettled: async () => {
        await queryClient.invalidateQueries({
          queryKey: getGetLatestCreatorRunQueryKey(tenantId),
        });
      },
    },
  });
  const editOne = useEditCreatorProposal({
    mutation: {
      onSuccess: async () => {
        setEditingId(null);
        await refresh();
      },
    },
  });
  const rejectOne = useRejectCreatorProposal({
    mutation: { onSuccess: refresh },
  });
  const rows = queue.data ?? [];
  const eligible = useMemo(
    () => rows.filter((row) => row.status === "pending" && !row.requiresIndividualReview),
    [rows],
  );
  const pendingCount = rows.filter((row) => row.status === "pending").length;
  const unresolvedCount = rows.filter((row) => row.status === "unresolved").length;
  const selectedLocationCount = formatSlovenianCount(selected.length, locationForms);
  const error = (approveOne.error as any)?.data?.error
    ?? (approveBulk.error as any)?.data?.error
    ?? (startRun.error as any)?.data?.error
    ?? (editOne.error as any)?.data?.error
    ?? (rejectOne.error as any)?.data?.error
    ?? null;

  if (queue.isLoading) {
    return <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Nalagam vrsto za potrditev …</div>;
  }

  return (
    <section className="mt-8 max-w-[880px] space-y-4" data-testid="creator-proposal-queue">
      <Card>
        <CardContent className="space-y-4 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-[18px] font-[800]">C1 · Model → sito → OSRM</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Pravila in poziv modelu pripravi strežnik. Nič se ne objavi gostom.
              </p>
            </div>
            <Button
              type="button"
              disabled={startRun.isPending || latestRun.data?.status === "running" || latestRun.data?.status === "completed"}
              onClick={() => startRun.mutate({ id: tenantId })}
              className="rounded-[12px]"
            >
              {startRun.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
              {startRun.isPending ? "Kreator dela …" : "Zaženi C1 enkrat"}
            </Button>
          </div>
          {latestRun.data && (
            <div className="grid gap-2 rounded-xl bg-muted/60 p-4 text-sm md:grid-cols-3" data-testid="creator-run-report">
              <strong className="md:col-span-3">Poročilo izvedbe · {latestRun.data.status}</strong>
              <span>Predlagano: {latestRun.data.proposedCount}</span>
              <span>Potrjeno s sitom: {latestRun.data.confirmedCount}</span>
              <span>Ni bilo mogoče potrditi: {latestRun.data.unresolvedCount}</span>
              <span>Zunaj praktičnega izbora: {latestRun.data.outsidePracticalCount}</span>
              <span>Nad 20 min: {latestRun.data.outsideNearCount}</span>
              <span>Nad 90 min: {latestRun.data.outsideExcursionCount}</span>
              <span>OSRM brez poti: {latestRun.data.routeFailuresCount}</span>
              <span>Združenih dvojnikov: {latestRun.data.duplicatesMergedCount}</span>
              <span>Žetoni: {latestRun.data.inputTokens} + {latestRun.data.outputTokens}</span>
              <span>Strošek: ${latestRun.data.costUsd.toFixed(6)}</span>
              <span>Čas: {latestRun.data.wallClockMs === null ? "—" : `${(latestRun.data.wallClockMs / 1000).toFixed(1)} s`}</span>
              <span>Nominatim čakanje: {(latestRun.data.nominatimThrottleMs / 1000).toFixed(1)} s</span>
              <a
                className="text-primary underline underline-offset-2 md:col-span-3"
                href={latestRun.data.pricing.sourceUrl}
                target="_blank"
                rel="noreferrer"
              >
                Cena Terra na {latestRun.data.pricing.asOf}: ${latestRun.data.pricing.inputPerMillionUsd}/M vhodnih · ${latestRun.data.pricing.outputPerMillionUsd}/M izhodnih
              </a>
              {latestRun.data.error && <span className="text-destructive md:col-span-3">{latestRun.data.error}</span>}
              {latestRun.data.outcomes.length > 0 && (
                <details className="md:col-span-3">
                  <summary className="cursor-pointer font-bold">
                    Izidi in pravila zavrnitve ({latestRun.data.outcomes.length})
                  </summary>
                  <ol className="mt-2 max-h-64 list-decimal space-y-1 overflow-auto pl-5 font-mono text-xs">
                    {latestRun.data.outcomes.map((outcome, index) => (
                      <li key={`${outcome.proposedName}-${index}`}>
                        {outcome.proposedName} · {outcome.outcome}
                        {outcome.refusalRule ? ` · ${outcome.refusalRule}` : ""}
                      </li>
                    ))}
                  </ol>
                </details>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-[22px] font-[800] tracking-tight">Potrdite okolico</h2>
          <p className="mt-1 text-sm font-medium text-muted-foreground">
            {pendingCount} čaka · Ni bilo mogoče potrditi: {unresolvedCount}
          </p>
        </div>
        <Button
          type="button"
          disabled={selected.length === 0 || approveBulk.isPending}
          onClick={() => {
            if (!confirm(`Potrdi ${selectedLocationCount} za ${tenantName}?`)) return;
            approveBulk.mutate({ id: tenantId, data: { proposalIds: selected } });
          }}
          className="rounded-[12px]"
        >
          {approveBulk.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Potrdi {selectedLocationCount} za {tenantName}
        </Button>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-sm font-semibold text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {rows.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-sm font-medium text-muted-foreground">
            V tej izvedbi Kreatorja še ni predlogov.
          </CardContent>
        </Card>
      ) : rows.map((row) => {
        const selectable = row.status === "pending" && !row.requiresIndividualReview;
        const checked = selected.includes(row.id);
        return (
          <Card key={row.id} className="overflow-hidden">
            <CardContent className="flex flex-col gap-4 p-5 md:flex-row md:items-start">
              <label className="mt-1 flex shrink-0 items-center">
                <input
                  type="checkbox"
                  aria-label={`Izberi ${row.proposedName}`}
                  checked={checked}
                  disabled={!selectable}
                  onChange={(event) => setSelected((current) =>
                    event.target.checked
                      ? [...current, row.id]
                      : current.filter((id) => id !== row.id))}
                  className="h-4 w-4 accent-primary"
                />
              </label>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-[17px] font-[800]">{row.resolvedName ?? row.proposedName}</h3>
                  <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-[800] uppercase tracking-wide text-muted-foreground">
                    {row.status}
                  </span>
                </div>

                {row.resolvedAddress && (
                  <p className="mt-1 text-sm font-medium text-muted-foreground">{row.resolvedAddress}</p>
                )}

                {row.requiresIndividualReview && (
                  <div
                    className="mt-3 flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-[13px] font-[700] leading-relaxed text-amber-950"
                    data-testid={`shortened-query-badge-${row.id}`}
                  >
                    <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
                    <span>
                      potrjeno s skrajšano poizvedbo:
                      <span className="mt-0.5 block font-[800]">
                        {row.originalQuery} → {row.confirmedQuery}
                      </span>
                      <span className="mt-1 block text-[11px] font-[650] text-amber-800">
                        Množična potrditev ni dovoljena.
                      </span>
                    </span>
                  </div>
                )}

                {row.status === "unresolved" && (
                  <p className="mt-3 rounded-xl bg-slate-100 p-3 text-sm font-semibold text-slate-700">
                    Ni bilo mogoče potrditi · {row.refusalReason}
                  </p>
                )}

                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold text-muted-foreground">
                  {row.categoryLabel && <span>Kategorija: {row.categoryLabel}</span>}
                  {row.range && <span>Obseg: {row.range}</span>}
                  {row.straightLineDistanceM !== null && <span>Zračna razdalja {(row.straightLineDistanceM / 1000).toFixed(1)} km</span>}
                  {row.roadDistanceM !== null && <span>Cestna razdalja {(row.roadDistanceM / 1000).toFixed(1)} km</span>}
                  {row.travelDurationS !== null && <span>{Math.round(row.travelDurationS / 60)} min vožnje</span>}
                </div>
                {row.translations.find((translation) => translation.language === "sl")?.description && (
                  <p className="mt-3 text-sm leading-relaxed">
                    {row.translations.find((translation) => translation.language === "sl")?.description}
                  </p>
                )}
                {row.inclusionReason && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Utemeljitev modela: {row.inclusionReason}
                  </p>
                )}
                {row.geocodingLookupHint && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Iskalni namig: {row.geocodingLookupHint}
                  </p>
                )}
                {editingId === row.id && (
                  <div className="mt-4 space-y-3 rounded-xl border bg-muted/30 p-4">
                    <label className="block text-xs font-bold uppercase tracking-wide text-muted-foreground">
                      Kategorija
                      <select
                        value={editCategoryId}
                        onChange={(event) => setEditCategoryId(event.target.value)}
                        className="mt-1 h-10 w-full rounded-md border bg-white px-3 text-sm normal-case tracking-normal text-foreground"
                      >
                        <option value="">Brez ustrezne kategorije</option>
                        {(categoryOptions.data ?? []).map((category) => (
                          <option key={category.id} value={category.id}>{category.label}</option>
                        ))}
                      </select>
                    </label>
                    {editTranslations.map((translation, index) => (
                      <div key={translation.language} className="grid gap-2 md:grid-cols-[90px_1fr_2fr]">
                        <strong className="pt-2 text-xs uppercase">{translation.language}</strong>
                        <input
                          aria-label={`Ime ${translation.language}`}
                          value={translation.name}
                          onChange={(event) => setEditTranslations((current) => current.map((item, itemIndex) =>
                            itemIndex === index ? { ...item, name: event.target.value } : item))}
                          className="h-10 rounded-md border bg-white px-3 text-sm"
                        />
                        <textarea
                          aria-label={`Opis ${translation.language}`}
                          value={translation.description}
                          onChange={(event) => setEditTranslations((current) => current.map((item, itemIndex) =>
                            itemIndex === index ? { ...item, description: event.target.value } : item))}
                          className="min-h-20 rounded-md border bg-white px-3 py-2 text-sm"
                        />
                      </div>
                    ))}
                    <div className="flex flex-wrap justify-end gap-2">
                      <Button type="button" variant="ghost" onClick={() => setEditingId(null)}>Prekliči</Button>
                      <Button
                        type="button"
                        disabled={editOne.isPending || editTranslations.some((translation) => !translation.name.trim())}
                        onClick={() => editOne.mutate({
                          id: tenantId,
                          proposalId: row.id,
                          data: { categoryId: editCategoryId || null, translations: editTranslations },
                        })}
                      >
                        {editOne.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Shrani ureditev
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {(row.status === "pending" || row.status === "unresolved") && (
                <div className="flex shrink-0 flex-row flex-wrap gap-2 md:flex-col">
                  {row.status === "pending" && (
                    <Button
                      type="button"
                      variant="outline"
                      disabled={approveOne.isPending}
                      onClick={() => {
                        if (!confirm(`Potrdi lokacijo "${row.resolvedName ?? row.proposedName}" za ${tenantName}?`)) return;
                        approveOne.mutate({ id: tenantId, proposalId: row.id });
                      }}
                      className="rounded-[12px]"
                    >
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Potrdi
                    </Button>
                  )}
                  {row.status === "pending" && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setEditingId(row.id);
                        setEditCategoryId(row.categoryId ?? "");
                        setEditTranslations(["sl", "en", "de", "it"].map((language) => {
                          const existing = row.translations.find((translation) => translation.language === language);
                          return {
                            language: language as "sl" | "en" | "de" | "it",
                            name: existing?.name ?? row.proposedName,
                            description: existing?.description ?? "",
                          };
                        }));
                      }}
                      className="rounded-[12px]"
                    >
                      <Pencil className="mr-2 h-4 w-4" />
                      Uredi
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    disabled={rejectOne.isPending}
                    onClick={() => {
                      if (!confirm(`Zavrni lokacijo "${row.resolvedName ?? row.proposedName}"? Ime bo trajno ostalo na seznamu zavrnjenih.`)) return;
                      rejectOne.mutate({ id: tenantId, proposalId: row.id });
                    }}
                    className="rounded-[12px] text-destructive"
                  >
                    <XCircle className="mr-2 h-4 w-4" />
                    Zavrni
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}

      {eligible.length > 0 && selected.length === 0 && (
        <p className="text-xs font-medium text-muted-foreground">
          Za množično potrditev izberite običajno potrjene predloge. Oslabljene potrditve ostanejo izključene.
        </p>
      )}
    </section>
  );
}