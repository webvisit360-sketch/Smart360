export function buildGuestPath(path: string): string {
  if (typeof window === 'undefined') return path;
  
  const search = window.location.search;
  const sp = new URLSearchParams(search);
  
  const lang = sp.get('lang');
  const preview = sp.get('preview');
  
  const out = new URLSearchParams();
  if (lang) out.set('lang', lang);
  if (preview) out.set('preview', preview);
  
  const q = out.toString();
  return q ? `${path}?${q}` : path;
}
