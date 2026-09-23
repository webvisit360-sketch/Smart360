import { mkdir, writeFile } from "node:fs/promises";
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

const placeFields = [
  { id: "input-manual-place-name", error: "Vnesite ime kraja.", value: "Neoznačena razgledna točka" },
  { id: "input-manual-place-location", error: "Vnesite opis lokacije.", value: "Nad kampom" },
  { id: "input-manual-place-latitude", error: "Vnesite geografsko širino.", value: "46.362" },
  { id: "input-manual-place-longitude", error: "Vnesite geografsko dolžino.", value: "13.821" },
] as const;

async function openManualPlace(page: Page) {
  await installCommonRoutes(page, (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
  await page.goto("/e2e/manual-pin-harness.html");
  await page.getByRole("button", { name: "Dodaj kraj", exact: true }).click();
  const dialog = page.locator('[role="dialog"]:visible').filter({ hasText: "Dodaj kraj" });
  await dialog.getByPlaceholder(/npr\./).first().fill("Neoznačena razgledna točka");
  await dialog.getByRole("button", { name: "Poišči" }).click();
  await dialog.getByRole("button", { name: /Ročno označi na zemljevidu/ }).click();
  return dialog;
}

test("Dodaj kraj reports only missing manual fields inline and focuses the first invalid input", async ({ page }) => {
  let writes = 0;
  const dialogs: string[] = [];
  page.on("dialog", (dialog) => { dialogs.push(dialog.message()); void dialog.dismiss(); });
  await page.route("**/api/admin/categories/manual-pin-explore/places", (route) => {
    writes++;
    return route.fulfill({ status: 400, contentType: "application/json", body: '{"error":"Fixture: unexpected write"}' });
  });
  const dialog = await openManualPlace(page);
  const save = dialog.getByRole("button", { name: "Dodaj v vodnik" });

  await save.click();
  for (const field of placeFields) {
    const input = dialog.getByTestId(field.id);
    await expect(input).toHaveAttribute("aria-invalid", "true");
    await expect(input).toHaveCSS("border-width", "1px");
    await expect(input).toHaveCSS("border-color", "rgb(221, 154, 43)");
    await expect(dialog.getByText(field.error, { exact: true })).toBeVisible();
    await expect(input).toHaveAttribute("aria-describedby", new RegExp(`${field.id.replace("input-", "")}-error`));
  }
  await expect(dialog.getByTestId(placeFields[0].id)).toBeFocused();

  for (const missing of placeFields) {
    for (const field of placeFields) {
      await dialog.getByTestId(field.id).fill(field.id === missing.id ? "  " : field.value);
    }
    await save.click();
    if (missing.id === "input-manual-place-location") {
      const evidenceDir = "/tmp/manual-place-validation-evidence";
      await mkdir(evidenceDir, { recursive: true });
      await dialog.screenshot({ path: `${evidenceDir}/location-missing.png` });
      const locationInput = dialog.getByTestId(missing.id);
      const styles = await locationInput.evaluate((element) => {
        const style = getComputedStyle(element);
        return {
          borderWidth: style.borderWidth,
          borderColor: style.borderColor,
          focused: document.activeElement === element,
          ariaInvalid: element.getAttribute("aria-invalid"),
          describedBy: element.getAttribute("aria-describedby"),
        };
      });
      await writeFile(`${evidenceDir}/location-missing.json`, JSON.stringify({
        styles,
        visibleMessages: await dialog.locator('[role="alert"]:visible').allTextContents(),
      }, null, 2));
    }
    for (const field of placeFields) {
      const input = dialog.getByTestId(field.id);
      await expect(input).toHaveAttribute("aria-invalid", field.id === missing.id ? "true" : "false");
      if (field.id === missing.id) {
        await expect(dialog.getByText(field.error, { exact: true })).toBeVisible();
        await expect(input).toHaveCSS("border-color", "rgb(221, 154, 43)");
        await expect(input).toHaveCSS("border-width", "1px");
        await expect(input).toBeFocused();
      } else {
        await expect(dialog.getByText(field.error, { exact: true })).toHaveCount(0);
      }
    }
    await expect(dialog).toBeVisible();
  }
  expect(writes).toBe(0);
  expect(dialogs).toEqual([]);
});

test("Dodaj kraj rejects malformed/out-of-range coordinates, then shows service failures separately", async ({ page }) => {
  let writes = 0;
  const dialogs: string[] = [];
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("dialog", (dialog) => { dialogs.push(dialog.message()); void dialog.dismiss(); });
  await page.route("**/api/admin/categories/manual-pin-explore/places", (route) => {
    writes++;
    return route.fulfill({ status: 400, contentType: "application/json", body: '{"error":"Izhodišče nima koordinat."}' });
  });
  const dialog = await openManualPlace(page);
  for (const field of placeFields) await dialog.getByTestId(field.id).fill(field.value);
  const save = dialog.getByRole("button", { name: "Dodaj v vodnik" });
  for (const [lat, lng, invalid] of [
    ["abc", "13.821", "input-manual-place-latitude"],
    ["91", "13.821", "input-manual-place-latitude"],
    ["46.362", "Infinity", "input-manual-place-longitude"],
    ["46.362", "-181", "input-manual-place-longitude"],
  ] as const) {
    await dialog.getByTestId("input-manual-place-latitude").fill(lat);
    await dialog.getByTestId("input-manual-place-longitude").fill(lng);
    await save.click();
    await expect(dialog.getByTestId(invalid)).toHaveAttribute("aria-invalid", "true");
    await expect(dialog.getByTestId(invalid)).toBeFocused();
    await expect(dialog.locator('input[aria-invalid="true"]')).toHaveCount(1);
    await expect(dialog.getByTestId("openfreemap-map")).toBeVisible();
    if (lat === "91") {
      const evidenceDir = "/tmp/manual-place-validation-evidence";
      await mkdir(evidenceDir, { recursive: true });
      await dialog.screenshot({ path: `${evidenceDir}/invalid-latitude-91.png` });
    }
    expect(pageErrors).toEqual([]);
    expect(writes).toBe(0);
  }
  await dialog.getByTestId("input-manual-place-longitude").fill("13.821");
  await save.click();
  await expect(dialog.getByTestId("status-manual-place-service-error")).toHaveText("Izhodišče nima koordinat.");
  await expect(dialog.locator('input[aria-invalid="true"]')).toHaveCount(0);
  await expect(dialog).toBeVisible();
  expect(writes).toBe(1);
  expect(dialogs).toEqual([]);
  expect(pageErrors).toEqual([]);
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
