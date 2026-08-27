import assert from "node:assert/strict";
import test from "node:test";
import { contentMutationSummary, mediaMutationSummary } from "../routes/adminContent";

test("content audit summaries name the validated kind of change, never its value", () => {
  assert.equal(
    contentMutationSummary("item", { body: "<p>zasebno besedilo</p>" }, "Sečoveljske soline"),
    "Spremenjeno besedilo vnosa · Sečoveljske soline",
  );
  assert.equal(
    contentMutationSummary("category", { isVisible: false }, "Izleti"),
    "Spremenjena vidnost kategorije · Izleti",
  );
  assert.equal(
    contentMutationSummary("section", { mapUrl: "https://private.example" }, "Prihod"),
    "Spremenjeni kontaktni podatki razdelka · Prihod",
  );
});

test("media audit summaries describe safe metadata and bound labels", () => {
  assert.equal(
    mediaMutationSummary({ focusX: 42 }, "Apartma"),
    "Spremenjen izrez predstavnosti · Apartma",
  );
  const veryLongTitle = "x".repeat(200);
  assert.equal(mediaMutationSummary({ width: 1200 }, veryLongTitle).length, 120 + "Spremenjeni podatki predstavnosti · ".length);
});