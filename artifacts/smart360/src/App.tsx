import { lazy, Suspense, type CSSProperties, type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import {
  Route,
  Switch,
  useLocation,
  useSearch,
  Router as WouterRouter,
} from 'wouter';
import { useGetPublicTenant } from '@workspace/api-client-react';

import Landing from '@/pages/landing';
import { AdminRouter } from '@/components/admin/admin-router';
import GuestHome from '@/pages/guest/guest-home';
import GuestCategory from '@/pages/guest/guest-category';
import GuestLayout from '@/pages/guest/guest-layout';
import { GuestSwipe } from '@/pages/guest/GuestSwipe';
import { resolveLang, rememberLang, applyDocumentLang, clampLang } from '@/pages/guest/i18n';
import { usePageBg } from '@/pages/guest/use-theme-attr';
import { useBundleFreshness } from '@/lib/bundle-freshness';
import { PasswordTokenPage } from '@/pages/portal/password-token-page';

const queryClient = new QueryClient();
const LivingGuideTokensPage = lazy(
  () => import('@/pages/living-guide/LivingGuideTokensPage'),
);
const LivingGuideGuestShell = lazy(
  () => import('@/pages/living-guide/LivingGuideGuestShell'),
);

function GuestEntrySplash({ ready }: { ready: boolean }) {
  const startedAtRef = useRef(performance.now());
  const [phase, setPhase] = useState<'visible' | 'out' | 'gone'>('visible');
  const exitTimerRef = useRef<number | null>(null);

  const hide = useCallback(() => {
    setPhase((current) => {
      if (current !== 'visible') return current;
      exitTimerRef.current = window.setTimeout(() => setPhase('gone'), 420);
      return 'out';
    });
  }, []);

  useEffect(() => {
    const safetyTimer = window.setTimeout(hide, 3_200);
    return () => {
      window.clearTimeout(safetyTimer);
      if (exitTimerRef.current !== null) {
        window.clearTimeout(exitTimerRef.current);
      }
    };
  }, [hide]);

  useEffect(() => {
    if (!ready) return;
    const remaining = Math.max(0, 2_500 - (performance.now() - startedAtRef.current));
    const intendedTimer = window.setTimeout(hide, remaining);
    return () => window.clearTimeout(intendedTimer);
  }, [hide, ready]);

  if (phase === 'gone') return null;

  const wordmarkStyle = {
    '--guest-splash-wordmark': `url("${import.meta.env.BASE_URL}brand/logo-smart360-moder.png")`,
  } as CSSProperties;

  return (
    <div
      className={`guest-entry-splash${phase === 'out' ? ' is-out' : ''}`}
      role="status"
      aria-label="Smart360 Digitalni vodnik"
      onClick={hide}
    >
      <span className="guest-entry-splash__mark" aria-hidden="true">
        <img
          src={`${import.meta.env.BASE_URL}brand/smart360-kolobar-temno.svg`}
          alt=""
        />
      </span>
      <span
        className="guest-entry-splash__wordmark"
        style={wordmarkStyle}
        aria-hidden="true"
      />
      <span className="guest-entry-splash__subtitle">Digitalni vodnik</span>
    </div>
  );
}

/**
 * GuestHost — single component rendered for ALL guest paths (/:slug and /:slug/c/:categoryId).
 *
 * For the swipe theme this component stays mounted as the user navigates between those two paths
 * (because they share the same parent Route "/:slug*"), so the .detail overlay can animate in/out
 * via CSS transitions rather than mounting already-open.
 *
 * For the Mediterranean theme we fall back to the original GuestHome / GuestCategory components
 * which handle their own data fetching and loading states.
 */
function GuestHost() {
  // Stale-bundle self-recovery for ALL guest UI modes (Living Guide and
  // legacy themes). Reloads once, silently, when a newer build is live —
  // never while an order/sign-in flow is open or a draft is typed.
  useBundleFreshness();
  const [location] = useLocation();
  const segments = location.split('/').filter(Boolean);
  const slug = segments[0] ? decodeURIComponent(segments[0]) : '';
  const isCategoryPath = segments[1] === 'c' && !!segments[2];
  const categoryId = isCategoryPath ? decodeURIComponent(segments[2]!) : null;
  const searchStr = useSearch();
  const sp = new URLSearchParams(searchStr);
  // ?lang → remembered choice → browser language → Slovene. Filtering by
  // tenant.languages happens once the tenant arrives (effect below).
  const rawLang = resolveLang(slug, sp.get('lang'), null);
  const isPreview = sp.get('preview') === '1';
  const livingGuidePreview =
    import.meta.env.DEV && sp.get('ui') === 'living-guide';
  const [livingGuideLang, setLivingGuideLang] = useState(rawLang);
  const [guestAppReady, setGuestAppReady] = useState(false);
  const signalGuestAppReady = useCallback(() => setGuestAppReady(true), []);

  useEffect(() => {
    setLivingGuideLang(rawLang);
  }, [rawLang, slug]);

  // Keep one query language state for both the development preview and the
  // published Living Guide. The in-shell selector updates history via
  // replaceState, so its state — not only wouter's search snapshot — must drive
  // the translated tenant-content request.
  const queryLang = livingGuideLang;

  // React Query caches this — GuestLayout already fetched it so this is a synchronous cache hit.
  const { data: tenant } = useGetPublicTenant(
    slug,
    { lang: queryLang, preview: isPreview },
    {
      query: {
        enabled: !!slug,
        queryKey: ['getPublicTenant', slug, queryLang, isPreview],
        placeholderData: (previousTenant) =>
          previousTenant?.slug === slug ? previousTenant : undefined,
      },
    },
  );
  // Once the tenant is known, an un-enabled language silently becomes Slovene
  // (the server already refuses to serve content for it).
  const lang = tenant ? clampLang(queryLang, tenant.languages) : queryLang;

  const changeLivingGuideLanguage = useCallback((nextLang: string) => {
    if (!['sl', 'en', 'de', 'it'].includes(nextLang)) return;

    rememberLang(slug, nextLang);
    setLivingGuideLang(nextLang);

    const nextSearch = new URLSearchParams(window.location.search);
    nextSearch.set('lang', nextLang);
    const query = nextSearch.toString();
    window.history.replaceState(
      window.history.state,
      '',
      `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`,
    );
  }, [slug]);

  // Living Guide is active when: (a) the dev ?ui=living-guide preview flag is
  // set, or (b) the server reports guestUiMode='living-guide' for this tenant.
  const isLivingGuideMode =
    livingGuidePreview || (tenant != null && tenant.guestUiMode === 'living-guide');

  useEffect(() => {
    if (tenant != null && !isLivingGuideMode) signalGuestAppReady();
  }, [isLivingGuideMode, signalGuestAppReady, tenant]);

  // EDINI vir resnice za barvo ozadja (pike-brisanje-ozadje.md, točka 4):
  // shranjena barva namestitve, uporabljena TU in nikjer drugje. data-dark se
  // izpelje iz nje v istem trenutku (usePageBg). Nobena podkomponenta ne sme
  // ne uporabljati ne predpomniti te vrednosti — prej so jo GuestSwipe,
  // GuestHome in GuestCategory nanašali vsak zase, vsak iz svoje (lahko
  // zastarele) predpomnjene kopije najemnika.
  usePageBg(tenant?.bgColor);

  // <html lang> + hreflang alternates follow the active language.
  useEffect(() => {
    if (!tenant) return;
    applyDocumentLang(lang, slug, tenant.languages);
    if (sp.get('lang')) rememberLang(slug, lang);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenant, lang, slug]);

  // Living Guide: server-returned guestUiMode takes precedence for published
  // tenants. In development the ?ui=living-guide preview override still works
  // so the operator can preview the mode before publishing it.
  if (isLivingGuideMode && tenant != null) {
    return (
      <>
        <GuestEntrySplash ready={guestAppReady} />
        <Suspense fallback={null}>
          <LivingGuideGuestShell
            tenant={tenant}
            slug={slug}
            lang={lang}
            onLanguageChange={changeLivingGuideLanguage}
            onReady={signalGuestAppReady}
          />
        </Suspense>
      </>
    );
  }

  // Swipe theme: one mounted GuestSwipe instance handles both the pager and the detail overlay.
  // categoryId prop changes drive the detail open/close animation via CSS class toggling.
  if (tenant?.theme === 'swipe') {
    return (
      <>
        <GuestEntrySplash ready={guestAppReady} />
        <GuestSwipe tenant={tenant} slug={slug} lang={lang} categoryId={categoryId} />
      </>
    );
  }

  // Mediterranean theme: original route-aware components (they fetch via cache too).
  return (
    <>
      <GuestEntrySplash ready={guestAppReady} />
      {isCategoryPath ? <GuestCategory /> : <GuestHome />}
    </>
  );
}

/**
 * Client-side mirror of the server's reserved-word list (lib/slug.ts).
 * A reserved first segment is never a tenant — it renders the app 404.
 */
const RESERVED_SEGMENTS = new Set([
  'admin', 'api', 'app', 'assets', 'static', 'media', 'files', 'uploads',
  'img', 'css', 'js', 'fonts', 'robots.txt', 'sitemap.xml', 'favicon.ico',
  'manifest.json', 'sw.js', 'health', 'status', 'login', 'auth', 'logout',
  'account', 'my', 'help', 'support', 'docs', 'blog', 'about', 'contact',
  'privacy', 'terms', 'www', 'mail', 'cdn', 'preview', 'test', 'demo',
  'dev', 'staging', 'g', 'portal',
]);
const SLUG_SHAPE = /^[a-z0-9](?:[a-z0-9-]{1,38})[a-z0-9]$/;

/**
 * Legacy address migration: /g/<slug>/... permanently redirects to /<slug>/...
 * preserving the rest of the path and the query string. The app is never
 * rendered at the old address.
 */
function LegacyGRedirect() {
  const [location, setLocation] = useLocation();
  useEffect(() => {
    const target = location.replace(/^\/g(\/|$)/, '/');
    setLocation((target || '/') + window.location.search, { replace: true });
  }, [location, setLocation]);
  return null;
}

function GuestRoute({ slug }: { slug: string }) {
  const seg = decodeURIComponent(slug).toLowerCase();
  // Reserved words and malformed segments are never tenants.
  if (RESERVED_SEGMENTS.has(seg) || !SLUG_SHAPE.test(seg)) return <NotFound />;
  return (
    <GuestLayout>
      <GuestHost />
    </GuestLayout>
  );
}

function Router() {
  return (
    <RoutedErrorBoundary>
      <Switch>
        <Route path="/" component={Landing} />
        <Route path="/admin" component={AdminRouter} />
        <Route path="/admin/*" component={AdminRouter} />
        <Route path="/portal/povabilo">
          <PasswordTokenPage mode="invite" />
        </Route>
        <Route path="/portal/ponastavitev">
          <PasswordTokenPage mode="reset" />
        </Route>

        {/* Isolated Part 1 design-system proof. It intentionally bypasses GuestLayout,
            legacy theme CSS and tenant data. */}
        <Route path="/__living-guide/tokens">
          <Suspense fallback={null}>
            <LivingGuideTokensPage />
          </Suspense>
        </Route>

        {/* Legacy /g/ prefix: permanent client redirect to the canonical short path. */}
        <Route path="/g/*?" component={LegacyGRedirect} />

        {/* Single wildcard route for all guest paths so GuestHost (and GuestSwipe for the swipe
            theme) stays mounted when navigating between /:slug and /:slug/c/:categoryId.
            /:slug/*? uses wouter's optional wildcard — matches "/slug" and "/slug/c/catId". */}
        <Route path="/:slug/*?">
          {(params) => <GuestRoute slug={params.slug ?? ''} />}
        </Route>

        <Route component={NotFound} />
      </Switch>
    </RoutedErrorBoundary>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL?.replace(/\/$/, '') || ''}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
