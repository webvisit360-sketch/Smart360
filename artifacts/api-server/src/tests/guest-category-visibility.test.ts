import assert from "node:assert/strict";
import test from "node:test";
import {
  resolveCategoriesForScope,
  resolveGuestContentTree,
  type TenantContentTree,
} from "../lib/contentTree";

type TestItem = {
  id: string;
  isVisible: boolean;
  deletedAt?: Date | null;
  eventStart?: string;
};

type TestCategory = {
  id: string;
  isVisible: boolean;
  deletedAt?: Date | null;
  items: TestItem[];
};

const category = (
  id: string,
  items: TestItem[],
  isVisible = true,
): TestCategory => ({ id, isVisible, deletedAt: null, items });

const item = (id: string, isVisible = true): TestItem => ({
  id,
  isVisible,
  deletedAt: null,
});

test("guest omits an empty category", () => {
  assert.deepEqual(resolveCategoriesForScope([category("empty", [])], true), []);
});

test("guest omits a category whose items are all hidden", () => {
  assert.deepEqual(
    resolveCategoriesForScope(
      [category("all-hidden", [item("one", false), item("two", false)])],
      true,
    ),
    [],
  );
});

test("guest category appears automatically with its first visible item", () => {
  // The same canonical item may be projected through a category attachment;
  // dated events are still ordinary eligible items for this rule.
  const attachedEvent = {
    ...item("visible"),
    eventStart: "2026-08-12T18:00:00+02:00",
  };
  const resolved = resolveCategoriesForScope(
    [category("ready", [item("hidden", false), attachedEvent])],
    true,
  );

  assert.deepEqual(resolved.map((row) => row.id), ["ready"]);
  assert.deepEqual(resolved[0]!.items.map((row) => row.id), ["visible"]);
});

test("operator-hidden category stays hidden even when it has a visible item", () => {
  assert.deepEqual(
    resolveCategoriesForScope(
      [category("operator-hidden", [item("visible")], false)],
      true,
    ),
    [],
  );
});

test("admin remains unaffected and receives empty, hidden, and inactive content", () => {
  const input = [
    category("empty", []),
    category("all-hidden", [item("hidden", false)]),
    category("operator-hidden", [item("visible")], false),
  ];

  assert.deepEqual(resolveCategoriesForScope(input, false), input);
});

test("guest read projects empty categories out of a legacy published snapshot", () => {
  const legacyTree = {
    sections: [
      {
        id: "section",
        isVisible: true,
        categories: [
          category("legacy-empty", []),
          category("legacy-all-hidden", [item("hidden", false)]),
          category("legacy-visible", [item("visible")]),
        ],
      },
    ],
  } as unknown as TenantContentTree;

  const resolved = resolveGuestContentTree(legacyTree);

  assert.deepEqual(
    resolved.sections[0]!.categories.map((row) => row.id),
    ["legacy-visible"],
  );
  assert.deepEqual(
    legacyTree.sections[0]!.categories.map((row) => row.id),
    ["legacy-empty", "legacy-all-hidden", "legacy-visible"],
    "view projection must not mutate stored snapshot content",
  );
});