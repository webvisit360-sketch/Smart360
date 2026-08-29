import { ReactNode, useEffect } from "react";
import { useGetAdminSession, useAdminLogout } from "@workspace/api-client-react";
import { useLocation, Link } from "wouter";
import { Loader2, LogOut } from "lucide-react";
import { AdminButton as Button } from "@/components/ui/button";
import { useHostSession } from "@/hooks/use-host-session";
import { AdminSidebarIcon, AdminSidebarLockup } from "@/components/admin/admin-sidebar-brand";

export default function AdminLayout({ children }: { children: ReactNode }) {
  const [location, setLocation] = useLocation();
  const { data: session, isLoading, isError } = useGetAdminSession();
  const { data: hostSession, isLoading: hostLoading } = useHostSession();
  
  const logoutMutation = useAdminLogout({
    mutation: {
      onSuccess: () => {
        setLocation("/admin/login");
      }
    }
  });

  const ownerAuthenticated = !isError && Boolean(session?.authenticated);
  const hostAuthenticated = Boolean(hostSession?.authenticated && hostSession.tenantId);
  const authLoading = isLoading || hostLoading;
  const unauthenticated = !authLoading && !ownerAuthenticated && !hostAuthenticated;
  const hostTenantPath = `/admin/tenants/${hostSession?.tenantId ?? ""}`;
  const isHostAccount = hostAuthenticated && location === "/admin/account";
  useEffect(() => {
    if (unauthenticated) setLocation("/admin/login");
    if (
      !authLoading &&
      hostAuthenticated &&
      location !== hostTenantPath &&
      location !== "/admin/account"
    ) {
      setLocation(hostTenantPath);
    }
  }, [authLoading, hostAuthenticated, hostTenantPath, location, unauthenticated, setLocation]);

  if (authLoading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-muted" data-surface="admin">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (unauthenticated) {
    return null;
  }

  const isTenantEdit = location.startsWith("/admin/tenants/");
  if (isTenantEdit) {
    return <div className="min-h-[100dvh] font-sans" data-surface="admin">{children}</div>;
  }

  if (isHostAccount) {
    return (
      <div className="min-h-[100dvh] bg-muted/30" data-surface="admin">
        <header className="h-16 bg-card border-b border-border flex items-center justify-between px-5">
          <img src="/brand/logo-smart360-moder.png" alt="Smart360" style={{ height: 26, width: "auto" }} />
          <Button variant="outline" onClick={() => setLocation(hostTenantPath)} data-testid="button-back-to-tenant">
            Nazaj na nastanitev
          </Button>
        </header>
        <main>{children}</main>
      </div>
    );
  }

  // A host is centrally redirected to their tenant or account page above.
  // Never render owner cockpit navigation during that transition.
  if (hostAuthenticated) return null;

  return (
    <div className="admin-shell" data-surface="admin">
      {/* Sidebar */}
      <aside className="admin-shell__sidebar admin-sidebar hidden md:flex">
        <AdminSidebarLockup />
        <div className="admin-shell__nav admin-sidebar__nav flex-1">
          <Link href="/admin" aria-current={location === "/admin" ? "page" : undefined} className="admin-sidebar__item">
            <AdminSidebarIcon name="dashboard" />
            Nadzorna plošča
          </Link>
          <Link href="/admin/enquiries" aria-current={location === "/admin/enquiries" ? "page" : undefined} className="admin-sidebar__item">
            <AdminSidebarIcon name="enquiries" />
            Povpraševanja
          </Link>
          <Link href="/admin/account" aria-current={location === "/admin/account" ? "page" : undefined} className="admin-sidebar__item">
            <AdminSidebarIcon name="keys" />
            Ključi
          </Link>
        </div>
        <div className="admin-shell__footer">
          <Button 
            variant="ghost" 
            className="w-full justify-start text-muted-foreground"
            onClick={() => logoutMutation.mutate()}
            disabled={logoutMutation.isPending}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Odjava
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="admin-shell__main flex flex-col">
        <header className="h-16 bg-card border-b border-border flex items-center justify-between px-6 md:hidden">
          <img src="/brand/logo-smart360-moder.png" alt="Smart360" style={{ height: 26, width: "auto" }} />
          <Button variant="ghost" size="icon" onClick={() => logoutMutation.mutate()}>
            <LogOut className="h-5 w-5 text-muted-foreground" />
          </Button>
        </header>
        <div className="flex-1 overflow-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
