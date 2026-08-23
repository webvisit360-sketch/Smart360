import { and, eq, inArray, ne } from "drizzle-orm";
import { db, categoriesTable, sectionsTable } from "@workspace/db";
import { logger } from "./logger";

/**
 * One-time production data repair for the Okolica category groups.
 *
 * The `explore_group` column reached production through the publish-time
 * schema diff with its default value ('experiences') for every row, while the
 * approved five-group assignment was only ever applied to the development
 * database. Publishing syncs schema, never data — so production rendered a
 * single "Doživetja" group containing everything.
 *
 * This backfill carries the approved assignment as a row-level ledger
 * (category id + expected label + target group), mirroring the PART 5 cutover
 * process. It is intentionally paranoid:
 *
 *  - it only runs while the tenant is still in the broken signature state
 *    (EVERY category in the default group). The moment any category has a
 *    non-default group — because this ran, or because a host reassigned one —
 *    it is a permanent no-op and can never overwrite later edits;
 *  - each row is matched by id AND current label, so a repurposed category is
 *    skipped rather than silently regrouped;
 *  - everything happens in one transaction.
 */

const MELI_PU_TENANT_ID = "1071ca18-0281-4a23-b36b-0b0ce601f771";
const DEFAULT_GROUP = "experiences";

// Approved assignment, exported for the regression test. Categories that keep
// the default 'experiences' group are deliberately absent.
export const EXPLORE_GROUP_LEDGER: ReadonlyArray<{
  categoryId: string;
  expectedLabel: string;
  exploreGroup: string;
}> = [
  { categoryId: "976dc2cc-c4a9-4076-b445-8afd89cc478f", expectedLabel: "Kulinarika", exploreGroup: "food_drink" },
  { categoryId: "28a42bea-ebe9-44f6-a107-f4e24b495069", expectedLabel: "Nočno življenje", exploreGroup: "food_drink" },
  { categoryId: "2dc2eca3-bcc9-4100-be3c-e21786ac0395", expectedLabel: "Picerije", exploreGroup: "food_drink" },
  { categoryId: "f65e2b4b-8676-404a-8bb5-a325a3faea87", expectedLabel: "Zajtrk", exploreGroup: "food_drink" },
  { categoryId: "a585c160-a224-4fa4-8ab0-d68eeff2d0ac", expectedLabel: "Kolesarjenje", exploreGroup: "nature_trails" },
  { categoryId: "f8941ef0-5321-4265-b161-c34f770154ee", expectedLabel: "Plaže", exploreGroup: "nature_trails" },
  { categoryId: "5c319f5a-6a81-4a9a-a3ab-6aec6483b620", expectedLabel: "Pohodništvo", exploreGroup: "nature_trails" },
  { categoryId: "27ce2c01-15db-45f6-9636-9c45484e165f", expectedLabel: "Bankomati", exploreGroup: "services" },
  { categoryId: "67a74032-88bb-4fe5-9fef-bbe0a46116af", expectedLabel: "Bencinske črpalke", exploreGroup: "services" },
  { categoryId: "7985d054-9791-44eb-9c9a-0a768e366d24", expectedLabel: "Bolnišnica", exploreGroup: "services" },
  { categoryId: "0599e07d-169d-4071-bd27-93bb19a25d79", expectedLabel: "Lekarne", exploreGroup: "services" },
  { categoryId: "c0ede9a5-a37d-4587-a8ab-0faab9074e29", expectedLabel: "Pekarne", exploreGroup: "services" },
  { categoryId: "c6be1fe2-8963-46fc-b78e-a49c89bbf28b", expectedLabel: "Trgovine", exploreGroup: "services" },
  { categoryId: "6f4b5883-1171-41d0-b215-46285d12322c", expectedLabel: "Kulturna dediščina", exploreGroup: "sights" },
  { categoryId: "d955e77a-ae1d-403c-9d73-da1abdc2fc5f", expectedLabel: "Naravna dediščina", exploreGroup: "sights" },
];

export type ExploreGroupLedgerEntry = {
  categoryId: string;
  expectedLabel: string;
  exploreGroup: string;
};

export async function applyExploreGroupBackfill(
  // Injectable for tests only — production always runs the real ledger.
  tenantId: string = MELI_PU_TENANT_ID,
  ledger: ReadonlyArray<ExploreGroupLedgerEntry> = EXPLORE_GROUP_LEDGER,
): Promise<{
  applied: boolean;
  updated: number;
  skipped: string[];
}> {
  return db.transaction(async (tx) => {
    // Broken-signature guard: any non-default group means the assignment
    // already exists (dev, or an earlier run, or a host edit) — never touch it.
    const nonDefault = await tx
      .select({ id: categoriesTable.id })
      .from(categoriesTable)
      .innerJoin(sectionsTable, eq(sectionsTable.id, categoriesTable.sectionId))
      .where(
        and(
          eq(sectionsTable.tenantId, tenantId),
          ne(categoriesTable.exploreGroup, DEFAULT_GROUP),
        ),
      )
      .limit(1);
    if (nonDefault.length > 0) {
      return { applied: false, updated: 0, skipped: [] };
    }

    // Rows must still carry the labels recorded in the ledger; anything else
    // was repurposed after the ledger was written and is skipped loudly.
    const rows = await tx
      .select({ id: categoriesTable.id, label: categoriesTable.label })
      .from(categoriesTable)
      .where(
        inArray(
          categoriesTable.id,
          ledger.map((l) => l.categoryId),
        ),
      );
    const labelById = new Map(rows.map((r) => [r.id, r.label] as const));

    let updated = 0;
    const skipped: string[] = [];
    for (const entry of ledger) {
      if (labelById.get(entry.categoryId) !== entry.expectedLabel) {
        skipped.push(entry.expectedLabel);
        continue;
      }
      // Label and default-group are re-checked inside the UPDATE predicate so
      // a concurrent host edit between the read above and this write can only
      // cause a skip, never a stale regroup.
      const changed = await tx
        .update(categoriesTable)
        .set({ exploreGroup: entry.exploreGroup })
        .where(
          and(
            eq(categoriesTable.id, entry.categoryId),
            eq(categoriesTable.exploreGroup, DEFAULT_GROUP),
            eq(categoriesTable.label, entry.expectedLabel),
          ),
        )
        .returning({ id: categoriesTable.id });
      if (changed.length === 1) {
        updated++;
      } else {
        skipped.push(entry.expectedLabel);
      }
    }
    return { applied: true, updated, skipped };
  });
}

/** Startup hook: best-effort, a failure must never block boot. */
export async function runExploreGroupBackfillAtStartup(): Promise<void> {
  try {
    const result = await applyExploreGroupBackfill();
    if (result.applied) {
      logger.info(result, "[exploreGroupBackfill] applied approved Okolica groups");
      if (result.skipped.length > 0) {
        logger.warn(
          { skipped: result.skipped },
          "[exploreGroupBackfill] some ledger rows no longer match and were skipped",
        );
      }
    } else {
      logger.info("[exploreGroupBackfill] groups already assigned — no-op");
    }
  } catch (err) {
    logger.error({ err }, "[exploreGroupBackfill] failed (boot continues)");
  }
}
