import { mkdir, writeFile } from "node:fs/promises";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

const fixtureBase = "http://127.0.0.1:9137";
const evidenceDir = "/tmp/group-tab-order-dev-evidence";
type Fixture = { tenantId: string; tenantSlug: string };

async function relay(page: Page, request: APIRequestContext, fixture: Fixture) {
  await page.route("**/api/admin/session", route => route.fulfill({
    contentType: "application/json", body: JSON.stringify({ authenticated: true, email: "fixture@example.invalid" }),
  }));
  await page.route("**/api/admin/host/session", route => route.fulfill({
    contentType: "application/json", body: JSON.stringify({ authenticated: false }),
  }));
  await page.route("**/api/admin/tenants/**", async route => {
    const incoming = route.request();
    const url = new URL(incoming.url());
    if (!url.pathname.startsWith(`/api/admin/tenants/${fixture.tenantId}`)) {
      await route.fulfill({ status: 404, contentType: "application/json", body: '{"error":"Outside disposable fixture"}' });
      return;
    }
    const upstream = await request.fetch(`${fixtureBase}/_real-owner${url.pathname.slice(4)}${url.search}`, {
      method: incoming.method(),
      headers: { "content-type": "application/json", "x-emergency-fixture-tenant-id": fixture.tenantId },
      data: incoming.postDataBuffer() ?? undefined,
      failOnStatusCode: false,
    });
    await route.fulfill({ status: upstream.status(), contentType: "application/json", body: await upstream.body() });
  });
  await page.route("**/api/admin/sections/**", async route => {
    const incoming = route.request();
    const url = new URL(incoming.url());
    const upstream = await request.fetch(`${fixtureBase}/_real-owner${url.pathname.slice(4)}${url.search}`, {
      method: incoming.method(), headers: { "content-type": "application/json" },
      data: incoming.postDataBuffer() ?? undefined, failOnStatusCode: false,
    });
    await route.fulfill({ status: upstream.status(), contentType: "application/json", body: await upstream.body() });
  });
  await page.route("**/api/public/tenants/**", async route => {
    const url = new URL(route.request().url());
    if (!url.pathname.startsWith(`/api/public/tenants/${fixture.tenantSlug}`)) {
      throw new Error("Refusing public request outside disposable fixture");
    }
    if (url.pathname !== `/api/public/tenants/${fixture.tenantSlug}`) {
      await route.continue();
      return;
    }
    const upstream = await request.get(`${fixtureBase}/_real-public${url.pathname.slice(4)}${url.search}`, { failOnStatusCode: false });
    await route.fulfill({ status: upstream.status(), contentType: "application/json", body: await upstream.body() });
  });
}

async function guestTabs(page: Page, section: string, slug: string) {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/${slug}/s/${section}?ui=living-guide&theme=dan&lang=sl`, { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId(`screen-${section}`)).toBeVisible();
  await expect(page.locator(".guest-entry-splash")).toBeHidden();
  const screen = page.getByTestId(`screen-${section}`);
  const tabs = screen.getByRole("tablist").getByRole("tab");
  await expect(tabs.first()).toBeVisible();
  return {
    labels: await tabs.allTextContents(),
    first: await tabs.first().getAttribute("aria-selected"),
    content: await screen.locator(".lg2-explore-list, .lg2-stay-list").innerText().catch(() => ""),
  };
}

test("real DEV fixture section-tab order: editor save, preview, publication, guest", async ({ page, request }) => {
  test.setTimeout(140_000);
  await mkdir(evidenceDir, { recursive: true });
  const fixtureResponse = await request.get(`${fixtureBase}/fixture`);
  expect(fixtureResponse.ok()).toBe(true);
  const fixture = await fixtureResponse.json() as Fixture;
  expect(fixture.tenantSlug).toMatch(/^cofx-[a-f0-9]+$/);
  const prepare = await request.post(`${fixtureBase}/fixture/group-order-prepare`, { failOnStatusCode: false });
  expect(prepare.ok() || prepare.status() === 409, await prepare.text()).toBe(true);
  await relay(page, request, fixture);

  const oldOffer = await guestTabs(page, "offer", fixture.tenantSlug);
  const oldStay = await guestTabs(page, "stay", fixture.tenantSlug);
  const oldExplore = await guestTabs(page, "explore", fixture.tenantSlug);
  await page.screenshot({ path: `${evidenceDir}/guest-stay-before.png`, animations: "disabled" });
  expect(oldOffer.labels[0]).toBe("Najem");
  expect(oldOffer.labels).toEqual(["Najem", "Domači izdelki"]);
  await guestTabs(page, "offer", fixture.tenantSlug);
  await page.screenshot({ path: `${evidenceDir}/guest-offer-before.png`, animations: "disabled" });

  await page.setViewportSize({ width: 1100, height: 900 });
  await page.goto(`/admin/tenants/${fixture.tenantId}`, { waitUntil: "domcontentloaded" });
  await page.getByRole("complementary").getByRole("button", { name: "Nastanitev", exact: true }).click();
  const offerHeading = page.getByRole("heading", { name: "Ponudba", exact: true }).first();
  await expect(offerHeading).toBeVisible();
  await offerHeading.locator("xpath=../../..").getByRole("button", { name: "Uredi sekcijo" }).click({ timeout: 8000 });
  const dialog = page.getByRole("dialog", { name: "Uredi sekcijo" });
  await expect(dialog.getByText("VRSTNI RED ZAVIHKOV")).toBeVisible();
  await expect(dialog.locator('[aria-label^="Povlecite "]')).toHaveCount(4);
  await expect(dialog.locator('[aria-label="Povlecite Izleti in prevozi"]')).toBeVisible();
  await expect(dialog.locator('[aria-label="Povlecite Pri hiši"]')).toBeVisible();
  await dialog.locator('[aria-label="Povlecite Domači izdelki"]').dragTo(
    dialog.locator('[aria-label="Povlecite Najem"]').locator(".."),
  );
  await expect(dialog.getByRole("button", { name: "Premakni Domači izdelki gor" })).toBeDisabled();
  await dialog.getByRole("button", { name: "Premakni Domači izdelki dol" }).click();
  await dialog.getByRole("button", { name: "Premakni Domači izdelki gor" }).click();
  await expect(dialog.getByRole("button", { name: "Premakni Domači izdelki gor" })).toBeDisabled();
  await page.screenshot({ path: `${evidenceDir}/editor-reordered-before-save.png`, animations: "disabled" });
  const saveResponse = page.waitForResponse(response =>
    response.url().includes(`/api/admin/sections/`) && response.request().method() === "PATCH");
  await dialog.getByRole("button", { name: "Shrani", exact: true }).click();
  expect((await saveResponse).status()).toBe(200);
  await expect(dialog).toBeHidden();
  const stayHeading = page.getByRole("heading", { name: "Vaše bivanje po meri", exact: true });
  await stayHeading.locator("xpath=../../..").getByRole("button", { name: "Uredi sekcijo" }).click();
  const stayDialog = page.getByRole("dialog", { name: "Uredi sekcijo" });
  await expect(stayDialog.locator('[aria-label^="Povlecite "]')).toHaveCount(3);
  await expect(stayDialog.getByRole("button", { name: "Premakni Vaše bivanje gor" })).toBeDisabled();
  await stayDialog.getByText("VRSTNI RED ZAVIHKOV").scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${evidenceDir}/stay-order-unchanged-editor.png`, animations: "disabled" });
  await stayDialog.getByRole("button", { name: "Prekliči" }).click();

  const dbTenant = await request.get(`${fixtureBase}/admin/tenant`);
  expect(dbTenant.ok()).toBe(true);
  const tenant = await dbTenant.json() as { sections: Array<{ key: string; groupOrder?: string[] | null }> };
  expect(tenant.sections.find(section => section.key === "offer")?.groupOrder).toEqual(
    ["domaci_izdelki", "najem", "izleti_prevozi", "pri_hisi"],
  );
  expect(tenant.sections.find(section => section.key === "stay")?.groupOrder ?? null).toBeNull();
  expect(tenant.sections.find(section => section.key === "explore")?.groupOrder ?? null).toBeNull();
  const publishButton = page.getByRole("button", { name: "Objavi spremembe" }).first();
  await expect(publishButton).toBeVisible();
  const orange = await publishButton.evaluate(element => ({
    backgroundColor: getComputedStyle(element).backgroundColor, className: element.className,
  }));
  expect(orange.backgroundColor).toBe("rgb(221, 154, 43)");
  expect(orange.className).toContain("publish-dirty-pulse");
  await page.screenshot({ path: `${evidenceDir}/real-orange-publish-button.png`, animations: "disabled" });

  const unpublishedOffer = await guestTabs(page, "offer", fixture.tenantSlug);
  expect(unpublishedOffer.labels).toEqual(oldOffer.labels);
  await page.screenshot({ path: `${evidenceDir}/guest-offer-before-publish.png`, animations: "disabled" });
  await page.setViewportSize({ width: 1100, height: 900 });
  await page.goto(`/admin/tenants/${fixture.tenantId}`, { waitUntil: "domcontentloaded" });
  await expect(publishButton).toBeVisible();
  await publishButton.click();
  const publishDialog = page.getByTestId("publish-confirmation-dialog");
  await expect(publishDialog).toBeVisible();
  await expect(publishDialog).toContainText("Spremenjen vrstni red zavihkov: Ponudba");
  await expect(publishDialog).toContainText("1 sprememb");
  await page.screenshot({ path: `${evidenceDir}/publish-preview-exact-change.png`, animations: "disabled" });
  const previewText = await publishDialog.innerText();
  const publishResponse = page.waitForResponse(response =>
    response.url().includes(`/api/admin/tenants/${fixture.tenantId}`) &&
    response.request().method() === "PATCH");
  await publishDialog.getByRole("button", { name: "Objavi", exact: true }).click();
  expect((await publishResponse).status()).toBe(200);

  const newOffer = await guestTabs(page, "offer", fixture.tenantSlug);
  expect(newOffer.labels[0]).toBe("Domači izdelki");
  expect(newOffer.first).toBe("true");
  await expect(page.getByTestId("screen-offer")).toContainText("Zasebni ogled");
  await page.screenshot({ path: `${evidenceDir}/guest-offer-after-publish.png`, animations: "disabled" });
  const newStay = await guestTabs(page, "stay", fixture.tenantSlug);
  expect(newStay.labels).toEqual(oldStay.labels);
  const explore = await guestTabs(page, "explore", fixture.tenantSlug);
  expect(explore.labels).toEqual(oldExplore.labels);
  expect(explore.content).toBe(oldExplore.content);
  await page.screenshot({ path: `${evidenceDir}/guest-stay-after-publish.png`, animations: "disabled" });
  const accept = await request.post(`${fixtureBase}/fixture/group-order-accept`, { failOnStatusCode: false });
  expect(accept.ok(), await accept.text()).toBe(true);
  await writeFile(`${evidenceDir}/computed.json`, JSON.stringify({
    fixtureSlug: fixture.tenantSlug, oldOffer, unpublishedOffer, newOffer, oldStay, newStay,
    oldExplore, explore, orange, previewText, sectionOrder: tenant.sections.map(section => ({
      key: section.key, groupOrder: section.groupOrder,
    })),
  }, null, 2));
});