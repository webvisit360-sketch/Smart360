import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetPublicTenantQueryKey,
  getGetTenantQueryKey,
  getListItemCreatorPhotoProposalsQueryKey,
  getListCreatorPhotoProposalsQueryKey,
  getListTenantOverviewQueryKey,
  useApproveCreatorPhotoProposal,
  useDiscoverCreatorPhotos,
  useDiscoverItemCreatorPhotos,
  useListItemCreatorPhotoProposals,
  useListCreatorPhotoProposals,
  useRejectCreatorPhotoProposal,
} from "@workspace/api-client-react";
import { Check, ExternalLink, Loader2, Search, X } from "lucide-react";
import { AdminButton as Button } from "@/components/ui/button";
import { AdminCard as Card, AdminCardContent as CardContent, AdminCardHeader as CardHeader, CardTitle } from "@/components/ui/card";

function errorMessage(error: any) {
  return error?.data?.error || error?.data?.message || error?.message || "Dejanje ni uspelo.";
}

export function ItemCreatorPhotoProposals({
  tenantId,
  itemId,
}: {
  tenantId: string;
  itemId: string;
}) {
  const queryClient = useQueryClient();
  const proposalKey = getListItemCreatorPhotoProposalsQueryKey(itemId);
  const proposals = useListItemCreatorPhotoProposals(itemId);
  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: proposalKey }),
      queryClient.invalidateQueries({ queryKey: getGetTenantQueryKey(tenantId) }),
    ]);
  };
  const discover = useDiscoverItemCreatorPhotos({
    mutation: { onSuccess: refresh },
  });
  const approve = useApproveCreatorPhotoProposal({ mutation: { onSuccess: refresh } });
  const reject = useRejectCreatorPhotoProposal({ mutation: { onSuccess: refresh } });
  const rows = proposals.data ?? [];

  return (
    <div className="mt-3 space-y-3 rounded-lg border bg-muted/20 p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">Wikimedia Commons</p>
          <p className="text-xs text-muted-foreground">Iskanje samo za ta vnos (Wikidata P18, nato geosearch).</p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={discover.isPending}
          onClick={() => discover.mutate({ id: itemId })}
        >
          {discover.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Search className="mr-1 h-4 w-4" />}
          Poišči
        </Button>
      </div>
      {(discover.isError || proposals.isError || approve.isError || reject.isError) && (
        <p role="alert" className="text-xs text-destructive">
          {errorMessage(discover.error || proposals.error || approve.error || reject.error)}
        </p>
      )}
      {proposals.isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">Za ta vnos še ni predlogov.</p>
      ) : (
        <div className="space-y-2">
          {rows.map((proposal) => {
            const pending = proposal.status === "pending";
            const rowBusy =
              (approve.isPending && approve.variables?.photoProposalId === proposal.id) ||
              (reject.isPending && reject.variables?.photoProposalId === proposal.id);
            return (
              <div key={proposal.id} className="flex gap-3 rounded-md border bg-background p-2">
                <img src={proposal.thumbnailUrl} alt="" className="h-16 w-24 rounded object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm">{proposal.author} · {proposal.license}</p>
                  <p className="text-xs text-muted-foreground">
                    Zanesljivost: {proposal.confidence === "high" ? "visoka" : "nizka"} · {proposal.discoveryMethod === "wikidata" ? "Wikidata" : "geosearch"}
                  </p>
                  <a href={proposal.sourcePageUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                    Commons <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
                {pending && (
                  <div className="flex shrink-0 flex-col gap-1">
                    <Button type="button" size="sm" disabled={rowBusy} onClick={() => approve.mutate({ id: tenantId, photoProposalId: proposal.id })}>
                      <Check className="mr-1 h-3 w-3" />Odobri
                    </Button>
                    <Button type="button" size="sm" variant="outline" disabled={rowBusy} onClick={() => reject.mutate({ id: tenantId, photoProposalId: proposal.id })}>
                      <X className="mr-1 h-3 w-3" />Zavrni
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function KreatorPhotoProposals({
  tenantId,
  tenantSlug,
  content,
}: {
  tenantId: string;
  tenantSlug: string;
  content?: any;
}) {
  const queryClient = useQueryClient();
  const proposals = useListCreatorPhotoProposals(tenantId, {
    query: { enabled: Boolean(tenantId), queryKey: getListCreatorPhotoProposalsQueryKey(tenantId) },
  });
  const [report, setReport] = useState<any | null>(null);
  const photoKey = getListCreatorPhotoProposalsQueryKey(tenantId);
  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: photoKey }),
      queryClient.invalidateQueries({ queryKey: getGetPublicTenantQueryKey(tenantSlug, { preview: true }) }),
      queryClient.invalidateQueries({ queryKey: getListTenantOverviewQueryKey() }),
    ]);
  };
  const discover = useDiscoverCreatorPhotos({
    mutation: {
      onSuccess: async (nextReport) => {
        setReport(nextReport);
        await refresh();
      },
    },
  });
  const approve = useApproveCreatorPhotoProposal({ mutation: { onSuccess: refresh } });
  const reject = useRejectCreatorPhotoProposal({ mutation: { onSuccess: refresh } });
  const titleByItemId = useMemo(() => {
    const titles = new Map<string, string>();
    (content?.sections ?? []).forEach((section: any) =>
      (section.categories ?? []).forEach((category: any) =>
        (category.items ?? []).forEach((item: any) => {
          if (item?.id) titles.set(item.id, item.title || item.name || category.label || "Lokacija");
        }),
      ),
    );
    return titles;
  }, [content]);
  const rows = proposals.data ?? [];

  return (
    <Card className="mt-6">
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <div>
          <CardTitle>Fotografije Wikimedia Commons</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">Predlogi so dodani šele po odobritvi.</p>
        </div>
        <Button onClick={() => discover.mutate({ id: tenantId })} disabled={discover.isPending}>
          {discover.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
          Poišči fotografije (Wikimedia)
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {discover.isError && <p role="alert" className="text-sm text-destructive">Iskanje fotografij ni uspelo: {errorMessage(discover.error)}</p>}
        {report && (
          <div className="rounded-md border bg-muted/30 p-3 text-sm" data-testid="creator-photo-discovery-report">
            <p className="font-medium">Poročilo iskanja ({report.eligiblePlaces} lokacij)</p>
            <ul className="mt-1 space-y-1 text-muted-foreground">
              {report.outcomes?.map((outcome: any) => (
                <li key={outcome.itemId}>
                  <strong className="text-foreground">{outcome.name || titleByItemId.get(outcome.itemId) || "Lokacija"}</strong>
                  {" · "}{outcome.outcome === "wikidata" ? "Najdeno prek Wikidata" : outcome.outcome === "geosearch" ? "Najdeno prek geosearch" : "Ni najdenih prostih fotografij"}
                </li>
              ))}
            </ul>
          </div>
        )}
        {proposals.isLoading ? (
          <div className="flex justify-center py-5"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : proposals.isError ? (
          <p role="alert" className="text-sm text-destructive">Predlogov ni mogoče naložiti: {errorMessage(proposals.error)}</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Še ni predlogov fotografij.</p>
        ) : (
          <div className="space-y-3">
            {rows.map((proposal) => {
              const busy = (approve.isPending && approve.variables?.photoProposalId === proposal.id) || (reject.isPending && reject.variables?.photoProposalId === proposal.id);
              return (
                <div key={proposal.id} className="flex gap-3 rounded-lg border p-3">
                  <img src={proposal.thumbnailUrl} alt="" className="h-20 w-28 rounded object-cover bg-muted" />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{titleByItemId.get(proposal.itemId) || "Lokacija"}</p>
                    <p className="text-sm text-muted-foreground">{proposal.author} · {proposal.license}</p>
                    <p className="text-xs text-muted-foreground">Zanesljivost: {proposal.confidence === "high" ? "visoka" : "nizka"} · {proposal.discoveryMethod === "wikidata" ? "Wikidata" : "geosearch"} · Stanje: {proposal.status}</p>
                    <a href={proposal.sourcePageUrl} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-sm text-primary hover:underline">Wikimedia Commons <ExternalLink className="h-3 w-3" /></a>
                  </div>
                  {proposal.status === "pending" && (
                    <div className="flex shrink-0 flex-col gap-2">
                      <Button size="sm" disabled={busy} onClick={() => approve.mutate({ id: tenantId, photoProposalId: proposal.id })}><Check className="mr-1 h-4 w-4" />Odobri</Button>
                      <Button size="sm" variant="outline" disabled={busy} onClick={() => reject.mutate({ id: tenantId, photoProposalId: proposal.id })}><X className="mr-1 h-4 w-4" />Zavrni</Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {(approve.isError || reject.isError) && <p role="alert" className="text-sm text-destructive">Posodobitev predloga ni uspela: {errorMessage(approve.error || reject.error)}</p>}
      </CardContent>
    </Card>
  );
}