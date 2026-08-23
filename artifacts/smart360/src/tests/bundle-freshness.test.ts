import assert from "node:assert/strict";
import test from "node:test";
import { shouldReload } from "../lib/bundle-freshness";

// The reload decision must be conservative: reload exactly once per new
// build id, and only when the guest cannot lose anything.

test("no reload when the bundle is current", () => {
  assert.equal(
    shouldReload({ current: "a1", latest: "a1", alreadyReloadedFor: null, safe: true }),
    false,
  );
});

test("reloads once for a new build when safe", () => {
  assert.equal(
    shouldReload({ current: "a1", latest: "b2", alreadyReloadedFor: null, safe: true }),
    true,
  );
});

test("loop guard: never reloads twice for the same target build", () => {
  assert.equal(
    shouldReload({ current: "a1", latest: "b2", alreadyReloadedFor: "b2", safe: true }),
    false,
  );
  // A later, different build gets its own single attempt.
  assert.equal(
    shouldReload({ current: "a1", latest: "c3", alreadyReloadedFor: "b2", safe: true }),
    true,
  );
});

test("never reloads while the guest is mid-order or mid-message", () => {
  assert.equal(
    shouldReload({ current: "a1", latest: "b2", alreadyReloadedFor: null, safe: false }),
    false,
  );
});

test("missing or malformed server version never triggers a reload", () => {
  assert.equal(
    shouldReload({ current: "a1", latest: null, alreadyReloadedFor: null, safe: true }),
    false,
  );
  assert.equal(
    shouldReload({ current: "a1", latest: undefined, alreadyReloadedFor: null, safe: true }),
    false,
  );
  assert.equal(
    shouldReload({ current: "a1", latest: "", alreadyReloadedFor: null, safe: true }),
    false,
  );
});
