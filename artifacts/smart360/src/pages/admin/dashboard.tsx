import { useGetAdminOverview, useListTenants, useListTenantOverview, useDuplicateTenant, useCreateTenant, useGetStorageUsage, useUpdateTenant } from "@workspace/api-client-react";
import { fmtMediaSize, fmtMediaUsage, usagePct } from "@/lib/format-bytes";
import { Link, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Loader2, Plus, Search, ExternalLink, Copy, Edit2, Home, FileText, CheckCircle2, FileCheck2, CalendarClock, ClipboardList, MessageSquare, MapPin, ImageOff } from "lucide-react";
import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getListTenantsQueryKey, getGetAdminOverviewQueryKey, getListTenantOverviewQueryKey } from "@workspace/api-client-react";
import { QrDialog } from "@/components/admin/qr-dialog";
import { MediaCheckDialog } from "@/components/admin/media-check-dialog";
import { CleanupTrashDialog } from "@/components/admin/cleanup-trash-dialog";
import { slugify } from "@/components/admin/slug-field";
import {
  formatSlovenianCount,
  MESSAGE_COUNT_FORMS,
  ORDER_COUNT_FORMS,
} from "@/lib/slovenian-count";

const TENANT_TYPES = [
  { value: "apartmaji", label: "Apartmaji" },
  { value: "kamp", label: "Kamp" },
  { value: "hotel", label: "Hotel" },
] as const;

/** Central attribution labels (CP2b): who performed a changelog action. */
export function actorLabel(change: {
  actorLabel?: "Stranka" | "Smart360";
  actorType?: "owner" | "host" | "system";
}): string {
  if (change.actorLabel) return change.actorLabel;
  if (change.actorType === "host") return "Stranka";
  if (change.actorType === "system") return "Sistem";
  return "Smart360";
}

export default function AdminDashboard() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { data: overview, isLoading: loadingOverview } = useGetAdminOverview();
  const { data: tenants, isLoading: loadingTenants } = useListTenants();
  const { data: tenantOverviews } = useListTenantOverview();
  const { data: storageUsage } = useGetStorageUsage();
  const usageByTenant = new Map(storageUsage?.tenants.map(t => [t.tenantId, t]) ?? []);
  const overviewByTenant = useMemo(
    () => new Map(tenantOverviews?.map(o => [o.tenantId, o]) ?? []),
    [tenantOverviews],
  );

  const [search, setSearch] = useState("");
  // Card grid, so sorting is a toggle rather than a column header.
  const [sortBy, setSortBy] = useState<"name" | "renewal" | "readiness">("name");

  // Create-tenant dialog (CP2b): name proposes the slug, type seeds content.
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [newType, setNewType] = useState<string>("apartmaji");

  const duplicateMutation = useDuplicateTenant({
    mutation: {
      onSuccess: (result) => {
        queryClient.invalidateQueries({ queryKey: getListTenantsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetAdminOverviewQueryKey() });
        // Duplication hygiene report: stale references were dropped on the
        // server — tell the admin exactly what to re-upload in the copy.
        if (result.dropped.length > 0) {
          const lines = result.dropped.map(d =>
            `• ${d.label} (${d.reason === "missing" ? "datoteka ne obstaja" : d.reason === "no_alpha" ? "logotip ni prosojen" : "napačna vrsta datoteke"})`
          );
          alert(`Kopija je ustvarjena kot osnutek.\n\nIzpuščene neveljavne reference (naložite znova):\n${lines.join("\n")}`);
        }
      }
    }
  });

  // Značka Objavljeno/Osnutek na kartici je hkrati stikalo — edino
  // življenjsko dejanje namestitve na seznamu (brisanja iz vmesnika ni).
  const publishMutation = useUpdateTenant({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListTenantsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetAdminOverviewQueryKey() });
      }
    }
  });

  const togglePublished = (tenant: { id: string; isPublished: boolean }) => {
    const msg = tenant.isPublished
      ? "Preklop na osnutek: gostje strani ne bodo več videli. Vsebina ostane nedotaknjena."
      : "Objava: gostje bodo stran spet videli. Vsebina ostane nedotaknjena.";
    if (confirm(msg)) {
      publishMutation.mutate({ id: tenant.id, data: { isPublished: !tenant.isPublished } });
    }
  };

  const createMutation = useCreateTenant({
    mutation: {
      onSuccess: (data) => {
        queryClient.invalidateQueries({ queryKey: getListTenantsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListTenantOverviewQueryKey() });
        setCreateOpen(false);
        setLocation(`/admin/tenants/${data.id}`);
      }
    }
  });

  const submitCreate = () => {
    const name = newName.trim();
    const slug = (slugTouched ? newSlug : slugify(newName)).trim();
    if (!name || slug.length < 3) return;
    createMutation.mutate({ data: { name, slug, type: newType as "kamp" | "hotel" | "apartmaji" } });
  };

  const filteredTenants = (tenants?.filter(t =>
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    t.slug.toLowerCase().includes(search.toLowerCase())
  ) || []).slice().sort((a, b) => {
    if (sortBy === "renewal") {
      // Soonest (or most overdue) first; tenants without a date go last.
      const av = a.renewsAt ? new Date(a.renewsAt).getTime() : Infinity;
      const bv = b.renewsAt ? new Date(b.renewsAt).getTime() : Infinity;
      return av - bv;
    }
    if (sortBy === "readiness") {
      // Least ready first — those need the owner's attention.
      const av = overviewByTenant.get(a.id)?.readinessPct ?? 101;
      const bv = overviewByTenant.get(b.id)?.readinessPct ?? 101;
      return av - bv;
    }
    return a.name.localeCompare(b.name, "sl");
  });

  const fmtDate = (d: string) => new Date(d).toLocaleDateString("sl-SI");
  /** Whole days from today to the date (negative = overdue). */
  const daysTo = (d: string) =>
    Math.ceil((new Date(d).getTime() - Date.now()) / (24 * 60 * 60 * 1000));
  const renewalTone = (days: number) =>
    days < 0 ? "text-destructive font-medium" : days <= 30 ? "text-amber-600 font-medium" : "text-muted-foreground";

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Nadzorna plošča</h1>
          <p className="text-muted-foreground mt-1">Pregled in upravljanje namestitev</p>
        </div>
        <Button onClick={() => { setNewName(""); setNewSlug(""); setSlugTouched(false); setNewType("apartmaji"); setCreateOpen(true); }}>
          <Plus className="mr-2 h-4 w-4" /> Nova namestitev
        </Button>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova namestitev</DialogTitle>
            <DialogDescription>
              Tip določi privzete razdelke in kategorije. Naslov (slug) se predlaga iz imena
              in ga lahko spreminjate do prve objave — potem je zamrznjen.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Ime nastanitve</Label>
              <Input
                autoFocus
                value={newName}
                placeholder="npr. Apartmaji Pri Lipi"
                onChange={(e) => setNewName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Naslov vodnika (slug)</Label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground shrink-0">smart360.info/</span>
                <Input
                  value={slugTouched ? newSlug : slugify(newName)}
                  onChange={(e) => { setSlugTouched(true); setNewSlug(slugify(e.target.value)); }}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Tip nastanitve</Label>
              <div className="grid grid-cols-3 gap-2">
                {TENANT_TYPES.map(t => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setNewType(t.value)}
                    className={`rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                      newType === t.value
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-input hover:bg-muted"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Prekliči</Button>
            <Button
              onClick={submitCreate}
              disabled={createMutation.isPending || !newName.trim() || (slugTouched ? newSlug : slugify(newName)).length < 3}
            >
              {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Ustvari
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Vse namestitve</CardTitle>
            <Home className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{loadingOverview ? "-" : overview?.tenantsCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Objavljene</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{loadingOverview ? "-" : overview?.publishedCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Vsebine (elementi)</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{loadingOverview ? "-" : overview?.itemsCount}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Tenants List */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Išči po imenu ali slug-u..." 
                className="pl-10"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSortBy(s => (s === "name" ? "renewal" : s === "renewal" ? "readiness" : "name"))}
            >
              <CalendarClock className="h-4 w-4 mr-2" />
              {sortBy === "name" ? "Razvrsti: Ime" : sortBy === "renewal" ? "Razvrsti: Obnova" : "Razvrsti: Pripravljenost"}
            </Button>
          </div>

          {loadingTenants ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="grid gap-4">
              {filteredTenants.length === 0 ? (
                <Card className="border-dashed">
                  <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                    <Home className="h-12 w-12 text-muted-foreground mb-4 opacity-20" />
                    <p className="text-lg font-medium">Ni najdenih namestitev</p>
                    <p className="text-sm text-muted-foreground mb-6">Ustvarite novo ali spremenite iskalni niz.</p>
                  </CardContent>
                </Card>
              ) : (
                filteredTenants.map(tenant => (
                  <Card key={tenant.id} className="overflow-hidden transition-all hover:border-primary/50">
                    <div className="flex flex-col sm:flex-row">
                      <div className="p-6 flex-1 flex flex-col justify-center">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-xl font-bold">{tenant.name}</h3>
                          <button
                            type="button"
                            onClick={() => togglePublished(tenant)}
                            disabled={publishMutation.isPending}
                            title={tenant.isPublished ? "Kliknite za preklop na osnutek" : "Kliknite za objavo"}
                            aria-label={tenant.isPublished ? "Objavljeno — kliknite za preklop na osnutek" : "Osnutek — kliknite za objavo"}
                            className="disabled:opacity-50"
                          >
                            {tenant.isPublished ? (
                              <Badge className="bg-green-100 text-green-800 hover:bg-green-200 border-none cursor-pointer">Objavljeno</Badge>
                            ) : (
                              <Badge variant="secondary" className="bg-gray-100 text-gray-600 hover:bg-gray-200 border-none cursor-pointer">Osnutek</Badge>
                            )}
                          </button>
                          {tenant.isTemplate && (
                            <Badge variant="outline" className="border-purple-200 text-purple-700 bg-purple-50">Predloga</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mb-4">
                          /{tenant.slug} • Tema: {tenant.theme}
                          {(() => {
                            const u = usageByTenant.get(tenant.id);
                            if (!u) return null;
                            const pct = usagePct(u.usedBytes, u.quotaBytes);
                            return (
                              <span className={pct >= 100 ? "text-destructive font-medium" : pct >= 80 ? "text-amber-600 font-medium" : ""}>
                                {" • "}{fmtMediaUsage(u.usedBytes, u.quotaBytes)}
                              </span>
                            );
                          })()}
                        </p>
                        <p className="text-sm text-muted-foreground mb-4 -mt-3">
                          Vzpostavljeno: {fmtDate(tenant.createdAt)}
                          {tenant.renewsAt && (() => {
                            const days = daysTo(tenant.renewsAt!);
                            return (
                              <span className={renewalTone(days)}>
                                {" • "}Obnova: {fmtDate(tenant.renewsAt!)}
                                {days < 0 ? ` · zapadlo pred ${-days} dnevi` : ` · čez ${days} dni`}
                              </span>
                            );
                          })()}
                        </p>

                        {(() => {
                          const o = overviewByTenant.get(tenant.id);
                          if (!o) return null;
                          const undone = o.checks.filter(c => !c.done).map(c => c.label);
                          const pendingBadges = [
                            { n: o.pendingOrders, text: formatSlovenianCount(o.pendingOrders, ORDER_COUNT_FORMS), Icon: ClipboardList, to: "orders" },
                            { n: o.pendingMessages, text: formatSlovenianCount(o.pendingMessages, MESSAGE_COUNT_FORMS), Icon: MessageSquare, to: "orders" },
                            { n: o.pendingLocations, text: `${o.pendingLocations} lokacij`, Icon: MapPin, to: "distances" },
                            { n: o.missingPhotos, text: `${o.missingPhotos} brez fotografij`, Icon: ImageOff, to: "content" },
                          ].filter(b => b.n > 0);
                          return (
                            <div className="mb-4 -mt-1 space-y-2">
                              <div className="flex items-center gap-2" title={undone.length ? `Manjka: ${undone.join(", ")}` : "Vse pripravljeno"}>
                                <div className="h-1.5 w-28 rounded-full bg-muted overflow-hidden shrink-0">
                                  <div
                                    className={`h-full rounded-full ${o.readinessPct >= 100 ? "bg-green-500" : o.readinessPct >= 60 ? "bg-primary" : "bg-amber-500"}`}
                                    style={{ width: `${o.readinessPct}%` }}
                                  />
                                </div>
                                <span className="text-xs font-medium text-muted-foreground">{o.readinessPct} % pripravljen</span>
                              </div>
                              {pendingBadges.length > 0 && (
                                <div className="flex flex-wrap gap-1.5">
                                  {pendingBadges.map(b => (
                                    <button
                                       key={b.text}
                                      type="button"
                                      onClick={() => setLocation(`/admin/tenants/${tenant.id}`)}
                                      className="inline-flex items-center gap-1 rounded-full bg-red-50 text-red-700 border border-red-200 px-2 py-0.5 text-xs font-medium hover:bg-red-100"
                                    >
                                       <b.Icon className="h-3 w-3" /> {b.text}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })()}
                        
                        <div className="flex flex-wrap items-center gap-2 mt-auto">
                          <Button variant="secondary" size="sm" onClick={() => setLocation(`/admin/tenants/${tenant.id}`)}>
                            <Edit2 className="h-4 w-4 mr-2" /> Odpri kot Smart360 operater
                          </Button>
                          <Button variant="outline" size="sm" asChild>
                            <a
                              href={`/${tenant.slug}?preview=1`}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <ExternalLink className="h-4 w-4 mr-2" /> Poglej kot gost
                            </a>
                          </Button>
                          <QrDialog slug={tenant.slug} name={tenant.name} customDomain={tenant.customDomain} />
                          <MediaCheckDialog
                            tenantId={tenant.id}
                            tenantName={tenant.name}
                            trigger={
                              <Button variant="ghost" size="sm">
                                <FileCheck2 className="h-4 w-4 mr-2" /> Preveri datoteke
                              </Button>
                            }
                          />
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => {
                              if(confirm('Želite podvojiti to namestitev?')) {
                                duplicateMutation.mutate({ 
                                  id: tenant.id,
                                  data: { slug: `${tenant.slug}-copy`, name: `${tenant.name} (Kopija)`, copyContent: true }
                                });
                              }
                            }}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                          {/* Brisanje namestitve namenoma NI v vsakodnevnem dosegu (pike-brisanje-ozadje.md):
                              en zgrešen klik uniči vsebino plačljive stranke. Ostane stikalo
                              osnutek/objavljeno; API konec obstaja, a ni dosegljiv iz vmesnika. */}
                        </div>
                      </div>
                    </div>
                  </Card>
                ))
              )}
            </div>
          )}
        </div>

        {/* Storage + Recent Changes */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Obnove v naslednjih 60 dneh</CardTitle>
            </CardHeader>
            <CardContent>
              {(overview?.renewalsDue?.length ?? 0) === 0 ? (
                <p className="text-sm text-muted-foreground">Nobene obnove v naslednjih 60 dneh</p>
              ) : (
                <div className="space-y-2">
                  {overview!.renewalsDue.map(r => {
                    const days = daysTo(r.renewsAt);
                    return (
                      <button
                        key={r.tenantId}
                        className="w-full text-left flex items-center justify-between gap-2 rounded-md px-2 py-1.5 hover:bg-muted"
                        onClick={() => setLocation(`/admin/tenants/${r.tenantId}`)}
                      >
                        <span className="text-sm font-medium truncate">{r.name}</span>
                        <span className={`text-sm whitespace-nowrap ${renewalTone(days)}`}>
                          {fmtDate(r.renewsAt)}{days < 0 ? " · zapadlo" : ` · čez ${days} dni`}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Prostor za medije</CardTitle>
              <CardDescription>
                Skupaj: {storageUsage ? fmtMediaSize(storageUsage.totalBytes) : "…"} — največje namestitve najprej
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!storageUsage ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : (
                <div className="space-y-3">
                  {storageUsage.tenants.map(t => {
                    const pct = usagePct(t.usedBytes, t.quotaBytes);
                    return (
                      <div key={t.tenantId}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="font-medium truncate mr-2">{t.name}</span>
                          <span className={`shrink-0 ${pct >= 100 ? "text-destructive font-medium" : pct >= 80 ? "text-amber-600 font-medium" : "text-muted-foreground"}`}>
                            {fmtMediaUsage(t.usedBytes, t.quotaBytes)}
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                          <div
                            className={`h-full rounded-full ${pct >= 100 ? "bg-destructive" : pct >= 80 ? "bg-amber-500" : "bg-primary"}`}
                            style={{ width: `${Math.min(100, pct)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                  <div className="pt-2 border-t flex items-center gap-4">
                    <CleanupTrashDialog
                      trigger={
                        <button type="button" className="text-[11px] text-muted-foreground hover:text-foreground underline underline-offset-2">
                          Koš in dnevnik čiščenja …
                        </button>
                      }
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Nedavne spremembe</CardTitle>
              <CardDescription>Zadnjih nekaj aktivnosti v sistemu</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingOverview ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : overview?.recentChanges?.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Ni nedavnih sprememb.</p>
              ) : (
                <div className="space-y-6">
                  {overview?.recentChanges?.map((change, i) => (
                    <div key={i} className="flex gap-4 relative">
                      {i !== overview.recentChanges.length - 1 && (
                        <div className="absolute left-2.5 top-6 bottom-[-24px] w-[2px] bg-border" />
                      )}
                      <div className="w-5 h-5 rounded-full bg-primary/10 border-2 border-background flex items-center justify-center shrink-0 mt-0.5 z-10">
                        <div className="w-2 h-2 rounded-full bg-primary" />
                      </div>
                      <div className="flex-1 pb-1">
                        <p className="text-sm font-medium">
                          {change.summary || "Sprememba v vodniku."}
                        </p>
                        {change.tenantName && (
                          <p className="text-xs text-muted-foreground">{change.tenantName}</p>
                        )}
                        <p className="text-xs text-muted-foreground/60 mt-1">
                          {actorLabel(change)} · {new Date(change.createdAt).toLocaleString('sl-SI')}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
