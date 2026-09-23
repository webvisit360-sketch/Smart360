import { mkdir, writeFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";

test("live public API renders guest home, Okolica, and a mapped detail", async ({ page }) => {
  const evidenceDir = "/tmp/manual-pin-three-map-evidence";
  const publicResponses: Array<{ status: number; url: string }> = [];
  const pageErrors: string[] = [];
  const failedRequests: Array<{ error: string | null; url: string }> = [];
  page.on("response", (response) => {
    if (response.url().includes("/api/public/tenants/")) {
      publicResponses.push({ status: response.status(), url: response.url() });
    }
  });
  page.on("pageerror", (error) => pageErrors.push(error.stack ?? error.message));
  page.on("requestfailed", (request) =>
    failedRequests.push({ error: request.failure()?.errorText ?? null, url: request.url() }));
  await mkdir(evidenceDir, { recursive: true });
  try {
    await page.goto("/meli-pu/home?ui=living-guide&theme=dan");
    const home = page.getByTestId("screen-home");
    await expect(home).toBeVisible();
    await expect(page.locator(".guest-entry-splash")).toBeHidden();
    await home.screenshot({ path: `${evidenceDir}/guest-home-live-api.png` });

    await page.goto("/meli-pu/s/explore?ui=living-guide&theme=dan");
    const explore = page.getByTestId("screen-explore");
    await expect(explore).toBeVisible();
    await expect(page.locator(".guest-entry-splash")).toBeHidden();
    const mappedItem = explore.getByRole("button", { name: /Restavracija Kamin/ });
    await expect(mappedItem).toBeVisible();
    await explore.screenshot({ path: `${evidenceDir}/guest-okolica-live-api.png` });

    await mappedItem.click();
    const detail = page.locator(".lg2-route-layer.v--det");
    await expect(detail).toBeVisible();
    const mapsLink = detail.locator("a[href*='google.com/maps'], a[href*='maps.google'], a[href*='maps.apple']");
    await expect(mapsLink.first()).toBeVisible();
    await detail.screenshot({ path: `${evidenceDir}/guest-mapped-detail-live-api.png` });
  } finally {
    await writeFile(`${evidenceDir}/guest-live-api-diagnostics.json`, JSON.stringify({
      publicResponses,
      pageErrors,
      failedRequests,
      url: page.url(),
    }, null, 2));
  }
});