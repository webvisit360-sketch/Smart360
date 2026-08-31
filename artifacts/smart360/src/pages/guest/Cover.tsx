// THE cover. Guest pages (both themes) and the admin live preview render this
// one component — the cover can never look different in the admin than it does
// for a guest, because there is no second implementation.
//
// - Guest usage: <Cover tenant={tenant} lang={lang} coverTop={...} />
// - Admin usage: <Cover tenant={formLikeTenant} edit={{ ...drag handlers }} />
//   The `edit` prop only adds editing affordances (draggable logo with the
//   dashed outline via the existing .is-drag CSS, fixed frame height); it
//   never changes the cover layout itself.
//
// Iron rules apply: no component/icon libraries, inline sprite only.
import type { CSSProperties, ReactNode, RefObject, PointerEvent } from "react";
import { getCoverVars, getLogoVars } from "./cover-vars";
import { imgSrc } from "./img";
import { plural } from "./i18n";
import { virtualTourEmbedUrl } from "@/lib/virtual-tour";

export type CoverEdit = {
  /** Fixed preview height for the swipe cover (guest uses 100dvh). */
  frameHeight?: number;
  logoRef?: RefObject<HTMLImageElement | null>;
  onLogoPointerDown?: (e: PointerEvent<HTMLImageElement>) => void;
  onLogoPointerMove?: (e: PointerEvent<HTMLImageElement>) => void;
  onLogoPointerUp?: (e: PointerEvent<HTMLImageElement>) => void;
};

type CoverProps = {
  /** Tenant record (or the admin form shaped like one). */
  tenant: any;
  lang?: string;
  /** Editing affordances for the admin preview. Absent on the guest page. */
  edit?: CoverEdit;
  /** Swipe theme: the top button row (search/share/globe) — guest only. */
  coverTop?: ReactNode;
  /** Mediterranean theme: overlays inside .hero (heart, 360 pill, hint). */
  heroExtras?: ReactNode;
  /** Mediterranean theme: content after the title block (search field). */
  tcardExtra?: ReactNode;
  /** Swipe theme: extra classes on .cover / .cover__top (e.g. "is-find"). */
  coverClass?: string;
  coverTopClass?: string;
};

function BrandLogo({ tenant, edit }: { tenant: any; edit?: CoverEdit }) {
  if (!tenant.logoUrl) return null;
  return (
    <img
      className={edit ? "brandlogo is-drag" : "brandlogo"}
      id="brandlogo"
      src={imgSrc(tenant.logoUrl, 620)}
      alt={tenant.name || ""}
      ref={edit?.logoRef}
      draggable={false}
      onPointerDown={edit?.onLogoPointerDown}
      onPointerMove={edit?.onLogoPointerMove}
      onPointerUp={edit?.onLogoPointerUp}
      onPointerCancel={edit?.onLogoPointerUp}
      style={edit ? { touchAction: "none" } : undefined}
    />
  );
}

export function Cover({ tenant, lang = "sl", edit, coverTop, heroExtras, tcardExtra, coverClass, coverTopClass }: CoverProps) {
  const cTitle = tenant.coverTitle || tenant.name;
  const cSub = tenant.coverSubtitle || tenant.subtitle;
  const tourUrl = virtualTourEmbedUrl(tenant.tourUrl);
  const reviewCount = Number(tenant.reviewsCount) || 0;
  const ratingValue = Number.parseFloat(String(tenant.rating ?? ""));
  const showRating =
    tenant.coverShowRating !== false &&
    reviewCount >= 1 &&
    Number.isFinite(ratingValue);
  const typeLabels: Record<string, Record<string, string>> = {
    kamp: { sl: "Kamp", en: "Campsite", de: "Campingplatz", it: "Campeggio" },
    hotel: { sl: "Hotel", en: "Hotel", de: "Hotel", it: "Hotel" },
    apartmaji: { sl: "Apartmaji", en: "Apartments", de: "Apartments", it: "Appartamenti" },
  };
  const accommodationType = typeLabels[tenant.tenantType]?.[lang] ?? null;
  const locationMeta = [accommodationType, tenant.creatorOriginRegion].filter(Boolean).join(" · ");
  const rating = (
    <>
      <svg className="ic rating__star" viewBox="0 0 24 24"><use href="#i-star" /></svg>
      <b className="rating__number">{tenant.rating}</b>
      <span className="rating__remainder">· {plural(tenant, lang, "reviews", reviewCount)}</span>
    </>
  );

  if (tenant.theme === "swipe") {
    const style: CSSProperties = { ...getCoverVars(tenant), ...getLogoVars(tenant) };
    if (edit?.frameHeight) style.height = edit.frameHeight;
    return (
      <div className={coverClass ? `cover ${coverClass}` : "cover"} style={style}>
        {tourUrl && !edit ? (
          <iframe src={tourUrl} className="cover__bg" frameBorder="0"></iframe>
        ) : tenant.heroUrl ? (
          <img src={imgSrc(tenant.heroUrl, 1400)} alt="" className="cover__bg" loading="eager" decoding="sync" fetchPriority="high" />
        ) : (
          <div className="cover__bg" style={{ background: "#1e293b" }}></div>
        )}
        <div className="cover__veil"></div>
        {/* Tenant logo on the cover — Smart360 branding lives only in the
            admin and on smart360.info. No logo → nothing rendered. */}
        <BrandLogo tenant={tenant} edit={edit} />
        {coverTop && <div className={coverTopClass ? `cover__top ${coverTopClass}` : "cover__top"}>{coverTop}</div>}
        <div className="cover__txt">
          <h1>{cTitle}</h1>
          {cSub && <p>{cSub}</p>}
          {showRating ? (
            <div className="cover__meta rating">{rating}</div>
          ) : locationMeta ? (
            <div className="cover__meta">{locationMeta}</div>
          ) : null}
        </div>
      </div>
    );
  }

  // Mediterranean: photo card on top, title block (.tcard) below it.
  // Cover text vars (--tt-*, ...) are inherited from an ancestor: the guest
  // page sets them on .app, the admin preview on its frame wrapper.
  return (
    <>
      <div className="hero" style={getLogoVars(tenant)}>
        {tenant.heroUrl ? (
          <img src={imgSrc(tenant.heroUrl, 1400)} alt="" loading="eager" decoding="sync" fetchPriority="high" />
        ) : (
          <div style={{ width: "100%", height: "100%", background: "var(--wash)" }}></div>
        )}
        {/* Tenant logo over the hero photo — see note above. */}
        <BrandLogo tenant={tenant} edit={edit} />
        {heroExtras}
      </div>

      <div className="tcard">
        <h1 className="title">{cTitle}</h1>
        {showRating ? (
          <div className="meta rating">{rating}</div>
        ) : locationMeta ? (
          <div className="sub">{locationMeta}</div>
        ) : null}
        {tcardExtra}
      </div>
    </>
  );
}
