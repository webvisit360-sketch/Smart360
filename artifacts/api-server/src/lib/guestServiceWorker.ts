import { createHash } from "node:crypto";

// No CacheStorage, precache, offline fallback, or response rewriting. Changing
// this template changes the byte-stable script revision on the next API deploy.
const source = (scope: string, version: string) => `
/* Smart360 guest worker ${version}; scope ${scope} */
const scopePath = ${JSON.stringify(scope)};
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.mode !== "navigate" || request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith(scopePath)) return;
  // Only SPA document navigations inside the exact tenant scope. Never handle
  // files, downloads, API, manifests, admin/host or the unslashed alias route.
  if (/\\.[^/]+$/.test(url.pathname) || /\\/(?:api|admin|host)(?:\\/|$)/.test(url.pathname)) return;
  event.respondWith(fetch(request));
});
`;

const revision = createHash("sha256").update(source.toString()).digest("hex").slice(0, 16);

export function renderGuestServiceWorker(slug: string, version = revision): string {
  return source(`/${slug}/`, version);
}