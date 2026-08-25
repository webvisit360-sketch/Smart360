import { and, eq, inArray } from "drizzle-orm";
import {
  categoriesTable,
  db,
  itemsTable,
  sectionsTable,
} from "@workspace/db";
import { logger } from "./logger";

export type TriesteCityRenameTarget = {
  tenantId: string;
  sectionKey: string;
  categoryId: string;
  categoryKey: string;
  itemId: string;
  titleBefore: string;
  titleAfter: string;
};

const TRIESTE_CITY_RENAME_TARGET: TriesteCityRenameTarget = {
  tenantId: "1071ca18-0281-4a23-b36b-0b0ce601f771",
  sectionKey: "explore",
  categoryId: "cfcb60a5-a705-4246-aec2-8d98b59d08a9",
  categoryKey: "trips",
  itemId: "4e13555e-eaf4-471a-a5e8-061d90589b83",
  titleBefore: "Trst — informacijska točka",
  titleAfter: "Trst",
};

export type TriesteCityRenameResult = {
  outcome: "updated" | "already-applied" | "skipped";
  titleBefore: string | null;
  titleAfter: string | null;
  reason: string;
};

/**
 * One-time, row-guarded rename approved by the owner.
 *
 * Only the Slovenian source title changes. Phone, hours, map data, body and
 * translation rows are deliberately outside this update.
 */
export async function applyTriesteCityRename(
  target: TriesteCityRenameTarget = TRIESTE_CITY_RENAME_TARGET,
): Promise<TriesteCityRenameResult> {
  return db.transaction(async (tx) => {
    const scopedCategoryIds = tx
      .select({ id: categoriesTable.id })
      .from(categoriesTable)
      .innerJoin(sectionsTable, eq(sectionsTable.id, categoriesTable.sectionId))
      .where(
        and(
          eq(categoriesTable.id, target.categoryId),
          eq(categoriesTable.key, target.categoryKey),
          eq(sectionsTable.tenantId, target.tenantId),
          eq(sectionsTable.key, target.sectionKey),
        ),
      );

    const [current] = await tx
      .select({ title: itemsTable.title })
      .from(itemsTable)
      .where(
        and(
          eq(itemsTable.id, target.itemId),
          inArray(itemsTable.categoryId, scopedCategoryIds),
        ),
      )
      .limit(1);

    if (!current) {
      return {
        outcome: "skipped",
        titleBefore: null,
        titleAfter: null,
        reason: "item no longer exists in the approved tenant, section and category",
      };
    }
    if (current.title === target.titleAfter) {
      return {
        outcome: "already-applied",
        titleBefore: target.titleAfter,
        titleAfter: target.titleAfter,
        reason: "approved city title is already present",
      };
    }
    if (current.title !== target.titleBefore) {
      return {
        outcome: "skipped",
        titleBefore: current.title,
        titleAfter: current.title,
        reason: "source title changed since approval",
      };
    }

    const changed = await tx
      .update(itemsTable)
      .set({ title: target.titleAfter })
      .where(
        and(
          eq(itemsTable.id, target.itemId),
          eq(itemsTable.title, target.titleBefore),
          inArray(itemsTable.categoryId, scopedCategoryIds),
        ),
      )
      .returning({ title: itemsTable.title });

    if (changed.length !== 1) {
      return {
        outcome: "skipped",
        titleBefore: current.title,
        titleAfter: current.title,
        reason: "row changed concurrently during the rename",
      };
    }

    return {
      outcome: "updated",
      titleBefore: target.titleBefore,
      titleAfter: target.titleAfter,
      reason: "renamed to the owner-approved city entry",
    };
  });
}

/** Startup hook: best-effort and permanently self-disabling after the rename. */
export async function runTriesteCityRenameAtStartup(): Promise<void> {
  try {
    const result = await applyTriesteCityRename();
    if (result.outcome === "updated") {
      logger.info(
        {
          titleBefore: result.titleBefore,
          titleAfter: result.titleAfter,
        },
        "[triesteCityRename] applied owner-approved city rename",
      );
      return;
    }
    if (result.outcome === "skipped") {
      logger.error(
        { result },
        "[triesteCityRename] target did not match the approved source signature",
      );
    }
  } catch (err) {
    logger.error({ err }, "[triesteCityRename] failed (boot continues)");
  }
}