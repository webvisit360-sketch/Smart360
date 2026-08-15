import { useGetPublicTenant } from "@workspace/api-client-react";
import { useRoute, useSearch, Link, useLocation } from "wouter";
import { useState } from "react";
import { Tabbar } from "./Tabbar";
import { ContactSheet } from "./ContactSheet";
import { SearchOverlay } from "./SearchOverlay";
import { formatTodayHours } from "../../lib/hours";
import { sanitizeHtml } from "../../lib/sanitize";
import { buildGuestPath } from "./guest-url";
import { GuestSwipe } from "./GuestSwipe";
import { imgSrc } from "./img";

export default function GuestCategory() {
  const [, params] = useRoute("/g/:slug/c/:categoryId");
  const searchStr = useSearch();
  const searchParams = new URLSearchParams(searchStr);
  const lang = searchParams.get("lang") || "sl";
  const isPreview = searchParams.get("preview") === "1";
  
  const slug = params?.slug || "";
  const categoryId = params?.categoryId || "";
  const [, setLocation] = useLocation();

  const { data: tenant, isLoading } = useGetPublicTenant(
    slug, 
    { lang, preview: isPreview },
    { query: { enabled: !!slug, queryKey: ['getPublicTenant', slug, lang, isPreview] } }
  );

  const [searchOpen, setSearchOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);

  if (isLoading) return <div className="app"><div className="pagepad"><div className="empty">Nalaganje...</div></div></div>;
  if (!tenant) return <div className="app"><div className="pagepad"><div className="empty">Kategorija ni najdena.</div></div></div>;

  if (tenant.theme === 'swipe') {
    return <GuestSwipe tenant={tenant} slug={slug} lang={lang} categoryId={categoryId} />;
  }

  let currentCategory: any = null;
  let currentSection: any = null;
  for (const sec of tenant.sections || []) {
    const cat = sec.categories?.find((c: any) => c.id === categoryId);
    if (cat) {
      currentCategory = cat;
      currentSection = sec;
      break;
    }
  }

  if (!currentCategory) return <div className="app"><div className="pagepad"><div className="empty">Kategorija ni najdena.</div></div></div>;

  const adjacentCategories = currentSection?.categories?.filter((c: any) => c.isVisible) || [];
  const items = currentCategory.items?.filter((i: any) => i.isVisible) || [];

  return (
    <div className="app">
      <header className="navbar">
        <button className="iconbtn" onClick={() => setLocation(buildGuestPath(`/g/${slug}`))}>
          <svg className="ic" viewBox="0 0 24 24"><use href="#i-back" /></svg>
        </button>
        <button className="iconbtn right" onClick={() => setSearchOpen(true)}>
          <svg className="ic" viewBox="0 0 24 24"><use href="#i-search" /></svg>
        </button>
      </header>

      <div className="pagepad">
        <div className="lead">
          <h1 className="lead__t">{currentCategory.label}</h1>
          <p className="lead__s">{items.length} elementov · {tenant.name}</p>
        </div>
      </div>

      <div className="chips">
        {adjacentCategories.map((cat: any) => (
          <Link key={cat.id} href={buildGuestPath(`/g/${slug}/c/${cat.id}`)} className={`chip ${cat.id === categoryId ? 'is-on' : ''}`}>
            {cat.label}
          </Link>
        ))}
      </div>

      <div className="pagepad">
        <CategoryContent category={currentCategory} tenant={tenant} items={items} />
        <div className="tail"></div>
      </div>

      <Tabbar slug={slug} tenant={tenant} currentTab={currentCategory.id} onContactClick={() => setContactOpen(true)} />
      <ContactSheet tenant={tenant} isOpen={contactOpen} onClose={() => setContactOpen(false)} />
      <SearchOverlay slug={slug} lang={lang} isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}

function CategoryContent({ category, tenant, items }: { category: any, tenant: any, items: any[] }) {
  if (items.length === 0) {
    return <div className="empty">V tej kategoriji še ni vsebine.</div>;
  }

  if (category.layout === 'poi') {
    return items.map((item: any) => (
      <article className="card fade" key={item.id}>
        {item.media?.[0] && (
          <div className="card__ph">
            <img loading="lazy" decoding="async" src={imgSrc(item.media[0].url, 620)} alt={item.media[0].alt || ""} />
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
              <img src={imgSrc(tenant.logoUrl, 620)} alt="" loading="lazy" decoding="async" />
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
            <img loading="lazy" decoding="async" src={imgSrc(item.media[0].url, 620)} alt="" />
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
            <img loading="lazy" decoding="async" src={imgSrc(item.media[0].url, 620)} alt="" />
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
            {item.media.map((m: any) => <img key={m.id} loading="lazy" decoding="async" src={imgSrc(m.url, 1400)} alt={m.alt || ""} />)}
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
