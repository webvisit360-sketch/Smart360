// Real SVG flags. Shared by the Trend and Enostaven
// landing (authorized change) and the Enostaven header flag button.
import flagSi from "@/assets/flags/si.svg";
import flagGb from "@/assets/flags/gb.svg";
import flagDe from "@/assets/flags/de.svg";
import flagIt from "@/assets/flags/it.svg";
import flagFr from "@/assets/flags/fr.svg";
import flagNl from "@/assets/flags/nl.svg";
import flagHr from "@/assets/flags/hr.svg";
import { GUIDE_LANGUAGES } from "@workspace/guide-languages";
import { simpleCopy } from "./simple-copy";
import "./living-guide-simple.css";

// Official-geometry national flags from lipis/flag-icons (MIT), 4x3 set,
// bundled as static assets (offline-safe, cached by the service worker).
const FLAG_URLS: Record<string, string> = {
  sl: flagSi, en: flagGb, de: flagDe, it: flagIt, fr: flagFr, nl: flagNl, hr: flagHr,
};

export function flagUrl(lang: string): string {
  return FLAG_URLS[lang] ?? FLAG_URLS.sl;
}

export function FlagImage({ lang }: { lang: string }) {
  return <img className="lgs-flag-img" src={flagUrl(lang)} alt="" aria-hidden="true" draggable={false} decoding="async" />;
}

/** Vertical landing column: Slovenian at the bottom, selected larger, JEZIK beneath. */
export function LandingFlagColumn({ lang, onSelect }: { lang: string; onSelect: (lang: string) => void }) {
  return (
    <div className="lgs-flags" data-testid="landing-flags">
      <div className="lgs-flags-col">
        {GUIDE_LANGUAGES.map((code) => (
          <button
            key={code}
            type="button"
            className={`lgs-flag${code === lang ? " sel" : ""}`}
            aria-pressed={code === lang}
            aria-label={code.toUpperCase()}
            onClick={() => onSelect(code)}
            data-testid={`button-flag-${code}`}
          >
            <FlagImage lang={code} />
          </button>
        ))}
      </div>
      <div className="lgs-flags-lbl">{simpleCopy("language", lang)}</div>
    </div>
  );
}
