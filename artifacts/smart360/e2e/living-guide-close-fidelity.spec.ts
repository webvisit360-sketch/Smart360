import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { writeFileSync } from "node:fs";
import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";

const MAX_MISMATCH_RATIO = 0.005;

type CloseTestWindow = Window & {
  __LG2_TEST_HOLD_CLOSE_SWAP__?: boolean;
  __lg2CloseHandoffReady?: boolean;
  __lg2CloseSwapComplete?: boolean;
};

async function settleVisibleRoute(page: Page) {
  await page.locator(".lg2-app").waitFor({ state: "visible" });
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(
      [...document.images]
        .filter((image) => {
          const rect = image.getBoundingClientRect();
          return (
            image.offsetParent !== null &&
            rect.bottom > 0 &&
            rect.top < window.innerHeight
          );
        })
        .map((image) =>
          image.complete
            ? image.decode().catch(() => undefined)
            : new Promise<void>((resolve) => {
                image.addEventListener("load", () => resolve(), { once: true });
                image.addEventListener("error", () => resolve(), { once: true });
              }),
        ),
    );
  });
  await page.waitForTimeout(700);
}

async function screenshotApp(page: Page, path: string) {
  return page.locator(".lg2-app").screenshot({
    animations: "allow",
    path,
  });
}

function assertSmallPixelDiff(
  beforeBuffer: Buffer,
  afterBuffer: Buffer,
  diffPath: string,
) {
  const before = PNG.sync.read(beforeBuffer);
  const after = PNG.sync.read(afterBuffer);
  expect(after.width).toBe(before.width);
  expect(after.height).toBe(before.height);

  const diff = new PNG({ width: before.width, height: before.height });
  const mismatchedPixels = pixelmatch(
    before.data,
    after.data,
    diff.data,
    before.width,
    before.height,
    {
      threshold: 0.1,
      includeAA: false,
    },
  );
  writeFileSync(diffPath, PNG.sync.write(diff));

  const ratio = mismatchedPixels / (before.width * before.height);
  expect(
    ratio,
    `close handoff changed ${(ratio * 100).toFixed(3)}% of the source view`,
  ).toBeLessThanOrEqual(MAX_MISMATCH_RATIO);
  return ratio;
}

async function captureOneFrameAfterClose(
  page: Page,
  closeButtonSelector: string,
  afterPath: string,
  expectedHeldCountAfterSwap: number,
) {
  await page.evaluate(() => {
    const testWindow = window as CloseTestWindow;
    testWindow.__LG2_TEST_HOLD_CLOSE_SWAP__ = true;
    testWindow.__lg2CloseHandoffReady = false;
    testWindow.__lg2CloseSwapComplete = false;
    window.addEventListener(
      "lg2:detail-close-handoff-frame",
      () => {
        testWindow.__lg2CloseHandoffReady = true;
      },
      { once: true },
    );
    window.addEventListener(
      "lg2:detail-close-swap",
      () => {
        testWindow.__lg2CloseSwapComplete = true;
      },
      { once: true },
    );
  });

  await page.locator(closeButtonSelector).click();
  await page.waitForFunction(
    () => (window as CloseTestWindow).__lg2CloseHandoffReady === true,
  );

  const heldTop = page.locator(
    ".lg2-held-stack > .lg2-held-view.lg2-held-view--closing",
  );
  await expect(heldTop).toHaveClass(/lg2-held-view--closing/);
  await expect(heldTop).toHaveCSS("transform", "none");
  await expect(heldTop).toHaveCSS("filter", "none");
  const afterBuffer = await screenshotApp(page, afterPath);

  await page.evaluate(() => {
    const testWindow = window as CloseTestWindow;
    testWindow.__LG2_TEST_HOLD_CLOSE_SWAP__ = false;
    window.dispatchEvent(new Event("lg2:test-release-close-swap"));
  });
  await page.waitForFunction(
    () => (window as CloseTestWindow).__lg2CloseSwapComplete === true,
  );
  await expect(page.locator(".lg2-held-view")).toHaveCount(
    expectedHeldCountAfterSwap,
  );

  return afterBuffer;
}

async function attachCapturePair(
  testInfo: TestInfo,
  name: string,
  beforePath: string,
  afterPath: string,
  diffPath: string,
) {
  await testInfo.attach(`${name}-before`, {
    path: beforePath,
    contentType: "image/png",
  });
  await testInfo.attach(`${name}-after-one-frame`, {
    path: afterPath,
    contentType: "image/png",
  });
  await testInfo.attach(`${name}-diff`, {
    path: diffPath,
    contentType: "image/png",
  });
}

async function openHowThingsWork(page: Page) {
  const practicalTab = page.getByRole("tab", { name: /^Practical$/i });
  if (await practicalTab.isVisible()) {
    await practicalTab.click();
  }
  await page.getByText(/^How things work(?:s)?$/i).first().click();
  await expect(page.locator(".lg2-route-layer.v--det")).toHaveAttribute(
    "data-detail-transition",
    "open",
  );
  await settleVisibleRoute(page);
}

async function setScrollPosition(
  locator: ReturnType<Page["locator"]>,
  axis: "top" | "left",
  value: number,
) {
  await locator.evaluate(
    (element, position) => {
      if (position.axis === "top") element.scrollTop = position.value;
      else element.scrollLeft = position.value;
      element.dispatchEvent(new Event("scroll"));
    },
    { axis, value },
  );
  await pageWaitForPaint(locator.page());
}

async function pageWaitForPaint(page: Page) {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
}

test("detail close preserves the exact source route through the paint-gated swap", async ({
  page,
}, testInfo) => {
  await page.goto("meli-pu/s/stay?ui=living-guide&theme=dan");
  const closeDevBanner = page.getByRole("button", { name: /^Close banner$/i });
  if (await closeDevBanner.isVisible()) {
    await closeDevBanner.click();
  }
  await settleVisibleRoute(page);

  const bottomBarBeforePath = testInfo.outputPath("bottom-bar-before.png");
  const bottomBarAfterPath = testInfo.outputPath(
    "bottom-bar-after-one-frame.png",
  );
  const bottomBarDiffPath = testInfo.outputPath("bottom-bar-diff.png");
  const practicalTab = page.getByRole("tab", { name: /^Practical$/i });
  await practicalTab.click();
  await settleVisibleRoute(page);
  const bottomBarBefore = await screenshotApp(page, bottomBarBeforePath);

  await openHowThingsWork(page);
  await expect(
    page.locator(
      ".lg2-held-stack > .lg2-held-bottom-nav button",
    ),
  ).toHaveCount(5);

  const bottomBarAfter = await captureOneFrameAfterClose(
    page,
    ".lg2-route-layer.v--det .lg2-detail-back",
    bottomBarAfterPath,
    0,
  );
  const bottomBarMismatch = assertSmallPixelDiff(
    bottomBarBefore,
    bottomBarAfter,
    bottomBarDiffPath,
  );
  await attachCapturePair(
    testInfo,
    "bottom-bar-route",
    bottomBarBeforePath,
    bottomBarAfterPath,
    bottomBarDiffPath,
  );

  await openHowThingsWork(page);
  await expect(
    page.locator(".lg2-app > .lg2-bottom-nav"),
  ).toHaveCount(0);

  const listBeforePath = testInfo.outputPath("list-before.png");
  const listAfterPath = testInfo.outputPath("list-after-one-frame.png");
  const listDiffPath = testInfo.outputPath("list-diff.png");
  const listBefore = await screenshotApp(page, listBeforePath);

  await page.getByRole("button", { name: /^Water heater$/i }).click();
  await expect(page.locator(".lg2-route-layer.v--det")).toHaveAttribute(
    "data-detail-transition",
    "open",
  );
  await settleVisibleRoute(page);

  const listAfter = await captureOneFrameAfterClose(
    page,
    ".lg2-route-layer.v--det .lg2-detail-back",
    listAfterPath,
    1,
  );
  const listMismatch = assertSmallPixelDiff(
    listBefore,
    listAfter,
    listDiffPath,
  );
  await attachCapturePair(
    testInfo,
    "list-route",
    listBeforePath,
    listAfterPath,
    listDiffPath,
  );

  testInfo.annotations.push(
    {
      type: "bottom-bar-mismatch",
      description: `${(bottomBarMismatch * 100).toFixed(3)}%`,
    },
    {
      type: "list-mismatch",
      description: `${(listMismatch * 100).toFixed(3)}%`,
    },
  );
});

test("close fidelity preserves a deeply scrolled Surroundings list and offset tabs", async ({
  page,
}, testInfo) => {
  await page.goto("meli-pu/s/stay?ui=living-guide&theme=dan");
  const closeDevBanner = page.getByRole("button", { name: /^Close banner$/i });
  if (await closeDevBanner.isVisible()) {
    await closeDevBanner.click();
  }
  await settleVisibleRoute(page);
  await page.getByRole("button", { name: /^Surroundings$/i }).click();
  await expect(page).toHaveURL(/\/s\/explore\?/);
  await settleVisibleRoute(page);

  const surroundingsList = page.locator(".lg2-explore-list");
  const surroundingsTabs = page.locator(".lg2-gtabs");

  const scrolledBeforePath = testInfo.outputPath(
    "surroundings-scroll-750-before.png",
  );
  const scrolledHandoffPath = testInfo.outputPath(
    "surroundings-scroll-750-handoff.png",
  );
  const scrolledSwapPath = testInfo.outputPath(
    "surroundings-scroll-750-swap.png",
  );
  const scrolledHandoffDiffPath = testInfo.outputPath(
    "surroundings-scroll-750-handoff-diff.png",
  );
  const scrolledSwapDiffPath = testInfo.outputPath(
    "surroundings-scroll-750-swap-diff.png",
  );

  await setScrollPosition(surroundingsList, "top", 750);
  expect(await surroundingsList.evaluate((element) => element.scrollTop)).toBe(
    750,
  );
  const scrolledBefore = await screenshotApp(page, scrolledBeforePath);
  await page
    .getByRole("button", { name: /Istralandia Aquapark/i })
    .click();
  await settleVisibleRoute(page);
  const scrolledHandoff = await captureOneFrameAfterClose(
    page,
    ".lg2-route-layer.v--det .lg2-detail-back",
    scrolledHandoffPath,
    0,
  );
  expect(await surroundingsList.evaluate((element) => element.scrollTop)).toBe(
    750,
  );
  const scrolledSwap = await screenshotApp(page, scrolledSwapPath);
  const scrolledHandoffMismatch = assertSmallPixelDiff(
    scrolledBefore,
    scrolledHandoff,
    scrolledHandoffDiffPath,
  );
  const scrolledSwapMismatch = assertSmallPixelDiff(
    scrolledBefore,
    scrolledSwap,
    scrolledSwapDiffPath,
  );

  const tabsBeforePath = testInfo.outputPath("offset-tabs-before.png");
  const tabsHandoffPath = testInfo.outputPath("offset-tabs-handoff.png");
  const tabsSwapPath = testInfo.outputPath("offset-tabs-swap.png");
  const tabsHandoffDiffPath = testInfo.outputPath(
    "offset-tabs-handoff-diff.png",
  );
  const tabsSwapDiffPath = testInfo.outputPath("offset-tabs-swap-diff.png");

  await setScrollPosition(surroundingsList, "top", 0);
  await setScrollPosition(surroundingsTabs, "left", 240);
  expect(await surroundingsTabs.evaluate((element) => element.scrollLeft)).toBe(
    240,
  );
  const tabsBefore = await screenshotApp(page, tabsBeforePath);
  await page
    .getByRole("button", { name: /Marezige Wine Fountain/i })
    .click();
  await settleVisibleRoute(page);
  const tabsHandoff = await captureOneFrameAfterClose(
    page,
    ".lg2-route-layer.v--det .lg2-detail-back",
    tabsHandoffPath,
    0,
  );
  expect(await surroundingsTabs.evaluate((element) => element.scrollLeft)).toBe(
    240,
  );
  const tabsSwap = await screenshotApp(page, tabsSwapPath);
  const tabsHandoffMismatch = assertSmallPixelDiff(
    tabsBefore,
    tabsHandoff,
    tabsHandoffDiffPath,
  );
  const tabsSwapMismatch = assertSmallPixelDiff(
    tabsBefore,
    tabsSwap,
    tabsSwapDiffPath,
  );

  await attachCapturePair(
    testInfo,
    "surroundings-scroll-750-handoff",
    scrolledBeforePath,
    scrolledHandoffPath,
    scrolledHandoffDiffPath,
  );
  await testInfo.attach("surroundings-scroll-750-after-swap", {
    path: scrolledSwapPath,
    contentType: "image/png",
  });
  await testInfo.attach("surroundings-scroll-750-swap-diff", {
    path: scrolledSwapDiffPath,
    contentType: "image/png",
  });
  await attachCapturePair(
    testInfo,
    "offset-tabs-handoff",
    tabsBeforePath,
    tabsHandoffPath,
    tabsHandoffDiffPath,
  );
  await testInfo.attach("offset-tabs-after-swap", {
    path: tabsSwapPath,
    contentType: "image/png",
  });
  await testInfo.attach("offset-tabs-swap-diff", {
    path: tabsSwapDiffPath,
    contentType: "image/png",
  });

  testInfo.annotations.push(
    {
      type: "surroundings-scroll-750-handoff-mismatch",
      description: `${(scrolledHandoffMismatch * 100).toFixed(3)}%`,
    },
    {
      type: "surroundings-scroll-750-swap-mismatch",
      description: `${(scrolledSwapMismatch * 100).toFixed(3)}%`,
    },
    {
      type: "offset-tabs-handoff-mismatch",
      description: `${(tabsHandoffMismatch * 100).toFixed(3)}%`,
    },
    {
      type: "offset-tabs-swap-mismatch",
      description: `${(tabsSwapMismatch * 100).toFixed(3)}%`,
    },
  );
});