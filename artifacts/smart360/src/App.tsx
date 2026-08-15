import { type ReactNode, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import {
  Route,
  Switch,
  useLocation,
  useRoute,
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

const queryClient = new QueryClient();

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
  const [, paramsHome] = useRoute('/:slug');
  const [matchCat, paramsCat] = useRoute('/:slug/c/:categoryId');

  const slug = matchCat ? (paramsCat?.slug ?? '') : (paramsHome?.slug ?? '');
  const categoryId = matchCat ? (paramsCat?.categoryId ?? null) : null;

  const searchStr = useSearch();
  const sp = new URLSearchParams(searchStr);
  const lang = sp.get('lang') || 'sl';
  const isPreview = sp.get('preview') === '1';

  // React Query caches this — GuestLayout already fetched it so this is a synchronous cache hit.
  const { data: tenant } = useGetPublicTenant(
    slug,
    { lang, preview: isPreview },
    { query: { enabled: !!slug, queryKey: ['getPublicTenant', slug, lang, isPreview] } },
  );

  // Swipe theme: one mounted GuestSwipe instance handles both the pager and the detail overlay.
  // categoryId prop changes drive the detail open/close animation via CSS class toggling.
  if (tenant?.theme === 'swipe') {
    return <GuestSwipe tenant={tenant} slug={slug} lang={lang} categoryId={categoryId} />;
  }

  // Mediterranean theme: original route-aware components (they fetch via cache too).
  if (matchCat) return <GuestCategory />;
  return <GuestHome />;
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
  'dev', 'staging', 'g',
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
