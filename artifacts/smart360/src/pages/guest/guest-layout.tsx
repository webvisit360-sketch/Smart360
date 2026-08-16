import { ReactNode, useEffect } from "react";
import { IconSprite } from "./IconSprite";
import { useLocation, useRoute, useSearch } from "wouter";
import { useGetPublicTenant } from "@workspace/api-client-react";

// Both themes ship in the main bundle, scoped to html[data-theme="..."] by
// the scope-themes vite plugin. Switching is done purely via the attribute,
// so layout rules are already applied at the very first paint.
import "../../styles/tema-sredozemska.css";
import "../../styles/tema-poteg.css";

export default function GuestLayout({ children }: { children: ReactNode }) {
  const [match1, params1] = useRoute("/:slug");
  const [match2, params2] = useRoute("/:slug/c/:categoryId");
  const slug = match1 ? params1?.slug : (match2 ? params2?.slug : "");

  const searchStr = useSearch();
  const searchParams = new URLSearchParams(searchStr);
  const lang = searchParams.get("lang") || "sl";
  const isPreview = searchParams.get("preview") === "1";

  const { data: tenant, isError } = useGetPublicTenant(
    slug || "", 
    { lang, preview: isPreview },
    // retry: false — an unknown slug must show the 404 immediately, not after
    // three retries of a request that will always 404.
    { query: { enabled: !!slug, retry: false, queryKey: ['getPublicTenant', slug, lang, isPreview] } }
  );

  // Alias canonicalization: an old (renamed) slug resolves to the tenant, but
  // the address bar must always show the current slug — replace, keep the
  // rest of the path and the query string.
  const [location, setLocation] = useLocation();
  useEffect(() => {
    if (!tenant || !slug || tenant.slug === slug) return;
    const rest = location.startsWith(`/${slug}`) ? location.slice(slug.length + 1) : "";
    setLocation(`/${tenant.slug}${rest}${window.location.search}`, { replace: true });
  }, [tenant, slug, location, setLocation]);

  // Per-tenant PWA manifest: "add to home screen" must open THIS accommodation,
  // so scope/start_url are /<slug>/ (served by the API, injected per tenant).
  useEffect(() => {
    if (!tenant || !slug) return;
    const base = (import.meta.env.BASE_URL || "/");
    let link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    if (!link) {
      link = document.createElement("link");
      link.rel = "manifest";
      document.head.appendChild(link);
    }
    // Language rides along: the installed app must open in the guest's language.
    const langQ = lang && lang !== "sl" ? `?lang=${encodeURIComponent(lang)}` : "";
    link.href = `${base}api/public/tenants/${encodeURIComponent(slug)}/manifest.webmanifest${langQ}`;
    let touch = document.querySelector<HTMLLinkElement>('link[rel="apple-touch-icon"]');
    if (!touch) {
      touch = document.createElement("link");
      touch.rel = "apple-touch-icon";
      document.head.appendChild(touch);
    }
    // Tenant's own 180 px icon (derived on upload); Smart360 only as fallback.
    const iconBase =
      tenant.logoSquareUrl && tenant.logoSquareUrl.endsWith("-kvadrat.png")
        ? tenant.logoSquareUrl.replace(/-kvadrat\.png$/, "")
        : null;
    touch.href = iconBase
      ? `${iconBase}-ikona-180.png`
      : `${base}brand/ikona-smart360-180.png`;
  }, [tenant, slug, lang]);

  // Unknown slug → the app's own 404 with a way back. NEVER a default tenant.
  if (isError) {
    return (
      <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "12px", fontFamily: "Jost, system-ui, sans-serif", textAlign: "center", padding: "24px" }}>
        <h1 style={{ fontSize: "22px", fontWeight: 700, margin: 0 }}>Namestitev ni najdena</h1>
        <p style={{ margin: 0, color: "#555" }}>Naslov ne obstaja ali pa nastanitev ni objavljena.</p>
        <a href="https://smart360.info" style={{ color: "#14201F", fontWeight: 700 }}>smart360.info</a>
      </div>
    );
  }

  return (
    <>
      <IconSprite />
      {tenant ? (
        /* Namizni zaslon: en sam ovoj okoli VSEH plasti gostujoče aplikacije.
           Na telefonu .frame ne nosi nobenih slogov; na širokem zaslonu ga
           temi postavita v 430 px stolpec (transform ustvari containing block
           za vse fixed prekrivke, da ostanejo znotraj stolpca). Vse, kar bi se
           sicer dodajalo na document.body, mora v #frame. */
        <div className="frame" id="frame">
          {isPreview && (
            <>
              <style>{`
                .preview-back{position:fixed;top:calc(64px + env(safe-area-inset-top,0px));left:12px;z-index:9999;height:40px;display:inline-flex;align-items:center;gap:8px;padding:0 16px;border-radius:999px;background:#14201F;color:#fff;font:700 13px/1 Jost,system-ui,sans-serif;text-decoration:none;box-shadow:0 4px 0 #0A1211;}
                .preview-back:active{transform:translateY(4px);box-shadow:0 0 0 #0A1211;}
              `}</style>
              <a href="/admin" className="preview-back">← Administracija</a>
            </>
          )}
          {children}
        </div>
      ) : null}
    </>
  );
}
