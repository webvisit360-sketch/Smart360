import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import test from "node:test";
import express from "express";
import { and, eq, isNull, isNotNull } from "drizzle-orm";
import { db, runWithHostDbContext, tenantsTable, sectionsTable, categoriesTable, itemsTable } from "@workspace/db";
import contentRouter from "../routes/adminContent";
import { actorStorage } from "../lib/actorContext";
import { logger } from "../lib/logger";
import { buildTenantContent } from "../lib/contentTree";
import { ensurePublishedSnapshotSchema, ensureTenantPublication, readPublishedContent } from "../lib/publishedSnapshots";
import { ensureRowLevelSecurity } from "../lib/rls";

test("section trash keeps published snapshot, restores only independently active descendants, and isolates tenant trash", async (t) => {
  assert.notEqual(process.env.NODE_ENV, "production");
  if (!process.env.DATABASE_URL) return t.skip("development database unavailable");
  await ensurePublishedSnapshotSchema();
  await ensureRowLevelSecurity();
  const tenantIds: string[] = [];
  const fixture = async () => {
    const [tenant] = await db.insert(tenantsTable).values({
      slug: `section-trash-${randomUUID()}`, name: "Section trash fixture", isPublished: true,
    }).returning();
    tenantIds.push(tenant!.id);
    const [section] = await db.insert(sectionsTable).values({
      tenantId: tenant!.id, key: "fixture", title: "Fixture section",
    }).returning();
    const [category] = await db.insert(categoriesTable).values({
      sectionId: section!.id, label: "Fixture category",
    }).returning();
    const [independentlyDeletedCategory] = await db.insert(categoriesTable).values({
      sectionId: section!.id, label: "Deleted fixture category", deletedAt: new Date(),
    }).returning();
    const [item, independentlyDeleted] = await db.insert(itemsTable).values([
      { categoryId: category!.id, title: "Visible fixture item" },
      { categoryId: category!.id, title: "Deleted fixture item", deletedAt: new Date() },
    ]).returning();
    return { tenant: tenant!, section: section!, category: category!, item: item!,
      independentlyDeleted: independentlyDeleted!, independentlyDeletedCategory: independentlyDeletedCategory! };
  };
  const first = await fixture();
  const second = await fixture();
  await runWithHostDbContext(first.tenant.id, async () => {
    assert.deepEqual((await db.select({ id: sectionsTable.id }).from(sectionsTable))
      .map(row => row.id), [first.section.id], "host cannot read foreign section");
  });
  await ensureTenantPublication(first.tenant.id);
  const before = await readPublishedContent(first.tenant.id);
  const app = express();
  app.use(express.json());
  // Trusted owner actor injection is confined to this disposable route harness;
  // no account, login, password, or persistent operator session is created.
  app.use((req, _res, next) => {
    req.actor = { kind: "owner" };
    req.log = logger.child({ fixture: "section-trash" });
    actorStorage.run(req.actor, next);
  });
  app.use("/api", contentRouter);
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const root = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/admin`;
  const post = (path: string) => fetch(`${root}${path}`, { method: "POST" });
  try {
    assert.equal((await post(`/sections/${first.section.id}/trash`)).status, 200);
    assert.deepEqual(await readPublishedContent(first.tenant.id), before);
    const [draftTenant] = await db.select().from(tenantsTable).where(eq(tenantsTable.id, first.tenant.id));
    assert.equal((await buildTenantContent(draftTenant!, { visibleOnly: false })).sections.length, 0);
    assert.equal((await buildTenantContent(draftTenant!, { visibleOnly: true })).sections.length, 0);
    const trashed = await db.select().from(itemsTable).where(eq(itemsTable.id, first.item.id));
    assert.equal(trashed[0]?.deletedAt, null, "soft delete does not alter child timestamps");
    assert.equal((await post(`/items/${first.independentlyDeleted.id}/restore`)).status, 409);
    assert.equal((await post(`/categories/${first.independentlyDeletedCategory.id}/restore`)).status, 409);
    assert.equal((await fetch(`${root}/categories/${first.category.id}/items`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "Cannot create in trash" }),
    })).status, 404);
    const trash = await (await fetch(`${root}/tenants/${first.tenant.id}/trash`)).json() as {
      sections: Array<{ id: string }>;
      categories: Array<{ id: string; parentTrashed: boolean }>;
      items: Array<{ id: string; parentTrashed: boolean }>;
    };
    assert.deepEqual(trash.sections.map(s => s.id), [first.section.id]);
    assert.deepEqual(trash.categories.map(c => [c.id, c.parentTrashed]),
      [[first.independentlyDeletedCategory.id, true]]);
    assert.deepEqual(trash.items.map(i => [i.id, i.parentTrashed]),
      [[first.independentlyDeleted.id, true]]);
    assert.equal((await post(`/sections/${first.section.id}/restore`)).status, 200);
    const restored = (await buildTenantContent(draftTenant!, { visibleOnly: false })).sections;
    assert.equal(restored.length, 1);
    assert.deepEqual(restored[0]?.categories[0]?.items.map(i => i.id), [first.item.id]);
    assert.ok((await db.select().from(itemsTable).where(eq(itemsTable.id, first.independentlyDeleted.id)))[0]?.deletedAt);
    assert.ok((await db.select().from(categoriesTable)
      .where(eq(categoriesTable.id, first.independentlyDeletedCategory.id)))[0]?.deletedAt);
    assert.equal((await fetch(`${root}/items/${first.item.id}`, { method: "DELETE" })).status, 204);
    const itemTrash = await (await fetch(`${root}/tenants/${first.tenant.id}/trash`)).json() as {
      items: Array<{ id: string }>;
    };
    assert.deepEqual(itemTrash.items.map(row => row.id).sort(),
      [first.item.id, first.independentlyDeleted.id].sort(),
      "items deleted directly under an active category remain in trash after a fresh GET");
    await runWithHostDbContext(first.tenant.id, async () => {
      const hostTrashItems = await db.select({ id: itemsTable.id }).from(itemsTable)
        .innerJoin(categoriesTable, eq(itemsTable.categoryId, categoriesTable.id))
        .innerJoin(sectionsTable, eq(categoriesTable.sectionId, sectionsTable.id))
        .where(and(eq(sectionsTable.tenantId, first.tenant.id), isNotNull(itemsTable.deletedAt),
          isNull(categoriesTable.deletedAt), isNull(sectionsTable.deletedAt)));
      assert.deepEqual(hostTrashItems.map(row => row.id).sort(),
        [first.item.id, first.independentlyDeleted.id].sort(),
        "host sees directly deleted items through the same joins as GET trash");
    });
    assert.equal((await fetch(`${root}/tenants/${second.tenant.id}/trash`)).status, 200);
    assert.equal((await post(`/sections/${second.section.id}/restore`)).status, 404);
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve()));
    for (const id of tenantIds) await db.delete(tenantsTable).where(eq(tenantsTable.id, id));
  }
});