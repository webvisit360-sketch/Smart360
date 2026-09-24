import assert from "node:assert/strict";
import test from "node:test";
import { comparePublications, type PublishedContent } from "../lib/publishedSnapshots";
import { collectStorageReferenceKeys } from "../lib/mediaCleanup";
import { resolvePublishedOrderItem } from "../routes/orders";
import { validSectionGroupOrder } from "../routes/adminContent";

function publication(items: Array<Record<string, unknown>> = []): PublishedContent {
  const tree = { id: "tenant", sections: [{
    id: "section", title: "Okolica", categories: [{ id: "category", label: "Narava", items }],
  }] };
  return {
    languages: Object.fromEntries(["sl", "en", "de", "it"].map((language) =>
      [language, { tree: structuredClone(tree), ui: {}, plurals: {} }])),
    guestAccess: { orderPassword: "old-password" },
  } as unknown as PublishedContent;
}
function items(value: PublishedContent, language = "sl") {
  return value.languages[language]!.tree.sections[0]!.categories[0]!.items;
}

test("section tab-order API accepts exactly the canonical keys once, and only in offer/stay", () => {
  const offer = ["najem", "izleti_prevozi", "domaci_izdelki", "pri_hisi"];
  const stay = ["vase_bivanje", "prihod_dostop", "prakticno"];
  assert.equal(validSectionGroupOrder("offer", [...offer].reverse()), true);
  assert.equal(validSectionGroupOrder("stay", [...stay].reverse()), true);
  assert.equal(validSectionGroupOrder("offer", null), true);
  assert.equal(validSectionGroupOrder("offer", offer.slice(1)), false);
  assert.equal(validSectionGroupOrder("offer", [...offer.slice(1), offer[1]!]), false);
  assert.equal(validSectionGroupOrder("offer", [...offer.slice(1), stay[0]!]), false);
  assert.equal(validSectionGroupOrder("stay", offer), false);
  assert.equal(validSectionGroupOrder("explore", null), false);
});

test("tab-order review reports one source change and ignores legacy null canonical order", () => {
  for (const [key, title, keys] of [
    ["offer", "Ponudba", ["najem", "izleti_prevozi", "domaci_izdelki", "pri_hisi"]],
    ["stay", "Nastanitev", ["vase_bivanje", "prihod_dostop", "prakticno"]],
  ] as const) {
    const before = publication();
    for (const language of Object.keys(before.languages)) {
      Object.assign(before.languages[language]!.tree.sections[0]!, { key, title });
    }
    const canonical = structuredClone(before);
    for (const language of Object.keys(canonical.languages)) {
      canonical.languages[language]!.tree.sections[0]!.groupOrder = [...keys];
    }
    assert.equal(comparePublications(canonical, before).total, 0);
    const reordered = structuredClone(before);
    for (const language of Object.keys(reordered.languages)) {
      reordered.languages[language]!.tree.sections[0]!.groupOrder = [...keys].reverse();
    }
    const changes = comparePublications(reordered, before);
    assert.deepEqual(changes.changed, [`Spremenjen vrstni red zavihkov: ${title}`]);
    assert.equal(changes.total, 1);
    assert.equal(comparePublications(before, reordered).total, 1);
  }
});

test("diff identifies same-name entities by ID, never display label", () => {
  const before = publication();
  const after = publication([{ id: "item-a", title: "Isto ime" }, { id: "item-b", title: "Isto ime" }]);
  const additions = comparePublications(after, before);
  assert.equal(additions.total, 2);
  assert.equal(additions.added.length, 2);
  const removals = comparePublications(before, after);
  assert.equal(removals.total, 2);
  assert.equal(removals.removed.length, 2);
  const edited = structuredClone(after);
  for (const language of Object.keys(edited.languages)) {
    for (const item of items(edited, language)) item.body = "Nov opis";
  }
  const changes = comparePublications(edited, after);
  assert.equal(changes.total, 2, "two source edits repeated in fallback trees count twice, not once or eight times");
  assert.equal(changes.changed.length, 2);
});

test("diff retains distinct field paths and distinct translations sharing labels", () => {
  const before = publication([{ id: "item", title: "Isti naslov", body: "Vir" }]);
  const after = structuredClone(before);
  items(before, "en")[0]!.body = "English old";
  items(before, "de")[0]!.body = "Deutsch alt";
  items(after, "en")[0]!.body = "English new";
  items(after, "de")[0]!.body = "Deutsch neu";
  const translated = comparePublications(after, before);
  assert.equal(translated.total, 2);
  assert.ok(translated.changed.some((line) => line.includes("prevod (en)")));
  assert.ok(translated.changed.some((line) => line.includes("prevod (de)")));
  before.languages.en!.ui = { first: "Old", second: "Old" };
  after.languages.en!.ui = { first: "New", second: "New" };
  before.languages.en!.plurals = { count: { one: "old one", other: "old other" } };
  after.languages.en!.plurals = { count: { one: "new one", other: "new other" } };
  assert.equal(comparePublications(after, before).total, 6,
    "UI and plural keys sharing a generic display label remain separate changes");
});

test("diff deduplicates fallback fields only against the identical source transition", () => {
  const before = publication([{ id: "item", title: "Isto ime", body: "Old" }]);
  const after = structuredClone(before);
  for (const language of Object.keys(after.languages)) items(after, language)[0]!.body = "New";
  items(before, "en")[0]!.body = "Translated old";
  items(after, "en")[0]!.body = "Translated new";
  const changes = comparePublications(after, before);
  assert.equal(changes.total, 2);
  assert.ok(changes.changed.includes("Opis: Isto ime"));
  assert.ok(changes.changed.includes("Opis: Isto ime — prevod (en)"));
});

test("cleanup recursively protects exact snapshot references inside HTML without JSON escaping artifacts", () => {
  const snapshot = { languages: { sl: { tree: {
    body: '<p><img src="/api/storage/img/test/embedded.jpg"></p>',
    nested: [{ poster: "/api/storage/img/test/poster.png?w=620" },
      "<video src='/api/storage/video/test/clip.mp4'></video>"],
    markdown: "![Photo](/api/storage/img/test/markdown.jpg)",
  } } } };
  // Same decoded jsonb object shape returned by the DB.
  const keys = collectStorageReferenceKeys(JSON.parse(JSON.stringify(snapshot)));
  assert.deepEqual([...keys].sort(), [
    "test/clip.mp4", "test/embedded.jpg", "test/markdown.jpg", "test/poster.png",
  ]);
  assert.ok(![...keys].some((key) => key.includes("\\")));
});

test("an order resolves price and credential from its captured snapshot across a later replacement", () => {
  const captured = publication([{ id: "item", title: "Offer", price: "10", orderEnabled: true }]);
  const next = structuredClone(captured);
  next.guestAccess.orderPassword = "new-password";
  items(next)[0]!.price = "20";
  // A replacement changes which snapshot the next request reads, not the
  // object already captured by resolvePublishedTenant for the current order.
  let stored = captured;
  const requestPublication = stored;
  stored = next;
  assert.equal(requestPublication.guestAccess.orderPassword, "old-password");
  assert.equal(resolvePublishedOrderItem(requestPublication, "item")!.price, "10");
  assert.equal(stored.guestAccess.orderPassword, "new-password");
  assert.equal(resolvePublishedOrderItem(stored, "item")!.price, "20");
});