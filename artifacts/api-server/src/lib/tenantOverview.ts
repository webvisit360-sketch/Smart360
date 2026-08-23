import { sql } from "drizzle-orm";
import { db, tenantsTable } from "@workspace/db";

/**
 * Owner's cockpit data (Instruction #28 CP2b): per-tenant readiness and
 * pending work, computed from REAL data — never hardcoded. This module is the
 * single source of the readiness formula so CP4's host-side progress ring can
 * reuse it later.
 *
 * Pending counts follow the same visibility rules the corresponding admin
 * screens use:
 *  - orders: status 'novo', admin-visible (notification sent/skipped, within
 *    retention) — mirrors routes/orders.ts;
 *  - messages: OPEN threads whose latest message came from the guest
 *    (nothing marks threads read, so "guest spoke last" = waiting for host);
 *  - locations: distance-review proposals still 'pending';
 *  - photos: visible, non-deleted categories whose tile has neither a photo
 *    (no visible item with media) nor a colour tile (no visible item tint).
 */

export type ReadinessCheck = { key: string; label: string; done: boolean };

export type TenantOverviewRow = {
  tenantId: string;
  readinessPct: number;
  checks: ReadinessCheck[];
  pendingOrders: number;
  pendingMessages: number;
  pendingLocations: number;
  missingPhotos: number;
};

type CountMap = Map<string, number>;

function toCountMap(rows: Array<Record<string, unknown>>): CountMap {
  const map: CountMap = new Map();
  for (const r of rows) {
    map.set(String(r["tenant_id"]), Number(r["n"]));
  }
  return map;
}

export async function buildTenantOverviews(): Promise<TenantOverviewRow[]> {
  const [tenants, ordersRes, messagesRes, locationsRes, photosRes, contentRes] =
    await Promise.all([
      db
        .select({
          id: tenantsTable.id,
          name: tenantsTable.name,
          subtitle: tenantsTable.subtitle,
          email: tenantsTable.email,
          phone: tenantsTable.phone,
          logoUrl: tenantsTable.logoUrl,
          heroUrl: tenantsTable.heroUrl,
          livingGuideHeroUrl: tenantsTable.livingGuideHeroUrl,
          latitude: tenantsTable.latitude,
          longitude: tenantsTable.longitude,
          isPublished: tenantsTable.isPublished,
        })
        .from(tenantsTable),
      db.execute(sql`
        SELECT tenant_id, count(*)::int AS n FROM orders
        WHERE status = 'novo'
          AND notification_status IN ('sent','skipped')
          AND delete_after > now()
        GROUP BY tenant_id`),
      db.execute(sql`
        SELECT t.tenant_id, count(*)::int AS n FROM message_threads t
        WHERE t.is_open
          AND t.delete_after > now()
          AND (
            SELECT m.sender FROM messages m
            WHERE m.thread_id = t.id
            ORDER BY m.created_at DESC, m.id DESC
            LIMIT 1
          ) = 'guest'
        GROUP BY t.tenant_id`),
      db.execute(sql`
        SELECT tenant_id, count(*)::int AS n FROM item_distance_proposals
        WHERE status = 'pending'
        GROUP BY tenant_id`),
      db.execute(sql`
        SELECT s.tenant_id, count(*)::int AS n
        FROM categories c
        JOIN sections s ON s.id = c.section_id
        WHERE c.deleted_at IS NULL AND c.is_visible
          AND NOT EXISTS (
            SELECT 1 FROM items i
            JOIN media m ON m.item_id = i.id
            WHERE i.category_id = c.id AND i.deleted_at IS NULL AND i.is_visible
          )
          AND NOT EXISTS (
            SELECT 1 FROM items i2
            WHERE i2.category_id = c.id AND i2.deleted_at IS NULL
              AND i2.is_visible AND i2.tint IS NOT NULL
          )
        GROUP BY s.tenant_id`),
      db.execute(sql`
        SELECT s.tenant_id,
               count(DISTINCT c.id)::int  AS n,
               count(i.id)::int           AS items
        FROM sections s
        LEFT JOIN categories c ON c.section_id = s.id
          AND c.deleted_at IS NULL AND c.is_visible
        LEFT JOIN items i ON i.category_id = c.id
          AND i.deleted_at IS NULL AND i.is_visible
        GROUP BY s.tenant_id`),
    ]);

  const orders = toCountMap(ordersRes.rows as Array<Record<string, unknown>>);
  const messages = toCountMap(messagesRes.rows as Array<Record<string, unknown>>);
  const locations = toCountMap(locationsRes.rows as Array<Record<string, unknown>>);
  const photos = toCountMap(photosRes.rows as Array<Record<string, unknown>>);
  const categoriesCount: CountMap = new Map();
  const itemsCount: CountMap = new Map();
  for (const r of contentRes.rows as Array<Record<string, unknown>>) {
    categoriesCount.set(String(r["tenant_id"]), Number(r["n"]));
    itemsCount.set(String(r["tenant_id"]), Number(r["items"]));
  }

  return tenants.map((t) => {
    const pendingOrders = orders.get(t.id) ?? 0;
    const pendingMessages = messages.get(t.id) ?? 0;
    const pendingLocations = locations.get(t.id) ?? 0;
    const missingPhotos = photos.get(t.id) ?? 0;
    const nCategories = categoriesCount.get(t.id) ?? 0;
    const nItems = itemsCount.get(t.id) ?? 0;

    const checks: ReadinessCheck[] = [
      {
        key: "basics",
        label: "Ime in podnaslov",
        done: Boolean(t.name?.trim()) && Boolean(t.subtitle?.trim()),
      },
      {
        key: "visual",
        label: "Logotip ali naslovna fotografija",
        done: Boolean(t.logoUrl || t.heroUrl || t.livingGuideHeroUrl),
      },
      {
        key: "contact",
        label: "Kontakt (e-pošta ali telefon)",
        done: Boolean(t.email?.trim() || t.phone?.trim()),
      },
      {
        key: "location",
        label: "Lokacija nastanitve",
        done: t.latitude != null && t.longitude != null,
      },
      {
        key: "content",
        label: "Vsaj en vnos vsebine",
        done: nItems > 0,
      },
      {
        key: "photos",
        label: "Vse kategorije imajo fotografijo",
        done: nCategories > 0 && missingPhotos === 0,
      },
      {
        key: "locationsConfirmed",
        label: "Vse lokacije potrjene",
        done: pendingLocations === 0,
      },
      {
        key: "published",
        label: "Objavljen",
        done: t.isPublished,
      },
    ];
    const done = checks.filter((c) => c.done).length;

    return {
      tenantId: t.id,
      readinessPct: Math.round((100 * done) / checks.length),
      checks,
      pendingOrders,
      pendingMessages,
      pendingLocations,
      missingPhotos,
    };
  });
}
