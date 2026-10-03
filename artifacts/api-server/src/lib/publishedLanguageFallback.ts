import type { PublishedContent } from "./publishedSnapshots";
import type { GuestTenantContentTree } from "./contentTree";
import { fallbackText } from "@workspace/guide-languages";

const textFields = ["name", "title", "label", "subtitle", "description", "body", "bullets", "tagline", "coverTitle", "coverSubtitle", "intro"];
function meaningful(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(meaningful);
  if (typeof value !== "string") return false;
  try { const parsed = JSON.parse(value); if (Array.isArray(parsed)) return parsed.some(meaningful); } catch { /* plain text */ }
  return value.replace(/<[^>]*>/g, "").replace(/&nbsp;|&#160;/g, " ").trim().length > 0;
}
function textValue(...values: unknown[]): unknown {
  if (values.some(Array.isArray)) {
    const arrays = values.map(value => Array.isArray(value) ? value : []);
    return Array.from({ length: Math.max(...arrays.map(value => value.length)) }, (_, i) =>
      textValue(...arrays.map(value => value[i]))).filter(meaningful);
  }
  const first = values.find(meaningful);
  return first ?? values.find(value => value !== undefined);
}
/** Only text and matching visible rows are merged. No draft reads or structural additions. */
export function publishedLanguageTree(snapshot: PublishedContent, language: string): GuestTenantContentTree | undefined {
  const selected = snapshot.languages[language] ?? snapshot.languages.en ?? snapshot.languages.sl;
  if (!selected) return undefined;
  const english = snapshot.languages.en?.tree;
  const slovene = snapshot.languages.sl?.tree;
  function merge(row: any, en: any, sl: any): any {
    const result = { ...row };
    for (const field of textFields) {
      if (field in row || field in (en ?? {}) || field in (sl ?? {})) {
        result[field] = textValue(row[field], en?.[field], sl?.[field]);
      }
    }
    if (row.eventSchedule) {
      result.eventSchedule = { ...row.eventSchedule };
      for (const field of ["locationText", "ageText"]) {
        result.eventSchedule[field] = fallbackText(row.eventSchedule[field], en?.eventSchedule?.[field], sl?.eventSchedule?.[field]);
      }
    }
    for (const collection of ["sections", "categories", "items"]) {
      if (!Array.isArray(row[collection])) continue;
      result[collection] = row[collection].map((child: any) =>
        merge(child, en?.[collection]?.find((r: any) => r.id === child.id), sl?.[collection]?.find((r: any) => r.id === child.id)));
    }
    return result;
  }
  return merge(selected.tree, english, slovene);
}