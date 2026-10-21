import type { CSSProperties } from "react";
import { virtualTourEmbedUrl } from "@/lib/virtual-tour";
import { FlagImage } from "./LanguageFlags";
import { simpleCopy } from "./simple-copy";
import { resolveSimplePalette, simplePaletteStyle } from "./simple-palette";

export function hasLandingScreen(tenant: any): boolean {
  return Boolean(virtualTourEmbedUrl(tenant?.tourUrl) || tenant?.livingGuideHeroUrl?.trim() || tenant?.heroUrl?.trim());
}

export function ReturnArrow() {
  return <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true" focusable="false"><path fill="currentColor" d="M10 3 1 12l9 9v-6h13V9H10Z" /></svg>;
}

/** The one guest back control for both designs (Enostaven palette tile / Trend glass). */
export function GuideBackCircle({ label, onClick, testId, className }: { label: string; onClick: () => void; testId: string; className?: string }) {
  return <button type="button" className={`lg-back-circle${className ? ` ${className}` : ""}`} aria-label={label} title={label} onClick={onClick} data-testid={testId}><ReturnArrow /></button>;
}

export function WalkResetControl({ lang, trend = false, onReset }: { lang: string; trend?: boolean; onReset: () => void }) {
  const labels: Record<string, string> = {
    sl: "Vrni virtualni sprehod na začetek", en: "Restart the virtual walk",
    de: "Virtuellen Rundgang neu starten", it: "Riavvia il tour virtuale",
    fr: "Recommencer la visite virtuelle", nl: "Virtuele rondleiding opnieuw starten",
    hr: "Vrati virtualnu šetnju na početak",
  };
  return <div className={`lgs-walk-reset${trend ? " lgs-home-controls--trend" : ""}`}>
    <button type="button" className="lgs-home-circle lgs-return360" aria-label={labels[lang] ?? labels.sl} title={labels[lang] ?? labels.sl} onClick={onReset} data-testid="button-walk-reset"><ReturnArrow /></button>
  </div>;
}

export function GuideHeaderControls({ tenant, lang, trend = false, onReturn, onLanguage }: {
  tenant: any; lang: string; trend?: boolean; onReturn: () => void; onLanguage: () => void;
}) {
  return <div className={`lgs-home-controls${trend ? " lgs-home-controls--trend" : ""}`} style={simplePaletteStyle(resolveSimplePalette(tenant?.simplePalette, tenant?.simpleBaseColor)) as CSSProperties}>
    {hasLandingScreen(tenant) && <button type="button" className="lgs-home-circle lgs-return360" onClick={onReturn} aria-label={simpleCopy("return360", lang)} data-testid="button-return360"><ReturnArrow /></button>}
    <button type="button" className="lgs-home-circle lgs-home-language" onClick={onLanguage} aria-label={simpleCopy("language", lang)} data-testid="button-simple-language">
      <FlagImage lang={lang} />
    </button>
  </div>;
}
