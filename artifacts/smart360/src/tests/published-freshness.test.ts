import { test } from "node:test";
import assert from "node:assert/strict";
import { createPublishedFreshness } from "../lib/published-freshness";

function fixture() {
  let current = { publishedVersion: "old", text: "old content" };
  let version = "new";
  let safe = true;
  let offline = false;
  let cachedOld = false;
  let applies = 0;
  const control = createPublishedFreshness({
    current: () => current, safe: () => safe,
    version: async () => { if (offline) throw Error("offline"); return version; },
    content: async () => cachedOld ? current : { publishedVersion: version, text: `${version} content` },
    apply: next => { current = next; applies++; },
  });
  return { control, value: () => current, applies: () => applies,
    safe: (v: boolean) => safe = v, offline: (v: boolean) => offline = v,
    version: (v: string) => version = v, cached: () => cachedOld = true };
}
test("opening / foreground check applies changed published content without reload", async () => {
  const f = fixture(); await f.control.check();
  assert.equal(f.value().text, "new content");
  await f.control.check(); assert.equal(f.applies(), 1);
  f.version("third"); await f.control.check(); assert.equal(f.value().text, "third content");
});
test("recording or typed message defers the snapshot until activity ends", async () => {
  const f = fixture(); f.safe(false); await f.control.check();
  f.control.flush(); assert.equal(f.value().text, "old content");
  f.version("third"); await f.control.check();
  f.safe(true); f.control.flush(); assert.equal(f.value().text, "third content");
  assert.equal(f.applies(), 1);
});
test("offline and cached old worker response preserve existing snapshot", async () => {
  const f = fixture(); f.offline(true); await f.control.check();
  assert.equal(f.applies(), 0);
  f.offline(false); f.cached(); await f.control.check(); assert.equal(f.applies(), 0);
});
test("unmount disposes a pending update", async () => {
  const f = fixture(); f.safe(false); await f.control.check();
  f.control.dispose(); f.safe(true); f.control.flush(); await f.control.check();
  assert.equal(f.applies(), 0);
});
test("safety is rechecked after network completes, not only before request", async () => {
  let safe = true, applied = false;
  const c = createPublishedFreshness({
    current: () => ({ publishedVersion: "a" }), safe: () => safe,
    version: async () => "b",
    content: async () => { safe = false; return { publishedVersion: "b" }; },
    apply: () => { applied = true; },
  });
  await c.check(); assert.equal(applied, false);
  safe = true; c.flush(); assert.equal(applied, true);
});
