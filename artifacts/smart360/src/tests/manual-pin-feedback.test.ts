import assert from "node:assert/strict";
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