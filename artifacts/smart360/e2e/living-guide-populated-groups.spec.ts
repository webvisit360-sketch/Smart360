import { mkdir, readFile, writeFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";

// Set this to a local JSON response from GET /api/public/tenants/<slug>.
// Playwright serves a copy of that payload; it never edits published content.
const fixturePath = process.env.SMART360_GUEST_PAYLOAD_FIXTURE;
const slug = process.env.SMART360_GUEST_FIXTURE_SLUG ?? "meli-pu";
const nowDeleted = "2025-01-01T00:00:00.000Z";
const routePath = (section: string) =>
  `/${slug}/s/${section}?ui=living-guide&theme=dan&lang=sl`;

test.skip(!fixturePath, "Set SMART360_GUEST_PAYLOAD_FIXTURE to a local public guest payload JSON file");

test("guest Ponudba and Nastanitev tabs track one/two populated groups", async ({ page }) => {
  test.setTimeout(120_000);
  const evidenceDir = "/tmp/living-guide-populated-groups-evidence";
  await mkdir(evidenceDir, { recursive: true });
  const fixture = JSON.parse(await readFile(fixturePath!, "utf8"));
  expect(fixture.sections?.map((section: any) => section.key)).toEqual(
    expect.arrayContaining(["offer", "stay"]),
  );
  fixture.slug = slug;
  fixture.guestUiMode = "living-guide";
  let secondVisible = false;
  const buildPayload = () => ({
    ...fixture,
    sections: fixture.sections.map((section: any) => {
      if (section.key !== "offer" && section.key !== "stay") return section;
      const keys = section.key === "offer"
        ? ["domaci_izdelki", "pri_hisi"]
        : ["vase_bivanje", "prihod_dostop"];
      const categories = keys.map((key, index) => ({
        ...(section.categories?.[0] ?? {}),
        id: `fixture-${section.key}-${index}`,
        label: `Fixture ${section.key} ${index}`,
        exploreGroup: key,
        isVisible: true,
        deletedAt: null,
        items: index === 0 || secondVisible
          ? [{
              ...(section.categories?.[0]?.items?.[0] ?? {}),
              id: `fixture-${section.key}-item-${index}`,
              title: `Fixture item ${section.key} ${index}`,
              isVisible: true,
              deletedAt: null,
              media: [],
            }]
          : [],
        media: [],
      }));
      // An empty section, hidden category, and deleted category cannot populate a group.
      categories.push({
        ...categories[1], id: `fixture-hidden-${section.key}`, label: `Hidden category ${section.key}`, isVisible: false,
        items: [{ ...categories[0].items[0], id: `fixture-hidden-item-${section.key}`, title: `Hidden item ${section.key}` }],
      });
      categories.push({
        ...categories[1], id: `fixture-hidden-item-category-${section.key}`,
        isVisible: true,
        label: `Unpublished category ${section.key}`,
        items: [{ ...categories[0].items[0], id: `fixture-unpublished-item-${section.key}`, title: `Unpublished item ${section.key}`, isVisible: false }],
      });
      categories.push({
        ...categories[1], id: `fixture-deleted-category-${section.key}`,
        label: `Deleted category ${section.key}`, deletedAt: nowDeleted,
        items: [{ ...categories[0].items[0], id: `fixture-deleted-item-${section.key}`, title: `Deleted item ${section.key}` }],
      });
      if (section.key === "offer") {
        categories.push(...["najem", "izleti_prevozi"].map((key) => ({
          ...categories[1], id: `fixture-empty-${key}`, exploreGroup: key, isVisible: true, items: [],
        })));
      }
      return { ...section, isVisible: true, deletedAt: null, categories };
    }),
  });
  await page.route(new RegExp(`/api/public/tenants/${slug}(?:\\?|$)`), async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(buildPayload()) });
  });

  for (const section of ["offer", "stay"]) {
    await page.goto(routePath(section), { waitUntil: "domcontentloaded" });
    const screen = page.getByTestId(`screen-${section}`);
    await expect(screen).toBeVisible();
    await expect(screen.getByRole("tablist")).toHaveCount(0);
    await expect(screen.getByRole("button", { name: section === "offer"
      ? `Fixture item ${section} 0`
      : `Fixture ${section} 0` })).toBeVisible();
    await expect(screen.getByText(`Fixture ${section} 1`)).toHaveCount(0);
    for (const prefix of ["Hidden", "Unpublished", "Deleted"]) {
      await expect(screen.getByText(`${prefix} category ${section}`)).toHaveCount(0);
      await expect(screen.getByText(`${prefix} item ${section}`)).toHaveCount(0);
    }
    if (section === "offer") {
      await expect(screen.getByRole("tab", { name: /Najem|Izleti in prevozi/ })).toHaveCount(0);
    }
    await expect(page.locator(".guest-entry-splash")).toBeHidden();
    await screen.screenshot({ path: `${evidenceDir}/${section}-one-group-no-tab-row.png`, animations: "disabled" });
    await writeFile(`${evidenceDir}/${section}-one-group-computed.json`, JSON.stringify(
      await screen.evaluate((element) => ({
        tablists: element.querySelectorAll('[role="tablist"]').length,
        tabRowElements: element.querySelectorAll(".lg2-gtabs").length,
        scrollWidth: element.scrollWidth,
        clientWidth: element.clientWidth,
        bodyScrollWidth: document.body.scrollWidth,
        viewportWidth: innerWidth,
      })), null, 2));

    secondVisible = true;
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(screen.getByRole("tablist").getByRole("tab")).toHaveCount(2);
    await expect(screen.getByRole("tab", { name: /Najem|Izleti in prevozi/ })).toHaveCount(0);
    await screen.getByRole("tablist").getByRole("tab").nth(1).click();
    await expect(screen.getByRole("button", { name: section === "offer"
      ? `Fixture item ${section} 1`
      : `Fixture ${section} 1` })).toBeVisible();
    await expect(screen.getByRole("tablist").getByRole("tab").nth(1)).toHaveAttribute("aria-selected", "true");
    await expect(page.locator(".guest-entry-splash")).toBeHidden();
    await screen.screenshot({ path: `${evidenceDir}/${section}-two-groups-selected-second.png`, animations: "disabled" });
    secondVisible = false;
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(screen.getByRole("tablist")).toHaveCount(0);
    await expect(screen.getByRole("button", { name: section === "offer"
      ? `Fixture item ${section} 0`
      : `Fixture ${section} 0` })).toBeVisible();
  }
});