import { resolveCategoryTileIcon } from "@workspace/category-icons";
import { logger } from "./logger";

type Category = { id: string; label?: string; icon?: string | null; isVisible?: boolean; layout?: string; items?: { isVisible?: boolean }[] };
type Section = { key: string; isVisible?: boolean; categories?: Category[] };

/** Same visibility and resolver as Enostaven. Called on every served payload,
 * including cache hits; no client-supplied logging endpoint or persisted data. */
export function auditCategoryIconFallbacks(
  tenantId: string, language: string, sections: Section[],
  emit: (record: Record<string, unknown>) => void = (record) => logger.warn(record, "Category icon fallback"),
): number {
  let count = 0;
  for (const section of sections) {
    if (section.isVisible === false) continue;
    for (const category of section.categories ?? []) {
      if (category.isVisible === false || !(category.layout === "events" || category.items?.some(item => item.isVisible !== false))) continue;
      const result = resolveCategoryTileIcon(category, section.key);
      if (!result.fallback) continue;
      emit({ event: "category_icon_fallback", tenantId, language, categoryId: category.id,
        label: category.label ?? "", section: section.key, fallback: result.icon });
      count++;
    }
  }
  return count;
}
