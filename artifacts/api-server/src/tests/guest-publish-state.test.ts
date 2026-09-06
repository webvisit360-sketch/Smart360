import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";
import { eq } from "drizzle-orm";
import {
  categoriesTable,
  db,
  itemsTable,
  sectionsTable,
  tenantsTable,
} from "@workspace/db";
import {
  hasGuestVisibleTenantChanges,
} from "../lib/guestPublishState";
import { ensureGuestDirtyTriggers } from "../lib/guestDirtyTriggers";

test("tenant settings distinguish guest-visible changes from internal settings", () => {
  const before = {
    name: "Nastanitev",
    theme: "mediterran",
    orderNotifyEmail: true,
    notificationChannel: "email",
    mediaQuotaBytes: 2_000_000_000,
    renewsAt: null,
  };
  assert.equal(hasGuestVisibleTenantChanges(before, { name: "Novo ime" }), true);
  assert.equal(hasGuestVisibleTenantChanges(before, { theme: "poteg" }), true);
  assert.equal(hasGuestVisibleTenantChanges(before, {
    orderNotifyEmail: false,
    notificationChannel: "whatsapp",
    mediaQuotaBytes: 3_000_000_000,
    renewsAt: "2027-01-01T00:00:00.000Z",
  }), false);
  assert.equal(hasGuestVisibleTenantChanges(before, {
    name: "Nastanitev",
    theme: "mediterran",
  }), false);
});

test("guest-content trigger serializes both sides of publish", async (t) => {
  await ensureGuestDirtyTriggers();
  const suffix = crypto.randomUUID().slice(0, 8);
  const [tenant] = await db.insert(tenantsTable).values({
    slug: `dirty-race-${suffix}`,
    name: "Dirty race",
    isPublished: true,
  }).returning({ id: tenantsTable.id });
  const tenantId = tenant!.id;
  let secondTenantId: string | null = null;
  t.after(async () => {
    await db.delete(tenantsTable).where(eq(tenantsTable.id, tenantId));
    if (secondTenantId) {
      await db.delete(tenantsTable).where(eq(tenantsTable.id, secondTenantId));
    }
  });
  const [section] = await db.insert(sectionsTable).values({
    tenantId,
    key: `dirty-${suffix}`,
    title: "Nastanitev",
  }).returning({ id: sectionsTable.id });
  const [category] = await db.insert(categoriesTable).values({
    sectionId: section!.id,
    key: `dirty-${suffix}`,
    label: "Test",
  }).returning({ id: categoriesTable.id });
  const [item] = await db.insert(itemsTable).values({
    categoryId: category!.id,
    title: "Začetno",
  }).returning({ id: itemsTable.id });

  await db.update(tenantsTable)
    .set({ hasUnpublishedChanges: false })
    .where(eq(tenantsTable.id, tenantId));

  let releaseContent!: () => void;
  let contentHasLock!: () => void;
  const contentRelease = new Promise<void>((resolve) => { releaseContent = resolve; });
  const contentLocked = new Promise<void>((resolve) => { contentHasLock = resolve; });
  const contentFirst = db.transaction(async (tx) => {
    await tx.update(itemsTable)
      .set({ title: "Vsebina pred objavo" })
      .where(eq(itemsTable.id, item!.id));
    contentHasLock();
    await contentRelease;
  });
  await contentLocked;
  const publishSecond = db.transaction(async (tx) => {
    await tx.select({ id: tenantsTable.id })
      .from(tenantsTable)
      .where(eq(tenantsTable.id, tenantId))
      .for("update");
    await tx.update(tenantsTable)
      .set({ hasUnpublishedChanges: false, lastPublishedAt: new Date() })
      .where(eq(tenantsTable.id, tenantId));
  });
  releaseContent();
  await Promise.all([contentFirst, publishSecond]);
  let [state] = await db.select({
    dirty: tenantsTable.hasUnpublishedChanges,
  }).from(tenantsTable).where(eq(tenantsTable.id, tenantId));
  assert.equal(state!.dirty, false, "publish after a completed content transaction must be clean");

  let releasePublish!: () => void;
  let publishHasLock!: () => void;
  const publishRelease = new Promise<void>((resolve) => { releasePublish = resolve; });
  const publishLocked = new Promise<void>((resolve) => { publishHasLock = resolve; });
  const publishFirst = db.transaction(async (tx) => {
    await tx.select({ id: tenantsTable.id })
      .from(tenantsTable)
      .where(eq(tenantsTable.id, tenantId))
      .for("update");
    await tx.update(tenantsTable)
      .set({ hasUnpublishedChanges: false, lastPublishedAt: new Date() })
      .where(eq(tenantsTable.id, tenantId));
    publishHasLock();
    await publishRelease;
  });
  await publishLocked;
  const contentSecond = db.update(itemsTable)
    .set({ title: "Vsebina po objavi" })
    .where(eq(itemsTable.id, item!.id));
  releasePublish();
  await Promise.all([publishFirst, contentSecond]);
  [state] = await db.select({
    dirty: tenantsTable.hasUnpublishedChanges,
  }).from(tenantsTable).where(eq(tenantsTable.id, tenantId));
  assert.equal(state!.dirty, true, "content that waits behind publish must remain dirty");

  const [secondTenant] = await db.insert(tenantsTable).values({
    slug: `dirty-race-target-${suffix}`,
    name: "Dirty race target",
    isPublished: true,
  }).returning({ id: tenantsTable.id });
  secondTenantId = secondTenant!.id;
  const [secondSection] = await db.insert(sectionsTable).values({
    tenantId: secondTenantId,
    key: `dirty-target-${suffix}`,
    title: "Okolica",
  }).returning({ id: sectionsTable.id });
  const [secondCategory] = await db.insert(categoriesTable).values({
    sectionId: secondSection!.id,
    key: `dirty-target-${suffix}`,
    label: "Drugi najemnik",
  }).returning({ id: categoriesTable.id });
  await db.update(tenantsTable)
    .set({ hasUnpublishedChanges: false })
    .where(eq(tenantsTable.id, tenantId));
  await db.update(tenantsTable)
    .set({ hasUnpublishedChanges: false })
    .where(eq(tenantsTable.id, secondTenantId));

  await db.update(itemsTable)
    .set({ categoryId: secondCategory!.id })
    .where(eq(itemsTable.id, item!.id));
  const movedStates = await db.select({
    id: tenantsTable.id,
    dirty: tenantsTable.hasUnpublishedChanges,
  }).from(tenantsTable);
  const stateByTenant = new Map(movedStates.map((row) => [row.id, row.dirty]));
  assert.equal(stateByTenant.get(tenantId), true, "source tenant must be dirty after losing content");
  assert.equal(stateByTenant.get(secondTenantId), true, "target tenant must be dirty after gaining content");
});