import { mkdir, readFile, writeFile } from "node:fs/promises";
import { expect, test, type CDPSession, type Page } from "@playwright/test";

const fixturePath = process.env.SMART360_GUEST_PAYLOAD_FIXTURE;
const slug = process.env.SMART360_GUEST_FIXTURE_SLUG ?? "meli-pu";
const evidenceDir = "/tmp/living-guide-touch-gallery-evidence";
test.skip(!fixturePath, "Set SMART360_GUEST_PAYLOAD_FIXTURE to a public guest response JSON path");
test.use({ isMobile: true, hasTouch: true });

async function touchDrag(cdp: CDPSession, from: { x: number; y: number }, to: { x: number; y: number }, steps: number, delayMs: number) {
  const point = (x: number, y: number) => [{ x: Math.round(x), y: Math.round(y), id: 1, radiusX: 2, radiusY: 2 }];
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: point(from.x, from.y) });
  for (let step = 1; step <= steps; step++) {
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: point(from.x + (to.x - from.x) * step / steps, from.y + (to.y - from.y) * step / steps),
    });
    await new Promise(resolve => setTimeout(resolve, delayMs));
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
}

async function state(page: Page) {
  return page.evaluate(() => {
    const hero = document.querySelector<HTMLElement>(".lg2-detail-view .lg2-detail-hero");
    const gallery = document.querySelector<HTMLElement>(".lg2-detail-view [data-lg-gallery]");
    const sheet = document.querySelector<HTMLElement>(".lg2-detail-view .lg2-detail-sheet");
    if (!hero || !gallery || !sheet) throw new Error("Real detail hero/gallery/sheet is absent");
    return {
      index: hero.dataset.lgActiveSlide,
      galleryScrollLeft: gallery.scrollLeft,
      galleryTouchAction: getComputedStyle(gallery).touchAction,
      sheetOffset: Number(sheet.dataset.lgSheetOffset),
      sheetMinOffset: Number(sheet.dataset.lgSheetMinOffset),
      sheetTouchAction: getComputedStyle(sheet).touchAction,
      sheetPhase: sheet.dataset.lgSheetPhase,
      heroBounds: hero.getBoundingClientRect().toJSON(),
      galleryBounds: gallery.getBoundingClientRect().toJSON(),
      sheetBounds: sheet.getBoundingClientRect().toJSON(),
    };
  });
}

async function textPoint(page: Page) {
  return page.locator(".lg2-detail-view .lg2-detail-sheet").evaluate(sheet => {
    const paragraph = Array.from(sheet.querySelectorAll("p")).find(element => {
      const rect = element.getBoundingClientRect();
      return rect.top > 120 && rect.bottom < innerHeight - 90 && rect.height > 15;
    });
    if (!paragraph) throw new Error("No visible sheet paragraph for text-originating touch drag");
    const rect = paragraph.getBoundingClientRect();
    return { x: Math.round(rect.left + Math.min(50, rect.width / 2)), y: Math.round(rect.top + Math.min(12, rect.height / 2)) };
  });
}

function touchGalleryFixture(fixture: any) {
  const referenceMedia = fixture.sections.flatMap((section: any) => section.categories ?? [])
    .flatMap((category: any) => category.items ?? [])
    .flatMap((item: any) => item.media ?? [])
    .filter((media: any) => ["/images/hero_pool.jpg", "/images/hero_house.jpg"].includes(media.url));
  expect(referenceMedia).toHaveLength(2);
  const photoMedia = referenceMedia.map((media: any, index: number) => ({ ...media, id: `gesture-photo-${index}`, position: index }));
  fixture.guestUiMode = "living-guide";
  fixture.slug = slug;
  fixture.sections = fixture.sections.map((section: any) => {
    if (!["offer", "stay"].includes(section.key)) return section;
    const category = section.categories[0];
    const item = category.items[0];
    return {
      ...section, isVisible: true, categories: [{
        ...category, isVisible: true, label: `Gesture gallery ${section.key}`,
        layout: section.key === "offer" ? "products" : "text",
        exploreGroup: section.key === "offer" ? "najem" : "vase_bivanje",
        items: [{
          ...item, isVisible: true, title: `Gesture gallery ${section.key}`,
          media: photoMedia.map((media: any) => ({ ...media, itemId: item.id })),
          body: Array.from({ length: 20 }, (_, index) =>
            `<p>Odstavek ${index + 1}: pod fotografijo je besedilo za premikanje delno odprtega lista.</p>`).join(""),
        }],
      }],
    };
  });
  return fixture;
}

async function installPublicFixture(page: Page) {
  const fixture = touchGalleryFixture(JSON.parse(await readFile(fixturePath!, "utf8")));
  await page.route(new RegExp(`/api/public/tenants/${slug}(?:\\?|$)`), route => route.fulfill({
    status: 200, contentType: "application/json", body: JSON.stringify(fixture),
  }));
}

test("real touch next photo renders in partially open offer and stay details", async ({ page }) => {
  test.setTimeout(60_000);
  await mkdir(evidenceDir, { recursive: true });
  await installPublicFixture(page);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 1 });
  const results = [];
  for (const section of ["offer", "stay"]) {
    await page.goto(`/${slug}/s/${section}?ui=living-guide&theme=dan&lang=sl`, { waitUntil: "domcontentloaded" });
    await expect(page.locator(".guest-entry-splash")).toBeHidden();
    await page.getByTestId(`screen-${section}`).getByRole("button", { name: /Gesture gallery/ }).first().click();
    await expect(page.locator(".v--det")).toHaveClass(/on/);
    await expect.poll(() => page.locator(".v--det").evaluate(element => getComputedStyle(element).transform)).toBe("none");
    const hero = page.locator(".lg2-detail-view [data-lg-active-slide]");
    await expect(hero).toHaveAttribute("data-lg-active-slide", "0");
    const before = await state(page);
    const photoArea = Math.min(before.galleryBounds.bottom, before.sheetBounds.top) - before.galleryBounds.top;
    expect(photoArea).toBeGreaterThan(100);
    const secondImage = page.locator(".lg2-detail-view img[data-lg-hero-image]").nth(1);
    await expect(secondImage).toHaveAttribute("loading", "eager");
    const y = Math.round(before.galleryBounds.y + Math.min(95, photoArea * 0.3));
    await touchDrag(cdp, { x: 335, y }, { x: 70, y: y + 4 }, 18, 22);
    await expect(hero).toHaveAttribute("data-lg-active-slide", "1");
    await expect.poll(() => secondImage.evaluate(image => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
    await expect.poll(() => secondImage.evaluate(image => (image as HTMLImageElement).currentSrc)).not.toBe("");
    const after = await state(page);
    expect(after.sheetOffset).toBe(before.sheetOffset);
    const image = await secondImage.evaluate(element => {
      const photo = element as HTMLImageElement;
      return { currentSrc: photo.currentSrc, naturalWidth: photo.naturalWidth, naturalHeight: photo.naturalHeight, loading: photo.loading };
    });
    results.push({ section, photoArea, before: { index: before.index, scrollLeft: before.galleryScrollLeft, sheetOffset: before.sheetOffset },
      after: { index: after.index, scrollLeft: after.galleryScrollLeft, sheetOffset: after.sheetOffset }, image });
    await page.screenshot({ path: `${evidenceDir}/${section}-next-photo-loaded.png`, animations: "disabled" });
  }
  await writeFile(`${evidenceDir}/next-photos-computed.json`, JSON.stringify(results, null, 2));
});

test("real touch gestures: horizontal gallery and vertical sheet stay independent in offer and stay details", async ({ page }) => {
  test.setTimeout(120_000);
  await mkdir(evidenceDir, { recursive: true });
  await installPublicFixture(page);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 1 });
  const results = [];

  for (const section of ["offer", "stay"]) {
    await page.goto(`/${slug}/s/${section}?ui=living-guide&theme=dan&lang=sl`, { waitUntil: "domcontentloaded" });
    await expect(page.locator(".guest-entry-splash")).toBeHidden();
    const screen = page.getByTestId(`screen-${section}`);
    await expect(screen).toBeVisible();
    await screen.getByRole("button", { name: /Gesture gallery/ }).first().click();
    await expect(page.locator(".v--det")).toHaveClass(/on/);
    await expect.poll(() => page.locator(".v--det").evaluate(element => getComputedStyle(element).transform)).toBe("none");
    const hero = page.locator(".lg2-detail-view [data-lg-active-slide]");
    await expect(hero).toHaveAttribute("data-lg-active-slide", "0");
    await expect.poll(async () => (await state(page)).sheetMinOffset).toBeLessThan(0);
    const start = await state(page);
    expect(start.galleryTouchAction).toBe("pan-x");
    expect(start.sheetTouchAction).toBe("pan-y");
    expect(start.sheetMinOffset).toBeLessThan(0);
    const y = Math.round(start.galleryBounds.y + Math.min(95, start.galleryBounds.height * 0.3));
    await page.screenshot({ path: `${evidenceDir}/${section}-before.png`, animations: "disabled" });

    await touchDrag(cdp, { x: 335, y }, { x: 70, y: y + 4 }, 18, 22);
    await expect(hero).toHaveAttribute("data-lg-active-slide", "1");
    await expect.poll(() => page.locator(".lg2-detail-view img[data-lg-hero-image]").nth(1)
      .evaluate(image => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
    await expect.poll(() => page.locator(".lg2-detail-view img[data-lg-hero-image]").nth(1)
      .evaluate(image => (image as HTMLImageElement).currentSrc)).not.toBe("");
    const afterSlow = await state(page);
    expect(afterSlow.sheetOffset).toBe(start.sheetOffset);
    const lazySecondImageLoadedNaturally = await page.locator(".lg2-detail-view img[data-lg-hero-image]").nth(1)
      .evaluate(image => (image as HTMLImageElement).naturalWidth > 0);
    await writeFile(`${evidenceDir}/${section}-image-sources.json`, JSON.stringify(
      await page.locator(".lg2-detail-view img[data-lg-hero-image]").evaluateAll(images =>
        images.map(image => ({ src: (image as HTMLImageElement).src, currentSrc: (image as HTMLImageElement).currentSrc, complete: (image as HTMLImageElement).complete, naturalWidth: (image as HTMLImageElement).naturalWidth, loading: (image as HTMLImageElement).loading }))), null, 2));
    await page.screenshot({ path: `${evidenceDir}/${section}-after-horizontal-slow.png`, animations: "disabled" });

    await touchDrag(cdp, { x: 65, y }, { x: 330, y: y + 3 }, 4, 9);
    await expect(hero).toHaveAttribute("data-lg-active-slide", "0");
    const afterFlick = await state(page);
    expect(afterFlick.sheetOffset).toBe(start.sheetOffset);

    await touchDrag(cdp, { x: 190, y: y + 55 }, { x: 201, y: y - 115 }, 15, 21);
    await expect.poll(async () => (await state(page)).sheetOffset).toBeLessThan(start.sheetOffset - 35);
    const afterGalleryVertical = await state(page);
    expect(afterGalleryVertical.index).toBe("0");
    await page.screenshot({ path: `${evidenceDir}/${section}-after-gallery-vertical.png`, animations: "disabled" });

    const textStart = await textPoint(page);
    await touchDrag(cdp, textStart, { x: textStart.x + 5, y: textStart.y - 100 }, 12, 22);
    await expect.poll(async () => (await state(page)).sheetOffset).toBeLessThan(afterGalleryVertical.sheetOffset - 15);
    const afterTextVertical = await state(page);
    expect(afterTextVertical.index).toBe("0");
    await page.screenshot({ path: `${evidenceDir}/${section}-after-text-vertical.png`, animations: "disabled" });
    const pastTopStart = await textPoint(page);
    await touchDrag(cdp, pastTopStart, { x: pastTopStart.x + 4, y: pastTopStart.y - 110 }, 12, 21);
    await expect.poll(async () => (await state(page)).sheetBounds.y).toBeLessThan(0);
    const afterTextPastTop = await state(page);
    expect(afterTextPastTop.index).toBe("0");
    await page.screenshot({ path: `${evidenceDir}/${section}-text-past-top.png`, animations: "disabled" });
    const closeStart = await textPoint(page);
    await touchDrag(cdp, closeStart, { x: closeStart.x + 3, y: Math.min(795, closeStart.y + 610) }, 16, 13);
    const afterDown = await state(page);
    await writeFile(`${evidenceDir}/${section}-after-down.json`, JSON.stringify({ closeStart, afterDown }, null, 2));
    await expect(page.locator(".v--det")).not.toHaveClass(/on/);
    results.push({ section, start, afterSlow, lazySecondImageLoadedNaturally, afterFlick, afterGalleryVertical, afterTextVertical, afterTextPastTop, afterDown, closedFromText: true });
  }
  await writeFile(`${evidenceDir}/computed.json`, JSON.stringify(results, null, 2));
});