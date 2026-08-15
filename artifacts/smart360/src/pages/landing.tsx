import { useEffect } from "react";
import { useLocation } from "wouter";

const PLATFORM_HOSTS = /(^localhost$|^127\.|\.replit\.dev$|\.replit\.app$|\.repl\.co$)/;

/**
 * Minimal placeholder at smart360.info (naslovi-strank.md §5):
 * wordmark, one sentence, one contact e-mail. No client list, no sign-up,
 * no login link, no link to the admin.
 */
export default function Landing() {
  const [, setLocation] = useLocation();

  // Tenant custom domains serve the guest app directly from the root URL.
  useEffect(() => {
    const host = window.location.hostname;
    if (PLATFORM_HOSTS.test(host)) return;
    fetch(`${import.meta.env.BASE_URL}api/public/tenants/${encodeURIComponent(host)}`)
      .then((r) => {
        if (r.ok) setLocation(`/${host}`, { replace: true });
      })
      .catch(() => {});
  }, [setLocation]);

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-background text-foreground p-6 text-center">
      <div className="max-w-md w-full space-y-4">
        <h1 className="text-5xl font-bold tracking-tight text-primary">Smart360</h1>
        <p className="text-xl text-muted-foreground">Digitalni vodnik za goste vaše nastanitve.</p>
        <p className="text-sm text-muted-foreground">
          <a href="mailto:pi4.doo@gmail.com" className="underline">pi4.doo@gmail.com</a>
        </p>
      </div>
    </div>
  );
}
