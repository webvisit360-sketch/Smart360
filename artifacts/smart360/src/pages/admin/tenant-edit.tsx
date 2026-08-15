import { useGetTenant, useUpdateTenant, getGetTenantQueryKey, getListTenantsQueryKey } from "@workspace/api-client-react";
import { useRoute, useLocation } from "wouter";
import { Loader2, ArrowLeft, ExternalLink, Save, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

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
    subtitle: "",
    theme: "mediterran",
    isPublished: false,
    phone: "",
    whatsapp: "",
    viber: "",
    instagram: "",
    mapQuery: "",
    tourUrl: "",
    heroUrl: "",
  });

  const initRef = useRef<string | null>(null);

  useEffect(() => {
    if (tenant && initRef.current !== tenant.id) {
      initRef.current = tenant.id;
      setFormData({
        name: tenant.name || "",
        slug: tenant.slug || "",
        subtitle: tenant.subtitle || "",
        theme: tenant.theme || "mediterran",
        isPublished: tenant.isPublished || false,
        phone: tenant.phone || "",
        whatsapp: tenant.whatsapp || "",
        viber: tenant.viber || "",
        instagram: tenant.instagram || "",
        mapQuery: tenant.mapQuery || "",
        tourUrl: tenant.tourUrl || "",
        heroUrl: tenant.heroUrl || "",
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
    updateMutation.mutate({ id, data: formData });
  };

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/admin")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{tenant.name}</h1>
          <p className="text-sm text-muted-foreground">Urejanje namestitve</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" onClick={() => window.open(`/g/${tenant.slug}?preview=1`, '_blank')}>
            <ExternalLink className="w-4 h-4 mr-2" /> Poglej
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
                                <div key={item.id} className="bg-background border rounded p-2 text-sm flex items-center justify-between">
                                  <span>{item.title || '(Brez naslova)'}</span>
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
