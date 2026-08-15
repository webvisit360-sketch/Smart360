/**
 * Test: hkratno nalaganje fotografij ne premeša vrstnega reda
 *
 * Verifies that the atomic position allocation in the media INSERT
 * (`storage.ts`) guarantees unique, sequential positions even when
 * multiple uploads race for the same item simultaneously.
 *
 * Runs against the real database (uses DATABASE_URL from env).
 * No HTTP layer needed — we test the SQL directly, which is where
 * correctness lives.
 */

import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { eq, asc, sql } from "drizzle-orm";
import {
  db,
  pool,
  tenantsTable,
  sectionsTable,
  categoriesTable,
  itemsTable,
  mediaTable,
} from "@workspace/db";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Insert one media row replicating the exact logic from storage.ts:
 * lock the item row FOR UPDATE inside a transaction, then INSERT with
 * the position subquery. This serialises concurrent uploads per item.
 */
async function insertMediaAtomic(itemId: string, url: string) {
  const [row] = await db.transaction(async (tx) => {
    await tx.execute(
      sql`SELECT 1 FROM ${itemsTable} WHERE ${itemsTable.id} = ${itemId} FOR UPDATE`,
    );
    return tx
      .insert(mediaTable)
      .values({
        itemId,
        url,
        position: sql<number>`(
          select coalesce(max(${mediaTable.position}), -1) + 1
          from ${mediaTable}
          where ${mediaTable.itemId} = ${itemId}
        )`,
      })
      .returning();
  });
  return row!;
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

let tenantId: string;
let itemId: string;

before(async () => {
  // Minimal tenant → section → category → item fixture.
  const slug = `test-concurrent-${randomUUID().slice(0, 8)}`;

  const [tenant] = await db
    .insert(tenantsTable)
    .values({ slug, name: "Test Concurrent Upload" })
    .returning({ id: tenantsTable.id });
  tenantId = tenant!.id;

  const [section] = await db
    .insert(sectionsTable)
    .values({ tenantId, key: "photos", title: "Photos" })
    .returning({ id: sectionsTable.id });

  const [category] = await db
    .insert(categoriesTable)
    .values({ sectionId: section!.id, label: "Gallery", layout: "images" })
    .returning({ id: categoriesTable.id });

  const [item] = await db
    .insert(itemsTable)
    .values({ categoryId: category!.id, title: "Test Item" })
    .returning({ id: itemsTable.id });

  itemId = item!.id;
});

after(async () => {
  // Cascade delete cleans up all child rows.
  await db.delete(tenantsTable).where(eq(tenantsTable.id, tenantId));
  await pool.end();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("concurrent photo upload — position allocation", () => {
  test("parallel uploads receive unique, sequential positions starting at 0", async () => {
    const CONCURRENT = 5;

    // Fire all inserts simultaneously — this is the critical race condition.
    const results = await Promise.all(
      Array.from({ length: CONCURRENT }, (_, i) =>
        insertMediaAtomic(itemId, `/api/storage/img/test-slug/photo-${i}.jpg`)
      )
    );

    const positions = results.map((r) => r.position).sort((a, b) => a - b);

    // Every position must be unique.
    const unique = new Set(positions);
    assert.equal(
      unique.size,
      CONCURRENT,
      `Expected ${CONCURRENT} unique positions, got: [${positions.join(", ")}]`
    );

    // Positions must form a consecutive sequence 0 … N-1.
    for (let i = 0; i < CONCURRENT; i++) {
      assert.equal(
        positions[i],
        i,
        `Position at index ${i} should be ${i}, got ${positions[i]}`
      );
    }
  });

  test("first inserted photo (tile) has position 0", async () => {
    // Positions are already allocated; fetch in DB order.
    const rows = await db
      .select({ position: mediaTable.position })
      .from(mediaTable)
      .where(eq(mediaTable.itemId, itemId))
      .orderBy(asc(mediaTable.position));

    assert.ok(rows.length > 0, "No media rows found");
    assert.equal(rows[0]!.position, 0, "Tile (position 0) must exist");
  });

  test("public API query returns media ordered by position ASC", async () => {
    const rows = await db
      .select({ position: mediaTable.position })
      .from(mediaTable)
      .where(eq(mediaTable.itemId, itemId))
      .orderBy(asc(mediaTable.position));

    // Verify the sequence is strictly ascending (mirrors contentTree.ts query).
    for (let i = 1; i < rows.length; i++) {
      assert.ok(
        rows[i]!.position > rows[i - 1]!.position,
        `Row ${i} position ${rows[i]!.position} must be > row ${i - 1} position ${rows[i - 1]!.position}`
      );
    }
  });

  test("additional upload after concurrent batch continues the sequence", async () => {
    const before = await db
      .select({ position: mediaTable.position })
      .from(mediaTable)
      .where(eq(mediaTable.itemId, itemId))
      .orderBy(asc(mediaTable.position));

    const nextExpected = before.length; // positions are 0-indexed, so next = count

    const added = await insertMediaAtomic(
      itemId,
      "/api/storage/img/test-slug/extra.jpg"
    );

    assert.equal(
      added.position,
      nextExpected,
      `Extra photo should land at position ${nextExpected}, got ${added.position}`
    );
  });
});
