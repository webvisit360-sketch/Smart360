import assert from "node:assert/strict";
import test from "node:test";
import { guestAliasRedirect, guestTrailingSlashRedirect, renderPwaHead } from "../../pwa-head.mjs";

test("route-specific raw HTML never includes admin install metadata on guest routes", () => {
  const template = '<head><!-- PWA_HEAD --></head>';
  for (const slug of ["meli-pu", "another-published-tenant"]) {
    const html = renderPwaHead(template, `/${slug}/c/deep-link?preview=1`, "smart360.info");
    assert.match(html, new RegExp(`/api/public/tenants/${slug}/manifest.webmanifest`));
    assert.doesNotMatch(html, /href="\/manifest\.webmanifest"|apple-mobile-web-app-title" content="Smart360"/);
  }
  const onDomain = renderPwaHead(template, "/", "guest.example.com");
  assert.match(onDomain, /\/api\/public\/tenants\/guest\.example\.com\/manifest\.webmanifest/);
  assert.doesNotMatch(onDomain, /href="\/manifest\.webmanifest"/);
  assert.match(renderPwaHead(template, "/g/meli-pu/c/deep", "smart360.info"),
    /\/api\/public\/tenants\/meli-pu\/manifest\.webmanifest/);
  assert.match(renderPwaHead(template, "/admin/login", "smart360.info"), /href="\/manifest\.webmanifest"/);
  assert.match(renderPwaHead(template, "/admin/login", "smart360.info"),
    /ikona-smart360-180\.png\?v=crisp-3/);
});

test("old tenant URLs redirect before HTML, preserving deep paths and query strings", async () => {
  const requests: string[] = [];
  let current = "b";
  const lookup = async (url: string, options: { method: string }) => {
    requests.push(`${url} [${options.method}]`);
    const slug = url.split("/").at(-1);
    if (slug === "old-a" || slug === "old-b") {
      return Response.json({ canonicalSlug: current === "b" ? "new-b" : "new-c" });
    }
    return Response.json({ canonicalSlug: null });
  };
  const alias = (url: string) => guestAliasRedirect(url, "smart360.info", "http://api.local", lookup as typeof fetch);
  assert.equal(await alias("/old-a/c/category-42?lang=it&preview=1"), "/new-b/c/category-42?lang=it&preview=1");
  assert.equal(await alias("/g/old-a/c/category-42?lang=de"), "/new-b/c/category-42?lang=de");
  current = "c";
  assert.equal(await alias("/old-a/c/category-42?lang=it"), "/new-c/c/category-42?lang=it");
  assert.equal(await alias("/old-b/"), "/new-c/");
  assert.equal(await alias("/new-c/"), null);
  assert.equal(await alias("/absent/"), null);
  assert.equal(await alias("/admin/login"), null);
  assert.equal(await alias("/"), null);
  assert.equal(requests.length, 6, "non-guest paths must not contact the alias resolver");
  assert.ok(requests.every((entry) => entry.includes("/api/public/slug-redirect/") && entry.includes("[GET]")));
  await assert.rejects(
    () => guestAliasRedirect("/old-a/", "smart360.info", "http://api.local",
      async () => new Response(null, { status: 503 })),
    /Alias lookup failed/,
    "do not silently serve old HTML when the alias resolver is unavailable",
  );
});

test("historical 301 wins over bare-slug 308; reserved and custom-domain root stay untouched", async () => {
  const lookup = async (url: string) => Response.json({
    canonicalSlug: url.endsWith("/old-a") ? "new-b" : null,
  });
  const route = async (url: string, host = "smart360.info") => {
    // Exact ordering used by both Vite and the static HTML middleware.
    const alias = await guestAliasRedirect(url, host, "http://api.local", lookup as typeof fetch);
    if (alias) return { status: 301, location: alias };
    const slash = guestTrailingSlashRedirect(url, host);
    return slash ? { status: 308, location: slash } : null;
  };
  assert.deepEqual(await route("/old-a?lang=it&x=1"),
    { status: 301, location: "/new-b?lang=it&x=1" });
  assert.deepEqual(await route("/old-a/?lang=it&x=1"),
    { status: 301, location: "/new-b/?lang=it&x=1" });
  assert.deepEqual(await route("/new-b?lang=de"),
    { status: 308, location: "/new-b/?lang=de" });
  for (const path of ["/admin", "/portal", "/host", "/api"]) {
    assert.equal(await route(path), null, `${path} must never receive guest slash redirect`);
    assert.equal(guestTrailingSlashRedirect(path, "smart360.info"), null);
  }
  assert.equal(await route("/", "guest.example.com"), null,
    "a custom-domain root is not the canonical manifest scope; never rewrite it");
});