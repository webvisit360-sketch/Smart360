// Shared by the production static server and Vite's dev HTML middleware.
// Classify before sending HTML: the browser must never discover /admin's
// manifest while parsing a guest document (React effects run too late).
const RESERVED = new Set([
  "admin", "api", "app", "assets", "static", "media", "files", "uploads",
  "img", "css", "js", "fonts", "health", "status", "login", "auth", "logout",
  "account", "my", "help", "support", "docs", "blog", "about", "contact",
  "privacy", "terms", "www", "mail", "cdn", "preview", "test", "demo",
  "dev", "staging", "g", "portal", "povprasevanje", "pogoji", "zasebnost",
  "__living-guide",
]);
const PLATFORM_HOSTS = /(^localhost$|^127\.|\.replit\.dev$|\.replit\.app$|\.repl\.co$)/;
const SLUG = /^[a-z0-9](?:[a-z0-9-]{1,38})[a-z0-9]$/;

function escapeHtml(value) {
  return value.replace(/[&"'<>]/g, (ch) => ({
    "&": "&amp;", '"': "&quot;", "'": "&#39;", "<": "&lt;", ">": "&gt;",
  })[ch]);
}

export function guestSlugForRequest(url, host) {
  const { pathname } = new URL(url, "http://localhost");
  let first;
  let legacy;
  try {
    const segments = pathname.split("/").filter(Boolean);
    first = decodeURIComponent(segments[0] ?? "").toLowerCase();
    legacy = first === "g" ? decodeURIComponent(segments[1] ?? "").toLowerCase() : null;
  }
  catch { return null; }
  // Legacy /g/:slug redirects on the client, but its initial parser must
  // still never see the admin installation while waiting for that redirect.
  if (legacy && SLUG.test(legacy) && !RESERVED.has(legacy)) return legacy;
  if (SLUG.test(first) && !RESERVED.has(first)) return first;
  // A tenant's own domain opens at / and the existing landing route resolves
  // that host to its tenant. The manifest endpoint also resolves by Host.
  const hostname = (host ?? "").split(":")[0].toLowerCase();
  if (pathname === "/" && hostname && hostname !== "smart360.info" &&
      !PLATFORM_HOSTS.test(hostname)) return hostname;
  return null;
}

export function renderPwaHead(html, url, host, base = "/") {
  const slug = guestSlugForRequest(url, host);
  const prefix = base.endsWith("/") ? base : `${base}/`;
  const touch = `<link rel="apple-touch-icon" sizes="180x180" href="${escapeHtml(prefix)}brand/ikona-smart360-180.png?v=crisp-2" />`;
  const icon = `<link rel="icon" type="image/png" sizes="192x192" href="${escapeHtml(prefix)}brand/ikona-smart360-192.png?v=crisp-2" />`;
  const { searchParams } = new URL(url, "http://localhost");
  const lang = searchParams.get("lang");
  const langQuery = lang && /^(sl|en|de|it)$/.test(lang) && lang !== "sl"
    ? `?lang=${lang}` : "";
  const head = slug
    ? `<title>Vodnik za goste</title>
    <link rel="manifest" href="${escapeHtml(prefix)}api/public/tenants/${encodeURIComponent(slug)}/manifest.webmanifest${langQuery}" />
    ${touch}
    ${icon}`
    : `<title>Smart360</title>
    <meta name="apple-mobile-web-app-title" content="Smart360" />
    <meta name="application-name" content="Smart360" />
    <link rel="manifest" href="${escapeHtml(prefix)}manifest.webmanifest" />
    ${touch}
    ${icon}`;
  return html.replace("<!-- PWA_HEAD -->", head);
}