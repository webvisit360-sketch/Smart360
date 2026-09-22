import { useMemo, useState } from "react";
import { format } from "date-fns";
import { AlertCircle, Image as ImageIcon, Loader2, UserRoundCog } from "lucide-react";
import { getListCreatorProposalsQueryKey, useListCreatorProposals } from "@workspace/api-client-react";
import {
  OwnerOnboardingRound,
  useGetOwnerOnboarding,
  useOpenOnboarding,
  useReopenOnboarding,
} from "@/hooks/use-host-onboarding";
import { AdminCard as Card, AdminCardContent as CardContent, AdminCardHeader as CardHeader, CardTitle } from "@/components/ui/card";
import { AdminButton as Button } from "@/components/ui/button";

const creatorStatusLabels = {
  pending: "Čaka na pregled",
  unresolved: "Lokacija ni razrešena",
  approved: "Potrjeno",
  rejected: "Zavrnjeno",
  superseded: "Nadomeščeno",
};

function RoundReview({
  round,
  creatorStatuses,
  creatorQueuePending,
  creatorQueueError,
}: {
  round: OwnerOnboardingRound;
  creatorStatuses: Map<string, keyof typeof creatorStatusLabels>;
  creatorQueuePending: boolean;
  creatorQueueError: boolean;
}) {
  const creatorStatus = (proposalId: string | null) => {
    if (!proposalId) return "Ni v Creator vrsti";
    if (creatorQueuePending) return "Preverjanje stanja …";
    if (creatorQueueError) return "Stanja ni bilo mogoče naložiti";
    const status = creatorStatuses.get(proposalId);
    return status ? creatorStatusLabels[status] : "Stanje ni na voljo";
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${round.status === "draft" ? "bg-amber-100 text-amber-800" : "bg-green-100 text-green-800"}`}>
          {round.status === "draft" ? "V izpolnjevanju" : "Oddano"}
        </span>
        {round.status === "submitted" && round.submittedAt && (
          <span className="text-sm text-muted-foreground">
            {format(new Date(round.submittedAt), "dd. MM. yyyy HH:mm")}
          </span>
        )}
        <span className="text-sm text-muted-foreground">Krog {round.round}</span>
        <span className="text-sm text-muted-foreground sm:ml-auto">Posodobljeno {format(new Date(round.updatedAt), "dd. MM. yyyy HH:mm")}</span>
      </div>

      <section>
        <h3 className="font-semibold border-b pb-2 mb-3">Predlogi za okolico</h3>
        {round.recommendations.length ? <ul className="space-y-2">{round.recommendations.map((item, index) => (
          <li key={`${item.categoryKey}-${index}`} className="rounded-lg bg-muted/50 p-3 text-sm flex flex-wrap justify-between gap-x-3 gap-y-1">
            <span className="min-w-0 break-words"><span className="text-muted-foreground">{item.categoryKey}:</span> <b>{item.name}</b></span>
            <span className="text-muted-foreground">{creatorStatus(item.proposalId)}</span>
          </li>
        ))}</ul> : <p className="text-sm text-muted-foreground">Ni predlogov za okolico.</p>}
      </section>

      <section>
        <h3 className="font-semibold border-b pb-2 mb-3">Gostiteljeve kategorije</h3>
        {round.customCategories.length ? (
          <div className="space-y-3">
            {round.customCategories.map((category) => (
              <div key={category.id} className="min-w-0 rounded-xl border border-amber-200 bg-amber-50/40 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="min-w-0 break-words font-semibold">{category.name}</h4>
                  <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">
                    Gostiteljeva kategorija
                  </span>
                </div>
                <p className="mt-1 break-words text-xs text-muted-foreground">
                  Izvor: {category.provenance === "host_onboarding" ? "Obrazec gostitelja" : category.provenance}
                  {category.categoryId ? <> · Kategorija ustvarjena: <span className="break-all">{category.categoryId}</span></> : " · Čaka na obravnavo operaterja"}
                </p>
                {category.entries.length ? (
                  <ul className="mt-3 space-y-2">
                    {category.entries.map((entry) => (
                      <li key={entry.id} className="flex flex-wrap justify-between gap-2 rounded-lg bg-white px-3 py-2 text-sm">
                        <b className="min-w-0 break-words">{entry.name}</b>
                        <span className="text-muted-foreground">
                          {creatorStatus(entry.proposalId)}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 text-sm text-muted-foreground">Gostitelj še ni dodal priporočil.</p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Gostitelj ni predlagal svojih kategorij.</p>
        )}
      </section>

      <section>
        <h3 className="font-semibold border-b pb-2 mb-3">Dogodki</h3>
        {round.events.length ? <ul className="space-y-2">{round.events.map((event) => (
          <li key={event.id} className="rounded-lg bg-muted/50 p-3 text-sm flex flex-wrap justify-between gap-2">
            <b className="min-w-0 break-words">{event.name || "Dogodek brez naziva"}</b><span>{event.date || "Brez datuma"} · {event.time || "Brez ure"}</span>
          </li>
        ))}</ul> : <p className="text-sm text-muted-foreground">Ni predlaganih dogodkov.</p>}
      </section>

      <section>
        <h3 className="font-semibold border-b pb-2 mb-3">Fotografije</h3>
        {round.photos.length ? <div className="grid grid-cols-2 md:grid-cols-4 gap-3">{round.photos.map((photo) => (
          <figure key={photo.id} className="min-w-0 rounded-lg border overflow-hidden">
            {photo.status === "uploading" ? <div className="aspect-square flex items-center justify-center"><Loader2 className="animate-spin" /></div> :
              <img src={photo.previewUrl} alt={photo.fileName} className="w-full aspect-square object-cover" />}
            <figcaption className="p-2 text-xs break-all">{photo.fileName}<br /><span className="text-muted-foreground">{photo.status === "submitted" ? "Oddano" : photo.status === "ready" ? "Pripravljeno" : "Nalaganje"}</span></figcaption>
          </figure>
        ))}</div> : <p className="text-sm text-muted-foreground flex gap-2"><ImageIcon className="w-4 h-4" /> Ni fotografij.</p>}
      </section>
    </div>
  );
}

export function HostOnboardingReview({ tenantId }: { tenantId: string }) {
  const query = useGetOwnerOnboarding(tenantId, { enabled: !!tenantId });
  const creatorQueue = useListCreatorProposals(tenantId, {
    query: {
      queryKey: getListCreatorProposalsQueryKey(tenantId),
      enabled: !!tenantId,
      refetchOnMount: true,
    },
  });
  const openMutation = useOpenOnboarding(tenantId);
  const reopenMutation = useReopenOnboarding(tenantId);
  const rounds = useMemo(() => [...(query.data?.rounds || [])].sort((a, b) => b.round - a.round), [query.data]);
  const creatorStatuses = useMemo(
    () => new Map((creatorQueue.data || []).map((proposal) => [proposal.id, proposal.status])),
    [creatorQueue.data],
  );
  const [selectedRound, setSelectedRound] = useState<number>();
  const activeRound = rounds.find((item) => item.round === selectedRound) || rounds[0];

  if (query.isLoading) return <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  if (query.isError) return <Card><CardContent className="p-8 text-center"><AlertCircle className="mx-auto mb-3 text-red-600" /><p className="font-semibold">Podatkov obrazca ni bilo mogoče naložiti.</p><p className="text-sm text-red-700 mt-1">{query.error.message}</p><Button className="mt-4" variant="outline" onClick={() => void query.refetch()}>Poskusi znova</Button></CardContent></Card>;

  if (!activeRound) return <Card><CardHeader><CardTitle>Obrazec za gostitelja</CardTitle></CardHeader><CardContent><div className="text-center p-8 border-2 border-dashed rounded-2xl flex flex-col items-center gap-4"><UserRoundCog className="w-12 h-12 opacity-20" /><p>Gostitelj še nima odprtega obrazca.</p><Button onClick={() => openMutation.mutate()} disabled={openMutation.isPending}>{openMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Odpri obrazec</Button></div></CardContent></Card>;

  return <Card>
    <CardHeader className="gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <CardTitle className="min-w-0 break-words">Vsebina gostitelja</CardTitle>
        {rounds[0]?.status === "submitted" && <Button variant="outline" onClick={() => reopenMutation.mutate(crypto.randomUUID())} disabled={reopenMutation.isPending}>{reopenMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Ponovno odpri obrazec</Button>}
      </div>
      {rounds.length > 1 && (
        <div className="flex flex-wrap gap-2" aria-label="Zgodovina krogov">
          {rounds.map((round) => <Button key={round.id} size="sm" variant={round.id === activeRound.id ? "default" : "outline"} onClick={() => setSelectedRound(round.round)}>Krog {round.round} · {round.status === "submitted" ? "oddan" : "osnutek"}</Button>)}
        </div>
      )}
      {(openMutation.error || reopenMutation.error) && <p className="text-sm text-red-700">{(openMutation.error || reopenMutation.error)?.message}</p>}
    </CardHeader>
    <CardContent>
      <RoundReview
        round={activeRound}
        creatorStatuses={creatorStatuses}
        creatorQueuePending={creatorQueue.isLoading}
        creatorQueueError={creatorQueue.isError}
      />
    </CardContent>
  </Card>;
}