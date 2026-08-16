import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, tenantsTable, tenantAliasesTable } from "@workspace/db";
import {
  GetPublicTenantResponse,
  SearchPublicTenantResponse,
} from "@workspace/api-zod";
import { buildTenantContent } from "../lib/contentTree";
import { getUiAndPlurals } from "../lib/translationKeys";
import { guestUrl, guestQrSvg } from "../lib/guestUrl";
import { wifiQrSvg } from "../lib/wifiQr";
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
// 60-second in-memory cache for slug/domain → tenant lookups (naslovi-strank.md §1).
// Invalidated on every tenant save via invalidateTenantCache().
type TenantRow = typeof tenantsTable.$inferSelect;
const tenantCache = new Map<string, { tenant: TenantRow | undefined; expiresAt: number }>();
const TENANT_CACHE_TTL_MS = 60 * 1000;

export function invalidateTenantCache(): void {
  tenantCache.clear();
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
  const tree = await buildTenantContent(tenant, { visibleOnly: true, lang });
  const { ui, plurals } = await getUiAndPlurals(tenant.id, lang ?? "sl");
  const publicUrl = guestUrl(tenant.slug);
  const qrSvg = await guestQrSvg(publicUrl);
  // Join-network QR — always rendered fresh from the CURRENT ssid/password.
  const joinQr = tenant.wifiSsid
    ? await wifiQrSvg(tenant.wifiSsid, tenant.wifiPass, tenant.wifiEnc)
    : null;
  // An admin save must reach a reloading guest within a second — never let
  // the browser reuse a cached copy of this JSON.
  res.set("Cache-Control", "no-store");
  res.json(
    GetPublicTenantResponse.parse(
      serialize({ ...tree, publicUrl, qrSvg, wifiQrSvg: joinQr, ui, plurals })
    )
  );
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
    // Home-screen icons: the TENANT's artwork, derived on upload alongside
    // the square avatar (same uuid prefix). Smart360 icon only as fallback
    // for a tenant with no logo uploaded.
    const iconBase =
      tenant.logoSquareUrl && tenant.logoSquareUrl.endsWith("-kvadrat.png")
        ? tenant.logoSquareUrl.replace(/-kvadrat\.png$/, "")
        : null;
    const icons = iconBase
      ? [
          { src: `${iconBase}-ikona-512.png`, sizes: "512x512", type: "image/png", purpose: "any" },
          { src: `${iconBase}-ikona-192.png`, sizes: "192x192", type: "image/png", purpose: "any" },
          // Wider safe margin (60 % artwork) — Android crops up to 20 % per side.
          { src: `${iconBase}-ikona-maskable-512.png`, sizes: "512x512", type: "image/png", purpose: "maskable" },
        ]
      : [
          { src: "/brand/ikona-smart360-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
          { src: "/brand/ikona-smart360-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
        ];
    res
      // Short client cache: a rename/publish change must reach installers
      // quickly; the process-local tenant cache is already only 60 s.
      .set("Cache-Control", "public, max-age=60")
      .type("application/manifest+json")
      .json({
        name: tenant.name,
        short_name: tenant.name.length > 12 ? tenant.name.slice(0, 12) : tenant.name,
        // Installed in a language → it opens in that language (only enabled ones).
        start_url: `/${tenant.slug}/${
          rawLang && rawLang !== "sl" && (tenant.languages ?? []).includes(rawLang)
            ? `?lang=${encodeURIComponent(rawLang)}`
            : ""
        }`,
        scope: `/${tenant.slug}/`,
        display: "standalone",
        theme_color: "#ffffff",
        background_color: "#ffffff",
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
  const tree = await buildTenantContent(tenant, { visibleOnly: true, lang });
  const { ui, plurals } = await getUiAndPlurals(tenant.id, lang ?? "sl");
  const publicUrl = guestUrl(tenant.slug);
  const qrSvg = await guestQrSvg(publicUrl);
  // Join-network QR — rendered fresh from the CURRENT ssid/password on every
  // request (never cached by tenant id: a password change must change the code).
  const joinQr = tenant.wifiSsid
    ? await wifiQrSvg(tenant.wifiSsid, tenant.wifiPass, tenant.wifiEnc)
    : null;
  // An admin save must reach a reloading guest within a second — never let
  // the browser reuse a cached copy of this JSON.
  res.set("Cache-Control", "no-store");
  res.json(
    GetPublicTenantResponse.parse(
      serialize({ ...tree, publicUrl, qrSvg, wifiQrSvg: joinQr, ui, plurals })
    )
  );
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
