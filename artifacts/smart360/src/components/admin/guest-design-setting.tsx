import type { ReactNode } from "react";
import { AdminCard as Card, AdminCardContent as CardContent, AdminCardHeader as CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  BORDO, MODRA, deriveSimplePalette, isHexColor,
  type GuestDesign, type SimplePaletteKey, type SimplePaletteTokens,
} from "@/pages/living-guide/simple/simple-palette";

export type GuestDesignValue = {
  guestDesign: GuestDesign | null;
  simplePalette: SimplePaletteKey | null;
  simpleBaseColor: string | null;
  simpleDynamicBackground?: boolean;
};

function Swatch({ tokens }: { tokens: SimplePaletteTokens }) {
  return (
    <span className="inline-flex items-center justify-center rounded-lg p-1.5" style={{ background: tokens.bg }}>
      <span
        className="block h-7 w-7"
        style={{
          borderRadius: "19%",
          border: `2px solid ${tokens.stroke}`,
          boxShadow: `inset 0 0 0 1px ${tokens.bg}`,
          background: `linear-gradient(180deg, ${tokens.tile1} 0%, ${tokens.tile15} 52%, ${tokens.tile2} 100%)`,
          backgroundClip: "padding-box",
        }}
      />
    </span>
  );
}

function Choice({ active, onClick, children, testId }: { active: boolean; onClick: () => void; children: ReactNode; testId: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      data-testid={testId}
      className={`flex items-center gap-3 rounded-[13px] border-[1.5px] px-3 py-2.5 text-left text-sm font-bold transition-colors ${
        active ? "border-[var(--acc)] bg-white text-[var(--acc)]" : "border-[var(--line)] bg-white text-[var(--tx)]"
      }`}
    >
      {children}
    </button>
  );
}

/** "Dizajn" appearance setting. Rendered only where canEditAppearance is true. */
export function GuestDesignSetting({ value, onChange }: { value: GuestDesignValue; onChange: (next: GuestDesignValue) => void }) {
  const design: GuestDesign = value.guestDesign === "simple" ? "simple" : "trend";
  const palette: SimplePaletteKey = value.simplePalette ?? "bordo";
  const base = isHexColor(value.simpleBaseColor) ? value.simpleBaseColor.toUpperCase() : BORDO.tile1;
  const set = (patch: Partial<GuestDesignValue>) => onChange({ ...value, ...patch });

  return (
    <Card data-testid="card-guest-design">
      <CardHeader>
        <CardTitle>Dizajn</CardTitle>
        <p className="text-sm text-[var(--tx2)]">Trend je obstoječi videz. Enostaven je ena stran z velikimi ploščicami za manj vešče goste.</p>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid grid-cols-2 gap-3">
          <Choice active={design === "trend"} onClick={() => set({ guestDesign: "trend" })} testId="button-design-trend">Trend <span className="font-semibold text-[var(--tx2)]">(privzeto)</span></Choice>
          <Choice active={design === "simple"} onClick={() => set({ guestDesign: "simple" })} testId="button-design-simple">Enostaven</Choice>
        </div>
        {design === "simple" && (
          <div className="space-y-3">
            <Label>Barva</Label>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Choice active={!value.simpleDynamicBackground && palette === "bordo"} onClick={() => set({ simplePalette: "bordo", simpleDynamicBackground: false })} testId="button-palette-bordo"><Swatch tokens={BORDO} />Bordo</Choice>
              <Choice active={!value.simpleDynamicBackground && palette === "modra"} onClick={() => set({ simplePalette: "modra", simpleDynamicBackground: false })} testId="button-palette-modra"><Swatch tokens={MODRA} />Modra</Choice>
              <Choice
                active={!value.simpleDynamicBackground && palette === "custom"}
                onClick={() => set({ simplePalette: "custom", simpleBaseColor: value.simpleBaseColor ?? base, simpleDynamicBackground: false })}
                testId="button-palette-custom"
              ><Swatch tokens={deriveSimplePalette(base)} />Poljubna</Choice>
              <Choice active={!!value.simpleDynamicBackground} onClick={() => set({ simpleDynamicBackground: true })} testId="button-palette-dynamic">Dinamično</Choice>
            </div>
            {value.simpleDynamicBackground && <p className="text-xs text-[var(--tx2)]">Ozadje sledi vremenskemu delu dneva. Ploščice ohranijo izbrano paleto ({palette === "custom" ? base : palette}). Brez veljavnih vremenskih podatkov ostane običajno ozadje.</p>}
            {palette === "custom" && (
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={base.toLowerCase()}
                  onChange={(e) => set({ simpleBaseColor: e.target.value.toUpperCase() })}
                  className="h-11 w-14 cursor-pointer rounded-lg border border-[var(--line)] bg-white"
                  aria-label="Osnovna barva"
                  data-testid="input-simple-color"
                />
                <Input
                  className="w-32 font-mono"
                  defaultValue={base}
                  key={base}
                  onBlur={(e) => { const v = e.target.value.trim(); if (isHexColor(v)) set({ simpleBaseColor: v.toUpperCase() }); }}
                  data-testid="input-simple-color-hex"
                />
                <span className="text-xs text-[var(--tx2)]">Odtenki se izračunajo samodejno.</span>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
