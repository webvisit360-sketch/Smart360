import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  buildItemLanguageDrafts,
  changedItemTranslationWrites,
  draftsForItemTranslationRefresh,
  hasTranslatableMissingItemField,
  itemTranslationRefreshFields,
  mergeItemTranslationRefresh,
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
  assert.match(source, /Posodobi prevode/);
  assert.match(source, /itemEditorIdRef\.current !== scopedItemId/);
  assert.match(source, /sourceDraftRef\.current !== scopedSource/);
  assert.match(source, /translationDraftsRef\.current/);
  assert.match(source, /requested\?\.\[entry\.field\] === live\?\.\[entry\.field\]/);
  assert.match(source, /ročno spremenjeni prevodi niso bili prepisani/);
  assert.match(source, /handleSave[\s\S]*changedItemTranslationWrites/);
});

test("unsaved Slovenian edits immediately refresh populated targets from only the current source", () => {
  const rows = [
    { id: "en-title", model: "item", recordId: "item-1", field: "title", lang: "en", value: "Old EN", stale: false },
    { id: "de-title", model: "item", recordId: "item-1", field: "title", lang: "de", value: "Alt DE", stale: false },
    { id: "it-title", model: "item", recordId: "item-1", field: "title", lang: "it", value: "Vecchio IT", stale: false },
  ];
  const drafts = buildItemLanguageDrafts(
    { title: "Nov naslov", description: "" },
    rows,
  );
  const refresh = itemTranslationRefreshFields(
    { title: "Star naslov", description: "" },
    drafts,
    rows,
  );
  assert.equal(refresh.length, 3);
  assert.ok(refresh.every((entry) => entry.field === "title" && entry.stale && !entry.missing));
  const request = draftsForItemTranslationRefresh(drafts, refresh);
  assert.equal(request.find((draft) => draft.language === "sl")?.title, "Nov naslov");
  assert.ok(request.filter((draft) => draft.language !== "sl").every((draft) => draft.title === ""));
  const merged = mergeItemTranslationRefresh(drafts, [
    { language: "en", title: "New EN", description: null },
    { language: "de", title: "Neu DE", description: null },
    { language: "it", title: "Nuovo IT", description: null },
  ], refresh);
  assert.equal(merged.find((draft) => draft.language === "en")?.title, "New EN");
});

test("persisted stale fields refresh after reopen while fresh populated fields stay protected", () => {
  const rows = [
    { id: "en-title", model: "item", recordId: "item-1", field: "title", lang: "en", value: "Old EN", stale: true },
    { id: "de-title", model: "item", recordId: "item-1", field: "title", lang: "de", value: "Manual DE", stale: false },
  ];
  const drafts = buildItemLanguageDrafts({ title: "Naslov", description: "" }, rows);
  const refresh = itemTranslationRefreshFields(
    { title: "Naslov", description: "" },
    drafts,
    rows,
  );
  assert.deepEqual(
    refresh.map(({ language, field, missing, stale }) => ({ language, field, missing, stale })),
    [
      { language: "en", field: "title", missing: false, stale: true },
      { language: "it", field: "title", missing: true, stale: false },
    ],
  );
});

test("a generated identical value is still written so save can clear its stale flag", () => {
  const rows = [
    { id: "en-title", model: "item", recordId: "item-1", field: "title", lang: "en", value: "Same", stale: true },
  ];
  const drafts = buildItemLanguageDrafts({ title: "Naslov", description: "" }, rows);
  const refresh = itemTranslationRefreshFields(
    { title: "Naslov", description: "" },
    drafts,
    rows,
  ).filter((entry) => entry.language === "en");
  assert.deepEqual(
    changedItemTranslationWrites("item-1", drafts, drafts, rows, refresh),
    [{ model: "item", recordId: "item-1", field: "title", lang: "en", value: "Same" }],
  );
});