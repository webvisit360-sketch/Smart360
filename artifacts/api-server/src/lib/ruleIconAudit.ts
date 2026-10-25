import { createHash } from "node:crypto";
import { matchRuleIcon, ruleBulletTexts } from "@workspace/category-icons";
import { logger } from "./logger";

type Item = { id?: string; isVisible?: boolean; bullets?: unknown; body?: unknown };
type Category = { id: string; isVisible?: boolean; items?: Item[] };
type Section = { key: string; isVisible?: boolean; categories?: Category[] };

/** Logs every guest-visible entry bullet that falls back to the neutral rule
 * icon. Raw bullet text is never logged: only ids, position, length and a
 * short irreversible fingerprint so repeated misses can be grouped. */
export function auditRuleIconFallbacks(
  tenantId: string, language: string, sections: Section[],
  emit: (record: Record<string, unknown>) => void = (record) => logger.warn(record, "Rule icon fallback"),
): number {
  let count = 0;
  for (const section of sections ?? []) {
    if (section.isVisible === false) continue;
    for (const category of section.categories ?? []) {
      if (category.isVisible === false) continue;
      for (const item of category.items ?? []) {
        if (item.isVisible === false) continue;
        ruleBulletTexts(item).forEach((text, index) => {
          const result = matchRuleIcon(text);
          if (!result.fallback) return;
          emit({ event: "rule_icon_fallback", tenantId, language, section: section.key,
            categoryId: category.id, itemId: item.id ?? null, bulletIndex: index, length: text.length,
            fingerprint: createHash("sha256").update(text.toLowerCase()).digest("hex").slice(0, 12),
            fallback: result.entry.id });
          count++;
        });
      }
    }
  }
  return count;
}
