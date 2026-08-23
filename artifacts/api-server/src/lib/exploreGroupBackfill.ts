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
 * (category id + stable key + target group). It is intentionally paranoid:
 *
 *  - it only runs while the tenant is still in the broken signature state
 *    (EVERY category in the default group). The moment any category has a
 *    non-default group — because this ran, or because a host reassigned one —
 *    it is a permanent no-op and can never overwrite later edits;
 *  - each row is matched by id AND stable key (labels are host-editable and
 *    may be renamed or carry stray whitespace — they are reported, never
 *    matched on); a repurposed category is skipped and reported loudly;
 *  - the key and default-group checks are part of the UPDATE predicate
 *    itself, so a concurrent edit can only cause a skip, never a stale write;
 *  - everything happens in one transaction;
 *  - the outcome is reported as a full per-category table (key, label,
 *    group before → after, updated/skipped + reason).
 */

const MELI_PU_TENANT_ID = "1071ca18-0281-4a23-b36b-0b0ce601f771";
const DEFAULT_GROUP = "experiences";

export type ExploreGroupLedgerEntry = {
  categoryId: string;
  /** Stable category key — host-visible labels are deliberately not matched. */
  key: string;
  exploreGroup: string;
};

// Approved assignment, exported for the regression test. Categories that keep
// the default 'experiences' group are deliberately absent. Keys verified
// identical in development and production.
export const EXPLORE_GROUP_LEDGER: ReadonlyArray<ExploreGroupLedgerEntry> = [
  { categoryId: "976dc2cc-c4a9-4076-b445-8afd89cc478f", key: "culinary", exploreGroup: "food_drink" },
  { categoryId: "28a42bea-ebe9-44f6-a107-f4e24b495069", key: "night", exploreGroup: "food_drink" },
  { categoryId: "2dc2eca3-bcc9-4100-be3c-e21786ac0395", key: "pizza", exploreGroup: "food_drink" },
  { categoryId: "f65e2b4b-8676-404a-8bb5-a325a3faea87", key: "breakfast", exploreGroup: "food_drink" },
  { categoryId: "a585c160-a224-4fa4-8ab0-d68eeff2d0ac", key: "bike", exploreGroup: "nature_trails" },
  { categoryId: "f8941ef0-5321-4265-b161-c34f770154ee", key: "beach", exploreGroup: "nature_trails" },
  { categoryId: "5c319f5a-6a81-4a9a-a3ab-6aec6483b620", key: "hike", exploreGroup: "nature_trails" },
  { categoryId: "27ce2c01-15db-45f6-9636-9c45484e165f", key: "atm", exploreGroup: "services" },
  { categoryId: "67a74032-88bb-4fe5-9fef-bbe0a46116af", key: "gas", exploreGroup: "services" },
  { categoryId: "7985d054-9791-44eb-9c9a-0a768e366d24", key: "hosp", exploreGroup: "services" },
  { categoryId: "0599e07d-169d-4071-bd27-93bb19a25d79", key: "pharm", exploreGroup: "services" },
  { categoryId: "c0ede9a5-a37d-4587-a8ab-0faab9074e29", key: "bakery", exploreGroup: "services" },
  { categoryId: "c6be1fe2-8963-46fc-b78e-a49c89bbf28b", key: "shops", exploreGroup: "services" },
  { categoryId: "6f4b5883-1171-41d0-b215-46285d12322c", key: "culture", exploreGroup: "sights" },
  { categoryId: "d955e77a-ae1d-403c-9d73-da1abdc2fc5f", key: "nature", exploreGroup: "sights" },
];

export type ExploreGroupReportRow = {
  key: string;
  label: string | null;
  groupBefore: string | null;
  groupAfter: string | null;
  outcome: "updated" | "skipped";
  reason: string;
};

export type ExploreGroupBackfillResult = {
  applied: boolean;
  updated: number;
  skipped: number;
  report: ExploreGroupReportRow[];
};

export async function applyExploreGroupBackfill(
  // Injectable for tests only — production always runs the real ledger.
  tenantId: string = MELI_PU_TENANT_ID,
  ledger: ReadonlyArray<ExploreGroupLedgerEntry> = EXPLORE_GROUP_LEDGER,
): Promise<ExploreGroupBackfillResult> {
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
      return { applied: false, updated: 0, skipped: 0, report: [] };
    }

    const rows = await tx
      .select({
        id: categoriesTable.id,
        key: categoriesTable.key,
        label: categoriesTable.label,
        exploreGroup: categoriesTable.exploreGroup,
      })
      .from(categoriesTable)
      .where(
        inArray(
          categoriesTable.id,
          ledger.map((l) => l.categoryId),
        ),
      );
    const byId = new Map(rows.map((r) => [r.id, r] as const));

    const report: ExploreGroupReportRow[] = [];
    for (const entry of ledger) {
      const current = byId.get(entry.categoryId) ?? null;
      if (!current) {
        report.push({
          key: entry.key,
          label: null,
          groupBefore: null,
          groupAfter: null,
          outcome: "skipped",
          reason: "category no longer exists",
        });
        continue;
      }
      if (current.key !== entry.key) {
        report.push({
          key: entry.key,
          label: current.label,
          groupBefore: current.exploreGroup,
          groupAfter: current.exploreGroup,
          outcome: "skipped",
          reason: `stable key changed (now '${current.key ?? "null"}') — category was repurposed`,
        });
        continue;
      }
      // Key and default-group are re-checked inside the UPDATE predicate so a
      // concurrent host edit between the read above and this write can only
      // cause a skip, never a stale regroup.
      const changed = await tx
        .update(categoriesTable)
        .set({ exploreGroup: entry.exploreGroup })
        .where(
          and(
            eq(categoriesTable.id, entry.categoryId),
            eq(categoriesTable.exploreGroup, DEFAULT_GROUP),
            eq(categoriesTable.key, entry.key),
          ),
        )
        .returning({ id: categoriesTable.id });
      if (changed.length === 1) {
        report.push({
          key: entry.key,
          label: current.label,
          groupBefore: DEFAULT_GROUP,
          groupAfter: entry.exploreGroup,
          outcome: "updated",
          reason: "moved to approved group",
        });
      } else {
        report.push({
          key: entry.key,
          label: current.label,
          groupBefore: current.exploreGroup,
          groupAfter: current.exploreGroup,
          outcome: "skipped",
          reason: "row changed concurrently during the run",
        });
      }
    }
    const updated = report.filter((r) => r.outcome === "updated").length;
    const skipped = report.filter((r) => r.outcome === "skipped").length;
    return { applied: true, updated, skipped, report };
  });
}

/** Startup hook: best-effort, a failure must never block boot. */
export async function runExploreGroupBackfillAtStartup(): Promise<void> {
  try {
    const result = await applyExploreGroupBackfill();
    if (!result.applied) {
      logger.info("[exploreGroupBackfill] groups already assigned — no-op");
      return;
    }
    logger.info(
      { updated: result.updated, skipped: result.skipped },
      "[exploreGroupBackfill] applied approved Okolica groups",
    );
    // Full per-category outcome table — one line per row so it survives any
    // log formatting, plus a readable table for humans.
    const pad = (v: string | null | undefined, n: number) => String(v ?? "—").padEnd(n);
    const header = `${pad("key", 10)} ${pad("label", 22)} ${pad("before", 12)} ${pad("after", 14)} ${pad("outcome", 8)} reason`;
    const lines = result.report.map(
      (r) =>
        `${pad(r.key, 10)} ${pad(r.label, 22)} ${pad(r.groupBefore, 12)} ${pad(r.groupAfter, 14)} ${pad(r.outcome, 8)} ${r.reason}`,
    );
    logger.info(`[exploreGroupBackfill] result table:\n${header}\n${lines.join("\n")}`);
    const skippedRows = result.report.filter((r) => r.outcome === "skipped");
    if (skippedRows.length > 0) {
      logger.error(
        { skipped: skippedRows },
        `[exploreGroupBackfill] ATTENTION: ${skippedRows.length} categor${skippedRows.length === 1 ? "y was" : "ies were"} SKIPPED and remain ungrouped — review these rows manually`,
      );
    }
  } catch (err) {
    logger.error({ err }, "[exploreGroupBackfill] failed (boot continues)");
  }
}
