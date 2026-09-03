import { expect, test, type Page } from "@playwright/test";

const CASES = [
  {
    name: "sup",
    itemId: "4860043d-3db3-4c26-bd6e-714ebfdbe8ce",
    title: "SUP — dnevni najem",
  },
  {
    name: "scooter",
    itemId: "d16868d6-d2c1-4485-9380-b9ebe3c04b40",
    title: "Skuter — najem za 3 do 4 ure",
  },
  {
    name: "trip",
    itemId: "a1b3f0a4-4d72-4698-ae00-2c975cad3d09",
    title: "Izlet s čolnom in skiperjem — 3 ure",
  },
] as const;

const LONG_DESCRIPTION_END = "KONEC DOLGEGA OPISA";

function extendItemBody(payload: any, itemId: string) {
  for (const section of payload.sections ?? []) {
    for (const category of section.categories ?? []) {
      const item = (category.items ?? []).find((entry: any) => entry.id === itemId);
      if (!item) continue;
      item.body = [
        item.body,
        ...Array.from(
          { length: 8 },
          (_, index) =>
            `<p>Dodaten preizkusni odstavek ${index + 1}: opis mora ostati berljiv in dosegljiv z drsenjem znotraj lista.</p>`,
        ),
        `<p>${LONG_DESCRIPTION_END}</p>`,
      ].join("");
      return;
    }
  }
  throw new Error(`Missing fixture item ${itemId}`);
}

async function settleDetail(page: Page, title: string) {
  const sheet = page.locator(".lg2-detail-view .lg2-detail-sheet").last();
  await expect(sheet.locator("h1")).toHaveText(title);
  await expect(sheet.locator(".lg2-detail-prose")).not.toBeEmpty();
  await expect(page.getByTestId("order-dock")).toBeVisible();
  await expect(
    page.locator(".lg2-route-layer.v--det.on").last(),
  ).toHaveCSS("transform", "none");
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
  });
  return sheet;
}

test("orderable offer, rental, and trip details use the full sheet without clipping", async ({
  page,
}) => {
  let tenantResponseModified = false;
  await page.route(/\/api\/public\/tenants\/meli-pu(?:\?.*)?$/, async (route) => {
    const response = await route.fetch();
    const payload = await response.json();
    payload.guestUiMode = "living-guide";
    extendItemBody(payload, CASES[0].itemId);
    tenantResponseModified = true;
    await route.fulfill({ response, json: payload });
  });

  for (const detailCase of CASES) {
    await page.goto("/meli-pu/s/offer?ui=living-guide&theme=dan&lang=sl");
    await expect.poll(() => tenantResponseModified).toBe(true);
    await expect(page.getByTestId("screen-offer")).toBeVisible();
    if (detailCase.name === "trip") {
      await page.getByRole("tab", { name: "Izleti in prevozi", exact: true }).click();
    }
    await page.getByRole("button", { name: detailCase.title, exact: true }).click();
    const sheet = await settleDetail(page, detailCase.title);

    const geometry = await sheet.evaluate((element) => {
      const root = element.closest(".lg2-detail-sheet-root") as HTMLElement;
      const scroll = root.closest(".lg2-detail-scroll") as HTMLElement;
      const hero = root.querySelector(".lg2-detail-hero") as HTMLElement;
      const title = element.querySelector("h1") as HTMLElement;
      const price = element.querySelector(".lg2-price") as HTMLElement;
      const dock = document.querySelector(".lg2-order-dock") as HTMLElement;
      const button = dock.querySelector("button") as HTMLElement;
      const rootRect = root.getBoundingClientRect();
      const scrollRect = scroll.getBoundingClientRect();
      const heroRect = hero.getBoundingClientRect();
      const sheetRect = element.getBoundingClientRect();
      const titleRect = title.getBoundingClientRect();
      const priceRect = price.getBoundingClientRect();
      const dockRect = dock.getBoundingClientRect();
      const buttonRect = button.getBoundingClientRect();

      return {
        rootBottom: rootRect.bottom,
        scrollBottom: scrollRect.bottom,
        sheetTop: sheetRect.top,
        titleTop: titleRect.top,
        priceTop: priceRect.top,
        heroBottom: heroRect.bottom,
        sheetHeight: element.clientHeight,
        sheetScrollHeight: element.scrollHeight,
        dockPosition: getComputedStyle(dock).position,
        dockTop: dockRect.top,
        buttonTop: buttonRect.top,
        buttonBottom: buttonRect.bottom,
      };
    });

    expect(Math.abs(geometry.rootBottom - geometry.scrollBottom)).toBeLessThanOrEqual(1);
    expect(geometry.titleTop).toBeGreaterThanOrEqual(geometry.sheetTop + 30);
    expect(geometry.priceTop).toBeGreaterThanOrEqual(geometry.sheetTop + 30);
    expect(geometry.sheetHeight).toBeGreaterThan(200);
    expect(geometry.dockPosition).toBe("fixed");

    await page.screenshot({
      path: `artifacts/smart360/test-results/order-detail-${detailCase.name}-top.png`,
    });

    if (detailCase.name === "sup") {
      expect(geometry.sheetScrollHeight).toBeGreaterThan(geometry.sheetHeight);
      await sheet.evaluate((element) => {
        element.scrollTop = element.scrollHeight;
      });
      await page.evaluate(
        () =>
          new Promise<void>((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
          ),
      );

      const finalState = await page
        .getByText(LONG_DESCRIPTION_END, { exact: true })
        .evaluate((marker) => {
          const dock = document.querySelector(".lg2-order-dock") as HTMLElement;
          const dockInner = dock.querySelector(".lg2-order-dock-inner") as HTMLElement;
          const button = dock.querySelector("button") as HTMLElement;
          const markerRect = marker.getBoundingClientRect();
          const dockInnerRect = dockInner.getBoundingClientRect();
          const buttonRect = button.getBoundingClientRect();
          return {
            markerTop: markerRect.top,
            markerBottom: markerRect.bottom,
            dockInnerTop: dockInnerRect.top,
            buttonTop: buttonRect.top,
            buttonBottom: buttonRect.bottom,
          };
        });

      expect(finalState.markerTop).toBeGreaterThanOrEqual(0);
      expect(finalState.markerBottom).toBeLessThanOrEqual(finalState.dockInnerTop);
      expect(finalState.buttonTop).toBeCloseTo(geometry.buttonTop, 0);
      expect(finalState.buttonBottom).toBeCloseTo(geometry.buttonBottom, 0);
      await page.screenshot({
        path: "artifacts/smart360/test-results/order-detail-sup-bottom.png",
      });
    }
  }
});