import assert from "node:assert/strict";
import test from "node:test";
import { eq, sql } from "drizzle-orm";
import {
  categoriesTable,
  creatorDistanceBackfillAttemptsTable,
  creatorDistanceBackfillRunsTable,
  db,
  itemDistanceProposalsTable,
  itemsTable,
  sectionsTable,
  tenantsTable,
} from "@workspace/db";
import {
  backfillCreatorDistances,
  CreatorDistanceBackfillError,
} from "../lib/creatorDistanceBackfill";
import { ensureCreatorDistanceBackfillSchema } from "../lib/creatorDistanceBackfillSchema";
import { buildTenantContent } from "../lib/contentTree";

test("Creator distance schema upgrades the earlier nullable attempt ledger in place", async () => {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  let tenantId = "";
  try {
    await db.execute(sql`
      DROP INDEX IF EXISTS creator_distance_backfill_attempts_run_item_uq;
      ALTER TABLE creator_distance_backfill_attempts
        ALTER COLUMN item_id DROP NOT NULL;
    `);
    const [tenant] = await db.insert(tenantsTable).values({
      slug: `creator-distance-schema-upgrade-${suffix}`,
      name: `Creator distance schema upgrade ${suffix}`,
    }).returning();
    tenantId = tenant!.id;
    const [run] = await db.insert(creatorDistanceBackfillRunsTable).values({
      tenantId,
      originLatitude: 45.5,
      originLongitude: 13.6,
    }).returning();
    await db.execute(sql`
      INSERT INTO creator_distance_backfill_attempts (
        run_id, item_id, item_name, outcome, reason
      ) VALUES (
        ${run!.id}, NULL, 'Izbrisan starejši vnos', 'failed', 'Starejši zapis brez identitete.'
      )
    `);

    await ensureCreatorDistanceBackfillSchema();

    const columnState = await db.execute(sql`
      SELECT is_nullable
      FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'creator_distance_backfill_attempts'
        AND column_name = 'item_id'
    `) as { rows: Array<{ is_nullable: string }> };
    assert.equal(columnState.rows[0]?.is_nullable, "NO");
    const upgradedAttempt = await db.execute(sql`
      SELECT item_id
      FROM creator_distance_backfill_attempts
      WHERE run_id = ${run!.id}
    `) as { rows: Array<{ item_id: string | null }> };
    assert.match(upgradedAttempt.rows[0]?.item_id ?? "", /^[0-9a-f-]{36}$/);
    const uniqueIndex = await db.execute(sql`
      SELECT indexname
      FROM pg_indexes
      WHERE schemaname = current_schema()
        AND indexname = 'creator_distance_backfill_attempts_run_item_uq'
    `) as { rows: Array<{ indexname: string }> };
    assert.equal(uniqueIndex.rows.length, 1);
    const itemForeignKeys = await db.execute(sql`
      SELECT constraint_row.conname
      FROM pg_constraint constraint_row
      JOIN pg_class table_row ON table_row.oid = constraint_row.conrelid
      WHERE table_row.relname = 'creator_distance_backfill_attempts'
        AND constraint_row.contype = 'f'
        AND pg_get_constraintdef(constraint_row.oid) LIKE '%(item_id)%'
    `) as { rows: Array<{ conname: string }> };
    assert.equal(itemForeignKeys.rows.length, 0);
  } finally {
    if (tenantId) {
      await db.delete(tenantsTable).where(eq(tenantsTable.id, tenantId));
    }
    await ensureCreatorDistanceBackfillSchema();
  }
});

test("Creator distance backfill fills only coordinate gaps and persists every isolated outcome", async () => {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  let tenantId = "";
  try {
    const [tenant] = await db.insert(tenantsTable).values({
      slug: `creator-distance-backfill-${suffix}`,
      name: `Creator distance backfill ${suffix}`,
      latitude: 45.5,
      longitude: 13.6,
      creatorDraft: true,
      creatorOriginRegion: "Izola, Slovenija",
    }).returning();
    tenantId = tenant!.id;
    const [section] = await db.insert(sectionsTable).values({
      tenantId,
      key: "explore",
      title: "Okolica",
    }).returning();
    const [category] = await db.insert(categoriesTable).values({
      sectionId: section!.id,
      key: `test-${suffix}`,
      label: "Test",
      layout: "poi",
    }).returning();
    const [computed, manual, missing, failed] = await db.insert(itemsTable).values([
      { categoryId: category!.id, title: "Izračunaj me" },
      { categoryId: category!.id, title: "Ročna razdalja", distanceMeters: 777, duration: "9 min" },
      { categoryId: category!.id, title: "Brez točke" },
      { categoryId: category!.id, title: "OSRM napaka" },
    ]).returning();
    await db.insert(itemDistanceProposalsTable).values([
      {
        itemId: computed!.id,
        tenantId,
        status: "approved",
        source: "coordinates",
        confidence: "high",
        latitude: 45.51,
        longitude: 13.61,
        inputFingerprint: `computed-${suffix}`,
      },
      {
        itemId: failed!.id,
        tenantId,
        status: "approved",
        source: "coordinates",
        confidence: "high",
        latitude: 45.52,
        longitude: 13.62,
        inputFingerprint: `failed-${suffix}`,
      },
    ]);

    let throttleCalls = 0;
    const fakeFetch = (async (url: string) => {
      if (url.includes("13.62,45.52")) {
        return {
          ok: false,
          status: 503,
          json: async () => ({}),
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ routes: [{ distance: 12_345.4, duration: 600.2 }] }),
      };
    }) as unknown as typeof fetch;
    const acquireTurn = async () => {
      throttleCalls++;
      return 0;
    };

    const first = await backfillCreatorDistances(tenantId, {
      fetchFn: fakeFetch,
      acquireTurn,
    });
    assert.equal(first.computed, 1);
    assert.equal(first.skipped, 1);
    assert.deepEqual(first.noCoordinates.map((row) => row.itemName), ["Brez točke"]);
    assert.deepEqual(first.failures.map((row) => ({
      itemName: row.itemName,
      reason: row.reason,
    })), [{ itemName: "OSRM napaka", reason: "OSRM 503" }]);
    assert.equal(throttleCalls, 2);

    const storedItems = await db.select().from(itemsTable)
      .where(eq(itemsTable.categoryId, category!.id));
    const storedComputed = storedItems.find((row) => row.id === computed!.id)!;
    const storedManual = storedItems.find((row) => row.id === manual!.id)!;
    const storedMissing = storedItems.find((row) => row.id === missing!.id)!;
    const storedFailed = storedItems.find((row) => row.id === failed!.id)!;
    assert.equal(storedComputed.distanceMeters, 12_345);
    assert.equal(storedComputed.duration, "10 min");
    assert.equal(storedManual.distanceMeters, 777);
    assert.equal(storedManual.duration, "9 min");
    assert.equal(storedMissing.distanceMeters, null);
    assert.equal(storedFailed.distanceMeters, null);

    const [storedProposal] = await db.select().from(itemDistanceProposalsTable)
      .where(eq(itemDistanceProposalsTable.itemId, computed!.id));
    assert.equal(storedProposal!.distanceMeters, 12_345);
    assert.equal(storedProposal!.durationMinutes, 10);

    const firstAttempts = await db.select().from(creatorDistanceBackfillAttemptsTable)
      .where(eq(creatorDistanceBackfillAttemptsTable.runId, first.runId));
    assert.equal(firstAttempts.length, 4);
    assert.deepEqual(
      [...firstAttempts.map((row) => row.outcome)].sort(),
      ["computed", "failed", "no_coordinates", "skipped"],
    );
    const [firstRun] = await db.select().from(creatorDistanceBackfillRunsTable)
      .where(eq(creatorDistanceBackfillRunsTable.id, first.runId));
    assert.deepEqual({
      status: firstRun!.status,
      computed: firstRun!.computedCount,
      skipped: firstRun!.skippedCount,
      noCoordinates: firstRun!.noCoordinatesCount,
      failures: firstRun!.failureCount,
    }, {
      status: "completed",
      computed: 1,
      skipped: 1,
      noCoordinates: 1,
      failures: 1,
    });

    const guestTree = await buildTenantContent(tenant!, {
      visibleOnly: true,
      lang: "sl",
    });
    const guestComputed = guestTree.sections
      .flatMap((value) => value.categories)
      .flatMap((value) => value.items)
      .find((value) => value.id === computed!.id);
    assert.equal(guestComputed!.distanceMeters, 12_345);
    assert.equal(guestComputed!.duration, "10 min");

    const second = await backfillCreatorDistances(tenantId, {
      fetchFn: fakeFetch,
      acquireTurn,
    });
    assert.equal(second.computed, 0);
    assert.equal(second.skipped, 2);
    assert.deepEqual(second.noCoordinates.map((row) => row.itemName), ["Brez točke"]);
    assert.equal(second.failures.length, 1);
    assert.equal(throttleCalls, 3);
    const secondAttempts = await db.select().from(creatorDistanceBackfillAttemptsTable)
      .where(eq(creatorDistanceBackfillAttemptsTable.runId, second.runId));
    assert.equal(secondAttempts.length, 4);

    const [afterSecond] = await db.select().from(itemsTable)
      .where(eq(itemsTable.id, computed!.id));
    assert.equal(afterSecond!.distanceMeters, 12_345);
    assert.equal(afterSecond!.duration, "10 min");
  } finally {
    if (tenantId) {
      await db.delete(tenantsTable).where(eq(tenantsTable.id, tenantId));
    }
  }
});

test("Creator distance backfill rejects legacy coordinates without a confirmed Creator origin", async () => {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  let tenantId = "";
  try {
    const [tenant] = await db.insert(tenantsTable).values({
      slug: `creator-distance-unconfirmed-${suffix}`,
      name: `Creator distance unconfirmed ${suffix}`,
      latitude: 45.5,
      longitude: 13.6,
    }).returning();
    tenantId = tenant!.id;

    await assert.rejects(
      backfillCreatorDistances(tenantId, {
        fetchFn: (async () => {
          throw new Error("OSRM must not be called");
        }) as unknown as typeof fetch,
        acquireTurn: async () => {
          throw new Error("Throttle must not be acquired");
        },
      }),
      (error: unknown) =>
        error instanceof CreatorDistanceBackfillError
        && error.kind === "invalid-origin"
        && error.message.includes("potrjenega izhodišča Kreatorja"),
    );
    const runs = await db.select().from(creatorDistanceBackfillRunsTable)
      .where(eq(creatorDistanceBackfillRunsTable.tenantId, tenantId));
    assert.equal(runs.length, 0);
  } finally {
    if (tenantId) {
      await db.delete(tenantsTable).where(eq(tenantsTable.id, tenantId));
    }
  }
});

test("Creator distance backfill never persists a route when the confirmed origin changes", async () => {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  let tenantId = "";
  try {
    const [tenant] = await db.insert(tenantsTable).values({
      slug: `creator-distance-origin-race-${suffix}`,
      name: `Creator distance origin race ${suffix}`,
      latitude: 45.5,
      longitude: 13.6,
      creatorDraft: true,
      creatorOriginRegion: "Izola, Slovenija",
    }).returning();
    tenantId = tenant!.id;
    const [section] = await db.insert(sectionsTable).values({
      tenantId,
      key: "explore",
      title: "Okolica",
    }).returning();
    const [category] = await db.insert(categoriesTable).values({
      sectionId: section!.id,
      key: `race-${suffix}`,
      label: "Test",
      layout: "poi",
    }).returning();
    const [item] = await db.insert(itemsTable).values({
      categoryId: category!.id,
      title: "Ne shrani stare poti",
    }).returning();
    await db.insert(itemDistanceProposalsTable).values({
      itemId: item!.id,
      tenantId,
      status: "approved",
      source: "coordinates",
      confidence: "high",
      latitude: 45.51,
      longitude: 13.61,
      inputFingerprint: `origin-race-${suffix}`,
    });

    const result = await backfillCreatorDistances(tenantId, {
      acquireTurn: async () => 0,
      fetchFn: (async () => {
        await db.update(tenantsTable).set({
          latitude: 46.05,
          longitude: 14.51,
          creatorOriginRegion: "Ljubljana, Slovenija",
        }).where(eq(tenantsTable.id, tenantId));
        return {
          ok: true,
          status: 200,
          json: async () => ({ routes: [{ distance: 5_000, duration: 300 }] }),
        };
      }) as unknown as typeof fetch,
    });

    assert.equal(result.computed, 0);
    assert.equal(result.skipped, 0);
    assert.deepEqual(result.failures.map((failure) => failure.reason), [
      "Potrjeno izhodišče Kreatorja se je med preračunom spremenilo.",
    ]);
    const [storedItem] = await db.select().from(itemsTable)
      .where(eq(itemsTable.id, item!.id));
    assert.equal(storedItem!.distanceMeters, null);
    assert.equal(storedItem!.duration, null);
    const attempts = await db.select().from(creatorDistanceBackfillAttemptsTable)
      .where(eq(creatorDistanceBackfillAttemptsTable.runId, result.runId));
    assert.equal(attempts.length, 1);
    assert.equal(attempts[0]!.outcome, "failed");
  } finally {
    if (tenantId) {
      await db.delete(tenantsTable).where(eq(tenantsTable.id, tenantId));
    }
  }
});