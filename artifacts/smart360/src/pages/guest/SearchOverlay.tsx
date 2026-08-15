import { useState } from "react";
import { useSearchPublicTenant } from "@workspace/api-client-react";
import { Link } from "wouter";
import { buildGuestPath } from "./guest-url";
import { sanitizeHtml } from "../../lib/sanitize";

export function SearchOverlay({ slug, lang, isOpen, onClose }: { slug: string, lang: string, isOpen: boolean, onClose: () => void }) {
  const [query, setQuery] = useState("");
  const { data: results, isLoading } = useSearchPublicTenant(
    slug,
    { q: query, lang },
    { query: { enabled: isOpen && query.length > 2, queryKey: ['getSearchPublicTenant', slug, query, lang] } }
  );

  if (!isOpen) return null;

  return (
    <div className="mask on" style={{ opacity: 1, pointerEvents: 'auto', display: 'flex', flexDirection: 'column', background: 'var(--wash)' }}>
      <header className="navbar" style={{ background: '#fff', borderBottom: '1px solid var(--line)' }}>
        <button className="iconbtn" onClick={onClose}><svg className="ic" viewBox="0 0 24 24"><use href="#i-back" /></svg></button>
        <div style={{flex: 1, display: 'flex', alignItems: 'center'}}>
           <input autoFocus value={query} onChange={e => setQuery(e.target.value)} placeholder="Kaj iščete?" className="searchfield" style={{marginLeft: 12, width: '100%'}} />
        </div>
      </header>
      
      <div className="pagepad" style={{flex: 1, overflowY: 'auto', paddingTop: 20}}>
        {query.length > 2 ? (
          isLoading ? <div className="empty">Iskanje...</div> :
          results && results.length > 0 ? (
            <div className="list">
              {results.map(res => (
                <Link href={buildGuestPath(`/${slug}/c/${res.categoryId}`)} onClick={onClose} className="row" key={res.itemId} style={{flexDirection: 'column', alignItems: 'flex-start', padding: '12px 0'}}>
                  <div className="tip__l">{res.sectionTitle} • {res.categoryLabel}</div>
                  <div className="row__t" style={{marginTop: 6}}>{res.title || 'Rezultat'}</div>
                  <div className="card__sub" style={{marginTop: 4}} dangerouslySetInnerHTML={{__html: sanitizeHtml(res.snippet)}}></div>
                </Link>
              ))}
            </div>
          ) : <div className="empty">Ni rezultatov za "{query}".</div>
        ) : (
          <div className="empty">Vnesite vsaj 3 črke za iskanje.</div>
        )}
      </div>
    </div>
  );
}
