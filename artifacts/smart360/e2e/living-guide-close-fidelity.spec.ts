import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { writeFileSync } from "node:fs";
import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";

const MAX_MISMATCH_RATIO = 0.005;

type CloseTestWindow = Window & {
  __LG2_TEST_HOLD_CLOSE_SWAP__?: boolean;
  __lg2CloseHandoffReady?: boolean;
  __lg2CloseSwapComplete?: boolean;
  __lg2OpenTransitionEnded?: boolean;
  __lg2OpenObservationComplete?: boolean;
  __lg2OpenLastVisualChangeDelayMs?: number;
  __lg2OpenTransitionStartMs?: number;
  __lg2OpenTransitionDurationMs?: number;
  __lg2OpenFirstFrameState?: {
    panelRadius: string;
    grabberPresent: boolean;
    dotCount: number;
  };
  __LG2_TEST_CAPTURE_OPEN_MOTION__?: boolean;
  __lg2OpenMotionStage?: "waiting" | "25" | "60" | "released";
  __lg2DelayedHeroFrames?: Array<{
    t: number;
    phase: string;
    routeTop: number | null;
    heroHeight: number | null;
    panelTop: number | null;
    grabberPresent: boolean;
    panelRadius: string | null;
  }>;
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

function exactPixelMismatch(
  beforeBuffer: Buffer,
  afterBuffer: Buffer,
  diffPath: string,
) {
  const before = PNG.sync.read(beforeBuffer);
  const after = PNG.sync.read(afterBuffer);
  expect(after.width).toBe(before.width);
  expect(after.height).toBe(before.height);

  const diff = new PNG({
    width: before.width,
    height: before.height,
  });
  const mismatchedPixels = pixelmatch(
    before.data,
    after.data,
    diff.data,
    before.width,
    before.height,
    {
      threshold: 0,
      includeAA: true,
    },
  );
  writeFileSync(diffPath, PNG.sync.write(diff));
  return mismatchedPixels;
}

function assertExactPixelMatch(
  transitionEndBuffer: Buffer,
  settledBuffer: Buffer,
  diffPath: string,
) {
  const mismatchedPixels = exactPixelMismatch(
    transitionEndBuffer,
    settledBuffer,
    diffPath,
  );
  expect(
    mismatchedPixels,
    `detail changed by ${mismatchedPixels} pixels after open transitionend`,
  ).toBe(0);
}

function cropPngRows(
  sourceBuffer: Buffer,
  startRow: number,
  height: number,
) {
  const source = PNG.sync.read(sourceBuffer);
  const crop = new PNG({ width: source.width, height });
  PNG.bitblt(source, crop, 0, startRow, source.width, height, 0, 0);
  return PNG.sync.write(crop);
}

async function armOpenVisualChangeProbe(
  page: Page,
  captureMotion = false,
) {
  await page.evaluate(() => {
    const testWindow = window as CloseTestWindow;
    testWindow.__lg2OpenTransitionEnded = false;
    testWindow.__lg2OpenObservationComplete = false;
    testWindow.__lg2OpenLastVisualChangeDelayMs = undefined;
    testWindow.__lg2OpenTransitionStartMs = undefined;
    testWindow.__lg2OpenTransitionDurationMs = undefined;
    testWindow.__lg2OpenFirstFrameState = undefined;
    testWindow.__lg2OpenMotionStage = "waiting";

    const visualSignature = () => {
      const sheet = document.querySelector<HTMLElement>(
        ".lg2-route-layer.v--det",
      );
      if (!sheet) return "missing";
      const values = [
        sheet,
        sheet.querySelector<HTMLElement>(".lg2-detail-hero"),
        sheet.querySelector<HTMLElement>(".lg2-detail-sheet"),
        sheet.querySelector<HTMLElement>(".lg2-grabber"),
        sheet.querySelector<HTMLElement>(".lg2-gallery-dots"),
      ].map((element) => {
        if (!element) return null;
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return {
          className: element.className,
          childCount: element.childElementCount,
          x: Number(rect.x.toFixed(3)),
          y: Number(rect.y.toFixed(3)),
          width: Number(rect.width.toFixed(3)),
          height: Number(rect.height.toFixed(3)),
          borderTopLeftRadius: style.borderTopLeftRadius,
          borderTopRightRadius: style.borderTopRightRadius,
          display: style.display,
          visibility: style.visibility,
        };
      });
      const images = [
        ...sheet.querySelectorAll<HTMLImageElement>(
          ".lg2-gallery-slide:first-child img",
        ),
      ].map((image) => ({
        className: image.className,
        complete: image.complete,
        naturalWidth: image.naturalWidth,
        naturalHeight: image.naturalHeight,
        confirmed: image.dataset.lgDimensionsConfirmed ?? null,
      }));
      return JSON.stringify({ values, images });
    };

    window.addEventListener(
      "lg2:detail-open-transition-start",
      ((event: CustomEvent<{ startTimeMs: number; durationMs: number }>) => {
        testWindow.__lg2OpenTransitionStartMs = event.detail.startTimeMs;
        testWindow.__lg2OpenTransitionDurationMs = event.detail.durationMs;
        requestAnimationFrame(() => {
          const sheet = document.querySelector<HTMLElement>(
            ".lg2-route-layer.v--det",
          );
          const panel =
            sheet?.querySelector<HTMLElement>(".lg2-detail-sheet") ?? null;
          testWindow.__lg2OpenFirstFrameState = {
            panelRadius: panel
              ? getComputedStyle(panel).borderTopLeftRadius
              : "missing",
            grabberPresent: Boolean(
              panel?.querySelector<HTMLElement>(".lg2-grabber"),
            ),
            dotCount:
              sheet?.querySelectorAll(".lg2-gallery-dots i").length ?? -1,
          };
        });

        if (testWindow.__LG2_TEST_CAPTURE_OPEN_MOTION__) {
          const captureAtProgress = async (
            animation: Animation,
            progress: number,
            stage: "25" | "60",
            releaseEvent: string,
          ) => {
            await new Promise<void>((resolve) => {
              const sample = () => {
                const currentTime = Number(animation.currentTime ?? 0);
                if (currentTime >= event.detail.durationMs * progress) {
                  animation.pause();
                  const effect = animation.effect as KeyframeEffect | null;
                  const target = effect?.target as HTMLElement | null;
                  if (target) {
                    const originalTime = currentTime;
                    const targetY = Math.round(
                      target.getBoundingClientRect().top,
                    );
                    let low = Math.max(0, originalTime - 20);
                    let high = Math.min(
                      event.detail.durationMs,
                      originalTime + 20,
                    );
                    for (let index = 0; index < 24; index += 1) {
                      const midpoint = (low + high) / 2;
                      animation.currentTime = midpoint;
                      const y = target.getBoundingClientRect().top;
                      if (y > targetY) low = midpoint;
                      else high = midpoint;
                    }
                    animation.currentTime = (low + high) / 2;
                  }
                  requestAnimationFrame(() =>
                    requestAnimationFrame(() => resolve()),
                  );
                  return;
                }
                requestAnimationFrame(sample);
              };
              requestAnimationFrame(sample);
            });
            testWindow.__lg2OpenMotionStage = stage;
            await new Promise<void>((resolve) =>
              window.addEventListener(releaseEvent, () => resolve(), {
                once: true,
              }),
            );
            animation.play();
          };

          requestAnimationFrame(() => {
            const sheet = document.querySelector<HTMLElement>(
              ".lg2-route-layer.v--det",
            );
            const transformAnimation = sheet
              ?.getAnimations()
              .find((animation) => {
                const effect = animation.effect as KeyframeEffect | null;
                return effect?.target === sheet;
              });
            if (!transformAnimation) return;
            void (async () => {
              await captureAtProgress(
                transformAnimation,
                0.25,
                "25",
                "lg2:test-release-open-25",
              );
              await captureAtProgress(
                transformAnimation,
                0.6,
                "60",
                "lg2:test-release-open-60",
              );
              testWindow.__lg2OpenMotionStage = "released";
            })();
          });
        }
      }) as EventListener,
      { once: true },
    );

    window.addEventListener(
      "lg2:detail-open-transition-end",
      () => {
        const transitionEnd = performance.now();
        testWindow.__lg2OpenTransitionEnded = true;
        let previous = visualSignature();
        let lastVisualChange = transitionEnd;
        const sample = () => {
          const now = performance.now();
          const current = visualSignature();
          if (current !== previous) {
            previous = current;
            lastVisualChange = now;
          }
          if (now - transitionEnd < 500) {
            requestAnimationFrame(sample);
            return;
          }
          testWindow.__lg2OpenLastVisualChangeDelayMs =
            lastVisualChange === transitionEnd
              ? 0
              : lastVisualChange - transitionEnd;
          testWindow.__lg2OpenObservationComplete = true;
        };
        requestAnimationFrame(sample);
      },
      { once: true },
    );
  }, captureMotion);
  await page.evaluate((shouldCaptureMotion) => {
    (window as CloseTestWindow).__LG2_TEST_CAPTURE_OPEN_MOTION__ =
      shouldCaptureMotion;
  }, captureMotion);
}

async function captureMotionFrame(
  page: Page,
  stage: "25" | "60",
  fullPath: string,
  normalizedPath: string,
) {
  await page.waitForFunction(
    (expectedStage) =>
      (window as CloseTestWindow).__lg2OpenMotionStage === expectedStage,
    stage,
  );
  const sheetTop = await page
    .locator(".lg2-route-layer.v--det")
    .evaluate((sheet) => sheet.getBoundingClientRect().top);
  const fullBuffer = await screenshotApp(page, fullPath);
  const outerCornerInset = 32;
  const startRow = Math.max(
    0,
    Math.round(sheetTop) + outerCornerInset,
  );
  const normalized = cropPngRows(
    fullBuffer,
    startRow,
    PNG.sync.read(fullBuffer).height - startRow,
  );
  writeFileSync(normalizedPath, normalized);
  return {
    normalized,
    height: PNG.sync.read(normalized).height,
    sheetTop,
    outerCornerInset,
  };
}

async function captureOpenEndAndSettled(
  page: Page,
  trigger: ReturnType<Page["locator"]>,
  transitionEndPath: string,
  settledPath: string,
  diffPath: string,
) {
  await armOpenVisualChangeProbe(page);
  await trigger.click();
  await page.waitForFunction(
    () => (window as CloseTestWindow).__lg2OpenTransitionEnded === true,
  );

  const sheet = page.locator(".lg2-route-layer.v--det");
  await expect(sheet).toHaveAttribute("data-detail-transition", "open");
  await expect(sheet).toHaveCSS("border-top-left-radius", "30px");
  await expect(sheet).toHaveCSS("border-top-right-radius", "30px");
  const panel = sheet.locator(".lg2-detail-sheet");
  await expect(panel).toHaveCSS("border-top-left-radius", "28px");
  await expect(panel).toHaveCSS("border-top-right-radius", "28px");
  await expect(panel.locator(".lg2-grabber")).toBeVisible();
  const transitionEnd = await screenshotApp(page, transitionEndPath);

  await page.waitForFunction(
    () => (window as CloseTestWindow).__lg2OpenObservationComplete === true,
  );
  const settled = await screenshotApp(page, settledPath);
  assertExactPixelMatch(transitionEnd, settled, diffPath);
  const lastVisualChangeDelayMs = await page.evaluate(
    () =>
      (window as CloseTestWindow).__lg2OpenLastVisualChangeDelayMs ??
      Number.NaN,
  );
  expect(lastVisualChangeDelayMs).toBe(0);
  return { lastVisualChangeDelayMs };
}

async function captureOpenMotionAndSettled(
  page: Page,
  trigger: ReturnType<Page["locator"]>,
  scenario: (typeof OPEN_FIDELITY_CASES)[number],
  testInfo: TestInfo,
) {
  await armOpenVisualChangeProbe(page, true);
  await trigger.click();

  await page.waitForFunction(
    () =>
      (window as CloseTestWindow).__lg2OpenFirstFrameState !== undefined,
  );
  const firstFrameState = await page.evaluate(
    () => (window as CloseTestWindow).__lg2OpenFirstFrameState!,
  );
  expect(firstFrameState.panelRadius).toBe("28px");
  expect(firstFrameState.grabberPresent).toBe(true);
  expect(firstFrameState.dotCount).toBe(scenario.expectedDots);

  const pathsFor = (label: string) => testInfo.outputPath(
    `${scenario.name}-open-${label}.png`,
  );
  const at25 = await captureMotionFrame(
    page,
    "25",
    pathsFor("25pct"),
    pathsFor("25pct-normalized"),
  );
  await page.evaluate(() =>
    window.dispatchEvent(new Event("lg2:test-release-open-25")),
  );
  const at60 = await captureMotionFrame(
    page,
    "60",
    pathsFor("60pct"),
    pathsFor("60pct-normalized"),
  );
  await page.evaluate(() =>
    window.dispatchEvent(new Event("lg2:test-release-open-60")),
  );

  await page.waitForFunction(
    () => (window as CloseTestWindow).__lg2OpenTransitionEnded === true,
  );
  const transitionEnd = await screenshotApp(page, pathsFor("transitionend"));
  await page.waitForFunction(
    () => (window as CloseTestWindow).__lg2OpenObservationComplete === true,
  );
  const settled = await screenshotApp(page, pathsFor("plus-500ms"));
  const endMismatch = exactPixelMismatch(
    transitionEnd,
    settled,
    pathsFor("transitionend-diff"),
  );
  expect(endMismatch).toBe(0);

  const settledFor25 = cropPngRows(
    settled,
    at25.outerCornerInset,
    at25.height,
  );
  const settledFor60 = cropPngRows(
    settled,
    at60.outerCornerInset,
    at60.height,
  );
  writeFileSync(pathsFor("settled-for-25pct"), settledFor25);
  writeFileSync(pathsFor("settled-for-60pct"), settledFor60);
  const mismatch25 = exactPixelMismatch(
    at25.normalized,
    settledFor25,
    pathsFor("25pct-diff"),
  );
  const mismatch60 = exactPixelMismatch(
    at60.normalized,
    settledFor60,
    pathsFor("60pct-diff"),
  );
  expect(
    mismatch25,
    `${scenario.name} changed by ${mismatch25} pixels at 25% motion`,
  ).toBe(0);
  expect(
    mismatch60,
    `${scenario.name} changed by ${mismatch60} pixels at 60% motion`,
  ).toBe(0);

  const lastVisualChangeDelayMs = await page.evaluate(
    () =>
      (window as CloseTestWindow).__lg2OpenLastVisualChangeDelayMs ??
      Number.NaN,
  );
  expect(lastVisualChangeDelayMs).toBe(0);
  return {
    pathsFor,
    mismatch25,
    mismatch60,
    endMismatch,
    lastVisualChangeDelayMs,
    sheetTop25: at25.sheetTop,
    sheetTop60: at60.sheetTop,
  };
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

const OPEN_FIDELITY_CASES = [
  {
    name: "gallery",
    categoryLabel: /^Apartments$/i,
    nestedItemLabel: /^Apartment 1/i,
    expectedDots: 6,
    expectedImages: 1,
  },
  {
    name: "single-photo",
    tabLabel: /^Arrival and access$/i,
    categoryLabel: /^Location$/i,
    expectedDots: 0,
    expectedImages: 1,
  },
  {
    name: "no-photo",
    tabLabel: /^Practical$/i,
    categoryLabel: /^WiFi$/i,
    expectedDots: 0,
    expectedImages: 0,
  },
] as const;

test("detail hero geometry is fixed while the image response is delayed", async ({
  context,
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "chromium",
    "Chromium route-delay regression; WebKit acceptance remains a real-device recording.",
  );

  const cdp = await context.newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });

  let releaseHeroResponse = () => {};
  const heroResponseReleased = new Promise<void>((resolve) => {
    releaseHeroResponse = resolve;
  });
  let markHeroRequestStarted = () => {};
  const heroRequestStarted = new Promise<void>((resolve) => {
    markHeroRequestStarted = resolve;
  });

  await page.route(
    "**/meli-pu_apartma-1_02-d139.jpg?w=1400",
    async (route) => {
      markHeroRequestStarted();
      await heroResponseReleased;
      const response = await route.fetch();
      await route.fulfill({
        response,
        headers: {
          ...response.headers(),
          "cache-control": "no-store",
        },
      });
    },
  );

  await page.goto("meli-pu/s/stay?ui=living-guide&theme=dan");
  await settleVisibleRoute(page);
  await heroRequestStarted;

  await page.evaluate(() => {
    const testWindow = window as CloseTestWindow;
    testWindow.__lg2DelayedHeroFrames = [];
    const startedAt = performance.now();
    const sample = () => {
      const route = document.querySelector<HTMLElement>(
        ".lg2-route-layer.v--det",
      );
      const hero = route?.querySelector<HTMLElement>(".lg2-detail-hero");
      const panel = route?.querySelector<HTMLElement>(".lg2-detail-sheet");
      const routeRect = route?.getBoundingClientRect();
      const heroRect = hero?.getBoundingClientRect();
      const panelRect = panel?.getBoundingClientRect();
      testWindow.__lg2DelayedHeroFrames!.push({
        t: Number((performance.now() - startedAt).toFixed(1)),
        phase: route?.dataset.detailTransition ?? "missing",
        routeTop: routeRect ? Number(routeRect.top.toFixed(2)) : null,
        heroHeight: heroRect ? Number(heroRect.height.toFixed(2)) : null,
        panelTop: panelRect ? Number(panelRect.top.toFixed(2)) : null,
        grabberPresent: Boolean(panel?.querySelector(".lg2-grabber")),
        panelRadius: panel
          ? getComputedStyle(panel).borderTopLeftRadius
          : null,
      });
      if (performance.now() - startedAt < 6_000) {
        requestAnimationFrame(sample);
      }
    };
    requestAnimationFrame(sample);
  });

  const releaseTimer = setTimeout(releaseHeroResponse, 800);
  await page.getByRole("button", { name: /^Apartments$/i }).click();
  await expect(page.locator(".lg2-route-layer.v--det")).toHaveAttribute(
    "data-detail-transition",
    "open",
    { timeout: 5_000 },
  );
  await page.waitForTimeout(700);
  clearTimeout(releaseTimer);

  const frames = await page.evaluate(
    () => (window as CloseTestWindow).__lg2DelayedHeroFrames ?? [],
  );
  const mountedFrames = frames.filter(
    (frame) =>
      frame.phase !== "missing" &&
      frame.routeTop !== null &&
      frame.heroHeight !== null &&
      frame.panelTop !== null,
  );
  const openFrames = mountedFrames.filter((frame) => frame.phase === "open");

  expect(mountedFrames.length).toBeGreaterThan(0);
  expect(openFrames.length).toBeGreaterThan(0);
  expect(openFrames[0]!.t).toBeGreaterThanOrEqual(750);

  const expectedHeroHeight = mountedFrames[0]!.heroHeight!;
  for (const frame of mountedFrames) {
    expect(frame.heroHeight).toBe(expectedHeroHeight);
    expect(frame.panelTop! - frame.routeTop!).toBeCloseTo(
      expectedHeroHeight - 26,
      1,
    );
    expect(frame.grabberPresent).toBe(true);
    expect(frame.panelRadius).toBe("28px");
  }

  await testInfo.attach("delayed-hero-frame-series", {
    body: JSON.stringify(mountedFrames, null, 2),
    contentType: "application/json",
  });
});

for (const scenario of OPEN_FIDELITY_CASES) {
  test(`detail open is visually complete at transitionend: ${scenario.name}`, async ({
    page,
  }, testInfo) => {
    await page.goto("meli-pu/s/stay?ui=living-guide&theme=dan");
    const closeDevBanner = page.getByRole("button", { name: /^Close banner$/i });
    if (await closeDevBanner.isVisible()) {
      await closeDevBanner.click();
    }
    await settleVisibleRoute(page);

    if ("tabLabel" in scenario) {
      await page.getByRole("tab", { name: scenario.tabLabel }).click();
      await settleVisibleRoute(page);
    }

    let trigger = page.getByRole("button", {
      name: scenario.categoryLabel,
    });
    if ("nestedItemLabel" in scenario) {
      await trigger.click();
      await expect(page.locator(".lg2-route-layer.v--det")).toHaveAttribute(
        "data-detail-transition",
        "open",
      );
      await settleVisibleRoute(page);
      trigger = page.getByRole("button", {
        name: scenario.nestedItemLabel,
      });
    }

    const result = await captureOpenMotionAndSettled(
      page,
      trigger,
      scenario,
      testInfo,
    );

    await expect(
      page.locator(".lg2-route-layer.v--det .lg2-gallery-dots i"),
    ).toHaveCount(scenario.expectedDots);
    await expect(
      page.locator(
        ".lg2-route-layer.v--det .lg2-gallery-slide:first-child .lg2-hero-image-main",
      ),
    ).toHaveCount(scenario.expectedImages);

    await testInfo.attach(`${scenario.name}-25pct`, {
      path: result.pathsFor("25pct"),
      contentType: "image/png",
    });
    await testInfo.attach(`${scenario.name}-60pct`, {
      path: result.pathsFor("60pct"),
      contentType: "image/png",
    });
    await testInfo.attach(`${scenario.name}-transitionend`, {
      path: result.pathsFor("transitionend"),
      contentType: "image/png",
    });
    await testInfo.attach(`${scenario.name}-plus-500ms`, {
      path: result.pathsFor("plus-500ms"),
      contentType: "image/png",
    });
    testInfo.annotations.push(
      {
        type: `${testInfo.project.name}-${scenario.name}-motion-mismatch`,
        description: `25% ${result.mismatch25}px; 60% ${result.mismatch60}px`,
      },
      {
        type: `${scenario.name}-last-visual-change-delay`,
        description: `${result.lastVisualChangeDelayMs.toFixed(1)} ms`,
      },
    );
  });
}