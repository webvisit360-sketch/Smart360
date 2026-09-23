import { mkdir, writeFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";

const evidenceDir = "/tmp/host-direct-drafts-ui-evidence";
const now = "2026-09-22T12:00:00.000Z";
const names = [
  { name: "Slap Rinka", itemId: "host-created-item", materializationStatus: "created", label: "Ustvarjen osnutek" },
  { name: "Skriti razgled", itemId: "host-unlocated-item", materializationStatus: "created_without_coordinates", label: "Ustvarjen osnutek brez koordinat" },
  { name: "Krajinski park Logarska dolina", itemId: "existing-hidden-item", materializationStatus: "matched_existing", label: "Povezano z obstoječim vnosom" },
] as const;

async function installHostRoutes(page: Page) {
  await page.route("**/api/admin/tenants/manual-pin-test/host/onboarding", route => route.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify({
      tenantId: "manual-pin-test", tenantName: "Testna namestitev",
      rounds: [{
        id: "round-host-direct", round: 1, status: "submitted", revision: 1,
        updatedAt: now, createdAt: now, submittedAt: now,
        recommendations: names.map(({ name, itemId, materializationStatus }) => ({
          categoryKey: "explore", name, itemId, materializationStatus,
        })),
        customCategories: [], events: [], photos: [], targetReview: [],
        notification: { status: "sent", recipient: "", providerMessageId: null, error: null, attemptedAt: now },
      }],
    }),
  }));
  await page.route("**/api/admin/items/*/creator-status", route => {
    const itemId = new URL(route.request().url()).pathname.split("/")[4];
    return route.fulfill({
      status: 200, contentType: "application/json",
      body: JSON.stringify({
        activeMaterialization: itemId === "host-created-item",
        latitude: itemId === "host-created-item" ? 46.368 : null,
        longitude: itemId === "host-created-item" ? 14.636 : null,
      }),
    });
  });
  await page.route("**/api/admin/categories/manual-pin-explore/place-search?*", route => route.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify({
      originLatitude: 46.31, originLongitude: 14.91,
      candidates: [{
        name: "Logarska dolina", address: "Logarska dolina, Slovenija",
        osmType: "way", osmId: 1101539589,
        latitude: 46.3912165, longitude: 14.6283021,
        osmCategory: "boundary", osmFeatureType: "protected_area", osmAddressType: "boundary",
        straightLineDistanceM: 1000, roadDistanceM: 1200, travelDurationS: 600,
        routeStatus: "available", duplicate: true, duplicateLabel: "že v vodniku",
        duplicateMatch: {
          kind: "pending", id: "684fea42-f7f5-4589-8fbf-5c48d86f06ad",
          categoryId: "f357dded-b0b2-4e25-9b2b-89ac6529000f",
          category: "Naravna dediščina", name: "Logarska dolina", hidden: false,
        },
      }],
    }),
  }));
  await page.route("**/api/admin/tenants/manual-pin-test/creator/catalogue", route => route.fulfill({
    status: 200, contentType: "application/json", body: "[]",
  }));
  await page.route("**/api/admin/tenants/manual-pin-test/creator/proposals", route => route.fulfill({
    status: 200, contentType: "application/json", body: "[]",
  }));
}

test("host review shows three direct-draft statuses; unlocated draft editor saves a valid pin via coordinates POST", async ({ page }) => {
  await installHostRoutes(page);
  let pinBody: unknown;
  let pinned = false;
  await page.route("**/api/admin/items/host-unlocated-item/coordinates", route => {
    pinBody = route.request().postDataJSON();
    pinned = true;
    return route.fulfill({
      status: 200, contentType: "application/json",
      body: JSON.stringify({ itemId: "host-unlocated-item", latitude: 46.368, longitude: 14.636, distanceMeters: 12400, durationSeconds: 1200 }),
    });
  });
  await page.goto("/e2e/manual-pin-harness.html?hostDrafts=1");
  await expect(page.getByTestId("active-admin-tab")).toHaveText("host");
  for (const row of names) {
    const item = page.locator("li").filter({ hasText: row.name });
    await expect(item.getByRole("button", { name: `${row.label} · Odpri vnos` })).toBeVisible();
  }
  await mkdir(evidenceDir, { recursive: true });
  const statusStyles = [];
  for (const row of names) {
    const button = page.locator("li").filter({ hasText: row.name }).getByRole("button", { name: `${row.label} · Odpri vnos` });
    statusStyles.push({
      name: row.name, status: row.materializationStatus,
      ...await button.evaluate(element => ({
        label: element.textContent?.trim(),
        fontSize: getComputedStyle(element).fontSize,
        color: getComputedStyle(element).color,
        visible: element.getBoundingClientRect().width > 0,
      })),
    });
  }
  await writeFile(`${evidenceDir}/host-review-computed.json`, JSON.stringify({
    statusStyles,
    horizontalOverflow: await page.evaluate(() => document.body.scrollWidth > innerWidth),
  }, null, 2));
  await page.getByText("Vsebina gostitelja", { exact: true }).first().screenshot({ path: `${evidenceDir}/host-review-title.png` });
  await page.locator("section").filter({ has: page.getByRole("heading", { name: "Kraji v okolici" }) }).first()
    .screenshot({ path: `${evidenceDir}/host-review-three-statuses.png`, animations: "disabled" });
  for (const row of [names[0], names[2]]) {
    await page.locator("li").filter({ hasText: row.name })
      .getByRole("button", { name: `${row.label} · Odpri vnos` }).click();
    await expect(page.getByTestId("active-admin-tab")).toHaveText("content");
    const linkedEditor = page.getByRole("dialog", { name: "Uredi vnos" });
    await expect(linkedEditor.locator("input").first()).toHaveValue(row.name);
    await linkedEditor.getByRole("button", { name: "Prekliči" }).click();
    await page.getByRole("button", { name: "Vsebina gostitelja" }).click();
    await expect(page.getByTestId("active-admin-tab")).toHaveText("host");
  }
  await page.locator("li").filter({ hasText: "Skriti razgled" })
    .getByRole("button", { name: "Ustvarjen osnutek brez koordinat · Odpri vnos" }).click();
  await expect(page.getByTestId("active-admin-tab")).toHaveText("content");
  const editor = page.getByRole("dialog", { name: "Uredi vnos" });
  await expect(editor).toBeVisible();
  await expect(editor.locator("input").first()).toHaveValue("Skriti razgled");
  const pin = editor.getByTestId("entry-editor-pin");
  await expect(pin).toBeVisible();
  await pin.screenshot({ path: `${evidenceDir}/unlocated-entry-pin.png`, animations: "disabled" });
  await pin.getByLabel("Geografska širina *").fill("46.368");
  await pin.getByLabel("Geografska dolžina *").fill("14.636");
  await pin.getByLabel("Opis lokacije *").fill("Skriti razgled, pri Solčavi");
  await pin.getByRole("button", { name: "Shrani pin in izračunaj razdaljo" }).click();
  await expect.poll(() => pinBody).toEqual({
    latitude: 46.368, longitude: 14.636, locationText: "Skriti razgled, pri Solčavi",
  });
  await expect(pin.getByRole("alert")).toHaveCount(0);
  expect(pinned).toBe(true);
  await writeFile(`${evidenceDir}/pin-post.json`, JSON.stringify({ request: pinBody, response: { distanceMeters: 12400, durationSeconds: 1200 } }, null, 2));
  await editor.getByRole("button", { name: "Prekliči" }).click();
  await expect(editor).toBeHidden();
  await expect(page.getByTestId("card-skeleton-alignment")).toBeVisible();
  await expect(page.getByTestId("structure-distance-backfill")).toBeVisible();
  await page.getByTestId("existing-place-fixture").screenshot({ path: `${evidenceDir}/structure-actions.png`, animations: "disabled" });
});

test("pending Logarska search hit is selectable and saves without Creator prompt", async ({ page }) => {
  await installHostRoutes(page);
  const writes: unknown[] = [];
  await page.route("**/api/admin/categories/manual-pin-explore/places", route => {
    writes.push(route.request().postDataJSON());
    return route.fulfill({
      status: 201, contentType: "application/json",
      body: JSON.stringify({ id: "new-valley-draft", title: "Logarska dolina", isVisible: false }),
    });
  });
  await page.goto("/e2e/manual-pin-harness.html?hostDrafts=1");
  await page.getByRole("button", { name: "Dodaj kraj", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Dodaj kraj" });
  await dialog.getByPlaceholder(/npr\./).first().fill("Logarska dolina");
  await dialog.getByRole("button", { name: "Poišči" }).click();
  const candidate = dialog.getByRole("button", { name: /Logarska dolina.*Logarska dolina, Slovenija/ });
  await expect(candidate).toBeVisible();
  await candidate.click();
  await expect(candidate).toHaveAttribute("aria-pressed", "true");
  await expect(candidate).toHaveCSS("border-color", "rgb(21, 115, 71)");
  await expect(dialog.getByRole("alert").filter({ hasText: "Kreatorjevi vrsti" })).toHaveCount(0);
  await writeFile(`${evidenceDir}/pending-selected-computed.json`, JSON.stringify(
    await candidate.evaluate(element => ({
      pressed: element.getAttribute("aria-pressed"),
      borderWidth: getComputedStyle(element).borderWidth,
      borderColor: getComputedStyle(element).borderColor,
    })), null, 2));
  await dialog.screenshot({ path: `${evidenceDir}/pending-selected-no-prompt.png`, animations: "disabled" });
  await dialog.getByRole("button", { name: "Dodaj v vodnik" }).click();
  await expect(dialog).toBeHidden();
  expect(writes).toHaveLength(1);
  expect(writes[0]).toMatchObject({ mode: "nominatim", osmType: "way", osmId: 1101539589 });
  await writeFile(`${evidenceDir}/pending-create-request.json`, JSON.stringify(writes[0], null, 2));
});