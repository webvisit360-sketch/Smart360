/** Dev-only real ExploreView fixture. No server startup, tenant edits or publishing. */
import { expect, test, type Page } from "@playwright/test";

const fixturePath = "/src/tests/fixtures/explore-recording.html";
const labels = {
  sl: { all: "Vse", bike: "Kolesarjenje", hike: "Pohodništvo", run: "Tek", activities: "Aktivnosti", other: "Šport", recording: "Snemanje tur" },
  en: { all: "All", bike: "Cycling", hike: "Hiking", run: "Running", activities: "Activities", other: "Sport", recording: "Record a tour" },
  de: { all: "Alle", bike: "Radfahren", hike: "Wandern", run: "Laufen", activities: "Aktivitäten", other: "Sport", recording: "Tour aufzeichnen" },
  it: { all: "Tutte", bike: "In bicicletta", hike: "Escursioni a piedi", run: "Corsa", activities: "Attività", other: "Sport", recording: "Registra un tour" },
} as const;

async function expectLastRecorder(page: Page) {
  const card = page.getByTestId("card-free-tour");
  await expect(card).toBeVisible();
  await expect(card).toHaveCount(1);
  expect(await card.evaluate(element => {
    const panel = element.parentElement!;
    const list = panel.parentElement!;
    return panel === list.lastElementChild && element === panel.lastElementChild;
  })).toBe(true);
}

for (const lang of ["sl", "en", "de", "it"] as const) {
  test(`${lang}: recorder placement is LAST in each sport category, absent All/other, pseudo only fallback`, async ({ page }, testInfo) => {
    await page.goto(`${fixturePath}?lang=${lang}&theme=noc&weather=warning`);
    await expect(page.getByTestId("screen-explore")).toBeVisible();
    await expect(page.getByRole("tab", { name: labels[lang].recording, exact: true })).toHaveCount(0);
    await expect(page.getByTestId("card-free-tour")).toHaveCount(0);
    for (const key of ["bike", "hike", "run", "activities"] as const) {
      await page.getByRole("tab", { name: labels[lang][key], exact: true }).click();
      await expectLastRecorder(page);
      await expect(page.getByTestId("banner-tour-weather-warning")).toBeVisible();
      await expect(page.locator(".lg2-explore-list .lg2-explore-card")).not.toHaveCount(0);
    }
    await page.getByTestId("card-free-tour").scrollIntoViewIfNeeded();
    const measurements = await page.getByTestId("card-free-tour").evaluate(element => {
      const card = element.getBoundingClientRect();
      const list = element.closest(".lg2-explore-list")!;
      const style = getComputedStyle(element);
      const title = getComputedStyle(element.querySelector("h2")!);
      const luminance = (color: string) => {
        const rgb = (color.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number).map((value) => {
          const channel = value / 255;
          return channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4;
        });
        return .2126 * rgb[0]! + .7152 * rgb[1]! + .0722 * rgb[2]!;
      };
      const foreground = luminance(title.color), background = luminance(style.backgroundColor);
      return {
        card: { x: card.x, y: card.y, width: card.width, height: card.height },
        list: { clientWidth: list.clientWidth, scrollWidth: list.scrollWidth },
        foreground: title.color, background: style.backgroundColor,
        titleContrast: (Math.max(foreground, background) + .05) / (Math.min(foreground, background) + .05),
        viewportWidth: innerWidth,
      };
    });
    expect(measurements.list.scrollWidth).toBeLessThanOrEqual(measurements.list.clientWidth + 1);
    expect(measurements.card.x).toBeGreaterThanOrEqual(0);
    expect(measurements.card.x + measurements.card.width).toBeLessThanOrEqual(measurements.viewportWidth);
    expect(measurements.titleContrast).toBeGreaterThanOrEqual(4.5);
    await testInfo.attach(`recorder-placement-${lang}-measurements`, { body: JSON.stringify(measurements, null, 2), contentType: "application/json" });
    await testInfo.attach(`recorder-placement-${lang}-noc`, { body: await page.screenshot(), contentType: "image/png" });
    for (const name of [labels[lang].all, labels[lang].other]) {
      await page.getByRole("tab", { name, exact: true }).click();
      await expect(page.getByTestId("card-free-tour")).toBeHidden();
      await expect(page.locator(".lg2-explore-list .lg2-explore-card")).not.toHaveCount(0);
    }
    await page.goto(`${fixturePath}?lang=${lang}&fallback=1`);
    await page.getByRole("tab", { name: labels[lang].recording, exact: true }).click();
    await expectLastRecorder(page);
    await expect(page.getByTestId("strip-tour-weather")).toBeVisible();
    await expect(page.locator(".lg2-explore-list .lg2-explore-card")).toHaveCount(0);
    await page.getByRole("tab", { name: labels[lang].all, exact: true }).click();
    await expect(page.getByTestId("card-free-tour")).toBeHidden();
    for (const fallback of [0, 1]) {
      await page.goto(`${fixturePath}?lang=${lang}&enabled=0&fallback=${fallback}`);
      await expect(page.getByRole("tab", { name: labels[lang].recording, exact: true })).toHaveCount(0);
      if (!fallback) await page.getByRole("tab", { name: labels[lang].bike, exact: true }).click();
      await expect(page.getByTestId("card-free-tour")).toHaveCount(0);
    }
  });
}

test("recorder placement supports every empty eligible category without pseudo fallback", async ({ page }) => {
  for (const key of ["bike", "hike", "run", "activities"] as const) {
    await page.goto(`${fixturePath}?lang=en&empty=${key}`);
    await page.getByRole("tab", { name: labels.en[key], exact: true }).click();
    await expectLastRecorder(page);
    await expect(page.getByRole("tab", { name: labels.en.recording, exact: true })).toHaveCount(0);
    await expect(page.locator(".lg2-explore-list .lg2-explore-card")).toHaveCount(0);
  }
});

test("recorder placement resets obsolete pseudo selection on category/flag transitions and survives language changes", async ({ page }) => {
  await page.goto(`${fixturePath}?lang=sl&fallback=1&controls=1`);
  await page.getByRole("tab", { name: labels.sl.recording, exact: true }).click();
  await expectLastRecorder(page);
  await page.getByTestId("fixture-change-language").click();
  await expect(page.getByRole("tab", { name: labels.en.recording, exact: true })).toHaveAttribute("aria-selected", "true");
  await expectLastRecorder(page);
  await page.getByTestId("fixture-toggle-fallback").click();
  await expect(page.getByRole("tab", { name: labels.en.recording, exact: true })).toHaveCount(0);
  await expect(page.getByRole("tab", { name: labels.en.all, exact: true })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByTestId("card-free-tour")).toBeHidden();
  await expect(page.locator(".lg2-explore-list .lg2-explore-card")).not.toHaveCount(0);
  await page.getByTestId("fixture-toggle-fallback").click();
  await page.getByRole("tab", { name: labels.en.recording, exact: true }).click();
  await page.getByTestId("fixture-toggle-enabled").click();
  await expect(page.getByRole("tab", { name: labels.en.all, exact: true })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByTestId("card-free-tour")).toHaveCount(0);
  await expect(page.locator(".lg2-explore-list .lg2-explore-card")).not.toHaveCount(0);
});

test("recorder placement keeps a single mounted recorder and activity choice while navigating categories/language", async ({ page }) => {
  await page.goto(`${fixturePath}?lang=sl&controls=1`);
  await page.getByRole("tab", { name: labels.sl.bike, exact: true }).click();
  await page.getByTestId("radio-free-activity-running").check();
  const card = await page.getByTestId("card-free-tour").elementHandle();
  await page.getByRole("tab", { name: labels.sl.all, exact: true }).click();
  await expect(page.getByTestId("card-free-tour")).toBeHidden();
  await page.getByRole("tab", { name: labels.sl.hike, exact: true }).click();
  await page.getByTestId("fixture-change-language").click();
  await expect(page.getByRole("tab", { name: labels.en.hike, exact: true })).toHaveAttribute("aria-selected", "true");
  await expectLastRecorder(page);
  await expect(page.getByTestId("radio-free-activity-running")).toBeChecked();
  expect(await card!.evaluate(element => element === document.querySelector('[data-testid="card-free-tour"]'))).toBe(true);
});