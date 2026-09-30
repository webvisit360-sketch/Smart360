import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { expect, test, type Page } from "@playwright/test";

// Explicitly synthetic browser-only fixture. No account, production endpoint,
// API proxy or database is used: every /api/ request is fulfilled in-browser.
const id = "synthetic-admin-shell";
const base = process.env.SMART360_FIXTURE_URL ?? "http://127.0.0.1:4179";
const output = resolve(process.cwd(), "../../reports/admin-shell-synthetic");
const tenant = {
  id, slug: id, name: "Sintetična namestitev", subtitle: "",
  isPublished: false, hasUnpublishedChanges: false, theme: "mediterran",
  guestUiMode: "living-guide", mediaQuotaBytes: 2_000_000_000,
  languages: ["sl"], sections: [
    {
      id: "fixture-events", key: "events", title: "Dogodki", icon: "calendar-days",
      isVisible: true, position: 0, categories: [
        { id: "fixture-event-category", key: "events", label: "Aktivnosti", icon: "calendar-days",
          layout: "events", exploreGroup: "other", isVisible: true, position: 0, items: [
            { id: "fixture-event", title: "Sintetični večer", isVisible: true, position: 0, media: [] },
          ] },
      ],
    },
    {
      id: "fixture-offer", key: "offer", title: "Ponudba", icon: "shopping-bag",
      isVisible: true, position: 1, categories: [
        { id: "fixture-offer-category", key: "rent", label: "Izposoja", icon: "shopping-bag",
          layout: "products", exploreGroup: "najem", isVisible: true, position: 0, items: [
            { id: "fixture-offer-item", title: "Sintetično kolo", price: "10 €", isVisible: true, position: 0, media: [] },
          ] },
      ],
    },
    {
      id: "fixture-stay", key: "stay", title: "NEPOVEZANA SEKCIJA", icon: "home",
      isVisible: true, position: 2, categories: [
        { id: "fixture-stay-category", key: "stay", label: "NEPOVEZANA KATEGORIJA", icon: "home",
          layout: "text", exploreGroup: "other", isVisible: true, position: 0, items: [] },
      ],
    },
  ],
};

async function installSyntheticApi(page: Page, sections = tenant.sections) {
  const unexpected: string[] = [];
  await page.route("**/api/**", async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const method = request.method();
    let body: unknown;
    if (path === "/api/admin/session" && method === "GET") body = { authenticated: true, email: "synthetic@example.invalid" };
    else if (path === "/api/admin/host/session" && method === "GET") body = { authenticated: false };
    else if (path === `/api/admin/tenants/${id}/operator-entry` && method === "POST") body = {};
    else if (path === `/api/admin/tenants/${id}` && method === "GET") body = { ...tenant, sections };
    else if (path === `/api/public/tenants/${id}` && method === "GET") body = { ...tenant, sections };
    else if (path === `/api/admin/tenants/${id}/notification-configuration` && method === "GET") body = { configured: false };
    else if (path === "/api/admin/tenants/overview" && method === "GET") body = [];
    else if (method === "GET" && path.startsWith(`/api/admin/tenants/${id}/`)) body = [];
    else {
      if (method !== "GET") unexpected.push(`${method} ${path}`);
      await route.fulfill({ status: 404, contentType: "application/json", body: '{"error":"Not part of synthetic fixture"}' });
      return;
    }
    await route.fulfill({ contentType: "application/json", body: JSON.stringify(body) });
  });
  return unexpected;
}

async function measure(page: Page) {
  return page.evaluate(() => {
    const sidebar = document.querySelector(".admin-tenant-sidebar")!;
    const panel = document.querySelector<HTMLElement>('[role="tabpanel"][data-state="active"]')!;
    const box = (node: Element) => {
      const { x, y, width, height } = node.getBoundingClientRect();
      return { x, y, width, height };
    };
    return {
      viewport: { width: innerWidth, height: innerHeight },
      sidebar: box(sidebar), panel: box(panel),
      sidebarLabels: [...sidebar.querySelectorAll("button")].map(node => node.textContent?.trim()),
      panelText: panel.innerText,
    };
  });
}

test("synthetic browser API: actual shell, events and offer panels remain scoped", async ({ page }) => {
  const unexpected = await installSyntheticApi(page);
  await mkdir(output, { recursive: true });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`${base}/admin/tenants/${id}`, { waitUntil: "domcontentloaded" });
  const sidebar = page.locator(".admin-tenant-sidebar");
  await expect(sidebar.getByRole("button", { name: "Pregled" })).toBeVisible();
  await expect(sidebar.getByRole("button", { name: "Kreator vodnika" })).toBeVisible();
  await expect(sidebar.getByRole("button", { name: "Obvestila", exact: true })).toHaveCount(0);
  const shell = await measure(page);
  expect(shell.sidebarLabels.indexOf("Kreator vodnika")).toBeGreaterThan(shell.sidebarLabels.indexOf("Nastavitve"));
  await page.screenshot({ path: `${output}/shell.png`, animations: "disabled" });

  await sidebar.getByRole("button", { name: "Dogodki" }).click();
  await expect(page.getByRole("tabpanel")).toContainText("Sintetični večer");
  const events = await measure(page);
  expect(events.panelText).toContain("gostujočem Programu");
  expect(events.panelText).not.toContain("Sintetično kolo");
  expect(events.panelText).not.toContain("NEPOVEZANA");
  await page.screenshot({ path: `${output}/events.png`, animations: "disabled" });

  await sidebar.getByRole("button", { name: "Ponudba in cene" }).click();
  await expect(page.getByRole("tabpanel")).toContainText("Sintetično kolo");
  const offer = await measure(page);
  expect(offer.panelText).not.toContain("Sintetični večer");
  expect(offer.panelText).not.toContain("NEPOVEZANA");
  await page.screenshot({ path: `${output}/offer.png`, animations: "disabled" });

  expect(unexpected).toEqual([]);
  await writeFile(`${output}/measurements.json`, JSON.stringify({
    evidence: "SYNTHETIC browser-route fixture; not production or authenticated admin data",
    shell, events, offer,
  }, null, 2));
});

test("missing event section offers the existing owner creation dialog with the guest key", async ({ page }) => {
  const unexpected = await installSyntheticApi(page, tenant.sections.filter(section => section.key !== "events"));
  await page.goto(`${base}/admin/tenants/${id}`, { waitUntil: "domcontentloaded" });
  await page.locator(".admin-tenant-sidebar").getByRole("button", { name: "Dogodki" }).click();
  const panel = page.getByRole("tabpanel");
  await expect(panel).toContainText("Ta sekcija še ne obstaja");
  await expect(panel).not.toContainText("Sintetično kolo");
  await panel.getByRole("button", { name: "Dodaj sekcijo" }).click();
  const dialog = page.getByRole("dialog", { name: "Nova sekcija" });
  await expect(dialog.locator('input[value="events"]')).toBeDisabled();
  await expect(dialog.locator('input[value="Dogodki"]')).toBeVisible();
  // Do not save; this fixture never sends any section mutation.
  expect(unexpected).toEqual([]);
});