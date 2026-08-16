import { useGetAdminOverview, useListTenants, useDuplicateTenant, useCreateTenant, useDeleteTenant, useGetStorageUsage } from "@workspace/api-client-react";
import { fmtGb, usagePct } from "@/lib/format-bytes";
import { Link, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Loader2, Plus, Search, ExternalLink, Copy, Edit2, Trash2, Home, FileText, CheckCircle2, FileCheck2, CalendarClock } from "lucide-react";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getListTenantsQueryKey, getGetAdminOverviewQueryKey } from "@workspace/api-client-react";
import { QrDialog } from "@/components/admin/qr-dialog";
import { MediaCheckDialog } from "@/components/admin/media-check-dialog";
import { CleanupTrashDialog } from "@/components/admin/cleanup-trash-dialog";

export default function AdminDashboard() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { data: overview, isLoading: loadingOverview } = useGetAdminOverview();
  const { data: tenants, isLoading: loadingTenants } = useListTenants();
  const { data: storageUsage } = useGetStorageUsage();
  const usageByTenant = new Map(storageUsage?.tenants.map(t => [t.tenantId, t]) ?? []);
  
  const [search, setSearch] = useState("");
  // Card grid, so sorting is a toggle rather than a column header.
  const [sortBy, setSortBy] = useState<"name" | "renewal">("name");

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

  const createMutation = useCreateTenant({
    mutation: {
      onSuccess: (data) => {
        setLocation(`/admin/tenants/${data.id}`);
      }
    }
  });

  const deleteMutation = useDeleteTenant({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListTenantsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetAdminOverviewQueryKey() });
      }
    }
  });

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
        <Button onClick={() => createMutation.mutate({ data: { name: "Nova namestitev", slug: `nova-${Date.now()}` } })}>
          <Plus className="mr-2 h-4 w-4" /> Nova namestitev
        </Button>
      </div>

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
              onClick={() => setSortBy(s => (s === "name" ? "renewal" : "name"))}
            >
              <CalendarClock className="h-4 w-4 mr-2" />
              {sortBy === "name" ? "Razvrsti: Ime" : "Razvrsti: Obnova"}
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
                          {tenant.isPublished ? (
                            <Badge className="bg-green-100 text-green-800 hover:bg-green-100 border-none">Objavljeno</Badge>
                          ) : (
                            <Badge variant="secondary" className="bg-gray-100 text-gray-600 hover:bg-gray-100 border-none">Osnutek</Badge>
                          )}
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
                                {" • "}{fmtGb(u.usedBytes)} / {fmtGb(u.quotaBytes)}
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
                        
                        <div className="flex flex-wrap items-center gap-2 mt-auto">
                          <Button variant="secondary" size="sm" onClick={() => setLocation(`/admin/tenants/${tenant.id}`)}>
                            <Edit2 className="h-4 w-4 mr-2" /> Uredi
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
                          <Button 
                            variant="ghost" 
                            size="sm"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10 ml-auto"
                            onClick={() => {
                              if(confirm(`Ste prepričani, da želite izbrisati ${tenant.name}?`)) {
                                deleteMutation.mutate({ id: tenant.id });
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
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
                Skupaj: {storageUsage ? fmtGb(storageUsage.totalBytes) : "…"} — največje namestitve najprej
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
                            {fmtGb(t.usedBytes)} / {fmtGb(t.quotaBytes)}
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
                          {change.action} {change.entity}
                        </p>
                        {change.tenantName && (
                          <p className="text-xs text-muted-foreground">{change.tenantName}</p>
                        )}
                        <p className="text-xs text-muted-foreground/60 mt-1">
                          {new Date(change.createdAt).toLocaleString('sl-SI')}
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
