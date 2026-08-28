import { ReactNode, useEffect } from "react";
import { useGetAdminSession, useAdminLogout } from "@workspace/api-client-react";
import { useLocation, Link } from "wouter";
import { Loader2, LogOut, LayoutDashboard, Mail, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useHostSession } from "@/hooks/use-host-session";

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
      <div className="min-h-[100dvh] flex items-center justify-center bg-muted">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (unauthenticated) {
    return null;
  }

  const isTenantEdit = location.startsWith("/admin/tenants/");
  if (isTenantEdit) {
    return <div className="min-h-[100dvh] bg-[#F5F5F7] font-sans">{children}</div>;
  }

  if (isHostAccount) {
    return (
      <div className="min-h-[100dvh] bg-muted/30">
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
    <div className="min-h-[100dvh] flex bg-muted/30">
      {/* Sidebar */}
      <aside className="w-64 bg-card border-r border-border hidden md:flex flex-col">
        <div className="h-16 flex items-center px-6 border-b border-border">
          <img src="/brand/logo-smart360-moder.png" alt="Smart360" style={{ height: 26, width: "auto" }} />
        </div>
        <div className="flex-1 py-6 px-4 space-y-2">
          <Link href="/admin" className={`flex items-center gap-3 px-4 py-3 rounded-xl font-semibold ${location === "/admin" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted"}`}>
            <LayoutDashboard className="h-5 w-5" />
            Nadzorna plošča
          </Link>
          <Link href="/admin/enquiries" className={`flex items-center gap-3 px-4 py-3 rounded-xl font-semibold ${location === "/admin/enquiries" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted"}`}>
            <Mail className="h-5 w-5" />
            Povpraševanja
          </Link>
          <Link href="/admin/account" className="flex items-center gap-3 px-4 py-3 rounded-xl text-muted-foreground hover:bg-muted font-medium transition-colors">
            <User className="h-5 w-5" />
            Ključi
          </Link>
        </div>
        <div className="p-4 border-t border-border">
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
      <main className="flex-1 flex flex-col min-w-0">
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
