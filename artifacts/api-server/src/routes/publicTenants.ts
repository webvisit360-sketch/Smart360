import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, tenantsTable, tenantAliasesTable } from "@workspace/db";
import {
  GetPublicTenantResponse,
  SearchPublicTenantResponse,
} from "@workspace/api-zod";
import { buildTenantContent } from "../lib/contentTree";
import { isAuthenticated } from "../lib/adminAuth";

function serialize<T>(value: T): unknown {
  return JSON.parse(JSON.stringify(value));
}

const router: IRouter = Router();

function firstParam(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

/**
 * Resolves a tenant by slug.  If the request carries a Host header that
 * matches a customDomain stored in the database, that domain takes
 * precedence and we look up the tenant by domain instead of slug.
 */
async function resolveTenantBySlugOrDomain(
  slug: string,
  host: string | undefined
) {
  // Strip port from host so "example.com:3000" matches "example.com".
  const hostname = host ? host.replace(/:\d+$/, "") : undefined;

  if (hostname) {
    // Look for a tenant whose customDomain matches the incoming hostname.
    const [byDomain] = await db
      .select()
      .from(tenantsTable)
      .where(eq(tenantsTable.customDomain, hostname));
    if (byDomain) return byDomain;
  }

  // Fall back to slug lookup.
  const [bySlug] = await db
    .select()
    .from(tenantsTable)
    .where(eq(tenantsTable.slug, slug));
  if (bySlug) return bySlug;

  // Renamed tenant? Old slugs live forever in tenant_aliases so that old
  // QR codes keep working — resolve them to the current tenant.
  const [alias] = await db
    .select()
    .from(tenantAliasesTable)
    .where(eq(tenantAliasesTable.slug, slug));
  if (!alias) return undefined;
  const [byAlias] = await db
    .select()
    .from(tenantsTable)
    .where(eq(tenantsTable.id, alias.tenantId));
  return byAlias;
}

// GET /public/tenant-by-domain
// Resolves the tenant from the Host header alone (used when the guest app
// is served on a custom domain and the slug is unknown to the frontend).
router.get("/public/tenant-by-domain", async (req, res): Promise<void> => {
  const hostname = req.hostname; // express strips port automatically
  if (!hostname) {
    res.status(400).json({ error: "Cannot determine host" });
    return;
  }

  const [tenant] = await db
    .select()
    .from(tenantsTable)
    .where(eq(tenantsTable.customDomain, hostname));

  const preview =
    (req.query["preview"] === "true" || req.query["preview"] === "1") &&
    (await isAuthenticated(req));

  if (!tenant || (!tenant.isPublished && !preview)) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  const lang =
    typeof req.query["lang"] === "string" ? req.query["lang"] : undefined;
  const tree = await buildTenantContent(tenant, { visibleOnly: true, lang });
  res.json(GetPublicTenantResponse.parse(serialize(tree)));
});

router.get("/public/tenants/:slug", async (req, res): Promise<void> => {
  const slug = firstParam(req.params["slug"]);
  if (!slug) {
    res.status(400).json({ error: "Missing slug" });
    return;
  }
  const tenant = await resolveTenantBySlugOrDomain(
    slug,
    req.headers["host"] as string | undefined
  );
  // Preview of unpublished tenants is only for the authenticated operator.
  const preview =
    (req.query["preview"] === "true" || req.query["preview"] === "1") &&
    (await isAuthenticated(req));
  if (!tenant || (!tenant.isPublished && !preview)) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const lang =
    typeof req.query["lang"] === "string" ? req.query["lang"] : undefined;
  const tree = await buildTenantContent(tenant, { visibleOnly: true, lang });
  res.json(GetPublicTenantResponse.parse(serialize(tree)));
});

router.get("/public/tenants/:slug/search", async (req, res): Promise<void> => {
  const slug = firstParam(req.params["slug"]);
  const q =
    typeof req.query["q"] === "string" ? req.query["q"].trim().toLowerCase() : "";
  if (!slug || !q) {
    res.json(SearchPublicTenantResponse.parse(serialize([])));
    return;
  }
  const tenant = await resolveTenantBySlugOrDomain(
    slug,
    req.headers["host"] as string | undefined
  );
  if (!tenant || (!tenant.isPublished && !(await isAuthenticated(req)))) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const lang =
    typeof req.query["lang"] === "string" ? req.query["lang"] : undefined;
  const tree = await buildTenantContent(tenant, { visibleOnly: true, lang });
  const results: Array<{
    itemId: string;
    categoryId: string;
    sectionId: string;
    title: string;
    snippet: string;
    categoryLabel: string;
    sectionTitle: string;
  }> = [];
  const strip = (s: string): string => s.replace(/<[^>]+>/g, " ");
  for (const section of tree.sections) {
    for (const category of section.categories) {
      for (const item of category.items) {
        const haystackParts = [
          item.title ?? "",
          item.body ?? "",
          item.noteText ?? "",
          item.bullets.join(" "),
          category.label,
        ];
        const haystack = strip(haystackParts.join(" ")).toLowerCase();
        if (!haystack.includes(q)) continue;
        const bodyText = strip(item.body ?? "");
        const idx = bodyText.toLowerCase().indexOf(q);
        const snippet =
          idx >= 0
            ? bodyText.slice(Math.max(0, idx - 40), idx + 80).trim()
            : bodyText.slice(0, 100).trim();
        results.push({
          itemId: item.id,
          categoryId: category.id,
          sectionId: section.id,
          title: item.title ?? category.label,
          snippet,
          categoryLabel: category.label,
          sectionTitle: section.title,
        });
        if (results.length >= 30) break;
      }
    }
  }
  res.json(SearchPublicTenantResponse.parse(serialize(results)));
});

export default router;
