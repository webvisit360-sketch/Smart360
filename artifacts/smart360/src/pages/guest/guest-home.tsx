import { useGetPublicTenant } from "@workspace/api-client-react";
import { useRoute, useSearch, Link } from "wouter";
import { useState } from "react";
import { Tabbar } from "./Tabbar";
import { ContactSheet } from "./ContactSheet";
import { SearchOverlay } from "./SearchOverlay";
import { buildGuestPath } from "./guest-url";
import { spriteId } from "./sprite-icon";

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
  const [contactOpen, setContactOpen] = useState(false);

  if (isLoading) return <div className="app"><div className="pagepad"><div className="empty">Nalaganje...</div></div></div>;
  if (isError || !tenant) return <div className="app"><div className="pagepad"><div className="empty">Namestitev ni najdena.</div></div></div>;

  const sections = tenant.sections?.filter((s: any) => s.isVisible) || [];
  
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
      photo: photo || "/img/foto.jpg", 
      link: firstCat ? `/g/${slug}/c/${firstCat}` : null 
    };
  });

  // Organize content by type to match the UI screens
  const priljubljenoItems: any[] = [];
  const zaDanesCats: any[] = [];
  const nastanitevCats: any[] = [];
  const storitveCats: any[] = [];

  sections.forEach((sec: any) => {
    sec.categories?.filter((c: any) => c.isVisible).forEach((cat: any) => {
      if (cat.layout === 'products') {
        cat.items?.filter((i: any) => i.isVisible).forEach((item: any) => priljubljenoItems.push({...item, catId: cat.id}));
      } else if (cat.layout === 'poi' || cat.layout === 'routes') {
        zaDanesCats.push(cat);
      } else if (cat.layout === 'svcs' || ['cart', 'bread', 'fuel', 'card', 'cross', 'hospital'].includes(cat.icon)) {
        storitveCats.push(cat);
      } else {
        nastanitevCats.push(cat);
      }
    });
  });

  return (
    <div className="app">
      <header className="appbar" id="appbar">
        {tenant.logoUrl && <img className="brandmark" src={tenant.logoUrl} alt="" />}
        <span className="brand">{tenant.name}{tenant.subtitle && <small>{tenant.subtitle}</small>}</span>
        
        <div style={{position: 'relative', marginLeft: 'auto'}}>
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
        {tenant.heroUrl ? <img src={tenant.heroUrl} alt="" /> : <div style={{width: '100%', height: '100%', background: 'var(--wash)'}}></div>}
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
        <h1 className="title">{tenant.name}</h1>
        <div className="meta">
          <svg className="ic" viewBox="0 0 24 24"><use href="#i-star" /></svg>
          <b>{tenant.rating || "5.0"}</b><span className="sep">·</span>
          <span>{tenant.reviewsCount || "0"} ocen</span>
          {tenant.address && <><span className="sep">·</span><span>{tenant.address}</span></>}
        </div>
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
                  <img loading="lazy" src={bc.photo} alt="" />
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
              {tenant.mapQuery && <button onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(tenant.mapQuery || "")}`, '_blank')}><svg className="ic" viewBox="0 0 24 24"><use href="#i-pin" /></svg>Pot do nas</button>}
            </div>
          </section>
        )}

        {priljubljenoItems.length > 0 && (
          <section className="section fade">
            <h2 className="sec__title">Priljubljeno pri gostih</h2>
            <p className="sec__sub">Na voljo gostom {tenant.name}</p>
            <div className="hrow">
              {priljubljenoItems.map((item, idx) => (
                <Link key={`${item.id}-${idx}`} href={buildGuestPath(`/g/${slug}/c/${item.catId}`)} className="hcard">
                  <span className="im"><img loading="lazy" src={item.media?.[0]?.url || "/img/foto.jpg"} alt="" /></span>
                  <b>{item.title}</b>
                  <span>{item.price ? `${item.price}${item.priceUnit ? ' ' + item.priceUnit.replace(/^\/?\s*/, '/ ') : ''}` : 'Več info'}</span>
                </Link>
              ))}
            </div>
          </section>
        )}

        {zaDanesCats.length > 0 && (
          <section className="section fade">
            <h2 className="sec__title">Za danes</h2>
            <p className="sec__sub">Izbrana priporočila na dosegu</p>
            <div className="hrow">
              {zaDanesCats.map((cat, idx) => {
                const photo = cat.items?.find((i: any) => i.isVisible && i.media?.[0])?.media[0].url || "/img/foto.jpg";
                const count = cat.items?.filter((i: any) => i.isVisible).length || 0;
                return (
                  <Link key={`${cat.id}-${idx}`} href={buildGuestPath(`/g/${slug}/c/${cat.id}`)} className="hcard">
                    <span className="im"><img loading="lazy" src={photo} alt="" /></span>
                    <b>{cat.label}</b>
                    <span>{count} priporočil</span>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {nastanitevCats.length > 0 && (
          <section className="section fade">
            <h2 className="sec__title">Vaša nastanitev</h2>
            <p className="sec__sub">Vse o vašem bivanju na enem mestu</p>
            <div className="list">
              {nastanitevCats.map((cat, idx) => (
                <Link key={`${cat.id}-${idx}`} href={buildGuestPath(`/g/${slug}/c/${cat.id}`)} className="row">
                  <svg className="ic" viewBox="0 0 24 24"><use href={`#${spriteId(cat.icon)}`} /></svg>
                  <span className="row__t">{cat.label}</span>
                  <svg className="ic chev" viewBox="0 0 24 24"><use href="#i-chev" /></svg>
                </Link>
              ))}
            </div>
          </section>
        )}

        {storitveCats.length > 0 && (
          <section className="section fade">
            <h2 className="sec__title">Storitve v bližini</h2>
            <div className="svcs">
              {storitveCats.map((cat, idx) => (
                <Link key={`${cat.id}-${idx}`} href={buildGuestPath(`/g/${slug}/c/${cat.id}`)} className="svc">
                  <svg className="ic" viewBox="0 0 24 24"><use href={`#${spriteId(cat.icon)}`} /></svg>
                  <span>{cat.label}</span>
                </Link>
              ))}
            </div>
          </section>
        )}

        <section className="host">
          <div className="host__top">
            <img className="host__av" src={tenant.logoUrl || "/img/foto.jpg"} alt="" />
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
      <SearchOverlay slug={slug} lang={lang} isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}
