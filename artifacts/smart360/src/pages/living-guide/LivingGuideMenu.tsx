import { useEffect, useRef, type ReactNode } from "react";
import type { UiTranslator } from "../guest/i18n";
import { TourProfileControl, useTourProfile } from "./living-guide-tour-profile";
import "./living-guide-announcements.css";

import { LANG_NAMES, menuCopy, menuRowIds } from "./living-guide-menu-model";
export { menuCopy } from "./living-guide-menu-model";

const Icon = ({ children }: { children: ReactNode }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
);
const ICONS: Record<string, ReactNode> = {
  language: <Icon><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3Z" /></Icon>,
  profile: <Icon><circle cx="12" cy="8" r="3.6" /><path d="M4.5 20a7.5 7.5 0 0 1 15 0" /></Icon>,
  install: <Icon><rect x="6.5" y="2.5" width="11" height="19" rx="2.5" /><path d="M12 8v6M9 11h6M10.5 18.5h3" /></Icon>,
  help: <Icon><circle cx="12" cy="12" r="9" /><path d="M12 7.5v9M7.5 12h9" /></Icon>,
  about: <Icon><circle cx="12" cy="12" r="9" /><path d="M12 11v5.5M12 7.6v.2" /></Icon>,
};

export const MenuGlyph = () => <Icon><path d="M4 7h16M4 12h16M4 17h16" /></Icon>;

export function LivingGuideMenu({ lang, t, installAvailable, onClose, onLanguage, onInstall, onHelp, onAbout }: {
  lang: string; t: UiTranslator; installAvailable: boolean; onClose: () => void;
  onLanguage: () => void; onInstall: () => void; onHelp: () => void; onAbout: () => void;
}) {
  const c = menuCopy(lang);
  const profile = useTourProfile();
  const panelRef = useRef<HTMLDivElement | null>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const profileOpenRef = useRef(false);
  profileOpenRef.current = profile.open;

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    panelRef.current?.querySelector<HTMLElement>("button")?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.stopImmediatePropagation();
      if (profileOpenRef.current) profile.setOpen(false);
      else closeRef.current();
    };
    // Outside tap closes on any viewport: the scrim is bounded to the guide column, so on desktop
    // the area beside it is not part of the scrim. Listen at document level instead.
    const onPointerDown = (event: PointerEvent) => {
      const panel = panelRef.current;
      if (!panel || !(event.target instanceof Node) || panel.contains(event.target)) return;
      if (profileOpenRef.current) return; // profile layer lives inside the panel; ignore stray taps
      closeRef.current();
    };
    window.addEventListener("keydown", onKey, true);
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      document.removeEventListener("pointerdown", onPointerDown, true);
      previous?.focus?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rows: Record<string, { title: string; sub: string; run: () => void }> = {
    language: { title: c.language, sub: LANG_NAMES[lang] ?? lang.toUpperCase(), run: onLanguage },
    profile: { title: c.profile, sub: c.profileSub, run: () => profile.setOpen(true) },
    install: { title: c.install, sub: c.installSub, run: onInstall },
    help: { title: c.help, sub: c.helpSub, run: onHelp },
    about: { title: c.about, sub: c.aboutSub, run: onAbout },
  };

  return (
    <div className="lg2-menu-scrim" role="presentation" data-testid="guest-menu-scrim">
      <div className="lg2-menu-panel" role="dialog" aria-modal="true" aria-label={c.menu} ref={panelRef} data-testid="guest-menu">
        <div className="lg2-menu-head">
          <span className="lg2-menu-title">{c.menu}</span>
          <button type="button" className="lg2-menu-x" onClick={onClose} aria-label={c.close} data-testid="button-menu-close">
            <Icon><path d="M6 6l12 12M18 6 6 18" /></Icon>
          </button>
        </div>
        <div className="lg2-menu-sheet">
          {menuRowIds(installAvailable).map((id) => (
            <button key={id} type="button" className="lg2-menu-row" onClick={rows[id].run} data-testid={`menu-row-${id}`}>
              <span className="lg2-menu-ic">{ICONS[id]}</span>
              <span className="lg2-menu-txt"><span className="lg2-menu-mt">{rows[id].title}</span><span className="lg2-menu-ms">{rows[id].sub}</span></span>
              <span className="lg2-menu-go" aria-hidden="true"><Icon><path d="M9.5 5 16 12l-6.5 7" /></Icon></span>
            </button>
          ))}
        </div>
        <p className="lg2-menu-foot">{c.footer}</p>
        {profile.open && (
          <div className="lg2-menu-profile" data-testid="menu-profile-layer">
            <TourProfileControl t={t} activity="hiking" tourActive={false} controller={profile} />
          </div>
        )}
      </div>
    </div>
  );
}

export function LivingGuideAbout({ lang, onClose }: { lang: string; onClose: () => void }) {
  const c = menuCopy(lang);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") { event.stopImmediatePropagation(); closeRef.current(); } };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);
  return (
    <div className="lg2-ann-layer" role="dialog" aria-modal="true" aria-label={c.aboutTitle} data-testid="about-guide">
      <div className="lg2-ann-list">
        <div className="lg2-ann-top">
          <button type="button" className="lg2-ann-back" onClick={onClose} aria-label={c.close} data-testid="button-about-close">
            <svg aria-hidden="true"><use href="#lg-i-bk" /></svg>
          </button>
        </div>
        <p className="lg2-ann-kicker">Smart360</p>
        <h1 className="lg2-ann-h1">{c.aboutTitle}</h1>
        {([[c.aboutWhatH, c.aboutWhat], [c.aboutPrivacyH, c.aboutPrivacy], [c.aboutSourcesH, c.aboutSources]] as const).map(([h, p]) => (
          <section key={h} className="lg2-about-block"><h2>{h}</h2><p>{p}</p></section>
        ))}
        <p className="lg2-menu-foot">{c.footer}</p>
      </div>
    </div>
  );
}
