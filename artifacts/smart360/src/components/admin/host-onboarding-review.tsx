import { useMemo, useState } from "react";
import { format } from "date-fns";
import { AlertCircle, Image as ImageIcon, Loader2, UserRoundCog } from "lucide-react";
import {
  OwnerOnboardingRound,
  useGetOwnerOnboarding,
  useOpenOnboarding,
  useReopenOnboarding,
} from "@/hooks/use-host-onboarding";
import { AdminCard as Card, AdminCardContent as CardContent, AdminCardHeader as CardHeader, CardTitle } from "@/components/ui/card";
import { AdminButton as Button } from "@/components/ui/button";

const targetNames: Record<string, string> = {
  "tenant.name": "Naziv nastanitve",
  "tenant.address": "Naslov",
  "tenant.phone": "Telefon",
  "tenant.email": "E-pošta",
  "tenant.wifiSsid": "Ime omrežja Wi-Fi",
  "tenant.wifiPass": "Geslo Wi-Fi",
  "contact.website": "Spletna stran",
  "contact.people": "Kontaktne osebe",
  "item.check": "Prijava in odjava",
  "item.house": "Hišni red",
  "item.park": "Parkiranje",
  offer: "Ponudba",
};

const showValue = (value: unknown) => {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "string") return value;
  return JSON.stringify(value, null, 2);
};

function RoundReview({ round }: { round: OwnerOnboardingRound }) {
  const notificationLabels = {
    pending: "Čaka na pošiljanje",
    sending: "Pošiljanje",
    sent: "Poslano",
    failed: "Pošiljanje ni uspelo",
  };
  const historicalReview = round.targetReview.filter(
    (item) => item.target !== "workflow.canonical_binding_v1",
  );
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${round.status === "draft" ? "bg-amber-100 text-amber-800" : "bg-green-100 text-green-800"}`}>
          {round.status === "draft" ? "V izpolnjevanju" : "Oddano"}
        </span>
        <span className="text-sm text-muted-foreground">Krog {round.round}</span>
        <span className="text-sm text-muted-foreground md:ml-auto">
          Zadnja sprememba: {format(new Date(round.updatedAt), "dd. MM. yyyy HH:mm")}
        </span>
      </div>

      <section>
        <h3 className="font-semibold border-b pb-2 mb-3">Podatki gostitelja</h3>
        <dl className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          {[
            ["Naziv", round.data.accommodationName], ["Naslov", round.data.address],
            ["Telefon", round.data.guestPhone], ["E-pošta", round.data.guestEmail],
            ["Spletna stran", round.data.website], ["Prijava od", round.data.checkInFrom],
            ["Odjava do", round.data.checkOutUntil], ["Omrežje Wi-Fi", round.data.wifiName],
            ["Geslo Wi-Fi", round.data.wifiPassword],
          ].map(([label, value]) => <div key={label}><dt className="text-muted-foreground">{label}</dt><dd className="font-medium whitespace-pre-wrap">{value || "—"}</dd></div>)}
        </dl>
        <p className="mt-4 text-sm whitespace-pre-wrap bg-muted/50 p-3 rounded-md">{round.data.houseRulesParking || "Hišni red in parkiranje nista vpisana."}</p>
      </section>

      <section>
        <h3 className="font-semibold border-b pb-2 mb-3">Skupni osnutek vodnika</h3>
        <p className="mb-3 text-sm text-muted-foreground">
          Podatki obrazca so neposredno povezani z osnutkom v administraciji. Shranjevanje
          obrazca vsebine ne objavi gostom.
        </p>
        {historicalReview.length ? (
          <div className="space-y-3">
            {historicalReview.map((item, index) => (
              <div key={`${item.target}-${index}`} className="rounded-xl border p-4">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <h4 className="font-semibold">{targetNames[item.target] || item.target}</h4>
                  <span className={`text-xs font-semibold rounded-full px-2 py-1 ${item.resolution === "suggestion" ? "bg-amber-100 text-amber-800" : item.resolution === "filled_blank" ? "bg-green-100 text-green-800" : "bg-slate-100 text-slate-700"}`}>
                    {item.resolution === "suggestion" ? "Zgodovinski predlog" : item.resolution === "filled_blank" ? "Dodano v osnutek" : "Brez spremembe"}
                  </span>
                </div>
                <div className="grid md:grid-cols-2 gap-3 text-sm">
                  <div><p className="text-muted-foreground mb-1">Obstoječa vrednost</p><pre className="font-sans whitespace-pre-wrap bg-muted/50 rounded-lg p-3">{showValue(item.operatorValue)}</pre></div>
                  <div><p className="text-muted-foreground mb-1">Vrednost gostitelja</p><pre className="font-sans whitespace-pre-wrap bg-muted/50 rounded-lg p-3">{showValue(item.hostValue)}</pre></div>
                </div>
                {item.suggestionVisible && <p className="mt-2 text-xs text-amber-800">To je zapis starejšega kroga pred neposredno povezavo osnutka.</p>}
              </div>
            ))}
          </div>
        ) : <p className="text-sm text-muted-foreground">Obrazec in administracija prikazujeta isti trenutni osnutek.</p>}
      </section>

      <section>
        <h3 className="font-semibold border-b pb-2 mb-3">Predlogi za okolico</h3>
        {round.recommendations.length ? <ul className="space-y-2">{round.recommendations.map((item, index) => (
          <li key={`${item.categoryKey}-${index}`} className="rounded-lg bg-muted/50 p-3 text-sm flex justify-between gap-3">
            <span><span className="text-muted-foreground">{item.categoryKey}:</span> <b>{item.name}</b></span>
            <span className="text-muted-foreground">{item.proposalId ? "Predlog ustvarjen" : "Brez predloga"}</span>
          </li>
        ))}</ul> : <p className="text-sm text-muted-foreground">Ni predlogov za okolico.</p>}
      </section>

      <section>
        <h3 className="font-semibold border-b pb-2 mb-3">Gostiteljeve kategorije</h3>
        {round.customCategories.length ? (
          <div className="space-y-3">
            {round.customCategories.map((category) => (
              <div key={category.id} className="rounded-xl border border-amber-200 bg-amber-50/40 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="font-semibold">{category.name}</h4>
                  <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">
                    Gostiteljeva kategorija
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Izvor: {category.provenance === "host_onboarding" ? "Obrazec gostitelja" : category.provenance}
                  {category.categoryId ? ` · Kategorija ustvarjena: ${category.categoryId}` : " · Čaka na obravnavo operaterja"}
                </p>
                {category.entries.length ? (
                  <ul className="mt-3 space-y-2">
                    {category.entries.map((entry) => (
                      <li key={entry.id} className="flex flex-wrap justify-between gap-2 rounded-lg bg-white px-3 py-2 text-sm">
                        <b>{entry.name}</b>
                        <span className="text-muted-foreground">
                          {entry.proposalId ? "Predlog ustvarjen" : "Brez predloga"}
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
            <b>{event.name || "Dogodek brez naziva"}</b><span>{event.date || "Brez datuma"} · {event.time || "Brez ure"} · V skupnem osnutku</span>
          </li>
        ))}</ul> : <p className="text-sm text-muted-foreground">Ni predlaganih dogodkov.</p>}
      </section>

      <section>
        <h3 className="font-semibold border-b pb-2 mb-3">Fotografije</h3>
        {round.photos.length ? <div className="grid grid-cols-2 md:grid-cols-4 gap-3">{round.photos.map((photo) => (
          <figure key={photo.id} className="rounded-lg border overflow-hidden">
            {photo.status === "uploading" ? <div className="aspect-square flex items-center justify-center"><Loader2 className="animate-spin" /></div> :
              <img src={photo.previewUrl} alt={photo.fileName} className="w-full aspect-square object-cover" />}
            <figcaption className="p-2 text-xs break-all">{photo.fileName}<br /><span className="text-muted-foreground">{photo.status === "submitted" ? "Oddano" : photo.status === "ready" ? "Pripravljeno" : "Nalaganje"}</span></figcaption>
          </figure>
        ))}</div> : <p className="text-sm text-muted-foreground flex gap-2"><ImageIcon className="w-4 h-4" /> Ni fotografij.</p>}
      </section>

      <section className="rounded-xl border p-4">
        <h3 className="font-semibold mb-2">Obvestilo operaterju</h3>
        <p className="text-sm">Stanje: <b>{notificationLabels[round.notification.status]}</b></p>
        <p className="text-sm">Prejemnik: {round.notification.recipient}</p>
        {round.notification.attemptedAt && <p className="text-sm text-muted-foreground">Poskus: {format(new Date(round.notification.attemptedAt), "dd. MM. yyyy HH:mm")}</p>}
        {round.notification.error && <p className="text-sm text-red-700 mt-2">Napaka: {round.notification.error}</p>}
      </section>
    </div>
  );
}

export function HostOnboardingReview({ tenantId }: { tenantId: string }) {
  const query = useGetOwnerOnboarding(tenantId, { enabled: !!tenantId });
  const openMutation = useOpenOnboarding(tenantId);
  const reopenMutation = useReopenOnboarding(tenantId);
  const rounds = useMemo(() => [...(query.data?.rounds || [])].sort((a, b) => b.round - a.round), [query.data]);
  const [selectedRound, setSelectedRound] = useState<number>();
  const activeRound = rounds.find((item) => item.round === selectedRound) || rounds[0];

  if (query.isLoading) return <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  if (query.isError) return <Card><CardContent className="p-8 text-center"><AlertCircle className="mx-auto mb-3 text-red-600" /><p className="font-semibold">Podatkov obrazca ni bilo mogoče naložiti.</p><p className="text-sm text-red-700 mt-1">{query.error.message}</p><Button className="mt-4" variant="outline" onClick={() => void query.refetch()}>Poskusi znova</Button></CardContent></Card>;

  if (!activeRound) return <Card><CardHeader><CardTitle>Obrazec za gostitelja</CardTitle></CardHeader><CardContent><div className="text-center p-8 border-2 border-dashed rounded-2xl flex flex-col items-center gap-4"><UserRoundCog className="w-12 h-12 opacity-20" /><p>Gostitelj še nima odprtega obrazca.</p><Button onClick={() => openMutation.mutate()} disabled={openMutation.isPending}>{openMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Odpri obrazec</Button></div></CardContent></Card>;

  return <Card>
    <CardHeader className="gap-4">
      <div className="flex flex-wrap justify-between gap-3">
        <CardTitle>Skupni osnutek gostitelja in operaterja</CardTitle>
        {rounds[0]?.status === "submitted" && <Button variant="outline" onClick={() => reopenMutation.mutate(crypto.randomUUID())} disabled={reopenMutation.isPending}>{reopenMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Ponovno odpri obrazec</Button>}
      </div>
      <div className="flex flex-wrap gap-2" aria-label="Zgodovina krogov">
        {rounds.map((round) => <Button key={round.id} size="sm" variant={round.id === activeRound.id ? "default" : "outline"} onClick={() => setSelectedRound(round.round)}>Krog {round.round} · {round.status === "submitted" ? "oddan" : "osnutek"}</Button>)}
      </div>
      {(openMutation.error || reopenMutation.error) && <p className="text-sm text-red-700">{(openMutation.error || reopenMutation.error)?.message}</p>}
    </CardHeader>
    <CardContent><RoundReview round={activeRound} /></CardContent>
  </Card>;
}