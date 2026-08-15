import { db, tenantsTable, tenantAliasesTable } from "@workspace/db";
import { eq, and, ne } from "drizzle-orm";

/**
 * Tenant slug rules (naslovi-strank.md): lowercase [a-z0-9-], 3-40 chars,
 * no leading/trailing hyphen, and never a reserved word — the tenant lives
 * at smart360.info/<slug>, so slugs must not collide with app routes.
 */
export const RESERVED_SLUGS = new Set([
  "admin", "api", "app", "assets", "static", "media", "files", "uploads",
  "img", "css", "js", "fonts", "robots.txt", "sitemap.xml", "favicon.ico",
  "manifest.json", "sw.js", "health", "status", "login", "auth", "logout",
  "account", "my", "help", "support", "docs", "blog", "about", "contact",
  "privacy", "terms", "www", "mail", "cdn", "preview", "test", "demo",
  "dev", "staging", "g",
]);

export const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,38})[a-z0-9]$/;

/** Suggest a slug from an accommodation name (used by the admin UI too). */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

/**
 * Full availability verdict. `tenantId` excludes the tenant itself when
 * checking a rename. Reasons are machine-readable; the UI translates them.
 */
export async function checkSlugAvailability(
  slug: string,
  tenantId?: string,
): Promise<{ available: boolean; reason: string | null }> {
  if (!SLUG_RE.test(slug)) return { available: false, reason: "invalid_format" };
  if (RESERVED_SLUGS.has(slug)) return { available: false, reason: "reserved" };
  const [taken] = await db
    .select({ id: tenantsTable.id })
    .from(tenantsTable)
    .where(
      tenantId
        ? and(eq(tenantsTable.slug, slug), ne(tenantsTable.id, tenantId))
        : eq(tenantsTable.slug, slug),
    );
  if (taken) return { available: false, reason: "taken" };
  const [alias] = await db
    .select({ tenantId: tenantAliasesTable.tenantId })
    .from(tenantAliasesTable)
    .where(eq(tenantAliasesTable.slug, slug));
  // A tenant may move back to one of its own former slugs.
  if (alias && alias.tenantId !== tenantId)
    return { available: false, reason: "taken" };
  return { available: true, reason: null };
}
