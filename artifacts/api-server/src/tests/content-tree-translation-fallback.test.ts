import assert from "node:assert/strict";
import test from "node:test";
import { applyTranslationFields } from "../lib/contentTree";

test("indexed existing-language body can fill an empty source body", () => {
  const row = { id: "item", title: "", body: "" };
  const merged = applyTranslationFields(row, {
    title: "Existing title",
    "body[0]": "<strong>Existing detail</strong>",
  });
  assert.equal(merged.title, "Existing title");
  assert.deepEqual(JSON.parse(merged.body), [
    "<strong>Existing detail</strong>",
  ]);
});

test("missing translated paragraphs preserve existing source paragraphs", () => {
  const row = {
    id: "item",
    body: "<p>First source</p><p>Second source</p>",
  };
  const merged = applyTranslationFields(row, {
    "body[1]": "Second translated",
  });
  assert.deepEqual(JSON.parse(merged.body), [
    "First source",
    "Second translated",
  ]);
});

test("empty rich markup does not replace meaningful existing content", () => {
  const row = { id: "item", title: "Existing", body: "<p>Existing detail</p>" };
  assert.deepEqual(
    applyTranslationFields(row, { title: "<b></b>", body: "<p>&nbsp;</p>" }),
    row,
  );
});