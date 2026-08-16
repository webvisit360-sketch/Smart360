import { useRef } from "react";
import { RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { FONT_LABELS, getCoverVars } from "@/pages/guest/cover-vars";
import { imgSrc } from "@/pages/guest/img";

export const PRESET_COLORS = ["#FFFFFF", "#F6F1E9", "#FFE9B8", "#3B78DC", "#14201F", "#C4552E"];

export const THEME_DEFAULTS = {
  mediterran: {
    coverTitleSize: 24,
    coverTitleOpacity: 100,
    coverTextColor: "#14201F",
    coverSubSize: 11,
    coverSubOpacity: 100,
    coverMetaSize: 13.5,
    coverMetaOpacity: 100,
    coverVeil: 0,
    tileVeil: 0,
    textScale: 140,
    coverAlign: "left" as const,
    coverShowRating: true,
    // First-screen tenant logo (logotip-stranke-naslovnica.md §2)
    logoX: 50,
    logoY: 6,
    logoW: 26,
    logoOpacity: 100,
  },
  swipe: {
    coverTitleSize: 56,
    coverTitleOpacity: 66,
    coverTextColor: "#FFFFFF",
    coverSubSize: 22,
    coverSubOpacity: 50,
    coverMetaSize: 19.5,
    coverMetaOpacity: 60,
    coverVeil: 26,
    tileVeil: 0,
    textScale: 140,
    coverAlign: "left" as const,
    coverShowRating: true,
    // Exactly where the Smart360 wordmark used to sit — top left, clear of
    // the round buttons on the right.
    logoX: 15.5,
    logoY: 2.5,
    logoW: 22,
    logoOpacity: 100,
  },
} as const;

export type CoverThemeKey = keyof typeof THEME_DEFAULTS;

/** The subset of tenant-edit form state that the cover editor reads and writes. */
export interface CoverFields {
  name: string;
  subtitle: string;
  heroUrl: string;
  theme: CoverThemeKey;
  coverTitle: string | null;
  coverSubtitle: string | null;
  coverTitleSize: number | null;
  coverTitleOpacity: number | null;
  coverTextColor: string | null;
  coverSubSize: number | null;
  coverSubOpacity: number | null;
  coverMetaSize: number | null;
  coverMetaOpacity: number | null;
  coverVeil: number | null;
  tileVeil: number | null;
  textScale: number | null;
  textFont: string | null;
  textColor: string | null;
  coverAlign: string | null;
  coverShowRating: boolean | null;
  /** Read-only in this editor — shown in the preview so it matches the guest
   *  page instead of a hardcoded sample. */
  rating: string | null;
  reviewsCount: string | null;
  logoUrl: string;
  logoX: number | null;
  logoY: number | null;
  logoW: number | null;
  logoOpacity: number | null;
}

type Patch = Partial<CoverFields>;

/** Slider row: value badge shows the effective value + a "(privzeto)" hint when NULL. */
function SliderRow({
  label,
  min,
  max,
  step,
  value,
  isDefault,
  unit,
  onChange,
}: {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  isDefault: boolean;
  unit: "px" | "%";
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex justify-between">
        <Label className="text-xs text-muted-foreground">{label}</Label>
        <span className="text-xs font-medium">
          {unit === "px" ? `${value}px` : `${value} %`} {isDefault && "(privzeto)"}
        </span>
      </div>
      <Slider min={min} max={max} step={step} value={[value]} onValueChange={(v) => onChange(v[0])} />
    </div>
  );
}

function ColorRow({
  value,
  onChange,
}: {
  value: string;
  onChange: (hex: string) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <Input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-10 h-10 p-1 cursor-pointer"
      />
      <div className="flex items-center gap-2">
        {PRESET_COLORS.map((color) => (
          <button
            key={color}
            type="button"
            className={`w-8 h-8 rounded-full border shadow-sm transition-transform ${
              value.toUpperCase() === color ? "scale-110 ring-2 ring-primary ring-offset-1" : "hover:scale-110"
            }`}
            style={{ backgroundColor: color }}
            onClick={() => onChange(color)}
            title={color}
          />
        ))}
      </div>
    </div>
  );
}

export function CoverEditor({
  form,
  onChange,
  onReset,
}: {
  form: CoverFields;
  onChange: (patch: Patch) => void;
  onReset: () => void;
}) {
  const themeDefaults = THEME_DEFAULTS[form.theme] || THEME_DEFAULTS.mediterran;

  const effTitleSize = form.coverTitleSize ?? themeDefaults.coverTitleSize;
  const effTitleOpacity = form.coverTitleOpacity ?? themeDefaults.coverTitleOpacity;
  const effTextColor = form.coverTextColor ?? themeDefaults.coverTextColor;
  const effSubSize = form.coverSubSize ?? themeDefaults.coverSubSize;
  const effSubOpacity = form.coverSubOpacity ?? themeDefaults.coverSubOpacity;
  const effMetaSize = form.coverMetaSize ?? themeDefaults.coverMetaSize;
  const effMetaOpacity = form.coverMetaOpacity ?? themeDefaults.coverMetaOpacity;
  const effVeil = form.coverVeil ?? themeDefaults.coverVeil;
  const effTileVeil = form.tileVeil ?? themeDefaults.tileVeil;
  const effTextScale = form.textScale ?? themeDefaults.textScale;
  const effAlign = form.coverAlign ?? themeDefaults.coverAlign;
  const effShowRating = form.coverShowRating ?? themeDefaults.coverShowRating;
  const effLogoX = form.logoX ?? themeDefaults.logoX;
  const effLogoY = form.logoY ?? themeDefaults.logoY;
  const effLogoW = form.logoW ?? themeDefaults.logoW;
  const effLogoOp = form.logoOpacity ?? themeDefaults.logoOpacity;

  // Drag state for the preview logo: style is written directly during the
  // move (smooth), the form fields (and sliders) update on pointerup.
  const logoRef = useRef<HTMLImageElement>(null);
  const dragRef = useRef<{ box: DOMRect; offX: number; offY: number; x: number; y: number } | null>(null);
  const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

  const onLogoPointerDown = (e: React.PointerEvent<HTMLImageElement>) => {
    const el = logoRef.current;
    if (!el || !el.parentElement) return;
    const box = el.parentElement.getBoundingClientRect();
    // Remember where inside the logo the user grabbed it (offset from the
    // reference point: X = centre, Y = top), so the logo does not teleport
    // its centre under the pointer on the first move.
    dragRef.current = {
      box,
      offX: e.clientX - (box.left + (effLogoX / 100) * box.width),
      offY: e.clientY - (box.top + (effLogoY / 100) * box.height),
      x: effLogoX,
      y: effLogoY,
    };
    el.setPointerCapture(e.pointerId);
    e.preventDefault();
  };
  const onLogoPointerMove = (e: React.PointerEvent<HTMLImageElement>) => {
    const el = logoRef.current;
    const d = dragRef.current;
    if (!el || !d || !el.hasPointerCapture(e.pointerId)) return;
    d.x = clamp(((e.clientX - d.offX - d.box.left) / d.box.width) * 100, 0, 100);
    d.y = clamp(((e.clientY - d.offY - d.box.top) / d.box.height) * 100, 0, 100);
    el.style.left = `${d.x}%`;
    el.style.top = `${d.y}%`;
  };
  const onLogoPointerUp = (e: React.PointerEvent<HTMLImageElement>) => {
    const el = logoRef.current;
    const d = dragRef.current;
    dragRef.current = null;
    if (!el || !d) return;
    if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
    onChange({ logoX: Math.round(d.x * 10) / 10, logoY: Math.round(d.y * 10) / 10 });
  };

  // Build the CSS variables exactly the way the guest page does, from the
  // *effective* values (so the preview matches theme defaults when NULL).
  const coverVars = getCoverVars({
    coverTextColor: effTextColor,
    coverTitleSize: effTitleSize,
    coverTitleOpacity: effTitleOpacity,
    coverSubSize: effSubSize,
    coverSubOpacity: effSubOpacity,
    coverMetaSize: effMetaSize,
    coverMetaOpacity: effMetaOpacity,
    coverVeil: effVeil,
    coverAlign: effAlign,
  });

  const previewTitle = form.coverTitle || form.name || "Ime namestitve";
  // Guest parity: the guest cover renders NO subtitle element when both
  // sources are empty — the preview must not invent one.
  const previewSubtitle = form.coverSubtitle || form.subtitle || "";
  const heroBg = form.heroUrl ? imgSrc(form.heroUrl, 620) : null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Urejevalnik naslovnice</CardTitle>
        <Button variant="outline" size="sm" onClick={onReset} className="h-8">
          <RefreshCcw className="w-3.5 h-3.5 mr-2" />
          Ponastavi
        </Button>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Controls */}
          <div className="lg:col-span-7 space-y-8">
            <div className="space-y-4">
              <h4 className="font-semibold text-sm border-b pb-2">Besedila (preglasijo splošna)</h4>
              <div className="grid grid-cols-2 gap-4 pt-2">
                <div className="space-y-2">
                  <Label>Naslov</Label>
                  <Input
                    placeholder={form.name || "Ime namestitve"}
                    value={form.coverTitle || ""}
                    onChange={(e) => onChange({ coverTitle: e.target.value || null })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Podnaslov</Label>
                  <Input
                    placeholder={form.subtitle || "Podnaslov nastanitve"}
                    value={form.coverSubtitle || ""}
                    onChange={(e) => onChange({ coverSubtitle: e.target.value || null })}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="font-semibold text-sm border-b pb-2">Pisava in barva</h4>
              <div className="pt-2">
                <Label className="mb-2 block text-xs text-muted-foreground">
                  Barva besedila {form.coverTextColor === null && "(privzeto)"}
                </Label>
                <ColorRow value={effTextColor} onChange={(hex) => onChange({ coverTextColor: hex })} />
              </div>

              <div className="grid grid-cols-2 gap-x-6 gap-y-6 pt-2">
                <SliderRow
                  label="Velikost naslova"
                  min={24}
                  max={84}
                  step={1}
                  unit="px"
                  value={effTitleSize}
                  isDefault={form.coverTitleSize === null}
                  onChange={(v) => onChange({ coverTitleSize: v })}
                />
                <SliderRow
                  label="Prosojnost naslova"
                  min={20}
                  max={100}
                  step={1}
                  unit="%"
                  value={effTitleOpacity}
                  isDefault={form.coverTitleOpacity === null}
                  onChange={(v) => onChange({ coverTitleOpacity: v })}
                />
                <SliderRow
                  label="Velikost podnaslova"
                  min={12}
                  max={40}
                  step={1}
                  unit="px"
                  value={effSubSize}
                  isDefault={form.coverSubSize === null}
                  onChange={(v) => onChange({ coverSubSize: v })}
                />
                <SliderRow
                  label="Prosojnost podnaslova"
                  min={20}
                  max={100}
                  step={1}
                  unit="%"
                  value={effSubOpacity}
                  isDefault={form.coverSubOpacity === null}
                  onChange={(v) => onChange({ coverSubOpacity: v })}
                />
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="font-semibold text-sm border-b pb-2">Metapodatki in ozadje</h4>
              <div className="grid grid-cols-2 gap-x-6 gap-y-6 pt-2">
                <SliderRow
                  label="Velikost metapodatkov"
                  min={12}
                  max={32}
                  step={0.5}
                  unit="px"
                  value={effMetaSize}
                  isDefault={form.coverMetaSize === null}
                  onChange={(v) => onChange({ coverMetaSize: v })}
                />
                <SliderRow
                  label="Prosojnost metapodatkov"
                  min={20}
                  max={100}
                  step={1}
                  unit="%"
                  value={effMetaOpacity}
                  isDefault={form.coverMetaOpacity === null}
                  onChange={(v) => onChange({ coverMetaOpacity: v })}
                />
                <SliderRow
                  label="Zatemnitev naslovnice"
                  min={0}
                  max={60}
                  step={1}
                  unit="%"
                  value={effVeil}
                  isDefault={form.coverVeil === null}
                  onChange={(v) => onChange({ coverVeil: v })}
                />
                <SliderRow
                  label="Zatemnitev ploščic"
                  min={0}
                  max={60}
                  step={1}
                  unit="%"
                  value={effTileVeil}
                  isDefault={form.tileVeil === null}
                  onChange={(v) => onChange({ tileVeil: v })}
                />
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="font-semibold text-sm border-b pb-2">Majhna besedila</h4>
              <p className="text-xs text-muted-foreground">
                Opisi, odpiralni časi, pravila, oznake in napisi na gumbih. Velikih naslovov
                in naslovnice ne zadevajo; gumbi obdržijo obliko, poveča se le napis.
              </p>
              <div className="grid grid-cols-2 gap-x-6 gap-y-6 pt-2">
                <SliderRow
                  label="Velikost besedila"
                  min={80}
                  max={200}
                  step={1}
                  unit="%"
                  value={effTextScale}
                  isDefault={form.textScale === null}
                  onChange={(v) => onChange({ textScale: v })}
                />
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">
                    Pisava {form.textFont === null && "(privzeta)"}
                  </Label>
                  <select
                    className="w-full h-9 rounded-md border bg-background px-3 text-sm"
                    value={form.textFont ?? ""}
                    onChange={(e) => onChange({ textFont: e.target.value || null })}
                  >
                    <option value="">(privzeta)</option>
                    {Object.entries(FONT_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="pt-2">
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-xs text-muted-foreground">
                    Barva besedila {form.textColor === null && "(privzete sivine)"}
                  </Label>
                  {form.textColor !== null && (
                    <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => onChange({ textColor: null })}>
                      Privzeta
                    </Button>
                  )}
                </div>
                <ColorRow value={form.textColor ?? "#14201F"} onChange={(hex) => onChange({ textColor: hex })} />
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="font-semibold text-sm border-b pb-2">Logotip stranke</h4>
              {form.logoUrl ? (
                <>
                  <p className="text-xs text-muted-foreground">
                    Logotip lahko v predogledu tudi primete in povlečete na svoje mesto.
                  </p>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-6 pt-2">
                    <SliderRow
                      label="Velikost"
                      min={8}
                      max={60}
                      step={0.5}
                      unit="%"
                      value={effLogoW}
                      isDefault={form.logoW === null}
                      onChange={(v) => onChange({ logoW: v })}
                    />
                    <SliderRow
                      label="Prosojnost"
                      min={20}
                      max={100}
                      step={1}
                      unit="%"
                      value={effLogoOp}
                      isDefault={form.logoOpacity === null}
                      onChange={(v) => onChange({ logoOpacity: v })}
                    />
                    <SliderRow
                      label="Vodoravno"
                      min={0}
                      max={100}
                      step={0.5}
                      unit="%"
                      value={effLogoX}
                      isDefault={form.logoX === null}
                      onChange={(v) => onChange({ logoX: v })}
                    />
                    <SliderRow
                      label="Navpično"
                      min={0}
                      max={100}
                      step={0.5}
                      unit="%"
                      value={effLogoY}
                      isDefault={form.logoY === null}
                      onChange={(v) => onChange({ logoY: v })}
                    />
                  </div>
                  <div className="flex gap-2 pt-1">
                    <Button variant="outline" size="sm" className="h-8" onClick={() => onChange({ logoX: 50 })}>
                      Na sredino
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8"
                      onClick={() => onChange({ logoX: null, logoY: null, logoW: null, logoOpacity: null })}
                    >
                      Ponastavi logotip
                    </Button>
                  </div>
                </>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Najprej naložite logotip v razdelku »Slike« — nato ga tu postavite na naslovnico.
                </p>
              )}
            </div>

            <div className="space-y-4">
              <h4 className="font-semibold text-sm border-b pb-2">Postavitev</h4>
              <div className="grid grid-cols-2 gap-4 pt-2">
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">
                    Poravnava {form.coverAlign === null && "(privzeto)"}
                  </Label>
                  <div className="flex bg-muted rounded-md p-1 w-max border">
                    <button
                      type="button"
                      className={`px-4 py-1.5 text-sm rounded-sm font-medium transition-colors ${
                        effAlign === "left" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
                      }`}
                      onClick={() => onChange({ coverAlign: "left" })}
                    >
                      Levo
                    </button>
                    <button
                      type="button"
                      className={`px-4 py-1.5 text-sm rounded-sm font-medium transition-colors ${
                        effAlign === "center" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
                      }`}
                      onClick={() => onChange({ coverAlign: "center" })}
                    >
                      Sredina
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">
                    Ocena {form.coverShowRating === null && "(privzeto)"}
                  </Label>
                  <div className="flex bg-muted rounded-md p-1 w-max border">
                    <button
                      type="button"
                      className={`px-4 py-1.5 text-sm rounded-sm font-medium transition-colors ${
                        effShowRating ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
                      }`}
                      onClick={() => onChange({ coverShowRating: true })}
                    >
                      Prikaži
                    </button>
                    <button
                      type="button"
                      className={`px-4 py-1.5 text-sm rounded-sm font-medium transition-colors ${
                        !effShowRating ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
                      }`}
                      onClick={() => onChange({ coverShowRating: false })}
                    >
                      Skrij
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Live preview — phone frame at 390px inner width */}
          <div className="lg:col-span-5">
            <div className="sticky top-24">
              <Label className="mb-3 block text-sm font-semibold">Predogled v živo</Label>
              <div className="mx-auto rounded-[2rem] border-4 border-muted bg-muted shadow-2xl overflow-hidden" style={{ width: 390 }}>
                <div
                  className="relative"
                  style={{
                    ...coverVars,
                    height: 640,
                    backgroundImage: heroBg ? `url(${heroBg})` : "none",
                    backgroundColor: heroBg ? "transparent" : "#1e293b",
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                  }}
                >
                  {/* Uniform veil across the whole photo — no gradient. */}
                  <div className="absolute inset-0 bg-black pointer-events-none" style={{ opacity: effVeil / 100 }} />

                  {/* Tenant logo — draggable (dashed outline signals it). The
                      admin does not load the guest theme CSS, so the .brandlogo
                      rules are mirrored inline here. */}
                  {form.logoUrl && (
                    <img
                      ref={logoRef}
                      src={imgSrc(form.logoUrl, 620)}
                      alt=""
                      draggable={false}
                      onPointerDown={onLogoPointerDown}
                      onPointerMove={onLogoPointerMove}
                      onPointerUp={onLogoPointerUp}
                      onPointerCancel={onLogoPointerUp}
                      style={{
                        position: "absolute",
                        left: `${effLogoX}%`,
                        top: `${effLogoY}%`,
                        width: `${effLogoW}%`,
                        maxWidth: "70%",
                        height: "auto",
                        transform: "translate(-50%,0)",
                        opacity: effLogoOp / 100,
                        zIndex: 6,
                        display: "block",
                        filter: "drop-shadow(0 2px 10px rgba(0,0,0,.34))",
                        cursor: "grab",
                        touchAction: "none",
                        outline: "2px dashed rgba(59,120,220,.9)",
                        outlineOffset: 6,
                        borderRadius: 6,
                      }}
                    />
                  )}

                  <div
                    className="absolute inset-x-0 bottom-0 flex flex-col pointer-events-none"
                    style={{
                      padding: form.theme === "mediterran" ? "1.5rem 1.5rem 2.5rem" : "2rem",
                      backgroundColor: form.theme === "mediterran" ? "#FFFFFF" : "transparent",
                      borderTopLeftRadius: form.theme === "mediterran" ? "1.5rem" : "0",
                      borderTopRightRadius: form.theme === "mediterran" ? "1.5rem" : "0",
                      alignItems: effAlign === "center" ? "center" : "flex-start",
                      textAlign: effAlign === "center" ? "center" : "left",
                    }}
                  >
                    {/* Same DOM order and gaps as the guest cover (.cover__txt):
                        title, subtitle 16px below, rating 19px below — one
                        block, one shared left edge. Rating shows the SAVED
                        tenant values, never a hardcoded sample. */}
                    <h1
                      className="font-bold leading-[1.1] tracking-tight"
                      style={{
                        margin: 0,
                        fontSize: `var(--tt-size, ${effTitleSize}px)`,
                        opacity: effTitleOpacity / 100,
                        color: `var(--tt-txt, ${effTextColor})`,
                        display: "-webkit-box",
                        WebkitLineClamp: 3,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                      }}
                    >
                      {previewTitle}
                    </h1>

                    {previewSubtitle && (
                      <p
                        className="font-medium"
                        style={{
                          margin: "16px 0 0",
                          fontSize: `var(--st-size, ${effSubSize}px)`,
                          opacity: effSubOpacity / 100,
                          color: `var(--tt-txt, ${effTextColor})`,
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                        }}
                      >
                        {previewSubtitle}
                      </p>
                    )}

                    {effShowRating && (
                      <div
                        className="flex items-center gap-1.5 font-semibold"
                        style={{
                          marginTop: 19,
                          fontSize: `var(--mt-size, ${effMetaSize}px)`,
                          opacity: effMetaOpacity / 100,
                          color: `var(--tt-txt, ${effTextColor})`,
                        }}
                      >
                        <span style={{ color: effTextColor.toUpperCase() === "#FFFFFF" ? "#FBBF24" : "currentColor" }}>★</span>{" "}
                        {form.rating || "5,0"} · {form.reviewsCount || "0"} ocen
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
