import type { CSSProperties } from "react";
import { virtualTourEmbedUrl } from "@/lib/virtual-tour";
import { FlagImage } from "./LanguageFlags";
import { simpleCopy } from "./simple-copy";
import { resolveSimplePalette, simplePaletteStyle } from "./simple-palette";

export function hasLandingScreen(tenant: any): boolean {
  return Boolean(virtualTourEmbedUrl(tenant?.tourUrl) || tenant?.livingGuideHeroUrl?.trim() || tenant?.heroUrl?.trim());
}

export function GuideHeaderControls({ tenant, lang, trend = false, onReturn, onLanguage }: {
  tenant: any; lang: string; trend?: boolean; onReturn: () => void; onLanguage: () => void;
}) {
  return <div className={`lgs-home-controls${trend ? " lgs-home-controls--trend" : ""}`} style={simplePaletteStyle(resolveSimplePalette(tenant?.simplePalette, tenant?.simpleBaseColor)) as CSSProperties}>
    {hasLandingScreen(tenant) && <button type="button" className="lgs-home-circle lgs-return360" onClick={onReturn} aria-label={simpleCopy("return360", lang)} data-testid="button-return360">360</button>}
    <button type="button" className="lgs-home-circle lgs-home-language" onClick={onLanguage} aria-label={simpleCopy("language", lang)} data-testid="button-simple-language">
      <FlagImage lang={lang} />
    </button>
  </div>;
}
