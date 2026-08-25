import { and, eq, inArray, isNull, or, sql } from "drizzle-orm";
import {
  categoriesTable,
  db,
  itemsTable,
  sectionsTable,
  translationsTable,
} from "@workspace/db";
import { sanitizeBody } from "./sanitizeBody";

export type DescriptionLedgerEntry = {
  itemId: string;
  categoryId: string;
  categoryKey: string;
  name: string;
  sl: string;
  en: string;
  de: string;
  it: string;
};

export type DescriptionBackfillReportRow = {
  name: string;
  categoryKey: string;
  outcome: "updated" | "skipped";
  languagesWritten: Array<"sl" | "en" | "de" | "it">;
  reason: string;
};

export type DescriptionBackfillResult = {
  updated: number;
  skipped: number;
  report: DescriptionBackfillReportRow[];
};

const emptyItemBody = or(
  isNull(itemsTable.body),
  sql`btrim(${itemsTable.body}) = ''`,
);
const emptyTranslation = or(
  eq(translationsTable.value, ""),
  sql`btrim(${translationsTable.value}) = ''`,
);

export async function applyMeliPuDescriptionBackfill(
  tenantId: string,
  sectionKey: string,
  ledger: ReadonlyArray<DescriptionLedgerEntry>,
): Promise<DescriptionBackfillResult> {
  for (const entry of ledger) {
    for (const language of ["sl", "en", "de", "it"] as const) {
      if (sanitizeBody(entry[language]) !== entry[language]) {
        throw new Error(
          `Description ledger text is not canonical for ${entry.name}/${language}`,
        );
      }
    }
  }

  return db.transaction(async (tx) => {
    const currentRows = await tx
      .select({
        itemId: itemsTable.id,
        categoryId: categoriesTable.id,
        categoryKey: categoriesTable.key,
        title: itemsTable.title,
      })
      .from(itemsTable)
      .innerJoin(categoriesTable, eq(categoriesTable.id, itemsTable.categoryId))
      .innerJoin(sectionsTable, eq(sectionsTable.id, categoriesTable.sectionId))
      .where(
        and(
          eq(sectionsTable.tenantId, tenantId),
          eq(sectionsTable.key, sectionKey),
          inArray(
            itemsTable.id,
            ledger.map((entry) => entry.itemId),
          ),
        ),
      );
    const currentById = new Map(currentRows.map((row) => [row.itemId, row]));
    const report: DescriptionBackfillReportRow[] = [];

    for (const entry of ledger) {
      const current = currentById.get(entry.itemId);
      if (
        !current ||
        current.categoryId !== entry.categoryId ||
        current.categoryKey !== entry.categoryKey ||
        current.title !== entry.name
      ) {
        report.push({
          name: entry.name,
          categoryKey: entry.categoryKey,
          outcome: "skipped",
          languagesWritten: [],
          reason: "item no longer matches the approved tenant/category/title signature",
        });
        continue;
      }

      const sourceWrite = await tx
        .update(itemsTable)
        .set({ body: entry.sl })
        .where(
          and(
            eq(itemsTable.id, entry.itemId),
            eq(itemsTable.categoryId, entry.categoryId),
            eq(itemsTable.title, entry.name),
            emptyItemBody,
          ),
        )
        .returning({ id: itemsTable.id });
      if (sourceWrite.length !== 1) {
        report.push({
          name: entry.name,
          categoryKey: entry.categoryKey,
          outcome: "skipped",
          languagesWritten: [],
          reason: "source body was already populated or changed concurrently",
        });
        continue;
      }

      const languagesWritten: DescriptionBackfillReportRow["languagesWritten"] = [
        "sl",
      ];
      for (const language of ["en", "de", "it"] as const) {
        const updatedEmpty = await tx
          .update(translationsTable)
          .set({ value: entry[language], stale: false })
          .where(
            and(
              eq(translationsTable.model, "item"),
              eq(translationsTable.recordId, entry.itemId),
              eq(translationsTable.field, "body"),
              eq(translationsTable.lang, language),
              emptyTranslation,
            ),
          )
          .returning({ id: translationsTable.id });
        if (updatedEmpty.length === 1) {
          languagesWritten.push(language);
          continue;
        }
        const inserted = await tx
          .insert(translationsTable)
          .values({
            model: "item",
            recordId: entry.itemId,
            field: "body",
            lang: language,
            value: entry[language],
            stale: false,
          })
          .onConflictDoNothing({
            target: [
              translationsTable.model,
              translationsTable.recordId,
              translationsTable.field,
              translationsTable.lang,
            ],
          })
          .returning({ id: translationsTable.id });
        if (inserted.length === 1) languagesWritten.push(language);
      }
      report.push({
        name: entry.name,
        categoryKey: entry.categoryKey,
        outcome: "updated",
        languagesWritten,
        reason:
          languagesWritten.length === 4
            ? "all supplied descriptions written"
            : "source written; existing non-empty translations preserved",
      });
    }

    return {
      updated: report.filter((row) => row.outcome === "updated").length,
      skipped: report.filter((row) => row.outcome === "skipped").length,
      report,
    };
  });
}