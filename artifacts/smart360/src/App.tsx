import { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import {
  Route,
  Switch,
  useLocation,
  Router as WouterRouter,
} from 'wouter';

import Landing from '@/pages/landing';
import { AdminRouter } from '@/components/admin/admin-router';
import GuestHome from '@/pages/guest/guest-home';
import GuestCategory from '@/pages/guest/guest-category';
import GuestLayout from '@/pages/guest/guest-layout';

const queryClient = new QueryClient();

function Router() {
  return (
    <RoutedErrorBoundary>
      <Switch>
        <Route path="/" component={Landing} />
        <Route path="/admin" component={AdminRouter} />
        <Route path="/admin/*" component={AdminRouter} />
        
        <Route path="/g/:slug">
          {() => (
            <GuestLayout>
              <GuestHome />
            </GuestLayout>
          )}
        </Route>
        <Route path="/g/:slug/c/:categoryId">
          {() => (
            <GuestLayout>
              <GuestCategory />
            </GuestLayout>
          )}
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
