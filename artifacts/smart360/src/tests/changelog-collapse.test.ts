import assert from "node:assert/strict";
import test from "node:test";
import { collapseConsecutiveChangelog } from "../lib/changelog-collapse";

function entry(id: string, minute: number, summary = "Smart360 je odprl pregled nastanitve.", actorLabel = "Smart360") {
  return {
    id,
    action: "cockpit-entry",
    entity: "tenant",
    summary,
    actorLabel,
    requestIp: null,
    createdAt: `2026-08-29T10:${String(minute).padStart(2, "0")}:00.000Z`,
  };
}

test("collapses identical consecutive events within five minutes", () => {
  const result = collapseConsecutiveChangelog([
    entry("4", 4),
    entry("3", 3),
    entry("2", 2),
    entry("1", 1),
  ]);

  assert.equal(result.length, 1);
  assert.equal(result[0]?.repeatCount, 4);
  assert.equal(result[0]?.id, "4");
});

test("keeps different actors and non-consecutive matches separate", () => {
  const result = collapseConsecutiveChangelog([
    entry("4", 4),
    entry("3", 3, "Smart360 je odprl pregled nastanitve.", "Stranka"),
    entry("2", 2),
  ]);

  assert.deepEqual(result.map((row) => row.repeatCount), [1, 1, 1]);
});

test("does not collapse events outside the five-minute group window", () => {
  const result = collapseConsecutiveChangelog([
    entry("2", 7),
    entry("1", 1),
  ]);

  assert.deepEqual(result.map((row) => row.repeatCount), [1, 1]);
});