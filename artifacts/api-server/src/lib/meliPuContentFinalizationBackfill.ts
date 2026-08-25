import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import {
  categoriesTable,
  db,
  itemsTable,
  sectionsTable,
  translationsTable,
} from "@workspace/db";
import { logger } from "./logger";

const TENANT_ID = "1071ca18-0281-4a23-b36b-0b0ce601f771";
const SECTION_KEY = "explore";

export type MeliPuDuplicateTarget = {
  itemId: string;
  categoryId: string;
  categoryKey: string;
  title: string;
};

export type MeliPuTriesteTarget = {
  itemId: string;
  categoryId: string;
  categoryKey: string;
  title: string;
  phoneBefore: string;
  hoursBefore: string;
  mapBefore: string;
  mapAfter: string;
  titles: Record<string, readonly [string, string]>;
};

export type MeliPuContentFinalizationConfig = {
  duplicates: readonly MeliPuDuplicateTarget[];
  trieste: MeliPuTriesteTarget;
};

const duplicates: readonly MeliPuDuplicateTarget[] = [
  {
    itemId: "7d79ba53-d92c-4eec-b59d-6168d25a8628",
    categoryId: "98631274-2c83-42c8-8e75-8be310c5ce1a",
    categoryKey: "act",
    title: "Grad Miramare, Trst",
  },
  {
    itemId: "fa10cf02-06b1-4374-b8b4-6f590b7a77d6",
    categoryId: "98631274-2c83-42c8-8e75-8be310c5ce1a",
    categoryKey: "act",
    title: "Portopiccolo Sistiana",
  },
] as const;

const trieste: MeliPuTriesteTarget = {
  itemId: "4e13555e-eaf4-471a-a5e8-061d90589b83",
  categoryId: "cfcb60a5-a705-4246-aec2-8d98b59d08a9",
  categoryKey: "trips",
  title: "Trst",
  phoneBefore: "+390403478312",
  hoursBefore: "[[540,1080],[540,1080],[540,1080],[540,1080],[540,1080],[540,1080],[540,1080]]",
  mapBefore: "Infopoint Trieste",
  mapAfter: "Trieste, Piazza dell'Unità d'Italia",
  titles: {
    en: ["Trieste — tourist information point", "Trieste"],
    de: ["Triest — Touristeninformation", "Triest"],
    it: ["Trieste — punto informazioni", "Trieste"],
  },
};

const DEFAULT_CONFIG: MeliPuContentFinalizationConfig = { duplicates, trieste };

export type MeliPuContentFinalizationResult = {
  duplicatesRemoved: string[];
  duplicateSkips: string[];
  triesteOutcome: "updated" | "already-applied" | "skipped";
  reason: string;
};

export async function applyMeliPuContentFinalization(
  tenantId = TENANT_ID,
  sectionKey = SECTION_KEY,
  config: MeliPuContentFinalizationConfig = DEFAULT_CONFIG,
): Promise<MeliPuContentFinalizationResult> {
  return db.transaction(async (tx) => {
    const duplicatesRemoved: string[] = [];
    const duplicateSkips: string[] = [];

    for (const target of config.duplicates) {
      const scopedCategoryIds = tx
        .select({ id: categoriesTable.id })
        .from(categoriesTable)
        .innerJoin(sectionsTable, eq(sectionsTable.id, categoriesTable.sectionId))
        .where(
          and(
            eq(categoriesTable.id, target.categoryId),
            eq(categoriesTable.key, target.categoryKey),
            eq(sectionsTable.tenantId, tenantId),
            eq(sectionsTable.key, sectionKey),
          ),
        );
      const changed = await tx
        .update(itemsTable)
        .set({ deletedAt: sql`now()` })
        .where(
          and(
            eq(itemsTable.id, target.itemId),
            eq(itemsTable.categoryId, target.categoryId),
            eq(itemsTable.title, target.title),
            isNull(itemsTable.deletedAt),
            inArray(itemsTable.categoryId, scopedCategoryIds),
          ),
        )
        .returning({ id: itemsTable.id });
      if (changed.length === 1) {
        duplicatesRemoved.push(target.title);
        continue;
      }
      const [current] = await tx
        .select({ deletedAt: itemsTable.deletedAt })
        .from(itemsTable)
        .where(and(eq(itemsTable.id, target.itemId), inArray(itemsTable.categoryId, scopedCategoryIds)))
        .limit(1);
      if (current?.deletedAt) duplicatesRemoved.push(target.title);
      else duplicateSkips.push(target.title);
    }

    const scopedTriesteCategoryIds = tx
      .select({ id: categoriesTable.id })
      .from(categoriesTable)
      .innerJoin(sectionsTable, eq(sectionsTable.id, categoriesTable.sectionId))
      .where(
        and(
          eq(categoriesTable.id, config.trieste.categoryId),
          eq(categoriesTable.key, config.trieste.categoryKey),
          eq(sectionsTable.tenantId, tenantId),
          eq(sectionsTable.key, sectionKey),
        ),
      );
    const [current] = await tx
      .select({
        phone: itemsTable.phone,
        hoursJson: itemsTable.hoursJson,
        open24: itemsTable.open24,
        mapQuery: itemsTable.mapQuery,
      })
      .from(itemsTable)
      .where(
        and(
          eq(itemsTable.id, config.trieste.itemId),
          eq(itemsTable.title, config.trieste.title),
          isNull(itemsTable.deletedAt),
          inArray(itemsTable.categoryId, scopedTriesteCategoryIds),
        ),
      )
      .limit(1)
      .for("update");

    if (!current) {
      return {
        duplicatesRemoved,
        duplicateSkips,
        triesteOutcome: "skipped",
        reason: "Trst no longer matches the approved tenant/category/title signature",
      };
    }

    const alreadyApplied =
      current.phone === null &&
      current.hoursJson === null &&
      current.open24 === false &&
      current.mapQuery === config.trieste.mapAfter;
    const matchesBefore =
      current.phone === config.trieste.phoneBefore &&
      current.hoursJson === config.trieste.hoursBefore &&
      current.open24 === false &&
      current.mapQuery === config.trieste.mapBefore;
    if (!alreadyApplied && !matchesBefore) {
      return {
        duplicatesRemoved,
        duplicateSkips,
        triesteOutcome: "skipped",
        reason: "Trst contact, hours or map data changed since owner approval",
      };
    }

    if (matchesBefore) {
      const metadataWrite = await tx
        .update(itemsTable)
        .set({
          phone: null,
          hoursJson: null,
          open24: false,
          mapQuery: config.trieste.mapAfter,
        })
        .where(
          and(
            eq(itemsTable.id, config.trieste.itemId),
            eq(itemsTable.categoryId, config.trieste.categoryId),
            eq(itemsTable.title, config.trieste.title),
            isNull(itemsTable.deletedAt),
            inArray(itemsTable.categoryId, scopedTriesteCategoryIds),
            eq(itemsTable.phone, config.trieste.phoneBefore),
            eq(itemsTable.hoursJson, config.trieste.hoursBefore),
            eq(itemsTable.open24, false),
            eq(itemsTable.mapQuery, config.trieste.mapBefore),
          ),
        )
        .returning({ id: itemsTable.id });
      if (metadataWrite.length !== 1) {
        throw new Error("Trst changed concurrently during owner-approved finalization");
      }
    }

    for (const [lang, [before, after]] of Object.entries(config.trieste.titles)) {
      const [translation] = await tx
        .select({ id: translationsTable.id, value: translationsTable.value })
        .from(translationsTable)
        .where(
          and(
            eq(translationsTable.model, "item"),
            eq(translationsTable.recordId, config.trieste.itemId),
            eq(translationsTable.field, "title"),
            eq(translationsTable.lang, lang),
          ),
        )
        .limit(1);
      if (!translation || (translation.value !== before && translation.value !== after)) {
        throw new Error(`Trst ${lang} title translation changed since owner approval`);
      }
      const titleWrite = await tx
        .update(translationsTable)
        .set({ value: after, stale: false })
        .where(
          and(
            eq(translationsTable.id, translation.id),
            inArray(translationsTable.value, [before, after]),
          ),
        )
        .returning({ id: translationsTable.id });
      if (titleWrite.length !== 1) {
        throw new Error(`Trst ${lang} title changed concurrently during finalization`);
      }
    }

    return {
      duplicatesRemoved,
      duplicateSkips,
      triesteOutcome: alreadyApplied ? "already-applied" : "updated",
      reason: "owner-approved Meli Pu content finalization complete",
    };
  });
}

export async function runMeliPuContentFinalizationAtStartup(): Promise<void> {
  try {
    const result = await applyMeliPuContentFinalization();
    const log = result.duplicateSkips.length || result.triesteOutcome === "skipped"
      ? logger.error.bind(logger)
      : logger.info.bind(logger);
    log({ result }, "[meliPuContentFinalization] guarded owner decisions applied");
  } catch (err) {
    logger.error({ err }, "[meliPuContentFinalization] failed (boot continues)");
  }
}