import assert from "node:assert/strict";
import test from "node:test";
import { eq } from "drizzle-orm";
import { creatorPlaceProposalsTable, db, tenantsTable } from "@workspace/db";
import { copyTenant } from "../routes/adminTenants";
import {
  applyLegacyTenantLivingGuideCutover,
  runLegacyTenantLivingGuideCutoversAtStartup,
} from "../lib/grilLivingGuideCutover";

test("new and copied tenants always use Living Guide", async () => {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const ids: string[] = [];
  try {
    const [created] = await db
      .insert(tenantsTable)
      .values({ slug: `lg-default-${suffix}`, name: "Living Guide default" })
      .returning();
    ids.push(created!.id);
    assert.equal(created!.guestUiMode, "living-guide");

    const [legacySource] = await db
      .insert(tenantsTable)
      .values({
        slug: `lg-legacy-source-${suffix}`,
        name: "Legacy source",
        guestUiMode: "legacy",
      })
      .returning();
    ids.push(legacySource!.id);

    const copied = await copyTenant(legacySource!.id, {
      slug: `lg-copy-${suffix}`,
      name: "Living Guide copy",
      copyContent: false,
    });
    ids.push(copied.id);
    assert.equal(copied.guestUiMode, "living-guide");
  } finally {
    for (const id of ids.reverse()) {
      await db.delete(tenantsTable).where(eq(tenantsTable.id, id));
    }
  }
});


test("approved legacy cutovers are exact, guarded, idempotent and leave Creator proposals untouched", async () => {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const tenants = await db
    .insert(tenantsTable)
    .values([
      {
        slug: `gril-cutover-${suffix}`,
        name: "Piknik prostor in kamp Gril",
        guestUiMode: "legacy",
      },
      {
        slug: `menina-cutover-${suffix}`,
        name: "Camping MENINA",
        guestUiMode: "legacy",
      },
    ])
    .returning();
  const targets = tenants.map((tenant) => ({
    id: tenant.id,
    name: tenant.name,
    slug: tenant.slug,
  }));
  const [proposal] = await db.insert(creatorPlaceProposalsTable).values({
    tenantId: tenants[1]!.id,
    runId: crypto.randomUUID(),
    proposedName: "Creator proposal sentinel",
    normalizedName: `creator-proposal-sentinel-${suffix}`,
    originalQuery: "Creator proposal sentinel",
  }).returning();
  const tenantState = async (tenantId: string) => {
    const [row] = await db
      .select({
        id: tenantsTable.id,
        guestUiMode: tenantsTable.guestUiMode,
        updatedAt: tenantsTable.updatedAt,
        isPublished: tenantsTable.isPublished,
      })
      .from(tenantsTable)
      .where(eq(tenantsTable.id, tenantId));
    return row!;
  };
  const tenantStatesBefore = await Promise.all(tenants.map(({ id }) => tenantState(id)));

  try {
    assert.deepEqual(
      await applyLegacyTenantLivingGuideCutover({
        ...targets[0]!,
        slug: `${targets[0]!.slug}-wrong`,
      }),
      {
        outcome: "skipped",
        guestUiMode: "legacy",
        reason: "target identity or source mode no longer matches the approved cutover",
      },
    );
    await runLegacyTenantLivingGuideCutoversAtStartup({
      nodeEnv: "production",
      isDeployment: false,
      targets,
    });
    const stillLegacy = await db
      .select({ guestUiMode: tenantsTable.guestUiMode })
      .from(tenantsTable)
      .where(eq(tenantsTable.id, tenants[0]!.id));
    assert.equal(stillLegacy[0]!.guestUiMode, "legacy");

    await runLegacyTenantLivingGuideCutoversAtStartup({
      nodeEnv: "production",
      isDeployment: true,
      targets,
    });
    for (const target of targets) {
      assert.deepEqual(await applyLegacyTenantLivingGuideCutover(target), {
        outcome: "already-applied",
        guestUiMode: "living-guide",
      });
    }
    const tenantStatesAfter = await Promise.all(tenants.map(({ id }) => tenantState(id)));
    assert.deepEqual(
      tenantStatesAfter,
      tenantStatesBefore.map((state) => ({ ...state, guestUiMode: "living-guide" })),
    );
    const [proposalAfter] = await db
      .select()
      .from(creatorPlaceProposalsTable)
      .where(eq(creatorPlaceProposalsTable.id, proposal!.id));
    assert.deepEqual(proposalAfter, proposal);
  } finally {
    await db.delete(creatorPlaceProposalsTable).where(eq(creatorPlaceProposalsTable.id, proposal!.id));
    for (const tenant of tenants) {
      await db.delete(tenantsTable).where(eq(tenantsTable.id, tenant.id));
    }
  }
});