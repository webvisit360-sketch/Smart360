import { mkdir, writeFile } from "node:fs/promises";
import { expect, test, type Locator, type Page } from "@playwright/test";

const evidenceDir = "/tmp/manual-pin-three-map-evidence";
const proposal = {
  id: "11111111-1111-4111-8111-111111111111",
  runId: "22222222-2222-4222-8222-222222222222",
  proposedName: "Ljubenski most",
  normalizedName: "ljubenski most",
  originalQuery: "Ljubenski most",
  status: "unresolved",
  refusalReason: "no-results",
  requiresIndividualReview: false,
  lostSameCategoryCount: 0,
  nearestAlternatives: [],
  translations: [],
  latitude: null,
  longitude: null,
  straightLineDistanceM: null,
  roadDistanceM: null,
  travelDurationS: null,
  createdAt: "2026-09-03T20:30:00.000Z",
  updatedAt: "2026-09-03T20:30:00.000Z",
};

test("three actual admin map surfaces render vector geography independently", async ({ page }) => {
  const responses: Array<{ status: number; url: string }> = [];
  const failures: Array<{ error: string | null; url: string }> = [];
  const errors: string[] = [];
  const consoleMessages: Array<{ type: string; text: string }> = [];
  const results: Record<string, unknown> = {};

  page.on("response", (response) => {
    if (response.url().startsWith("https://tiles.openfreemap.org/")) {
      responses.push({ status: response.status(), url: response.url() });
    }
  });
  page.on("requestfailed", (request) =>
    failures.push({ error: request.failure()?.errorText ?? null, url: request.url() }));
  page.on("pageerror", (error) => errors.push(error.stack ?? error.message));
  page.on("console", (message) =>
    consoleMessages.push({ type: message.type(), text: message.text() }));

  await page.route("**/api/admin/tenants/manual-pin-test/creator/catalogue", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
  await page.route("**/api/admin/tenants/manual-pin-test/creator/proposals", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([proposal]) }));
  await page.route("**/api/admin/categories/manual-pin-explore/place-search?*", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ originLatitude: 46.31, originLongitude: 14.91, candidates: [] }),
    }));
  await page.route("**/api/admin/creator/origin-preview", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        lat: 46.31,
        lng: 14.91,
        source: "place",
        placeId: "fixture-only",
        originVerificationStatus: "verified",
        nominatimDisplayName: "Ljubno ob Savinji, Slovenija",
      }),
    }));

  async function capture(name: string, map: Locator, screenshotTarget: Locator, baseline: number) {
    await expect(map).toBeVisible();
    const canvas = map.locator("canvas");
    await expect(canvas).toBeVisible();
    await expect.poll(() => responses.slice(baseline).filter((item) =>
      item.status === 200 && /\/planet\/.*\.pbf/.test(item.url)).length)
      .toBeGreaterThan(0);
    await page.waitForTimeout(1_500);
    const dimensions = await canvas.evaluate((element) => {
      const canvasElement = element as HTMLCanvasElement;
      const rect = canvasElement.getBoundingClientRect();
      const gl = canvasElement.getContext("webgl2");
      return {
        width: rect.width,
        height: rect.height,
        webgl2: Boolean(gl),
        contextLost: gl?.isContextLost() ?? null,
      };
    });
    await screenshotTarget.screenshot({ path: `${evidenceDir}/${name}.png` });
    results[name] = {
      dimensions,
      tileResponses: responses.slice(baseline).filter((item) => /\/planet\/.*\.pbf/.test(item.url)),
      alerts: await screenshotTarget.locator('[role="alert"]:visible').allTextContents(),
    };
  }

  await mkdir(evidenceDir, { recursive: true });
  try {
    await page.goto("/e2e/manual-pin-harness.html");
    await page.getByTestId("creator-proposal-queue").waitFor();

    // Place creation: the map inside the visible Dodaj kraj dialog, not the queue behind it.
    let baseline = responses.length;
    await page.getByRole("button", { name: "Dodaj kraj", exact: true }).click();
    const dialog = page.locator('[role="dialog"]:visible').filter({ hasText: "Dodaj kraj" });
    await dialog.getByPlaceholder(/npr\./).first().fill("Neoznačena razgledna točka");
    await dialog.getByRole("button", { name: "Poišči" }).click();
    await dialog.getByRole("button", { name: /Ročno označi na zemljevidu/ }).click();
    await capture("dodaj-kraj", dialog.getByTestId("openfreemap-map"), dialog, baseline);
    page.once("dialog", (confirmation) => confirmation.accept());
    await dialog.getByRole("button", { name: "Close" }).click();
    await expect(dialog).toBeHidden();

    // The Creator proposal's own manual placement map.
    baseline = responses.length;
    await page.getByRole("button", { name: "Ročno določi" }).click();
    const proposalMap = page.getByTestId("creator-proposal-queue").getByTestId("openfreemap-map");
    await capture("creator-proposal-manual-pin", proposalMap, proposalMap.locator(".."), baseline);

    // Origin confirmation after an API-fixtured preview; never click the write action.
    baseline = responses.length;
    const origin = page.getByTestId("origin-confirmation-harness");
    await origin.locator("#mapUrl").fill("https://www.google.com/maps/place/fixture/@46.31,14.91,18z");
    await origin.getByRole("button", { name: "Analiziraj" }).click();
    await capture("origin-confirmation", origin.getByTestId("openfreemap-map"), origin, baseline);
  } finally {
    await writeFile(`${evidenceDir}/diagnostics.json`, JSON.stringify({
      surfaces: results,
      responses,
      failures,
      errors,
      consoleMessages,
    }, null, 2));
  }
});
