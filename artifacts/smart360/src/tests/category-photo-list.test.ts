import test from "node:test";
import assert from "node:assert/strict";
import { usesPhotoEntryList } from "../lib/category-photo-list";

test("imported generic and rules place lists use entry thumbnails", () => {
  for (const layout of ["", "rules", "poi", "apartments"]) {
    assert.equal(usesPhotoEntryList(layout, [{ media: [{ url: "bled.jpg" }] }, {}]), true);
  }
});
test("single house-rule cover and text-only rules remain documents", () => {
  assert.equal(usesPhotoEntryList("rules", [{ media: [{ url: "cover.jpg" }] }]), false);
  assert.equal(usesPhotoEntryList("rules", [{}, {}]), false);
  assert.equal(usesPhotoEntryList("wifi", [{ media: [{ url: "wifi.jpg" }] }, {}]), false);
});
