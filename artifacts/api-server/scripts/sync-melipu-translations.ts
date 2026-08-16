/**
 * Enkratna osvežitev prevodov in množinskih oblik za meli-pu IZ PRODUKCIJE
 * (izvoz v /tmp/prod-melipu-tr-full.json). Pravilo: vsebina se ureja samo v
 * produkciji; razvojna kopija se osvežuje iz nje. Zamenja celoten nabor:
 * razvojne vrstice, ki jih produkcija nima, so izbrisane.
 */
import { readFileSync } from "node:fs";
import { inArray, eq } from "drizzle-orm";
import { db, translationsTable, pluralFormsTable } from "@workspace/db";

const P = JSON.parse(readFileSync("/tmp/prod-melipu-tr-full.json", "utf8"));
const ids: string[] = P.ids;

const delTr = await db.delete(translationsTable).where(inArray(translationsTable.recordId, ids)).returning({ id: translationsTable.id });
const delPl = await db.delete(pluralFormsTable).where(eq(pluralFormsTable.tenantId, P.tenantId)).returning({ id: pluralFormsTable.id });

let insTr = 0, insPl = 0;
for (const t of P.translations ?? []) {
  await db.insert(translationsTable).values({
    model: t.model, recordId: t.record_id, field: t.field, lang: t.lang, value: t.value, stale: t.stale,
  });
  insTr++;
}
for (const p of P.plurals ?? []) {
  await db.insert(pluralFormsTable).values({ tenantId: P.tenantId, lang: p.lang, key: p.key, form: p.form, value: p.value });
  insPl++;
}
console.log(`Prevodi: izbrisanih ${delTr.length}, vstavljenih ${insTr}. Množinske oblike: izbrisanih ${delPl.length}, vstavljenih ${insPl}.`);
process.exit(0);
