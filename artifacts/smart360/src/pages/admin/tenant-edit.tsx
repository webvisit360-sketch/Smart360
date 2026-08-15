import { useGetTenant, useUpdateTenant, getGetTenantQueryKey, getListTenantsQueryKey } from "@workspace/api-client-react";
import { useRoute, useLocation } from "wouter";
import { Loader2, ArrowLeft, ExternalLink, Save, RefreshCcw, Home, ShoppingBag, Compass, ShoppingCart, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { useQueryClient } from "@tanstack/react-query";
import { ItemMediaEditor } from "@/components/admin/item-media-editor";
import { useEffect, useRef, useState } from "react";

const PRESET_COLORS = ["#FFFFFF", "#F6F1E9", "#FFE9B8", "#3B78DC", "#14201F", "#C4552E"];

const NAV_DEFAULTS = {
  navColorCover: "#FFFFFF",
  navColor: "#14201F",
  navColorOn: "#3B78DC",
} as const;

function relLuminance(hex: string): number | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  const chan = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * chan((n >> 16) & 255) + 0.7152 * chan((n >> 8) & 255) + 0.0722 * chan(n & 255);
}

function contrastRatio(hexA: string, lumB: number): number | null {
  const a = relLuminance(hexA);
  if (a === null) return null;
  const [hi, lo] = a > lumB ? [a, lumB] : [lumB, a];
  return (hi + 0.05) / (lo + 0.05);
}

const THEME_DEFAULTS = {
  mediterran: {
    coverTitleSize: 24,
    coverTitleOpacity: 100,
    coverTextColor: "#14201F",
    coverSubSize: 11,
    coverSubOpacity: 100,
    coverMetaSize: 13.5,
    coverMetaOpacity: 100,
    coverVeil: 0,
    coverAlign: "left",
    coverShowRating: true,
  },
  swipe: {
    coverTitleSize: 56,
    coverTitleOpacity: 66,
    coverTextColor: "#FFFFFF",
    coverSubSize: 22,
    coverSubOpacity: 50,
    coverMetaSize: 19.5,
    coverMetaOpacity: 60,
    coverVeil: 26,
    coverAlign: "left",
    coverShowRating: true,
  }
} as const;

type ThemeKey = keyof typeof THEME_DEFAULTS;

export default function AdminTenantEdit() {
  const [, params] = useRoute("/admin/tenants/:id");
  const [, setLocation] = useLocation();
  const id = params?.id || "";
  const queryClient = useQueryClient();

  const { data: tenant, isLoading } = useGetTenant(id, { query: { enabled: !!id, queryKey: getGetTenantQueryKey(id) } });
  const updateMutation = useUpdateTenant({
    mutation: {
      onSuccess: (data) => {
        queryClient.setQueryData(getGetTenantQueryKey(id), (old: any) => old ? { ...old, ...data } : old);
        queryClient.invalidateQueries({ queryKey: getListTenantsQueryKey() });
      }
    }
  });

  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    customDomain: "",
    subtitle: "",
    theme: "mediterran" as ThemeKey,
    isPublished: false,
    phone: "",
    whatsapp: "",
    viber: "",
    instagram: "",
    mapQuery: "",
    tourUrl: "",
    heroUrl: "",

    coverTitle: null as string | null,
    coverSubtitle: null as string | null,
    coverTitleSize: null as number | null,
    coverTitleOpacity: null as number | null,
    coverTextColor: null as string | null,
    coverSubSize: null as number | null,
    coverSubOpacity: null as number | null,
    coverMetaSize: null as number | null,
    coverMetaOpacity: null as number | null,
    coverVeil: null as number | null,
    coverAlign: null as string | null,
    coverShowRating: null as boolean | null,

    navColorCover: NAV_DEFAULTS.navColorCover as string,
    navColor: NAV_DEFAULTS.navColor as string,
    navColorOn: NAV_DEFAULTS.navColorOn as string,
  });

  const initRef = useRef<string | null>(null);

  // Average luminance of the cover photo — for the contrast warning on the cover icons.
  const [coverLum, setCoverLum] = useState<number | null>(null);
  useEffect(() => {
    if (!formData.heroUrl) { setCoverLum(null); return; }
    let cancelled = false;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const c = document.createElement("canvas");
        c.width = 16; c.height = 16;
        const ctx = c.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, 16, 16);
        const d = ctx.getImageData(0, 0, 16, 16).data;
        let sum = 0;
        const chan = (v: number) => {
          const x = v / 255;
          return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
        };
        for (let i = 0; i < d.length; i += 4) {
          sum += 0.2126 * chan(d[i]) + 0.7152 * chan(d[i + 1]) + 0.0722 * chan(d[i + 2]);
        }
        if (!cancelled) setCoverLum(sum / (d.length / 4));
      } catch { /* tainted canvas or similar — skip the warning */ }
    };
    img.src = formData.heroUrl;
    return () => { cancelled = true; };
  }, [formData.heroUrl]);

  useEffect(() => {
    if (tenant && initRef.current !== tenant.id) {
      initRef.current = tenant.id;
      setFormData({
        name: tenant.name || "",
        slug: tenant.slug || "",
        customDomain: tenant.customDomain || "",
        subtitle: tenant.subtitle || "",
        theme: (tenant.theme as ThemeKey) || "mediterran",
        isPublished: tenant.isPublished || false,
        phone: tenant.phone || "",
        whatsapp: tenant.whatsapp || "",
        viber: tenant.viber || "",
        instagram: tenant.instagram || "",
        mapQuery: tenant.mapQuery || "",
        tourUrl: tenant.tourUrl || "",
        heroUrl: tenant.heroUrl || "",

        coverTitle: tenant.coverTitle ?? null,
        coverSubtitle: tenant.coverSubtitle ?? null,
        coverTitleSize: tenant.coverTitleSize ?? null,
        coverTitleOpacity: tenant.coverTitleOpacity ?? null,
        coverTextColor: tenant.coverTextColor ?? null,
        coverSubSize: tenant.coverSubSize ?? null,
        coverSubOpacity: tenant.coverSubOpacity ?? null,
        coverMetaSize: tenant.coverMetaSize ?? null,
        coverMetaOpacity: tenant.coverMetaOpacity ?? null,
        coverVeil: tenant.coverVeil ?? null,
        coverAlign: tenant.coverAlign ?? null,
        coverShowRating: tenant.coverShowRating ?? null,

        navColorCover: tenant.navColorCover || NAV_DEFAULTS.navColorCover,
        navColor: tenant.navColor || NAV_DEFAULTS.navColor,
        navColorOn: tenant.navColorOn || NAV_DEFAULTS.navColorOn,
      });
    }
  }, [tenant]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!tenant) {
    return <div className="p-8">Namestitev ni najdena.</div>;
  }

  const handleSave = () => {
    updateMutation.mutate({
      id,
      data: { 
        ...formData, 
        customDomain: formData.customDomain.trim() || null 
      },
    });
  };

  const handleResetCover = () => {
    setFormData(prev => ({
      ...prev,
      coverTitle: null,
      coverSubtitle: null,
      coverTitleSize: null,
      coverTitleOpacity: null,
      coverTextColor: null,
      coverSubSize: null,
      coverSubOpacity: null,
      coverMetaSize: null,
      coverMetaOpacity: null,
      coverVeil: null,
      coverAlign: null,
      coverShowRating: null,
    }));
  };

  const themeDefaults = THEME_DEFAULTS[formData.theme] || THEME_DEFAULTS.mediterran;

  const effTitleSize = formData.coverTitleSize ?? themeDefaults.coverTitleSize;
  const effTitleOpacity = formData.coverTitleOpacity ?? themeDefaults.coverTitleOpacity;
  const effTextColor = formData.coverTextColor ?? themeDefaults.coverTextColor;
  const effSubSize = formData.coverSubSize ?? themeDefaults.coverSubSize;
  const effSubOpacity = formData.coverSubOpacity ?? themeDefaults.coverSubOpacity;
  const effMetaSize = formData.coverMetaSize ?? themeDefaults.coverMetaSize;
  const effMetaOpacity = formData.coverMetaOpacity ?? themeDefaults.coverMetaOpacity;
  const effVeil = formData.coverVeil ?? themeDefaults.coverVeil;
  const effAlign = formData.coverAlign ?? themeDefaults.coverAlign;
  const effShowRating = formData.coverShowRating ?? themeDefaults.coverShowRating;

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto space-y-6 pb-24">
      <div className="flex items-center gap-4 sticky top-0 bg-background/95 backdrop-blur z-10 py-4 -my-4 mb-4 border-b">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/admin")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{tenant.name}</h1>
          <p className="text-sm text-muted-foreground">Urejanje namestitve</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" asChild>
            <a href={`/g/${tenant.slug}?preview=1`} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="w-4 h-4 mr-2" /> Poglej
            </a>
          </Button>
          <Button onClick={handleSave} disabled={updateMutation.isPending}>
            {updateMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Shrani
          </Button>
        </div>
      </div>

      <Tabs defaultValue="general">
        <TabsList className="mb-4">
          <TabsTrigger value="general">Splošno</TabsTrigger>
          <TabsTrigger value="appearance">Videz</TabsTrigger>
          <TabsTrigger value="contacts">Stiki & Lokacija</TabsTrigger>
          <TabsTrigger value="content">Vsebina (Drevo)</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Osnovni podatki</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Ime namestitve</Label>
                  <Input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Slug (URL naslov)</Label>
                  <Input value={formData.slug} onChange={e => setFormData({ ...formData, slug: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Lastna domena (neobvezno)</Label>
                  <Input placeholder="npr. gostje.mojapartma.si" value={formData.customDomain} onChange={e => setFormData({ ...formData, customDomain: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Podnaslov</Label>
                  <Input value={formData.subtitle} onChange={e => setFormData({ ...formData, subtitle: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>URL naslovnične (Hero) fotografije</Label>
                  <Input value={formData.heroUrl} onChange={e => setFormData({ ...formData, heroUrl: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>URL 360° ogleda</Label>
                  <Input value={formData.tourUrl} onChange={e => setFormData({ ...formData, tourUrl: e.target.value })} />
                </div>
              </div>
              
              <div className="flex items-center gap-2 pt-4">
                <button 
                  className={`w-12 h-6 rounded-full transition-colors relative ${formData.isPublished ? 'bg-primary' : 'bg-muted-foreground/30'}`}
                  onClick={() => setFormData({ ...formData, isPublished: !formData.isPublished })}
                >
                  <div className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-all ${formData.isPublished ? 'left-7' : 'left-1'}`} />
                </button>
                <Label>Objavljeno (vidno gostom)</Label>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="appearance" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Tema vmesnika</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div 
                  className={`border rounded-xl p-4 cursor-pointer transition-all ${formData.theme === 'mediterran' ? 'border-primary ring-1 ring-primary bg-primary/5' : 'hover:bg-muted'}`}
                  onClick={() => setFormData({...formData, theme: 'mediterran'})}
                >
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-semibold">Sredozemska</h4>
                    <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${formData.theme === 'mediterran' ? 'border-primary' : 'border-muted-foreground/30'}`}>
                      {formData.theme === 'mediterran' && <div className="w-2.5 h-2.5 bg-primary rounded-full" />}
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">Navpično drsenje, spodnja navigacija</p>
                </div>
                
                <div 
                  className={`border rounded-xl p-4 cursor-pointer transition-all ${formData.theme === 'swipe' ? 'border-primary ring-1 ring-primary bg-primary/5' : 'hover:bg-muted'}`}
                  onClick={() => setFormData({...formData, theme: 'swipe'})}
                >
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-semibold">Poteg</h4>
                    <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${formData.theme === 'swipe' ? 'border-primary' : 'border-muted-foreground/30'}`}>
                      {formData.theme === 'swipe' && <div className="w-2.5 h-2.5 bg-primary rounded-full" />}
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">Vodoravni zasloni, brez spodnje navigacije</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Urejevalnik naslovnice</CardTitle>
              <Button variant="outline" size="sm" onClick={handleResetCover} className="h-8">
                <RefreshCcw className="w-3.5 h-3.5 mr-2" />
                Ponastavi
              </Button>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                
                {/* Controls */}
                <div className="lg:col-span-7 space-y-8">
                  <div className="space-y-4">
                    <h4 className="font-semibold text-sm border-b pb-2">Besedila (preglasijo splošna)</h4>
                    <div className="grid grid-cols-2 gap-4 pt-2">
                      <div className="space-y-2">
                        <Label>Naslov (Title)</Label>
                        <Input 
                          placeholder={formData.name || "Ime namestitve"} 
                          value={formData.coverTitle || ""} 
                          onChange={e => setFormData({ ...formData, coverTitle: e.target.value || null })} 
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Podnaslov (Subtitle)</Label>
                        <Input 
                          placeholder={formData.subtitle || "Podnaslov nastanitve"} 
                          value={formData.coverSubtitle || ""} 
                          onChange={e => setFormData({ ...formData, coverSubtitle: e.target.value || null })} 
                        />
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <h4 className="font-semibold text-sm border-b pb-2">Pisava in barva</h4>
                    <div className="pt-2">
                      <Label className="mb-2 block text-xs text-muted-foreground">Barva besedila</Label>
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <Input 
                            type="color" 
                            value={effTextColor}
                            onChange={e => setFormData({ ...formData, coverTextColor: e.target.value })}
                            className="w-10 h-10 p-1 cursor-pointer"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          {PRESET_COLORS.map(color => (
                            <button
                              key={color}
                              className={`w-8 h-8 rounded-full border shadow-sm transition-transform ${effTextColor.toUpperCase() === color ? 'scale-110 ring-2 ring-primary ring-offset-1' : 'hover:scale-110'}`}
                              style={{ backgroundColor: color }}
                              onClick={() => setFormData({ ...formData, coverTextColor: color })}
                              title={color}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-x-6 gap-y-6 pt-2">
                      <div className="space-y-3">
                        <div className="flex justify-between">
                          <Label className="text-xs text-muted-foreground">Velikost naslova</Label>
                          <span className="text-xs font-medium">{effTitleSize}px {formData.coverTitleSize === null && "(privzeto)"}</span>
                        </div>
                        <Slider min={24} max={84} step={1} value={[effTitleSize]} onValueChange={v => setFormData({ ...formData, coverTitleSize: v[0] })} />
                      </div>
                      <div className="space-y-3">
                        <div className="flex justify-between">
                          <Label className="text-xs text-muted-foreground">Prosojnost naslova</Label>
                          <span className="text-xs font-medium">{effTitleOpacity} % {formData.coverTitleOpacity === null && "(privzeto)"}</span>
                        </div>
                        <Slider min={20} max={100} step={1} value={[effTitleOpacity]} onValueChange={v => setFormData({ ...formData, coverTitleOpacity: v[0] })} />
                      </div>

                      <div className="space-y-3">
                        <div className="flex justify-between">
                          <Label className="text-xs text-muted-foreground">Velikost podnaslova</Label>
                          <span className="text-xs font-medium">{effSubSize}px {formData.coverSubSize === null && "(privzeto)"}</span>
                        </div>
                        <Slider min={12} max={40} step={1} value={[effSubSize]} onValueChange={v => setFormData({ ...formData, coverSubSize: v[0] })} />
                      </div>
                      <div className="space-y-3">
                        <div className="flex justify-between">
                          <Label className="text-xs text-muted-foreground">Prosojnost podnaslova</Label>
                          <span className="text-xs font-medium">{effSubOpacity} % {formData.coverSubOpacity === null && "(privzeto)"}</span>
                        </div>
                        <Slider min={20} max={100} step={1} value={[effSubOpacity]} onValueChange={v => setFormData({ ...formData, coverSubOpacity: v[0] })} />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="font-semibold text-sm border-b pb-2">Metapodatki in Ozadje</h4>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-6 pt-2">
                      <div className="space-y-3">
                        <div className="flex justify-between">
                          <Label className="text-xs text-muted-foreground">Velikost metapodatkov</Label>
                          <span className="text-xs font-medium">{effMetaSize}px {formData.coverMetaSize === null && "(privzeto)"}</span>
                        </div>
                        <Slider min={12} max={32} step={0.5} value={[effMetaSize]} onValueChange={v => setFormData({ ...formData, coverMetaSize: v[0] })} />
                      </div>
                      <div className="space-y-3">
                        <div className="flex justify-between">
                          <Label className="text-xs text-muted-foreground">Prosojnost metapodatkov</Label>
                          <span className="text-xs font-medium">{effMetaOpacity} % {formData.coverMetaOpacity === null && "(privzeto)"}</span>
                        </div>
                        <Slider min={20} max={100} step={1} value={[effMetaOpacity]} onValueChange={v => setFormData({ ...formData, coverMetaOpacity: v[0] })} />
                      </div>

                      <div className="space-y-3">
                        <div className="flex justify-between">
                          <Label className="text-xs text-muted-foreground">Zatemnitev slike (Veil)</Label>
                          <span className="text-xs font-medium">{effVeil} % {formData.coverVeil === null && "(privzeto)"}</span>
                        </div>
                        <Slider min={0} max={60} step={1} value={[effVeil]} onValueChange={v => setFormData({ ...formData, coverVeil: v[0] })} />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="font-semibold text-sm border-b pb-2">Postavitev</h4>
                    <div className="grid grid-cols-2 gap-4 pt-2">
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">Poravnava {formData.coverAlign === null && "(privzeto)"}</Label>
                        <div className="flex bg-muted rounded-md p-1 w-max border">
                          <button 
                            className={`px-4 py-1.5 text-sm rounded-sm font-medium transition-colors ${effAlign === 'left' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                            onClick={() => setFormData({ ...formData, coverAlign: 'left' })}
                          >
                            Levo
                          </button>
                          <button 
                            className={`px-4 py-1.5 text-sm rounded-sm font-medium transition-colors ${effAlign === 'center' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                            onClick={() => setFormData({ ...formData, coverAlign: 'center' })}
                          >
                            Sredina
                          </button>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">Ocena {formData.coverShowRating === null && "(privzeto)"}</Label>
                        <div className="flex bg-muted rounded-md p-1 w-max border">
                          <button 
                            className={`px-4 py-1.5 text-sm rounded-sm font-medium transition-colors ${effShowRating ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                            onClick={() => setFormData({ ...formData, coverShowRating: true })}
                          >
                            Prikaži
                          </button>
                          <button 
                            className={`px-4 py-1.5 text-sm rounded-sm font-medium transition-colors ${!effShowRating ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                            onClick={() => setFormData({ ...formData, coverShowRating: false })}
                          >
                            Skrij
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {formData.theme === 'swipe' && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between border-b pb-2">
                        <h4 className="font-semibold text-sm">Ikone spodaj</h4>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7"
                          onClick={() => setFormData(prev => ({ ...prev, ...NAV_DEFAULTS }))}
                        >
                          <RefreshCcw className="w-3 h-3 mr-1.5" />
                          Ponastavi
                        </Button>
                      </div>
                      {([
                        { key: 'navColorCover', label: 'Barva na naslovnici', lum: coverLum },
                        { key: 'navColor', label: 'Barva na podstraneh', lum: relLuminance('#FFFFFF') },
                        { key: 'navColorOn', label: 'Barva izbrane ikone', lum: relLuminance('#FFFFFF') },
                      ] as const).map(({ key, label, lum }) => {
                        const value = formData[key];
                        const ratio = lum !== null ? contrastRatio(value, lum) : null;
                        return (
                          <div key={key} className="pt-1">
                            <div className="flex items-center justify-between mb-2">
                              <Label className="text-xs text-muted-foreground">{label}</Label>
                              <span className="text-xs font-mono font-medium">{value.toUpperCase()}</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="flex items-center gap-2">
                                {PRESET_COLORS.map(color => (
                                  <button
                                    key={color}
                                    className={`w-8 h-8 rounded-full border shadow-sm transition-transform ${value.toUpperCase() === color ? 'scale-110 ring-2 ring-primary ring-offset-1' : 'hover:scale-110'}`}
                                    style={{ backgroundColor: color }}
                                    onClick={() => setFormData({ ...formData, [key]: color })}
                                    title={color}
                                  />
                                ))}
                              </div>
                              <Input
                                type="color"
                                value={value}
                                onChange={e => setFormData({ ...formData, [key]: e.target.value })}
                                className="w-10 h-10 p-1 cursor-pointer"
                              />
                            </div>
                            {ratio !== null && ratio < 3 && (
                              <p className="text-xs text-amber-600 mt-1.5">Ta barva je slabo vidna.</p>
                            )}
                            {key === 'navColorCover' && ratio === null && (
                              <p className="text-xs text-muted-foreground mt-1.5">Kontrasta z naslovnico ni mogoče preveriti (ni fotografije ali pa je naslovnica 360° ogled).</p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                </div>
                
                {/* Live Preview */}
                <div className="lg:col-span-5">
                  <div className="sticky top-24">
                    <Label className="mb-3 block text-sm font-semibold">Predogled v živo</Label>
                    <div 
                      className="relative rounded-[2rem] overflow-hidden shadow-2xl border-4 border-muted bg-muted mx-auto max-w-sm"
                      style={{
                        aspectRatio: '9/16',
                        backgroundImage: formData.heroUrl ? `url(${formData.heroUrl})` : 'none',
                        backgroundColor: formData.heroUrl ? 'transparent' : '#1e293b',
                        backgroundSize: 'cover',
                        backgroundPosition: 'center'
                      }}
                    >
                      <div 
                        className="absolute inset-0 bg-black pointer-events-none transition-opacity duration-200" 
                        style={{ opacity: effVeil / 100 }}
                      />

                      <div 
                        className="absolute inset-x-0 bottom-0 flex flex-col pointer-events-none transition-all duration-200"
                        style={{ 
                          padding: formData.theme === 'mediterran' ? '1.5rem 1.5rem 2.5rem' : '2rem',
                          backgroundColor: formData.theme === 'mediterran' ? '#FFFFFF' : 'transparent',
                          borderTopLeftRadius: formData.theme === 'mediterran' ? '1.5rem' : '0',
                          borderTopRightRadius: formData.theme === 'mediterran' ? '1.5rem' : '0',
                          alignItems: effAlign === 'center' ? 'center' : 'flex-start',
                          textAlign: effAlign === 'center' ? 'center' : 'left',
                        }}
                      >
                        {effShowRating && (
                          <div 
                            className="flex items-center gap-1.5 mb-4 font-semibold transition-all duration-200"
                            style={{
                              fontSize: `${effMetaSize}px`,
                              opacity: effMetaOpacity / 100,
                              color: effTextColor,
                            }}
                          >
                            <span style={{ color: effTextColor === '#FFFFFF' ? '#FBBF24' : 'currentColor', opacity: 0.9 }}>★</span> 4.9 (120)
                          </div>
                        )}
                        
                        <h1 
                          className="font-bold leading-[1.1] mb-2 tracking-tight transition-all duration-200"
                          style={{
                            fontSize: `${effTitleSize}px`,
                            opacity: effTitleOpacity / 100,
                            color: effTextColor,
                            display: '-webkit-box',
                            WebkitLineClamp: 3,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden'
                          }}
                        >
                          {formData.coverTitle || formData.name || 'Ime namestitve'}
                        </h1>
                        
                        <p 
                          className="font-medium transition-all duration-200"
                          style={{
                            fontSize: `${effSubSize}px`,
                            opacity: effSubOpacity / 100,
                            color: effTextColor,
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden'
                          }}
                        >
                          {formData.coverSubtitle || formData.subtitle || 'Podnaslov namestitve'}
                        </p>
                      </div>

                      {formData.theme === 'swipe' && (
                        <div
                          className="absolute inset-x-2 bottom-3 flex items-center justify-around pointer-events-none"
                          style={{ height: 40, color: formData.navColorCover, filter: 'drop-shadow(0 1px 6px rgba(0,0,0,.55))' }}
                        >
                          <Home size={22} strokeWidth={1.9} />
                          <ShoppingBag size={22} strokeWidth={1.9} />
                          <Compass size={22} strokeWidth={1.9} />
                          <ShoppingCart size={22} strokeWidth={1.9} />
                          <MessageCircle size={22} strokeWidth={1.9} />
                        </div>
                      )}
                    </div>

                    {formData.theme === 'swipe' && (
                      <div className="mt-3 rounded-xl border bg-white px-2 py-2 flex items-center justify-around max-w-sm mx-auto">
                        <Home size={22} strokeWidth={2.5} style={{ color: formData.navColorOn }} />
                        <ShoppingBag size={22} strokeWidth={1.9} style={{ color: formData.navColor }} />
                        <Compass size={22} strokeWidth={1.9} style={{ color: formData.navColor }} />
                        <ShoppingCart size={22} strokeWidth={1.9} style={{ color: formData.navColor }} />
                        <MessageCircle size={22} strokeWidth={1.9} style={{ color: formData.navColor }} />
                      </div>
                    )}
                  </div>
                </div>

              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="contacts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Kontaktni podatki in lokacija</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Telefon</Label>
                  <Input value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>WhatsApp</Label>
                  <Input value={formData.whatsapp} onChange={e => setFormData({ ...formData, whatsapp: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Viber</Label>
                  <Input value={formData.viber} onChange={e => setFormData({ ...formData, viber: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Instagram uporabniško ime</Label>
                  <Input value={formData.instagram} onChange={e => setFormData({ ...formData, instagram: e.target.value })} />
                </div>
                <div className="space-y-2 col-span-2">
                  <Label>Poizvedba za zemljevid (Map Query)</Label>
                  <Input value={formData.mapQuery} onChange={e => setFormData({ ...formData, mapQuery: e.target.value })} placeholder="npr. Malija 143b, Izola" />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="content">
          <Card>
            <CardHeader>
              <CardTitle>Struktura vsebine</CardTitle>
            </CardHeader>
            <CardContent>
              {tenant.sections?.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Trenutno ni nobenih sekcij. Ustvarite prvo sekcijo za začetek.
                </div>
              ) : (
                <div className="space-y-6">
                  {tenant.sections?.map(section => (
                    <div key={section.id} className="border-2 border-border rounded-xl p-4">
                      <div className="flex items-center justify-between mb-4 pb-2 border-b">
                        <h3 className="font-bold text-lg flex items-center gap-2">
                          <span className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">{section.icon}</span>
                          {section.title}
                        </h3>
                        <Button variant="ghost" size="sm">Uredi sekcijo</Button>
                      </div>
                      
                      <div className="pl-4 border-l-2 border-border/50 ml-4 space-y-4">
                        {section.categories?.map(category => (
                          <div key={category.id} className="bg-muted/50 rounded-lg p-3">
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="font-semibold flex items-center gap-2">
                                {category.icon} {category.label}
                                <span className="text-xs font-normal text-muted-foreground px-2 py-0.5 bg-background rounded-full border">{category.layout}</span>
                              </h4>
                              <Button variant="ghost" size="sm" className="h-8">Uredi</Button>
                            </div>
                            
                            <div className="space-y-2 pl-2">
                              {category.items?.map((item: any) => (
                                <div key={item.id} className="bg-background border rounded p-2 text-sm">
                                  <span>{item.title || '(Brez naslova)'}</span>
                                  <ItemMediaEditor itemId={item.id} tenantId={tenant.id} media={item.media || []} />
                                </div>
                              ))}
                              <Button variant="ghost" size="sm" className="w-full border border-dashed mt-2 h-8 text-xs text-muted-foreground">
                                + Dodaj element
                              </Button>
                            </div>
                          </div>
                        ))}
                        <Button variant="outline" size="sm" className="w-full border-dashed">
                          + Dodaj kategorijo
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <Button className="w-full mt-6" variant="secondary">
                + Nova sekcija
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
