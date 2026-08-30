import { useState } from "react";
import { usePreviewCreatorOrigin } from "@workspace/api-client-react";
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

export function KreatorOriginConfirmation() {
  const [mapUrl, setMapUrl] = useState("");
  const [name, setName] = useState("");
  const [isConfirmed, setIsConfirmed] = useState(false);

  const previewMutation = usePreviewCreatorOrigin({
    mutation: {
      onSuccess: (data) => {
        setName(data.name || "");
        setIsConfirmed(false);
      },
      onError: () => {
        setIsConfirmed(false);
      }
    }
  });

  const handlePreview = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!mapUrl.trim()) return;
    setIsConfirmed(false);
    previewMutation.mutate({ data: { mapUrl: mapUrl.trim() } });
  };

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMapUrl(e.target.value);
    setIsConfirmed(false);
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setName(e.target.value);
    setIsConfirmed(false);
  };

  const handleConfirm = () => {
    if (!name.trim()) return;
    setIsConfirmed(true);
  };

  const hasResult = previewMutation.isSuccess && previewMutation.data;
  const isPending = previewMutation.isPending;

  return (
    <div className="max-w-[880px] w-full flex flex-col gap-6 font-sans py-2">
      <div className="flex flex-col gap-2">
        <h2 data-testid="kreator-step-1-heading" className="text-[22px] font-[800] tracking-tight text-foreground">
          Korak 1: Potrditev izhodišča
        </h2>
        <p className="text-muted-foreground text-[15px] font-[500] max-w-[600px] leading-relaxed">
          Sistem bo analiziral URL povezavo in pridobil natančne koordinate ter naslov. Preglejte in potrdite podatke, preden nadaljujemo z avtomatizirano pripravo vodnika.
        </p>
      </div>

      <Card>
        <CardContent className="p-6 flex flex-col gap-5">
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
          isConfirmed ? "ring-2 ring-primary bg-primary/[0.02]" : ""
        )}>
          <div className="grid grid-cols-1 md:grid-cols-2">
            <div className="p-6 flex flex-col gap-6 border-b md:border-b-0 md:border-r border-border">
              <div className="flex flex-col gap-3">
                <Label htmlFor="parsedName" className="text-[12.5px] uppercase tracking-widest font-[800] text-muted-foreground flex items-center justify-between">
                  <span>Ime namestitve</span>
                  <span className="text-[11px] bg-muted px-2 py-0.5 rounded-md text-muted-foreground normal-case tracking-normal">Zahtevano</span>
                </Label>
                <Input
                  id="parsedName"
                  value={name}
                  onChange={handleNameChange}
                  placeholder="Vnesite ime..."
                  className="bg-white font-[600]"
                />
              </div>

              <div className="flex flex-col gap-5">
                <div className="flex flex-col gap-2">
                  <span className="text-[12.5px] uppercase tracking-widest font-[800] text-muted-foreground flex items-center gap-2">
                    Naslov 
                    <span className="text-[10px] bg-[#E4F2EA] text-[#116B41] normal-case tracking-normal px-1.5 py-0.5 rounded flex items-center">
                      Nominatim
                    </span>
                  </span>
                  <p className="text-[15px] font-[600] leading-snug">
                    {previewMutation.data.address}
                  </p>
                </div>

                <div className="flex flex-col gap-2 pt-4 border-t border-border/60">
                  <span className="text-[12.5px] uppercase tracking-widest font-[800] text-muted-foreground">
                    Izhodiščne koordinate
                  </span>
                  <p className="text-[14px] font-mono font-[600] text-foreground">
                    {previewMutation.data.lat.toFixed(6)}, {previewMutation.data.lng.toFixed(6)}
                  </p>
                  <p className="text-[12px] text-muted-foreground">
                    Vir povezave: {previewMutation.data.source === "place" ? "Google Maps kraj" : "Google Maps iskanje"}
                    {previewMutation.data.placeId ? ` · ID ${previewMutation.data.placeId}` : ""}
                  </p>
                </div>
              </div>

              <div className="mt-auto pt-6 flex items-center justify-between">
                {isConfirmed ? (
                  <div className="flex items-center gap-2 text-[#116B41] font-[800] text-[15px] bg-[#E4F2EA] px-4 py-2.5 rounded-[12px] w-full justify-center">
                    <CheckCircle2 className="w-5 h-5" />
                    Potrjeno v tem koraku · še ni shranjeno
                  </div>
                ) : (
                  <Button 
                    onClick={handleConfirm}
                    disabled={!name.trim()}
                    className="w-full text-[15px] h-[46px] rounded-[13px]"
                  >
                    Potrdi izhodišče
                  </Button>
                )}
              </div>
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
