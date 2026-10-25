import { useState } from "react";
import { SystemTileVisibilitySettings } from "./system-tile-visibility-settings";
import { normalizeSystemTileVisibility } from "@/pages/living-guide/system-tile-visibility";

/** DEV-only isolated real settings component. No credentials or database writes. */
export default function SystemTileVisibilityFixture() {
  const [value, setValue] = useState(normalizeSystemTileVisibility(null));
  return <main className="p-6 max-w-xl mx-auto bg-white text-slate-900">
    <h1 className="text-xl font-bold mb-4">Sistemske ploščice — razvojni preizkus</h1>
    <SystemTileVisibilitySettings value={value} onChange={setValue} />
    <output data-testid="visibility-value">{JSON.stringify(value)}</output>
  </main>;
}
