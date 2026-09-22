import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { expect, test, type Page } from "@playwright/test";

const tenantId = "appearance-fixture";
const appUrl = `https://${process.env.REPLIT_DEV_DOMAIN}/admin/tenants/${tenantId}`;
const reportDir = resolve(process.cwd(), "../../reports");
const preservedBackground = "#E8DED1";

const tenant = {
  id: tenantId,
  slug: "appearance-fixture",
  customDomain: null,
  name: "Hiša ob jezeru",
  subtitle: "Oddih v naravi",
  rating: null,
  reviewsCount: null,
  logoUrl: "https://fixture.invalid/logo.png",
  logoSquareUrl: null,
  heroUrl: null,
  livingGuideHeroUrl: null,
  tourUrl: null,
  phone: null,
  whatsapp: null,
  viber: null,
  instagram: null,
  email: "host@example.test",
  orderNotifyEmail: true,
  messageNotifyEmail: true,
  notificationChannel: "email",
  notificationWhatsappPhone: null,
  whatsappConfigured: false,
  orderPasswordConfigured: false,
  address: null,
  mapQuery: null,
  mapUrl: null,
  latitude: null,
  longitude: null,
  wifiSsid: null,
  wifiPass: null,
  wifiEnc: null,
  bgColor: preservedBackground,
  theme: "swipe",
  guestUiMode: "living-guide",
  coverTitle: "Dobrodošli ob jezeru",
  coverSubtitle: "Vaš oddih se začne tukaj",
  coverTitleSize: 48,
  coverTitleOpacity: 1,
  coverTextColor: "#FFFFFF",
  coverSubSize: 18,
  coverSubOpacity: 0.9,
  coverMetaSize: null,
  coverMetaOpacity: null,
  coverVeil: 0.25,
  tileVeil: 0.1,
  textScale: null,
  textFont: null,
  textColor: null,
  coverAlign: "left",
  coverShowRating: false,
  logoX: 50,
  logoY: 20,
  logoW: 25,
  logoOpacity: 1,
  navColorCover: "#FFFFFF",
  navColor: "#14201F",
  navColorOn: "#3B78DC",
  languages: ["sl"],
  livingGuideNav: null,
  isTemplate: false,
  isPublished: true,
  hasUnpublishedChanges: false,
  lastPublishedAt: "2026-09-22T10:00:00.000Z",
  firstPublishedAt: "2026-09-20T10:00:00.000Z",
  tenantType: "apartmaji",
  creatorOriginRegion: null,
  municipality: null,
  copiedFromTenantId: null,
  mediaQuotaBytes: 2_000_000_000,
  createdAt: "2026-09-01T10:00:00.000Z",
  renewsAt: "2027-09-01T10:00:00.000Z",
  updatedAt: "2026-09-22T10:00:00.000Z",
  sections: [],
};

async function installFixture(page: Page, capturedSaves: unknown[]) {
  await page.route("**/api/**", (route) =>
    route.fulfill({ contentType: "application/json", body: "[]" }));
  await page.route("**/api/admin/session", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ authenticated: true, email: "operator@example.test" }),
    }));
  await page.route("**/api/admin/host/session", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ authenticated: false }),
    }));
  await page.route(`**/api/admin/tenants/${tenantId}`, async (route) => {
    if (route.request().method() === "PATCH") {
      const body = route.request().postDataJSON();
      capturedSaves.push(body);
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ ...tenant, ...body }),
      });
      return;
    }
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(tenant),
    });
  });
  await page.route(`**/api/admin/tenants/${tenantId}/operator-entry`, (route) =>
    route.fulfill({ contentType: "application/json", body: "{}" }));
  await page.route("**/api/admin/tenants/overview", (route) =>
    route.fulfill({ contentType: "application/json", body: "[]" }));
  await page.route(`**/api/admin/tenants/${tenantId}/renewals`, (route) =>
    route.fulfill({ contentType: "application/json", body: "[]" }));
  await page.route(`**/api/admin/tenants/${tenantId}/notification-configuration`, (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ configured: false }),
    }));
  await page.route(`**/api/admin/tenants/${tenantId}/host`, (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ account: null }),
    }));
  await page.route("**/api/public/tenants/appearance-fixture?*", (route) =>
    route.fulfill({ contentType: "application/json", body: JSON.stringify(tenant) }));
  await page.route("https://fixture.invalid/**", (route) =>
    route.fulfill({
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180"><rect width="100%" height="100%" fill="#157347"/></svg>',
    }));
}

async function openAppearance(page: Page) {
  await page.goto(appUrl, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: tenant.name })).toBeAttached();
  const previewBannerClose = page.getByRole("button", { name: "Close banner" });
  if (await previewBannerClose.isVisible()) await previewBannerClose.click();
  await page.getByRole("button", { name: "Nastavitve", exact: true }).click();
  await page.getByRole("tab", { name: "Videz", exact: true }).click();
  await expect(page.getByRole("tabpanel")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Fotografije gostitelja" })).toBeVisible();
}

async function measurements(page: Page) {
  return page.getByRole("tabpanel").evaluate((panel) => {
    const allCards = Array.from(panel.querySelectorAll<HTMLElement>(".admin-ui-card"));
    const visibleCards = allCards.filter((card) => {
      const style = getComputedStyle(card);
      const box = card.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && box.width > 0 && box.height > 0;
    });
    const boxes = visibleCards.map((card) => {
      const box = card.getBoundingClientRect();
      return {
        title: card.querySelector("h3")?.textContent?.trim() ?? "",
        top: box.top,
        bottom: box.bottom,
        left: box.left,
        right: box.right,
        width: box.width,
        height: box.height,
      };
    });
    return {
      viewport: { width: innerWidth, height: innerHeight },
      documentOverflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      panelOverflowX: panel.scrollWidth > panel.clientWidth,
      visibleCardCount: boxes.length,
      visibleCards: boxes,
      gaps: boxes.slice(1).map((box, index) => box.top - boxes[index].bottom),
      panelTopGap: boxes[0]?.top - panel.getBoundingClientRect().top,
    };
  });
}

test("actual tenant Videz hides retired controls without leaving a layout gap", async ({ browser }) => {
  const results: Record<string, unknown> = {};

  for (const viewport of [
    { name: "desktop", width: 1440, height: 1000 },
    { name: "mobile", width: 390, height: 844 },
  ]) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
    });
    const page = await context.newPage();
    const capturedSaves: unknown[] = [];
    await installFixture(page, capturedSaves);
    await openAppearance(page);
    await page.evaluate(async () => {
      await document.fonts.ready;
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      );
    });

    await expect(page.getByText("Ozadje strani", { exact: true })).toHaveCount(0);
    await expect(page.getByText("Videz starega prikaza je shranjen", { exact: false })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Fotografije gostitelja" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Besedilo naslovnice" })).toBeVisible();
    await expect(page.getByText("Tema vmesnika", { exact: true })).toBeHidden();
    await expect(page.getByText("Logotip gostitelja", { exact: true })).toBeHidden();
    await expect(page.locator('[data-admin-preserve="cover-editor"]')).toBeHidden();
    await expect(page.getByText("Ikone spodaj", { exact: true })).toHaveCount(0);

    const measured = await measurements(page);
    expect(measured.documentOverflowX).toBe(false);
    expect(measured.panelOverflowX).toBe(false);
    expect(measured.visibleCardCount).toBe(2);
    expect(measured.visibleCards.map((card) => card.title)).toEqual([
      "Fotografije gostitelja",
      "Besedilo naslovnice",
    ]);
    expect(measured.panelTopGap).toBe(0);
    expect(measured.gaps).toEqual([24]);
    for (const card of measured.visibleCards) {
      expect(card.left).toBeGreaterThanOrEqual(0);
      expect(card.right).toBeLessThanOrEqual(viewport.width);
    }

    if (viewport.name === "desktop") {
      await page
        .getByRole("heading", { name: "Besedilo naslovnice" })
        .locator("xpath=ancestor::*[contains(@class,'admin-ui-card')]")
        .locator("input")
        .first()
        .fill("Posodobljen naslov");
      await expect.poll(() => capturedSaves.length).toBe(1);
      expect(capturedSaves[0]).toMatchObject({
        bgColor: preservedBackground,
        coverTitle: "Posodobljen naslov",
      });
    }

    results[viewport.name] = { ...measured, capturedSaves };
    await page.screenshot({
      path: resolve(reportDir, `admin-tenant-appearance-${viewport.name}.png`),
      fullPage: true,
    });
    await context.close();
  }

  await writeFile(
    resolve(reportDir, "admin-tenant-appearance-measurements.json"),
    `${JSON.stringify(results, null, 2)}\n`,
  );
});