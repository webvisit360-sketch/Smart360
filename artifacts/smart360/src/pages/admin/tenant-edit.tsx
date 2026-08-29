import { useGetAdminSession, useGetPublicTenant, useGetTenant, useUpdateTenant, useRenewTenant, useListTenantRenewals, useListTenantChangelog, useListTenantOverview, getGetTenantQueryKey, getListTenantsQueryKey, getListTenantRenewalsQueryKey, getGetAdminOverviewQueryKey, getListTenantChangelogQueryKey, getListTenantOverviewQueryKey } from "@workspace/api-client-react";
import { useRoute, useLocation } from "wouter";
import { Loader2, RefreshCcw, Upload, ImageIcon, UserRoundCog } from "lucide-react";
import { actorLabel } from "@/pages/admin/dashboard";
import { AdminBadge as Badge } from "@/components/ui/badge";
import { AdminButton as Button } from "@/components/ui/button";
import { AdminCard as Card, AdminCardContent as CardContent, AdminCardHeader as CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQueryClient } from "@tanstack/react-query";
import { AdminTenantOverview } from "@/components/admin/admin-tenant-overview";
import { AdminTenantOrders } from "@/components/admin/admin-tenant-orders";
import { AdminTenantMessages } from "@/components/admin/admin-tenant-messages";
import { ContentEditor } from "@/components/admin/content-editor";
import { TranslationsEditor } from "@/components/admin/translations-editor";
import { AdminLivingGuideSettings } from "@/components/admin/admin-living-guide-settings";
import { CoverEditor, THEME_DEFAULTS, PRESET_COLORS } from "@/components/admin/cover-editor";
import { SlugField } from "@/components/admin/slug-field";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useMemo, useRef, useState } from "react";
import { parseVirtualTourInput } from "@/lib/virtual-tour";
import { DistanceReview } from "@/components/admin/distance-review";
import { isLikelyUrl } from "@/lib/maps-href";
import { HostInvitePanel } from "@/components/admin/host-invite-panel";
import { useHostSession } from "@/hooks/use-host-session";
import { collapseConsecutiveChangelog } from "@/lib/changelog-collapse";

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
  const { data: session } = useGetAdminSession();
  const { data: hostSession } = useHostSession();
  const isOwner = Boolean(session?.authenticated);

  const operatorEntryCalled = useRef(false);
  useEffect(() => {
    if (isOwner && id && !operatorEntryCalled.current) {
      operatorEntryCalled.current = true;
      fetch(`/api/admin/tenants/${id}/operator-entry`, {
        method: "POST",
        headers: { "Idempotency-Key": crypto.randomUUID() },
      }).catch(() => undefined);
    }
  }, [isOwner, id]);

  const { data: tenant, isLoading } = useGetTenant(id, { query: { enabled: !!id, queryKey: getGetTenantQueryKey(id) } });
  const { data: tenantOverviews } = useListTenantOverview({
    query: { queryKey: getListTenantOverviewQueryKey() },
  });
  const tenantOverview = tenantOverviews?.find((row) => row.tenantId === id);

  const { data: previewTenant } = useGetPublicTenant(
    tenant?.slug || "",
    { preview: true },
    {
      query: {
        enabled: Boolean(tenant?.slug),
        queryKey: ["portalPreviewTenant", tenant?.slug],
      },
    },
  );
  const updateMutation = useUpdateTenant({
    mutation: {
      onSuccess: (data) => {
        queryClient.setQueryData(getGetTenantQueryKey(id), (old: any) => old ? { ...old, ...data } : old);
        queryClient.invalidateQueries({ queryKey: getListTenantsQueryKey() });
        setFormData((prev) => {
          if (prev.tourUrl === (data.tourUrl || "")) return prev;
          return { ...prev, tourUrl: data.tourUrl || "" };
        });
      },
      onError: (err: any) => {
        if (err?.status === 409) {
          toast({ title: "Naslov je zaseden", description: "Ta naslov je že zaseden. Izberite drugega.", variant: "destructive" });
        } else if (err?.status === 400 && err?.data?.errors) {
          const msgs = err.data.errors.map((e: any) => e.message).join(", ");
          toast({ title: "Neveljavni podatki", description: msgs, variant: "destructive" });
        } else {
          toast({ title: "Napaka", description: err?.data?.error || err?.data?.message || err?.message || "Shranjevanje ni uspelo.", variant: "destructive" });
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
    email: "",
    orderNotifyEmail: true,
    messageNotifyEmail: true,
    mapQuery: "",
    mapUrl: "",
    latitude: "",
    longitude: "",
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

    wifiSsid: "",
    wifiPass: "",
    wifiEnc: null as string | null, // null = WPA (privzeto)
    bgColor: null as string | null, // null = belo (privzeto)
    guestUiMode: "legacy" as "legacy" | "living-guide",
  });

  // Media quota edited in GB, stored in bytes (kept out of formData so the
  // GB↔bytes conversion happens exactly once, on save).
  const [mediaQuotaGb, setMediaQuotaGb] = useState("2");
  const [orderPasswordDraft, setOrderPasswordDraft] = useState("");
  const [orderPasswordConfigured, setOrderPasswordConfigured] = useState(false);

  // Renewal ("Obnova"): a real editable date, edited directly (not via
  // formData — saving it immediately keeps the history trail on the server).
  const { data: renewals } = useListTenantRenewals(id, {
    query: {
      enabled: isOwner && Boolean(id),
      queryKey: getListTenantRenewalsQueryKey(id),
    },
  });
  const renewMutation = useRenewTenant({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetTenantQueryKey(id) });
        queryClient.invalidateQueries({ queryKey: getListTenantsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListTenantRenewalsQueryKey(id) });
        queryClient.invalidateQueries({ queryKey: getGetAdminOverviewQueryKey() });
        toast({ title: "Obnovljeno", description: "Datum obnove je zamaknjen za eno leto." });
      },
    },
  });

  const initRef = useRef<string | null>(null);
  const [originalSlug, setOriginalSlug] = useState("");
  const heroFileRef = useRef<HTMLInputElement>(null);
  const logoFileRef = useRef<HTMLInputElement>(null);
  const [uploadBusy, setUploadBusy] = useState<"hero" | "logo" | null>(null);

  const [activeTab, setActiveTab] = useState("pregled");
  const isSettings = ["general", "appearance", "contacts", "translations", "guide", "changelog"].includes(activeTab);
  const [previewScreen, setPreviewScreen] = useState<"home" | "category">("home");

  // Reload the real guest iframe only after a draft mutation succeeds. Text
  // editors already debounce their writes; this avoids a request per keystroke
  // and means the reloaded iframe always receives persisted preview data.
  const [previewKey, setPreviewKey] = useState(0);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    return queryClient.getMutationCache().subscribe((event: any) => {
      if (event?.type !== "updated" || event?.action?.type !== "success") return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => setPreviewKey((key) => key + 1), 40);
    });
  }, [queryClient]);

  useEffect(() => {
    setPreviewScreen(["content", "distances", "guide"].includes(activeTab) ? "category" : "home");
  }, [activeTab]);

  // Auto-save logic
  const lastSaved = useRef(formData);
  useEffect(() => {
    if (initRef.current !== id) return;
    const currentStr = JSON.stringify(formData);
    const lastStr = JSON.stringify(lastSaved.current);
    if (currentStr !== lastStr) {
      const snapshot = formData;
      const t = setTimeout(() => {
        const { latitude: _l, longitude: _lo, ...saveData } = formData;
        updateMutation.mutate({
          id,
          data: {
            ...saveData,
            customDomain: formData.customDomain.trim() || null,
            email: formData.email.trim() || null,
            mapUrl: formData.mapUrl.trim() || null,
            wifiSsid: formData.wifiSsid.trim() || null,
            wifiPass: formData.wifiPass || null,
            mediaQuotaBytes: Math.round(Math.max(0.1, parseFloat(mediaQuotaGb.replace(",", ".")) || 2) * 1_000_000_000),
          },
        }, {
          onSuccess: () => {
            lastSaved.current = snapshot;
          },
        });
      }, 500);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [formData, id, mediaQuotaGb]);

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
      setOrderPasswordConfigured(Boolean(tenant.orderPasswordConfigured));
      setOrderPasswordDraft("");
      setMediaQuotaGb(((tenant.mediaQuotaBytes ?? 2_000_000_000) / 1_000_000_000).toFixed(1).replace(/\.0$/, ""));
      const initialForm = {
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
        email: tenant.email || "",
        orderNotifyEmail: tenant.orderNotifyEmail,
        messageNotifyEmail: tenant.messageNotifyEmail ?? true,
        mapQuery: tenant.mapQuery || "",
        mapUrl: tenant.mapUrl || "",
        latitude: tenant.latitude?.toString() ?? "",
        longitude: tenant.longitude?.toString() ?? "",
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

        wifiSsid: tenant.wifiSsid ?? "",
        wifiPass: tenant.wifiPass ?? "",
        wifiEnc: tenant.wifiEnc ?? null,
        bgColor: tenant.bgColor ?? null,
        guestUiMode: (tenant.guestUiMode === "living-guide" ? "living-guide" : "legacy") as "legacy" | "living-guide",
      };
      lastSaved.current = initialForm;
      setFormData(initialForm);
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

  const firstPreviewCategoryId =
    ((previewTenant as any)?.sections || [])
      .flatMap((section: any) => section.categories || [])
      .find((category: any) => typeof category?.id === "string")?.id ?? null;
  const previewBase = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");
  const previewPath =
    previewScreen === "category" && firstPreviewCategoryId
      ? `/${tenant.slug}/c/${encodeURIComponent(firstPreviewCategoryId)}`
      : `/${tenant.slug}`;
  const previewUrl = `${previewBase}${previewPath}?preview=1`;

  const handlePublish = () => {
    const { latitude: _latitude, longitude: _longitude, ...saveFormData } = formData;
    setFormData(prev => ({ ...prev, isPublished: true }));
    updateMutation.mutate({
      id,
      data: { 
        ...saveFormData, 
        isPublished: true,
        customDomain: formData.customDomain.trim() || null,
        email: formData.email.trim() || null,
        mapUrl: formData.mapUrl.trim() || null,
        wifiSsid: formData.wifiSsid.trim() || null,
        wifiPass: formData.wifiPass || null,
        mediaQuotaBytes: Math.round(Math.max(0.1, parseFloat(mediaQuotaGb.replace(",", ".")) || 2) * 1_000_000_000),
      },
    }, {
      onSuccess: () => {
        toast({ title: "Objavljeno", description: "Spremembe so vidne gostom." });
      }
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
    <div className="admin-tenant-console flex flex-col md:flex-row h-[100dvh] overflow-hidden font-sans" data-surface="admin">

      {/* SIDEBAR */}
      <aside className="w-full md:w-[264px] bg-white border-b md:border-b-0 md:border-r border-black/5 flex flex-row md:flex-col shrink-0 px-3 md:px-[14px] py-3 md:py-[22px] overflow-x-auto md:overflow-x-visible md:overflow-y-auto">
        <div className="flex flex-row md:flex-col gap-2 md:gap-[11px] mb-0 md:mb-8 shrink-0">
          <button onClick={() => setActiveTab('pregled')} className={`h-[42px] md:h-[47px] rounded-[14px] text-[14px] md:text-[16px] font-[650] flex items-center px-3 md:px-4 whitespace-nowrap transition-colors ${activeTab === 'pregled' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}>Pregled</button>
          <button onClick={() => setActiveTab('kreator')} className={`h-[42px] md:h-[47px] rounded-[14px] text-[14px] md:text-[16px] font-[650] flex items-center px-3 md:px-4 whitespace-nowrap transition-colors ${activeTab === 'kreator' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}>Kreator vodnika</button>
          <button onClick={() => setActiveTab('orders')} className={`h-[42px] md:h-[47px] rounded-[14px] text-[14px] md:text-[16px] font-[650] flex items-center justify-between gap-2 px-3 md:px-4 whitespace-nowrap transition-colors ${activeTab === 'orders' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}>
            <span>Naročila</span>
            {(tenantOverview?.pendingOrders ?? 0) > 0 && (
              <span className="bg-destructive text-destructive-foreground text-[13px] font-[800] h-[24px] px-2 rounded-full flex items-center justify-center">{tenantOverview?.pendingOrders}</span>
            )}
          </button>
          <button onClick={() => setActiveTab('messages')} className={`h-[42px] md:h-[47px] rounded-[14px] text-[14px] md:text-[16px] font-[650] flex items-center justify-between gap-2 px-3 md:px-4 whitespace-nowrap transition-colors ${activeTab === 'messages' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}>
            <span>Sporočila</span>
            {(tenantOverview?.pendingMessages ?? 0) > 0 && (
              <span className="bg-destructive text-destructive-foreground text-[13px] font-[800] h-[24px] px-2 rounded-full flex items-center justify-center">{tenantOverview?.pendingMessages}</span>
            )}
          </button>
        </div>

        <div className="hidden md:block mb-2 px-4 text-xs font-[800] text-muted-foreground uppercase tracking-widest">Vsak dan</div>
        <div className="flex flex-row md:flex-col gap-2 md:gap-[11px] mb-0 md:mb-8 shrink-0">
          <button onClick={() => setActiveTab('obvestila')} className={`h-[42px] md:h-[47px] rounded-[14px] text-[14px] md:text-[16px] font-[650] flex items-center px-3 md:px-4 whitespace-nowrap transition-colors ${activeTab === 'obvestila' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}>Obvestila</button>
          <button onClick={() => setActiveTab('ponudba')} className={`h-[42px] md:h-[47px] rounded-[14px] text-[14px] md:text-[16px] font-[650] flex items-center px-3 md:px-4 whitespace-nowrap transition-colors ${activeTab === 'ponudba' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}>Ponudba in cene</button>
        </div>

        <div className="hidden md:block mb-2 px-4 text-xs font-[800] text-muted-foreground uppercase tracking-widest">Vsebina</div>
        <div className="flex flex-row md:flex-col gap-2 md:gap-[11px] md:mb-auto shrink-0">
          <button onClick={() => setActiveTab('distances')} className={`h-[42px] md:h-[47px] rounded-[14px] text-[14px] md:text-[16px] font-[650] flex items-center px-3 md:px-4 whitespace-nowrap transition-colors ${activeTab === 'distances' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}>Okolica</button>
          <button onClick={() => setActiveTab('content')} className={`h-[42px] md:h-[47px] rounded-[14px] text-[14px] md:text-[16px] font-[650] flex items-center px-3 md:px-4 whitespace-nowrap transition-colors ${activeTab === 'content' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}>Nastanitev</button>
          <button onClick={() => setActiveTab('general')} className={`h-[42px] md:h-[47px] rounded-[14px] text-[14px] md:text-[16px] font-[650] flex items-center px-3 md:px-4 whitespace-nowrap transition-colors ${isSettings ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}>Nastavitve</button>
        </div>

        <div className="hidden md:flex mt-8 pt-4 border-t border-black/5 px-4 flex-col gap-1">
          <p className="text-sm font-semibold truncate">
            {isOwner ? "Smart360 operater" : hostSession?.email || "Gostitelj"}
          </p>
          {isOwner ? (
            <button
              onClick={() => setLocation("/admin")}
              className="text-sm text-muted-foreground hover:text-foreground text-left"
            >
              Nazaj na namestitve
            </button>
          ) : (
            <>
              <button
                onClick={() => setLocation("/admin/account")}
                className="text-sm text-muted-foreground hover:text-foreground text-left"
                data-testid="button-open-account"
              >
                Moj račun
              </button>
              <button
                onClick={async () => {
                  await fetch("/api/admin/host/logout", {
                    method: "POST",
                    credentials: "include",
                  }).catch(() => undefined);
                  setLocation("/admin/login");
                }}
                className="text-sm text-muted-foreground hover:text-foreground text-left"
              >
                Odjava
              </button>
            </>
          )}
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">

        {/* HEADER */}
        <header className="min-h-[68px] md:h-[80px] px-4 md:px-[30px] py-3 md:py-0 bg-white/95 backdrop-blur border-b border-black/5 sticky top-0 z-20 flex items-center justify-between gap-3 shrink-0">
          <div className="min-w-0 flex items-center gap-3">
            <h1 className="text-[18px] md:text-[26px] font-[800] tracking-tight truncate">{tenant.name}</h1>
            {tenant.isPublished ? (
              <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-none shrink-0">Objavljeno</Badge>
            ) : (
              <Badge variant="secondary" className="bg-amber-100 text-amber-800 hover:bg-amber-100 border-none shrink-0">Osnutek</Badge>
            )}
            {isOwner && (
              <div className="ml-2 flex items-center gap-1.5 text-sm font-semibold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-md shrink-0 border border-emerald-200">
                <UserRoundCog className="h-4 w-4" />
                Smart360 operater
              </div>
            )}
            {tenant.copiedFromTenantId && (
              <Badge className="bg-amber-500 text-white hover:bg-amber-500 border-none shrink-0">KOPIJA</Badge>
            )}
          </div>

          <Button onClick={handlePublish} disabled={updateMutation.isPending} className="rounded-[12px] md:rounded-[14px] px-3 md:px-[20px] py-2 md:py-[12px] text-[14px] md:text-[16px] font-[700] h-auto shrink-0">
            {updateMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            Objavi
          </Button>
        </header>

        {/* SCROLLABLE VIEW */}
        <div className="flex-1 overflow-auto p-4 md:p-[30px]">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            {isSettings && (
              <TabsList className="mb-6 bg-white border border-black/5 rounded-[14px] p-1">
                <TabsTrigger value="general" className="rounded-[10px]">Splošno</TabsTrigger>
                <TabsTrigger value="appearance" className="rounded-[10px]">Videz</TabsTrigger>
                <TabsTrigger value="contacts" className="rounded-[10px]">Stiki & Lokacija</TabsTrigger>
                <TabsTrigger value="translations" className="rounded-[10px]">Prevodi</TabsTrigger>
                <TabsTrigger value="guide" className="rounded-[10px]">Living Guide</TabsTrigger>
                <TabsTrigger value="changelog" className="rounded-[10px]">Zgodovina sprememb</TabsTrigger>
              </TabsList>
            )}

            <TabsContent value="pregled">
              <AdminTenantOverview tenantId={id} onTabChange={setActiveTab} />
            </TabsContent>
            <TabsContent value="kreator"><div className="p-8 text-center text-muted-foreground border-2 border-dashed rounded-[22px] bg-white">Kreator vodnika (CP4)</div></TabsContent>
            <TabsContent value="obvestila"><div className="p-8 text-center text-muted-foreground border-2 border-dashed rounded-[22px] bg-white">Obvestila (CP6)</div></TabsContent>
            <TabsContent value="ponudba"><div className="p-8 text-center text-muted-foreground border-2 border-dashed rounded-[22px] bg-white">Ponudba in cene (CP6)</div></TabsContent>
            <TabsContent value="orders"><AdminTenantOrders tenantId={id} /></TabsContent>
            <TabsContent value="messages"><AdminTenantMessages tenantId={id} /></TabsContent>
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
                <div className="col-span-2 space-y-2">
                  <Label>Virtualni sprehod</Label>
                  <Textarea
                    className="min-h-[96px]"
                    placeholder="Prilepite kodo (iframe/script) ali URL ponudnika..."
                    value={formData.tourUrl} 
                    onChange={e => setFormData({ ...formData, tourUrl: e.target.value })} 
                  />
                  {(() => {
                    const parsed = parseVirtualTourInput(formData.tourUrl);
                    if (parsed.error && formData.tourUrl.trim()) {
                      return <p className="text-sm text-destructive">{parsed.error}</p>;
                    }
                    if (parsed.url) {
                      return (
                        <div className="mt-2">
                          <p className="text-xs text-muted-foreground mb-2">Gumbi in logotipi ponudnika se urejajo pri ponudniku. Predogled:</p>
                          <div className="relative w-full overflow-hidden rounded-xl border bg-muted" style={{ aspectRatio: "16/9" }}>
                            <iframe
                              src={parsed.url}
                              className="absolute inset-0 w-full h-full border-0"
                              allow="xr-spatial-tracking; gyroscope; accelerometer; fullscreen"
                              allowFullScreen
                              scrolling="no"
                              title="Predogled virtualnega sprehoda"
                            />
                          </div>
                        </div>
                      );
                    }
                    return null;
                  })()}
                </div>
                <div className="space-y-2">
                  <Label>Kvota za medije (GB)</Label>
                  <Input type="number" min={0.1} step={0.5} value={mediaQuotaGb} onChange={e => setMediaQuotaGb(e.target.value)} />
                  <p className="text-xs text-muted-foreground">Pri 100 % so nova nalaganja zavrnjena; obstoječa vsebina se nikoli ne briše.</p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4 pt-4 border-t mt-4">
                <div className="space-y-2">
                  <Label>WiFi omrežje (SSID)</Label>
                  <Input value={formData.wifiSsid} onChange={e => setFormData({ ...formData, wifiSsid: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>WiFi geslo</Label>
                  <Input value={formData.wifiPass} onChange={e => setFormData({ ...formData, wifiPass: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Šifriranje</Label>
                  <select
                    className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                    value={formData.wifiEnc ?? "WPA"}
                    onChange={e => setFormData({ ...formData, wifiEnc: e.target.value === "WPA" ? null : e.target.value })}
                  >
                    <option value="WPA">WPA / WPA2 / WPA3 (običajno)</option>
                    <option value="WEP">WEP (star usmerjevalnik)</option>
                    <option value="nopass">Brez gesla</option>
                  </select>
                  <p className="text-xs text-muted-foreground">Gostje na WiFi strani dobijo QR za samodejno povezavo.</p>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-4">
                <button 
                  type="button"
                  className={`w-12 h-6 rounded-full transition-colors relative ${formData.isPublished ? 'bg-primary' : 'bg-muted-foreground/30'}`}
                  onClick={() => setFormData({ ...formData, isPublished: !formData.isPublished })}
                >
                  <div className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-all ${formData.isPublished ? 'left-7' : 'left-1'}`} />
                </button>
                <Label>Objavljeno (vidno gostom)</Label>
              </div>

              <div className="flex items-start justify-between gap-4 border-t pt-4">
                <div className="space-y-1">
                  <Label htmlFor="order-notify-email">E-poštno obvestilo ob novem naročilu</Label>
                  <p className="text-xs text-muted-foreground">
                    Če je izklopljeno, naročilo še vedno takoj prispe v zavihek Naročila.
                  </p>
                </div>
                <Switch
                  id="order-notify-email"
                  checked={formData.orderNotifyEmail}
                  onCheckedChange={(checked) =>
                    setFormData((current) => ({ ...current, orderNotifyEmail: checked }))
                  }
                  aria-label="E-poštno obvestilo ob novem naročilu"
                  data-testid="switch-order-notify-email"
                />
              </div>
              <div className="flex items-start justify-between gap-4 border-t pt-4 mt-4">
                <div className="space-y-1">
                  <Label htmlFor="message-notify-email">E-poštno obvestilo ob sporočilu gosta</Label>
                  <p className="text-xs text-muted-foreground">
                    Če je izklopljeno, sporočilo še vedno takoj prispe v zavihek Sporočila.
                  </p>
                </div>
                <Switch
                  id="message-notify-email"
                  checked={formData.messageNotifyEmail}
                  onCheckedChange={(checked) =>
                    setFormData((current) => ({ ...current, messageNotifyEmail: checked }))
                  }
                  aria-label="E-poštno obvestilo ob sporočilu gosta"
                  data-testid="switch-message-notify-email"
                />
              </div>
            </CardContent>
          </Card>
          <Card data-testid="card-guest-ui-mode">
            <CardHeader>
              <CardTitle>Vmesnik za goste</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Neodvisno od vizualne teme — določa, kateri vmesnik vidijo gostje.
              </p>
              <div
                className="grid grid-cols-1 md:grid-cols-2 gap-4"
                role="radiogroup"
                aria-label="Vmesnik za goste"
              >
                <button
                  type="button"
                  role="radio"
                  aria-checked={formData.guestUiMode === "legacy"}
                  data-testid="guest-ui-mode-legacy"
                  className={`w-full border rounded-xl p-4 text-left cursor-pointer transition-all ${formData.guestUiMode === "legacy" ? "border-primary ring-1 ring-primary bg-primary/5" : "hover:bg-muted"}`}
                  onClick={() =>
                    setFormData((current) => ({ ...current, guestUiMode: "legacy" }))
                  }
                >
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-semibold">Klasični vmesnik (legacy)</h4>
                    <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${formData.guestUiMode === "legacy" ? "border-primary" : "border-muted-foreground/30"}`}>
                      {formData.guestUiMode === "legacy" && <div className="w-2.5 h-2.5 bg-primary rounded-full" />}
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Sredozemska ali Poteg tema — privzeto za vse namestitve
                  </p>
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={formData.guestUiMode === "living-guide"}
                  data-testid="guest-ui-mode-living-guide"
                  className={`w-full border rounded-xl p-4 text-left cursor-pointer transition-all ${formData.guestUiMode === "living-guide" ? "border-primary ring-1 ring-primary bg-primary/5" : "hover:bg-muted"}`}
                  onClick={() =>
                    setFormData((current) => ({ ...current, guestUiMode: "living-guide" }))
                  }
                >
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-semibold">Living Guide (living-guide)</h4>
                    <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${formData.guestUiMode === "living-guide" ? "border-primary" : "border-muted-foreground/30"}`}>
                      {formData.guestUiMode === "living-guide" && <div className="w-2.5 h-2.5 bg-primary rounded-full" />}
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">Novi vmesnik Living Guide</p>
                </button>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Naročnina</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Vzpostavljeno</Label>
                  <p className="text-sm py-2">{tenant.createdAt ? new Date(tenant.createdAt).toLocaleDateString("sl-SI") : "—"}</p>
                </div>
                <div className="space-y-2">
                  <Label>Obnova</Label>
                  <Input
                    type="date"
                    value={tenant.renewsAt ? new Date(tenant.renewsAt).toISOString().slice(0, 10) : ""}
                    onChange={e => {
                      const v = e.target.value;
                      updateMutation.mutate({ id, data: { renewsAt: v ? new Date(v + "T12:00:00Z").toISOString() : null } });
                    }}
                  />
                  {tenant.renewsAt && (() => {
                    const days = Math.ceil((new Date(tenant.renewsAt).getTime() - Date.now()) / 86400000);
                    const cls = days < 0 ? "text-destructive" : days <= 30 ? "text-amber-600" : "text-muted-foreground";
                    return <p className={`text-xs ${cls}`}>{days < 0 ? `Zapadlo pred ${-days} dnevi` : `Čez ${days} dni`}</p>;
                  })()}
                </div>
              </div>
              <Button
                variant="outline"
                disabled={renewMutation.isPending}
                onClick={() => renewMutation.mutate({ id })}
              >
                {renewMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCcw className="w-4 h-4 mr-2" />}
                Obnovljeno za eno leto
              </Button>
              <p className="text-xs text-muted-foreground">
                Datum se zamakne točno eno leto od trenutnega datuma obnove (ne od danes). Potekla namestitev za goste deluje naprej.
              </p>
              {(renewals?.length ?? 0) > 0 && (
                <div className="border rounded-md divide-y">
                  {renewals!.map(r => (
                    <div key={r.id} className="flex items-center justify-between px-3 py-2 text-sm">
                      <span className="text-muted-foreground">{new Date(r.createdAt).toLocaleDateString("sl-SI")}</span>
                      <span>
                        {r.prevDate ? new Date(r.prevDate).toLocaleDateString("sl-SI") : "—"}
                        {" → "}
                        {new Date(r.newDate).toLocaleDateString("sl-SI")}
                      </span>
                      <span className="text-muted-foreground">{r.actor ?? ""}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
          {isOwner && <HostInvitePanel tenantId={id} />}
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
              <CardTitle>Ozadje strani</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Ena barva za celotno aplikacijo za goste. Pri temnem ozadju se barve besedila prilagodijo samodejno.
              </p>
              <div className="flex items-center gap-2 flex-wrap">
                {["#FFFFFF", "#F7F5F1", "#EEF2F6", "#14201F", "#101820", "#0B1B2B"].map(c => {
                  const active = (formData.bgColor ?? "#FFFFFF").toUpperCase() === c;
                  return (
                    <button
                      key={c}
                      type="button"
                      title={c}
                      onClick={() => setFormData({ ...formData, bgColor: c === "#FFFFFF" ? null : c })}
                      className={`w-9 h-9 rounded-full border ${active ? "ring-2 ring-primary ring-offset-2" : ""}`}
                      style={{ background: c }}
                    />
                  );
                })}
                <input
                  type="color"
                  aria-label="Poljubna barva"
                  value={formData.bgColor ?? "#FFFFFF"}
                  onChange={e => setFormData({ ...formData, bgColor: e.target.value.toUpperCase() === "#FFFFFF" ? null : e.target.value.toUpperCase() })}
                  className="w-9 h-9 rounded-full border cursor-pointer bg-transparent"
                />
              </div>
            </CardContent>
          </Card>

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

          <div data-admin-preserve="cover-editor">
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
          </div>

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
                <div className="space-y-2">
                  <Label>E-pošta</Label>
                  <Input type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} placeholder="info@primer.si" />
                </div>
                <div className="space-y-2 col-span-2">
                  <Label>Google Maps povezava</Label>
                  <Input
                    type="url"
                    value={formData.mapUrl}
                    onChange={e => setFormData({ ...formData, mapUrl: e.target.value })}
                    placeholder="https://www.google.com/maps/place/..."
                  />
                  <p className="text-xs text-muted-foreground">
                    Če je vpisana, ima prednost pred koordinatami in naslovom.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Latitude (zemljepisna širina) <span className="text-muted-foreground">samodejno iz povezave</span></Label>
                  <Input
                    value={formData.latitude}
                    readOnly
                    placeholder="—"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Longitude (zemljepisna dolžina) <span className="text-muted-foreground">samodejno iz povezave</span></Label>
                  <Input
                    value={formData.longitude}
                    readOnly
                    placeholder="—"
                  />
                  <Button type="button" variant="link" className="px-0" onClick={() => {
                    const latitude = prompt("Latitude"); const longitude = prompt("Longitude");
                    if (latitude === null || longitude === null) return;
                    updateMutation.mutate({ id, data: { latitude: Number(latitude), longitude: Number(longitude), coordinateOverride: true } });
                  }}>Popravi koordinate (skrbnik)</Button>
                </div>
                <div className="space-y-2 col-span-2">
                  <Label>Nadomestna poizvedba za zemljevid (Map Query)</Label>
                  <Input value={formData.mapQuery} onChange={e => setFormData({ ...formData, mapQuery: e.target.value })} placeholder="npr. Malija 143b, Izola" />
                  {isLikelyUrl(formData.mapQuery) && <p className="text-xs text-amber-700">To je povezava — uporabljena bo kot cilj. Za samodejne razdalje jo prilepite v polje »Google Maps povezava«.</p>}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="distances"><Card><CardHeader><CardTitle>Razdalje</CardTitle></CardHeader><CardContent><DistanceReview tenantId={id} /></CardContent></Card></TabsContent>

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
        <TabsContent value="orders" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Geslo za naročila</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <p className="text-sm font-medium">
                  {orderPasswordConfigured ? "Geslo je nastavljeno." : "Geslo ni nastavljeno."}
                </p>
                <p className="text-xs text-muted-foreground">
                  Če geslo ni nastavljeno, gostje oddajo naročilo brez gesla.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="order-password-admin">
                  {orderPasswordConfigured ? "Novo geslo" : "Geslo"}
                </Label>
                <Input
                  id="order-password-admin"
                  type="password"
                  maxLength={200}
                  autoComplete="new-password"
                  value={orderPasswordDraft}
                  onChange={(event) => setOrderPasswordDraft(event.target.value)}
                  placeholder={orderPasswordConfigured ? "Vnesite novo geslo za zamenjavo" : "Vnesite geslo za naročila"}
                  data-testid="admin-order-password"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  disabled={!orderPasswordDraft.trim() || updateMutation.isPending}
                  onClick={() =>
                    updateMutation.mutate({
                      id,
                      data: { orderPassword: orderPasswordDraft.trim() },
                    }, {
                      onSuccess: (data) => {
                        setOrderPasswordConfigured(Boolean(data.orderPasswordConfigured));
                        setOrderPasswordDraft("");
                      },
                    })
                  }
                  data-testid="save-order-password"
                >
                  Shrani geslo
                </Button>
                {orderPasswordConfigured && (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={updateMutation.isPending}
                    onClick={() =>
                      updateMutation.mutate({
                        id,
                        data: { orderPassword: null },
                      }, {
                        onSuccess: (data) => {
                          setOrderPasswordConfigured(Boolean(data.orderPasswordConfigured));
                          setOrderPasswordDraft("");
                        },
                      })
                    }
                    data-testid="clear-order-password"
                  >
                    Odstrani geslo
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
          <AdminTenantOrders tenantId={id} />
        </TabsContent>
        <TabsContent value="guide" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Living Guide</CardTitle>
            </CardHeader>
            <CardContent>
              <AdminLivingGuideSettings tenant={tenant} id={tenant.id} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="changelog">
          <TenantChangelogCard tenantId={tenant.id} />
        </TabsContent>
      </Tabs>

      </div>
      </main>

      {/* PREVIEW RAIL */}
      <aside className="w-[305px] bg-[#F5F5F7] border-l border-black/5 shrink-0 hidden min-[1240px]:flex flex-col items-center py-[30px]">
        <div className="w-[289px] h-[629px] rounded-[32px] border-[7px] border-black bg-black overflow-hidden shadow-xl mb-4 relative shrink-0">
          <iframe
            key={previewKey}
            src={previewUrl}
            className="w-[402px] h-[874px] origin-top-left border-0 bg-white"
            style={{ transform: 'scale(0.684)' }}
            title="Predogled"
          />
        </div>
        <p className="text-[14px] font-[650] text-[#14201F] mb-2">iPhone 17 Pro · 402 × 874</p>
        <div className="flex gap-2 mb-4">
          <Button
            variant="outline"
            size="sm"
            className="rounded-full text-xs h-7 px-4"
            onClick={() => setPreviewScreen("home")}
          >
            Domov
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="rounded-full text-xs h-7 px-4"
            onClick={() => setPreviewScreen("category")}
          >
            Kategorija
          </Button>
        </div>
        <p className="text-[12px] text-muted-foreground text-center px-4 leading-relaxed">
          Predogled se osveži ob vsaki spremembi.
          <br/>
          Gostje vidijo šele objavljeno različico.
        </p>
      </aside>
    </div>
  );
}

/** Per-tenant changelog with central actor attribution */
function TenantChangelogCard({ tenantId }: { tenantId: string }) {
  const { data: entries, isLoading } = useListTenantChangelog(tenantId, {
    query: { enabled: !!tenantId, queryKey: getListTenantChangelogQueryKey(tenantId) },
  });
  const collapsedEntries = useMemo(
    () => collapseConsecutiveChangelog(entries ?? []),
    [entries],
  );
  return (
    <div className="space-y-4 max-w-4xl" data-testid="section-changelog">
      <div className="bg-muted p-4 rounded-lg text-sm text-muted-foreground border">
        Ob vsaki spremembi v administraciji zabeležimo IP-naslov — zaradi varnosti in sledljivosti. IP-naslov hranimo 12 mesecev in ga nato izbrišemo; zapis o spremembi ostane.
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Zgodovina sprememb</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : !entries || entries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center" data-testid="empty-changelog">
              <p className="text-lg font-medium">Ni zabeleženih sprememb</p>
              <p className="text-sm text-muted-foreground">Za to namestitev še ni zgodovine.</p>
            </div>
          ) : (
            <div className="space-y-4">
               {collapsedEntries.map((entry) => {
                const e = entry as typeof entry & { summary?: string; requestIp?: string };
                return (
                <div key={e.id} className="flex items-start justify-between gap-4 border-b last:border-b-0 pb-4 last:pb-0" data-testid={`row-changelog-${e.id}`}>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 text-sm font-medium text-foreground">
                      <span>{e.summary}</span>
                      {e.repeatCount > 1 && (
                        <span
                          className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground"
                          aria-label={`${e.repeatCount} enaki zaporedni dogodki`}
                        >
                          ×{e.repeatCount}
                        </span>
                      )}
                    </p>
                    <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                      <span className="font-semibold text-foreground/80">{actorLabel(e)}</span>
                      {e.requestIp && (
                        <>
                          <span className="opacity-50">•</span>
                          <span className="font-mono bg-muted px-1.5 rounded">{e.requestIp}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <span className="text-xs font-medium text-muted-foreground/80 whitespace-nowrap shrink-0 bg-muted/50 px-2 py-1 rounded">
                    {new Date(e.createdAt).toLocaleString("sl-SI")}
                  </span>
                </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
