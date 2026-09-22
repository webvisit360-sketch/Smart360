import assert from "node:assert/strict";
import test from "node:test";
import {
  canHydrateCanonicalDraft,
  changedHostOnboardingFields,
  omitLegacyRichAliasForCanonicalItems,
  persistedHostOnboardingSubmitPayload,
  preserveCanonicalMediaForWrite,
  updateCanonicalItemText,
  type HostOnboardingMedia,
} from "../hooks/use-host-onboarding";

const pristine = {
  initialized: true,
  localSnapshot: '{"name":"current"}',
  lastSavedSnapshot: '{"name":"current"}',
  queuedSnapshot: "",
  saveState: "saved" as const,
};

test("a fresh form and a pristine reopened form accept the current canonical draft", () => {
  assert.equal(canHydrateCanonicalDraft({ ...pristine, initialized: false }), true);
  assert.equal(canHydrateCanonicalDraft(pristine), true);
});

test("background refresh cannot replace unsaved or queued host edits", () => {
  assert.equal(canHydrateCanonicalDraft({
    ...pristine,
    localSnapshot: '{"name":"local edit"}',
  }), false);
  assert.equal(canHydrateCanonicalDraft({
    ...pristine,
    queuedSnapshot: '{"name":"queued edit"}',
  }), false);
  assert.equal(canHydrateCanonicalDraft({ ...pristine, saveState: "saving" }), false);
  assert.equal(canHydrateCanonicalDraft({ ...pristine, saveState: "conflict" }), false);
});

const media = (id: string, kind: "image" | "video"): HostOnboardingMedia => ({
  id,
  itemId: null,
  kind,
  url: `https://example.test/${id}`,
  alt: id,
  position: 0,
  posterUrl: null,
  durationSec: null,
});

test("ordinary autosaves omit media so a concurrent photo upload is preserved", () => {
  const result = preserveCanonicalMediaForWrite(
    { accommodationName: "Spremenjeno", media: [media("old", "image")] },
    [media("old", "image"), media("new-upload", "image")],
    false,
  );
  assert.equal("media" in result, false);
});

test("video edits retain canonical media added after the form opened", () => {
  const editedVideo = { ...media("video", "video"), alt: "Nov naziv" };
  const result = preserveCanonicalMediaForWrite(
    { media: [media("old-photo", "image"), editedVideo] },
    [media("old-photo", "image"), media("new-upload", "image"), media("video", "video")],
    true,
  );
  assert.deepEqual(result.media?.map((row) => row.id), ["old-photo", "video", "new-upload"]);
  assert.equal(result.media?.find((row) => row.id === "video")?.alt, "Nov naziv");
});

test("an intentional canonical photo removal is not merged back from a refetch", () => {
  const result = preserveCanonicalMediaForWrite(
    { media: [media("kept", "image")] },
    [media("kept", "image"), media("removed", "image")],
    true,
    new Set(["removed"]),
  );
  assert.deepEqual(result.media?.map((row) => row.id), ["kept"]);
});

test("autosave sends only changed top-level fields and cannot erase a concurrent admin row", () => {
  const baseline = {
    accommodationName: "Staro ime",
    offers: [{ id: "offer-admin", name: "Zajtrk", price: "12 €" }],
    contacts: [{ id: "contact-admin", name: "Ana", phone: "123" }],
  };
  const patch = changedHostOnboardingFields(
    { ...baseline, accommodationName: "Novo ime" },
    baseline,
  );
  assert.deepEqual(patch, { accommodationName: "Novo ime" });
  assert.equal("offers" in patch, false);
  assert.equal("contacts" in patch, false);
});

test("unchanged rich HTML and hero are omitted byte-for-byte from unrelated saves", () => {
  const richItem = {
    id: "rich-1",
    categoryId: "category-1",
    sectionKey: "stay",
    categoryKey: "house",
    title: "Dobrodošli",
    body: "<p><strong>Točno</strong> oblikovanje</p>",
    price: "",
    priceUnit: "",
    phone: "",
    website: "",
    mapQuery: "",
    difficulty: "",
    duration: "",
    distance: "",
    noteType: "",
    noteText: "",
    bullets: [],
    tint: "",
    frame: "",
    isVisible: true,
    orderEnabled: false,
    soldOut: false,
    producerName: "",
    producerNote: "",
  };
  const baseline = {
    accommodationName: "Staro ime",
    canonicalItems: [richItem],
    hero: { url: "/hero.jpg", alt: "Hero", mediaId: "media-1" },
  };
  const patch = changedHostOnboardingFields(
    { ...baseline, accommodationName: "Novo ime" },
    baseline,
  );
  assert.deepEqual(patch, { accommodationName: "Novo ime" });
});

test("a rich edit sends only its stable canonical row, not hidden content", () => {
  const base = {
    id: "rich-1",
    categoryId: "category-1",
    sectionKey: "stay",
    categoryKey: "custom",
    title: "Dobrodošli",
    body: "<p>Izvirnik</p>",
    price: "", priceUnit: "", phone: "", website: "", mapQuery: "",
    difficulty: "", duration: "", distance: "", noteType: "", noteText: "",
    bullets: [] as string[], tint: "", frame: "", isVisible: true,
    orderEnabled: false, soldOut: false, producerName: "", producerNote: "",
  };
  const hidden = { ...base, id: "explore-1", sectionKey: "explore" };
  const patch = changedHostOnboardingFields(
    { canonicalItems: [{ ...base, body: "<p>Spremenjeno</p>" }, hidden] },
    { canonicalItems: [base, hidden] },
  );
  assert.deepEqual(patch.canonicalItems, [{ ...base, body: "<p>Spremenjeno</p>" }]);
});

test("editing one of multiple house rich-text rows persists through canonicalItems", () => {
  const base = {
    id: "house-rules",
    categoryId: "house-category",
    sectionKey: "stay",
    categoryKey: "house",
    title: "Hišni red",
    body: "<p>Po 22. uri prosimo za mir.</p>",
    price: "", priceUnit: "", phone: "", website: "", mapQuery: "",
    difficulty: "", duration: "", distance: "", noteType: "", noteText: "",
    bullets: [] as string[], tint: "", frame: "", isVisible: true,
    orderEnabled: false, soldOut: false, producerName: "", producerNote: "",
  };
  const parking = {
    ...base,
    id: "house-parking",
    title: "Parkiranje",
    body: "<p>Parkirajte ob leseni ograji.</p>",
  };
  const baseline = {
    houseRulesParking: base.body,
    canonicalItems: [base, parking],
  };
  const afterEditorOnChange = updateCanonicalItemText(
    baseline,
    parking.id,
    { body: "<p>Host je posodobil hišni red v skupnem osnutku.</p>" },
  );
  const patch = changedHostOnboardingFields(afterEditorOnChange, baseline);
  assert.deepEqual(patch, {
    canonicalItems: [{
      ...parking,
      body: "<p>Host je posodobil hišni red v skupnem osnutku.</p>",
    }],
  });
  assert.equal("houseRulesParking" in patch, false);
});

test("first canonical house row cannot churn against its stale legacy alias", () => {
  const house = {
    id: "house-rules",
    categoryId: "house-category",
    sectionKey: "stay",
    categoryKey: "house",
    title: "Hišni red",
    body: "<p>Po 22. uri prosimo za mir.</p>",
    price: "", priceUnit: "", phone: "", website: "", mapQuery: "",
    difficulty: "", duration: "", distance: "", noteType: "", noteText: "",
    bullets: [] as string[], tint: "", frame: "", isVisible: true,
    orderEnabled: false, soldOut: false, producerName: "", producerNote: "",
  };
  const baseline = {
    houseRulesParking: house.body,
    canonicalItems: [house],
  };
  const editedBody = "<p>Host je posodobil hišni red v skupnem osnutku.</p>";
  const local = omitLegacyRichAliasForCanonicalItems(
    updateCanonicalItemText(baseline, house.id, { body: editedBody }),
  );
  const patch = changedHostOnboardingFields(local, baseline);
  assert.deepEqual(patch, {
    canonicalItems: [{ ...house, body: editedBody }],
  });
  assert.equal("houseRulesParking" in local, false);

  const normalizedServerResponse = omitLegacyRichAliasForCanonicalItems({
    houseRulesParking: editedBody,
    canonicalItems: [{ ...house, body: editedBody }],
  });
  assert.deepEqual(local, normalizedServerResponse);
});

test("submit uses the flushed server draft instead of resending stale legacy rich text", () => {
  const payload = persistedHostOnboardingSubmitPayload(3, 11, "a".repeat(64));
  assert.deepEqual(payload, {
    round: 3,
    revision: 11,
    canonicalRevision: "a".repeat(64),
  });
  assert.equal("data" in payload, false);
});

test("canonical deletions are explicit rather than inferred from array omission", () => {
  const patch = changedHostOnboardingFields(
    {
      contacts: [],
      deleteContactIds: ["contact-1"],
    },
    {
      contacts: [{ id: "contact-1", name: "Ana", phone: "123" }],
    },
  );
  assert.deepEqual(patch, {
    contacts: [],
    deleteContactIds: ["contact-1"],
  });
});