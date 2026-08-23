import { and, eq, inArray, ne } from "drizzle-orm";
import { db, categoriesTable, sectionsTable } from "@workspace/db";
import { logger } from "./logger";

/**
 * One-time data assignment for the Ponudba/Nastanitev category groups.
 *
 * The rebuilt Ponudba (#v-shop) and Nastanitev (#v-grid) screens group
 * categories into scrolling tab rows exactly like Okolica. The mapping is
 * host-editable DATA in `categories.explore_group` (the column holds the
 * category's group within its own section; group key sets are disjoint per
 * section). Both development and production still carry the column default
 * ('experiences') for every stay/offer category, so the approved default
 * mapping ships as a row-level ledger — same paranoid pattern as
 * exploreGroupBackfill:
 *
 *  - runs only while EVERY stay/offer category of the tenant still has the
 *    default group; one run — or one host edit — disables it forever;
 *  - rows are matched by id AND stable key; labels are never matched;
 *  - key + default-group checks are inside the UPDATE predicate, so a
 *    concurrent edit can only cause a skip, never a stale write;
 *  - one transaction; full per-row report.
 */

const MELI_PU_TENANT_ID = "1071ca18-0281-4a23-b36b-0b0ce601f771";
const DEFAULT_GROUP = "experiences";
const SECTION_KEYS: ReadonlyArray<string> = ["stay", "offer"];

export type SectionGroupLedgerEntry = {
  categoryId: string;
  /** Stable category key — host-visible labels are deliberately not matched. */
  key: string;
  group: string;
};

// Approved default mapping (spec: ponudba-nastanitev spec, 2026-08-23).
// Category ids verified identical in development and production.
export const SECTION_GROUP_LEDGER: ReadonlyArray<SectionGroupLedgerEntry> = [
  // offer → Najem
  { categoryId: "21cb2473-1300-47d4-9384-47a41225c9e5", key: "sup", group: "najem" },
  { categoryId: "de87fe75-9953-41e7-9824-e631033388bf", key: "scooter", group: "najem" },
  // offer → Izleti in prevozi
  { categoryId: "669a7449-51c6-474a-b4bd-31f806146780", key: "boat", group: "izleti_prevozi" },
  { categoryId: "73c86a5f-ec98-42d1-af0f-3aff8a515bea", key: "ferry", group: "izleti_prevozi" },
  // offer → Domači izdelki
  { categoryId: "402e6388-1bcc-4f09-94da-7d1f5c927847", key: "oil", group: "domaci_izdelki" },
  { categoryId: "7945d7ae-404e-4018-8911-72e77f978eb1", key: "ice", group: "domaci_izdelki" },
  // offer → Pri hiši
  { categoryId: "6d19fcf0-98c6-41e5-8bc5-c46fac82a0a0", key: "fitness", group: "pri_hisi" },
  { categoryId: "3c6acafd-be82-4571-a012-bf96848961a8", key: "grill", group: "pri_hisi" },
  { categoryId: "71000420-5f94-4ea4-8807-d1798fbdf786", key: "games", group: "pri_hisi" },
  // stay → Vaše bivanje
  { categoryId: "4897801f-1a9c-4cd6-a450-cada02eab542", key: "welcome", group: "vase_bivanje" },
  { categoryId: "cf1244bb-4a02-437f-b3f4-1f41dfe15040", key: "apart", group: "vase_bivanje" },
  { categoryId: "59ca6db5-ee1d-4bca-9b36-76a6f16ae117", key: "pool", group: "vase_bivanje" },
  // stay → Prihod in dostop
  { categoryId: "47947381-e1f2-4e15-9a45-2d0808237622", key: "loc", group: "prihod_dostop" },
  { categoryId: "c55b5370-3c59-43c3-983a-fb0d00af2ecf", key: "park", group: "prihod_dostop" },
  { categoryId: "282c13fc-564e-406e-9786-b0193d06396e", key: "gate", group: "prihod_dostop" },
  { categoryId: "c5b3b98e-2029-42a2-bbb0-1d5c1d82ae96", key: "check", group: "prihod_dostop" },
  // stay → Praktično
  { categoryId: "67f8a2a3-3822-4639-a408-271a7d3cfe91", key: "wifi", group: "prakticno" },
  { categoryId: "4d525c41-4a6d-4ab1-8254-0e51b7825f44", key: "equip", group: "prakticno" },
  { categoryId: "0653c49c-fe0c-4ece-8f14-fc6c2e97ba20", key: "house", group: "prakticno" },
];

export type SectionGroupReportRow = {
  key: string;
  label: string | null;
  groupBefore: string | null;
  groupAfter: string | null;
  outcome: "updated" | "skipped";
  reason: string;
};

export type SectionGroupBackfillResult = {
  applied: boolean;
  updated: number;
  skipped: number;
  report: SectionGroupReportRow[];
};

export async function applySectionGroupBackfill(
  // Injectable for tests only — production always runs the real ledger.
  tenantId: string = MELI_PU_TENANT_ID,
  sectionKeys: ReadonlyArray<string> = SECTION_KEYS,
  ledger: ReadonlyArray<SectionGroupLedgerEntry> = SECTION_GROUP_LEDGER,
): Promise<SectionGroupBackfillResult> {
  return db.transaction(async (tx) => {
    // Untouched-signature guard, scoped to the stay/offer sections only (the
    // Okolica categories are legitimately non-default and must not disable
    // this). Any non-default group inside the scope means the assignment
    // already exists — never touch it again.
    const nonDefault = await tx
      .select({ id: categoriesTable.id })
      .from(categoriesTable)
      .innerJoin(sectionsTable, eq(sectionsTable.id, categoriesTable.sectionId))
      .where(
        and(
          eq(sectionsTable.tenantId, tenantId),
          inArray(sectionsTable.key, [...sectionKeys]),
          ne(categoriesTable.exploreGroup, DEFAULT_GROUP),
        ),
      )
      .limit(1);
    if (nonDefault.length > 0) {
      return { applied: false, updated: 0, skipped: 0, report: [] };
    }

    // Ledger targets are read — and later updated — only inside the scoped
    // tenant + stay/offer sections. A category moved to another section (or
    // tenant) while keeping its id/key is treated as gone, never regrouped.
    const scopedSectionIds = tx
      .select({ id: sectionsTable.id })
      .from(sectionsTable)
      .where(
        and(
          eq(sectionsTable.tenantId, tenantId),
          inArray(sectionsTable.key, [...sectionKeys]),
        ),
      );
    const rows = await tx
      .select({
        id: categoriesTable.id,
        key: categoriesTable.key,
        label: categoriesTable.label,
        exploreGroup: categoriesTable.exploreGroup,
      })
      .from(categoriesTable)
      .where(
        and(
          inArray(
            categoriesTable.id,
            ledger.map((l) => l.categoryId),
          ),
          inArray(categoriesTable.sectionId, scopedSectionIds),
        ),
      );
    const byId = new Map(rows.map((r) => [r.id, r] as const));

    const report: SectionGroupReportRow[] = [];
    for (const entry of ledger) {
      const current = byId.get(entry.categoryId) ?? null;
      if (!current) {
        report.push({
          key: entry.key,
          label: null,
          groupBefore: null,
          groupAfter: null,
          outcome: "skipped",
          reason: "category no longer exists in the scoped stay/offer sections",
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
        .set({ exploreGroup: entry.group })
        .where(
          and(
            eq(categoriesTable.id, entry.categoryId),
            eq(categoriesTable.exploreGroup, DEFAULT_GROUP),
            eq(categoriesTable.key, entry.key),
            inArray(categoriesTable.sectionId, scopedSectionIds),
          ),
        )
        .returning({ id: categoriesTable.id });
      if (changed.length === 1) {
        report.push({
          key: entry.key,
          label: current.label,
          groupBefore: DEFAULT_GROUP,
          groupAfter: entry.group,
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
export async function runSectionGroupBackfillAtStartup(): Promise<void> {
  try {
    const result = await applySectionGroupBackfill();
    if (!result.applied) {
      logger.info("[sectionGroupBackfill] groups already assigned — no-op");
      return;
    }
    logger.info(
      { updated: result.updated, skipped: result.skipped },
      "[sectionGroupBackfill] applied approved Ponudba/Nastanitev groups",
    );
    const pad = (v: string | null | undefined, n: number) => String(v ?? "—").padEnd(n);
    const header = `${pad("key", 10)} ${pad("label", 22)} ${pad("before", 12)} ${pad("after", 16)} ${pad("outcome", 8)} reason`;
    const lines = result.report.map(
      (r) =>
        `${pad(r.key, 10)} ${pad(r.label, 22)} ${pad(r.groupBefore, 12)} ${pad(r.groupAfter, 16)} ${pad(r.outcome, 8)} ${r.reason}`,
    );
    logger.info(`[sectionGroupBackfill] result table:\n${header}\n${lines.join("\n")}`);
    const skippedRows = result.report.filter((r) => r.outcome === "skipped");
    if (skippedRows.length > 0) {
      logger.error(
        { skipped: skippedRows },
        `[sectionGroupBackfill] ATTENTION: ${skippedRows.length} categor${skippedRows.length === 1 ? "y was" : "ies were"} SKIPPED and remain ungrouped — review these rows manually`,
      );
    }
  } catch (err) {
    logger.error({ err }, "[sectionGroupBackfill] failed (boot continues)");
  }
}
