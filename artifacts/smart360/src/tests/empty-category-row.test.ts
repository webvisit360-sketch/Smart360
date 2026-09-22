import test from "node:test";
import assert from "node:assert";
import { readFileSync } from "node:fs";
import { categoryAddLabel } from "../components/admin/content-editor";

const editorSource = readFileSync(
  new URL("../components/admin/content-editor.tsx", import.meta.url),
  "utf8",
);
const onboardingSource = readFileSync(
  new URL("../pages/host/onboarding.tsx", import.meta.url),
  "utf8",
);
const emptyRowSource = readFileSync(
  new URL("../components/admin/empty-category-row.tsx", import.meta.url),
  "utf8",
);

test("all section add affordances use their section-specific verb", () => {
  assert.equal(categoryAddLabel("stay"), "Dodaj vnos");
  assert.equal(categoryAddLabel("offer"), "Dodaj ponudbo");
  assert.equal(categoryAddLabel("explore"), "Dodaj kraj");
  assert.equal(categoryAddLabel("services"), "Dodaj kraj");
});

test("the shared compact empty row owns the required dimensions and empty marker", () => {
  assert.match(emptyRowSource, /min-h-\[46px\]/);
  assert.match(emptyRowSource, /rounded-\[10px\]/);
  assert.match(emptyRowSource, /border-\[#E8EBE6\]/);
  assert.match(emptyRowSource, /· prazno/);
});

test("admin and host category lists reuse the compact empty row", () => {
  assert.match(editorSource, /if \(isEmpty\)[\s\S]*?<EmptyCategoryRow/);
  assert.doesNotMatch(editorSource, /if \(isExplore && isEmpty\)/);
  assert.match(onboardingSource, /catRecs\.length === 0 && !transientRec/);
  assert.match(onboardingSource, /<EmptyCategoryRow/);
  assert.match(onboardingSource, /catRecs\.map[\s\S]*?Dodaj kraj/);
  assert.match(onboardingSource, /category\.entries\.length === 0[\s\S]*?<EmptyCategoryRow/);
});