import type { ReactNode } from "react";
import { simpleCopy } from "./simple-copy";
import { SimpleIcon } from "./simple-icons";
import { simpleHeroUrl, simpleLabelSize, type SimpleSection, type SimpleTile } from "./simple-tiles";
import { FlagImage, LandingFlagColumn } from "./LanguageFlags";
import { WeatherCard, useLivingGuideWeather } from "../living-guide-weather";
import "./living-guide-simple.css";


export function SimpleCoverView({
  tenant, lang, openLabel, onOpen, onLanguage,
}: { tenant: any; lang: string; openLabel: string; onOpen: () => void; onLanguage: (lang: string) => void }) {
  const title = tenant.coverTitle || tenant.name;
  const focus = `${tenant.heroFocusX ?? 50}% ${tenant.heroFocusY ?? 50}%`;
  const hero = simpleHeroUrl(tenant);
  return (
    <section className="lgs-cover" aria-label={title} data-testid="screen-simple-cover">
      <div className="lgs-hero">
        {hero && <img src={hero} alt="" fetchPriority="high" decoding="async" style={{ objectPosition: focus }} />}
        <div className="lgs-shade" aria-hidden="true" />
        <LandingFlagColumn lang={lang} onSelect={onLanguage} />
      </div>
      <div className="lgs-land">
        <div className="lgs-small">{simpleCopy("guide", lang).toUpperCase()}</div>
        {title && <h1>{title}</h1>}
        {tenant.address && <div className="lgs-adr">{tenant.address}</div>}
        <button type="button" className="lgs-open" onClick={onOpen} data-testid="button-open-guide">
          {openLabel}
        </button>
      </div>
    </section>
  );
}

function TileBody({ tile }: { tile: SimpleTile }) {
  return (
    <>
      <SimpleIcon icon={tile.icon} />
      <b style={{ fontSize: `${simpleLabelSize(tile.label)}px` }}>{tile.label}</b>
    </>
  );
}

export function SimpleHomeView({
  tenant, lang, sections, onTile, onLanguage,
}: {
  tenant: any; lang: string; sections: SimpleSection[];
  onTile: (tile: SimpleTile) => void; onLanguage: () => void;
}) {
  return (
    <section className="lgs-home" data-lg-scroll data-testid="screen-simple-home">
      <header className="lgs-top">
        <div>
          <div className="lgs-tn">{simpleCopy("guide", lang)}</div>
          <div className="lgs-tt">{tenant.coverTitle || tenant.name}</div>
        </div>
        <button type="button" className="lgs-flagbtn" onClick={onLanguage} aria-label={lang.toUpperCase()} data-testid="button-simple-language">
          <FlagImage lang={lang} />
        </button>
      </header>
      {sections.map((section) => (
        <div key={section.key} data-testid={`simple-section-${section.key}`}>
          <h2 className="lgs-sec">{section.title}</h2>
          <div className="lgs-grid">
            {section.tiles.map((tile) => {
              const action = tile.action;
              return action.kind === "map" && !action.siteMap && action.href ? (
                <a key={tile.id} className="lgs-tile" href={action.href} data-testid={`tile-${tile.id}`}><TileBody tile={tile} /></a>
              ) : (
                <button key={tile.id} type="button" className="lgs-tile" onClick={() => onTile(tile)} data-testid={`tile-${tile.id}`}>
                  <TileBody tile={tile} />
                </button>
              );
            })}
          </div>
        </div>
      ))}
      <div className="lgs-foot">{simpleCopy("footer", lang)}</div>
    </section>
  );
}

function BackButton({ lang, onClick, testId }: { lang: string; onClick: () => void; testId: string }) {
  return (
    <button type="button" className="lgs-back" onClick={onClick} aria-label={simpleCopy("back", lang)} data-testid={testId}>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5 8 12l7 7" /></svg>
    </button>
  );
}

/** Bottom sheet over the tile page with a single back arrow. */
export function SimpleSheet({ lang, label, testId, onClose, children }: { lang: string; label: string; testId: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="lgs-sheet-layer" role="dialog" aria-modal="true" aria-label={label} onClick={onClose} data-testid={testId}>
      <div className="lgs-sheet-panel" onClick={(event) => event.stopPropagation()}>
        <BackButton lang={lang} onClick={onClose} testId={`${testId}-back`} />
        {children}
      </div>
    </div>
  );
}

export function SimpleWeatherSheet({ lang, location, onClose }: { lang: string; location?: string; onClose: () => void }) {
  const weather = useLivingGuideWeather()?.weather;
  const unavailable: Record<string, string> = { sl: "Vreme trenutno ni na voljo.", en: "Weather is currently unavailable.", de: "Wetter derzeit nicht verfügbar.", it: "Meteo attualmente non disponibile.", fr: "La météo est momentanément indisponible.", nl: "Het weer is momenteel niet beschikbaar.", hr: "Vrijeme trenutačno nije dostupno." };
  return (
    <SimpleSheet lang={lang} label={simpleCopy("weather", lang)} testId="simple-weather" onClose={onClose}>
      {weather ? <WeatherCard location={location} /> : <p role="status">{unavailable[lang] ?? unavailable.sl}</p>}
    </SimpleSheet>
  );
}

/** Full-screen destination (recorder) with a single back arrow; stays mounted while hidden. */
export function SimpleFullView({ lang, label, hidden, onBack, children }: { lang: string; label: string; hidden: boolean; onBack: () => void; children: ReactNode }) {
  return (
    <section className="lgs-full lg2-screen-scroll" hidden={hidden} aria-label={label} data-lg-scroll data-testid="simple-recorder">
      <BackButton lang={lang} onClick={onBack} testId="simple-recorder-back" />
      <h1 className="lgs-full-title">{label}</h1>
      {children}
    </section>
  );
}
