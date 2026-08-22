import { useState, useRef, useEffect, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListSitePlanImages,
  useUpdateSitePlanImage,
  useDeleteSitePlanImage,
  useReorderSitePlanImages,
  getListSitePlanImagesQueryKey,
  useUpdateTenant,
  getGetTenantQueryKey,
  SitePlanImage
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ArrowDown,
  ArrowUp,
  Loader2,
  Plus,
  GripVertical,
  Trash2,
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  getLivingGuideAvailableFeatures,
  type NavItem,
} from "@/pages/living-guide/living-guide-nav-resolver";

const NAV_OPTIONS: Array<{ value: NavItem; label: string }> = [
  { value: "stay", label: "Bivanje (Stay)" },
  { value: "offer", label: "Ponudba (Offer)" },
  { value: "explore", label: "Okolica (Explore/Services)" },
  { value: "program", label: "Program (Events)" },
  { value: "messages", label: "Sporočila (Messages)" },
];

export function AdminLivingGuideSettings({ tenant, id }: { tenant: any; id: string }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadBusy, setUploadBusy] = useState(false);
  const { data: sitePlanImages = [] } = useListSitePlanImages(id, { query: { queryKey: getListSitePlanImagesQueryKey(id) } });

  const reorderMutation = useReorderSitePlanImages();
  const updateImageMutation = useUpdateSitePlanImage();
  const deleteImageMutation = useDeleteSitePlanImage();
  const updateTenantMutation = useUpdateTenant();

  const [dragId, setDragId] = useState<string | null>(null);
  const [localOrder, setLocalOrder] = useState<SitePlanImage[]>([]);

  // Sync localOrder when remote data changes, unless we are dragging
  useEffect(() => {
    if (!dragId) {
      setLocalOrder(sitePlanImages);
    }
  }, [sitePlanImages, dragId]);

  const handleUpload = async (file: File) => {
    setUploadBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/admin/tenants/${id}/site-plan-images/upload`, {
        method: "POST",
        body: fd,
        credentials: "include",
      });
      if (!res.ok) throw new Error(await res.text());
      queryClient.invalidateQueries({ queryKey: getListSitePlanImagesQueryKey(id) });
      toast({ title: "Naloženo", description: "Slika mape je bila uspešno naložena." });
    } catch {
      toast({ title: "Napaka", description: "Nalaganje slike mape ni uspelo.", variant: "destructive" });
    } finally {
      setUploadBusy(false);
    }
  };

  const handleDragOver = (draggedId: string, overId: string) => {
    if (draggedId === overId) return;
    setLocalOrder(prev => {
      const arr = [...prev];
      const from = arr.findIndex(img => img.id === draggedId);
      const to = arr.findIndex(img => img.id === overId);
      if (from < 0 || to < 0) return prev;
      const [moved] = arr.splice(from, 1);
      arr.splice(to, 0, moved);
      return arr;
    });
  };

  const handleDragEnd = () => {
    if (!dragId) return;
    const currentIds = sitePlanImages.map(img => img.id);
    const nextIds = localOrder.map(img => img.id);
    setDragId(null);
    
    // Only mutate if it actually changed
    if (currentIds.join(",") !== nextIds.join(",")) {
      reorderMutation.mutate({ id, data: { ids: nextIds } }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListSitePlanImagesQueryKey(id) });
          toast({ title: "Shranjeno", description: "Vrstni red posodobljen." });
        },
        onError: () => {
          toast({ title: "Napaka", description: "Premikanje ni uspelo.", variant: "destructive" });
          setLocalOrder(sitePlanImages); // revert
        }
      });
    }
  };

  const moveImage = (index: number, delta: -1 | 1) => {
    const target = index + delta;
    if (target < 0 || target >= localOrder.length) return;
    const next = [...localOrder];
    const [moved] = next.splice(index, 1);
    next.splice(target, 0, moved);
    setLocalOrder(next);
    reorderMutation.mutate(
      { id, data: { ids: next.map((image) => image.id) } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({
            queryKey: getListSitePlanImagesQueryKey(id),
          });
          toast({ title: "Shranjeno", description: "Vrstni red posodobljen." });
        },
        onError: () => {
          setLocalOrder(sitePlanImages);
          toast({
            title: "Napaka",
            description: "Premikanje ni uspelo.",
            variant: "destructive",
          });
        },
      },
    );
  };

  const currentNav = (tenant.livingGuideNav || [
    "home",
    "stay",
    "offer",
    "explore",
    "messages",
  ]) as NavItem[];

  const validFeatures = useMemo(
    () => getLivingGuideAvailableFeatures(tenant.sections || []),
    [tenant.sections],
  );

  const updateNavSlot = (index: number, val: NavItem) => {
    const nextNav = [...currentNav];
    nextNav[index] = val;
    // ensure unique
    for (let i = 1; i < nextNav.length; i++) {
      if (i !== index && nextNav[i] === val) {
        // find unused
        const used = new Set(nextNav);
        const unused = NAV_OPTIONS.find(o => !used.has(o.value) && validFeatures.has(o.value));
        if (unused) nextNav[i] = unused.value;
      }
    }
    saveNav(nextNav);
  };

  const saveNav = (nav: NavItem[]) => {
    updateTenantMutation.mutate({ id, data: { livingGuideNav: nav as any } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetTenantQueryKey(id) });
        toast({ title: "Shranjeno", description: "Navigacija je bila shranjena." });
      },
      onError: (err: any) => {
        toast({ title: "Napaka", description: err?.data?.error || "Shranjevanje ni uspelo.", variant: "destructive" });
      }
    });
  };

  const applyPreset = (preset: "meli_pu" | "camp") => {
    const preferred: NavItem[] = preset === "meli_pu"
      ? ["home", "stay", "offer", "explore", "messages"]
      : ["home", "stay", "explore", "program", "messages"];
    
    // Check if we can fulfill the preset
    const actualValid = preferred.filter(f => validFeatures.has(f));
    if (actualValid.length < 5) {
      // Try to backfill with other valid options
      for (const opt of NAV_OPTIONS) {
        if (!actualValid.includes(opt.value) && validFeatures.has(opt.value)) {
          actualValid.push(opt.value);
        }
      }
    }

    if (actualValid.length < 5) {
      toast({ title: "Ni dovolj funkcij", description: "Namestitev nima dovolj aktivnih razdelkov za zapolnitev 5 gumbov (manjka npr. ponudba ali dogodki).", variant: "destructive" });
      return;
    }

    saveNav(actualValid.slice(0, 5));
  };

  return (
    <div className="space-y-8">
      {/* Site Plan Images */}
      <div>
        <h3 className="text-lg font-medium mb-4">Mape in tlorisi (Site Plan)</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Naložite slike, ki gostom pomagajo pri orientaciji. Gostje lahko mape povečajo z gestami.
        </p>

        <div className="space-y-2">
          {localOrder.map((img, index) => (
            <div 
              key={img.id} 
              className={`flex items-center gap-4 p-2 border rounded-lg bg-card ${dragId === img.id ? 'opacity-50' : ''}`}
              draggable
              onDragStart={() => setDragId(img.id)}
              onDragOver={(e) => { e.preventDefault(); handleDragOver(dragId!, img.id); }}
              onDragEnd={handleDragEnd}
            >
              <div className="flex flex-col gap-0.5">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  aria-label={`Premakni ${img.caption || "zemljevid"} navzgor`}
                  disabled={index === 0 || reorderMutation.isPending}
                  onClick={() => moveImage(index, -1)}
                >
                  <ArrowUp className="w-4 h-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  aria-label={`Premakni ${img.caption || "zemljevid"} navzdol`}
                  disabled={
                    index === localOrder.length - 1 ||
                    reorderMutation.isPending
                  }
                  onClick={() => moveImage(index, 1)}
                >
                  <ArrowDown className="w-4 h-4" />
                </Button>
              </div>
              <div className="cursor-grab p-1 text-muted-foreground" aria-hidden="true"><GripVertical className="w-5 h-5" /></div>
              <img src={img.url} alt="" className="w-16 h-16 object-cover rounded" />
              <div className="flex-1">
                <Input 
                  placeholder="Opis / naslov mape (neobvezno)" 
                  defaultValue={img.caption || ""}
                  onBlur={(e) => {
                    if (e.target.value !== (img.caption || "")) {
                      updateImageMutation.mutate({ id: img.id, data: { caption: e.target.value || null } }, {
                        onSuccess: () => queryClient.invalidateQueries({ queryKey: getListSitePlanImagesQueryKey(id) })
                      });
                    }
                  }}
                />
              </div>
              <Button variant="ghost" size="icon" className="text-destructive" onClick={() => {
                if (confirm("Izbrišem mapo?")) {
                  deleteImageMutation.mutate({ id: img.id }, {
                    onSuccess: () => queryClient.invalidateQueries({ queryKey: getListSitePlanImagesQueryKey(id) })
                  });
                }
              }}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>

        <div className="mt-4">
          <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={uploadBusy}>
            {uploadBusy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
            Dodaj mapo
          </Button>
          <input 
            type="file" 
            ref={fileRef} 
            className="hidden" 
            accept="image/*" 
            onChange={(e) => { if (e.target.files?.[0]) handleUpload(e.target.files[0]); e.target.value = ''; }}
          />
        </div>
      </div>

      {/* Nav Config */}
      <div className="pt-6 border-t">
        <h3 className="text-lg font-medium mb-4">Navigacijska vrstica (5 gumbov)</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Izberite, katerih 5 gumbov naj bo v spodnji vrstici za goste. "Domov" je vedno prvi.
        </p>

        <div className="flex gap-2 mb-6">
          <Button variant="secondary" size="sm" onClick={() => applyPreset("meli_pu")}>Predloga: Meli Pu / Apartma</Button>
          <Button variant="secondary" size="sm" onClick={() => applyPreset("camp")}>Predloga: Kamp</Button>
        </div>

        <div className="space-y-4 max-w-sm">
          {currentNav.map((slot: NavItem, index: number) => (
            <div key={index} className="flex items-center gap-4">
              <span className="w-6 text-sm font-medium text-muted-foreground">{index + 1}.</span>
              {index === 0 ? (
                <Input value="Domov (Home)" disabled className="bg-muted" />
              ) : (
                <Select value={slot} onValueChange={(val) => updateNavSlot(index, val as NavItem)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {NAV_OPTIONS.map(opt => {
                      const isAvail = validFeatures.has(opt.value);
                      return (
                        <SelectItem key={opt.value} value={opt.value} disabled={(!isAvail) || (currentNav.includes(opt.value) && currentNav[index] !== opt.value)}>
                          {opt.label}{!isAvail ? " (Ni na voljo)" : ""}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}