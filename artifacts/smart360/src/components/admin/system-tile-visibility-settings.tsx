import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  SYSTEM_TILE_KEYS, normalizeSystemTileVisibility, type SystemTileKey,
} from "@/pages/living-guide/system-tile-visibility";

const LABELS: Record<SystemTileKey, { title: string; hint: string }> = {
  notices: { title: "Obvestila", hint: "Ploščica in zvonec z obvestili gostitelja." },
  weather: { title: "Vreme", hint: "Vremenska napoved za lokacijo namestitve." },
  sos: { title: "Pomoč in SOS", hint: "Dostop do nujnih številk in pošiljanja lokacije v sili." },
  contact: { title: "Kontakt", hint: "Telefon, WhatsApp, Viber, e-pošta gostitelja." },
  install: { title: "Namesti aplikacijo", hint: "Dodaj na začetni zaslon. V nameščeni aplikaciji je vedno skrito." },
  about: { title: "O vodniku", hint: "Zasebnost in viri podatkov." },
};

export function SystemTileVisibilitySettings({ value, onChange, disabled = false }: {
  value: unknown;
  onChange: (next: Record<SystemTileKey, boolean>) => void;
  disabled?: boolean;
}) {
  const current = normalizeSystemTileVisibility(value);
  const [confirmSosOff, setConfirmSosOff] = useState(false);
  const set = (key: SystemTileKey, checked: boolean) => {
    if (key === "sos" && !checked) { setConfirmSosOff(true); return; }
    onChange({ ...current, [key]: checked });
  };
  return (
    <div className="col-span-2 rounded-xl border p-4 space-y-3" data-testid="settings-system-tiles">
      <div>
        <Label>SISTEMSKE PLOŠČICE</Label>
        <p className="text-xs text-muted-foreground">Velja za obe temi (Enostaven in Trend), vključno z menijem in domačimi karticami. Vidno po objavi sprememb.</p>
      </div>
      {SYSTEM_TILE_KEYS.map((key) => (
        <div key={key} className="flex items-center justify-between gap-4">
          <div>
            <Label htmlFor={`system-tile-${key}`}>{LABELS[key].title}</Label>
            <p className="text-xs text-muted-foreground">{LABELS[key].hint}</p>
          </div>
          <Switch id={`system-tile-${key}`} data-testid={`switch-system-tile-${key}`} checked={current[key]}
            disabled={disabled} onCheckedChange={(checked) => set(key, checked)} />
        </div>
      ))}
      <AlertDialog open={confirmSosOff} onOpenChange={setConfirmSosOff}>
        <AlertDialogContent data-testid="dialog-confirm-sos-hide">
          <AlertDialogHeader>
            <AlertDialogTitle>Skrijem SOS?</AlertDialogTitle>
            <AlertDialogDescription>
              Gostje ne bodo več videli ploščice Pomoč in SOS niti povezave do nujnih številk in pošiljanja lokacije v sili v meniju ali na domači strani. Res želite skriti ta varnostni dostop?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-sos-hide">Prekliči</AlertDialogCancel>
            <AlertDialogAction data-testid="button-confirm-sos-hide"
              onClick={() => { setConfirmSosOff(false); onChange({ ...current, sos: false }); }}>
              Skrij SOS
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
