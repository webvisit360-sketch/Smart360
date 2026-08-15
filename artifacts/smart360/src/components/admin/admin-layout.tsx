import { ReactNode, useEffect } from "react";
import { useGetAdminSession, useAdminLogout } from "@workspace/api-client-react";
import { useLocation, Link } from "wouter";
import { Loader2, LogOut, LayoutDashboard, Settings, User } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AdminLayout({ children }: { children: ReactNode }) {
  const [, setLocation] = useLocation();
  const { data: session, isLoading, isError } = useGetAdminSession();
  
  const logoutMutation = useAdminLogout({
    mutation: {
      onSuccess: () => {
        setLocation("/admin/login");
      }
    }
  });

  const unauthenticated = !isLoading && (isError || !session?.authenticated);
  useEffect(() => {
    if (unauthenticated) setLocation("/admin/login");
  }, [unauthenticated, setLocation]);

  if (isLoading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-muted">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (unauthenticated) {
    return null;
  }

  return (
    <div className="min-h-[100dvh] flex bg-muted/30">
      {/* Sidebar */}
      <aside className="w-64 bg-card border-r border-border hidden md:flex flex-col">
        <div className="h-16 flex items-center px-6 border-b border-border">
          <span className="font-bold text-xl text-primary">Smart360</span>
        </div>
        <div className="flex-1 py-6 px-4 space-y-2">
          <Link href="/admin" className="flex items-center gap-3 px-4 py-3 rounded-xl bg-primary/10 text-primary font-semibold">
            <LayoutDashboard className="h-5 w-5" />
            Nadzorna plošča
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
          <span className="font-bold text-xl text-primary">Smart360</span>
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
