import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

const fixtureBase = process.env.CANONICAL_FIXTURE_BASE_URL ?? "http://127.0.0.1:9137";

async function relay(
  page: Page,
  request: APIRequestContext,
  pattern: string,
  target: (url: URL) => string,
  fixtureTenantId?: string,
) {
  await page.route(pattern, async (route) => {
    const browserRequest = route.request();
    const url = new URL(browserRequest.url());
    const upstream = await request.fetch(`${fixtureBase}${target(url)}`, {
      method: browserRequest.method(),
      headers: {
        "content-type": browserRequest.headers()["content-type"] ?? "application/json",
        ...(fixtureTenantId ? { "x-emergency-fixture-tenant-id": fixtureTenantId } : {}),
      },
      data: browserRequest.postDataBuffer() ?? undefined,
      failOnStatusCode: false,
    });
    await route.fulfill({
      status: upstream.status(),
      headers: { "content-type": upstream.headers()["content-type"] ?? "application/json" },
      body: await upstream.body(),
    });
  });
}

test("actual editor confirms publish and reaches actual Living Guide", async ({ page, request }) => {
  const fixtureResponse = await request.get(`${fixtureBase}/fixture`);
  expect(fixtureResponse.ok()).toBe(true);
  const fixture = await fixtureResponse.json() as { tenantId: string };
  await relay(page, request, "**/__emergency-fixture/fixture", () => "/fixture");
  await relay(page, request, "**/__emergency-fixture/emergency-initialize", () => "/fixture/emergency-initialize");
  await relay(page, request, "**/api/admin/tenants/**", (url) =>
    `/_real-owner${url.pathname.slice("/api".length)}${url.search}`, fixture.tenantId);
  await relay(page, request, "**/api/public/tenants/**", (url) =>
    `/_real-public${url.pathname.slice("/api".length)}${url.search}`);

  await page.goto("/e2e/emergency-help-harness.html");
  await expect(page.getByText("Enotna evropska številka za klic v sili")).toBeVisible();
  await page.getByRole("button", { name: "Dodaj kontakt" }).click();
  await page.getByLabel("Naziv kontakta").fill("Dežurni zdravnik E2E");
  await page.getByLabel("Telefon").last().fill("+386 1 555 01 01");
  await page.getByRole("button", { name: "Shrani kontakte" }).click();
  await expect(page.getByText("Kontakti so shranjeni")).toBeVisible();

  await page.getByRole("button", { name: "Objavi spremembe" }).click();
  const dialog = page.getByTestId("publish-confirmation-dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("Dežurni zdravnik E2E");
  await dialog.getByRole("button", { name: "Objavi", exact: true }).click();

  const guestLink = page.getByTestId("emergency-fixture-guest-link");
  await expect(guestLink).toBeVisible();
  await guestLink.click();
  await expect(page).toHaveURL(/\?lang=de$/);
  await page.getByTestId("button-open-guide").click();
  await page.getByRole("button", { name: "Hilfe und Notfälle" }).click();
  await expect(page.getByTestId("emergency-help-sheet")).toContainText("Dežurni zdravnik E2E");
  await expect(page.getByTestId("emergency-help-sheet")).toContainText("+386 1 555 01 01");
});