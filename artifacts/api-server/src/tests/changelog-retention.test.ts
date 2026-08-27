import test from "node:test";
import assert from "node:assert/strict";
import { changelogIpRetentionCutoff, isExpiredChangelogIp } from "../lib/changelogRetention";

test("changelog IP retention uses a calendar twelve-month boundary and preserves boundary rows", () => {
  const now = new Date("2025-03-01T12:00:00.000Z");
  const cutoff = changelogIpRetentionCutoff(now);
  assert.equal(cutoff.toISOString(), "2024-03-01T12:00:00.000Z");
  assert.equal(isExpiredChangelogIp(cutoff, now), false, "exactly twelve months old is retained");
  assert.equal(isExpiredChangelogIp(new Date("2024-02-29T23:59:59.999Z"), now), true);
});

test("calendar cutoff clamps leap-day anniversary without deleting newer rows", () => {
  const now = new Date("2025-02-28T08:30:00.000Z");
  const cutoff = changelogIpRetentionCutoff(now);
  assert.equal(cutoff.toISOString(), "2024-02-28T08:30:00.000Z");
  assert.equal(isExpiredChangelogIp(new Date("2024-02-28T08:30:00.000Z"), now), false);
  assert.equal(isExpiredChangelogIp(new Date("2024-02-28T08:30:00.001Z"), now), false);
});