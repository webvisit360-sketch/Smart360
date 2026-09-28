import { eq, sql } from "drizzle-orm";
import {
  db, tenantAliasesTable, tenantSlugReservationsTable, tenantsTable,
  type Db,
} from "@workspace/db";

export const SLUG_TAKEN_MESSAGE =
  "Naslov je že zaseden ali trajno rezerviran za drugo oziroma prejšnjo objavo.";

type Executor = Pick<Db, "insert" | "delete" | "select">;

/** The PK serializes concurrent claims. Never ignore a claim from another owner. */
export async function claimSlug(tx: Executor, slug: string, tenantId: string): Promise<void> {
  const [claim] = await tx.insert(tenantSlugReservationsTable)
    .values({ slug, tenantId })
    .onConflictDoNothing()
    .returning({ tenantId: tenantSlugReservationsTable.tenantId });
  if (claim) return;
  const [existing] = await tx.select({ tenantId: tenantSlugReservationsTable.tenantId })
    .from(tenantSlugReservationsTable)
    .where(eq(tenantSlugReservationsTable.slug, slug));
  if (!existing || existing.tenantId !== tenantId) throw new SlugTakenError();
  const [historical] = await tx.select({ slug: tenantAliasesTable.slug })
    .from(tenantAliasesTable)
    .where(eq(tenantAliasesTable.slug, slug));
  if (historical) throw new SlugTakenError();
}

export class SlugTakenError extends Error {
  constructor() { super(SLUG_TAKEN_MESSAGE); }
}

/** Only an unpublished slug can be released, never a published address. */
export async function releaseUnpublishedSlug(tx: Executor, slug: string, tenantId: string): Promise<void> {
  const [alias] = await tx.select({ slug: tenantAliasesTable.slug })
    .from(tenantAliasesTable).where(eq(tenantAliasesTable.slug, slug));
  if (alias) return;
  await tx.delete(tenantSlugReservationsTable).where(sql`
    ${tenantSlugReservationsTable.slug} = ${slug}
    AND ${tenantSlugReservationsTable.tenantId} = ${tenantId}
  `);
}

/**
 * Owner-approved, additive production-data bootstrap, after Publish migrates
 * schema, BEFORE serving requests. Idempotent; never replaces any reservation.
 * Existing alias rows survive and retain original ownership even if deleted.
 */
export async function initializeSlugReservations(): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(530750783)`);
    await tx.execute(sql`
      INSERT INTO tenant_slug_reservations (slug, tenant_id)
      SELECT slug, id FROM tenants
      UNION
      SELECT slug, tenant_id FROM tenant_aliases
      ON CONFLICT (slug) DO NOTHING
    `);
    const conflicts = await tx.execute(sql`
      SELECT source.slug, source.tenant_id, reserved.tenant_id AS owner
      FROM (
        SELECT slug, id AS tenant_id FROM tenants
        UNION
        SELECT slug, tenant_id FROM tenant_aliases
      ) AS source
      JOIN tenant_slug_reservations AS reserved USING (slug)
      WHERE reserved.tenant_id <> source.tenant_id LIMIT 1
    `);
    if (conflicts.rows.length) {
      throw new Error("Kolizija naslovov nastanitev in zgodovinskih rezervacij: zagon ustavljen.");
    }
  });
}