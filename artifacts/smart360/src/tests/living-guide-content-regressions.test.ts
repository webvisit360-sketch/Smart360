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

test("draggable detail sheets use grabbers and backdrop close without arrows", async () => {
  const source = await readFile(
    new URL("../pages/living-guide/LivingGuideGuestShell.tsx", import.meta.url),
    "utf8",
  );
  const draggableDetailSource = source.slice(
    source.indexOf("function HeroGallery("),
    source.indexOf("function BottomNav("),
  );
  const articleCount = (
    draggableDetailSource.match(/<article className=/g) ?? []
  ).length;
  const grabberCount = (
    draggableDetailSource.match(/className="lg2-grabber"/g) ?? []
  ).length;

  assert.doesNotMatch(draggableDetailSource, /className="lg2-detail-back"/);
  assert.equal(articleCount, grabberCount);
  assert.ok(articleCount > 0);
  assert.match(
    draggableDetailSource,
    /!target\.closest\("\.lg2-detail-sheet,\.lg2-order-dock,a,button,input,textarea,select"\)/,
  );
  assert.match(draggableDetailSource, /suppressGalleryClickRef/);

  const fullScreenSource = source.slice(
    source.indexOf("function ExploreView("),
    source.indexOf("function HeroGallery("),
  );
  assert.match(fullScreenSource, /className="lg2-detail-back"/);
});