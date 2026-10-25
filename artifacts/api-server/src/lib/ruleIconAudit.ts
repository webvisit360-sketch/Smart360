import { createHash } from "node:crypto";
import { matchRuleIcon, ruleBulletTexts } from "@workspace/category-icons";
import { logger } from "./logger";

type Item = { id?: string; isVisible?: boolean; bullets?: unknown; body?: unknown; title?: unknown; tint?: unknown; gpxRoute?: unknown };
type Category = { id: string; layout?: string; isVisible?: boolean; items?: Item[] };
type Section = { key: string; isVisible?: boolean; categories?: Category[] };

/** Logs every guest-visible entry bullet that falls back to the neutral rule
 * icon. Owner-approved published sentence text accompanies the identifiers
 * and fingerprint so catalogue misses can be reviewed. */
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
        const bullets = ruleBulletTexts(item);
        const texts = bullets.length || category.layout !== "rules" || item.title || item.gpxRoute ? bullets :
          [String(item.body ?? "").replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim()].filter(Boolean);
        texts.forEach((text, index) => {
          const result = matchRuleIcon(text);
          if (!result.fallback) return;
          emit({ event: "rule_icon_fallback", tenantId, language, section: section.key,
            categoryId: category.id, itemId: item.id ?? null, bulletIndex: index, length: text.length, sentence: text,
            fingerprint: createHash("sha256").update(text.toLowerCase()).digest("hex").slice(0, 12),
            fallback: result.entry.id });
          count++;
        });
      }
    }
  }
  return count;
}
