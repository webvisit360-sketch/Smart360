import { expect, test, type Page } from "@playwright/test";
import { OFFLINE_COPY } from "../src/pages/living-guide/living-guide-offline-model";
import { syntheticTenant } from "../src/pages/living-guide/living-guide-weather-fixture-data";

// UI-only fixtures. Worker/cache/network integration belongs to the canonical
// disposable tenant tests, not to this deliberately synthetic weather fixture.
async function cacheStatus(page: Page, offline: boolean, slug = "__weather-fixture") {
  await page.evaluate(({ offline, slug }) => {
    navigator.serviceWorker.dispatchEvent(new MessageEvent("message", {
      data: { type: "LG_OFFLINE_STATUS", offline, slug },
    }));
  }, { offline, slug });
}

for (const lang of ["sl", "en", "de", "it"] as const) {
  test(`saved-copy banner, fresh weather suppression and reconnect (${lang})`, async ({ page }) => {
    await page.goto(`/__weather-fixture/home?theme=dan&weather=calm&lang=${lang}`);
    const weather = page.getByTestId("card-home-weather");
    const banner = page.getByTestId("banner-guide-offline");
    await expect(weather).toBeVisible();
    await expect(banner).toHaveCount(0);
    const root = await page.locator("[data-living-guide-app]").elementHandle();
    await cacheStatus(page, true, "another-tenant");
    await expect(banner).toHaveCount(0);
    // Browser offline alone hides fresh weather, without falsely claiming cache.
    await page.evaluate(() => window.dispatchEvent(new Event("offline")));
    await expect(weather).toHaveCount(0);
    await expect(banner).toHaveCount(0);
    await cacheStatus(page, true);
    await expect(banner).toHaveText(OFFLINE_COPY[lang].banner);
    await expect(banner).toHaveCount(1);
    const bannerRect = await banner.boundingBox();
    expect(bannerRect?.y).toBe(0);
    await page.evaluate(() => window.dispatchEvent(new Event("online")));
    await expect(banner).toHaveCount(0);
    await expect(weather).toBeVisible();
    expect(await root?.evaluate((element) => element === document.querySelector("[data-living-guide-app]"))).toBe(true);
  });

  test(`offline send keeps message draft and does not queue (${lang})`, async ({ page }) => {
    let posts = 0;
    page.on("request", (request) => {
      if (request.method() === "POST" && request.url().includes("/messages")) posts++;
    });
    await page.goto(`/__weather-fixture/messages?theme=dan&lang=${lang}`);
    const input = page.getByTestId("messages-input").last();
    const send = page.getByTestId("messages-send").last();
    await expect(input).toBeVisible();
    await input.fill("Draft kept for an explicit retry");
    await cacheStatus(page, true);
    await send.click();
    await expect(page.getByTestId("messages-send-error").last()).toHaveText(OFFLINE_COPY[lang].retry);
    await expect(input).toHaveValue("Draft kept for an explicit retry");
    await page.evaluate(() => window.dispatchEvent(new Event("online")));
    await expect(input).toHaveValue("Draft kept for an explicit retry");
    expect(posts).toBe(0);
  });
}

test("direct detail boots without seeded history; Escape and phone Back return Home", async ({ page }) => {
  const detailUrl = "/__weather-fixture/c/c-hike/i/i-hike-1?lang=sl&theme=dan";
  for (const closeMethod of ["escape", "back"] as const) {
    // A fresh document entry, not fixture-written livingGuidePresentation.
    await page.goto(detailUrl);
    await expect(page.locator(".lg2-route-layer.v--det.on")).toBeVisible();
    await expect(page.locator(".lg2-detail-view").last()).toContainText("TEST pohod A");
    if (closeMethod === "escape") {
      await page.keyboard.press("Escape");
    } else {
      await page.evaluate(() => window.history.back());
    }
    await expect(page).toHaveURL(/\/__weather-fixture\/home(?:\?|$)/);
    await expect(page.locator(".lg2-route-layer.v--det")).toHaveCount(0);
    await expect(page.getByTestId("card-home-weather")).toBeVisible();
  }
});

test("cover issues no requests for unopened galleries", async ({ page }) => {
  const slug = "offline-media-test";
  const tenant: any = { ...syntheticTenant("sl"), slug, guestUiMode: "living-guide" };
  const photos = [1, 2, 3].map((index) => ({
    id: `unopened-${index}`, kind: "image", url: `/offline-test-gallery-${index}.jpg`, isVisible: true,
  }));
  const category = tenant.sections[1].categories[1];
  category.media = [photos[0]];
  category.items[0].media = [photos[1], photos[2]];
  const requested: string[] = [];
  await page.route(new RegExp(`/api/public/tenants/${slug}(?:\\?.*)?$`), (route) =>
    route.fulfill({ json: tenant }));
  await page.route("**/offline-test-gallery-*.jpg", (route) => {
    requested.push(route.request().url());
    return route.fulfill({ status: 200, contentType: "image/svg+xml", body: '<svg xmlns="http://www.w3.org/2000/svg" width="4" height="4"/>' });
  });
  await page.goto(`/${slug}/?lang=sl&theme=dan`);
  await expect(page.getByTestId("screen-cover")).toBeVisible();
  await expect(page.locator(".guest-entry-splash")).toHaveCount(0);
  expect(requested).toEqual([]);
  // The same media may load once the guest actually opens its detail.
  await page.goto(`/${slug}/c/c-hike/i/i-hike-1?lang=sl&theme=dan`);
  await expect(page.locator(".lg2-detail-view").last()).toContainText("TEST pohod A");
  await expect.poll(() => requested.length).toBeGreaterThan(0);
});