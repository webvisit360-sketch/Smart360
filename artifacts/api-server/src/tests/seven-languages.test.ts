import test from "node:test";
import assert from "node:assert/strict";
import { GUIDE_LANGUAGES } from "@workspace/guide-languages";
import { publishedLanguageTree } from "../lib/publishedLanguageFallback";
import { guestOfflineConfig } from "../lib/guestServiceWorker";
import type { PublishedContent } from "../lib/publishedSnapshots";

test("old snapshots support new languages without reading drafts or adding hidden structure", () => {
  const row = (title: string, body: string) => ({
    name: title, sections: [{ id: "s", title, categories: [{ id: "c", label: title, items: [{ id: "i", title, body, bullets: [] }] }] }],
  });
  const snapshot = { languages: {
    sl: { tree: row("Slovensko", "Izvirnik"), ui: {}, plurals: {} },
    en: { tree: row("English", "English body"), ui: {}, plurals: {} },
    fr: { tree: row("", "<p>&nbsp;</p>"), ui: {}, plurals: {} },
  }, guestAccess: { orderPassword: null } } as unknown as PublishedContent;
  for (const lang of ["fr", "nl", "hr"]) {
    const tree = publishedLanguageTree(snapshot, lang)!;
    assert.equal(tree.name, "English");
    assert.equal(tree.sections[0]!.categories[0]!.items[0]!.body, "English body");
  }
  assert.equal(snapshot.languages.fr!.tree.name, "", "snapshot must not be mutated");
  snapshot.languages.en!.tree.sections[0]!.categories[0]!.items[0]!.body = "";
  assert.equal(publishedLanguageTree(snapshot, "fr")!.sections[0]!.categories[0]!.items[0]!.body, "Izvirnik");
});
test("offline warm language list comes from registry even with a Slovenian-only old snapshot", () => {
  const config = guestOfflineConfig("tenant", "fixture", { sl: { tree: {} } }, "2026-01-01");
  assert.deepEqual(config.languages, GUIDE_LANGUAGES);
  assert.equal(config.languages.length, 7);
});