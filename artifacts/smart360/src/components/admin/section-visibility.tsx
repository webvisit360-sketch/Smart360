import { useState } from "react";
import { Switch } from "@/components/ui/switch";

/** Existing section.isVisible field; saving changes only the working draft. */
export function SectionVisibility({ id, visible, save }: {
  id: string; visible: boolean; save: (visible: boolean) => Promise<unknown>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  return <div className="my-3 rounded-lg border bg-white p-3">
    <label htmlFor={`section-visibility-${id}`} className="flex items-center gap-3 text-sm font-semibold">
      <Switch id={`section-visibility-${id}`} checked={visible} disabled={busy}
        onCheckedChange={async value => {
          setBusy(true); setError(""); setSaved(false);
          try { await save(value); setSaved(true); }
          catch { setError("Vidnosti ni bilo mogoče shraniti. Poskusite znova."); }
          finally { setBusy(false); }
        }} />
      {visible ? "Prikaži sekcijo gostom" : "Skrito za goste"}
    </label>
    <p className="mt-1 text-xs text-muted-foreground">Vsebina ostane shranjena in jo lahko urejate. Sprememba za goste velja po naslednji objavi. Za ponovni prikaz vklopite stikalo in objavite.</p>
    {saved && <p role="status" className="mt-1 text-xs">Vidnost je shranjena v osnutku.</p>}
    {error && <p role="alert" className="mt-1 text-sm">{error}</p>}
  </div>;
}
