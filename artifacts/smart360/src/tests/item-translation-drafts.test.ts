import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  buildItemLanguageDrafts,
  changedItemTranslationWrites,
  hasTranslatableMissingItemField,
  mergeMissingItemLanguageDrafts,
} from "../lib/item-translation-drafts";

test("an English-only title can fill a Slovenian draft without overwriting English", () => {
  const drafts = buildItemLanguageDrafts(
    { title: "", description: "" },
    [{
      id: "t-en", model: "item", recordId: "item-1", field: "title",
      lang: "en", value: "Outdoor gym", stale: false,
    }],
  );
  const merged = mergeMissingItemLanguageDrafts(drafts, [
    { language: "sl", title: "Zunanji fitnes", description: null },
    { language: "de", title: "Outdoor-Fitnessbereich", description: null },
    { language: "it", title: "Palestra all'aperto", description: null },
  ]);
  assert.equal(merged.find((draft) => draft.language === "sl")?.title, "Zunanji fitnes");
  assert.equal(merged.find((draft) => draft.language === "en")?.title, "Outdoor gym");
  assert.equal(merged.find((draft) => draft.language === "sl")?.description, "");
});

test("Slovenian title and description fill missing language drafts only", () => {
  const drafts = buildItemLanguageDrafts(
    { title: "Oljčno olje", description: "<p>Domače oljčno olje.</p>" },
    [{
      id: "t-it", model: "item", recordId: "item-1", field: "title",
      lang: "it", value: "Titolo operatore", stale: false,
    }],
  );
  assert.equal(hasTranslatableMissingItemField(drafts), true);
  const merged = mergeMissingItemLanguageDrafts(drafts, [
    { language: "en", title: "Olive oil", description: "<p>Homemade olive oil.</p>" },
    { language: "de", title: "Olivenöl", description: "<p>Hausgemachtes Olivenöl.</p>" },
    { language: "it", title: "Olio d'oliva", description: "<p>Olio d'oliva fatto in casa.</p>" },
  ]);
  assert.equal(merged.find((draft) => draft.language === "it")?.title, "Titolo operatore");
  assert.equal(merged.find((draft) => draft.language === "it")?.description, "<p>Olio d'oliva fatto in casa.</p>");
  assert.equal(merged.find((draft) => draft.language === "en")?.title, "Olive oil");
});

test("empty rich markup is not a source and unchanged drafts produce no writes", () => {
  const rows = [{
    id: "t-en", model: "item", recordId: "item-1", field: "title",
    lang: "en", value: "Existing", stale: false,
  }];
  const drafts = buildItemLanguageDrafts(
    { title: "", description: "<p>&nbsp;</p>" },
    rows,
  );
  assert.equal(hasTranslatableMissingItemField(drafts), true);
  assert.deepEqual(changedItemTranslationWrites("item-1", drafts, drafts, rows), []);
});

test("item editor keeps translation responses scoped and writes translations only in save", () => {
  const source = readFileSync(
    new URL("../components/admin/content-editor.tsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /Prevedi manjkajoče jezike/);
  assert.match(source, /itemEditorIdRef\.current !== scopedItemId/);
  assert.match(source, /mergeMissingItemLanguageDrafts/);
  assert.match(source, /handleSave[\s\S]*changedItemTranslationWrites/);
});