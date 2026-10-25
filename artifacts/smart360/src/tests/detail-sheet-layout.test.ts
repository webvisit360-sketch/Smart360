import assert from "node:assert/strict";
import test from "node:test";
import { detailSheetClass } from "../lib/detail-sheet-layout";

test("photo-less details start at the top instead of reserving a hero", () => {
  for (const media of [undefined, null, []]) {
    assert.equal(detailSheetClass(media), "lg2-detail-sheet lg2-detail-sheet--full-height");
  }
});
test("panorama-only details keep their strip but do not reserve a standard hero", () => {
  assert.equal(detailSheetClass([{kind:"image",isPanorama:true}]),"lg2-detail-sheet lg2-detail-sheet--full-height");
});
test("ordinary photos and videos retain the standard sheet geometry", () => {
  for (const media of [[{kind:"image"}],[{kind:"video",isPanorama:true}],[{kind:"image",isPanorama:true},{kind:"image"}]]) {
    assert.equal(detailSheetClass(media),"lg2-detail-sheet");
  }
});
test("explicit full-height lists stay full-height even with media", () => {
  assert.equal(detailSheetClass([{kind:"image"}],true),"lg2-detail-sheet lg2-detail-sheet--full-height");
});
