import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { expect, test, type Page } from "@playwright/test";

const appOrigin = `https://${process.env.REPLIT_DEV_DOMAIN}`;
const reportDir = resolve(process.cwd(), "../../reports");
const sectionNames = [
  "Predlogi za okolico",
  "Gostiteljeve kategorije",
  "Dogodki",
  "Fotografije",
];

const baseTenant = {
  customDomain: null,
  subtitle: "Preverjanje obrazca",
  rating: null,
  reviewsCount: null,
  logoUrl: null,
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
  bgColor: "#E8DED1",
  theme: "swipe",
  guestUiMode: "living-guide",
  coverTitle: "Dobrodošli",
  coverSubtitle: null,
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
  isPublished: false,
  hasUnpublishedChanges: false,
  lastPublishedAt: null,
  firstPublishedAt: null,
  tenantType: "apartmaji",
  creatorOriginRegion: null,
  municipality: null,
  copiedFromTenantId: null,
  mediaQuotaBytes: 2_000_000_000,
  createdAt: "2026-09-01T10:00:00.000Z",
  renewsAt: "2027-09-01T10:00:00.000Z",
  updatedAt: "2026-09-22T11:45:00.000Z",
  sections: [],
};

const creatorProposal = (id: string, status: "pending" | "approved" | "rejected") => ({
  id,
  runId: "run-visual-fixture",
  proposedName: `Predlog ${id}`,
  normalizedName: `predlog ${id}`,
  originalQuery: `Predlog ${id}, Bled`,
  confirmedQuery: null,
  confirmationMethod: null,
  coordinateConfirmedBy: null,
  coordinateConfirmedByLabel: null,
  coordinateConfirmedAt: null,
  requiresIndividualReview: false,
  status,
  supersededBy: null,
  refusalReason: status === "rejected" ? "Ni primerno za vodnik" : null,
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
  createdAt: "2026-09-21T09:00:00.000Z",
  updatedAt: "2026-09-22T09:00:00.000Z",
});

function onboardingRound(kind: "draft" | "submitted") {
  const submitted = kind === "submitted";
  return {
    id: `${kind}-round`,
    round: 1,
    status: kind,
    data: submitted
      ? {
          accommodationName: "Apartma Triglav",
          address: "Jezerska cesta 12, Bled",
          guestPhone: "+386 40 123 456",
          guestEmail: "gostitelj@example.test",
        }
      : {},
    contentSections: [],
    photos: submitted
      ? [
          {
            id: "photo-one",
            fileName: "pogled-na-jezero.jpg",
            contentType: "image/jpeg",
            size: 124_000,
            status: "submitted",
            previewUrl: "https://fixture.invalid/lake.svg",
            mediaId: "media-one",
          },
          {
            id: "photo-two",
            fileName: "soba-z-balkonom.jpg",
            contentType: "image/jpeg",
            size: 98_000,
            status: "ready",
            previewUrl: "https://fixture.invalid/room.svg",
            mediaId: "media-two",
          },
        ]
      : [],
    updatedAt: submitted ? "2026-09-22T11:45:00.000Z" : "2026-09-22T10:15:00.000Z",
    submittedAt: submitted ? "2026-09-22T11:30:00.000Z" : null,
    revision: 4,
    canonicalRevision: "canonical-visual-4",
    targetReview: [],
    recommendations: submitted
      ? [
          { categoryKey: "Izleti", name: "Blejski grad", proposalId: "proposal-pending" },
          { categoryKey: "Hrana", name: "Gostilna ob poti", proposalId: "proposal-approved" },
        ]
      : [],
    customCategories: submitted
      ? [
          {
            id: "custom-category",
            name: "Skriti kotički ob jezeru",
            hostCreated: true,
            provenance: "host_onboarding",
            categoryId: "category-created",
            entries: [
              { id: "custom-entry", name: "Mirna razgledna točka", proposalId: "proposal-rejected" },
            ],
          },
        ]
      : [],
    events: submitted
      ? [{ id: "event-one", name: "Poletni koncert", date: "2026-07-18", time: "20:00", status: "pending" }]
      : [],
    notification: {
      status: "sent",
      recipient: "operator@example.test",
      providerMessageId: "fixture-message",
      error: null,
      attemptedAt: "2026-09-22T11:31:00.000Z",
    },
    createdAt: "2026-09-20T09:00:00.000Z",
  };
}

async function installFixture(page: Page, kind: "draft" | "submitted", writeRequests: string[]) {
  const tenantId = `host-form-${kind}-fixture`;
  const tenant = {
    ...baseTenant,
    id: tenantId,
    slug: tenantId,
    name: kind === "draft" ? "Hiša Osnutek" : "Hiša Oddano",
  };

  await page.route("**/api/**", async (route) => {
    if (route.request().method() !== "GET") writeRequests.push(`${route.request().method()} ${route.request().url()}`);
    await route.fulfill({ contentType: "application/json", body: "[]" });
  });
  await page.route("https://fixture.invalid/**", (route) =>
    route.fulfill({
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="220"><rect width="320" height="220" fill="#9FC7BA"/><circle cx="245" cy="65" r="34" fill="#F6D58A"/><path d="M0 175 85 80l55 58 42-39 138 121H0z" fill="#315E52"/></svg>',
    }));
  await page.route("**/api/admin/session", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ authenticated: true, email: "operator@example.test" }),
    }));
  await page.route("**/api/admin/host/session", (route) =>
    route.fulfill({ contentType: "application/json", body: JSON.stringify({ authenticated: false }) }));
  await page.route(`**/api/admin/tenants/${tenantId}`, (route) =>
    route.fulfill({ contentType: "application/json", body: JSON.stringify(tenant) }));
  await page.route(`**/api/admin/tenants/${tenantId}/operator-entry`, (route) =>
    route.fulfill({ contentType: "application/json", body: "{}" }));
  await page.route("**/api/admin/tenants/overview", (route) =>
    route.fulfill({ contentType: "application/json", body: "[]" }));
  await page.route(`**/api/admin/tenants/${tenantId}/renewals`, (route) =>
    route.fulfill({ contentType: "application/json", body: "[]" }));
  await page.route(`**/api/admin/tenants/${tenantId}/notification-configuration`, (route) =>
    route.fulfill({ contentType: "application/json", body: JSON.stringify({ configured: false }) }));
  await page.route(`**/api/admin/tenants/${tenantId}/host`, (route) =>
    route.fulfill({ contentType: "application/json", body: JSON.stringify({ account: null }) }));
  await page.route(`**/api/admin/tenants/${tenantId}/host/onboarding`, (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        tenantId,
        tenantName: tenant.name,
        rounds: [onboardingRound(kind)],
      }),
    }));
  await page.route(`**/api/admin/tenants/${tenantId}/creator/proposals`, (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify([
        creatorProposal("proposal-pending", "pending"),
        creatorProposal("proposal-approved", "approved"),
        creatorProposal("proposal-rejected", "rejected"),
      ]),
    }));

  return { tenantId, tenant };
}

async function openHostForm(page: Page, tenantId: string, tenantName: string) {
  await page.goto(`${appOrigin}/admin/tenants/${tenantId}`, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: tenantName })).toBeAttached();
  const previewBannerClose = page.getByRole("button", { name: "Close banner" });
  if (await previewBannerClose.isVisible()) await previewBannerClose.click();
  await page.getByRole("button", { name: "Nastavitve", exact: true }).click();
  await page.getByRole("tab", { name: "Obrazec za gostitelja", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Vsebina gostitelja" })).toBeVisible();
}

async function measure(page: Page) {
  const panel = page.getByRole("tabpanel");
  return panel.evaluate((element) => {
    const card = element.querySelector<HTMLElement>(".admin-ui-card")!;
    const statusRow = card.querySelector<HTMLElement>(".admin-ui-card-content > div > div")!;
    const statusItems = Array.from(statusRow.children).map((child) => {
      const box = (child as HTMLElement).getBoundingClientRect();
      return {
        text: child.textContent?.trim() || "",
        top: Math.round(box.top * 100) / 100,
        right: Math.round(box.right * 100) / 100,
        width: Math.round(box.width * 100) / 100,
      };
    });
    const statusLines: number[] = [];
    for (const top of statusItems.map((item) => item.top).sort((a, b) => a - b)) {
      if (!statusLines.some((lineTop) => Math.abs(lineTop - top) <= 4)) statusLines.push(top);
    }
    const sectionBoxes = Array.from(card.querySelectorAll<HTMLElement>("section")).map((section) => {
      const box = section.getBoundingClientRect();
      return {
        title: section.querySelector("h3")?.textContent?.trim() || "",
        clientWidth: section.clientWidth,
        scrollWidth: section.scrollWidth,
        left: Math.round(box.left * 100) / 100,
        right: Math.round(box.right * 100) / 100,
      };
    });
    return {
      viewport: { width: innerWidth, height: innerHeight },
      document: {
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
        overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      },
      panel: {
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
        overflowX: element.scrollWidth > element.clientWidth,
      },
      sections: sectionBoxes,
      sectionOverflow: sectionBoxes.some((section) => section.scrollWidth > section.clientWidth),
      status: {
        rowWidth: Math.round(statusRow.getBoundingClientRect().width * 100) / 100,
        rowHeight: Math.round(statusRow.getBoundingClientRect().height * 100) / 100,
        lineCount: statusLines.length,
        items: statusItems,
      },
    };
  });
}

async function measureTabs(page: Page) {
  return page.getByRole("tablist").evaluate((tabs) => {
    const scroller = document.querySelector<HTMLElement>(".admin-tenant-scroll")!;
    const listBox = tabs.getBoundingClientRect();
    const before = scroller.scrollLeft;
    scroller.scrollLeft = scroller.scrollWidth;
    const after = scroller.scrollLeft;
    scroller.scrollLeft = before;
    return {
      listWidth: Math.round(listBox.width * 100) / 100,
      scrollerClientWidth: scroller.clientWidth,
      scrollerScrollWidth: scroller.scrollWidth,
      horizontallyScrollable: scroller.scrollWidth > scroller.clientWidth,
      maximumObservedScrollLeft: after,
    };
  });
}

test("actual tenant Obrazec za gostitelja is compact, complete, and overflow-safe", async ({ browser }) => {
  await mkdir(reportDir, { recursive: true });
  const results: Record<string, unknown> = {};

  for (const kind of ["draft", "submitted"] as const) {
    for (const viewport of [
      { name: "desktop", width: 1440, height: 1000 },
      { name: "mobile", width: 390, height: 844 },
    ]) {
      const context = await browser.newContext({ viewport });
      const page = await context.newPage();
      const writeRequests: string[] = [];
      const { tenantId, tenant } = await installFixture(page, kind, writeRequests);
      await openHostForm(page, tenantId, tenant.name);
      await page.evaluate(async () => {
        await document.fonts.ready;
        await new Promise<void>((resolveFrame) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolveFrame())),
        );
      });

      await expect(page.getByText("Podatki gostitelja", { exact: true })).toHaveCount(0);
      await expect(page.getByText("Skupni osnutek vodnika", { exact: true })).toHaveCount(0);
      await expect(page.getByText(/Podatki obrazca so neposredno povezani/)).toHaveCount(0);
      await expect(page.getByText("Obvestilo operaterju", { exact: true })).toHaveCount(0);
      const sectionHeadings = await page.getByRole("tabpanel").locator("section > h3").allTextContents();
      expect(sectionHeadings).toEqual(sectionNames);
      expect(new Set(sectionHeadings).size).toBe(4);

      if (kind === "draft") {
        await expect(page.getByText("V izpolnjevanju", { exact: true })).toBeVisible();
        await expect(page.getByText("Ni predlogov za okolico.", { exact: true })).toBeVisible();
        await expect(page.getByText("Gostitelj ni predlagal svojih kategorij.", { exact: true })).toBeVisible();
        await expect(page.getByText("Ni predlaganih dogodkov.", { exact: true })).toBeVisible();
        await expect(page.getByText("Ni fotografij.", { exact: true })).toBeVisible();
        await expect(page.getByText("Ponovno odpri obrazec", { exact: true })).toHaveCount(0);
      } else {
        await expect(page.getByText("Oddano", { exact: true }).first()).toBeVisible();
        await expect(page.getByText("22. 09. 2026 11:30", { exact: true })).toBeVisible();
        await expect(page.getByText("Posodobljeno 22. 09. 2026 11:45", { exact: true })).toBeVisible();
        await expect(page.getByText("Čaka na pregled", { exact: true })).toBeVisible();
        await expect(page.getByText("Potrjeno", { exact: true })).toBeVisible();
        await expect(page.getByText("Zavrnjeno", { exact: true })).toBeVisible();
        await expect(page.getByText("Poletni koncert", { exact: true })).toBeVisible();
        await expect(page.getByAltText("pogled-na-jezero.jpg")).toBeVisible();
        await expect(page.getByAltText("soba-z-balkonom.jpg")).toBeVisible();
      }

      const measured = await measure(page);
      expect(measured.document.overflowX).toBe(false);
      expect(measured.panel.overflowX).toBe(false);
      expect(measured.sectionOverflow).toBe(false);
      expect(measured.sections.map((section) => section.title)).toEqual(sectionNames);
      for (const section of measured.sections) {
        expect(section.left).toBeGreaterThanOrEqual(0);
        expect(section.right).toBeLessThanOrEqual(viewport.width);
      }
      for (const item of measured.status.items) {
        expect(item.right).toBeLessThanOrEqual(viewport.width);
      }
      if (viewport.name === "mobile") expect(measured.status.lineCount).toBeGreaterThan(1);

      await page.getByRole("button", { name: "Nastavitve", exact: true }).click();
      await expect(page.getByRole("heading", { name: "Osnovni podatki" })).toBeVisible();
      const tabsMeasured = await measureTabs(page);
      if (viewport.name === "mobile") {
        expect(tabsMeasured.horizontallyScrollable).toBe(true);
        expect(tabsMeasured.maximumObservedScrollLeft).toBeGreaterThan(0);
      }
      await page.getByRole("tab", { name: "Videz", exact: true }).click();
      await expect(page.getByRole("heading", { name: "Fotografije gostitelja" })).toBeVisible();
      await page.getByRole("tab", { name: "Obrazec za gostitelja", exact: true }).click();
      await expect(page.getByRole("heading", { name: "Vsebina gostitelja" })).toBeVisible();
      await page.getByRole("button", { name: "Nastavitve", exact: true }).click();
      await page.getByRole("tab", { name: "Splošno", exact: true }).click();
      await expect(page.getByRole("heading", { name: "Osnovni podatki" })).toBeVisible();
      await page.getByRole("tab", { name: "Obrazec za gostitelja", exact: true }).click();
      await expect(page.getByRole("heading", { name: "Vsebina gostitelja" })).toBeVisible();

      expect(writeRequests).toEqual([]);
      const resultName = `${kind}-${viewport.name}`;
      results[resultName] = { ...measured, tabs: tabsMeasured, writeRequests };
      await page.screenshot({
        path: resolve(reportDir, `admin-tenant-host-form-${resultName}.png`),
        fullPage: true,
      });
      await context.close();
    }
  }

  await writeFile(
    resolve(reportDir, "admin-tenant-host-form-measurements.json"),
    `${JSON.stringify(results, null, 2)}\n`,
  );
});