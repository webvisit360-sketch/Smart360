import assert from "node:assert/strict";
import test, { mock } from "node:test";
import { randomUUID } from "node:crypto";
import express from "express";
import type { AddressInfo } from "node:net";
import { and, eq } from "drizzle-orm";
import {
  db, pool, tenantsTable, sectionsTable, categoriesTable, itemsTable, mediaTable,
  publishedSnapshotsTable, translationsTable, runWithDatabase, type Db,
} from "@workspace/db";
import {
  ensurePublishedSnapshotSchema, ensureTenantPublication, readPublishedContent,
  previewPublication, replacePublishedSnapshot, publishedSnapshotReferences,
} from "../lib/publishedSnapshots";
import publicTenantsRouter, { invalidateTenantCache } from "../routes/publicTenants";
import ordersRouter from "../routes/orders";

test("one snapshot isolates draft edits, retains deleted photos, diffs accurately, replaces atomically", async () => {
  await ensurePublishedSnapshotSchema();
  const [tenant] = await db.insert(tenantsTable).values({
    slug: `snapshot-test-${randomUUID()}`, name: "Snapshot fixture",
    isPublished: true, wifiPass: "never-show-this-secret", languages: ["sl", "en"],
  }).returning();
  const id = tenant!.id;
  let fixtureItemId: string | undefined;
  const app = express();
  app.use("/api", publicTenantsRouter);
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/public/tenants/${tenant!.slug}`;
  const getGuest = async () => {
    invalidateTenantCache();
    const response = await fetch(base);
    assert.equal(response.status, 200);
    return response.json() as Promise<Record<string, any>>;
  };
  try {
    const [section] = await db.insert(sectionsTable).values({
      tenantId: id, key: "explore", title: "Okolica",
    }).returning();
    const [category] = await db.insert(categoriesTable).values({
      sectionId: section!.id, key: "nature", label: "Narava", layout: "poi",
    }).returning();
    const [item] = await db.insert(itemsTable).values({
      categoryId: category!.id, title: "Zunanja telovadnica", body: "Prvotni opis",
    }).returning();
    fixtureItemId = item!.id;
    const [photo] = await db.insert(mediaTable).values({
      itemId: item!.id, kind: "image", url: "/api/storage/img/snapshot-fixture/old.jpg",
    }).returning();
    await db.insert(translationsTable).values({
      model: "item", recordId: item!.id, lang: "en", field: "body", value: "Original English",
    });
    await ensureTenantPublication(id);
    const initial = await readPublishedContent(id);
    const initialGuest = await getGuest();
    assert.equal(initialGuest.wifiPass, "never-show-this-secret");
    const getItem = (value: typeof initial, lang = "sl") =>
      value.languages[lang]!.tree.sections[0]!.categories[0]!.items[0]!;
    assert.equal(getItem(initial).body, "Prvotni opis");
    assert.equal(getItem(initial, "en").body, "Original English");
    assert.equal((await previewPublication(id)).total, 0);

    await db.update(itemsTable).set({ body: "Novi opis" }).where(eq(itemsTable.id, item!.id));
    await db.insert(mediaTable).values({
      itemId: item!.id, kind: "image", url: "/api/storage/img/snapshot-fixture/new.jpg", position: 1,
    });
    await db.delete(mediaTable).where(eq(mediaTable.id, photo!.id));
    await db.update(tenantsTable).set({ wifiPass: null }).where(eq(tenantsTable.id, id));
    // Cancellation is a read-only preview; reinitialization also never republishes drafts.
    const preview = await previewPublication(id);
    assert.equal(preview.total, 4);
    assert.equal(preview.added.length, 1);
    assert.equal(preview.changed.length, 1);
    assert.equal(preview.removed.length, 2);
    assert.ok(preview.changed.includes("Opis: Zunanja telovadnica"));
    assert.ok(preview.removed.includes("WiFi geslo"));
    assert.ok(preview.removed.some((line) => line.startsWith("Fotografija: Zunanja telovadnica")));
    assert.ok(!JSON.stringify(preview).includes("never-show-this-secret"));
    await ensureTenantPublication(id);
    assert.deepEqual(await readPublishedContent(id), initial);
    assert.deepEqual(await getGuest(), initialGuest);
    const search = await fetch(`${base}/search?q=${encodeURIComponent("Novi opis")}`);
    assert.deepEqual(await search.json(), []);
    assert.equal(await publishedSnapshotReferences(photo!.url), true);
    assert.equal((await previewPublication(id)).token, preview.token);

    // A failed publish rolls the entire replacement back.
    await assert.rejects(db.transaction(async (tx) => runWithDatabase(tx as unknown as Db, async () => {
      const [draft] = await db.select().from(tenantsTable).where(eq(tenantsTable.id, id)).for("update");
      await replacePublishedSnapshot(draft!);
      throw new Error("simulated publish rollback");
    })), /simulated publish rollback/);
    assert.deepEqual(await readPublishedContent(id), initial);

    await db.transaction(async (tx) => runWithDatabase(tx as unknown as Db, async () => {
      const [draft] = await db.select().from(tenantsTable).where(eq(tenantsTable.id, id)).for("update");
      await replacePublishedSnapshot(draft!);
      await db.update(tenantsTable).set({ hasUnpublishedChanges: false })
        .where(eq(tenantsTable.id, id));
    }));
    const published = await readPublishedContent(id);
    assert.equal(getItem(published).body, "Novi opis");
    assert.equal(published.languages.sl!.tree.wifiPass, null);
    assert.equal(getItem(published).media[0]!.url, "/api/storage/img/snapshot-fixture/new.jpg");
    assert.equal(await publishedSnapshotReferences(photo!.url), false);
    const rows = await db.select().from(publishedSnapshotsTable).where(eq(publishedSnapshotsTable.tenantId, id));
    assert.equal(rows.length, 1);
    assert.equal((await previewPublication(id)).total, 0);
    assert.notEqual((await previewPublication(id)).token, preview.token);
    const publishedGuest = await getGuest();
    assert.equal(publishedGuest.wifiPass, null);
    assert.equal(publishedGuest.sections[0].categories[0].items[0].body, "Novi opis");
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    if (fixtureItemId) await db.delete(translationsTable).where(eq(translationsTable.recordId, fixtureItemId));
    await db.delete(tenantsTable).where(eq(tenantsTable.id, id));
  }
});

test("a disposable destination-title draft is dirty and diffable without changing its snapshot", async () => {
  await ensurePublishedSnapshotSchema();
  const [tenant] = await db.insert(tenantsTable).values({
    slug: `snapshot-destination-title-${randomUUID()}`,
    name: "Destination title snapshot fixture",
    isPublished: true,
    hasUnpublishedChanges: false,
    languages: ["sl", "en", "de", "it"],
  }).returning();
  const id = tenant!.id;
  let sectionId: string | undefined;

  try {
    const [section] = await db.insert(sectionsTable).values({
      tenantId: id,
      key: "stay",
      title: "Vaša nastanitev",
      position: 0,
    }).returning();
    sectionId = section!.id;
    await db.insert(translationsTable).values([
      { model: "section", recordId: section!.id, field: "title", lang: "en", value: "Your stay" },
      { model: "section", recordId: section!.id, field: "title", lang: "de", value: "Ihr Aufenthalt" },
      { model: "section", recordId: section!.id, field: "title", lang: "it", value: "Il vostro soggiorno" },
    ]);
    await ensureTenantPublication(id);
    const publishedBefore = structuredClone(await readPublishedContent(id));

    await db.transaction(async (tx) => {
      await tx.update(sectionsTable)
        .set({ title: "Vaša destinacija" })
        .where(eq(sectionsTable.id, section!.id));
      for (const [lang, value] of [
        ["en", "Your destination"],
        ["de", "Ihre Destination"],
        ["it", "La vostra destinazione"],
      ] as const) {
        await tx.update(translationsTable)
          .set({ value, stale: false, updatedAt: new Date() })
          .where(and(
            eq(translationsTable.recordId, section!.id),
            eq(translationsTable.lang, lang),
          ));
      }
      await tx.update(tenantsTable)
        .set({ hasUnpublishedChanges: true })
        .where(eq(tenantsTable.id, id));
    });

    const [dirtyTenant] = await db.select().from(tenantsTable).where(eq(tenantsTable.id, id));
    assert.equal(dirtyTenant!.hasUnpublishedChanges, true);
    const preview = await previewPublication(id);
    assert.equal(preview.total, 4);
    assert.ok(preview.changed.includes("Naslov: Vaša destinacija"));
    for (const lang of ["en", "de", "it"]) {
      assert.ok(preview.changed.includes(`Naslov: ${
        lang === "en" ? "Your destination" : lang === "de" ? "Ihre Destination" : "La vostra destinazione"
      } — prevod (${lang})`));
    }
    assert.deepEqual(await readPublishedContent(id), publishedBefore);
  } finally {
    if (sectionId) {
      await db.delete(translationsTable).where(eq(translationsTable.recordId, sectionId));
    }
    await db.delete(tenantsTable).where(eq(tenantsTable.id, id));
  }
});

test("order HTTP request uses one publication when a replacement commits between auth and item resolution", async () => {
  const [tenant] = await db.insert(tenantsTable).values({
    slug: `snapshot-order-${randomUUID()}`, name: "Snapshot order fixture",
    isPublished: true, orderPassword: "original-password", orderNotifyEmail: false,
  }).returning();
  const id = tenant!.id;
  const app = express();
  app.use(express.json());
  app.use("/api", ordersRouter);
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  let restoreQuery: (() => void) | undefined;
  try {
    const [section] = await db.insert(sectionsTable).values({
      tenantId: id, key: "order", title: "Naročila",
    }).returning();
    const [category] = await db.insert(categoriesTable).values({
      sectionId: section!.id, key: "food", label: "Hrana", layout: "poi",
    }).returning();
    const [item] = await db.insert(itemsTable).values({
      categoryId: category!.id, title: "Izdelek", price: "10", orderEnabled: true,
    }).returning();
    await ensureTenantPublication(id);
    const next = structuredClone(await readPublishedContent(id));
    next.guestAccess.orderPassword = "replacement-password";
    for (const language of Object.values(next.languages)) {
      language.tree.sections[0]!.categories[0]!.items[0]!.price = "20";
    }
    let snapshotReads = 0, replaced = false;
    const originalQuery = pool.query.bind(pool);
    const queryMock = mock.method(pool, "query", async (...args: any[]) => {
      const text = typeof args[0] === "string" ? args[0] : args[0]?.text ?? "";
      if (text.startsWith("select") && text.includes('from "published_snapshots"')) snapshotReads++;
      if (!replaced && text.includes('from "orders"') && text.includes("idempotency_key")) {
        replaced = true;
        // Deliberate concurrent-publication interleaving during the actual route.
        await db.update(publishedSnapshotsTable)
          .set({ content: next as unknown as Record<string, unknown> })
          .where(eq(publishedSnapshotsTable.tenantId, id));
      }
      return (originalQuery as any)(...args);
    });
    restoreQuery = () => queryMock.mock.restore();
    const response = await fetch(
      `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/public/tenants/${tenant!.slug}/orders`,
      {
        method: "POST",
        headers: { "content-type": "application/json", "x-device-token": randomUUID(), "x-idempotency-key": randomUUID() },
        body: JSON.stringify({
          itemId: item!.id, qty: 1, guestName: "Testni gost", guestPhone: "041000000",
          guestUnit: "Test", orderPassword: "original-password",
        }),
      },
    );
    assert.equal(response.status, 201, await response.clone().text());
    assert.equal((await response.json() as { snapshotPrice: string }).snapshotPrice, "10");
    assert.equal(replaced, true);
    assert.equal(snapshotReads, 1, "auth and catalogue must not independently reread the snapshot");
  } finally {
    restoreQuery?.();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await db.delete(tenantsTable).where(eq(tenantsTable.id, id));
  }
});