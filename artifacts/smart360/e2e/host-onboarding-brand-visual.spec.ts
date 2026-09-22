import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";

const appUrl = `https://${process.env.REPLIT_DEV_DOMAIN}/admin/onboarding`;
const reportDir = resolve(process.cwd(), "../../reports");
const logoPath = resolve(process.cwd(), "public/brand/smart360-znak-40.png");

const onboarding = {
  id: "visual-onboarding",
  tenantId: "visual-tenant",
  round: 1,
  status: "draft",
  data: { accommodationName: "Testna nastanitev", canonicalItems: [], media: [] },
  categories: [],
  contentSections: [],
  photos: [],
  updatedAt: "2026-09-22T00:00:00.000Z",
  submittedAt: null,
  revision: 1,
  canonicalRevision: "a".repeat(64),
};

async function installFixture(page: import("@playwright/test").Page) {
  await page.route("**/api/admin/host/session", route =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        authenticated: true,
        email: "visual@example.test",
        tenantId: "visual-tenant",
        onboardingRequired: true,
      }),
    }),
  );
  await page.route("**/api/admin/host/onboarding", route =>
    route.fulfill({ contentType: "application/json", body: JSON.stringify(onboarding) }),
  );
}

async function measurements(page: import("@playwright/test").Page) {
  return page.evaluate(async () => {
    const brand = document.querySelector<HTMLElement>('[data-testid="host-onboarding-brand"]')!;
    const image = brand.querySelector<HTMLImageElement>("img")!;
    const wordmark = brand.querySelector<HTMLElement>("span")!;
    const heading = document.querySelector<HTMLElement>("h1")!;
    const main = document.querySelector<HTMLElement>("main")!;
    const card = main.querySelector<HTMLElement>("section")!;
    const rect = (element: Element) => {
      const box = element.getBoundingClientRect();
      return { x: box.x, y: box.y, width: box.width, height: box.height };
    };
    const bytes = await fetch(image.currentSrc).then(response => response.arrayBuffer());
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    const imageSha256 = Array.from(new Uint8Array(digest))
      .map(byte => byte.toString(16).padStart(2, "0"))
      .join("");
    const style = getComputedStyle(wordmark);
    const brandStyle = getComputedStyle(brand);

    return {
      viewport: { width: innerWidth, height: innerHeight },
      brand: rect(brand),
      image: {
        ...rect(image),
        naturalWidth: image.naturalWidth,
        naturalHeight: image.naturalHeight,
        src: image.currentSrc,
        sha256: imageSha256,
      },
      wordmark: {
        ...rect(wordmark),
        text: wordmark.textContent,
        fontFamily: style.fontFamily,
        fontSize: style.fontSize,
        fontWeight: style.fontWeight,
        color: style.color,
        letterSpacing: style.letterSpacing,
      },
      gap: brandStyle.columnGap,
      gapBelow: heading.getBoundingClientRect().top - brand.getBoundingClientRect().bottom,
      heading: rect(heading),
      main: rect(main),
      card: rect(card),
      cardContentLeft: card.getBoundingClientRect().left +
        Number.parseFloat(getComputedStyle(card).paddingLeft),
    };
  });
}

test("host onboarding brand header at desktop and mobile", async ({ browser }) => {
  const expectedLogoSha256 = createHash("sha256")
    .update(await readFile(logoPath))
    .digest("hex");
  const results: Record<string, unknown> = { expectedLogoSha256 };

  for (const viewport of [
    { name: "desktop", width: 1440, height: 1000 },
    { name: "mobile", width: 390, height: 844 },
  ]) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
    });
    const page = await context.newPage();
    await installFixture(page);
    await page.goto(appUrl, { waitUntil: "networkidle" });
    await expect(page.getByTestId("host-onboarding-brand")).toBeVisible();
    await page.evaluate(() => document.fonts.ready);

    const measured = await measurements(page);
    expect(measured.image.sha256).toBe(expectedLogoSha256);
    expect(measured.image.width).toBe(46);
    expect(measured.image.height).toBe(46);
    expect(measured.wordmark.fontSize).toBe("24px");
    expect(measured.wordmark.fontWeight).toBe("800");
    expect(measured.wordmark.color).toBe("rgb(18, 26, 20)");
    expect(measured.wordmark.letterSpacing).toBe("0.48px");
    expect(measured.gap).toBe("12px");
    expect(measured.gapBelow).toBe(48);

    if (viewport.name === "desktop") {
      expect(measured.main.width).toBe(784);
      expect(measured.card.width).toBe(720);
      expect(measured.brand.x).toBe(measured.card.x);
    } else {
      expect(measured.brand.x).toBe(16);
      expect(measured.card.x).toBe(16);
    }

    results[viewport.name] = measured;
    await page.screenshot({
      path: resolve(
        reportDir,
        viewport.name === "desktop"
          ? "host-brand-final.png"
          : "host-brand-final-mobile.png",
      ),
    });
    await context.close();
  }

  await writeFile(
    resolve(reportDir, "host-brand-final-measurements.json"),
    `${JSON.stringify(results, null, 2)}\n`,
  );
});