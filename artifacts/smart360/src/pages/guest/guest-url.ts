export function buildGuestPath(path: string): string {
  if (typeof window === 'undefined') return path;
  
  const search = window.location.search;
  const sp = new URLSearchParams(search);
  
  const lang = sp.get('lang');
  const preview = sp.get('preview');
  const ui = sp.get('ui');
  const theme = sp.get('theme');
  
  const out = new URLSearchParams();
  if (lang) out.set('lang', lang);
  if (preview) out.set('preview', preview);
  if (ui) out.set('ui', ui);
  if (theme) out.set('theme', theme);
  
  const q = out.toString();
  return q ? `${path}?${q}` : path;
}
