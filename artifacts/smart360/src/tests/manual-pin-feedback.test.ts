import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  adminPlaceTargetTab,
  mutationErrorMessage,
  replaceSavedProposal,
  validateManualPlace,
} from "../lib/manual-pin-feedback";

test("place deep links target the actual ContentEditor tab, not DistanceReview", () => {
  assert.equal(adminPlaceTargetTab("?placeItem=hidden-item"), "content");
  assert.equal(adminPlaceTargetTab("?placeArchived=old-category"), "content");
  assert.equal(adminPlaceTargetTab("?placeProposal=pending"), "kreator");
  assert.equal(adminPlaceTargetTab("?q=other"), null);
});
import { pinPlacementMapCenter } from "../lib/map-provider";

test("manual-pin success replaces the visible card immediately", () => {
  const unresolved = {
    id: "proposal-1",
    status: "unresolved",
    confirmationMethod: null,
    operatorAddress: null,
    roadDistanceM: null,
  };
  const saved = {
    id: "proposal-1",
    status: "pending",
    confirmationMethod: "operator_coordinates",
    operatorAddress: "Ljubenski most, pri reki Savinji",
    roadDistanceM: 12_400,
  };
  assert.deepEqual(replaceSavedProposal([unresolved], saved), [saved]);
});

test("manual-pin failure keeps the exact Slovenian server reason", () => {
  assert.equal(
    mutationErrorMessage({ data: { error: "Izhodišče nima koordinat." } }),
    "Izhodišče nima koordinat.",
  );
});

test("both translation admin views display the server's specific JSON.error reason", () => {
  const reason = "Prevod ni na voljo: ponudniku je zmanjkalo dobroimetja ali kvote.";
  assert.equal(mutationErrorMessage({ data: { error: reason } }), reason);
  const content = readFileSync(new URL("../components/admin/content-editor.tsx", import.meta.url), "utf8");
  const creator = readFileSync(new URL("../components/admin/kreator-proposal-queue.tsx", import.meta.url), "utf8");
  assert.match(content, /setTranslationError\(\s*mutationErrorMessage\(error\) \?\?/);
  assert.match(creator, /\[row\.id\]: mutationErrorMessage\(mutationError\) \?\?/);
  assert.match(creator, /creator-translation-error-\$\{row\.id\}/);
});

test("manual place validation reports only blank fields, then clears each one", () => {
  const valid = { manualName: "Razgledna točka", locationText: "Nad kampom", latitude: "46.362", longitude: "13.821" };
  assert.deepEqual(validateManualPlace(valid), {});
  for (const field of Object.keys(valid) as Array<keyof typeof valid>) {
    const errors = validateManualPlace({ ...valid, [field]: "  " });
    assert.deepEqual(Object.keys(errors), [field]);
    assert.match(errors[field]!, /^Vnesite /);
  }
  assert.deepEqual(Object.keys(validateManualPlace({
    manualName: "", locationText: "", latitude: "", longitude: "",
  })), ["manualName", "locationText", "latitude", "longitude"]);
});

test("manual coordinates reject malformed and out-of-range values without rejecting zero or boundaries", () => {
  const valid = { manualName: "Razgledna točka", locationText: "Nad kampom", latitude: "0", longitude: "0" };
  for (const latitude of ["abc", "Infinity", "91", "-90.001", "0x10", "1e2"]) {
    assert.deepEqual(Object.keys(validateManualPlace({ ...valid, latitude })), ["latitude"]);
  }
  for (const longitude of ["abc", "Infinity", "181", "-180.001", "0x10"]) {
    assert.deepEqual(Object.keys(validateManualPlace({ ...valid, longitude })), ["longitude"]);
  }
  assert.deepEqual(validateManualPlace({ ...valid, latitude: "-90", longitude: "+180" }), {});
  assert.deepEqual(validateManualPlace({ ...valid, latitude: " 90 ", longitude: "-180" }), {});
});

test("pin placement map never receives invalid coordinate drafts, including while typing", () => {
  const origin = { latitude: 46.31, longitude: 14.91 };
  for (const draft of ["", " ", "abc", "91", "-90.001", "Infinity", "1e3"]) {
    assert.deepEqual(pinPlacementMapCenter(draft, "13.821", origin), { latitude: origin.latitude, longitude: 13.821 });
  }
  for (const draft of ["", " ", "abc", "181", "-180.001", "Infinity", "0x10"]) {
    assert.deepEqual(pinPlacementMapCenter("46.362", draft, origin), { latitude: 46.362, longitude: origin.longitude });
  }
  assert.deepEqual(pinPlacementMapCenter("0", "0", origin), { latitude: 0, longitude: 0 });
  assert.deepEqual(pinPlacementMapCenter("-90", "180"), { latitude: -90, longitude: 180 });
  assert.deepEqual(pinPlacementMapCenter("91", "-181"), { latitude: 46.25, longitude: 14.9 });
  assert.deepEqual(pinPlacementMapCenter("", "", { latitude: NaN, longitude: Infinity }), { latitude: 46.25, longitude: 14.9 });
});

test("Creator queue keeps approval and translation feedback on the affected card", () => {
  const source = readFileSync(
    new URL("../components/admin/kreator-proposal-queue.tsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /creator-approval-error-\$\{row\.id\}/);
  assert.match(source, /Predloga ni mogoče potrditi: manjkajo jeziki/);
  assert.match(source, /setEditingId\(row\.id\)/);
  assert.match(source, /Prevedi v EN\/DE\/IT/);
  assert.match(source, /creator-translation-error-\$\{row\.id\}/);
  assert.match(source, /editingIdRef\.current !== row\.id/);
  assert.match(source, /setEditTranslations\(\(current\) => current\.map/);
});

test("all admin pin maps use the shared OpenFreeMap vector component", () => {
  const queue = readFileSync(
    new URL("../components/admin/kreator-proposal-queue.tsx", import.meta.url),
    "utf8",
  );
  const origin = readFileSync(
    new URL("../components/admin/kreator-origin-confirmation.tsx", import.meta.url),
    "utf8",
  );
  const sharedMap = readFileSync(
    new URL("../components/admin/openfreemap.tsx", import.meta.url),
    "utf8",
  );
  const provider = readFileSync(
    new URL("../lib/map-provider.ts", import.meta.url),
    "utf8",
  );

  assert.match(queue, /<OpenFreeMap/);
  assert.match(origin, /<OpenFreeMap/);
  assert.doesNotMatch(queue + origin, /tile\.openstreetmap\.org/);
  assert.match(sharedMap, /import\("maplibre-gl"\)/);
  assert.match(sharedMap, /ResizeObserver/);
  assert.match(provider, /https:\/\/tiles\.openfreemap\.org\/styles\/liberty/);
  assert.match(provider, /© OpenMapTiles/);
  assert.match(provider, /© OpenStreetMap contributors/);
});