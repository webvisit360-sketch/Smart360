import { useLocation } from "wouter";
import { useState, useRef, useEffect } from "react";
import { sanitizeHtml } from "../../lib/sanitize";
import { formatTodayHours } from "../../lib/hours";
import { buildGuestPath } from "./guest-url";
import { spriteId } from "./sprite-icon";
import { getCoverVars } from "./cover-vars";

export function GuestSwipe({ tenant, slug, lang, categoryId }: { tenant: any, slug: string, lang: string, categoryId: string | null }) {
  const [, setLocation] = useLocation();
  const [activeSectionIdx, setActiveSectionIdx] = useState(0);
  const pagerRef = useRef<HTMLDivElement>(null);

  const sections = tenant.sections?.filter((s: any) => s.isVisible) || [];
  const totalScreens = 1 + sections.length + 1; // cover + sections + contact

  useEffect(() => {
    const el = pagerRef.current;
    if (!el) return;
    const handleScroll = () => {
      const idx = Math.round(el.scrollLeft / el.clientWidth);
      setActiveSectionIdx(idx);
    };
    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => el.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToScreen = (idx: number) => {
    if (pagerRef.current) {
      pagerRef.current.scrollTo({ left: idx * pagerRef.current.clientWidth, behavior: 'smooth' });
    }
  };

  const cTitle = tenant.coverTitle || tenant.name;
  const cSub = tenant.coverSubtitle || tenant.subtitle;
  
  const coverVars = getCoverVars(tenant);

  const showRating = tenant.coverShowRating !== false;

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
    <div className="app">
      <div className="pager" id="pager" ref={pagerRef}>
        <section className="screen">
          <div className="cover" style={coverVars}>
            {tenant.tourUrl ? (
              <iframe src={tenant.tourUrl} className="cover__bg" frameBorder="0" allowFullScreen></iframe>
            ) : (
              <img src={tenant.heroUrl || "/img/foto.jpg"} alt="" className="cover__bg" />
            )}
            <div className="cover__veil"></div>
            <div className="cover__top">
              <img src="/brand/logo-smart360-moder.png" alt="Smart360" style={{ height: 21, width: "auto" }} />
              <span className="cover__sp"></span>
              <button className="cover__btn"><svg className="ic" viewBox="0 0 24 24"><use href="#i-search" /></svg></button>
              <button className="cover__btn"><svg className="ic" viewBox="0 0 24 24"><use href="#i-globe" /></svg></button>
            </div>
            <div className="cover__txt">
              <h1>{cTitle}</h1>
              {cSub && <p>{cSub}</p>}
              {showRating && (
                <div className="cover__meta">
                  <svg className="ic" viewBox="0 0 24 24"><use href="#i-star" /></svg>
                  {tenant.rating || "5.0"} · {tenant.reviewsCount || "0"} ocen
                </div>
              )}
            </div>
            <div className="swipehint">
              <span onClick={() => scrollToScreen(1)}>Povlecite levo<svg className="ic" viewBox="0 0 24 24"><use href="#i-chev" /></svg></span>
            </div>
          </div>
        </section>

        {sections.map((sec: any, idx: number) => {
          const isGrid = sec.categories?.some((c: any) => c.layout === 'poi' || c.layout === 'routes'); // approximate logic for grid vs list
          return (
            <section className="screen" key={sec.id}>
              <div className="sc">
                <div className="sc__k">{idx + 1} / {sections.length}</div>
                <h2 className="sc__t">{sec.title}</h2>
                {sec.subtitle && <p className="sc__s">{sec.subtitle}</p>}
                
                <div className={isGrid ? "grid2" : "rowlist"}>
                  {sec.categories?.filter((c: any) => c.isVisible).map((cat: any) => {
                    const firstImg = cat.items?.find((i: any) => i.isVisible && i.media?.[0])?.media[0].url || "/img/foto.jpg";
                    if (isGrid) {
                      return (
                        <button className="gc" key={cat.id} onClick={() => setLocation(buildGuestPath(`/g/${slug}/c/${cat.id}`))}>
                          <img loading="lazy" src={firstImg} alt="" />
                          <span className="ov"></span>
                          <span className="ico"><svg className="ic" viewBox="0 0 24 24"><use href={`#${spriteId(cat.icon)}`} /></svg></span>
                          <span className="lb">{cat.label}</span>
                        </button>
                      );
                    } else {
                      return (
                        <button className="row" key={cat.id} onClick={() => setLocation(buildGuestPath(`/g/${slug}/c/${cat.id}`))}>
                          <svg className="ic" viewBox="0 0 24 24"><use href={`#${spriteId(cat.icon)}`} /></svg>
                          <span className="row__t">{cat.label}</span>
                          <svg className="ic chev" viewBox="0 0 24 24"><use href="#i-chev" /></svg>
                        </button>
                      );
                    }
                  })}
                </div>
              </div>
            </section>
          );
        })}

        <section className="screen">
          <div className="contact">
            <div className="sc__k">Stik</div>
            <h2 className="sc__t">Tu smo za vas</h2>
            <p className="sc__s">Vprašanje, rezervacija ali priporočilo — odgovorimo v nekaj minutah.</p>
            <div style={{ marginTop: 22 }}>
              {tenant.phone && (
                <>
                  <a className="srow" href={`tel:${tenant.phone}`} target="_blank" rel="noopener noreferrer">
                    <svg className="ic" viewBox="0 0 24 24"><use href="#i-phone" /></svg>
                    <span className="t"><b>Pokliči</b><span>{tenant.phone}</span></span>
                    <svg className="ic chev" viewBox="0 0 24 24"><use href="#i-chev" /></svg>
                  </a>
                  <a className="srow" href={`https://wa.me/${tenant.phone.replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener noreferrer">
                    <svg className="ic" viewBox="0 0 24 24"><use href="#i-chat" /></svg>
                    <span className="t"><b>WhatsApp</b><span>Napišite sporočilo</span></span>
                    <svg className="ic chev" viewBox="0 0 24 24"><use href="#i-chev" /></svg>
                  </a>
                  <a className="srow" href={`viber://chat?number=${tenant.phone.replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener noreferrer">
                    <svg className="ic" viewBox="0 0 24 24"><use href="#i-chat" /></svg>
                    <span className="t"><b>Viber</b><span>Napišite sporočilo</span></span>
                    <svg className="ic chev" viewBox="0 0 24 24"><use href="#i-chev" /></svg>
                  </a>
                </>
              )}
              {tenant.address && (
                <a className="srow" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(tenant.address)}`} target="_blank" rel="noopener noreferrer">
                  <svg className="ic" viewBox="0 0 24 24"><use href="#i-pin" /></svg>
                  <span className="t"><b>Naslov</b><span>{tenant.address}</span></span>
                  <svg className="ic chev" viewBox="0 0 24 24"><use href="#i-chev" /></svg>
                </a>
              )}
            </div>
            {tenant.mapQuery && (
              <a className="btn" style={{ marginTop: 24 }} href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(tenant.mapQuery)}`} target="_blank" rel="noopener noreferrer">
                <svg className="ic" viewBox="0 0 24 24"><use href="#i-nav" /></svg>Navigacija do nas
              </a>
            )}
          </div>
        </section>
      </div>

      <div className={`dots ${activeSectionIdx === 0 ? 'on-dark' : ''}`} id="dots">
        {Array.from({ length: totalScreens }).map((_, i) => (
          <i key={i} className={i === activeSectionIdx ? 'on' : ''} onClick={() => scrollToScreen(i)}></i>
        ))}
      </div>

      <SwipeDetail 
        tenant={tenant} 
        category={currentCategory} 
        section={currentSection} 
        onClose={() => setLocation(buildGuestPath(`/g/${slug}`))} 
        slug={slug} 
      />
    </div>
  );
}

function SwipeDetail({ tenant, category, section, onClose, slug }: { tenant: any, category: any, section: any, onClose: () => void, slug: string }) {
  if (!category || !section) return null;

  const categories = section.categories?.filter((c: any) => c.isVisible) || [];
  const activeIdx = categories.findIndex((c: any) => c.id === category.id);
  
  const [, setLocation] = useLocation();
  const dpagerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (dpagerRef.current && activeIdx >= 0) {
      dpagerRef.current.scrollTo({ left: activeIdx * dpagerRef.current.clientWidth, behavior: 'instant' });
    }
  }, [category.id]); // only re-run when category changes route, not on normal scroll

  useEffect(() => {
    const el = dpagerRef.current;
    if (!el) return;
    
    let isScrolling = false;
    let scrollTimeout: any;

    const handleScroll = () => {
      isScrolling = true;
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        isScrolling = false;
        const newIdx = Math.round(el.scrollLeft / el.clientWidth);
        if (newIdx !== activeIdx && categories[newIdx]) {
          setLocation(buildGuestPath(`/g/${slug}/c/${categories[newIdx].id}`));
        }
      }, 100);
    };

    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => el.removeEventListener('scroll', handleScroll);
  }, [activeIdx, categories, slug, setLocation]);

  return (
    <div className="detail on" id="detail">
      <div className="detail__bar">
        <button className="iconbtn" onClick={onClose}><svg className="ic" viewBox="0 0 24 24"><use href="#i-back" /></svg></button>
        <h2 id="dtitle">{section.title}</h2>
        <button className="iconbtn"><svg className="ic" viewBox="0 0 24 24"><use href="#i-search" /></svg></button>
      </div>
      <div className="chips" id="dchips">
        {categories.map((c: any, i: number) => (
          <button 
            key={c.id} 
            className={`chip ${i === activeIdx ? 'is-on' : ''}`}
            onClick={() => {
              setLocation(buildGuestPath(`/g/${slug}/c/${c.id}`));
            }}
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
                <div style={{ padding: '0 24px', paddingBottom: 100 }}>
                  <CategoryContent category={c} tenant={tenant} items={c.items?.filter((it: any) => it.isVisible) || []} />
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Reuse the exact same CategoryContent from guest-category.tsx
function CategoryContent({ category, tenant, items }: { category: any, tenant: any, items: any[] }) {
  if (items.length === 0) {
    return <div className="empty">V tej kategoriji še ni vsebine.</div>;
  }

  if (category.layout === 'poi') {
    return items.map((item: any) => (
      <article className="card fade" key={item.id}>
        {item.media?.[0] && (
          <div className="card__ph">
            <img loading="lazy" src={item.media[0].url} alt={item.media[0].alt || ""} />
            <button className="card__heart"><svg viewBox="0 0 24 24"><use href="#i-heart" /></svg></button>
          </div>
        )}
        <div className="card__body">
          <div className="card__h"><h3 className="card__n">{item.title}</h3></div>
          {item.open24 && <div><span className="pill o">Odprto 24/7</span></div>}
          
          <div className="info">
            {item.hoursJson && <div><svg className="ic" viewBox="0 0 24 24"><use href="#i-clock" /></svg>{formatTodayHours(item.hoursJson) || "Obratovalni čas ni na voljo"}</div>}
            {item.phone && <div><svg className="ic" viewBox="0 0 24 24"><use href="#i-phone" /></svg><a href={`tel:${item.phone}`}>{item.phone}</a></div>}
            {item.website && <div><svg className="ic" viewBox="0 0 24 24"><use href="#i-globe" /></svg><a href={item.website} target="_blank" rel="noopener noreferrer">Spletna stran</a></div>}
          </div>

          {item.noteText && (
            <div className="tip">
              <img src={tenant.logoUrl || "/img/foto.jpg"} alt="" />
              <div>
                <div className="tip__l">{item.noteType || "Dobro je vedeti"}</div>
                <div className="tip__t" dangerouslySetInnerHTML={{__html: sanitizeHtml(item.noteText)}}></div>
              </div>
            </div>
          )}

          {(item.phone || item.mapQuery) && (
            <div className="actions">
              {item.phone && <a className="act act--w" href={`tel:${item.phone}`} aria-label="Pokliči"><svg className="ic" viewBox="0 0 24 24"><use href="#i-phone" /></svg></a>}
              {item.mapQuery && <a className="act act--fill" href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(item.mapQuery || "")}`} target="_blank" rel="noopener noreferrer"><svg className="ic" viewBox="0 0 24 24"><use href="#i-nav" /></svg>Navigacija</a>}
            </div>
          )}
        </div>
      </article>
    ));
  }

  if (category.layout === 'rules') {
    return (
      <div style={{marginTop: 8}}>
        {items.map((item: any) => (
          <div className="rule fade" key={item.id}>
            <svg className="ic" viewBox="0 0 24 24"><use href="#i-rules" /></svg>
            <div>
              {item.title && <b>{item.title} </b>}
              <span dangerouslySetInnerHTML={{__html: sanitizeHtml(item.body || "")}}></span>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (category.layout === 'products') {
    return items.map((item: any) => (
      <article className="card fade" key={item.id}>
        {item.media?.[0] && (
          <div className="card__ph">
            <img loading="lazy" src={item.media[0].url} alt="" />
            <button className="card__heart"><svg viewBox="0 0 24 24"><use href="#i-heart" /></svg></button>
          </div>
        )}
        <div className="card__body">
          <div className="card__h"><h3 className="card__n">{item.title}</h3></div>
          {item.body && <div className="card__sub" style={{marginTop: 6}} dangerouslySetInnerHTML={{__html: sanitizeHtml(item.body)}}></div>}
          {item.price && <div className="card__price">{item.price} <span>{item.priceUnit ? `/ ${item.priceUnit}` : ''}</span></div>}
          <div className="actions">
            {item.phone ? (
              <a className="act act--fill" href={`tel:${item.phone}`}><svg className="ic" viewBox="0 0 24 24"><use href="#i-chat" /></svg>Rezerviraj</a>
            ) : tenant.phone ? (
              <a className="act act--fill" href={`tel:${tenant.phone}`}><svg className="ic" viewBox="0 0 24 24"><use href="#i-chat" /></svg>Povprašaj</a>
            ) : null}
          </div>
        </div>
      </article>
    ));
  }

  if (category.layout === 'routes') {
    return items.map((item: any) => (
      <article className="card fade" key={item.id}>
        {item.media?.[0] && (
          <div className="card__ph">
            <img loading="lazy" src={item.media[0].url} alt="" />
            <button className="card__heart"><svg viewBox="0 0 24 24"><use href="#i-heart" /></svg></button>
          </div>
        )}
        <div className="card__body">
          <div className="card__h"><h3 className="card__n">{item.title}</h3></div>
          <div style={{display: 'flex', gap: 9, alignItems: 'center', flexWrap: 'wrap', marginTop: 2}}>
            {item.difficulty && <span className={`pill ${item.difficulty === 'Zahtevna' ? 'hard' : 'mod'}`}>{item.difficulty}</span>}
            {item.duration && <span className="info" style={{margin: 0}}><div><svg className="ic" viewBox="0 0 24 24"><use href="#i-clock" /></svg>{item.duration}</div></span>}
            {item.distance && <span className="info" style={{margin: 0}}><div><svg className="ic" viewBox="0 0 24 24"><use href="#i-pin" /></svg>{item.distance}</div></span>}
          </div>
          {(item.mapQuery) && (
            <div className="actions">
              <a className="act" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.mapQuery || "")}`} target="_blank" rel="noopener noreferrer"><svg className="ic" viewBox="0 0 24 24"><use href="#i-map" /></svg>Izhodišče</a>
              <a className="act act--fill" href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(item.mapQuery || "")}`} target="_blank" rel="noopener noreferrer"><svg className="ic" viewBox="0 0 24 24"><use href="#i-nav" /></svg>Navigacija</a>
            </div>
          )}
        </div>
      </article>
    ));
  }

  if (category.layout === 'wifi') {
    return items.map((item: any) => (
      <div className="kv" key={item.id}>
        <div className="t">
          <div className="k">{item.title}</div>
          <div className="v">{item.body}</div>
        </div>
        <button className="iconbtn" onClick={() => {
          if (item.body) {
            navigator.clipboard.writeText(item.body);
            alert("Kopirano!");
          }
        }}><svg className="ic" viewBox="0 0 24 24"><use href="#i-book" /></svg></button>
      </div>
    ));
  }

  // fallback to text layout
  return items.map((item: any) => (
    <div key={item.id} className="fade">
      <div className="prose">
        {item.title && <h2 className="h2">{item.title}</h2>}
        {parseTextBody(item.body)}
      </div>
      {item.media && item.media.length > 0 && (
        <div className="gal" style={{marginTop: 16}}>
          <div className="galtrack">
            {item.media.map((m: any) => <img key={m.id} src={m.url} alt={m.alt || ""} />)}
          </div>
        </div>
      )}
    </div>
  ));
}

function parseTextBody(body: string) {
  if (!body) return null;
  try {
    const parsed = JSON.parse(body);
    if (Array.isArray(parsed)) {
      return parsed.map((p, i) => <p key={i} dangerouslySetInnerHTML={{ __html: sanitizeHtml(p) }} />);
    }
  } catch (e) {}
  return <p dangerouslySetInnerHTML={{ __html: sanitizeHtml(body) }} />;
}
