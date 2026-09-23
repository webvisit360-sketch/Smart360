import assert from "node:assert/strict";
import test, { mock } from "node:test";
import { randomUUID } from "node:crypto";
import express from "express";
import type { AddressInfo } from "node:net";
import { and, eq, inArray } from "drizzle-orm";
import {
  changelogTable, db, pool, tenantsTable, sectionsTable, categoriesTable, itemsTable, mediaTable,
  publishedSnapshotsTable, translationsTable, runWithDatabase, type Db,
} from "@workspace/db";
import {
  ensurePublishedSnapshotSchema, ensureTenantPublication, readPublishedContent,
  previewPublication, replacePublishedSnapshot, publishedSnapshotReferences,
} from "../lib/publishedSnapshots";
import { alignTenantSkeleton } from "../lib/tenantSkeletonAlignment";
import { seedTenantContent } from "../lib/tenantSeeds";
import publicTenantsRouter, { invalidateTenantCache } from "../routes/publicTenants";
import ordersRouter from "../routes/orders";

test("empty custom category stays guest-hidden but is listed before publication", async () => {
  const [tenant] = await db.insert(tenantsTable).values({
    slug: `snapshot-empty-category-${randomUUID()}`,
    name: "Empty category preview fixture",
    isPublished: true,
  }).returning();
  assert.ok(tenant);
  try {
    const [section] = await db.insert(sectionsTable).values({
      tenantId: tenant.id,
      key: "offer",
      title: "Naša ponudba",
    }).returning();
    await ensureTenantPublication(tenant.id);
    const [category] = await db.insert(categoriesTable).values({
      sectionId: section!.id,
      key: `host-custom-${randomUUID()}`,
      label: "Skupna kuhinja",
      icon: "sparkle",
      layout: "products",
      exploreGroup: "najem",
    }).returning();
    await db.insert(changelogTable).values({
      tenantId: tenant.id,
      action: "create",
      entity: "category",
      summary: "Ustvarjena kategorija: Skupna kuhinja",
      actorType: "host",
      actorLabel: "Stranka",
      operationKey: `category-create:${category!.id}`,
    });
    const preview = await previewPublication(tenant.id);
    assert.ok(preview.added.includes("Skupna kuhinja"));
    const publishedTree = (await readPublishedContent(tenant.id)).languages.sl!.tree;
    assert.equal(
      publishedTree.sections.flatMap((publishedSection) => publishedSection.categories).length,
      0,
      "the unchanged guest snapshot must not expose the empty category",
    );

    await db.update(categoriesTable).set({ label: "Poletna kuhinja" })
      .where(eq(categoriesTable.id, category!.id));
    const renamedPreview = await previewPublication(tenant.id);
    assert.ok(renamedPreview.added.includes("Poletna kuhinja"));
    assert.ok(!renamedPreview.added.includes("Skupna kuhinja"));
    assert.notEqual(renamedPreview.token, preview.token);

    await db.insert(itemsTable).values({
      categoryId: category!.id,
      title: "Najem skupne kuhinje",
    });
    const nonEmptyPreview = await previewPublication(tenant.id);
    assert.equal(
      nonEmptyPreview.added.filter((line) => line === "Poletna kuhinja").length,
      1,
      "the audit-backed category must not duplicate the publication-tree addition",
    );

    await db.update(categoriesTable).set({ deletedAt: new Date() })
      .where(eq(categoriesTable.id, category!.id));
    const deletedPreview = await previewPublication(tenant.id);
    assert.ok(!deletedPreview.added.includes("Poletna kuhinja"));
    assert.notEqual(deletedPreview.token, nonEmptyPreview.token);
  } finally {
    await db.delete(tenantsTable).where(eq(tenantsTable.id, tenant.id));
  }
});

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

test("alignment normalizes one disposable tenant destination title idempotently without touching snapshots or another tenant", async () => {
  await ensurePublishedSnapshotSchema();
  const suffix = randomUUID();
  const [tenant, otherTenant] = await db.insert(tenantsTable).values([
    {
      slug: `snapshot-destination-title-${suffix}`,
      name: "Destination title snapshot fixture",
      tenantType: "apartmaji",
      isPublished: true,
      hasUnpublishedChanges: false,
      languages: ["sl", "en", "de", "it"],
    },
    {
      slug: `snapshot-destination-other-${suffix}`,
      name: "Untouched destination fixture",
      tenantType: "hotel",
      isPublished: true,
      hasUnpublishedChanges: false,
      languages: ["sl", "en", "de", "it"],
    },
  ]).returning();
  const id = tenant!.id;
  const otherId = otherTenant!.id;

  try {
    await seedTenantContent(id, "apartmaji");
    await seedTenantContent(otherId, "hotel");
    const [section] = await db.select().from(sectionsTable)
      .where(and(eq(sectionsTable.tenantId, id), eq(sectionsTable.key, "stay")));
    const [otherSection] = await db.select().from(sectionsTable)
      .where(and(eq(sectionsTable.tenantId, otherId), eq(sectionsTable.key, "stay")));
    await db.update(sectionsTable).set({ title: "Vaša nastanitev", position: 0 })
      .where(eq(sectionsTable.id, section!.id));
    await db.update(sectionsTable).set({ title: "Nedotaknjena nastanitev", position: 3 })
      .where(eq(sectionsTable.id, otherSection!.id));
    await db.update(translationsTable).set({ stale: true }).where(eq(translationsTable.recordId, section!.id));
    await db.update(translationsTable).set({
      value: "Your stay",
      stale: true,
    }).where(and(eq(translationsTable.recordId, section!.id), eq(translationsTable.lang, "en")));
    await db.update(translationsTable).set({
      value: "Ihr Aufenthalt",
      stale: true,
    }).where(and(eq(translationsTable.recordId, section!.id), eq(translationsTable.lang, "de")));
    await db.update(translationsTable).set({
      value: "Il vostro soggiorno",
      stale: true,
    }).where(and(eq(translationsTable.recordId, section!.id), eq(translationsTable.lang, "it")));
    await db.update(tenantsTable).set({ hasUnpublishedChanges: false })
      .where(inArray(tenantsTable.id, [id, otherId]));
    await ensureTenantPublication(id);
    await ensureTenantPublication(otherId);
    const publishedBefore = structuredClone(await readPublishedContent(id));
    const otherPublishedBefore = structuredClone(await readPublishedContent(otherId));
    const otherDraftBefore = await db.select().from(sectionsTable)
      .where(eq(sectionsTable.tenantId, otherId));

    const result = await alignTenantSkeleton(id);
    assert.ok(result);
    assert.equal(result.changed, true);
    assert.equal(result.counts.sectionsUpdated, 1);
    assert.equal(result.counts.translationsUpdated, 3);
    assert.deepEqual(result.titleChanges, [{
      key: "stay",
      oldTitle: "Vaša nastanitev",
      newTitle: "Vaša destinacija",
    }]);
    assert.deepEqual(result.stayTitleNormalization, {
      status: "changed",
      summary: "Naslov razdelka: »Vaša nastanitev« → »Vaša destinacija«. Usklajeni prevodi: 3.",
      titleChanged: true,
      translationsUpdated: 3,
    });
    const [normalized] = await db.select().from(sectionsTable).where(eq(sectionsTable.id, section!.id));
    assert.equal(normalized!.title, "Vaša destinacija");
    assert.equal(normalized!.position, 0);
    const normalizedTranslations = await db.select().from(translationsTable)
      .where(eq(translationsTable.recordId, section!.id));
    assert.deepEqual(
      normalizedTranslations.map(({ lang, value, stale }) => ({ lang, value, stale }))
        .sort((a, b) => a.lang.localeCompare(b.lang)),
      [
        { lang: "de", value: "Ihre Destination", stale: false },
        { lang: "en", value: "Your destination", stale: false },
        { lang: "it", value: "La vostra destinazione", stale: false },
      ],
    );

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
    assert.deepEqual(await readPublishedContent(otherId), otherPublishedBefore);
    assert.deepEqual(
      await db.select().from(sectionsTable).where(eq(sectionsTable.tenantId, otherId)),
      otherDraftBefore,
    );
    assert.equal(otherSection!.title, "Vaša destinacija");
    const [otherAfter] = await db.select().from(tenantsTable).where(eq(tenantsTable.id, otherId));
    assert.equal(otherAfter!.hasUnpublishedChanges, false);

    const replay = await alignTenantSkeleton(id);
    assert.ok(replay);
    assert.equal(replay.changed, false);
    assert.equal(replay.summary, "Brez sprememb.");
    assert.deepEqual(replay.titleChanges, []);
    assert.deepEqual(replay.stayTitleNormalization, {
      status: "no_changes",
      summary: "Naslov razdelka: Brez sprememb.",
      titleChanged: false,
      translationsUpdated: 0,
    });

    const offPositionResult = await alignTenantSkeleton(otherId);
    assert.ok(offPositionResult);
    assert.equal(offPositionResult.changed, false);
    assert.equal(offPositionResult.stayTitleNormalization.status, "skipped");
    assert.match(offPositionResult.stayTitleNormalization.summary, /preskočeno/);
    assert.deepEqual(
      await db.select().from(sectionsTable).where(eq(sectionsTable.tenantId, otherId)),
      otherDraftBefore,
    );
    assert.deepEqual(await readPublishedContent(otherId), otherPublishedBefore);
    const [otherAfterSkipped] = await db.select().from(tenantsTable).where(eq(tenantsTable.id, otherId));
    assert.equal(otherAfterSkipped!.hasUnpublishedChanges, false);

    await db.update(translationsTable).set({ stale: true })
      .where(and(eq(translationsTable.recordId, section!.id), eq(translationsTable.lang, "en")));
    await db.update(tenantsTable).set({ hasUnpublishedChanges: false }).where(eq(tenantsTable.id, id));
    const translationOnly = await alignTenantSkeleton(id);
    assert.ok(translationOnly);
    assert.equal(translationOnly.changed, true);
    assert.deepEqual(translationOnly.titleChanges, []);
    assert.deepEqual(translationOnly.stayTitleNormalization, {
      status: "changed",
      summary: "Naslov razdelka: brez preimenovanja; usklajeni prevodi: 1.",
      titleChanged: false,
      translationsUpdated: 1,
    });
    assert.deepEqual(await readPublishedContent(id), publishedBefore);
  } finally {
    await db.delete(tenantsTable).where(inArray(tenantsTable.id, [id, otherId]));
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