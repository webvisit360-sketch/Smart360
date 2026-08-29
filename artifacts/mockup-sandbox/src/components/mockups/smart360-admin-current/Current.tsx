import { useMemo, useState } from "react";
import {
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Copy,
  Edit2,
  ExternalLink,
  FileCheck2,
  FileText,
  Home,
  ImageOff,
  LayoutDashboard,
  LogOut,
  Mail,
  MapPin,
  MessageSquare,
  Plus,
  Search,
  User,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import "./_group.css";

type Tenant = {
  id: string;
  name: string;
  slug: string;
  theme: string;
  isPublished: boolean;
  isTemplate?: boolean;
  createdAt: string;
  renewsAt?: string;
  readiness: number;
  media: string;
  mediaPct: number;
  pendingOrders: number;
  pendingMessages: number;
  pendingLocations: number;
  missingPhotos: number;
};

const INITIAL_TENANTS: Tenant[] = [
  {
    id: "meli-pu",
    name: "Apartmaji Meli Pu",
    slug: "meli-pu",
    theme: "Poteg",
    isPublished: true,
    createdAt: "2025-01-16",
    renewsAt: "2026-04-10",
    readiness: 92,
    media: "38,4 MB / 500 MB",
    mediaPct: 8,
    pendingOrders: 2,
    pendingMessages: 1,
    pendingLocations: 3,
    missingPhotos: 2,
  },
  {
    id: "camp-koren",
    name: "Kamp Koren Kobarid",
    slug: "camp-koren",
    theme: "Kartice",
    isPublished: true,
    createdAt: "2025-02-03",
    renewsAt: "2026-03-28",
    readiness: 76,
    media: "126,8 MB / 500 MB",
    mediaPct: 25,
    pendingOrders: 0,
    pendingMessages: 2,
    pendingLocations: 6,
    missingPhotos: 4,
  },
  {
    id: "vila-triglav",
    name: "Vila Triglav",
    slug: "vila-triglav",
    theme: "Poteg",
    isPublished: false,
    createdAt: "2026-01-22",
    readiness: 48,
    media: "14,2 MB / 500 MB",
    mediaPct: 3,
    pendingOrders: 1,
    pendingMessages: 0,
    pendingLocations: 8,
    missingPhotos: 11,
  },
];

const RECENT_CHANGES = [
  {
    summary: "Posodobljene informacije za prihod",
    tenant: "Apartmaji Meli Pu",
    actor: "Stranka",
    date: "14. 3. 2026, 09:42",
  },
  {
    summary: "Dodana nova lokacija: Slap Kozjak",
    tenant: "Kamp Koren Kobarid",
    actor: "Smart360",
    date: "13. 3. 2026, 15:18",
  },
  {
    summary: "Spremenjen odpiralni čas",
    tenant: "Vila Triglav",
    actor: "Smart360",
    date: "12. 3. 2026, 11:06",
  },
];

function Logo() {
  return <div className="smart360-wordmark" aria-label="Smart360">Smart360</div>;
}

function daysTo(date?: string) {
  if (!date) return null;
  const today = new Date("2026-03-16T08:00:00");
  return Math.ceil((new Date(date).getTime() - today.getTime()) / 86_400_000);
}

function fmtDate(date: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString("sl-SI");
}

function renewalClass(days: number) {
  return days < 0
    ? "text-destructive font-medium"
    : days <= 30
      ? "text-amber-600 font-medium"
      : "text-muted-foreground";
}

export function Current() {
  const [tenants, setTenants] = useState(INITIAL_TENANTS);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "renewal" | "readiness">("name");
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState("apartmaji");

  const visibleTenants = useMemo(() => {
    const value = search.trim().toLocaleLowerCase("sl");
    return tenants
      .filter((tenant) =>
        tenant.name.toLocaleLowerCase("sl").includes(value) ||
        tenant.slug.toLocaleLowerCase("sl").includes(value),
      )
      .slice()
      .sort((a, b) => {
        if (sortBy === "readiness") return a.readiness - b.readiness;
        if (sortBy === "renewal") {
          return (a.renewsAt ? new Date(a.renewsAt).getTime() : Infinity) -
            (b.renewsAt ? new Date(b.renewsAt).getTime() : Infinity);
        }
        return a.name.localeCompare(b.name, "sl");
      });
  }, [search, sortBy, tenants]);

  const slug = newName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  const addTenant = () => {
    if (!newName.trim() || slug.length < 3) return;
    setTenants((current) => [
      ...current,
      {
        id: slug,
        name: newName.trim(),
        slug,
        theme: "Poteg",
        isPublished: false,
        createdAt: "2026-03-16",
        readiness: 18,
        media: "0 B / 500 MB",
        mediaPct: 0,
        pendingOrders: 0,
        pendingMessages: 0,
        pendingLocations: 0,
        missingPhotos: 0,
      },
    ]);
    setCreateOpen(false);
    setNewName("");
  };

  const publishedCount = tenants.filter((tenant) => tenant.isPublished).length;

  return (
    <div className="smart360-current min-h-screen flex bg-muted/30 text-foreground">
      <aside className="w-64 shrink-0 bg-card border-r border-border hidden md:flex flex-col">
        <div className="h-16 flex items-center px-6 border-b border-border">
          <Logo />
        </div>
        <nav className="flex-1 py-6 px-4 space-y-2">
          <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-primary/10 text-primary font-semibold">
            <LayoutDashboard className="h-5 w-5" />
            Nadzorna plošča
          </button>
          <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-muted-foreground hover:bg-muted font-semibold">
            <Mail className="h-5 w-5" />
            Povpraševanja
          </button>
          <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-muted-foreground hover:bg-muted font-medium transition-colors">
            <User className="h-5 w-5" />
            Ključi
          </button>
        </nav>
        <div className="p-4 border-t border-border">
          <Button variant="ghost" className="w-full justify-start text-muted-foreground">
            <LogOut className="mr-2 h-4 w-4" />
            Odjava
          </Button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-card border-b border-border flex items-center justify-between px-6 md:hidden">
          <Logo />
          <Button variant="ghost" size="icon" aria-label="Odjava">
            <LogOut className="h-5 w-5 text-muted-foreground" />
          </Button>
        </header>

        <div className="flex-1 overflow-auto">
          <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold tracking-tight">Nadzorna plošča</h1>
                <p className="text-muted-foreground mt-1">Pregled in upravljanje namestitev</p>
              </div>
              <Button onClick={() => setCreateOpen(true)}>
                <Plus className="mr-2 h-4 w-4" /> Nova namestitev
              </Button>
            </div>

            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Nova namestitev</DialogTitle>
                  <DialogDescription>
                    Tip določi privzete razdelke in kategorije. Naslov (slug) se predlaga iz
                    imena in ga lahko spreminjate do prve objave — potem je zamrznjen.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="tenant-name">Ime nastanitve</Label>
                    <Input
                      id="tenant-name"
                      autoFocus
                      value={newName}
                      placeholder="npr. Apartmaji Pri Lipi"
                      onChange={(event) => setNewName(event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Naslov vodnika (slug)</Label>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground shrink-0">smart360.info/</span>
                      <Input value={slug} readOnly />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Tip namestitve</Label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        ["apartmaji", "Apartmaji"],
                        ["kamp", "Kamp"],
                        ["hotel", "Hotel"],
                      ].map(([value, label]) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setNewType(value)}
                          className={`rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                            newType === value
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-input hover:bg-muted"
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setCreateOpen(false)}>Prekliči</Button>
                  <Button onClick={addTenant} disabled={!newName.trim() || slug.length < 3}>
                    Ustvari
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Vse namestitve</CardTitle>
                  <Home className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent><div className="text-3xl font-bold">{tenants.length}</div></CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Objavljene</CardTitle>
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                </CardHeader>
                <CardContent><div className="text-3xl font-bold">{publishedCount}</div></CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Vsebine (elementi)</CardTitle>
                  <FileText className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent><div className="text-3xl font-bold">148</div></CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-6">
                <div className="flex items-center gap-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Išči po imenu ali slug-u..."
                      className="pl-10"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                    />
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setSortBy((current) =>
                        current === "name" ? "renewal" : current === "renewal" ? "readiness" : "name",
                      )
                    }
                  >
                    <CalendarClock className="h-4 w-4 mr-2" />
                    {sortBy === "name"
                      ? "Razvrsti: Ime"
                      : sortBy === "renewal"
                        ? "Razvrsti: Obnova"
                        : "Razvrsti: Pripravljenost"}
                  </Button>
                </div>

                <div className="grid gap-4">
                  {visibleTenants.map((tenant) => {
                    const days = daysTo(tenant.renewsAt);
                    const alertBadges = [
                      { count: tenant.pendingOrders, text: `${tenant.pendingOrders} naročili`, icon: ClipboardList },
                      { count: tenant.pendingMessages, text: `${tenant.pendingMessages} sporočili`, icon: MessageSquare },
                      { count: tenant.pendingLocations, text: `${tenant.pendingLocations} lokacij`, icon: MapPin },
                      { count: tenant.missingPhotos, text: `${tenant.missingPhotos} brez fotografij`, icon: ImageOff },
                    ].filter((item) => item.count > 0);

                    return (
                      <Card key={tenant.id} className="overflow-hidden transition-all hover:border-primary/50">
                        <div className="p-6 flex-1 flex flex-col justify-center">
                          <div className="flex flex-wrap items-center gap-3 mb-2">
                            <h3 className="text-xl font-bold">{tenant.name}</h3>
                            <button
                              type="button"
                              onClick={() =>
                                setTenants((current) =>
                                  current.map((item) =>
                                    item.id === tenant.id
                                      ? { ...item, isPublished: !item.isPublished }
                                      : item,
                                  ),
                                )
                              }
                            >
                              {tenant.isPublished ? (
                                <Badge className="bg-green-100 text-green-800 hover:bg-green-200 border-none cursor-pointer">
                                  Objavljeno
                                </Badge>
                              ) : (
                                <Badge variant="secondary" className="bg-gray-100 text-gray-600 hover:bg-gray-200 border-none cursor-pointer">
                                  Osnutek
                                </Badge>
                              )}
                            </button>
                            {tenant.isTemplate && (
                              <Badge variant="outline" className="border-purple-200 text-purple-700 bg-purple-50">
                                Predloga
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground mb-4">
                            /{tenant.slug} • Tema: {tenant.theme} • {tenant.media}
                          </p>
                          <p className="text-sm text-muted-foreground mb-4 -mt-3">
                            Vzpostavljeno: {fmtDate(tenant.createdAt)}
                            {tenant.renewsAt && days !== null && (
                              <span className={renewalClass(days)}>
                                {" • "}Obnova: {fmtDate(tenant.renewsAt)}
                                {days < 0 ? ` · zapadlo pred ${-days} dnevi` : ` · čez ${days} dni`}
                              </span>
                            )}
                          </p>

                          <div className="mb-4 -mt-1 space-y-2">
                            <div className="flex items-center gap-2">
                              <div className="h-1.5 w-28 rounded-full bg-muted overflow-hidden shrink-0">
                                <div
                                  className={`h-full rounded-full ${
                                    tenant.readiness >= 100
                                      ? "bg-green-500"
                                      : tenant.readiness >= 60
                                        ? "bg-primary"
                                        : "bg-amber-500"
                                  }`}
                                  style={{ width: `${tenant.readiness}%` }}
                                />
                              </div>
                              <span className="text-xs font-medium text-muted-foreground">
                                {tenant.readiness} % pripravljen
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {alertBadges.map((item) => {
                                const Icon = item.icon;
                                return (
                                  <button
                                    key={item.text}
                                    type="button"
                                    className="inline-flex items-center gap-1 rounded-full bg-red-50 text-red-700 border border-red-200 px-2 py-0.5 text-xs font-medium hover:bg-red-100"
                                  >
                                    <Icon className="h-3 w-3" /> {item.text}
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-2 mt-auto">
                            <Button variant="secondary" size="sm">
                              <Edit2 className="h-4 w-4 mr-2" /> Odpri kot Smart360 operater
                            </Button>
                            <Button variant="outline" size="sm">
                              <ExternalLink className="h-4 w-4 mr-2" /> Poglej kot gost
                            </Button>
                            <Button variant="outline" size="sm">QR koda</Button>
                            <Button variant="ghost" size="sm">
                              <FileCheck2 className="h-4 w-4 mr-2" /> Preveri datoteke
                            </Button>
                            <Button variant="ghost" size="sm" aria-label="Podvoji">
                              <Copy className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                  {visibleTenants.length === 0 && (
                    <Card className="border-dashed">
                      <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                        <Home className="h-12 w-12 text-muted-foreground mb-4 opacity-20" />
                        <p className="text-lg font-medium">Ni najdenih namestitev</p>
                        <p className="text-sm text-muted-foreground">Ustvarite novo ali spremenite iskalni niz.</p>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </div>

              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Obnove v naslednjih 60 dneh</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {tenants.filter((tenant) => {
                        const days = daysTo(tenant.renewsAt);
                        return days !== null && days <= 60;
                      }).map((tenant) => {
                        const days = daysTo(tenant.renewsAt)!;
                        return (
                          <button key={tenant.id} className="w-full text-left flex items-center justify-between gap-2 rounded-md px-2 py-1.5 hover:bg-muted">
                            <span className="text-sm font-medium truncate">{tenant.name}</span>
                            <span className={`text-sm whitespace-nowrap ${renewalClass(days)}`}>
                              {fmtDate(tenant.renewsAt!)} · čez {days} dni
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Prostor za medije</CardTitle>
                    <CardDescription>Skupaj: 179,4 MB — največje namestitve najprej</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {tenants.slice().sort((a, b) => b.mediaPct - a.mediaPct).map((tenant) => (
                        <div key={tenant.id}>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="font-medium truncate mr-2">{tenant.name}</span>
                            <span className="shrink-0 text-muted-foreground">{tenant.media}</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                            <div className="h-full rounded-full bg-primary" style={{ width: `${tenant.mediaPct}%` }} />
                          </div>
                        </div>
                      ))}
                      <div className="pt-2 border-t flex items-center gap-4">
                        <button type="button" className="text-[11px] text-muted-foreground hover:text-foreground underline underline-offset-2">
                          Koš in dnevnik čiščenja …
                        </button>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Nedavne spremembe</CardTitle>
                    <CardDescription>Zadnjih nekaj aktivnosti v sistemu</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-6">
                      {RECENT_CHANGES.map((change, index) => (
                        <div key={change.summary} className="flex gap-4 relative">
                          {index !== RECENT_CHANGES.length - 1 && (
                            <div className="absolute left-2.5 top-6 bottom-[-24px] w-[2px] bg-border" />
                          )}
                          <div className="w-5 h-5 rounded-full bg-primary/10 border-2 border-background flex items-center justify-center shrink-0 mt-0.5 z-10">
                            <div className="w-2 h-2 rounded-full bg-primary" />
                          </div>
                          <div className="flex-1 pb-1">
                            <p className="text-sm font-medium">{change.summary}</p>
                            <p className="text-xs text-muted-foreground">{change.tenant}</p>
                            <p className="text-xs text-muted-foreground/60 mt-1">
                              {change.actor} · {change.date}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}