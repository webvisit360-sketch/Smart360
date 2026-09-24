import assert from "node:assert/strict";
import test from "node:test";
import { renderPwaHead } from "../../pwa-head.mjs";

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
});