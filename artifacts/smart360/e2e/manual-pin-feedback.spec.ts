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
  await page.route("https://tile.openstreetmap.org/**", (route) => route.abort());
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