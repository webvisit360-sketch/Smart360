import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

/**
 * Once-only bootstrap for drafts that predate operator provenance. The unique
 * changelog operation key is the durable marker already used by cutovers. Both
 * marker and update commit together; subsequent boots must never reclassify
 * host-only edits after an operator has published.
 */
export async function initializeOperatorDraftPending(): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended('smart360:operator-draft-backfill:v1', 0))`);
    const column = await tx.execute(sql`
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'tenants'
        AND column_name = 'operator_draft_pending'
    `);
    if (column.rows.length !== 1) {
      throw new Error("Missing approved public.tenants.operator_draft_pending column; bootstrap marker not written.");
    }
    const marker = await tx.execute(sql`
      INSERT INTO changelog
        (operation_key, action, entity, summary, actor_type, actor_label)
      VALUES
        ('bootstrap:operator-draft-pending:v1', 'maintenance', 'tenant',
         'Začetna označitev neobjavljenih osnutkov za potrditev Smart360.',
         'system', 'Smart360')
      ON CONFLICT (operation_key) DO NOTHING
      RETURNING id
    `);
    if (marker.rows.length === 0) return;
    await tx.execute(sql`
      UPDATE tenants
      SET operator_draft_pending = true
      WHERE has_unpublished_changes = true
        AND operator_draft_pending = false
    `);
  });
}