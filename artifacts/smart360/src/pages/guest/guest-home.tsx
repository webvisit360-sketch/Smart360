import { useGetPublicTenant, useSearchPublicTenant, getGetPublicTenantQueryKey, getSearchPublicTenantQueryKey } from "@workspace/api-client-react";
import { useRoute, useSearch, Link } from "wouter";
import { useState, useMemo, useEffect } from "react";
import { Loader2, Phone, MapPin, Wifi, Check, Copy, Navigation, Search, X, Instagram, Send, Map } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { CategoryIcon } from "@/lib/icon-map";

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
    { query: { enabled: !!slug, queryKey: getGetPublicTenantQueryKey(slug, { lang, preview: isPreview }) } }
  );

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const { data: searchResults, isLoading: isSearching } = useSearchPublicTenant(
    slug,
    { q: searchQuery, lang },
    { query: { enabled: searchOpen && searchQuery.length > 2, queryKey: getSearchPublicTenantQueryKey(slug, { q: searchQuery, lang }) } }
  );

  if (isLoading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isError || !tenant) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-background p-6 text-center">
        <h1 className="text-2xl font-bold mb-2">Namestitev ni najdena</h1>
        <p className="text-muted-foreground mb-6">Ta povezava ne obstaja ali namestitev ni več objavljena.</p>
        <Link href="/">
          <Button>Na prvo stran</Button>
        </Link>
      </div>
    );
  }

  const visibleSections = tenant.sections?.filter(s => s.isVisible) || [];

  return (
    <div className="min-h-[100dvh] bg-muted/20 flex justify-center font-sans">
      <div className="w-full max-w-[420px] bg-background min-h-[100dvh] relative shadow-2xl overflow-x-hidden flex flex-col">
        {/* Search Overlay */}
        {searchOpen && (
          <div className="absolute inset-0 z-50 bg-background flex flex-col animate-in fade-in slide-in-from-bottom-8">
            <div className="p-4 flex items-center gap-2 border-b border-border shadow-sm bg-background">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input 
                  autoFocus
                  placeholder="Kaj iščete?" 
                  className="pl-10 bg-muted/50 border-transparent rounded-full h-12"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Button variant="ghost" size="icon" onClick={() => {
                setSearchOpen(false);
                setSearchQuery("");
              }}>
                <X className="w-6 h-6" />
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-muted/10">
              {searchQuery.length > 2 ? (
                isSearching ? (
                  <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
                ) : searchResults && searchResults.length > 0 ? (
                  searchResults.map(res => (
                    <div key={res.itemId} className="bg-background rounded-[24px] p-4 border border-border shadow-sm cursor-pointer hover:border-primary/50 transition-colors" onClick={() => {
                      setSearchOpen(false);
                    }}>
                      <div className="text-xs font-bold text-primary mb-1 uppercase tracking-wider">{res.sectionTitle} • {res.categoryLabel}</div>
                      <h4 className="font-bold text-lg">{res.title || 'Rezultat'}</h4>
                      <p className="text-sm text-muted-foreground mt-1" dangerouslySetInnerHTML={{__html: res.snippet}} />
                    </div>
                  ))
                ) : (
                  <div className="text-center p-8 text-muted-foreground">Ni rezultatov za "{searchQuery}"</div>
                )
              ) : (
                <div className="text-center p-8 text-muted-foreground">Vnesite vsaj 3 črke za iskanje po vsebinah namestitve.</div>
              )}
            </div>
          </div>
        )}

        {/* Header/Hero */}
        <div className="relative w-full h-[300px] bg-muted shrink-0 rounded-b-[24px] overflow-hidden">
          {tenant.heroUrl ? (
            <img src={tenant.heroUrl} alt={tenant.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-primary/10 flex items-center justify-center">
              <span className="text-primary font-bold text-2xl opacity-50">Smart360</span>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/10" />
          
          <div className="absolute top-4 right-4 flex gap-2 z-10">
            <Button variant="ghost" size="icon" className="bg-black/30 hover:bg-black/50 text-white rounded-full backdrop-blur-md h-9 w-9" onClick={() => setSearchOpen(true)}>
              <Search className="w-4 h-4" />
            </Button>
            <select 
              className="bg-black/30 text-white border-none rounded-full px-3 h-9 text-sm font-bold backdrop-blur-md outline-none appearance-none cursor-pointer"
              value={lang}
              onChange={(e) => {
                const sp = new URLSearchParams(window.location.search);
                sp.set("lang", e.target.value);
                window.location.search = sp.toString();
              }}
            >
              {tenant.languages?.map(l => (
                <option key={l} value={l} className="text-black">{l.toUpperCase()}</option>
              ))}
            </select>
          </div>

          <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
            <h1 className="text-[32px] font-extrabold leading-tight">{tenant.name}</h1>
            {tenant.subtitle && <p className="text-white/90 font-medium text-lg mt-1">{tenant.subtitle}</p>}
            
            <div className="flex flex-wrap items-center gap-3 mt-5">
              {tenant.rating && (
                <div className="flex items-center gap-1.5 bg-white/20 backdrop-blur-md px-4 py-1.5 rounded-full border border-white/10 shadow-sm">
                  <span className="text-yellow-400 text-lg leading-none">★</span>
                  <span className="font-bold text-sm">{tenant.rating}</span>
                  {tenant.reviewsCount && <span className="text-white/80 text-xs font-medium">({tenant.reviewsCount})</span>}
                </div>
              )}
              {tenant.tourUrl && (
                <a href={tenant.tourUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 bg-primary text-white px-4 py-1.5 rounded-full text-sm font-bold shadow-[0_3px_0_hsl(217,58%,44%)] active:translate-y-[3px] active:shadow-none transition-all">
                  <Navigation className="w-4 h-4" />
                  360° Tour
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="px-6 py-5 flex gap-4 overflow-x-auto no-scrollbar shrink-0 border-b border-border/40">
          {tenant.phone && (
            <a href={`tel:${tenant.phone}`} className="flex flex-col items-center gap-1.5 shrink-0 w-16 group">
              <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100 shadow-sm group-active:scale-95 transition-transform">
                <Phone className="w-5 h-5 fill-current" />
              </div>
              <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">Klic</span>
            </a>
          )}
          {tenant.whatsapp && (
            <a href={`https://wa.me/${tenant.whatsapp.replace(/\+/g, '')}`} target="_blank" rel="noreferrer" className="flex flex-col items-center gap-1.5 shrink-0 w-16 group">
              <div className="w-12 h-12 rounded-full bg-green-50 text-green-600 flex items-center justify-center border border-green-100 shadow-sm group-active:scale-95 transition-transform">
                <Send className="w-5 h-5" />
              </div>
              <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">WhatsApp</span>
            </a>
          )}
          {tenant.viber && (
            <a href={`viber://chat?number=${tenant.viber.replace(/\+/g, '')}`} className="flex flex-col items-center gap-1.5 shrink-0 w-16 group">
              <div className="w-12 h-12 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center border border-purple-100 shadow-sm group-active:scale-95 transition-transform">
                <Phone className="w-5 h-5 fill-current" />
              </div>
              <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">Viber</span>
            </a>
          )}
          {tenant.instagram && (
            <a href={`https://instagram.com/${tenant.instagram}`} target="_blank" rel="noreferrer" className="flex flex-col items-center gap-1.5 shrink-0 w-16 group">
              <div className="w-12 h-12 rounded-full bg-pink-50 text-pink-600 flex items-center justify-center border border-pink-100 shadow-sm group-active:scale-95 transition-transform">
                <Instagram className="w-5 h-5" />
              </div>
              <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">Instagram</span>
            </a>
          )}
          {tenant.mapQuery && (
            <a href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(tenant.mapQuery)}`} target="_blank" rel="noreferrer" className="flex flex-col items-center gap-1.5 shrink-0 w-16 group">
              <div className="w-12 h-12 rounded-full bg-orange-50 text-orange-600 flex items-center justify-center border border-orange-100 shadow-sm group-active:scale-95 transition-transform">
                <MapPin className="w-5 h-5 fill-current" />
              </div>
              <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">Pot</span>
            </a>
          )}
        </div>

        {/* Content Body */}
        <div className="flex-1 px-5 py-8 space-y-10 pb-24 overflow-y-auto bg-muted/10">
          {visibleSections.map(section => (
            <div key={section.id} className="space-y-5">
              <h2 className="text-[22px] font-extrabold text-foreground flex items-center gap-3 px-1">
                {section.icon && <span className="text-primary bg-primary/10 w-10 h-10 rounded-full flex items-center justify-center"><CategoryIcon name={section.icon} className="h-5 w-5" /></span>}
                {section.title}
              </h2>
              
              <div className="grid gap-5">
                {section.categories?.filter(c => c.isVisible).map(category => (
                  <CategoryRenderer key={category.id} category={category} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function CategoryRenderer({ category }: { category: any }) {
  const items = category.items?.filter((i: any) => i.isVisible) || [];
  if (items.length === 0) return null;

  return (
    <Card className="overflow-hidden border-2 shadow-sm rounded-[26px]">
      <div className="bg-card px-5 py-4 border-b-2 border-border flex items-center gap-3">
        {category.icon && <span className="text-primary"><CategoryIcon name={category.icon} className="h-5 w-5" /></span>}
        <h3 className="font-bold text-lg text-foreground tracking-tight">{category.label}</h3>
      </div>
      <div className="p-0 bg-background">
        {category.layout === 'wifi' && (
          <div className="p-6 space-y-4 bg-primary/5">
            {items.map((item: any) => (
              <div key={item.id} className="bg-background rounded-[20px] p-5 border-2 border-border text-center shadow-sm">
                <Wifi className="w-10 h-10 mx-auto text-primary mb-3" />
                <h4 className="font-bold text-xl mb-1">{item.title}</h4>
                {item.body && <p className="text-lg font-mono tracking-wider font-semibold text-foreground bg-muted py-2 rounded-lg select-all mb-4">{item.body}</p>}
                <Button className="w-full font-bold text-base h-12" onClick={() => {
                  navigator.clipboard.writeText(item.body || '');
                  alert("Kopirano!");
                }}>
                  <Copy className="w-5 h-5 mr-2" /> Kopiraj geslo
                </Button>
              </div>
            ))}
          </div>
        )}
        
        {category.layout === 'rules' && (
          <div className="divide-y-2 divide-border/50">
            {items.map((item: any) => (
              <div key={item.id} className="p-5 flex items-start gap-4 hover:bg-muted/30 transition-colors">
                <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5 border border-primary/20">
                  <Check className="w-4 h-4" strokeWidth={3} />
                </div>
                <div>
                  <h4 className="font-bold text-[17px]">{item.title}</h4>
                  {item.body && <p className="text-[15px] text-muted-foreground mt-1 leading-relaxed">{item.body}</p>}
                </div>
              </div>
            ))}
          </div>
        )}

        {category.layout === 'text' && (
          <div className="p-5 space-y-8">
            {items.map((item: any) => (
              <div key={item.id}>
                {item.title && <h4 className="font-extrabold text-[19px] mb-3 leading-tight">{item.title}</h4>}
                <div className="text-[15px] text-muted-foreground leading-relaxed space-y-4 font-medium">
                  {parseTextBody(item.body)}
                </div>
                {item.media && item.media.length > 0 && (
                  <div className="mt-5 flex overflow-x-auto gap-3 pb-3 -mx-5 px-5 no-scrollbar snap-x">
                    {item.media.map((m: any) => (
                      <img key={m.id} src={m.url} alt={m.alt || ''} className="h-40 w-[280px] rounded-[20px] object-cover shrink-0 snap-center border border-border shadow-sm" />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {category.layout === 'poi' && (
          <div className="divide-y-2 divide-border/50">
            {items.map((item: any) => (
              <div key={item.id} className="p-5 flex flex-col gap-3">
                {item.media?.[0] && (
                  <img src={item.media[0].url} className="w-full h-48 object-cover rounded-[20px] mb-2 border border-border" alt="" />
                )}
                <div>
                  <h4 className="font-extrabold text-[19px] leading-tight">{item.title}</h4>
                  {item.body && <p className="text-[15px] text-muted-foreground mt-1.5 leading-relaxed font-medium">{item.body}</p>}
                </div>
                
                {item.mapQuery && (
                  <a href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(item.mapQuery)}`} target="_blank" rel="noreferrer">
                    <Button variant="secondary" className="w-full mt-2 font-bold bg-muted hover:bg-muted/80 text-foreground border-2 border-border shadow-none">
                      <Map className="w-4 h-4 mr-2" /> Prikaži pot
                    </Button>
                  </a>
                )}
              </div>
            ))}
          </div>
        )}

        {category.layout === 'products' && (
          <div className="divide-y-2 divide-border/50">
            {items.map((item: any) => (
              <div key={item.id} className="p-5 flex gap-4 hover:bg-muted/30 transition-colors">
                {item.media?.[0] && (
                  <img src={item.media[0].url} className="w-24 h-24 object-cover rounded-[18px] shrink-0 border border-border" alt="" />
                )}
                <div className="flex-1 py-1">
                  <h4 className="font-bold text-[17px] leading-tight">{item.title}</h4>
                  {item.price && (
                    <p className="text-primary font-extrabold mt-1 text-lg">
                      {item.price} {item.priceUnit && <span className="text-muted-foreground font-semibold text-sm">/ {item.priceUnit}</span>}
                    </p>
                  )}
                  {item.bullets && item.bullets.length > 0 && (
                    <ul className="text-[13px] text-muted-foreground mt-2.5 space-y-1.5 font-medium">
                      {item.bullets.map((b: string, i: number) => (
                        <li key={i} className="flex gap-2">
                          <span className="text-primary">•</span> <span>{b}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Fallback for other layouts */}
        {['gallery', 'routes', 'events', 'tabs', 'apartments'].includes(category.layout) && (
          <div className="p-5">
            <p className="text-sm text-muted-foreground italic font-medium">Postavitev {category.layout} še ni v celoti optimizirana.</p>
            {items.map((item: any) => (
              <div key={item.id} className="mt-5 border-t-2 pt-5">
                <h4 className="font-bold text-[17px]">{item.title}</h4>
                <div className="text-[15px] mt-1">{parseTextBody(item.body)}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}

function parseTextBody(body: string) {
  if (!body) return null;
  try {
    const parsed = JSON.parse(body);
    if (Array.isArray(parsed)) {
      return parsed.map((p, i) => <p key={i} dangerouslySetInnerHTML={{ __html: p }} />);
    }
  } catch (e) {
    // not json
  }
  return <p dangerouslySetInnerHTML={{ __html: body }} />;
}
