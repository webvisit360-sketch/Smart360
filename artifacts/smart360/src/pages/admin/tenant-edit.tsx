import { useGetTenant, useUpdateTenant, getGetTenantQueryKey, getListTenantsQueryKey } from "@workspace/api-client-react";
import { useRoute, useLocation } from "wouter";
import { Loader2, ArrowLeft, ExternalLink, Save, RefreshCcw, Upload, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQueryClient } from "@tanstack/react-query";
import { ContentEditor } from "@/components/admin/content-editor";
import { TranslationsEditor } from "@/components/admin/translations-editor";
import { CoverEditor, THEME_DEFAULTS, PRESET_COLORS } from "@/components/admin/cover-editor";
import { SlugField } from "@/components/admin/slug-field";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useRef, useState } from "react";

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

type ThemeKey = keyof typeof THEME_DEFAULTS;

export default function AdminTenantEdit() {
  const [, params] = useRoute("/admin/tenants/:id");
  const [, setLocation] = useLocation();
  const id = params?.id || "";
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: tenant, isLoading } = useGetTenant(id, { query: { enabled: !!id, queryKey: getGetTenantQueryKey(id) } });
  const updateMutation = useUpdateTenant({
    mutation: {
      onSuccess: (data) => {
        queryClient.setQueryData(getGetTenantQueryKey(id), (old: any) => old ? { ...old, ...data } : old);
        queryClient.invalidateQueries({ queryKey: getListTenantsQueryKey() });
        toast({ title: "Shranjeno", description: "Spremembe so bile shranjene." });
      },
      onError: (err: any) => {
        if (err?.status === 409) {
          toast({ title: "Naslov je zaseden", description: "Ta naslov je že zaseden. Izberite drugega.", variant: "destructive" });
        } else {
          toast({ title: "Napaka", description: "Shranjevanje ni uspelo.", variant: "destructive" });
        }
      },
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
    logoUrl: "",

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
    tileVeil: null as number | null,
    textScale: null as number | null,
    textFont: null as string | null,
    textColor: null as string | null,
    coverAlign: null as string | null,
    coverShowRating: null as boolean | null,

    logoX: null as number | null,
    logoY: null as number | null,
    logoW: null as number | null,
    logoOpacity: null as number | null,

    navColorCover: null as string | null,
    navColor: null as string | null,
    navColorOn: null as string | null,
  });

  // Media quota edited in GB, stored in bytes (kept out of formData so the
  // GB↔bytes conversion happens exactly once, on save).
  const [mediaQuotaGb, setMediaQuotaGb] = useState("2");

  const initRef = useRef<string | null>(null);
  const [originalSlug, setOriginalSlug] = useState("");
  const heroFileRef = useRef<HTMLInputElement>(null);
  const logoFileRef = useRef<HTMLInputElement>(null);
  const [uploadBusy, setUploadBusy] = useState<"hero" | "logo" | null>(null);

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
      setOriginalSlug(tenant.slug || "");
      setMediaQuotaGb(((tenant.mediaQuotaBytes ?? 2 * 1024 ** 3) / 1024 ** 3).toFixed(1).replace(/\.0$/, ""));
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
        logoUrl: tenant.logoUrl || "",

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
        tileVeil: tenant.tileVeil ?? null,
        textScale: tenant.textScale ?? null,
        textFont: tenant.textFont ?? null,
        textColor: tenant.textColor ?? null,
        coverAlign: tenant.coverAlign ?? null,
        coverShowRating: tenant.coverShowRating ?? null,

        logoX: tenant.logoX ?? null,
        logoY: tenant.logoY ?? null,
        logoW: tenant.logoW ?? null,
        logoOpacity: tenant.logoOpacity ?? null,

        // NULL = "use theme default" — never turn an inherited default into
        // a stored value just by opening and saving this page.
        navColorCover: tenant.navColorCover ?? null,
        navColor: tenant.navColor ?? null,
        navColorOn: tenant.navColorOn ?? null,
      });
    }
  }, [tenant]);

  const handleImageUpload = async (file: File, kind: "hero" | "logo") => {
    setUploadBusy(kind);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/admin/tenants/${id}/${kind}/upload`, {
        method: "POST",
        body: fd,
        credentials: "include",
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json() as {
        heroUrl?: string | null;
        logoUrl?: string | null;
        logoSquareUrl?: string | null;
        warning?: string;
      };
      if (kind === "hero" && data.heroUrl) setFormData(prev => ({ ...prev, heroUrl: data.heroUrl! }));
      if (kind === "logo" && data.logoUrl) setFormData(prev => ({ ...prev, logoUrl: data.logoUrl! }));
      // Opaque upload: warn once — a white box around the artwork on a photo
      // reads as a rendering fault (logotip-stranke-naslovnica.md §4).
      if (data.warning) alert(data.warning);
    } catch {
      alert(kind === "hero" ? "Nalaganje naslovnice ni uspelo." : "Nalaganje logotipa ni uspelo.");
    } finally {
      setUploadBusy(null);
    }
  };

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
        customDomain: formData.customDomain.trim() || null,
        // min 0.1 GB — a zero/invalid quota would block every upload
        mediaQuotaBytes: Math.round(Math.max(0.1, parseFloat(mediaQuotaGb.replace(",", ".")) || 2) * 1024 ** 3),
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
      tileVeil: null,
      textScale: null,
      textFont: null,
      textColor: null,
      coverAlign: null,
      coverShowRating: null,
      logoX: null,
      logoY: null,
      logoW: null,
      logoOpacity: null,
    }));
  };

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
            <a href={`/${tenant.slug}?preview=1`} target="_blank" rel="noopener noreferrer">
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
          <TabsTrigger value="translations">Prevodi</TabsTrigger>
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
                <div className="col-span-2">
                  <SlugField
                    tenantId={id}
                    name={formData.name}
                    slug={formData.slug}
                    originalSlug={originalSlug}
                    onChange={(slug) => setFormData({ ...formData, slug })}
                  />
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
                <div className="space-y-2">
                  <Label>Kvota za medije (GB)</Label>
                  <Input type="number" min={0.1} step={0.5} value={mediaQuotaGb} onChange={e => setMediaQuotaGb(e.target.value)} />
                  <p className="text-xs text-muted-foreground">Pri 100 % so nova nalaganja zavrnjena; obstoječa vsebina se nikoli ne briše.</p>
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
          {/* Hidden file inputs for hero/logo upload */}
          <input
            ref={heroFileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleImageUpload(f, "hero"); e.target.value = ""; }}
          />
          <input
            ref={logoFileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleImageUpload(f, "logo"); e.target.value = ""; }}
          />

          <Card>
            <CardHeader>
              <CardTitle>Fotografije gostitelja</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Hero image */}
                <div className="space-y-3">
                  <Label className="font-semibold">Naslovnica (Hero)</Label>
                  <div
                    className="relative rounded-xl overflow-hidden border-2 border-dashed border-muted-foreground/25 bg-muted flex items-center justify-center"
                    style={{ aspectRatio: "16/9" }}
                  >
                    {formData.heroUrl ? (
                      <img
                        src={`${formData.heroUrl}?w=620`}
                        alt="Naslovnica"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="flex flex-col items-center gap-2 text-muted-foreground py-8">
                        <ImageIcon className="w-10 h-10 opacity-40" />
                        <span className="text-sm">Ni naslovnice</span>
                      </div>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    className="w-full"
                    disabled={uploadBusy !== null}
                    onClick={() => heroFileRef.current?.click()}
                  >
                    {uploadBusy === "hero" ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Nalaganje…</>
                    ) : (
                      <><Upload className="w-4 h-4 mr-2" /> Zamenjaj naslovnico</>
                    )}
                  </Button>
                </div>

                {/* Logo image */}
                <div className="space-y-3">
                  <Label className="font-semibold">Logotip gostitelja</Label>
                  <div
                    className="relative rounded-xl overflow-hidden border-2 border-dashed border-muted-foreground/25 bg-muted flex items-center justify-center"
                    style={{ aspectRatio: "16/9" }}
                  >
                    {formData.logoUrl ? (
                      <img
                        src={`${formData.logoUrl}?w=620`}
                        alt="Logotip"
                        className="w-full h-full object-contain p-4"
                      />
                    ) : (
                      <div className="flex flex-col items-center gap-2 text-muted-foreground py-8">
                        <ImageIcon className="w-10 h-10 opacity-40" />
                        <span className="text-sm">Ni logotipa</span>
                      </div>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    className="w-full"
                    disabled={uploadBusy !== null}
                    onClick={() => logoFileRef.current?.click()}
                  >
                    {uploadBusy === "logo" ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Nalaganje…</>
                    ) : (
                      <><Upload className="w-4 h-4 mr-2" /> Zamenjaj logotip</>
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

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

          <CoverEditor
            form={{
              name: formData.name,
              subtitle: formData.subtitle,
              heroUrl: formData.heroUrl,
              theme: formData.theme,
              coverTitle: formData.coverTitle,
              coverSubtitle: formData.coverSubtitle,
              coverTitleSize: formData.coverTitleSize,
              coverTitleOpacity: formData.coverTitleOpacity,
              coverTextColor: formData.coverTextColor,
              coverSubSize: formData.coverSubSize,
              coverSubOpacity: formData.coverSubOpacity,
              coverMetaSize: formData.coverMetaSize,
              coverMetaOpacity: formData.coverMetaOpacity,
              coverVeil: formData.coverVeil,
              tileVeil: formData.tileVeil,
              textScale: formData.textScale,
              textFont: formData.textFont,
              textColor: formData.textColor,
              coverAlign: formData.coverAlign,
              coverShowRating: formData.coverShowRating,
              rating: tenant?.rating ?? null,
              reviewsCount: tenant?.reviewsCount ?? null,
              logoUrl: formData.logoUrl,
              logoX: formData.logoX,
              logoY: formData.logoY,
              logoW: formData.logoW,
              logoOpacity: formData.logoOpacity,
            }}
            onChange={(patch) => setFormData(prev => ({ ...prev, ...patch }))}
            onReset={handleResetCover}
          />

          {formData.theme === 'swipe' && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Ikone spodaj</CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8"
                  onClick={() => setFormData(prev => ({ ...prev, navColorCover: null, navColor: null, navColorOn: null }))}
                >
                  <RefreshCcw className="w-3.5 h-3.5 mr-2" />
                  Ponastavi
                </Button>
              </CardHeader>
              <CardContent className="space-y-6">
                {([
                  { key: 'navColorCover', label: 'Barva na naslovnici', lum: coverLum },
                  { key: 'navColor', label: 'Barva na podstraneh', lum: relLuminance('#FFFFFF') },
                  { key: 'navColorOn', label: 'Barva izbrane ikone', lum: relLuminance('#FFFFFF') },
                ] as const).map(({ key, label, lum }) => {
                  // NULL = inherited theme default; show the default in the picker.
                  const value = formData[key] ?? NAV_DEFAULTS[key];
                  const ratio = lum !== null ? contrastRatio(value, lum) : null;
                  return (
                    <div key={key}>
                      <div className="flex items-center justify-between mb-2">
                        <Label className="text-xs text-muted-foreground">{label}</Label>
                        <span className="text-xs font-mono font-medium">{value.toUpperCase()}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <Input
                          type="color"
                          value={value}
                          onChange={e => setFormData({ ...formData, [key]: e.target.value })}
                          className="w-10 h-10 p-1 cursor-pointer"
                        />
                        <div className="flex items-center gap-2">
                          {PRESET_COLORS.map(color => (
                            <button
                              key={color}
                              type="button"
                              className={`w-8 h-8 rounded-full border shadow-sm transition-transform ${value.toUpperCase() === color ? 'scale-110 ring-2 ring-primary ring-offset-1' : 'hover:scale-110'}`}
                              style={{ backgroundColor: color }}
                              onClick={() => setFormData({ ...formData, [key]: color })}
                              title={color}
                            />
                          ))}
                        </div>
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
              </CardContent>
            </Card>
          )}
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
              <ContentEditor sections={tenant.sections as any[] ?? []} tenantId={tenant.id} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="translations">
          <Card>
            <CardHeader>
              <CardTitle>Prevodi vsebine</CardTitle>
            </CardHeader>
            <CardContent>
              <TranslationsEditor tenantId={tenant.id} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
