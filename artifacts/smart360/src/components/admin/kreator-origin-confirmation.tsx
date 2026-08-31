import { useState } from "react";
import { useConfirmCreatorTenantOrigin, usePreviewCreatorOrigin } from "@workspace/api-client-react";
import { AdminCard as Card, AdminCardContent as CardContent } from "@/components/ui/card";
import { AdminButton as Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, MapPin, CheckCircle2, AlertTriangle, Search } from "lucide-react";
import { cn } from "@/lib/utils";

function OsmTileMap({ lat, lng }: { lat: number; lng: number }) {
  const zoom = 18;
  const tileSize = 256;
  const scale = 2 ** zoom;
  const latitudeRadians = (lat * Math.PI) / 180;
  const worldX = ((lng + 180) / 360) * scale;
  const worldY =
    ((1 -
      Math.log(
        Math.tan(latitudeRadians) + 1 / Math.cos(latitudeRadians),
      ) /
        Math.PI) /
      2) *
    scale;
  const firstX = Math.floor(worldX) - 1;
  const firstY = Math.floor(worldY) - 1;
  const offsetX = (worldX - firstX) * tileSize;
  const offsetY = (worldY - firstY) * tileSize;

  return (
    <div className="absolute inset-0 overflow-hidden bg-[#d9ddd5]" aria-label="Zemljevid potrjene točke">
      <div
        className="absolute grid grid-cols-3 grid-rows-3"
        style={{
          width: tileSize * 3,
          height: tileSize * 3,
          left: `calc(50% - ${offsetX}px)`,
          top: `calc(50% - ${offsetY}px)`,
        }}
      >
        {Array.from({ length: 9 }, (_, index) => {
          const x = firstX + (index % 3);
          const y = firstY + Math.floor(index / 3);
          return (
            <img
              key={`${x}-${y}`}
              src={`https://tile.openstreetmap.org/${zoom}/${x}/${y}.png`}
              alt=""
              width={tileSize}
              height={tileSize}
              className="block h-64 w-64 max-w-none"
              loading="eager"
            />
          );
        })}
      </div>
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-full drop-shadow-md">
        <MapPin className="h-10 w-10 fill-[#157347] text-white" strokeWidth={1.7} />
      </div>
      <a
        href="https://www.openstreetmap.org/copyright"
        target="_blank"
        rel="noreferrer"
        className="absolute bottom-1 right-1 rounded bg-white/90 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600"
      >
        © OpenStreetMap
      </a>
    </div>
  );
}

export function KreatorOriginConfirmation({
  tenant,
  onConfirmed,
}: {
  tenant: {
    id: string;
    name: string;
    address?: string | null;
    mapUrl?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    creatorOriginRegion?: string | null;
    municipality?: string | null;
  };
  onConfirmed?: () => void;
}) {
  const [mapUrl, setMapUrl] = useState("");
  const [tenantAddress, setTenantAddress] = useState(tenant.address ?? "");
  const [municipality, setMunicipality] = useState(tenant.municipality ?? "");
  const [replaceExistingOrigin, setReplaceExistingOrigin] = useState(false);

  const previewMutation = usePreviewCreatorOrigin({
    mutation: {
      onSuccess: () => setReplaceExistingOrigin(false),
    }
  });
  const confirmMutation = useConfirmCreatorTenantOrigin({
    mutation: {
      onSuccess: () => onConfirmed?.(),
    },
  });

  const handlePreview = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!mapUrl.trim()) return;
    previewMutation.mutate({ data: { mapUrl: mapUrl.trim() } });
  };

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMapUrl(e.target.value);
  };

  const handleAddressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTenantAddress(e.target.value);
  };

  const handleConfirm = () => {
    if (!tenantAddress.trim()) return;
    confirmMutation.mutate({
      id: tenant.id,
      data: {
        mapUrl: mapUrl.trim(),
        address: tenantAddress.trim(),
        municipality: municipality.trim(),
        replaceExistingOrigin,
      },
    });
  };

  const hasResult = previewMutation.isSuccess && previewMutation.data;
  const isPending = previewMutation.isPending;
  const hasStoredOrigin = Boolean(
    tenant.mapUrl
    || tenant.latitude != null
    || tenant.longitude != null
    || tenant.creatorOriginRegion,
  );

  return (
    <div className="max-w-[880px] w-full flex flex-col gap-6 font-sans py-2">
      <div className="flex flex-col gap-2">
        <h2 data-testid="kreator-step-1-heading" className="text-[22px] font-[800] tracking-tight text-foreground">
          Korak 1: Potrditev izhodišča
        </h2>
        <p className="text-muted-foreground text-[15px] font-[500] max-w-[600px] leading-relaxed">
          Sistem bo iz povezave pridobil koordinate. Naslov vnesete vi; Nominatimova bližnja znana točka je samo preverjanje položaja pina.
        </p>
      </div>

      <Card>
        <CardContent className="p-6 flex flex-col gap-5">
          <div className="flex flex-col gap-3">
            <Label htmlFor="creatorMunicipality" className="text-[12.5px] uppercase tracking-widest font-[800] text-muted-foreground">
              Občina
            </Label>
            <Input
              id="creatorMunicipality"
              data-testid="creator-municipality-input"
              value={municipality}
              onChange={(event) => setMunicipality(event.target.value)}
              placeholder="Npr. Ljubno ob Savinji"
              className="bg-white font-[600]"
              autoComplete="address-level2"
            />
            <p className="text-[12px] text-muted-foreground">
              Vnesite ročno. Kreator občine ne določa iz naslova ali zemljevida.
            </p>
          </div>
          <form onSubmit={handlePreview} className="flex flex-col gap-3">
            <Label htmlFor="mapUrl" className="text-[12.5px] uppercase tracking-widest font-[800] text-muted-foreground">
              Povezava z zemljevida (Google Maps)
            </Label>
            <div className="flex gap-3">
              <Input
                id="mapUrl"
                value={mapUrl}
                onChange={handleUrlChange}
                placeholder="https://maps.app.goo.gl/..."
                className="flex-1 bg-white font-mono text-[14px]"
                autoComplete="off"
              />
              <Button 
                type="submit" 
                disabled={isPending || !mapUrl.trim()} 
                className="shrink-0 min-w-[130px] rounded-[13px]"
              >
                {isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Search className="w-4 h-4 mr-2" />
                )}
                Analiziraj
              </Button>
            </div>
          </form>

          {previewMutation.isError && (
            <div className="bg-destructive/5 border-[1.5px] border-destructive/20 p-4 rounded-[14px] flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
              <div className="flex flex-col gap-1">
                <span className="font-[800] text-destructive text-[14px]">Napaka pri analizi povezave</span>
                <span className="text-[14px] text-destructive/90 font-[500]">
                  {(previewMutation.error as any)?.data?.error || (previewMutation.error as any)?.message || "Preverite, ali je povezava veljavna in poskusite znova."}
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {hasResult && (
        <Card className={cn(
          "transition-colors overflow-hidden",
          confirmMutation.isSuccess ? "ring-2 ring-primary bg-primary/[0.02]" : ""
        )}>
          <div className="grid grid-cols-1 md:grid-cols-2">
            <div className="p-6 flex flex-col gap-6 border-b md:border-b-0 md:border-r border-border">
              <div className="rounded-[14px] border border-border bg-muted/40 p-4">
                <p className="text-[12.5px] uppercase tracking-widest font-[800] text-muted-foreground">Odprta nastanitev</p>
                <p className="mt-1 text-[16px] font-[800] text-foreground">{tenant.name}</p>
                <p className="mt-1 font-mono text-[11px] text-muted-foreground">{tenant.id}</p>
              </div>

              <div className="flex flex-col gap-3">
                <Label htmlFor="tenantAddress" className="text-[12.5px] uppercase tracking-widest font-[800] text-muted-foreground flex items-center justify-between">
                  <span>Naslov namestitve</span>
                  <span className="text-[11px] bg-muted px-2 py-0.5 rounded-md text-muted-foreground normal-case tracking-normal">Vnesite ročno · zahtevano</span>
                </Label>
                <Input
                  id="tenantAddress"
                  value={tenantAddress}
                  onChange={handleAddressChange}
                  placeholder="Npr. Varpolje 105, 3332 Rečica ob Savinji"
                  className="bg-white font-[600]"
                  autoComplete="street-address"
                />
              </div>

              <div className="flex flex-col gap-5">
                {hasStoredOrigin && (
                  <div className="rounded-[14px] border border-amber-300 bg-amber-50 p-4 text-amber-950">
                    <p className="text-[14px] font-[800]">Shranjeno izhodišče že obstaja</p>
                    <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[12px]">
                      <dt className="font-[700]">Koordinate</dt>
                      <dd className="font-mono">{tenant.latitude ?? "—"}, {tenant.longitude ?? "—"}</dd>
                      <dt className="font-[700]">Regija</dt>
                      <dd>{tenant.creatorOriginRegion ?? "—"}</dd>
                      <dt className="font-[700]">Povezava</dt>
                      <dd className="break-all">{tenant.mapUrl ?? "—"}</dd>
                    </dl>
                    <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-[10px] border border-amber-400 bg-white p-3">
                      <input
                        type="checkbox"
                        checked={replaceExistingOrigin}
                        onChange={(event) => setReplaceExistingOrigin(event.target.checked)}
                        className="mt-0.5 h-4 w-4"
                      />
                      <span className="text-[13px] font-[700]">Izrecno potrjujem zamenjavo shranjenega izhodišča z novo razrešeno točko.</span>
                    </label>
                  </div>
                )}

                <div className="flex flex-col gap-2">
                  <span className="text-[12.5px] uppercase tracking-widest font-[800] text-muted-foreground">
                    Najbližja znana točka (Nominatim)
                  </span>
                  {previewMutation.data.originVerificationStatus === "verified" ? (
                    <p className="text-[15px] font-[600] leading-snug">
                      {previewMutation.data.nominatimDisplayName}
                    </p>
                  ) : (
                    <div className="rounded-[12px] border border-amber-300 bg-amber-50 p-3 text-amber-950">
                      <p className="text-[14px] font-[800]">Položaj pina ni preverjen</p>
                      <p className="mt-1 text-[12px] font-[600]">
                        {previewMutation.data.originVerificationReason || "Nominatim trenutno ni dosegljiv."}
                      </p>
                      <p className="mt-1 text-[12px]">
                        Izhodišče lahko vseeno potrdite; vneseni naslov ostane nespremenjen.
                      </p>
                    </div>
                  )}
                  <p className="text-[12px] leading-relaxed text-muted-foreground">
                    To je samo preverjanje položaja pina, ne naslov namestitve.
                  </p>
                </div>

                <div className="flex flex-col gap-2 pt-4 border-t border-border/60">
                  <span className="text-[12.5px] uppercase tracking-widest font-[800] text-muted-foreground">
                    Izhodiščne koordinate
                  </span>
                  <p className="text-[14px] font-mono font-[600] text-foreground">
                    {previewMutation.data.lat}, {previewMutation.data.lng}
                  </p>
                  <p className="text-[12px] text-muted-foreground">
                    Vir povezave: {previewMutation.data.source === "place" ? "Google Maps kraj" : "Google Maps iskanje"}
                    {previewMutation.data.placeId ? ` · ID ${previewMutation.data.placeId}` : ""}
                  </p>
                </div>
              </div>

              <div className="mt-auto pt-6 flex items-center justify-between">
                {confirmMutation.isSuccess ? (
                  <div className="flex items-center gap-2 text-[#116B41] font-[800] text-[15px] bg-[#E4F2EA] px-4 py-2.5 rounded-[12px] w-full justify-center">
                    <CheckCircle2 className="w-5 h-5" />
                    Izhodišče je potrjeno
                  </div>
                ) : (
                  <Button 
                    onClick={handleConfirm}
                    disabled={!tenantAddress.trim() || !municipality.trim() || confirmMutation.isPending || (hasStoredOrigin && !replaceExistingOrigin)}
                    className="w-full text-[15px] h-[46px] rounded-[13px]"
                  >
                    {confirmMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Potrdi izhodišče
                  </Button>
                )}
              </div>
              {confirmMutation.isError && (
                <div className="rounded-[12px] border border-destructive/20 bg-destructive/5 p-3 text-sm font-semibold text-destructive">
                  {(confirmMutation.error as any)?.data?.error || "Izhodišča ni bilo mogoče potrditi."}
                </div>
              )}
            </div>

            <div className="bg-[#ECF0EA] relative min-h-[340px] flex flex-col border-l border-transparent">
              <OsmTileMap lat={previewMutation.data.lat} lng={previewMutation.data.lng} />
              <div className="absolute top-4 right-4 bg-white/95 backdrop-blur-sm border-[1.5px] border-border shadow-sm px-3 py-1.5 rounded-[10px] text-[12px] font-[800] flex items-center gap-1.5 pointer-events-none">
                <MapPin className="w-3.5 h-3.5 text-primary" />
                Zaznana lokacija
              </div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
