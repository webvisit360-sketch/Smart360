import test from "node:test";
import assert from "node:assert/strict";
import { isChunkLoadError, captureChunkFailure, recoverChunk } from "../lib/chunk-recovery";
import { beginGuestActivity, endGuestActivity, CHUNK_RETRY_KEY, requestSafeReload } from "../lib/bundle-freshness";

test("recognizes browser chunk errors, not ordinary network/application errors", () => {
  for (const text of ["Failed to fetch dynamically imported module: /assets/star.js", "Importing a module script failed.", "Loading chunk 12 failed.", "error loading dynamically imported module"]) {
    assert.equal(isChunkLoadError(new Error(text)), true);
  }
  assert.equal(isChunkLoadError(new Error("Failed to fetch")), false);
});
test("durable one-reload guard, reload coalescing, and unsafe activity survives boundary cleanup", () => {
  const storage = new Map<string, string>();
  let reloads = 0;
  const old = new Map(["window", "document", "sessionStorage", "HTMLElement", "HTMLInputElement", "HTMLTextAreaElement"].map(k => [k, Object.getOwnPropertyDescriptor(globalThis, k)]));
  try {
    Object.assign(globalThis, {
      window: { location: { reload: () => reloads++ } },
      document: { activeElement: null },
      sessionStorage: { getItem: (k: string) => storage.get(k) ?? null, setItem: (k: string, v: string) => storage.set(k, v) },
      HTMLElement: class {}, HTMLInputElement: class {}, HTMLTextAreaElement: class {},
    });
    assert.equal(recoverChunk(), true);
    assert.equal(storage.get(CHUNK_RETRY_KEY), "1");
    assert.equal(recoverChunk(), false);
    assert.equal(requestSafeReload(), false, "version updater cannot double reload");
    assert.equal(reloads, 1);
    storage.clear();
    beginGuestActivity("live-tour");
    captureChunkFailure(new Error("Failed to fetch dynamically imported module: /assets/star.js"));
    endGuestActivity("live-tour"); // React cleanup is NOT a user finishing the tour.
    assert.equal(recoverChunk(), false);
    assert.equal(storage.size, 0, "deferred attempt does not consume guard");
    assert.equal(reloads, 1);
  } finally {
    for (const [key, descriptor] of old) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete (globalThis as any)[key];
    }
  }
});
