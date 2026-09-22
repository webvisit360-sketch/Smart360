import assert from "node:assert/strict";
import test from "node:test";
import { stayTitleNormalizationText } from "../components/admin/skeleton-alignment-action";

const result = (summary: string) => ({
  stayTitleNormalization: {
    status: "changed" as const,
    summary,
    titleChanged: false,
    translationsUpdated: 0,
  },
});

test("skeleton alignment renders an explicit destination-title step summary", () => {
  assert.equal(
    stayTitleNormalizationText(result("Naslov razdelka: »Vaša nastanitev« → »Vaša destinacija«.")),
    "Naslov razdelka: »Vaša nastanitev« → »Vaša destinacija«.",
  );
  assert.equal(
    stayTitleNormalizationText(result("Naslov razdelka: brez preimenovanja; usklajeni prevodi: 1.")),
    "Naslov razdelka: brez preimenovanja; usklajeni prevodi: 1.",
  );
  assert.equal(
    stayTitleNormalizationText(result("Naslov razdelka: Brez sprememb.")),
    "Naslov razdelka: Brez sprememb.",
  );
});