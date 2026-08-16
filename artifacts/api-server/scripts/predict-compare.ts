/**
 * Napoved: ali bo po zagonu normalizacije V PRODUKCIJI vsebina meli-pu
 * enaka razvojni kopiji? Vzame produkcijski izvoz (/tmp/*.json), nanj
 * lokalno uporabi ISTI sanitizer in rezultat primerja z razvojno bazo.
 */
import { readFileSync } from "node:fs";
import { db, tenantsTable, sectionsTable, categoriesTable, itemsTable, translationsTable, pluralFormsTable } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
import { sanitizeBody, sanitizePlain } from "../src/lib/sanitizeBody";
import { isRichField } from "../src/lib/normalizeContent";

const P = JSON.parse(readFileSync("/tmp/prod-melipu.json", "utf8"));
const PT = JSON.parse(readFileSync("/tmp/prod-melipu-tr.json", "utf8"));

const sanitizeBodyColumn = (raw: string): string => {
  try {
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) return JSON.stringify(arr.map((p) => (typeof p === "string" ? sanitizeBody(p) : p)));
  } catch {}
  return sanitizeBody(raw);
};

let diffs = 0;
const report = (k: string, prod: unknown, dev: unknown) => {
  diffs++;
  console.log(`— ${k}\n   PROD(norm): ${JSON.stringify(prod)?.slice(0, 160)}\n   DEV:        ${JSON.stringify(dev)?.slice(0, 160)}`);
};

// tenant
const [devT] = await db.select().from(tenantsTable).where(eq(tenantsTable.slug, "meli-pu"));
if (!devT) throw new Error("dev tenant missing");
const tMap: Record<string, string> = { name: "name", subtitle: "subtitle", cover_title: "coverTitle", cover_subtitle: "coverSubtitle" };
for (const [pk, dk] of Object.entries(tMap)) {
  const pv = P.tenant[pk];
  if (typeof pv !== "string") continue;
  const norm = sanitizePlain(pv);
  if (norm !== (devT as any)[dk]) report(`tenant.${dk}`, norm, (devT as any)[dk]);
}

// sections
const devSecs = await db.select().from(sectionsTable).where(eq(sectionsTable.tenantId, devT.id));
const dS = new Map(devSecs.map((s) => [s.id, s]));
for (const s of P.sections) {
  const d = dS.get(s.id);
  if (!d) { report(`section ${s.key}`, "<exists>", "<missing>"); continue; }
  if (sanitizePlain(s.title) !== d.title) report(`section(${s.key}).title`, sanitizePlain(s.title), d.title);
  const norm = s.subtitle == null ? null : sanitizePlain(s.subtitle);
  if ((norm ?? null) !== (d.subtitle ?? null)) report(`section(${s.key}).subtitle`, norm, d.subtitle);
}

// categories
const devCats = await db.select().from(categoriesTable).where(inArray(categoriesTable.sectionId, devSecs.map((s) => s.id)));
const dC = new Map(devCats.map((c) => [c.id, c]));
for (const c of P.categories) {
  const d = dC.get(c.id);
  if (!d) { report(`category ${c.label}`, "<exists>", "<missing>"); continue; }
  if (sanitizePlain(c.label) !== d.label) report(`category(${c.label}).label`, sanitizePlain(c.label), d.label);
}

// items
const devItems = await db.select().from(itemsTable).where(inArray(itemsTable.categoryId, devCats.map((c) => c.id)));
const dI = new Map(devItems.map((i) => [i.id, i]));
const plainF: [string, string][] = [["title", "title"], ["price", "price"], ["price_unit", "priceUnit"], ["phone", "phone"], ["distance", "distance"]];
for (const i of P.items) {
  const d = dI.get(i.id);
  if (!d) { report(`item ${i.title}`, "<exists>", "<missing>"); continue; }
  for (const [pk, dk] of plainF) {
    const pv = i[pk];
    const norm = pv == null ? null : sanitizePlain(pv);
    if ((norm ?? null) !== ((d as any)[dk] ?? null)) report(`item(${i.cat}/${i.title}).${dk}`, norm, (d as any)[dk]);
  }
  const nNote = i.note_text == null ? null : sanitizeBody(i.note_text);
  if ((nNote ?? null) !== (d.noteText ?? null)) report(`item(${i.cat}/${i.title}).noteText`, nNote, d.noteText);
  const nBody = i.body == null ? null : sanitizeBodyColumn(i.body);
  if ((nBody ?? null) !== (d.body ?? null)) report(`item(${i.cat}/${i.title}).body`, nBody, d.body);
  const pB = Array.isArray(i.bullets) ? i.bullets.map((b: unknown) => (typeof b === "string" ? sanitizePlain(b) : b)) : i.bullets;
  if (JSON.stringify(pB ?? []) !== JSON.stringify(d.bullets ?? [])) report(`item(${i.cat}/${i.title}).bullets`, pB, d.bullets);
}

// translations
const devTr = JSON.parse(readFileSync("/tmp/dev-melipu-tr.json", "utf8"));
const dTr = new Map((devTr.translations ?? []).map((t: any) => [`${t.model}|${t.record_id}|${t.field}|${t.lang}`, t]));
for (const t of PT.translations ?? []) {
  const key = `${t.model}|${t.record_id}|${t.field}|${t.lang}`;
  const d: any = dTr.get(key);
  const norm = isRichField(t.field) ? sanitizeBody(t.value) : sanitizePlain(t.value);
  if (!d) { report(`translation ${key}`, norm, "<missing>"); continue; }
  if (norm !== d.value) report(`translation ${key}`, norm, d.value);
  dTr.delete(key);
}
for (const [key] of dTr) report(`translation ${key}`, "<missing>", "<exists>");

// plural forms
const dPl = new Map((JSON.parse(readFileSync("/tmp/dev-melipu-tr.json", "utf8")).plurals ?? []).map((p: any) => [`${p.lang}|${p.key}|${p.form}`, p]));
for (const p of PT.plurals ?? []) {
  const key = `${p.lang}|${p.key}|${p.form}`;
  const d: any = dPl.get(key);
  const norm = sanitizePlain(p.value);
  if (!d) { report(`plural ${key}`, norm, "<missing>"); continue; }
  if (norm !== d.value) report(`plural ${key}`, norm, d.value);
  dPl.delete(key);
}
for (const [key] of dPl) report(`plural ${key}`, "<missing>", "<exists>");

console.log(`\nPreostale razlike po (simulirani) produkcijski normalizaciji: ${diffs}`);
process.exit(0);
