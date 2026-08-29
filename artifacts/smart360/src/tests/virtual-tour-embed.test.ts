import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { join } from "node:path";

import { virtualTourEmbedUrl } from "../lib/virtual-tour";

test("Kuula embed policy hides chrome while preserving identity and unrelated parameters", () => {
  const stored =
    "https://kuula.co/share/abc/collection/7T32z?logo=1&info=1&fs=1&vr=1&gyro=1&autorotate=0.16&thumbs=1&pause=1&custom=kept";
  const rendered = virtualTourEmbedUrl(stored);

  assert.ok(rendered);
  const url = new URL(rendered);
  assert.equal(url.pathname, "/share/abc/collection/7T32z");
  assert.equal(url.searchParams.get("logo"), "-1");
  assert.equal(url.searchParams.get("info"), "0");
  assert.equal(url.searchParams.get("fs"), "0");
  assert.equal(url.searchParams.get("vr"), "0");
  assert.equal(url.searchParams.get("gyro"), "0");
  assert.equal(url.searchParams.get("thumbs"), "-1");
  assert.equal(url.searchParams.get("pause"), "0");
  assert.equal(url.searchParams.get("autorotate"), "0.16");
  assert.equal(url.searchParams.get("custom"), "kept");
});

test("non-Kuula providers keep their normalized URL unchanged", () => {
  const stored = "https://my.matterport.com/show/?m=abc&brand=1";
  assert.equal(virtualTourEmbedUrl(stored), stored);
});

test("every active tour iframe uses the shared policy without delegated motion or fullscreen capabilities", () => {
  const here = import.meta.dirname;
  const files = [
    join(here, "..", "pages", "admin", "tenant-edit.tsx"),
    join(here, "..", "pages", "guest", "Cover.tsx"),
    join(here, "..", "pages", "living-guide", "LivingGuideGuestShell.tsx"),
  ];

  for (const file of files) {
    const source = readFileSync(file, "utf8");
    assert.match(source, /virtualTourEmbedUrl/);
    assert.doesNotMatch(
      source,
      /allowFullScreen|xr-spatial-tracking|gyroscope|accelerometer|allow=["'][^"']*fullscreen/,
    );
  }
});