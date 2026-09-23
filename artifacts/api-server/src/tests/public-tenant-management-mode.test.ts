import assert from "node:assert/strict";
import crypto from "node:crypto";
import { once } from "node:events";
import test from "node:test";
import { eq } from "drizzle-orm";
import {
  categoriesTable,
  db,
  itemsTable,
  publishedSnapshotsTable,
  sectionsTable,
  tenantsTable,
} from "@workspace/db";
import { GetPublicTenantResponse } from "@workspace/api-zod";
import app from "../app";
import { ensureTenantPublication } from "../lib/publishedSnapshots";
import { invalidateTenantCache } from "../routes/publicTenants";

test("public tenant works in both management modes and with legacy snapshots without access policy", async (t) => {
  const slug = `public-mode-${crypto.randomUUID()}`;
  const [tenant] = await db.insert(tenantsTable).values({
    slug,
    name: "Guest policy isolation",
    mapUrl: "https://www.google.com/maps/search/?api=1&query=46.05%2C14.50",
    managementMode: "self_service",
    isPublished: true,
  }).returning();
  assert.ok(tenant);
  t.after(async () => {
    await db.delete(tenantsTable).where(eq(tenantsTable.id, tenant.id));
  });
  const [section] = await db.insert(sectionsTable).values({
    tenantId: tenant.id, key: "test", title: "Explore", isVisible: true,
  }).returning();
  const [category] = await db.insert(categoriesTable).values({
    sectionId: section!.id, key: "test", label: "Nearby", isVisible: true,
  }).returning();
  await db.insert(itemsTable).values({
    categoryId: category!.id, title: "Map destination", isVisible: true,
  });
  await ensureTenantPublication(tenant.id);

  const server = app.listen(0);
  await once(server, "listening");
  t.after(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const base = `http://127.0.0.1:${address.port}/api/public/tenants/${slug}`;
  const readGuest = async () => {
    const response = await fetch(base);
    if (response.status !== 200) {
      assert.fail(`Public tenant returned ${response.status}: ${await response.text()}`);
    }
    const body: unknown = await response.json();
    assert.equal(Object.hasOwn(body as object, "managementMode"), false);
    const parsed = GetPublicTenantResponse.parse(body);
    assert.equal(parsed.sections[0]?.categories[0]?.items[0]?.title, "Map destination");
    assert.equal(parsed.mapUrl,
      "https://www.google.com/maps/search/?api=1&query=46.05%2C14.50");
    return parsed;
  };
  const selfService = await readGuest();
  const [before] = await db.select({ content: publishedSnapshotsTable.content })
    .from(publishedSnapshotsTable).where(eq(publishedSnapshotsTable.tenantId, tenant.id));
  assert.ok(before);
  const snapshot = before.content as {
    languages: Record<string, { tree: { managementMode?: string } }>;
  };
  for (const language of Object.values(snapshot.languages)) {
    assert.equal(Object.hasOwn(language.tree, "managementMode"), false);
  }

  await db.update(tenantsTable).set({ managementMode: "concierge" })
    .where(eq(tenantsTable.id, tenant.id));
  // Bypass the short process-local guest cache to exercise the real snapshot
  // reader after a policy change, without publishing new guest content.
  invalidateTenantCache();
  const concierge = await readGuest();
  assert.deepEqual(concierge, selfService);
  const [after] = await db.select({ content: publishedSnapshotsTable.content })
    .from(publishedSnapshotsTable).where(eq(publishedSnapshotsTable.tenantId, tenant.id));
  assert.deepEqual(after?.content, before.content, "changing access policy must not publish guest content");

  // Simulate an older snapshot with the operator field still embedded in one
  // language. A read must strip it; the immutable stored snapshot stays intact.
  const oldSnapshot = structuredClone(snapshot);
  oldSnapshot.languages.sl.tree.managementMode = "concierge";
  await db.update(publishedSnapshotsTable).set({ content: oldSnapshot })
    .where(eq(publishedSnapshotsTable.tenantId, tenant.id));
  invalidateTenantCache();
  assert.deepEqual(await readGuest(), selfService);
  const [legacy] = await db.select({ content: publishedSnapshotsTable.content })
    .from(publishedSnapshotsTable).where(eq(publishedSnapshotsTable.tenantId, tenant.id));
  assert.equal((legacy!.content as typeof oldSnapshot).languages.sl!.tree.managementMode, "concierge");

  delete oldSnapshot.languages.sl.tree.managementMode;
  await db.update(publishedSnapshotsTable).set({ content: oldSnapshot })
    .where(eq(publishedSnapshotsTable.tenantId, tenant.id));
  invalidateTenantCache();
  assert.deepEqual(await readGuest(), selfService, "snapshot without managementMode must not produce 500");
});