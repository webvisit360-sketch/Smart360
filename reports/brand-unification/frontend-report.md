# Frontend artwork unification

## Scope and preservation

All 15 pre-change public brand assets were copied to `before/brand/` before any owned raster was overwritten. Old rendered samples were captured before generation. No database, publishing, authentication, wordmark, layout or CSS changes were made.

Authoritative source: `artifacts/smart360/public/brand/smart360-kolobar-faceted.svg`, byte-identical throughout. Its missing SVG namespace makes direct browser Image decoding unsuitable; browser consumers use generated PNGs. No alternate vector source was introduced. The offline cache also retains the canonical source URL but no image element uses it.

## Complete owned consumer inventory

The existing 80×80 generic raster is now faceted. Every frontend reference has `?v=faceted-1`:

- `App.tsx`: guest entry splash.
- `components/brand-lockup.tsx`: shared lockup, including login/header consumers.
- `pages/admin/login.tsx`: decorative ring.
- `pages/host/onboarding.tsx`: 46×46 mark.
- `pages/landing.tsx`: mark.
- `pages/living-guide/LivingGuideGuestShell.tsx`: guest mark.
- `pages/guest/guest-load-recovery.tsx`: recovery mark.
- `index.html`: bootstrap recovery now uses the browser-decodable raster instead of the old vector.

`pwa-head.mjs` switches only the favicon cache version to faceted-1. The already-faceted touch icon URL is unchanged. `guestServiceWorker.ts` precaches the versioned generic PNG, canonical SVG and existing faceted-1 home icons; stale crisp-3 URLs and old SVG are removed.

## Raster inventory and exact preservation

`frontend-asset-inventory.json` enumerates all 15 old/current assets, hashes, dimensions, backgrounds and occupied bounds. All occupied bounds remain identical.

- Generic raster 80×80; legacy email marks 60×60 and 138×138: opaque white background and full occupied bounds preserved.
- Favicon 192×192: dark `#121a14` background retained; occupied square remains `[25,25,166,166]`. Rendered at 4× then Lanczos3-downsampled; ringing outside the existing mark square is clipped to preserve exact occupied bounds.
- Legacy email lockup 558×138: only the 138×138 mark square replaced. Every pixel outside that square remains identical.
- `logo-smart360-moder.png`, 1024×186, is exclusively the blue wordmark, not a kolobar. It remains byte-identical.
- All six already-faceted home/maskable icons and canonical SVG remain byte-identical.
- Archived old vector is unchanged, not an active frontend consumer.
- Current host email lockup 594×138 belongs to the separate backend implementation; inventory includes its result but this frontend generator never writes it.

The home-icon generator now reads the canonical checked-in SVG rather than extracting historical HTML, and no longer writes the source SVG. It was not run, preserving existing home icons.

## Browser evidence and invariants

`before/frontend-{splash,login,header,favicon}.png` and matching `after/` files are native 100% DPR-1 screenshots. Their self-contained HTML fixtures are retained alongside. Fixtures are explicitly labeled **isolated source-derived, not authenticated**. Splash uses the actual App JSX extracted from source; header uses actual BrandLockup JSX rendered through React; login evidence uses its actual brand/header markup and CSS but intentionally omits the form. Favicon samples render at 16px and 32px.

`frontend-layout-invariants.json` confirms identical computed image/text rectangles, fonts, letter spacing, backgrounds, transforms and animation declarations before/after. Animations are paused at the same 1800ms for evidence only; production splash rotation and exact slogan CSS were not edited. Every fixture image passed browser `decode()`.

`after/public-login-preview.jpg` additionally shows the already-running public login route, without signing in. Authenticated admin/guest screens were not rendered or verified.

## Validation

Focused tests cover canonical raster generation, dark favicon composition, unchanged home icons/wordmark/source, legacy lockup pixel preservation, home-icon pipeline, offline lifecycle/precache URLs and PWA favicon version. Generation and fixtures are reproducible with `node artifacts/api-server/scripts/brand-unification-frontend.mjs before|generate|after|audit`; use preserved `before/brand` for old evidence.