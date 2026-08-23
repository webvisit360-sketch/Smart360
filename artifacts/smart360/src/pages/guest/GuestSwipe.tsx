import { useLocation } from "wouter";
import { useState, useRef, useEffect, useLayoutEffect } from "react";
import { sanitizeHtml } from "../../lib/sanitize";
import { formatTodayHours } from "../../lib/hours";
import { buildGuestPath } from "./guest-url";
import { spriteId } from "./sprite-icon";
import { getTextVars } from "./cover-vars";
import { Cover } from "./Cover";
import { ShareSheet } from "./ShareSheet";
import { useThemeAttr } from "./use-theme-attr";
import { isLightHex } from "./use-theme-attr";
import { imgSrc, mediaImgSrc } from "./img";
import { GalleryStrip, MediaThumb, frameStyle } from "./media-viewer";
import { makeT, plural, switchLang, LANG_NAMES, DIFFICULTY_KEYS } from "./i18n";
import { resolveTenantMapsUrl } from "@/lib/tenant-maps";

export function GuestSwipe({ tenant, slug, lang, categoryId }: { tenant: any, slug: string, lang: string, categoryId: string | null }) {
  const [, setLocation] = useLocation();
  const [activeSectionIdx, setActiveSectionIdx] = useState(0);
  const [shareOpen, setShareOpen] = useState(false);
  // Iskanje v vrstici na naslovnici + ozek izbirnik jezika. Nikoli hkrati odprta.
  const [findOpen, setFindOpen] = useState(false);
  const [findQ, setFindQ] = useState("");
  const [langOpen, setLangOpen] = useState(false);
  const findInputRef = useRef<HTMLInputElement>(null);
  const findBtnRef = useRef<HTMLButtonElement>(null);
  const langBtnRef = useRef<HTMLButtonElement>(null);
  const pagerRef = useRef<HTMLDivElement>(null);
  const movingRef = useRef(false);
  const snapTimerRef = useRef<any>(null);

  useThemeAttr(tenant?.theme);
  // Barvo ozadja nanaša IZKLJUČNO GuestHost (App.tsx) — en vir resnice.
  const t = makeT(tenant, lang);
  const tenantSearchUrl = resolveTenantMapsUrl(tenant, "search");
  const tenantDirectionsUrl = resolveTenantMapsUrl(tenant, "directions");
  const sections = tenant.sections?.filter((s: any) => s.isVisible) || [];
  const totalScreens = 1 + sections.length + 1; // cover + sections + contact

  // Deep link (shared URL, QR): the section screen the pager must show on the
  // very first painted frame. Cover is screen 0, sections follow.
  const initialIdx = (() => {
    if (!categoryId) return 0;
    const si = sections.findIndex((sec: any) =>
      sec.categories?.some((c: any) => c.id === categoryId));
    return si >= 0 ? 1 + si : 0;
  })();

  // Position BEFORE first paint, with snap disabled (scroll-snap intercepts
  // programmatic jumps — same recipe as pageTo). The pager renders hidden and
  // is revealed here, in the same layout pass: one frame, no flash.
  useLayoutEffect(() => {
    const pg = pagerRef.current;
    if (!pg) return;
    // Themes ship in the main bundle now, so styles are normally applied at
    // first paint. The short frame-by-frame guard stays as a safety net (max
    // 20 frames) — after that the pager is revealed regardless: a hidden
    // pager is worse than a misplaced one.
    let raf = 0;
    let tries = 0;
    const place = () => {
      if (getComputedStyle(pg).display !== "flex" && tries++ < 20) {
        raf = requestAnimationFrame(place);
        return;
      }
      if (initialIdx > 0) {
        const w = pg.clientWidth || window.innerWidth;
        pg.style.scrollSnapType = "none";
        pg.scrollLeft = initialIdx * w;
        void pg.offsetWidth; // force the layout to take effect
        pg.style.scrollSnapType = "";
        setActiveSectionIdx(initialIdx);
      }
      pg.style.visibility = "";
    };
    place();
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const el = pagerRef.current;
    if (!el) return;
    const handleScroll = () => {
      if (movingRef.current) return; // an intermediate frame must not overwrite the target
      const idx = Math.round(el.scrollLeft / (el.clientWidth || 1));
      setActiveSectionIdx(idx);
    };
    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => el.removeEventListener('scroll', handleScroll);
  }, []);

  // Re-snap on resize (prevents half-snapped state after orientation change)
  useEffect(() => {
    const handleResize = () => {
      const pg = pagerRef.current;
      if (pg) pg.scrollLeft = activeSectionIdx * (pg.clientWidth || window.innerWidth);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [activeSectionIdx]);

  // Keyboard navigation
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        // Najprej zapri prekrivke na naslovnici in vrni fokus na sprožilni gumb.
        // Fokus šele po Reactovem izrisu — dokler je vrstica odprta, je gumb
        // z lupo display:none in focus() ne prime.
        if (findOpen) { closeFind(); setTimeout(() => findBtnRef.current?.focus(), 0); return; }
        if (langOpen) { setLangOpen(false); langBtnRef.current?.focus(); return; }
        if (categoryId) { setLocation(buildGuestPath(`/${slug}`)); return; }
      }
      if (categoryId) return;
      if (e.key === "ArrowRight") scrollToScreen(Math.min(activeSectionIdx + 1, totalScreens - 1));
      if (e.key === "ArrowLeft") scrollToScreen(Math.max(activeSectionIdx - 1, 0));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeSectionIdx, totalScreens, categoryId, slug, setLocation, findOpen, langOpen]);

  // Odmik z naslovnice zapre iskanje in izbirnik jezika — vrnitev na
  // zaslon 0 mora pokazati čisto naslovnico, ne obležalega stanja.
  useEffect(() => {
    if (activeSectionIdx !== 0) {
      setFindOpen(false);
      setFindQ("");
      setLangOpen(false);
    }
  }, [activeSectionIdx]);

  // Programmatic paging: iOS Safari + scroll-snap stops smooth scrolls at the first
  // snap point (or resets to 0), so snapping is turned off for the duration of the move.
  const scrollToScreen = (idx: number) => {
    const pg = pagerRef.current;
    if (!pg) return;
    const w = pg.clientWidth || window.innerWidth; // never trust a 0 width
    const i = Math.max(0, Math.min(totalScreens - 1, idx));
    pg.style.scrollSnapType = "none";
    movingRef.current = true;
    pg.scrollTo({ left: i * w, behavior: 'smooth' });
    setActiveSectionIdx(i);
    clearTimeout(snapTimerRef.current);
    snapTimerRef.current = setTimeout(() => {
      pg.scrollLeft = i * (pg.clientWidth || w); // the TARGET, not the current value
      pg.style.scrollSnapType = "";
      movingRef.current = false;
      setActiveSectionIdx(i);
    }, 420);
  };

  // Tap on a bottom icon while the detail overlay is open: move the pager while it is
  // still hidden behind the overlay, then reveal it — the guest lands exactly there.
  const goToScreen = (idx: number) => {
    const pg = pagerRef.current;
    if (categoryId && pg) {
      const w = pg.clientWidth || window.innerWidth;
      const i = Math.max(0, Math.min(totalScreens - 1, idx));
      pg.style.scrollSnapType = "none";
      pg.scrollLeft = i * w;
      requestAnimationFrame(() => {
        pg.scrollLeft = i * w; // again after reflow
        pg.style.scrollSnapType = "";
        setActiveSectionIdx(i);
        setLocation(buildGuestPath(`/${slug}`));
      });
      return;
    }
    scrollToScreen(idx);
  };

  // Only set what the owner overrode; empty fields fall back to the
  // theme defaults baked into the CSS (var(--nv, #...) fallbacks).
  const navVars: Record<string, string> = {};
  if (tenant.navColor) navVars["--nv"] = tenant.navColor;
  if (tenant.navColorOn) navVars["--nv-on"] = tenant.navColorOn;
  if (tenant.navColorCover) navVars["--nv-cover"] = tenant.navColorCover;
  // Dark page background: force light bottom icons ONLY when the owner has
  // not overridden the nav colours (their explicit choice always wins).
  if (typeof document !== "undefined" &&
      document.documentElement.getAttribute("data-dark") === "1") {
    if (!tenant.navColor) navVars["--nv"] = "#C7CFD6";
    if (!tenant.navColorOn) navVars["--nv-on"] = "#F3F6F8";
  }

  // Zadetki: nazivi kategorij (pod: naslov razdelka) + naslovi postavk (pod:
  // naziv kategorije) — POI, poti, izdelki, dogodki so postavke svojih kategorij.
  // Neobčutljivo na velikost črk IN šumnike ("plaza" najde "Plaža").
  const fold = (s: string) => (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const q = fold(findQ.trim());
  const findResults: { title: string, sub: string, icon: string, catId: string }[] = [];
  if (q.length >= 2) {
    for (const sec of sections) {
      for (const cat of sec.categories?.filter((c: any) => c.isVisible) || []) {
        if (fold(cat.label).includes(q)) {
          findResults.push({ title: cat.label, sub: sec.title, icon: cat.icon, catId: cat.id });
        }
        for (const it of cat.items?.filter((i: any) => i.isVisible) || []) {
          if (fold(it.title).includes(q)) {
            findResults.push({ title: it.title, sub: cat.label, icon: cat.icon, catId: cat.id });
          }
        }
      }
    }
  }

  const openFind = () => { setLangOpen(false); setFindQ(""); setFindOpen(true); setTimeout(() => findInputRef.current?.focus(), 60); };
  const closeFind = () => { setFindOpen(false); setFindQ(""); };

  // Logotip stranke se NIKOLI ne skriva, ne bledi in ne premika (spec
  // iskanje-in-jezik.md). Če se iskalna vrstica z njim prekriva, je vrstica
  // narisana NAD njim (.cover__top z-index:8 > .brandlogo z-index:6).

  // Dotik izven izbirnika jezika ga zapre.
  useEffect(() => {
    if (!langOpen) return;
    const away = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest?.(".langpop,.cover__btn")) setLangOpen(false);
    };
    document.addEventListener("click", away);
    return () => document.removeEventListener("click", away);
  }, [langOpen]);

  let currentCategory: any = null;
  let currentSection: any = null;
  if (categoryId) {
    for (const sec of sections) {
      const cat = sec.categories?.find((c: any) => c.id === categoryId);
      if (cat) {
        currentCategory = cat;
        currentSection = sec;
        break;
      }
    }
  }

  return (
    <div className="app" style={{ ...navVars, ...getTextVars(tenant) }}>
      <div className="pager" id="pager" ref={pagerRef} style={{ visibility: "hidden" }}>
        <section className="screen">
          <Cover
            tenant={tenant}
            lang={lang}
            coverTopClass={findOpen ? "is-find" : undefined}
            coverTop={
              <>
                <span className="cover__sp"></span>
                <button className="cover__btn" ref={findBtnRef} onClick={openFind} aria-label={t("UI.search.title")}><svg className="ic" viewBox="0 0 24 24"><use href="#i-search" /></svg></button>
                <button className="cover__btn" onClick={() => setShareOpen(true)} aria-label={t("UI.share.native")}><svg className="ic" viewBox="0 0 24 24"><use href="#i-share" /></svg></button>
                <button className="cover__btn" ref={langBtnRef} onClick={() => { closeFind(); setLangOpen(v => !v); }} aria-label={t("UI.lang.title")} aria-haspopup="listbox" aria-expanded={langOpen} aria-controls="langpop"><svg className="ic" viewBox="0 0 24 24"><use href="#i-globe" /></svg></button>
                {langOpen && (
                  <div className="langpop on" id="langpop" role="listbox" aria-label={t("UI.lang.title")}>
                    {tenant.languages?.map((l: string) => (
                      <button
                        key={l}
                        className={l === lang ? "langpop__i is-on" : "langpop__i"}
                        role="option"
                        aria-selected={l === lang}
                        aria-label={LANG_NAMES[l] ?? l.toUpperCase()}
                        title={LANG_NAMES[l] ?? l.toUpperCase()}
                        onClick={() => { setLangOpen(false); switchLang(slug, l); }}
                      >{l.toUpperCase()}</button>
                    ))}
                  </div>
                )}
                <form className="findbar" id="findbar" onSubmit={(e) => e.preventDefault()}>
                  <span className="findbar__ic"><svg className="ic" viewBox="0 0 24 24"><use href="#i-search" /></svg></span>
                  <input
                    id="findq"
                    ref={findInputRef}
                    value={findQ}
                    onChange={(e) => setFindQ(e.target.value)}
                    placeholder={t("UI.search.title")}
                    autoComplete="off"
                  />
                  {/* Križec kot ČRTNI SVG — sprite #i-cross je zavrten pravokotnik
                      in se zalije v packo; tu je poteza eksplicitna. */}
                  <button type="button" className="findbar__x" onClick={closeFind} aria-label="Zapri">
                    <svg className="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                      strokeWidth="2.4" strokeLinecap="round"><path d="M7 7l10 10M17 7L7 17" /></svg>
                  </button>
                </form>
                <div className={findOpen && q.length >= 2 ? "findres on" : "findres"} id="findres">
                  {findOpen && q.length >= 2 && (
                    findResults.length
                      ? findResults.slice(0, 20).map((r, i) => (
                        <button
                          key={`${r.catId}-${i}`}
                          className="findres__r"
                          onClick={() => { closeFind(); setLocation(buildGuestPath(`/${slug}/c/${r.catId}`)); }}
                        >
                          <svg className="ic" viewBox="0 0 24 24"><use href={`#${spriteId(r.icon)}`} /></svg>
                          <span className="t"><b>{r.title}</b><span>{r.sub}</span></span>
                          <svg className="ic chev" viewBox="0 0 24 24"><use href="#i-chev" /></svg>
                        </button>
                      ))
                      : <div className="findres__e">{t("UI.search.empty")}</div>
                  )}
                </div>
              </>
            }
          />
        </section>

        {sections.map((sec: any, idx: number) => (
          <section className="screen" key={sec.id}>
            <div className="sc">
              <div className="sc__k">{idx + 1} / {sections.length}</div>
              <h2 className="sc__t">{sec.title}</h2>
              {sec.subtitle && <p className="sc__s">{sec.subtitle}</p>}

              {/* one layout for every section screen: identical photo tiles */}
              <div className="grid2">
                {sec.categories?.filter((c: any) => c.isVisible).map((cat: any) => {
                  // Barvna ploščica: prvi vidni vnos z barvo določi površino
                  // ploščice (fotografije v detajlu ostanejo) — barvne-ploscice.md.
                  const tint = cat.items?.find((i: any) => i.isVisible)?.tint;
                  if (tint) {
                    return (
                      <button
                        className={isLightHex(tint) ? "gc gc--tint gc--tint-light" : "gc gc--tint"}
                        key={cat.id}
                        style={{ "--tint": tint } as React.CSSProperties}
                        onClick={() => setLocation(buildGuestPath(`/${slug}/c/${cat.id}`))}
                      >
                        <span className="gc__ic"><svg className="ic" viewBox="0 0 24 24"><use href={`#${spriteId(cat.icon)}`} /></svg></span>
                        <span className="cap">{cat.label}</span>
                      </button>
                    );
                  }
                  const firstMedia = cat.items?.find((i: any) => i.isVisible && i.media?.[0])?.media[0];
                  const firstImg = firstMedia ? mediaImgSrc(firstMedia, 620) : imgSrc(tenant.heroUrl, 620);
                  return (
                    <button className="gc" key={cat.id} onClick={() => setLocation(buildGuestPath(`/${slug}/c/${cat.id}`))}>
                      <img loading="lazy" decoding="async" src={firstImg} alt="" />
                      <span className="ov"></span>
                      <span className="ico"><svg className="ic" viewBox="0 0 24 24"><use href={`#${spriteId(cat.icon)}`} /></svg></span>
                      <span className="cap">{cat.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </section>
        ))}

        <section className="screen">
          <div className="contact">
            <div className="sc__k">{t("UI.contact.k")}</div>
            <h2 className="sc__t">{t("UI.host.title")}</h2>
            <p className="sc__s">{t("UI.contact.intro")}</p>
            <div style={{ marginTop: 22 }}>
              {tenant.phone && (
                <>
                  <a className="srow" href={`tel:${tenant.phone}`} target="_blank" rel="noopener noreferrer">
                    <svg className="ic" viewBox="0 0 24 24"><use href="#i-phone" /></svg>
                    <span className="t"><b>{t("UI.contact.call")}</b><span>{tenant.phone}</span></span>
                    <svg className="ic chev" viewBox="0 0 24 24"><use href="#i-chev" /></svg>
                  </a>
                  <a className="srow" href={`https://wa.me/${tenant.phone.replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener noreferrer">
                    <svg className="ic" viewBox="0 0 24 24"><use href="#i-chat" /></svg>
                    <span className="t"><b>WhatsApp</b><span>{t("UI.contact.message")}</span></span>
                    <svg className="ic chev" viewBox="0 0 24 24"><use href="#i-chev" /></svg>
                  </a>
                  <a className="srow" href={`viber://chat?number=${tenant.phone.replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener noreferrer">
                    <svg className="ic" viewBox="0 0 24 24"><use href="#i-chat" /></svg>
                    <span className="t"><b>Viber</b><span>{t("UI.contact.message")}</span></span>
                    <svg className="ic chev" viewBox="0 0 24 24"><use href="#i-chev" /></svg>
                  </a>
                </>
              )}
              {/* E-pošta med Instagramom in naslovom (izrez-wifi-eposta.md §3). */}
              {tenant.email && (
                <a className="srow" href={`mailto:${tenant.email}`}>
                  <svg className="ic" viewBox="0 0 24 24"><use href="#i-mail" /></svg>
                  <span className="t"><b>{t("UI.contact.email")}</b><span>{tenant.email}</span></span>
                  <svg className="ic chev" viewBox="0 0 24 24"><use href="#i-chev" /></svg>
                </a>
              )}
              {tenant.address && tenantSearchUrl && (
                <a className="srow" href={tenantSearchUrl} target="_blank" rel="noopener noreferrer">
                  <svg className="ic" viewBox="0 0 24 24"><use href="#i-pin" /></svg>
                  <span className="t"><b>{t("UI.contact.address")}</b><span>{tenant.address}</span></span>
                  <svg className="ic chev" viewBox="0 0 24 24"><use href="#i-chev" /></svg>
                </a>
              )}
            </div>
            {tenantDirectionsUrl && (
              <a className="btn" style={{ marginTop: 24 }} href={tenantDirectionsUrl} target="_blank" rel="noopener noreferrer">
                <svg className="ic" viewBox="0 0 24 24"><use href="#i-nav" /></svg>{t("UI.contact.directions")}
              </a>
            )}
          </div>
        </section>
      </div>

      <nav className={`tabdock ${!currentCategory && activeSectionIdx === 0 ? 'on-dark' : ''}`} id="tabdock">
        {sections.map((sec: any, idx: number) => {
          const fallback = ["i-home", "i-bag", "i-compass", "i-cart"];
          const iconId = sec.icon ? spriteId(sec.icon) : (fallback[idx] || "i-doc");
          const activeIdxNow = currentCategory && currentSection
            ? sections.indexOf(currentSection) + 1
            : activeSectionIdx;
          return (
            <button
              key={sec.id}
              className={`nv ${activeIdxNow === idx + 1 ? 'is-on' : ''}`}
              data-i={idx + 1}
              onClick={() => goToScreen(idx + 1)}
              aria-label={sec.title}
              title={sec.title}
            >
              <svg className="ic" viewBox="0 0 24 24"><use href={`#${iconId}`} /></svg>
            </button>
          );
        })}
        <button
          className={`nv ${!currentCategory && activeSectionIdx === totalScreens - 1 ? 'is-on' : ''}`}
          data-i={totalScreens - 1}
          onClick={() => goToScreen(totalScreens - 1)}
          aria-label={t("UI.host.title")}
          title={t("UI.host.title")}
        >
          <svg className="ic" viewBox="0 0 24 24"><use href="#i-chat" /></svg>
        </button>
      </nav>

      {/* Always keep detail in DOM so CSS slide-in transition fires when category is selected */}
      <SwipeDetail 
        tenant={tenant} 
        category={currentCategory} 
        section={currentSection} 
        slug={slug} 
        lang={lang}
      />
      <ShareSheet tenant={tenant} lang={lang} isOpen={shareOpen} onClose={() => setShareOpen(false)} />
    </div>
  );
}

function SwipeDetail({ tenant, category, section, slug, lang }: { tenant: any, category: any, section: any, slug: string, lang: string }) {
  const t = makeT(tenant, lang);
  const isOpen = !!(category && section);
  const categories = section?.categories?.filter((c: any) => c.isVisible) || [];
  const activeIdx = category ? categories.findIndex((c: any) => c.id === category.id) : -1;
  
  const [, setLocation] = useLocation();
  const dpagerRef = useRef<HTMLDivElement>(null);
  const detailRef = useRef<HTMLDivElement>(null);

  // Deep link straight into a detail: it must already BE there on the first
  // frame, not drive in from the right (the guest did not trigger that).
  useLayoutEffect(() => {
    const el = detailRef.current;
    if (!el || !isOpen) return;
    el.style.transition = "none";
    el.classList.add("on");
    requestAnimationFrame(() => { el.style.transition = ""; });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Scroll dpager to active category when category changes. Before paint and
  // with snap disabled — scroll-snap intercepts programmatic jumps, and on a
  // deep link the first painted frame must already be the right pane.
  useLayoutEffect(() => {
    const el = dpagerRef.current;
    if (!el || activeIdx < 0) return;
    let raf = 0;
    let tries = 0;
    const place = () => {
      // Wait until the async theme stylesheet is applied (see pager above).
      if (getComputedStyle(el).display !== "flex" && tries++ < 20) {
        raf = requestAnimationFrame(place);
        return;
      }
      const w = el.clientWidth || window.innerWidth;
      el.style.scrollSnapType = "none";
      el.scrollLeft = activeIdx * w;
      void el.offsetWidth; // force the layout to take effect
      el.style.scrollSnapType = "";
    };
    place();
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category?.id]);

  // Scroll active chip into view when active category changes
  useEffect(() => {
    if (activeIdx < 0) return;
    const t = setTimeout(() => {
      const chip = document.querySelector('#dchips .chip.is-on') as HTMLElement | null;
      if (chip) chip.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
    }, 50);
    return () => clearTimeout(t);
  }, [category?.id]);

  // Dpager scroll → update route (which updates active chip via category.id)
  useEffect(() => {
    const el = dpagerRef.current;
    if (!el || !isOpen) return;
    
    let isScrolling = false;
    let scrollTimeout: any;

    const handleScroll = () => {
      isScrolling = true;
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        isScrolling = false;
        const newIdx = Math.round(el.scrollLeft / el.clientWidth);
        if (newIdx !== activeIdx && categories[newIdx]) {
          setLocation(buildGuestPath(`/${slug}/c/${categories[newIdx].id}`));
        }
      }, 100);
    };

    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      el.removeEventListener('scroll', handleScroll);
      clearTimeout(scrollTimeout);
    };
  }, [activeIdx, categories, slug, setLocation, isOpen]);

  return (
    <div className={`detail${isOpen ? ' on' : ''}`} id="detail" ref={detailRef}>
      {isOpen && (
        <>
          {/* Paket 16: brez zgornje pasice — nazaj prek spodnjih ikon, naslov v vsebini (.dh) */}
          <div className="chips" id="dchips">
            {categories.map((c: any, i: number) => (
              <button 
                key={c.id} 
                className={`chip ${i === activeIdx ? 'is-on' : ''}`}
                onClick={() => setLocation(buildGuestPath(`/${slug}/c/${c.id}`))}
              >
                {c.label}
              </button>
            ))}
          </div>
          <div className="dpager" id="dpager" ref={dpagerRef}>
            {categories.map((c: any, i: number) => {
              // Lazy render: only render current, prev, next
              const isNear = Math.abs(i - activeIdx) <= 1;
              return (
                <div className="dscreen" key={c.id}>
                  {isNear ? (
                    <>
                      <h2 className="dh">{c.label}</h2>
                      <CategoryContent category={c} tenant={tenant} t={t} lang={lang} items={c.items?.filter((it: any) => it.isVisible) || []} />
                    </>
                  ) : null}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

// Reuse the exact same CategoryContent from guest-category.tsx
function CategoryContent({ category, tenant, t, lang, items }: { category: any, tenant: any, t: (key: string) => string, lang: string, items: any[] }) {
  if (items.length === 0) {
    return <div className="empty">{t("UI.search.empty")}</div>;
  }

  if (category.layout === 'poi') {
    return items.map((item: any) => (
      <article className="card fade" key={item.id} style={frameStyle(item.frame)}>
        {item.media?.[0] && (
          <div className="card__ph">
            <MediaThumb media={item.media} />
            <button className="card__heart"><svg viewBox="0 0 24 24"><use href="#i-heart" /></svg></button>
          </div>
        )}
        <div className="card__body">
          <div className="card__h"><h3 className="card__n">{item.title}</h3></div>
          {item.open24 && <div><span className="pill o">{t("UI.open247")}</span></div>}
          
          <div className="info">
            {item.hoursJson && <div><svg className="ic" viewBox="0 0 24 24"><use href="#i-clock" /></svg>{formatTodayHours(item.hoursJson, lang) || t("UI.closed")}</div>}
            {item.phone && <div><svg className="ic" viewBox="0 0 24 24"><use href="#i-phone" /></svg><a href={`tel:${item.phone}`}>{item.phone}</a></div>}
            {item.website && <div><svg className="ic" viewBox="0 0 24 24"><use href="#i-globe" /></svg><a href={item.website} target="_blank" rel="noopener noreferrer">{t("UI.website")}</a></div>}
          </div>

          {item.noteText && (
            <div className="tip">
              <img src={imgSrc(tenant.logoSquareUrl || tenant.logoUrl, 620)} alt="" loading="lazy" decoding="async" />
              <div>
                <div className="tip__l">{item.noteType || t("UI.tip")}</div>
                <div className="tip__t" dangerouslySetInnerHTML={{__html: sanitizeHtml(item.noteText)}}></div>
              </div>
            </div>
          )}

          {(item.phone || item.mapQuery) && (
            <div className="actions">
              {item.phone && <a className="act act--w" href={`tel:${item.phone}`} aria-label={t("UI.contact.call")}><svg className="ic" viewBox="0 0 24 24"><use href="#i-phone" /></svg></a>}
              {item.mapQuery && (item.mapQuery === tenant.mapQuery
                ? <a className="act act--fill" href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(item.mapQuery || "")}`} target="_blank" rel="noopener noreferrer"><svg className="ic" viewBox="0 0 24 24"><use href="#i-nav" /></svg>{t("UI.contact.directions")}</a>
                : <a className="act act--fill" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.mapQuery || "")}`} target="_blank" rel="noopener noreferrer"><svg className="ic" viewBox="0 0 24 24"><use href="#i-pin" /></svg>Google Maps</a>)}
            </div>
          )}
        </div>
      </article>
    ));
  }

  if (category.layout === 'apartments') {
    /* Apartmaji: naslov stoji NAD fotografijo, opis pod njo.
       Naslov pove, kaj slika prikazuje, preden jo gost pogleda. */
    return items.map((item: any) => (
      <article className="card fade" key={item.id} style={frameStyle(item.frame)}>
        <div className="card__body card__body--head"><h3 className="card__n">{item.title}</h3></div>
        {item.media && item.media.length > 1 ? (
          <GalleryStrip media={item.media} />
        ) : item.media?.[0] ? (
          <div className="card__ph card__ph--mid">
            <MediaThumb media={item.media} />
          </div>
        ) : null}
        <div className="card__body">
          {Array.isArray(item.bullets) && item.bullets.length > 0 && (
            <div className="card__sub">{item.bullets.join(" · ")}</div>
          )}
          <div className="prose" style={{marginTop: 8}}>{parseTextBody(item.body)}</div>
        </div>
      </article>
    ));
  }

  if (category.layout === 'rules') {
    return (
      <div style={{marginTop: 8}}>
        {items.map((item: any) => (
          <div className="fade" key={item.id}>
            {item.media && item.media.length > 0 && (
              <GalleryStrip media={item.media} style={{ marginBottom: 12, ...frameStyle(item.frame) }} />
            )}
            <div className="rule">
              <svg className="ic" viewBox="0 0 24 24"><use href="#i-rules" /></svg>
              <div>
                {item.title && <b>{item.title} </b>}
                <span dangerouslySetInnerHTML={{__html: sanitizeHtml(item.body || "")}}></span>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (category.layout === 'products') {
    return items.map((item: any) => (
      <article className="card fade" key={item.id} style={frameStyle(item.frame)}>
        {item.media?.[0] && (
          <div className="card__ph">
            <MediaThumb media={item.media} alt="" />
            <button className="card__heart"><svg viewBox="0 0 24 24"><use href="#i-heart" /></svg></button>
          </div>
        )}
        <div className="card__body">
          <div className="card__h"><h3 className="card__n">{item.title}</h3></div>
          {item.body && <div className="card__sub" style={{marginTop: 6}} dangerouslySetInnerHTML={{__html: sanitizeHtml(item.body)}}></div>}
          {item.price && <div className="card__price">{item.price} <span>{item.priceUnit ? `/ ${item.priceUnit}` : ''}</span></div>}
          <div className="actions">
            {item.phone ? (
              <a className="act act--fill" href={`tel:${item.phone}`}><svg className="ic" viewBox="0 0 24 24"><use href="#i-chat" /></svg>{t("UI.book")}</a>
            ) : tenant.phone ? (
              <a className="act act--fill" href={`tel:${tenant.phone}`}><svg className="ic" viewBox="0 0 24 24"><use href="#i-chat" /></svg>{t("UI.book")}</a>
            ) : null}
          </div>
        </div>
      </article>
    ));
  }

  if (category.layout === 'routes') {
    return items.map((item: any) => (
      <article className="card fade" key={item.id} style={frameStyle(item.frame)}>
        {item.media?.[0] && (
          <div className="card__ph">
            <MediaThumb media={item.media} alt="" />
            <button className="card__heart"><svg viewBox="0 0 24 24"><use href="#i-heart" /></svg></button>
          </div>
        )}
        <div className="card__body">
          <div className="card__h"><h3 className="card__n">{item.title}</h3></div>
          <div style={{display: 'flex', gap: 9, alignItems: 'center', flexWrap: 'wrap', marginTop: 2}}>
            {item.difficulty && <span className={`pill ${item.difficulty === 'Zahtevna' ? 'hard' : 'mod'}`}>{DIFFICULTY_KEYS[item.difficulty] ? t(DIFFICULTY_KEYS[item.difficulty]!) : item.difficulty}</span>}
            {item.duration && <span className="info" style={{margin: 0}}><div><svg className="ic" viewBox="0 0 24 24"><use href="#i-clock" /></svg>{item.duration}</div></span>}
            {item.distance && <span className="info" style={{margin: 0}}><div><svg className="ic" viewBox="0 0 24 24"><use href="#i-pin" /></svg>{item.distance}</div></span>}
          </div>
          {(item.mapQuery) && (
            <div className="actions">
              <a className="act act--fill" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.mapQuery || "")}`} target="_blank" rel="noopener noreferrer"><svg className="ic" viewBox="0 0 24 24"><use href="#i-pin" /></svg>Google Maps</a>
            </div>
          )}
        </div>
      </article>
    ));
  }

  if (category.layout === 'wifi') {
    /* Kartica WiFi se gradi iz strukturiranih polj namestitve (SSID, geslo),
       ne iz besedilnega bloba — dve vrstici s kopiranjem in QR koda
       (izrez-wifi-eposta.md §2). Prosto besedilo vnosov ostane kot opomba
       SPODAJ (npr. "signal seže do bazena"), izrisano kot povsod drugje. */
    const wifiRows = [
      tenant.wifiSsid ? { k: t("UI.wifi.network"), v: tenant.wifiSsid as string } : null,
      tenant.wifiPass ? { k: t("UI.wifi.password"), v: tenant.wifiPass as string } : null,
    ].filter(Boolean) as { k: string; v: string }[];
    return (
      <>
        {wifiRows.map((row) => (
          <div className="kv" key={row.k}>
            <div className="t">
              <div className="k">{row.k}</div>
              <div className="v">{row.v}</div>
            </div>
            <button className="iconbtn" aria-label={t("UI.wifi.copy")} onClick={() => {
              navigator.clipboard.writeText(row.v);
              alert(t("UI.share.copied"));
            }}><svg className="ic" viewBox="0 0 24 24"><use href="#i-book" /></svg></button>
          </div>
        ))}
        {/* Join-by-scan QR: Android joins from the code; the copy rows above
            stay for older iPhones and laptops that still need to type. */}
        {tenant.wifiQrSvg && (
          <div className="qrbox">
            <div className="qrbox__code" dangerouslySetInnerHTML={{ __html: tenant.wifiQrSvg }} />
            <div className="qrbox__cap">{t("UI.wifi.scan")}</div>
          </div>
        )}
        {items.map((item: any) => {
          const note = parseTextBody(item.body);
          return note ? <div className="prose" key={item.id} style={{ marginTop: 12 }}>{note}</div> : null;
        })}
      </>
    );
  }

  // fallback to text layout
  return items.map((item: any) => (
    <div key={item.id} className="fade">
      {item.media && item.media.length > 0 && (
        <GalleryStrip media={item.media} style={{ marginBottom: 16, ...frameStyle(item.frame) }} />
      )}
      <div className="prose">
        {/* Paket 16: kategorija ima naslov v .dh — ne podvajaj ga v vsebini */}
        {item.title && item.title !== category.label && <h2 className="h2">{item.title}</h2>}
        {parseTextBody(item.body)}
      </div>
    </div>
  ));
}

function parseTextBody(body: string) {
  if (!body) return null;
  try {
    const parsed = JSON.parse(body);
    if (Array.isArray(parsed)) {
      // Drop null/junk paragraphs (import residue like [null]) so an
      // effectively empty body renders nothing — no empty <p>, no gap.
      const paras = parsed.filter((p) => p != null && String(p).trim() !== "" && !["null", "undefined", "NaN", "[null]"].includes(String(p).trim()));
      if (paras.length === 0) return null;
      return paras.map((p, i) => <p key={i} dangerouslySetInnerHTML={{ __html: sanitizeHtml(p) }} />);
    }
  } catch (e) {}
  return <p dangerouslySetInnerHTML={{ __html: sanitizeHtml(body) }} />;
}
