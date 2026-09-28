import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { eq } from "drizzle-orm";
import {
  categoriesTable,
  db,
  itemDistanceProposalsTable,
  itemsTable,
  mediaTable,
  sectionsTable,
  tenantsTable,
} from "@workspace/db";
import { buildTenantOverviews, type TenantOverviewRow } from "../lib/tenantOverview";

async function withTenant(run: (tenantId: string) => Promise<void>) {
  const [tenant] = await db.insert(tenantsTable).values({
    slug: `overview-test-${randomUUID()}`,
    name: "Overview integration test",
  }).returning({ id: tenantsTable.id });
  try {
    await run(tenant!.id);
  } finally {
    await db.delete(tenantsTable).where(eq(tenantsTable.id, tenant!.id));
  }
}

async function section(tenantId: string, visible = true) {
  const [row] = await db.insert(sectionsTable).values({
    tenantId, key: randomUUID(), title: "Section", isVisible: visible,
  }).returning({ id: sectionsTable.id });
  return row!.id;
}

async function category(sectionId: string, options: { visible?: boolean; deleted?: boolean } = {}) {
  const [row] = await db.insert(categoriesTable).values({
    sectionId, label: "Category", layout: "text",
    isVisible: options.visible ?? true,
    deletedAt: options.deleted ? new Date() : null,
  }).returning({ id: categoriesTable.id });
  return row!.id;
}

async function item(categoryId: string, options: { visible?: boolean; deleted?: boolean; tint?: string } = {}) {
  const [row] = await db.insert(itemsTable).values({
    categoryId, title: "Item",
    isVisible: options.visible ?? true,
    deletedAt: options.deleted ? new Date() : null,
    tint: options.tint ?? null,
  }).returning({ id: itemsTable.id });
  return row!.id;
}

async function photo(itemId: string) {
  await db.insert(mediaTable).values({ itemId, url: `/test/${randomUUID()}.jpg` });
}

async function overview(tenantId: string): Promise<TenantOverviewRow> {
  const row = (await buildTenantOverviews()).find((entry) => entry.tenantId === tenantId);
  assert.ok(row, `Missing overview for fixture tenant ${tenantId}`);
  return row;
}

function check(row: TenantOverviewRow, key: string) {
  const found = row.checks.find((entry) => entry.key === key);
  assert.ok(found, `Missing readiness check ${key}`);
  return found.done;
}

test("empty categories need no art, while covered visible categories pass", async () => {
  await withTenant(async (tenantId) => {
    const sectionId = await section(tenantId);
    await category(sectionId); // Empty, and therefore absent from the guest guide.
    const hiddenOnly = await category(sectionId);
    await item(hiddenOnly, { visible: false });
    const withPhoto = await category(sectionId);
    await photo(await item(withPhoto));
    const withTint = await category(sectionId);
    await item(withTint, { tint: "#abcdef" });

    const row = await overview(tenantId);
    assert.equal(row.missingPhotos, 0);
    assert.equal(check(row, "photos"), true);
    assert.equal(check(row, "content"), true);
  });
});

test("all-empty guide passes photos but fails content", async () => {
  await withTenant(async (tenantId) => {
    const sectionId = await section(tenantId);
    await category(sectionId);
    const hiddenOnly = await category(sectionId);
    await item(hiddenOnly, { visible: false });

    const row = await overview(tenantId);
    assert.equal(row.missingPhotos, 0);
    assert.equal(check(row, "photos"), true);
    assert.equal(check(row, "content"), false);
  });
});

test("hidden and deleted ancestors/items do not contribute to content or missing photos", async () => {
  await withTenant(async (tenantId) => {
    const hiddenSection = await section(tenantId, false);
    const hiddenSectionCategory = await category(hiddenSection);
    await item(hiddenSectionCategory);

    const removedSection = await section(tenantId);
    const removedCategory = await category(removedSection);
    await item(removedCategory);
    await db.delete(sectionsTable).where(eq(sectionsTable.id, removedSection));

    const visibleSection = await section(tenantId);
    const hiddenCategory = await category(visibleSection, { visible: false });
    await item(hiddenCategory);
    const deletedCategory = await category(visibleSection, { deleted: true });
    await item(deletedCategory);
    const hiddenItemCategory = await category(visibleSection);
    await item(hiddenItemCategory, { visible: false });
    const deletedItemCategory = await category(visibleSection);
    await item(deletedItemCategory, { deleted: true });

    let row = await overview(tenantId);
    assert.equal(row.missingPhotos, 0);
    assert.equal(check(row, "photos"), true);
    assert.equal(check(row, "content"), false);

    const visibleItemId = await item(hiddenItemCategory);
    row = await overview(tenantId);
    assert.equal(row.missingPhotos, 1);
    assert.equal(check(row, "photos"), false);
    assert.equal(check(row, "content"), true);
    await photo(visibleItemId);
    row = await overview(tenantId);
    assert.equal(row.missingPhotos, 0);
    assert.equal(check(row, "photos"), true);
  });
});

test("media and tints on hidden or deleted items cannot cover a visible uncovered category", async () => {
  await withTenant(async (tenantId) => {
    const sectionId = await section(tenantId);
    const categoryId = await category(sectionId);
    await item(categoryId); // Visible but without artwork.
    await photo(await item(categoryId, { visible: false }));
    await photo(await item(categoryId, { deleted: true }));
    await item(categoryId, { visible: false, tint: "#ff0000" });
    await item(categoryId, { deleted: true, tint: "#00ff00" });

    const row = await overview(tenantId);
    assert.equal(row.missingPhotos, 1);
    assert.equal(check(row, "photos"), false);
    assert.equal(check(row, "content"), true);
  });
});

test("only guest-visible pending proposals block location readiness; admin pending count includes all", async () => {
  await withTenant(async (tenantId) => {
    const sectionId = await section(tenantId);
    const visibleCategory = await category(sectionId);
    const invisibleCategory = await category(sectionId, { visible: false });
    const deletedCategory = await category(sectionId, { deleted: true });
    const hiddenSection = await section(tenantId, false);
    const hiddenSectionCategory = await category(hiddenSection);
    const pendingItems = [
      await item(visibleCategory, { visible: false }),
      await item(visibleCategory, { deleted: true }),
      await item(invisibleCategory),
      await item(deletedCategory),
      await item(hiddenSectionCategory),
    ];
    await db.insert(itemDistanceProposalsTable).values(pendingItems.map((itemId) => ({
      tenantId, itemId, status: "pending", inputFingerprint: randomUUID(),
    })));

    let row = await overview(tenantId);
    assert.equal(row.pendingLocations, pendingItems.length);
    assert.equal(check(row, "locationsConfirmed"), true);

    const visibleItem = await item(visibleCategory, { tint: "#abcdef" });
    await db.insert(itemDistanceProposalsTable).values({
      tenantId, itemId: visibleItem, status: "pending", inputFingerprint: randomUUID(),
    });
    row = await overview(tenantId);
    assert.equal(row.pendingLocations, pendingItems.length + 1);
    assert.equal(check(row, "locationsConfirmed"), false);

    await db.update(itemDistanceProposalsTable).set({ status: "approved" })
      .where(eq(itemDistanceProposalsTable.itemId, visibleItem));
    row = await overview(tenantId);
    assert.equal(row.pendingLocations, pendingItems.length);
    assert.equal(check(row, "locationsConfirmed"), true);
  });
});