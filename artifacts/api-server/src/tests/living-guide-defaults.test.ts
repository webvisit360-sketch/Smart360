import assert from "node:assert/strict";
import test from "node:test";
import { eq } from "drizzle-orm";
import { db, tenantsTable } from "@workspace/db";
import { copyTenant } from "../routes/adminTenants";
import {
  applyGrilLivingGuideCutover,
  runGrilLivingGuideCutoverAtStartup,
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

test("approved Gril cutover is exact, guarded and self-disabling", async () => {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const [tenant] = await db
    .insert(tenantsTable)
    .values({
      slug: `gril-cutover-${suffix}`,
      name: "Cutover test",
      guestUiMode: "legacy",
    })
    .returning();

  try {
    const target = { id: tenant!.id, name: tenant!.name, slug: tenant!.slug };
    await runGrilLivingGuideCutoverAtStartup({
      nodeEnv: "production",
      isDeployment: false,
      target,
    });
    const [stillLegacy] = await db
      .select({ guestUiMode: tenantsTable.guestUiMode })
      .from(tenantsTable)
      .where(eq(tenantsTable.id, tenant!.id));
    assert.equal(stillLegacy!.guestUiMode, "legacy");

    await runGrilLivingGuideCutoverAtStartup({
      nodeEnv: "production",
      isDeployment: true,
      target,
    });
    assert.deepEqual(await applyGrilLivingGuideCutover(target), {
      outcome: "already-applied",
      guestUiMode: "living-guide",
    });
  } finally {
    await db.delete(tenantsTable).where(eq(tenantsTable.id, tenant!.id));
  }
});