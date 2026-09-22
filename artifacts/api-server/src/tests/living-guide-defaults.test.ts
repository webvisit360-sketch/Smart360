import assert from "node:assert/strict";
import test from "node:test";
import { asc, eq } from "drizzle-orm";
import {
  categoriesTable,
  creatorPlaceProposalsTable,
  db,
  itemCategoryAttachmentsTable,
  itemsTable,
  sectionsTable,
  tenantsTable,
} from "@workspace/db";
import { copyTenant } from "../routes/adminTenants";
import { MELI_PU_SKELETON } from "../lib/tenantSeeds";
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
    const [legacySection] = await db
      .insert(sectionsTable)
      .values({
        tenantId: legacySource!.id,
        key: "stay",
        title: "Legacy stale title",
        icon: "legacy",
        position: 99,
      })
      .returning();
    const [, wrongSectionBike] = await db.insert(categoriesTable).values([
      {
        sectionId: legacySection!.id,
        key: "welcome",
        label: "Legacy stale label",
        icon: "legacy",
        layout: "text",
        exploreGroup: "legacy",
        position: 88,
      },
      {
        sectionId: legacySection!.id,
        key: "bike",
        label: "Bike in wrong section",
        icon: "bike",
        layout: "routes",
        exploreGroup: "nature_trails",
        position: 89,
      },
    ]).returning();
    const [legacyExplore] = await db
      .insert(sectionsTable)
      .values({
        tenantId: legacySource!.id,
        key: "explore",
        title: "Legacy okolica",
        icon: "legacy",
        position: 100,
      })
      .returning();
    const [legacyFood, unknownExtra] = await db.insert(categoriesTable).values([
      {
        sectionId: legacyExplore!.id,
        key: "food",
        label: "Legacy food",
        icon: "legacy",
        layout: "poi",
        exploreGroup: "food_drink",
        position: 0,
      },
      {
        sectionId: legacyExplore!.id,
        key: "mystery-extra",
        label: "Unknown drift",
        icon: "legacy",
        layout: "poi",
        exploreGroup: "experiences",
        position: 1,
      },
      {
        sectionId: legacyExplore!.id,
        key: "host-custom-rain",
        label: "Host custom category",
        icon: "star",
        layout: "text",
        exploreGroup: "experiences",
        position: 2,
      },
    ]).returning();

    const copied = await copyTenant(legacySource!.id, {
      slug: `lg-copy-${suffix}`,
      name: "Living Guide copy",
      copyContent: false,
    });
    ids.push(copied.id);
    assert.equal(copied.guestUiMode, "living-guide");
    assert.equal(copied.tenantType, "apartmaji");
    const copiedSections = await db
      .select()
      .from(sectionsTable)
      .where(eq(sectionsTable.tenantId, copied.id))
      .orderBy(asc(sectionsTable.position));
    assert.deepEqual(
      copiedSections.slice(0, MELI_PU_SKELETON.length).map(({ key, title, icon, position }) => ({
        key, title, icon, position,
      })),
      MELI_PU_SKELETON.map((section, position) => ({
        key: section.key,
        title: section.names.sl,
        icon: section.icon,
        position,
      })),
    );
    const copiedExplore = copiedSections.find((section) => section.key === "explore")!;
    const copiedExploreCategories = await db
      .select()
      .from(categoriesTable)
      .where(eq(categoriesTable.sectionId, copiedExplore.id))
      .orderBy(asc(categoriesTable.position));
    assert.deepEqual(
      copiedExploreCategories.slice(0, MELI_PU_SKELETON[2]!.categories.length)
        .map(({ key, label, position }) => ({ key, label, position })),
      MELI_PU_SKELETON[2]!.categories.map((category, position) => ({
        key: category.key,
        label: category.names.sl,
        position,
      })),
    );
    assert.equal(copiedExploreCategories.at(-1)?.key, "host-custom-rain");
    assert.equal(copiedExploreCategories.at(-1)?.label, "Host custom category");
    assert.equal(copiedExploreCategories.some((category) => category.key === "food"), false);
    assert.equal(copiedExploreCategories.some((category) => category.key === "mystery-extra"), false);

    const [hiddenDeletedItem] = await db.insert(itemsTable).values({
      categoryId: legacyFood!.id,
      title: "Hidden deleted legacy item",
      isVisible: false,
      deletedAt: new Date(),
    }).returning();
    const blockedSlug = `lg-copy-blocked-${suffix}`;
    await assert.rejects(
      copyTenant(legacySource!.id, {
        slug: blockedSlug,
        name: "Blocked legacy copy",
        copyContent: true,
      }),
      /nestandardna kategorija.*food.*vsebuje vsebino/,
    );
    const [partialCopy] = await db
      .select({ id: tenantsTable.id })
      .from(tenantsTable)
      .where(eq(tenantsTable.slug, blockedSlug));
    assert.equal(partialCopy, undefined, "blocked copy must roll back its new tenant");
    const [sourceItemAfter] = await db
      .select()
      .from(itemsTable)
      .where(eq(itemsTable.id, hiddenDeletedItem!.id));
    assert.equal(sourceItemAfter?.title, "Hidden deleted legacy item");

    await db.delete(itemsTable).where(eq(itemsTable.id, hiddenDeletedItem!.id));
    const [wrongSectionItem] = await db.insert(itemsTable).values({
      categoryId: wrongSectionBike!.id,
      title: "Canonical key in wrong section",
    }).returning();
    const wrongSectionBlockedSlug = `lg-copy-wrong-section-${suffix}`;
    await assert.rejects(
      copyTenant(legacySource!.id, {
        slug: wrongSectionBlockedSlug,
        name: "Blocked wrong-section copy",
        copyContent: true,
      }),
      /nestandardna kategorija.*bike.*vsebuje vsebino/,
    );
    const [wrongSectionPartialCopy] = await db
      .select({ id: tenantsTable.id })
      .from(tenantsTable)
      .where(eq(tenantsTable.slug, wrongSectionBlockedSlug));
    assert.equal(wrongSectionPartialCopy, undefined);
    await db.delete(itemsTable).where(eq(itemsTable.id, wrongSectionItem!.id));

    const [sourceWelcome] = await db
      .select({ id: categoriesTable.id })
      .from(categoriesTable)
      .where(eq(categoriesTable.sectionId, legacySection!.id))
      .limit(1);
    const [attachedItem] = await db.insert(itemsTable).values({
      categoryId: sourceWelcome!.id,
      title: "Attachment-only legacy content",
    }).returning();
    const [attachment] = await db.insert(itemCategoryAttachmentsTable).values({
      itemId: attachedItem!.id,
      categoryId: unknownExtra!.id,
    }).returning();
    const attachmentBlockedSlug = `lg-copy-attachment-blocked-${suffix}`;
    await assert.rejects(
      copyTenant(legacySource!.id, {
        slug: attachmentBlockedSlug,
        name: "Blocked attachment copy",
        copyContent: true,
      }),
      /nestandardna kategorija.*mystery-extra.*vsebuje vsebino/,
    );
    const [attachmentPartialCopy] = await db
      .select({ id: tenantsTable.id })
      .from(tenantsTable)
      .where(eq(tenantsTable.slug, attachmentBlockedSlug));
    assert.equal(attachmentPartialCopy, undefined);
    const [sourceAttachmentAfter] = await db
      .select()
      .from(itemCategoryAttachmentsTable)
      .where(eq(itemCategoryAttachmentsTable.id, attachment!.id));
    assert.equal(sourceAttachmentAfter?.itemId, attachedItem!.id);
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