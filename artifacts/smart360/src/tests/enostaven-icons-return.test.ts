import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { simpleCategoryIcon } from "../pages/living-guide/simple/simple-tiles";
import { SIMPLE_COPY } from "../pages/living-guide/simple/simple-copy";

test("replacement pictograms follow button names across tenant keys", () => {
  for (const key of ["custom-tenant-category", "apartments", "products"]) {
    assert.equal(simpleCategoryIcon({ key, label: "Apartmaji" }, "stay"), "bed");
    assert.equal(simpleCategoryIcon({ key, label: "Vhodna vrata" }, "stay"), "door");
    assert.equal(simpleCategoryIcon({ key, label: "Domači izdelki" }, "offer"), "bag");
    assert.equal(simpleCategoryIcon({ key, label: "Nastanitev" }, "stay"), "building");
  }
  assert.equal(new Set(["Apartmaji", "Vhodna vrata", "Domači izdelki"].map(label => simpleCategoryIcon({ label }, "stay"))).size, 3);
});

test("supplied replacement SVG paths are preserved exactly and remain distinct", () => {
  const html = readFileSync(new URL("../../../../attached_assets/ikone-gumbov_1792533622088.html", import.meta.url), "utf8");
  const source = readFileSync(new URL("../pages/living-guide/simple/simple-icons.tsx", import.meta.url), "utf8");
  const paths = [...html.matchAll(/<svg viewBox="0 0 24 24"><path d="([^"]+)"([^>]*)\/><\/svg><b>(Apartmaji|Vhodna vrata|Domači izdelki)<\/b>/g)];
  assert.equal(paths.length, 3);
  for (const [, path] of paths) assert.ok(source.includes(`d="${path}"`));
  assert.equal(new Set(paths.map(p => p[1])).size, 3);
  assert.match(source, /door: <path \{\.\.\.E\}/);
  assert.match(source, /bag: <path \{\.\.\.E\}/);
  assert.match(source, /stroke="currentColor"/);
});

test("360 return has accessible labels in all seven languages", () => {
  assert.deepEqual(Object.keys(SIMPLE_COPY.return360).sort(), ["de", "en", "fr", "hr", "it", "nl", "sl"]);
  for (const label of Object.values(SIMPLE_COPY.return360)) assert.ok(label.includes("360") && label.length > 3);
});
