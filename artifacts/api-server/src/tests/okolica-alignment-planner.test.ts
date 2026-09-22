import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { and, eq, inArray, sql } from "drizzle-orm";
import {
  categoriesTable,
  creatorPlaceMaterializationsTable,
  creatorPlaceProposalsTable,
  db,
  itemCategoryAttachmentsTable,
  itemsTable,
  mediaTable,
  publishedSnapshotsTable,
  sectionsTable,
  tenantsTable,
  translationsTable,
} from "@workspace/db";
import {
  applyTenantAlignmentToDisposableFixture,
  OKOLICA_CANONICAL_CATEGORIES,
  planTenantAlignment,
  tenantBaselineSlice,
  type DisposableAlignmentExecutor,
  type OkolicaBaseline,
} from "../lib/okolicaAlignmentPlanner";

const baselinePath = new URL("../../../../reports/okolica-production-baseline.json", import.meta.url);
const skeletonPath = new URL("../../../../reports/okolica-shared-skeleton.json", import.meta.url);
const loadCapturedBaseline = async (): Promise<OkolicaBaseline> =>
  JSON.parse(await readFile(baselinePath, "utf8")) as OkolicaBaseline;

const ids = {
  meliPu: "1071ca18-0281-4a23-b36b-0b0ce601f771",
  gril: "177e633a-6030-4eca-8ce8-e0a0afdff599",
  menina: "e0303a50-aeba-4ff2-a919-1e2558df55f3",
};

const clone = <T>(value: T): T => structuredClone(value);

function mappedFixture(source: OkolicaBaseline, tenantId: string): OkolicaBaseline {
  const fixture = clone(tenantBaselineSlice(source, tenantId));
  const map = new Map<string, string>();
  const tables = [
    fixture.tenants, fixture.sections, fixture.categories, fixture.items,
    fixture.attachments, fixture.proposals, fixture.translations, fixture.materializations,
  ];
  let sequence = 0;
  for (const rows of tables) {
    for (const row of rows) {
      if (typeof row.id === "string") {
        sequence += 1;
        map.set(row.id, randomUUID());
      }
    }
  }
  const referenceFields = [
    "id", "tenantId", "tenant_id", "sectionId", "section_id", "categoryId", "category_id",
    "itemId", "item_id", "proposalId", "proposal_id", "recordId", "record_id",
    "sourceProposalId", "source_proposal_id",
  ];
  for (const rows of tables) {
    for (const row of rows) {
      for (const field of referenceFields) {
        if (typeof row[field] === "string" && map.has(row[field] as string)) {
          row[field] = map.get(row[field] as string)!;
        }
      }
    }
  }
  return fixture;
}

function itemIntegrity(source: OkolicaBaseline): string {
  return JSON.stringify([...source.items]
    .sort((a, b) => String(a.id).localeCompare(String(b.id)))
    .map(({ categoryId: _categoryId, category_id: _categoryIdSnake, ...item }) => item));
}

function fixtureExecutor(state: { baseline: OkolicaBaseline; snapshots: unknown[] }) {
  const executor: DisposableAlignmentExecutor = {
    environment: "disposable-development-fixture",
    async transaction(callback, options) {
      assert.deepEqual(options, { isolationLevel: "serializable" });
      const before = clone(state);
      try {
        return await callback({
          async lockTenantScope() {},
          async loadBaseline() {
            return clone(state.baseline);
          },
          async updateCategory(categoryId, patch) {
            const category = state.baseline.categories.find((row) => row.id === categoryId);
            if (!category) throw new Error(`missing category ${categoryId}`);
            if (patch.label !== undefined) category.label = patch.label;
            if (patch.exploreGroup !== undefined) category.explore_group = patch.exploreGroup;
            if (patch.position !== undefined) category.position = patch.position;
            if (patch.icon !== undefined) category.icon = patch.icon;
            if (patch.layout !== undefined) category.layout = patch.layout;
            if (patch.deletedAt !== undefined) category.deleted_at = "fixture-transaction-timestamp";
          },
          async upsertCategoryTranslation(categoryId, language, value) {
            const current = state.baseline.translations.find((row) =>
              (row.record_id ?? row.recordId) === categoryId &&
              row.model === "category" && row.field === "label" && row.lang === language);
            if (current) {
              current.value = value;
              current.stale = false;
            } else {
              state.baseline.translations.push({
                id: `fixture-translation-${categoryId}-${language}`,
                record_id: categoryId,
                model: "category",
                field: "label",
                lang: language,
                value,
                stale: false,
              });
            }
          },
          async archiveCategoryIfUnreferenced(categoryId) {
            const category = state.baseline.categories.find((row) => row.id === categoryId);
            if (!category) return false;
            const itemIds = new Set(state.baseline.items
              .filter((row) => (row.categoryId ?? row.category_id) === categoryId)
              .map((row) => row.id));
            const proposalIds = new Set(state.baseline.proposals
              .filter((row) => (row.categoryId ?? row.category_id) === categoryId)
              .map((row) => row.id));
            const referenced = itemIds.size > 0 || proposalIds.size > 0 ||
              state.baseline.attachments.some((row) =>
                (row.categoryId ?? row.category_id) === categoryId ||
                itemIds.has(row.itemId ?? row.item_id) ||
                proposalIds.has(row.sourceProposalId ?? row.source_proposal_id)) ||
              state.baseline.materializations.some((row) =>
                itemIds.has(row.itemId ?? row.item_id) ||
                proposalIds.has(row.proposalId ?? row.proposal_id));
            if (referenced) return false;
            category.deleted_at = "fixture-transaction-timestamp";
            return true;
          },
          async markTenantHasUnpublishedChanges(id, expected) {
            const tenant = state.baseline.tenants.find((row) => row.id === id);
            if (!tenant || tenant.hasUnpublishedChanges !== expected.hasUnpublishedChanges ||
                Boolean(tenant.isPublished) !== expected.isPublished ||
                (tenant.lastPublishedAt ?? null) !== expected.lastPublishedAt) return false;
            tenant.hasUnpublishedChanges = true;
            return true;
          },
        });
      } catch (error) {
        state.baseline = before.baseline;
        state.snapshots = before.snapshots;
        throw error;
      }
    },
  };
  return executor;
}

test("planner is deterministic, proposes no item moves, and reports residual legacy blockers", async () => {
  const baseline = await loadCapturedBaseline();
  const gril = planTenantAlignment(baseline, ids.gril);
  const menina = planTenantAlignment(baseline, ids.menina);

  assert.deepEqual(planTenantAlignment(baseline, ids.gril), gril);
  assert.deepEqual(gril.itemMoves, []);
  assert.deepEqual(menina.itemMoves, []);
  assert.ok(gril.findings.some((finding) =>
    finding.key === "sights" && finding.status === "BLOCKED" && finding.itemIds?.length === 14));
  assert.ok(gril.findings.some((finding) => finding.status === "MANUAL_REVIEW" && finding.reason.includes("Golte")));
  assert.ok(menina.findings.some((finding) =>
    finding.key === "sights" && finding.status === "BLOCKED" && finding.proposalIds?.length === 152));
  assert.ok(menina.residualBlockedLegacy.length > 0);
  assert.equal(gril.actions.filter((action) => action.type === "archive-empty-legacy-category").length, 3);
  assert.equal(menina.actions.filter((action) => action.type === "archive-empty-legacy-category").length, 1);
});

test("canonical target matches the captured shared skeleton and Meli Pu needs no action", async () => {
  const shared = JSON.parse(await readFile(skeletonPath, "utf8")) as Array<{
    key: "explore" | "services";
    categories: Array<{
      key: string;
      names: { sl: string; en: string; de: string; it: string };
      icon: string;
      layout: string;
      group: string;
    }>;
  }>;
  const flattened = shared.flatMap((section) =>
    section.categories.map((category) => ({ section: section.key, ...category })));
  assert.deepEqual(OKOLICA_CANONICAL_CATEGORIES, flattened);

  const baseline = await loadCapturedBaseline();
  const meliPu = planTenantAlignment(baseline, ids.meliPu);
  assert.deepEqual(meliPu.actions, []);
  assert.deepEqual(meliPu.itemMoves, []);
  assert.deepEqual(meliPu.findings, []);
});

test("mapped disposable clone changes IDs, preserves items and snapshots, and replay is a no-op plan", async () => {
  const baseline = await loadCapturedBaseline();
  const fixture = mappedFixture(baseline, ids.gril);
  const mappedTenantId = String(fixture.tenants[0]!.id);
  assert.notEqual(mappedTenantId, ids.gril);
  const plan = planTenantAlignment(fixture, mappedTenantId);
  const state = { baseline: fixture, snapshots: [{ tenantId: mappedTenantId, content: { realisticLink: "https://guest.example.test/glamping-gril" } }] };
  const itemsBefore = itemIntegrity(state.baseline);
  const attachmentsBefore = JSON.stringify(state.baseline.attachments);
  const materializationsBefore = JSON.stringify(state.baseline.materializations);
  const snapshotsBefore = JSON.stringify(state.snapshots);

  const result = await applyTenantAlignmentToDisposableFixture(plan, fixtureExecutor(state));
  assert.equal(result.appliedActions, plan.actions.length);
  assert.equal(itemIntegrity(state.baseline), itemsBefore);
  assert.equal(JSON.stringify(state.baseline.attachments), attachmentsBefore);
  assert.equal(JSON.stringify(state.baseline.materializations), materializationsBefore);
  assert.equal(JSON.stringify(state.snapshots), snapshotsBefore);
  assert.equal(state.baseline.tenants[0]!.hasUnpublishedChanges, true);
  assert.equal(state.baseline.tenants[0]!.isPublished, true);
  assert.equal(state.baseline.tenants[0]!.lastPublishedAt, "2026-09-21 20:59:13.254+00");
  assert.deepEqual(planTenantAlignment(state.baseline, mappedTenantId).actions, []);
});

test("stale baseline/new item aborts the whole fixture transaction", async () => {
  const baseline = await loadCapturedBaseline();
  const fixture = mappedFixture(baseline, ids.gril);
  const mappedTenantId = String(fixture.tenants[0]!.id);
  const plan = planTenantAlignment(fixture, mappedTenantId);
  const legacyFood = fixture.categories.find((row) => row.key === "food")!;
  fixture.items.push({
    id: "fixture-new-item",
    title: "Concurrent item",
    categoryId: legacyFood.id,
    position: 0,
    isVisible: false,
    deletedAt: "already-deleted-but-still-a-reference",
  });
  const state = { baseline: fixture, snapshots: [{ realisticLink: "https://guest.example.test/glamping-gril" }] };
  const before = JSON.stringify(state);

  await assert.rejects(
    applyTenantAlignmentToDisposableFixture(plan, fixtureExecutor(state)),
    /STALE_BASELINE/,
  );
  assert.equal(JSON.stringify(state), before);
});

test("non-disposable executors are rejected before transaction access", async () => {
  const baseline = await loadCapturedBaseline();
  const plan = planTenantAlignment(baseline, ids.gril);
  let entered = false;
  const unsafe = {
    environment: "production",
    async transaction() {
      entered = true;
      throw new Error("must not enter");
    },
  } as unknown as DisposableAlignmentExecutor;
  await assert.rejects(applyTenantAlignmentToDisposableFixture(plan, unsafe), /disposable development fixture/);
  assert.equal(entered, false);
});

test("real development DB: remapped captured Gril fixture applies atomically and preserves content", async (context) => {
  if (process.env["NODE_ENV"] === "production") {
    throw new Error("Disposable Okolica integration test is forbidden in production");
  }
  if (!process.env["DATABASE_URL"]) {
    context.skip("development database is unavailable");
    return;
  }

  const captured = await loadCapturedBaseline();
  const fixture = mappedFixture(captured, ids.gril);
  // Creator proposal tables have a much wider operational schema. Items and
  // attachments are cloned here as the representative blocking references;
  // the pure tests cover proposal/materialization hash drift independently.
  fixture.proposals = [];
  fixture.materializations = [];
  for (const attachment of fixture.attachments) attachment.source_proposal_id = null;
  const tenantId = String(fixture.tenants[0]!.id);
  const sectionIds = fixture.sections.map((row) => String(row.id));
  const categoryIds = fixture.categories.map((row) => String(row.id));
  const itemIds = fixture.items.map((row) => String(row.id));

  const loadFrom = async (tx: typeof db): Promise<OkolicaBaseline> => ({
    tenants: await tx.select().from(tenantsTable).where(eq(tenantsTable.id, tenantId)),
    sections: await tx.select().from(sectionsTable).where(eq(sectionsTable.tenantId, tenantId)),
    categories: await tx.select().from(categoriesTable).where(inArray(categoriesTable.sectionId, sectionIds)),
    items: await tx.select().from(itemsTable).where(inArray(itemsTable.categoryId, categoryIds)),
    attachments: await tx.select().from(itemCategoryAttachmentsTable)
      .where(inArray(itemCategoryAttachmentsTable.categoryId, categoryIds)),
    proposals: await tx.select().from(creatorPlaceProposalsTable)
      .where(eq(creatorPlaceProposalsTable.tenantId, tenantId)),
    translations: await tx.select().from(translationsTable)
      .where(inArray(translationsTable.recordId, [...sectionIds, ...categoryIds])),
    materializations: await tx.select().from(creatorPlaceMaterializationsTable)
      .where(eq(creatorPlaceMaterializationsTable.tenantId, tenantId)),
    customEvidence: null,
  });

  try {
    await db.insert(tenantsTable).values({
      id: tenantId,
      slug: `okolica-fixture-${tenantId}`,
      name: "Disposable mapped Gril alignment fixture",
      tenantType: "kamp",
      hasUnpublishedChanges: Boolean(fixture.tenants[0]!.hasUnpublishedChanges),
      isPublished: Boolean(fixture.tenants[0]!.isPublished),
      lastPublishedAt: fixture.tenants[0]!.lastPublishedAt
        ? new Date(String(fixture.tenants[0]!.lastPublishedAt))
        : null,
    });
    await db.insert(sectionsTable).values(fixture.sections.map((row) => ({
      id: String(row.id),
      tenantId,
      key: String(row.key),
      title: String(row.title),
      icon: String(row.icon),
      position: Number(row.position),
      isVisible: Boolean(row.is_visible),
    })));
    await db.insert(categoriesTable).values(fixture.categories.map((row) => ({
      id: String(row.id),
      sectionId: String(row.section_id),
      key: String(row.key),
      label: String(row.label),
      icon: String(row.icon),
      layout: String(row.layout),
      exploreGroup: String(row.explore_group),
      position: Number(row.position),
      isVisible: Boolean(row.is_visible),
      deletedAt: row.deleted_at ? new Date(String(row.deleted_at)) : null,
    })));
    if (fixture.items.length) {
      await db.insert(itemsTable).values(fixture.items.map((row) => ({
        id: String(row.id),
        categoryId: String(row.categoryId),
        title: row.title == null ? null : String(row.title),
        body: row.body == null ? null : String(row.body),
        bullets: Array.isArray(row.bullets) ? row.bullets.map(String) : [],
        distance: row.distance == null ? null : String(row.distance),
        duration: row.duration == null ? null : String(row.duration),
        difficulty: row.difficulty == null ? null : String(row.difficulty),
        position: Number(row.position),
        isVisible: Boolean(row.isVisible),
        deletedAt: row.deletedAt ? new Date(String(row.deletedAt)) : null,
      })));
    }
    if (fixture.attachments.length) {
      await db.insert(itemCategoryAttachmentsTable).values(fixture.attachments.map((row) => ({
        id: String(row.id),
        itemId: String(row.item_id),
        categoryId: String(row.category_id),
      })));
    }
    if (fixture.translations.length) {
      await db.insert(translationsTable).values(fixture.translations.map((row) => ({
        id: String(row.id),
        model: String(row.model),
        recordId: String(row.record_id),
        field: String(row.field),
        lang: String(row.lang),
        value: String(row.value),
        stale: Boolean(row.stale),
      })));
    }
    await db.insert(mediaTable).values({
      tenantId,
      itemId: itemIds[0]!,
      url: "https://cdn.example.test/okolica-fixture/representative.webp",
      alt: "Disposable representative media",
    });
    await db.insert(publishedSnapshotsTable).values({
      tenantId,
      content: { url: "https://guest.example.test/glamping-gril", fixture: true },
    });

    const before = await loadFrom(db);
    const approved = planTenantAlignment(before, tenantId);
    const protectedBefore = JSON.stringify({
      items: await db.select().from(itemsTable).where(inArray(itemsTable.id, itemIds)),
      attachments: await db.select().from(itemCategoryAttachmentsTable)
        .where(inArray(itemCategoryAttachmentsTable.categoryId, categoryIds)),
      media: await db.select().from(mediaTable).where(eq(mediaTable.tenantId, tenantId)),
      snapshot: await db.select().from(publishedSnapshotsTable)
        .where(eq(publishedSnapshotsTable.tenantId, tenantId)),
    });

    const executor: DisposableAlignmentExecutor = {
      environment: "disposable-development-fixture",
      transaction(callback, options) {
        return db.transaction(async (tx) => callback({
          async lockTenantScope(id) {
            await tx.execute(sql`SELECT id FROM tenants WHERE id = ${id} FOR UPDATE`);
          },
          loadBaseline: () => loadFrom(tx as typeof db),
          async updateCategory(id, patch) {
            await tx.update(categoriesTable).set({
              label: patch.label,
              exploreGroup: patch.exploreGroup,
              position: patch.position,
              icon: patch.icon,
              layout: patch.layout,
            }).where(eq(categoriesTable.id, id));
          },
          async upsertCategoryTranslation(id, language, value) {
            await tx.insert(translationsTable).values({
              model: "category", recordId: id, field: "label", lang: language, value, stale: false,
            }).onConflictDoUpdate({
              target: [translationsTable.model, translationsTable.recordId, translationsTable.field, translationsTable.lang],
              set: { value, stale: false },
            });
          },
          async archiveCategoryIfUnreferenced(id) {
            const result = await tx.execute(sql`
              UPDATE categories AS c SET deleted_at = transaction_timestamp()
              WHERE c.id = ${id} AND c.deleted_at IS NULL
                AND NOT EXISTS (SELECT 1 FROM items i WHERE i.category_id = c.id)
                AND NOT EXISTS (SELECT 1 FROM item_category_attachments a WHERE a.category_id = c.id)
                AND NOT EXISTS (SELECT 1 FROM creator_place_proposals p WHERE p.category_id = c.id)
                AND NOT EXISTS (
                  SELECT 1 FROM item_category_attachments a
                  JOIN items i ON i.id = a.item_id
                  WHERE i.category_id = c.id
                )
                AND NOT EXISTS (
                  SELECT 1 FROM item_category_attachments a
                  JOIN creator_place_proposals p ON p.id = a.source_proposal_id
                  WHERE p.category_id = c.id
                )
                AND NOT EXISTS (
                  SELECT 1 FROM creator_place_materializations m
                  JOIN items i ON i.id = m.item_id
                  WHERE i.category_id = c.id
                )
                AND NOT EXISTS (
                  SELECT 1 FROM creator_place_materializations m
                  JOIN creator_place_proposals p ON p.id = m.proposal_id
                  WHERE p.category_id = c.id
                )
              RETURNING c.id
            `);
            return (result.rowCount ?? 0) === 1;
          },
          async markTenantHasUnpublishedChanges(id, expected) {
            const result = await tx.execute(sql`
              UPDATE tenants SET has_unpublished_changes = TRUE
              WHERE id = ${id}
                AND has_unpublished_changes IS FALSE
                AND is_published = ${expected.isPublished}
                AND last_published_at IS NOT DISTINCT FROM ${expected.lastPublishedAt}
              RETURNING id
            `);
            return (result.rowCount ?? 0) === 1;
          },
        }), options);
      },
    };

    await applyTenantAlignmentToDisposableFixture(approved, executor);
    const protectedAfter = JSON.stringify({
      items: await db.select().from(itemsTable).where(inArray(itemsTable.id, itemIds)),
      attachments: await db.select().from(itemCategoryAttachmentsTable)
        .where(inArray(itemCategoryAttachmentsTable.categoryId, categoryIds)),
      media: await db.select().from(mediaTable).where(eq(mediaTable.tenantId, tenantId)),
      snapshot: await db.select().from(publishedSnapshotsTable)
        .where(eq(publishedSnapshotsTable.tenantId, tenantId)),
    });
    assert.equal(protectedAfter, protectedBefore);
    const [publicationAfter] = await db.select({
      dirty: tenantsTable.hasUnpublishedChanges,
      published: tenantsTable.isPublished,
      publishedAt: tenantsTable.lastPublishedAt,
    }).from(tenantsTable).where(eq(tenantsTable.id, tenantId));
    assert.deepEqual(publicationAfter, {
      dirty: true,
      published: true,
      publishedAt: new Date("2026-09-21T20:59:13.254Z"),
    });

    const replay = planTenantAlignment(await loadFrom(db), tenantId);
    assert.deepEqual(replay.actions, []);
    assert.equal((await applyTenantAlignmentToDisposableFixture(replay, executor)).appliedActions, 0);

    const stale = planTenantAlignment(await loadFrom(db), tenantId);
    const firstCategory = categoryIds[0]!;
    await db.update(categoriesTable).set({ label: "Concurrent host edit" })
      .where(eq(categoriesTable.id, firstCategory));
    const stateBeforeAbort = JSON.stringify(await loadFrom(db));
    await assert.rejects(applyTenantAlignmentToDisposableFixture(stale, executor), /STALE_BASELINE/);
    assert.equal(JSON.stringify(await loadFrom(db)), stateBeforeAbort);
  } finally {
    await db.delete(tenantsTable).where(eq(tenantsTable.id, tenantId));
  }
});