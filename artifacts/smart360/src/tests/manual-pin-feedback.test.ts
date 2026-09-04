import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  mutationErrorMessage,
  replaceSavedProposal,
} from "../lib/manual-pin-feedback";

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