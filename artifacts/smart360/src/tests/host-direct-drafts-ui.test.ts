import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { RoundReview, hostDraftEntryTarget } from "../components/admin/host-onboarding-review";
import type { OwnerOnboardingRound } from "../hooks/use-host-onboarding";
import { adminPlaceTargetTab } from "../lib/manual-pin-feedback";

test("submitted host statuses render actual entry links for all three materialization outcomes", () => {
  const round = {
    id: "submitted-round",
    status: "submitted",
    round: 1,
    updatedAt: "2026-01-01T10:00:00.000Z",
    submittedAt: "2026-01-01T10:00:00.000Z",
    recommendations: [
      { categoryKey: "nature", name: "Jezero", itemId: "new-with-pin", materializationStatus: "created" },
      { categoryKey: "trips", name: "Nejasna lokacija", itemId: "new-needs-pin", materializationStatus: "created_without_coordinates" },
      { categoryKey: "culture", name: "Muzej", itemId: "already-in-guide", materializationStatus: "matched_existing" },
    ],
    customCategories: [],
    events: [],
    photos: [],
  } as unknown as OwnerOnboardingRound;
  const markup = renderToStaticMarkup(createElement(RoundReview, { round, onOpenEntry: () => undefined }));
  assert.match(markup, /Ustvarjen osnutek · Odpri vnos/);
  assert.match(markup, /Ustvarjen osnutek brez koordinat · Odpri vnos/);
  assert.match(markup, /Povezano z obstoječim vnosom · Odpri vnos/);
  assert.equal((markup.match(/<button/g) ?? []).length, 3);
  assert.equal(adminPlaceTargetTab("?placeItem=new-needs-pin"), "content");
});

test("matched archived host recommendation routes to the actual archive, not an active item editor", () => {
  const entry = { itemId: "deleted-item", existingArchived: true, materializationStatus: "matched_existing" as const };
  const round = {
    status: "submitted",
    round: 1,
    updatedAt: "2026-01-01T10:00:00.000Z",
    recommendations: [{ categoryKey: "nature", name: "Star vnos", ...entry }],
    customCategories: [{
      id: "custom", name: "Kraji", provenance: "host_onboarding", categoryId: "category",
      entries: [{ id: "host-entry", name: "Star vnos", ...entry }],
    }],
    events: [],
    photos: [],
  } as unknown as OwnerOnboardingRound;
  const markup = renderToStaticMarkup(createElement(RoundReview, { round, onOpenEntry: () => undefined }));
  assert.match(markup, /Povezano z arhiviranim vnosom · Odpri arhiv/);
  assert.equal((markup.match(/Povezano z arhiviranim vnosom/g) ?? []).length, 2);
  assert.equal(hostDraftEntryTarget(entry), "placeArchived");
  assert.equal(adminPlaceTargetTab("?placeArchived=deleted-item"), "content");
  assert.equal(hostDraftEntryTarget({ itemId: "live", materializationStatus: "created" }), "placeItem");
});

test("normal manual add has no pending blocker, notice, or Creator queue button", () => {
  const editor = readFileSync(new URL("../components/admin/content-editor.tsx", import.meta.url), "utf8");
  const sourceList = readFileSync(new URL("../components/admin/kreator-source-list.tsx", import.meta.url), "utf8");
  const review = readFileSync(new URL("../components/admin/host-onboarding-review.tsx", import.meta.url), "utf8");
  assert.match(editor, /candidate\.duplicateMatch\.kind !== "pending"/);
  assert.match(editor, /match\.kind !== "pending"/);
  assert.doesNotMatch(editor, /Odpri predlog|v Kreatorjevi vrsti|Ta kraj čaka/);
  assert.doesNotMatch(editor, /<ItemCreatorPhotoProposals/);
  assert.doesNotMatch(sourceList, /KreatorProposalQueue/);
  assert.doesNotMatch(review, /useListCreatorProposals|proposalId/);
  assert.match(editor, /entry-editor-pin/);
  assert.match(editor, /\/coordinates/);
  assert.match(editor, /invalidateQueries\(\{ queryKey: getOwnerOnboardingQueryKey\(tenantId\) \}\)/);
});