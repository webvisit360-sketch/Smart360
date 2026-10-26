import { createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db, itemsTable, mediaTable, translationsTable } from "@workspace/db";

type Connection = Pick<typeof db, "select">;
export function contentHash(value: unknown): string {
  const canonical = (v: any): any => Array.isArray(v) ? v.map(canonical)
    : v && typeof v === "object" && !(v instanceof Date)
      ? Object.fromEntries(Object.keys(v).sort().map(k => [k, canonical(v[k])])) : v;
  return createHash("sha256").update(JSON.stringify(canonical(value))).digest("hex");
}
export async function importedItemState(tx: Connection, item: typeof itemsTable.$inferSelect) {
  const translations = await tx.select().from(translationsTable).where(and(eq(translationsTable.model, "item"), eq(translationsTable.recordId, item.id)));
  const media = await tx.select().from(mediaTable).where(eq(mediaTable.itemId, item.id));
  translations.sort((a, b) => a.id.localeCompare(b.id));
  media.sort((a, b) => a.id.localeCompare(b.id));
  return { hash: contentHash({ item, translations, media }), translations };
}
