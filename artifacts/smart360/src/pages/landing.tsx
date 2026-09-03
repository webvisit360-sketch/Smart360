import { useEffect, type CSSProperties } from "react";
import { useLocation } from "wouter";

const PLATFORM_HOSTS = /(^localhost$|^127\.|\.replit\.dev$|\.replit\.app$|\.repl\.co$)/;
const APEX_HOST = "smart360.info";

/**
 * Temporary apex placeholder. Development also renders this treatment so it
 * can be reviewed without publishing; production platform URLs retain their
 * existing placeholder and tenant custom domains continue to resolve directly
 * to their guest app.
 */
export default function Landing() {
  const [, setLocation] = useLocation();
  const host = window.location.hostname.toLowerCase();
  const showConstructionPage = import.meta.env.DEV || host === APEX_HOST;

  // Tenant custom domains serve the guest app directly from the root URL.
  useEffect(() => {
    if (host === APEX_HOST || PLATFORM_HOSTS.test(host)) return;
    fetch(`${import.meta.env.BASE_URL}api/public/tenants/${encodeURIComponent(host)}`)
      .then((r) => {
        if (r.ok) setLocation(`/${host}`, { replace: true });
      })
      .catch(() => {});
  }, [host, setLocation]);

  if (showConstructionPage) {
    const wordmarkStyle = {
      "--construction-wordmark": `url("${import.meta.env.BASE_URL}brand/logo-smart360-moder.png")`,
    } as CSSProperties;

    return (
      <main className="construction-page" aria-label="Smart360 website under construction">
        <div className="construction-page__brand">
          <img
            className="construction-page__mark"
            src={`${import.meta.env.BASE_URL}brand/smart360-kolobar-temno.svg`}
            alt=""
            aria-hidden="true"
          />
          <span
            className="construction-page__wordmark"
            style={wordmarkStyle}
            aria-label="Smart360"
          />
          <p className="construction-page__message">Website under construction.</p>
        </div>
      </main>
    );
  }

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
