import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  getListCreatorProposalsQueryKey,
  useApproveCreatorProposal,
  useApproveCreatorProposalsBulk,
  useListCreatorProposals,
} from "@workspace/api-client-react";
import { AlertTriangle, CheckCircle2, Loader2, ShieldAlert } from "lucide-react";
import { AdminButton as Button } from "@/components/ui/button";
import { AdminCard as Card, AdminCardContent as CardContent } from "@/components/ui/card";

export function KreatorProposalQueue({
  tenantId,
  tenantName,
}: {
  tenantId: string;
  tenantName: string;
}) {
  const queryClient = useQueryClient();
  const queue = useListCreatorProposals(tenantId);
  const [selected, setSelected] = useState<string[]>([]);
  useEffect(() => {
    setSelected([]);
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
  const rows = queue.data ?? [];
  const eligible = useMemo(
    () => rows.filter((row) => row.status === "pending" && !row.requiresIndividualReview),
    [rows],
  );
  const pendingCount = rows.filter((row) => row.status === "pending").length;
  const unresolvedCount = rows.filter((row) => row.status === "unresolved").length;
  const error = (approveOne.error as any)?.data?.error
    ?? (approveBulk.error as any)?.data?.error
    ?? null;

  if (queue.isLoading) {
    return <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Nalagam vrsto za potrditev …</div>;
  }

  return (
    <section className="mt-8 max-w-[880px] space-y-4" data-testid="creator-proposal-queue">
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
            if (!confirm(`Potrdi ${selected.length} lokacij za ${tenantName}?`)) return;
            approveBulk.mutate({ id: tenantId, data: { proposalIds: selected } });
          }}
          className="rounded-[12px]"
        >
          {approveBulk.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Potrdi {selected.length} lokacij za {tenantName}
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
                  {row.straightLineDistanceM !== null && <span>Zračna razdalja {(row.straightLineDistanceM / 1000).toFixed(1)} km</span>}
                  {row.roadDistanceM !== null && <span>Cestna razdalja {(row.roadDistanceM / 1000).toFixed(1)} km</span>}
                  {row.travelDurationS !== null && <span>{Math.round(row.travelDurationS / 60)} min vožnje</span>}
                </div>
              </div>

              {row.status === "pending" && (
                <Button
                  type="button"
                  variant="outline"
                  disabled={approveOne.isPending}
                  onClick={() => {
                    if (!confirm(`Potrdi lokacijo "${row.resolvedName ?? row.proposedName}" za ${tenantName}?`)) return;
                    approveOne.mutate({ id: tenantId, proposalId: row.id });
                  }}
                  className="shrink-0 rounded-[12px]"
                >
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Potrdi za {tenantName}
                </Button>
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