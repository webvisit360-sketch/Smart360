import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import {
  canMarkPanorama, isPanoramaMedia, splitPanoramaMedia, panoramaUploadFlag,
  panoramaPanBounds, clampPanoramaPan, centredPanoramaPan, panoramaEdgeIntent,
  stepPanoramaIndex, panoramaLabel, PANORAMA_LANGS, PANORAMA_LABEL_KEYS,
} from "../lib/panorama-media";

test("videos can never be panoramas, even with a stale flag", () => {
  assert.equal(canMarkPanorama({ kind: "video" }), false);
  assert.equal(isPanoramaMedia({ kind: "video", isPanorama: true }), false);
  assert.equal(isPanoramaMedia({ kind: "image", isPanorama: true }), true);
  assert.equal(isPanoramaMedia({ isPanorama: true }), true);
  assert.equal(isPanoramaMedia({ kind: "image" }), false);
});

test("split keeps order inside both groups", () => {
  const m = [{ id: "a" }, { id: "b", isPanorama: true }, { id: "c" }, { id: "d", isPanorama: true }];
  const { regular, panoramas } = splitPanoramaMedia(m);
  assert.deepEqual(regular.map((x) => x.id), ["a", "c"]);
  assert.deepEqual(panoramas.map((x) => x.id), ["b", "d"]);
  assert.deepEqual(splitPanoramaMedia(null), { regular: [], panoramas: [] });
});

test("upload flag only for photo files chosen via panorama option", () => {
  assert.equal(panoramaUploadFlag({ type: "image/jpeg", name: "a.jpg" }, true), true);
  assert.equal(panoramaUploadFlag({ type: "image/jpeg", name: "a.jpg" }, false), false);
  assert.equal(panoramaUploadFlag({ type: "video/mp4", name: "a.mp4" }, true), false);
  assert.equal(panoramaUploadFlag({ type: "", name: "a.mov" }, true), false);
});

test("pan bounds clamp and centre", () => {
  assert.deepEqual(panoramaPanBounds(3000, 400), { min: -2600, max: 0 });
  assert.equal(clampPanoramaPan(50, 3000, 400), 0);
  assert.equal(clampPanoramaPan(-9999, 3000, 400), -2600);
  assert.equal(centredPanoramaPan(3000, 400), -1300);
  assert.equal(clampPanoramaPan(-30, 200, 400), 100); // narrower image stays centred
});

test("edge swipe navigates only beyond threshold and when a neighbour exists", () => {
  assert.equal(panoramaEdgeIntent(-2700, 3000, 400, 0, 3), "next");
  assert.equal(panoramaEdgeIntent(-2650, 3000, 400, 0, 3), null);
  assert.equal(panoramaEdgeIntent(-2700, 3000, 400, 2, 3), null);
  assert.equal(panoramaEdgeIntent(100, 3000, 400, 1, 3), "prev");
  assert.equal(panoramaEdgeIntent(100, 3000, 400, 0, 3), null);
  assert.equal(stepPanoramaIndex(2, 3, "next"), 2);
  assert.equal(stepPanoramaIndex(0, 3, "prev"), 0);
  assert.equal(stepPanoramaIndex(1, 3, "next"), 2);
});

test("all labels exist in all 7 languages", () => {
  for (const key of PANORAMA_LABEL_KEYS) for (const lang of PANORAMA_LANGS) {
    const v = panoramaLabel(key, lang, 2, 5);
    assert.ok(v && !v.includes("{"), `${key}/${lang}`);
  }
  assert.equal(panoramaLabel("counter", "en", 2, 5), "Panorama 2 of 5");
  assert.equal(panoramaLabel("close", "xx"), "Zapri panoramo");
});

test("guest viewer reuses hero URL width and isolates gestures; admin sends flag", async () => {
  const viewer = await readFile(new URL("../pages/living-guide/living-guide-panorama.tsx", import.meta.url), "utf8");
  assert.match(viewer, /mediaImgSrc\(m, HERO_IMAGE_WIDTH\)/);
  assert.doesNotMatch(viewer, /\?w=/);
  assert.match(viewer, /stopPropagation/);
  assert.match(viewer, /GuideBackCircle/);
  const css = await readFile(new URL("../pages/living-guide/living-guide-panorama.css", import.meta.url), "utf8");
  assert.doesNotMatch(css, /box-shadow|\bred\b/);
  const shell = await readFile(new URL("../pages/living-guide/LivingGuideGuestShell.tsx", import.meta.url), "utf8");
  assert.equal(shell.match(/<PanoramaStrip /g)?.length, 5);
  const admin = await readFile(new URL("../components/admin/item-media-editor.tsx", import.meta.url), "utf8");
  assert.match(admin, /fd\.append\("isPanorama", "true"\)/);
  assert.match(admin, /isPanorama: !isPanoramaMedia\(m\)/);
});
