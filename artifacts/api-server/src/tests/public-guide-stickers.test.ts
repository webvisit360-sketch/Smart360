import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { GetTenantLabelPdfQueryParams, GetPublicTenantLabelPdfQueryParams } from "@workspace/api-zod";

const routes = await readFile(new URL("../routes/publicTenants.ts", import.meta.url), "utf8");
const share = await readFile(new URL("../../../smart360/src/pages/guest/ShareSheet.tsx", import.meta.url), "utf8");
const start = routes.indexOf('router.get("/public/tenants/:slug/label.pdf"');
const end = routes.indexOf('\nrouter.get("/public/tenants/:slug"', start);
const download = routes.slice(start, end);

test("public and admin contracts permit exactly the same two sticker sizes", () => {
  for (const schema of [GetTenantLabelPdfQueryParams, GetPublicTenantLabelPdfQueryParams]) {
    assert.equal(schema.parse({}).size, "large");
    for (const size of ["large", "small"]) assert.equal(schema.parse({ size }).size, size);
    for (const size of ["A6", "medium", "", "LARGE", ["large", "small"], {}, "x".repeat(10000)]) {
      assert.equal(schema.safeParse({ size }).success, false);
    }
  }
});

test("public download is read-only, freshly publication-gated, and uses canonical artwork", () => {
  assert.ok(start > 0 && end > start);
  assert.match(download, /resolveTenantBySlugOrDomain\(slug, req\.headers\.host\)/);
  assert.match(download, /isPublished: tenantsTable\.isPublished/);
  assert.match(download, /innerJoin\(publishedSnapshotsTable/);
  assert.match(download, /if \(!tenant \|\| !tenant\.isPublished \|\| !published\)/);
  assert.match(download, /res\.status\(404\)/);
  assert.ok(download.indexOf("!tenant.isPublished") < download.indexOf("await makeGuideSticker"));
  assert.match(download, /makeGuideSticker\(published\.name, guestUrl\(tenant\.slug\), size\)/);
  assert.match(download, /Cache-Control", "no-store"/);
  assert.match(download, /attachment; filename=/);
  assert.match(download, /type\("application\/pdf"\)\.send\(pdf\)/);
  assert.doesNotMatch(download, /isAuthenticated|req\.query.*preview|db\.(insert|update|delete)|invalidateTenantCache/);
});

test("literal PDF route leaves manifest handler distinct and intact", () => {
  assert.match(routes, /router\.get\(\s*"\/public\/tenants\/:slug\/manifest\.webmanifest"/);
  assert.match(download, /^router\.get\("\/public\/tenants\/:slug\/label\.pdf"/);
});

test("share sheet only downloads two PDFs on explicit click and removes third HTML artwork", () => {
  assert.match(share, /\(\["large", "small"\] as const\)\.map/);
  assert.match(share, /onClick=\{\(\) => downloadSticker\(size\)\}/);
  assert.match(share, /getPublicTenantLabelPdf\(tenant\.slug, \{ size \}\)/);
  assert.match(share, /72\.5 × 110 mm/);
  assert.match(share, /36\.3 × 55 mm/);
  assert.doesNotMatch(share, /printLabel|window\.print|printcard|pc__|logoUrl|A6|useEffect/);
});