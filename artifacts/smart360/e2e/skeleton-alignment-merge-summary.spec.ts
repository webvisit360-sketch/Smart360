import { expect, test, type Page } from "@playwright/test";

const categoryMerges = [
  {
    sectionKey: "stay",
    key: "house-rules",
    keptCategoryId: "22222222-2222-4222-8222-222222222222",
    removedCategoryId: "33333333-3333-4333-8333-333333333333",
    summary: "Združena kategorija »Pravila nastanitve« v »Hišni red«; vsi vnosi in prevodi so ohranjeni.",
  },
  {
    sectionKey: "host-custom-section",
    key: "custom-a",
    keptCategoryId: "44444444-4444-4444-8444-444444444444",
    removedCategoryId: "55555555-5555-4555-8555-555555555555",
    summary: "Združena kategorija »POSEBNA PRAVILA« v »Posebna pravila«; vsi vnosi in prevodi so ohranjeni. Zanesljivega podatka o starosti ni; ohranjena je bila prva po vrstnem redu.",
  },
  {
    sectionKey: "host-custom-section",
    key: "empty-a",
    keptCategoryId: "66666666-6666-4666-8666-666666666666",
    removedCategoryId: "77777777-7777-4777-8777-777777777777",
    summary: "Združena kategorija »PRAZNA DVOJICA« v »Prazna dvojica«; vsi vnosi in prevodi so ohranjeni.",
  },
];

const alignmentResult = {
  summary: "Struktura je usklajena s skupnim skeletom. Združene so bile 3 podvojene kategorije.",
  counts: {
    sectionsUpdated: 1,
    categoriesUpdated: 4,
    translationsUpdated: 8,
    categoriesRetired: 3,
    proposalsRekeyed: 2,
    itemMoves: 5,
  },
  titleChanges: [],
  categoryMerges,
  stayTitleNormalization: {
    status: "changed",
    summary: "Naslov razdelka je poenoten v »Vaša nastanitev«.",
    titleChanged: true,
    translationsUpdated: 3,
  },
  skipped: [],
  changed: true,
};

async function renderResult(page: Page) {
  await page.route("**/api/admin/tenants/*/align-skeleton", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(alignmentResult),
    }));
  await page.goto("http://localhost/e2e/skeleton-alignment-harness.html");
  await page.getByTestId("button-open-skeleton-alignment").click();
  await page.getByTestId("button-confirm-skeleton-alignment").click();
  await expect(page.getByTestId("dialog-skeleton-alignment")).toBeHidden();
  await expect(page.getByTestId("status-skeleton-alignment-result")).toBeVisible();
}

for (const viewport of [
  { name: "desktop", width: 1440, height: 1000 },
  { name: "mobile", width: 390, height: 844 },
]) {
  test(`category merge summaries are separate and contained at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await renderResult(page);

    const list = page.getByTestId("list-skeleton-category-merges");
    const summaries = list.locator("li");
    await expect(summaries).toHaveCount(categoryMerges.length);
    for (let index = 0; index < categoryMerges.length; index += 1) {
      await expect(summaries.nth(index)).toHaveText(categoryMerges[index].summary);
    }

    const measurements = await list.evaluate((element) => {
      const items = Array.from(element.children) as HTMLElement[];
      return {
        documentOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        listOverflow: element.scrollWidth > element.clientWidth,
        items: items.map((item) => {
          const rect = item.getBoundingClientRect();
          return {
            display: getComputedStyle(item).display,
            left: rect.left,
            right: rect.right,
            top: rect.top,
            bottom: rect.bottom,
            overflow: item.scrollWidth > item.clientWidth,
          };
        }),
      };
    });

    expect(measurements.documentOverflow).toBe(false);
    expect(measurements.listOverflow).toBe(false);
    for (const [index, item] of measurements.items.entries()) {
      expect(item.display).toBe("list-item");
      expect(item.overflow).toBe(false);
      expect(item.left).toBeGreaterThanOrEqual(0);
      expect(item.right).toBeLessThanOrEqual(viewport.width);
      if (index > 0) expect(item.top).toBeGreaterThanOrEqual(measurements.items[index - 1].bottom);
    }

    await page.screenshot({
      path: `reports/skeleton-merge-summary-${viewport.name}.png`,
      fullPage: true,
    });
  });
}