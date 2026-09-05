import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import {
  itemPriceText,
  normalizeGuestMedia,
} from "../pages/living-guide/living-guide-formatters";

test("negotiable price is localized semantically", () => {
  const labels: Record<string, string> = {
    sl: "Po dogovoru",
    en: "By agreement",
    de: "Nach Vereinbarung",
    it: "Su accordo",
  };
  for (const [lang, expected] of Object.entries(labels)) {
    assert.equal(
      itemPriceText({ price: "Po dogovoru" }, () => labels[lang]),
      expected,
    );
  }
});

test("guest media normalization filters invalid rows and deduplicates URLs", () => {
  const rows = [
    { id: "a", kind: "image", url: "/one.jpg" },
    { id: "b", kind: "image", url: "/one.jpg" },
    { id: "c", kind: "video", url: "/clip.mp4" },
    { id: "d", kind: "image", url: "" },
    { id: "e", kind: "image", url: "/two.jpg", isVisible: false },
    { id: "f", kind: "image", url: "/three.jpg" },
  ];
  assert.deepEqual(normalizeGuestMedia(rows).map((row) => row.id), ["a", "f"]);
});

test("Living Guide rich titles are sanitized before HTML rendering", async () => {
  const source = await readFile(
    new URL("../pages/living-guide/LivingGuideGuestShell.tsx", import.meta.url),
    "utf8",
  );
  assert.match(
    source,
    /dangerouslySetInnerHTML=\{\{ __html: sanitizeHtml\(value\) \}\}/,
  );
  assert.match(source, /previousMediaKeyRef/);
  assert.match(source, /onGalleryIndex\?\.\(0\)/);

  const swipeSource = await readFile(
    new URL("../pages/guest/GuestSwipe.tsx", import.meta.url),
    "utf8",
  );
  const gallerySource = await readFile(
    new URL("../pages/guest/media-viewer.tsx", import.meta.url),
    "utf8",
  );
  assert.match(swipeSource, /GuestRichBody value=\{item\.body\}/);
  assert.match(swipeSource, /itemPriceText\(item, t\)/);
  assert.match(gallerySource, /media = normalizeGuestMedia\(media\)/);
  assert.match(gallerySource, /setDot\(0\)/);
});