import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, tenantsTable, tenantAliasesTable } from "@workspace/db";
import {
  GetPublicTenantResponse,
  SearchPublicTenantResponse,
} from "@workspace/api-zod";
import { buildTenantContent, type TenantContentTree } from "../lib/contentTree";
import { getUiAndPlurals } from "../lib/translationKeys";
import { guestUrl, guestQrSvg } from "../lib/guestUrl";
import { wifiQrSvg } from "../lib/wifiQr";
import { isAuthenticated } from "../lib/adminAuth";
import { getHostResponseStats } from "../lib/hostResponseStats";

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
// 60-second in-memory cache for slug/domain → tenant lookups (naslovi-strank.md §1).
// Invalidated on every tenant save via invalidateTenantCache().
type TenantRow = typeof tenantsTable.$inferSelect;
const tenantCache = new Map<string, { tenant: TenantRow | undefined; expiresAt: number }>();
const TENANT_CACHE_TTL_MS = 60 * 1000;

export function invalidateTenantCache(): void {
  tenantCache.clear();
  payloadCache.clear();
}

// Built guide payload per (tenant id, lang) — the guest hot path. A cache hit
// skips the ~10 content queries and the zod parse entirely.
// Same-process invalidation is immediate: every admin save calls
// invalidateTenantCache() above. The short TTL only bounds staleness on OTHER
// autoscale instances, which a save on this one cannot reach.
type PayloadEntry = {
  payload: unknown;
  tree: TenantContentTree;
  expiresAt: number;
};
const payloadCache = new Map<string, PayloadEntry>();
const PAYLOAD_CACHE_TTL_MS = 30 * 1000;

async function buildPublicPayload(
  tenant: TenantRow,
  lang: string | undefined,
): Promise<PayloadEntry> {
  const tree = await buildTenantContent(tenant, { visibleOnly: true, lang });
  const { ui, plurals } = await getUiAndPlurals(tenant.id, lang ?? "sl");
  const publicUrl = guestUrl(tenant.slug);
  const qrSvg = await guestQrSvg(publicUrl);
  // Join-network QR — derived from the CURRENT tenant row. A Wi-Fi password
  // change is a tenant save, which clears this cache before guests can read
  // a stale code.
  const joinQr = tenant.wifiSsid
    ? await wifiQrSvg(tenant.wifiSsid, tenant.wifiPass, tenant.wifiEnc)
    : null;
  const responseStats = await getHostResponseStats(tenant.id);
  const payload = GetPublicTenantResponse.parse(
    serialize({
      ...tree,
      publicUrl,
      qrSvg,
      wifiQrSvg: joinQr,
      ui,
      plurals,
      hostAnsweredMessageCount: responseStats.answeredCount,
      hostResponseMedianMinutes: responseStats.medianMinutes,
    }),
  );
  return { payload, tree, expiresAt: Date.now() + PAYLOAD_CACHE_TTL_MS };
}

async function getPublicPayload(
  tenant: TenantRow,
  lang: string | undefined,
  opts: { bypassCache: boolean },
): Promise<PayloadEntry> {
  if (opts.bypassCache) return buildPublicPayload(tenant, lang);
  const key = `${tenant.id}|${lang ?? "sl"}`;
  const hit = payloadCache.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit;
  const entry = await buildPublicPayload(tenant, lang);
  payloadCache.set(key, entry);
  return entry;
}

async function resolveTenantBySlugOrDomain(
  slug: string,
  host: string | undefined
) {
  // Strip port from host so "example.com:3000" matches "example.com".
  const hostname = host ? host.replace(/:\d+$/, "") : undefined;

  const cacheKey = `${hostname ?? ""}|${slug}`;
  const cached = tenantCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.tenant;
  const tenant = await resolveTenantUncached(slug, hostname);
  tenantCache.set(cacheKey, { tenant, expiresAt: Date.now() + TENANT_CACHE_TTL_MS });
  return tenant;
}

async function resolveTenantUncached(
  slug: string,
  hostname: string | undefined
) {

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

// A guest may only request a language the tenant has enabled — anything else
// silently falls back to Slovene (undefined = source language).
function enabledLang(
  tenant: { languages?: string[] | null },
  req: { query: Record<string, unknown> }
): string | undefined {
  const raw = typeof req.query["lang"] === "string" ? req.query["lang"] : undefined;
  if (!raw || raw === "sl") return undefined;
  return (tenant.languages ?? []).includes(raw) ? raw : undefined;
}

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

  const lang = enabledLang(tenant, req);
  // Preview (and unpublished) requests bypass the payload cache: the operator
  // must always see the database as it is right now.
  const { payload } = await getPublicPayload(tenant, lang, {
    bypassCache: preview || !tenant.isPublished,
  });
  // An admin save must reach a reloading guest within a second — never let
  // the browser reuse a cached copy of this JSON.
  res.set("Cache-Control", "no-store");
  res.json(payload);
});

// GET /public/tenants/:slug/manifest.webmanifest
// Per-tenant PWA manifest: "add to home screen" must open THIS accommodation,
// so scope and start_url are the tenant path. Icons are the Smart360 app
// icon, never the accommodation photo.
router.get(
  "/public/tenants/:slug/manifest.webmanifest",
  async (req, res): Promise<void> => {
    const slug = firstParam(req.params["slug"]);
    if (!slug) {
      res.status(400).json({ error: "Missing slug" });
      return;
    }
    const rawLang = firstParam(req.query["lang"] as string | string[] | undefined);
    const tenant = await resolveTenantBySlugOrDomain(
      slug,
      req.headers["host"] as string | undefined
    );
    if (!tenant || !tenant.isPublished) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const icons = [
      { src: "/brand/ikona-smart360-192.png", sizes: "192x192", type: "image/png", purpose: "any maskable" },
      { src: "/brand/ikona-smart360-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
    ];
    res
      // Short client cache: a rename/publish change must reach installers
      // quickly; the process-local tenant cache is already only 60 s.
      .set("Cache-Control", "public, max-age=60")
      .type("application/manifest+json")
      .json({
        name: "Smart360",
        short_name: "Smart360",
        // Installed in a language → it opens in that language (only enabled ones).
        start_url: `/${tenant.slug}/${
          rawLang && rawLang !== "sl" && (tenant.languages ?? []).includes(rawLang)
            ? `?lang=${encodeURIComponent(rawLang)}`
            : ""
        }`,
        scope: `/${tenant.slug}/`,
        display: "standalone",
        theme_color: "#121A14",
        background_color: "#121A14",
        icons,
      });
  }
);

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
  const lang = enabledLang(tenant, req);
  // Preview (and unpublished) requests bypass the payload cache: the operator
  // must always see the database as it is right now.
  const { payload } = await getPublicPayload(tenant, lang, {
    bypassCache: preview || !tenant.isPublished,
  });
  // An admin save must reach a reloading guest within a second — never let
  // the browser reuse a cached copy of this JSON.
  res.set("Cache-Control", "no-store");
  res.json(payload);
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
  const lang = enabledLang(tenant, req);
  // Search shares the guest payload cache — it must never rebuild the full
  // tree per keystroke.
  const { tree } = await getPublicPayload(tenant, lang, {
    bypassCache: !tenant.isPublished,
  });
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
