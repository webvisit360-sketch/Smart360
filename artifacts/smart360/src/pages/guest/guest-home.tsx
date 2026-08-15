import { useGetPublicTenant } from "@workspace/api-client-react";
import { useRoute, useSearch, Link } from "wouter";
import { useState } from "react";
import { Tabbar } from "./Tabbar";
import { ContactSheet } from "./ContactSheet";
import { SearchOverlay } from "./SearchOverlay";
import { buildGuestPath } from "./guest-url";
import { spriteId } from "./sprite-icon";
import { GuestSwipe } from "./GuestSwipe";
import { getCoverVars, getTextVars } from "./cover-vars";
import { ShareSheet } from "./ShareSheet";
import { imgSrc } from "./img";
import { hsub } from "./hsub";
import { useThemeAttr } from "./use-theme-attr";
import { useEffect } from "react";

export default function GuestHome() {
  const [, params] = useRoute("/g/:slug");
  const searchStr = useSearch();
  const searchParams = new URLSearchParams(searchStr);
  const lang = searchParams.get("lang") || "sl";
  const isPreview = searchParams.get("preview") === "1";
  const slug = params?.slug || "";

  const { data: tenant, isLoading, isError } = useGetPublicTenant(
    slug, 
    { lang, preview: isPreview },
    { query: { enabled: !!slug, queryKey: ['getPublicTenant', slug, lang, isPreview] } }
  );

  const [searchOpen, setSearchOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);

  useThemeAttr(tenant?.theme);

  // The cover photo is the first thing a guest sees — preload it eagerly.
  const heroHref = tenant?.heroUrl ? imgSrc(tenant.heroUrl, 1400) : null;
  useEffect(() => {
    if (!heroHref) return;
    const link = document.createElement("link");
    link.rel = "preload";
    link.as = "image";
    link.href = heroHref;
    document.head.appendChild(link);
    return () => { document.head.removeChild(link); };
  }, [heroHref]);

  if (isLoading) return <div className="app"><div className="pagepad"><div className="empty">Nalaganje...</div></div></div>;
  if (isError || !tenant) return <div className="app"><div className="pagepad"><div className="empty">Namestitev ni najdena.</div></div></div>;

  if (tenant.theme === 'swipe') {
    return <GuestSwipe tenant={tenant} slug={slug} lang={lang} categoryId={null} />;
  }

  const sections = tenant.sections?.filter((s: any) => s.isVisible) || [];

  const coverVars = getCoverVars(tenant);

  const cTitle = tenant.coverTitle || tenant.name;
  const showRating = tenant.coverShowRating !== false;
  
  // Big cards: top 4 sections
  const bigCards = sections.slice(0, 4).map((sec: any) => {
    let photo = "";
    let itemCount = 0;
    sec.categories?.filter((c: any) => c.isVisible).forEach((cat: any) => {
      cat.items?.filter((i: any) => i.isVisible).forEach((item: any) => {
        itemCount++;
        if (!photo && item.media?.[0]) photo = item.media[0].url;
      });
    });
    const firstCat = sec.categories?.filter((c: any) => c.isVisible)[0]?.id;
    return { 
      id: sec.id,
      title: sec.title, 
      icon: sec.icon || "home", 
      count: itemCount, 
      photo: sec.imageUrl || photo || "/img/foto.jpg", 
      link: firstCat ? `/g/${slug}/c/${firstCat}` : null 
    };
  });

  // Home rows: one identical .hrow per section, listing ALL of its categories.
  // Thumbnail: first visible item's first photo → section default → tenant hero.
  const homeRows = sections.map((sec: any) => {
    const cats = (sec.categories || []).filter((c: any) => c.isVisible);
    return {
      id: sec.id,
      title: sec.title,
      subtitle: sec.subtitle,
      cats: cats.map((cat: any) => {
        const firstPhoto = cat.items
          ?.filter((i: any) => i.isVisible)
          .find((i: any) => i.media?.[0])?.media[0].url;
        return {
          id: cat.id,
          label: cat.label,
          photo: firstPhoto || sec.imageUrl || tenant.heroUrl || "",
          sub: hsub(cat),
        };
      }),
    };
  }).filter((row: any) => row.cats.length > 0);

  return (
    <div className="app" style={{ ...coverVars, ...getTextVars(tenant) }}>
      <header className="appbar" id="appbar">
        <img src="/brand/logo-smart360-moder.png" alt="Smart360" style={{ height: 21, width: "auto" }} />
        
        <button className="iconbtn" style={{marginLeft: 'auto'}} onClick={() => setShareOpen(true)} aria-label="Deli">
          <svg className="ic" viewBox="0 0 24 24"><use href="#i-share" /></svg>
        </button>
        <div style={{position: 'relative'}}>
          <button className="iconbtn">
            <svg className="ic" viewBox="0 0 24 24"><use href="#i-globe" /></svg>
          </button>
          <select 
            value={lang}
            onChange={(e) => {
              const sp = new URLSearchParams(window.location.search);
              sp.set("lang", e.target.value);
              window.location.search = sp.toString();
            }}
            style={{ position: 'absolute', inset: 0, opacity: 0, width: '100%', cursor: 'pointer' }}
          >
            {tenant.languages?.map(l => (
              <option key={l} value={l}>{l.toUpperCase()}</option>
            ))}
          </select>
        </div>
      </header>

      <div className="hero">
        {tenant.heroUrl ? <img src={imgSrc(tenant.heroUrl, 1400)} alt="" loading="eager" decoding="sync" /> : <div style={{width: '100%', height: '100%', background: 'var(--wash)'}}></div>}
        <button className="hero__heart"><svg viewBox="0 0 24 24"><use href="#i-heart" /></svg></button>
        {tenant.tourUrl && (
          <a href={tenant.tourUrl} target="_blank" rel="noopener noreferrer" className="hero__pill">
            <svg className="ic" viewBox="0 0 24 24"><use href="#i-360" /></svg>360° sprehod
          </a>
        )}
        <div className="hero__hint">
          <svg className="ic" viewBox="0 0 24 24"><use href="#i-360" /></svg>Povlecite za razgled
        </div>
      </div>

      <div className="tcard">
        <h1 className="title">{cTitle}</h1>
        {showRating && (
          <div className="meta">
            <svg className="ic" viewBox="0 0 24 24"><use href="#i-star" /></svg>
            <b>{tenant.rating || "5.0"}</b><span className="sep">·</span>
            <span>{tenant.reviewsCount || "0"} ocen</span>
            {tenant.address && <><span className="sep">·</span><span>{tenant.address}</span></>}
          </div>
        )}
        <button className="search" onClick={() => setSearchOpen(true)}>
          <svg className="ic" viewBox="0 0 24 24"><use href="#i-search" /></svg>
          <span style={{minWidth: 0}}>
            <span className="search__t" style={{display: 'block'}}>Kaj iščete?</span>
            <span className="search__s" style={{display: 'block'}}>Nastanitev · Ponudba · Okolica</span>
          </span>
        </button>
      </div>

      <div className="pagepad">
        
        {bigCards.length > 0 && (
          <section className="section fade">
            <h2 className="sec__title">Kaj vas zanima?</h2>
            <div className="big">
              {bigCards.map(bc => (
                <Link key={bc.id} href={bc.link ? buildGuestPath(bc.link) : '#'} className="bc">
                  <img loading="lazy" decoding="async" src={imgSrc(bc.photo, 620)} alt="" />
                  <span className="ov"></span>
                  <span className="ico"><svg className="ic" viewBox="0 0 24 24"><use href={`#${spriteId(bc.icon)}`} /></svg></span>
                  <span className="tx">
                    <b>{bc.title}</b>
                    <span>{bc.count} vnosov</span>
                  </span>
                </Link>
              ))}
            </div>
            
            <div className="qk">
              {tenant.wifiSsid && <button onClick={() => { navigator.clipboard.writeText(tenant.wifiPass || ""); alert("Geslo kopirano!"); }}><svg className="ic" viewBox="0 0 24 24"><use href="#i-wifi" /></svg>WiFi</button>}
              {tenant.phone && <button onClick={() => window.location.href = `tel:${tenant.phone}`}><svg className="ic" viewBox="0 0 24 24"><use href="#i-phone" /></svg>Klic</button>}
              {tenant.mapQuery && <button onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(tenant.mapQuery || "")}`, '_blank')}><svg className="ic" viewBox="0 0 24 24"><use href="#i-nav" /></svg>Navigacija do nas</button>}
            </div>
          </section>
        )}

        {homeRows.map((row: any) => (
          <section key={row.id} className="section fade">
            <h2 className="sec__title">{row.title}</h2>
            {row.subtitle && <p className="sec__sub">{row.subtitle}</p>}
            <div className="hrow">
              {row.cats.map((cat: any) => (
                <Link key={cat.id} href={buildGuestPath(`/g/${slug}/c/${cat.id}`)} className="hcard">
                  <span className="im"><img loading="lazy" decoding="async" src={imgSrc(cat.photo, 620)} alt="" /></span>
                  <b>{cat.label}</b>
                  <span>{cat.sub}</span>
                </Link>
              ))}
            </div>
          </section>
        ))}

        <section className="host">
          <div className="host__top">
            <img className="host__av" src={imgSrc(tenant.logoUrl, 620)} alt="" loading="lazy" decoding="async" />
            <div>
              <div className="host__n">Tu smo za vas</div>
              <div className="host__s">Običajno odgovorimo v nekaj minutah</div>
            </div>
          </div>
          <button className="btn" onClick={() => setContactOpen(true)}>
            <svg className="ic" viewBox="0 0 24 24"><use href="#i-chat" /></svg>Kontaktirajte gostitelja
          </button>
        </section>

        <div className="tail"></div>
      </div>

      <Tabbar slug={slug} tenant={tenant} currentTab="home" onContactClick={() => setContactOpen(true)} />
      <ContactSheet tenant={tenant} isOpen={contactOpen} onClose={() => setContactOpen(false)} />
      <ShareSheet tenant={tenant} isOpen={shareOpen} onClose={() => setShareOpen(false)} />
      <SearchOverlay slug={slug} lang={lang} isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}
