import { expect, test, type Page, type Route } from "@playwright/test";

const proposalId = "11111111-1111-4111-8111-111111111111";
const fixedTime = "2026-09-03T20:30:00.000Z";
const unresolved = {
  id: proposalId,
  runId: "22222222-2222-4222-8222-222222222222",
  proposedName: "Ljubenski most",
  normalizedName: "ljubenski most",
  originalQuery: "Ljubenski most",
  confirmedQuery: null,
  confirmationMethod: null,
  coordinateConfirmedBy: null,
  coordinateConfirmedByLabel: null,
  coordinateConfirmedAt: null,
  requiresIndividualReview: false,
  status: "unresolved",
  supersededBy: null,
  refusalReason: "no-results",
  resolvedName: null,
  resolvedAddress: null,
  operatorAddress: null,
  osmType: null,
  osmId: null,
  osmCategory: null,
  osmFeatureType: null,
  osmAddressType: null,
  latitude: null,
  longitude: null,
  straightLineDistanceM: null,
  roadDistanceM: null,
  travelDurationS: null,
  categoryId: null,
  categoryLabel: null,
  range: null,
  geocodingLookupHint: null,
  inclusionReason: null,
  lostSameCategoryCount: 0,
  nearestAlternatives: [],
  translations: [],
  reviewedBy: null,
  reviewedAt: null,
  createdAt: fixedTime,
  updatedAt: fixedTime,
};
const saved = {
  ...unresolved,
  confirmedQuery: "operator-map-pin",
  confirmationMethod: "operator_coordinates",
  coordinateConfirmedBy: "33333333-3333-4333-8333-333333333333",
  coordinateConfirmedByLabel: "Testni operater",
  coordinateConfirmedAt: fixedTime,
  requiresIndividualReview: true,
  status: "pending",
  refusalReason: null,
  operatorAddress: "Ljubenski most, pri reki Savinji",
  latitude: 46.37,
  longitude: 14.83,
  roadDistanceM: 12_400,
  travelDurationS: 1_200,
  range: "near",
  updatedAt: fixedTime,
};

async function openManualPin(page: Page) {
  await page.goto("/e2e/manual-pin-harness.html");
  await expect(page.getByTestId("creator-proposal-queue")).toBeVisible();
  await page.getByRole("button", { name: "Ročno določi" }).click();
  await page.getByLabel("Zemljepisna širina").fill("46.37");
  await page.getByLabel("Zemljepisna dolžina").fill("14.83");
  await page.getByLabel("Lokacija (naslov ali opis lege)").fill(saved.operatorAddress);
}

async function installCommonRoutes(page: Page, proposals: (route: Route) => Promise<void>) {
  await page.route("**/api/admin/tenants/manual-pin-test/creator/catalogue", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
  await page.route("**/api/admin/tenants/manual-pin-test/creator/proposals", proposals);
  await page.route("**/api/admin/categories/manual-pin-explore/place-search?*", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        originLatitude: 46.31,
        originLongitude: 14.91,
        candidates: [],
      }),
    }));
}

test("manual pin success closes the form and updates the card before refetch", async ({ page }) => {
  let saveCompleted = false;
  let releaseRefresh!: () => void;
  const refreshGate = new Promise<void>((resolve) => {
    releaseRefresh = resolve;
  });
  await installCommonRoutes(page, async (route) => {
    if (saveCompleted) await refreshGate;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(saveCompleted ? [saved] : [unresolved]),
    });
  });
  await page.route("**/confirm-coordinates", async (route) => {
    saveCompleted = true;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(saved),
    });
  });

  await openManualPin(page);
  await page.getByRole("button", { name: "Shrani ročno točko" }).click();

  await expect(page.getByText("Ročno postavite točko")).toBeHidden();
  await expect(page.getByText(saved.operatorAddress)).toBeVisible();
  await expect(page.getByText(/Koordinate je ročno potrdil Testni operater/)).toBeVisible();
  await expect(page.getByText("Cestna razdalja 12.4 km")).toBeVisible();
  await expect(page.getByText("20 min vožnje")).toBeVisible();
  await expect(page.getByRole("button", { name: "Potrdi", exact: true })).toBeVisible();
  releaseRefresh();
});

test("manual pin failure stays open and shows the exact reason inline", async ({ page }) => {
  await installCommonRoutes(page, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([unresolved]),
    });
  });
  await page.route("**/confirm-coordinates", (route) =>
    route.fulfill({
      status: 400,
      contentType: "application/json",
      body: JSON.stringify({ error: "Izhodišče nima koordinat." }),
    }));

  await openManualPin(page);
  await page.getByRole("button", { name: "Shrani ročno točko" }).click();

  await expect(page.getByText("Ročno postavite točko")).toBeVisible();
  await expect(page.getByTestId(`manual-pin-error-${proposalId}`))
    .toHaveText(/Izhodišče nima koordinat\./);
});

test("OpenFreeMap loads in the actual Dodaj kraj manual flow without raster fallback", async ({ page }) => {
  const legacyRasterRequests: string[] = [];
  page.on("request", (request) => {
    if (request.url().startsWith("https://tile.openstreetmap.org/")) {
      legacyRasterRequests.push(request.url());
    }
  });
  await installCommonRoutes(page, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([unresolved]),
    });
  });

  await page.goto("/e2e/manual-pin-harness.html");
  await page.getByRole("button", { name: "Dodaj kraj", exact: true }).click();
  await page.getByPlaceholder(/npr\./).first().fill("Neoznačena razgledna točka");
  await page.getByRole("button", { name: "Poišči" }).click();
  const liveStyleResponse = page.waitForResponse((response) =>
    response.url().startsWith("https://tiles.openfreemap.org/styles/liberty")
      && response.ok());
  const liveVectorResponse = page.waitForResponse((response) =>
    response.url().startsWith("https://tiles.openfreemap.org/planet/")
      && response.url().endsWith(".pbf") && response.ok());
  await page.getByRole("button", { name: /Ročno označi na zemljevidu/ }).click();
  await Promise.all([liveStyleResponse, liveVectorResponse]);

  const dialog = page.locator('[role="dialog"]:visible');
  const map = dialog.getByRole("application", {
    name: /Zemljevid za ročno postavitev pina/,
  });
  await expect(map).toBeVisible();
  await expect(map.locator("canvas")).toBeVisible();
  await map.locator("canvas").click({ position: { x: 250, y: 85 } });
  await expect(page.getByPlaceholder("npr. 46.362")).not.toHaveValue("");
  await expect(page.getByPlaceholder("npr. 13.821")).not.toHaveValue("");
  const lat = dialog.getByPlaceholder("npr. 46.362");
  const lng = dialog.getByPlaceholder("npr. 13.821");
  const beforeDrag = `${await lat.inputValue()},${await lng.inputValue()}`;
  const marker = await map.locator(".maplibregl-marker").boundingBox();
  expect(marker).not.toBeNull();
  await page.mouse.move(marker!.x + marker!.width / 2, marker!.y + marker!.height / 2);
  await page.mouse.down();
  await page.mouse.move(marker!.x + marker!.width / 2 + 70, marker!.y + marker!.height / 2 + 35, { steps: 10 });
  await page.mouse.up();
  await expect.poll(async () => `${await lat.inputValue()},${await lng.inputValue()}`).not.toBe(beforeDrag);
  await expect(page.getByRole("link", { name: "OpenFreeMap" })).toBeVisible();
  await expect(page.getByRole("link", { name: "© OpenMapTiles" })).toBeVisible();
  await expect(page.getByRole("link", { name: "© OpenStreetMap contributors" })).toBeVisible();
  await expect.poll(() => legacyRasterRequests).toEqual([]);
});
