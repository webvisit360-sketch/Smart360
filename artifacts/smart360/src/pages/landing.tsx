import { useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";

const PLATFORM_HOSTS = /(^localhost$|^127\.|\.replit\.dev$|\.replit\.app$|\.repl\.co$)/;

export default function Landing() {
  const [, setLocation] = useLocation();

  // Tenant custom domains serve the guest app directly from the root URL.
  useEffect(() => {
    const host = window.location.hostname;
    if (PLATFORM_HOSTS.test(host)) return;
    fetch(`${import.meta.env.BASE_URL}api/public/tenants/${encodeURIComponent(host)}`)
      .then((r) => {
        if (r.ok) setLocation(`/g/${host}`, { replace: true });
      })
      .catch(() => {});
  }, [setLocation]);

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-background text-foreground p-6 text-center">
      <div className="max-w-md w-full space-y-8">
        <div className="space-y-4">
          <h1 className="text-5xl font-bold tracking-tight text-primary">Smart360</h1>
          <p className="text-xl text-muted-foreground">Digitalni vratar za vaše goste.</p>
        </div>
        
        <div className="space-y-4 pt-8">
          <Link href="/g/meli-pu" className="block">
            <Button className="w-full text-lg h-14" size="lg">
              Poglej demo (Gost)
            </Button>
          </Link>
          <Link href="/admin" className="block">
            <Button variant="outline" className="w-full text-lg h-14" size="lg">
              Upraviteljska plošča
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
