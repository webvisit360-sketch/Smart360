import {
  categoriesTable,
  changelogTable,
  creatorPlaceMaterializationsTable,
  creatorPlaceProposalsTable,
  db,
  itemCategoryAttachmentsTable,
  itemsTable,
  sectionsTable,
  tenantsTable,
  translationsTable,
} from "@workspace/db";
import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import { tenantSeedPlan, type TenantType } from "./tenantSeeds";
import {
  GRIL_SIGHTS_SPLIT,
  type ItemCategoryRekeyRule,
  type ProposalCategoryRekeyRule,
  type SightsSplitRules,
} from "./grilSightsSplitManifest";

export type TenantSkeletonAlignmentResult = {
  summary: string;
  counts: {
    sectionsUpdated: number;
    categoriesUpdated: number;
    translationsUpdated: number;
    categoriesRetired: number;
    proposalsRekeyed: number;
    itemMoves: number;
  };
  titleChanges: Array<{ key: string; oldTitle: string; newTitle: string }>;
  categoryMerges: Array<{
    sectionKey: string;
    key: string;
    keptCategoryId: string;
    removedCategoryId: string;
    summary: string;
  }>;
  stayTitleNormalization: {
    status: "changed" | "no_changes" | "skipped";
    summary: string;
    titleChanged: boolean;
    translationsUpdated: number;
  };
  skipped: Array<{ key: string; reason: string }>;
  changed: boolean;
};

/** @deprecated Prefer ProposalCategoryRekeyRule for new fixture code. */
export type ProposalRekeyRule = ProposalCategoryRekeyRule;
export type { ItemCategoryRekeyRule, ProposalCategoryRekeyRule, SightsSplitRules };

const MENINA_ID = "e0303a50-aeba-4ff2-a919-1e2558df55f3";
const GRIL_ID = "177e633a-6030-4eca-8ce8-e0a0afdff599";
const MENINA_PROPOSAL_RULES: readonly ProposalRekeyRule[] = [
  { id: "5892165a-12d9-4630-a813-746a72840038", expectedName: "Gostilna Pri Kumru", sourceKey: "food", targetKey: "culinary" },
  { id: "0de9aa96-eb7b-4a77-86a5-679d8d813ea9", expectedName: "Gostilna Čater", sourceKey: "food", targetKey: "culinary" },
  { id: "c6264904-a96f-4be6-89d9-004a5b0dadef", expectedName: "Hiša Raduha", sourceKey: "food", targetKey: "culinary" },
  { id: "ec4b801e-bc2a-4aa0-8445-f4e029fa650a", expectedName: "Lekarna Mozirje", sourceKey: "health", targetKey: "pharm" },
  { id: "8966a4b2-7f70-4032-abc6-a3707e7476db", expectedName: "Zdravstveni dom Mozirje", sourceKey: "health", targetKey: "hosp" },
] as const;

export type TenantSkeletonAlignmentOptions = {
  /**
   * Test-only remapped IDs. The HTTP route never accepts rules from callers;
   * production always uses the owner-approved stable-ID ledger above.
   */
  fixtureProposalRules?: readonly ProposalRekeyRule[];
  /**
   * Test-only stable-ID remapping of the approved Gril ledger. Callers must
   * provide both complete item and proposal ledgers; HTTP callers cannot set it.
   */
  fixtureSightsSplitRules?: SightsSplitRules;
};

import { normalizedCategoryName } from "./categoryIdentity";

const countChanged = (result: { rowCount?: number | null }): number => result.rowCount ?? 0;

/**
 * Idempotent operator action. It is deliberately not called from startup.
 * Includes only stable-ID migrations explicitly approved by the owner.
 */
export async function alignTenantSkeleton(
  tenantId: string,
  options: TenantSkeletonAlignmentOptions = {},
): Promise<TenantSkeletonAlignmentResult | null> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${`align-skeleton:${tenantId}`}, 0))`);
    const [tenant] = await tx.select({
      id: tenantsTable.id,
      slug: tenantsTable.slug,
      name: tenantsTable.name,
      tenantType: tenantsTable.tenantType,
    }).from(tenantsTable).where(eq(tenantsTable.id, tenantId)).for("update");
    if (!tenant) return null;

    const counts = {
      sectionsUpdated: 0,
      categoriesUpdated: 0,
      translationsUpdated: 0,
      categoriesRetired: 0,
      proposalsRekeyed: 0,
      itemMoves: 0,
    };
    const titleChanges: Array<{ key: string; oldTitle: string; newTitle: string }> = [];
    const categoryMerges: TenantSkeletonAlignmentResult["categoryMerges"] = [];
    const skipped: Array<{ key: string; reason: string }> = [];
    const type = (["kamp", "hotel", "apartmaji"] as const).includes(tenant.tenantType as TenantType)
      ? tenant.tenantType as TenantType
      : "apartmaji";
    const fullPlan = tenantSeedPlan(type);
    const categoryCreateAudit = await tx.select({
      detail: changelogTable.detail,
      createdAt: changelogTable.createdAt,
    }).from(changelogTable).where(and(
      eq(changelogTable.tenantId, tenantId),
      eq(changelogTable.entity, "category"),
      eq(changelogTable.action, "create"),
    ));
    const creationEvidence = <T extends { id: string; label: string }>(rows: T[]) => {
      const labelCounts = new Map<string, number>();
      for (const row of rows) labelCounts.set(row.label, (labelCounts.get(row.label) ?? 0) + 1);
      return new Map(rows.flatMap((row) => {
        if (labelCounts.get(row.label) !== 1) return [];
        const matching = categoryCreateAudit
          .filter((audit) => audit.detail === row.label)
          .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime());
        return matching[0] ? [[row.id, matching[0].createdAt] as const] : [];
      }));
    };
    const staySeed = fullPlan.find((section) => section.key === "stay")!;
    const [staySection] = await tx.select().from(sectionsTable)
      .where(and(
        eq(sectionsTable.tenantId, tenantId),
        eq(sectionsTable.key, "stay"),
        eq(sectionsTable.position, 0),
      ))
      .limit(1);
    let stayTitleNormalization: TenantSkeletonAlignmentResult["stayTitleNormalization"];
    if (!staySection) {
      const reason = "Na položaju 0 ni standardnega razdelka stay; razdelek ni bil premaknjen ali spremenjen.";
      skipped.push({ key: "stay", reason });
      stayTitleNormalization = {
        status: "skipped",
        summary: `Naslov razdelka: preskočeno. ${reason}`,
        titleChanged: false,
        translationsUpdated: 0,
      };
    } else {
      const oldTitle = staySection.title;
      if (staySection.title !== staySeed.names.sl) {
        await tx.update(sectionsTable).set({
          title: staySeed.names.sl,
        }).where(and(eq(sectionsTable.id, staySection.id), eq(sectionsTable.tenantId, tenantId)));
        counts.sectionsUpdated += 1;
        titleChanges.push({
          key: "stay",
          oldTitle: staySection.title,
          newTitle: staySeed.names.sl,
        });
      }
      let stayTranslationsUpdated = 0;
      for (const language of ["sl", "en", "de", "it"] as const) {
        const [current] = await tx.select({
          id: translationsTable.id,
          value: translationsTable.value,
          stale: translationsTable.stale,
        }).from(translationsTable).where(and(
          eq(translationsTable.model, "section"),
          eq(translationsTable.recordId, staySection.id),
          eq(translationsTable.field, "title"),
          eq(translationsTable.lang, language),
        )).limit(1);
        // Slovenian is stored on sections.title. Normalize an existing override,
        // but retain the established representation when no override exists.
        if (language === "sl" && !current) continue;
        if (!current || current.value !== staySeed.names[language] || current.stale) {
          await tx.insert(translationsTable).values({
            model: "section",
            recordId: staySection.id,
            field: "title",
            lang: language,
            value: staySeed.names[language],
            stale: false,
          }).onConflictDoUpdate({
            target: [translationsTable.model, translationsTable.recordId, translationsTable.field, translationsTable.lang],
            set: { value: staySeed.names[language], stale: false },
          });
          counts.translationsUpdated += 1;
          stayTranslationsUpdated += 1;
        }
      }
      const titleChanged = oldTitle !== staySeed.names.sl;
      stayTitleNormalization = titleChanged
        ? {
            status: "changed",
            summary: `Naslov razdelka: »${oldTitle}« → »${staySeed.names.sl}«.${stayTranslationsUpdated > 0 ? ` Usklajeni prevodi: ${stayTranslationsUpdated}.` : ""}`,
            titleChanged,
            translationsUpdated: stayTranslationsUpdated,
          }
        : stayTranslationsUpdated > 0
          ? {
              status: "changed",
              summary: `Naslov razdelka: brez preimenovanja; usklajeni prevodi: ${stayTranslationsUpdated}.`,
              titleChanged,
              translationsUpdated: stayTranslationsUpdated,
            }
          : {
              status: "no_changes",
              summary: "Naslov razdelka: Brez sprememb.",
              titleChanged,
              translationsUpdated: 0,
            };
    }

    const plan = fullPlan;
    const originalCategoryNames = new Map((await tx.select({
      id: categoriesTable.id,
      label: categoriesTable.label,
    }).from(categoriesTable).innerJoin(
      sectionsTable,
      and(
        eq(categoriesTable.sectionId, sectionsTable.id),
        eq(sectionsTable.tenantId, tenantId),
      ),
    ).where(isNull(categoriesTable.deletedAt))).map((row) => [row.id, row.label]));
    const sectionRows = await tx.select().from(sectionsTable)
      .where(and(eq(sectionsTable.tenantId, tenantId), inArray(sectionsTable.key, plan.map((section) => section.key))))
      .orderBy(asc(sectionsTable.position));

    for (const sectionSeed of plan) {
      const section = sectionRows.find((row) => row.key === sectionSeed.key);
      if (!section) {
        skipped.push({ key: sectionSeed.key, reason: "Manjka standardni razdelek; samodejno ustvarjanje razdelka ni dovoljeno." });
        continue;
      }
      const existing = await tx.select({
        id: categoriesTable.id,
        sectionId: categoriesTable.sectionId,
        key: categoriesTable.key,
        label: categoriesTable.label,
        icon: categoriesTable.icon,
        layout: categoriesTable.layout,
        exploreGroup: categoriesTable.exploreGroup,
        position: categoriesTable.position,
        isVisible: categoriesTable.isVisible,
        deletedAt: categoriesTable.deletedAt,
      }).from(categoriesTable)
        .where(and(eq(categoriesTable.sectionId, section.id), isNull(categoriesTable.deletedAt)))
        .orderBy(asc(categoriesTable.position));
      for (const [position, seed] of sectionSeed.categories.entries()) {
        const seedName = normalizedCategoryName(seed.names.sl);
        const keyedMatches = existing.filter((row) => row.key === seed.key);
        const namedMatches = existing.filter((row) => normalizedCategoryName(row.label) === seedName);
        const selectionAudit = creationEvidence(namedMatches);
        const hasCompleteSelectionAudit = namedMatches.length > 0 &&
          namedMatches.every((candidate) => selectionAudit.has(candidate.id));
        const deterministicOrder = (left: typeof existing[number], right: typeof existing[number]) =>
          ((keyedMatches.length === 0 && hasCompleteSelectionAudit)
            ? selectionAudit.get(left.id)!.getTime() - selectionAudit.get(right.id)!.getTime()
            : left.position - right.position) || left.id.localeCompare(right.id);
        // Identity is key-first. A normalized Slovene label is only a fallback,
        // so an unkeyed legacy row can be adopted without creating a duplicate.
        let category = (keyedMatches.length > 0
          ? [...keyedMatches].sort(deterministicOrder)[0]
          : [...namedMatches].sort(deterministicOrder)[0]);
        const candidates = category
          ? existing.filter((row) =>
              normalizedCategoryName(row.label) === normalizedCategoryName(category!.label))
          : [];
        const auditedCreation = creationEvidence(candidates);
        const hasCompleteAudit = candidates.length > 0 &&
          candidates.every((candidate) => auditedCreation.has(candidate.id));
        if (!category) {
          // The established action creates missing Okolica/Services skeleton
          // rows. Stay/Offer are included here only to adopt and deduplicate
          // existing legacy names; broadening this fix must not manufacture a
          // new catalogue for older tenants.
          if (sectionSeed.key !== "explore" && sectionSeed.key !== "services") continue;
          const [inserted] = await tx.insert(categoriesTable).values({
            sectionId: section.id,
            key: seed.key,
            label: seed.names.sl,
            icon: seed.icon,
            layout: seed.layout,
            exploreGroup: seed.group,
            position,
          }).returning();
          category = inserted!;
          existing.push(category);
          counts.categoriesUpdated += 1;
        } else {
          // Merge every same-name/key duplicate into the skeleton-keyed row (or
          // the oldest row when none is keyed). Translation key collisions are
          // archived under a deterministic field on the keeper: no value, stale
          // flag, timestamp, or translation row is discarded.
          for (const duplicate of candidates.filter((row) => row.id !== category!.id)) {
            const conflictingAttachments = await tx.execute(sql`
              SELECT 1
              FROM item_category_attachments source
              JOIN item_category_attachments target
                ON target.item_id = source.item_id
               AND target.category_id = ${category.id}
              WHERE source.category_id = ${duplicate.id}
                AND source.source_proposal_id IS NOT NULL
                AND target.source_proposal_id IS NOT NULL
              LIMIT 1
            `);
            if (countChanged(conflictingAttachments) > 0) {
              skipped.push({
                key: `${sectionSeed.key}/${seed.key}/${duplicate.id}`,
                reason: "Podvojena kategorija ima dve različni izvorni povezavi istega vnosa; zaradi ohranitve vseh referenc ni bila spremenjena.",
              });
              continue;
            }
            const movedItems = await tx.update(itemsTable).set({ categoryId: category.id })
              .where(eq(itemsTable.categoryId, duplicate.id))
              .returning({ id: itemsTable.id });
            counts.itemMoves += movedItems.length;
            await tx.update(creatorPlaceProposalsTable).set({
              categoryId: category.id,
              // This structural move must not rewrite queue/audit chronology.
              updatedAt: creatorPlaceProposalsTable.updatedAt,
            })
              .where(eq(creatorPlaceProposalsTable.categoryId, duplicate.id));

            const duplicateAttachments = await tx.select().from(itemCategoryAttachmentsTable)
              .where(eq(itemCategoryAttachmentsTable.categoryId, duplicate.id));
            for (const attachment of duplicateAttachments) {
              const [atTarget] = await tx.select().from(itemCategoryAttachmentsTable).where(and(
                eq(itemCategoryAttachmentsTable.itemId, attachment.itemId),
                eq(itemCategoryAttachmentsTable.categoryId, category.id),
              )).limit(1);
              if (!atTarget) {
                await tx.update(itemCategoryAttachmentsTable).set({ categoryId: category.id })
                  .where(eq(itemCategoryAttachmentsTable.id, attachment.id));
              } else if (attachment.sourceProposalId && !atTarget.sourceProposalId) {
                // The target row has no provenance. Keeping the source row
                // preserves the Creator reference while retaining membership.
                await tx.delete(itemCategoryAttachmentsTable)
                  .where(eq(itemCategoryAttachmentsTable.id, atTarget.id));
                await tx.update(itemCategoryAttachmentsTable).set({ categoryId: category.id })
                  .where(eq(itemCategoryAttachmentsTable.id, attachment.id));
              } else {
                // Equal category membership is redundant; there is no source
                // provenance to lose on this duplicate attachment.
                await tx.delete(itemCategoryAttachmentsTable)
                  .where(eq(itemCategoryAttachmentsTable.id, attachment.id));
              }
            }

            const duplicateTranslations = await tx.select().from(translationsTable).where(and(
              eq(translationsTable.model, "category"),
              eq(translationsTable.recordId, duplicate.id),
            ));
            for (const translation of duplicateTranslations) {
              const [collision] = await tx.select({ id: translationsTable.id }).from(translationsTable).where(and(
                eq(translationsTable.model, "category"),
                eq(translationsTable.recordId, category.id),
                eq(translationsTable.field, translation.field),
                eq(translationsTable.lang, translation.lang),
              )).limit(1);
              const field = collision
                ? `${translation.field}.__merged__.${duplicate.id}`
                : translation.field;
              await tx.update(translationsTable).set({ recordId: category.id, field })
                .where(eq(translationsTable.id, translation.id));
              counts.translationsUpdated += 1;
            }

            const remainingReferences = await tx.execute(sql`
              SELECT
                EXISTS (SELECT 1 FROM items WHERE category_id = ${duplicate.id}) OR
                EXISTS (SELECT 1 FROM creator_place_proposals WHERE category_id = ${duplicate.id}) OR
                EXISTS (SELECT 1 FROM item_category_attachments WHERE category_id = ${duplicate.id})
                AS occupied
            `);
            const occupied = Boolean((remainingReferences.rows[0] as { occupied?: boolean } | undefined)?.occupied);
            if (occupied) {
              skipped.push({
                key: `${sectionSeed.key}/${seed.key}/${duplicate.id}`,
                reason: "Podvojena kategorija ima nasprotujočo povezavo vnosa; ni bila umaknjena.",
              });
              continue;
            }
            await tx.update(categoriesTable).set({ deletedAt: sql`transaction_timestamp()` })
              .where(and(eq(categoriesTable.id, duplicate.id), isNull(categoriesTable.deletedAt)));
            existing.splice(existing.findIndex((row) => row.id === duplicate.id), 1);
            counts.categoriesRetired += 1;
            categoryMerges.push({
              sectionKey: sectionSeed.key,
              key: seed.key,
              keptCategoryId: category.id,
              removedCategoryId: duplicate.id,
              summary: `Združena kategorija »${duplicate.label}« v »${seed.names.sl}«; vsi vnosi in prevodi so ohranjeni.${
                keyedMatches.length === 0 && !hasCompleteAudit
                  ? " Zanesljivega podatka o starosti ni; ohranjena je bila prva po vrstnem redu."
                  : ""
              }`,
            });
          }
          if (sectionSeed.key === "stay" || sectionSeed.key === "offer") {
            if (category.key !== seed.key) {
              await tx.update(categoriesTable).set({ key: seed.key })
                .where(and(eq(categoriesTable.id, category.id), eq(categoriesTable.sectionId, section.id)));
              category.key = seed.key;
              counts.categoriesUpdated += 1;
            }
            // Stay/Offer host labels, icons, layouts, ordering, and translations
            // are outside this alignment's historical metadata scope.
            continue;
          }
          const changed = category.label !== seed.names.sl ||
            category.key !== seed.key ||
            category.icon !== seed.icon ||
            category.layout !== seed.layout ||
            category.exploreGroup !== seed.group ||
            category.position !== position;
          if (changed) {
            await tx.update(categoriesTable).set({
              key: seed.key,
              label: seed.names.sl,
              icon: seed.icon,
              layout: seed.layout,
              exploreGroup: seed.group,
              position,
            }).where(and(eq(categoriesTable.id, category.id), eq(categoriesTable.sectionId, section.id)));
            counts.categoriesUpdated += 1;
          }
        }
        for (const language of ["sl", "en", "de", "it"] as const) {
          let [current] = await tx.select({
            id: translationsTable.id,
            value: translationsTable.value,
            stale: translationsTable.stale,
          }).from(translationsTable).where(and(
            eq(translationsTable.model, "category"),
            eq(translationsTable.recordId, category!.id),
            eq(translationsTable.field, "label"),
            eq(translationsTable.lang, language),
          )).limit(1);
          // Slovenian normally lives in categories.label. Do not manufacture
          // a redundant row, but normalize an existing override.
          if (language === "sl" && !current) continue;
          if (!current || current.value !== seed.names[language] || current.stale) {
            if (current && current.value !== seed.names[language]) {
              await tx.update(translationsTable).set({
                field: `label.__original__.${category!.id}.${language}`,
              }).where(eq(translationsTable.id, current.id));
            }
            await tx.insert(translationsTable).values({
              model: "category",
              recordId: category!.id,
              field: "label",
              lang: language,
              value: seed.names[language],
              stale: false,
            }).onConflictDoUpdate({
              target: [translationsTable.model, translationsTable.recordId, translationsTable.field, translationsTable.lang],
              set: { value: seed.names[language], stale: false },
            });
            counts.translationsUpdated += 1;
          }
        }
      }
    }

    // A second, generic pass covers every section and every category name, not
    // only names present in the shared skeleton. This also catches a renamed
    // skeleton-keyed row that now collides with a custom/legacy row.
    const allTenantSections = await tx.select().from(sectionsTable)
      .where(eq(sectionsTable.tenantId, tenantId));
    const allSectionIds = allTenantSections.map((section) => section.id);
    const allActiveCategories = allSectionIds.length === 0 ? [] : await tx.select().from(categoriesTable)
      .where(and(inArray(categoriesTable.sectionId, allSectionIds), isNull(categoriesTable.deletedAt)))
      .orderBy(asc(categoriesTable.position), asc(categoriesTable.id));
    const seedKeysBySectionKey = new Map(fullPlan.map((section) => [
      section.key,
      new Set(section.categories.map((category) => category.key)),
    ]));
    for (const section of allTenantSections) {
      const rows = allActiveCategories.filter((category) => category.sectionId === section.id);
      const groups = new Map<string, typeof rows>();
      for (const row of rows) {
        // Compare the names that existed at action start. Canonical metadata
        // normalization in Explore/Services must not manufacture a merge that
        // was not authorized by a pre-existing same-name duplicate.
        const name = normalizedCategoryName(originalCategoryNames.get(row.id) ?? row.label);
        groups.set(name, [...(groups.get(name) ?? []), row]);
      }
      for (const [name, duplicates] of groups) {
        if (duplicates.length < 2) continue;
        const skeletonKeys = seedKeysBySectionKey.get(section.key) ?? new Set<string>();
        const keyed = duplicates.filter((category) => category.key && skeletonKeys.has(category.key));
        const auditedCreation = creationEvidence(duplicates);
        const hasCompleteAudit = duplicates.every((category) => auditedCreation.has(category.id));
        const ordered = [...(keyed.length > 0 ? keyed : duplicates)]
          .sort((left, right) =>
            ((keyed.length === 0 && hasCompleteAudit)
              ? auditedCreation.get(left.id)!.getTime() - auditedCreation.get(right.id)!.getTime()
              : left.position - right.position) || left.id.localeCompare(right.id));
        const keeper = ordered[0]!;
        const ageUnknown = keyed.length === 0 && !hasCompleteAudit;
        for (const duplicate of duplicates.filter((category) => category.id !== keeper.id)) {
          const conflictingAttachments = await tx.execute(sql`
            SELECT 1
            FROM item_category_attachments source
            JOIN item_category_attachments target
              ON target.item_id = source.item_id
             AND target.category_id = ${keeper.id}
            WHERE source.category_id = ${duplicate.id}
              AND source.source_proposal_id IS NOT NULL
              AND target.source_proposal_id IS NOT NULL
            LIMIT 1
          `);
          if (countChanged(conflictingAttachments) > 0) {
            skipped.push({
              key: `${section.key}/${name}/${duplicate.id}`,
              reason: "Podvojena kategorija ima dve različni izvorni povezavi istega vnosa; zaradi ohranitve vseh referenc ni bila spremenjena.",
            });
            continue;
          }
          const movedItems = await tx.update(itemsTable).set({ categoryId: keeper.id })
            .where(eq(itemsTable.categoryId, duplicate.id))
            .returning({ id: itemsTable.id });
          counts.itemMoves += movedItems.length;
          await tx.update(creatorPlaceProposalsTable).set({
            categoryId: keeper.id,
            updatedAt: creatorPlaceProposalsTable.updatedAt,
          }).where(eq(creatorPlaceProposalsTable.categoryId, duplicate.id));

          const attachments = await tx.select().from(itemCategoryAttachmentsTable)
            .where(eq(itemCategoryAttachmentsTable.categoryId, duplicate.id));
          for (const attachment of attachments) {
            const [atTarget] = await tx.select().from(itemCategoryAttachmentsTable).where(and(
              eq(itemCategoryAttachmentsTable.itemId, attachment.itemId),
              eq(itemCategoryAttachmentsTable.categoryId, keeper.id),
            )).limit(1);
            if (!atTarget) {
              await tx.update(itemCategoryAttachmentsTable).set({ categoryId: keeper.id })
                .where(eq(itemCategoryAttachmentsTable.id, attachment.id));
            } else if (attachment.sourceProposalId && !atTarget.sourceProposalId) {
              await tx.delete(itemCategoryAttachmentsTable).where(eq(itemCategoryAttachmentsTable.id, atTarget.id));
              await tx.update(itemCategoryAttachmentsTable).set({ categoryId: keeper.id })
                .where(eq(itemCategoryAttachmentsTable.id, attachment.id));
            } else {
              await tx.delete(itemCategoryAttachmentsTable).where(eq(itemCategoryAttachmentsTable.id, attachment.id));
            }
          }

          const translations = await tx.select().from(translationsTable).where(and(
            eq(translationsTable.model, "category"),
            eq(translationsTable.recordId, duplicate.id),
          ));
          for (const translation of translations) {
            const [collision] = await tx.select({ id: translationsTable.id }).from(translationsTable).where(and(
              eq(translationsTable.model, "category"),
              eq(translationsTable.recordId, keeper.id),
              eq(translationsTable.field, translation.field),
              eq(translationsTable.lang, translation.lang),
            )).limit(1);
            await tx.update(translationsTable).set({
              recordId: keeper.id,
              field: collision ? `${translation.field}.__merged__.${duplicate.id}` : translation.field,
            }).where(eq(translationsTable.id, translation.id));
            counts.translationsUpdated += 1;
          }

          const remainingReferences = await tx.execute(sql`
            SELECT
              EXISTS (SELECT 1 FROM items WHERE category_id = ${duplicate.id}) OR
              EXISTS (SELECT 1 FROM creator_place_proposals WHERE category_id = ${duplicate.id}) OR
              EXISTS (SELECT 1 FROM item_category_attachments WHERE category_id = ${duplicate.id})
              AS occupied
          `);
          if (Boolean((remainingReferences.rows[0] as { occupied?: boolean } | undefined)?.occupied)) {
            throw new Error(`Category merge left references on ${duplicate.id}`);
          }
          await tx.update(categoriesTable).set({ deletedAt: sql`transaction_timestamp()` })
            .where(and(eq(categoriesTable.id, duplicate.id), isNull(categoriesTable.deletedAt)));
          counts.categoriesRetired += 1;
          categoryMerges.push({
            sectionKey: section.key,
            key: keeper.key ?? name,
            keptCategoryId: keeper.id,
            removedCategoryId: duplicate.id,
            summary: `Združena kategorija »${duplicate.label}« v »${keeper.label}«; vsi vnosi in prevodi so ohranjeni.${
              ageUnknown
                ? " Zanesljivega podatka o starosti ni; ohranjena je bila prva po vrstnem redu."
                : ""
            }`,
          });
        }
      }
    }

    const categories = await tx.select({
      id: categoriesTable.id,
      key: categoriesTable.key,
      label: categoriesTable.label,
      sectionId: categoriesTable.sectionId,
      deletedAt: categoriesTable.deletedAt,
    }).from(categoriesTable)
      .where(inArray(categoriesTable.sectionId, sectionRows.map((row) => row.id)));
    const sectionById = new Map(sectionRows.map((section) => [section.id, section.key]));
    const canonicalSection = new Map(plan.flatMap((section) =>
      section.categories.map((category) => [category.key, section.key] as const)));
    const byKey = new Map<string, typeof categories[number]>();
    for (const key of [...canonicalSection.keys(), "food", "sights", "health", "transport"]) {
      const legacy = ["food", "sights", "health", "transport"].includes(key);
      const expectedSection = canonicalSection.get(key) ??
        (key === "food" || key === "sights" ? "explore" : "services");
      const matches = categories.filter((category) =>
        category.key === key &&
        sectionById.get(category.sectionId) === expectedSection &&
        (legacy || category.deletedAt === null));
      if (matches.length === 1) {
        byKey.set(key, matches[0]!);
      } else if (matches.length > 1 && ["food", "sights", "health", "transport"].includes(key)) {
        skipped.push({ key, reason: "Obstaja več aktivnih starih kategorij z istim ključem; nobena ni bila samodejno spremenjena." });
      }
    }

    const reservedLegacyPositions = new Map<string, number>([
      ["food", 12],
      ["sights", 13],
      ["health", 6],
      ["transport", 7],
    ]);
    for (const [key, position] of reservedLegacyPositions) {
      const category = byKey.get(key);
      if (!category || categories.filter((row) => row.key === key && row.sectionId === category.sectionId).length !== 1) continue;
      const current = await tx.select({ position: categoriesTable.position }).from(categoriesTable)
        .where(eq(categoriesTable.id, category.id)).limit(1);
      if (current[0]?.position !== position) {
        await tx.update(categoriesTable).set({ position })
          .where(and(eq(categoriesTable.id, category.id), eq(categoriesTable.sectionId, category.sectionId)));
        counts.categoriesUpdated += 1;
      }
    }

    const proposalRules = options.fixtureProposalRules ??
      (tenant.id === MENINA_ID && tenant.slug === "camping-menina" ? MENINA_PROPOSAL_RULES : []);
    const sightsSplit = options.fixtureSightsSplitRules ??
      (tenant.id === GRIL_ID && tenant.slug === "glamping-gril" && tenant.name === "Glamping Gril"
        ? GRIL_SIGHTS_SPLIT
        : null);

    for (const rule of sightsSplit?.itemRules ?? []) {
      const source = byKey.get(rule.sourceKey);
      const target = byKey.get(rule.targetKey);
      if (!source || !target) {
        skipped.push({ key: `item:${rule.id}`, reason: `Manjka izvorna ali ciljna kategorija za ${rule.expectedTitle}.` });
        continue;
      }
      try {
        await tx.transaction(async (savepoint) => {
          const [item] = await savepoint.select({
            id: itemsTable.id,
            categoryId: itemsTable.categoryId,
            title: itemsTable.title,
          }).from(itemsTable).where(eq(itemsTable.id, rule.id)).for("update");
          if (!item) {
            skipped.push({ key: `item:${rule.id}`, reason: `Odobreni vnos ${rule.expectedTitle} ni bil najden.` });
            return;
          }
          if (item.title !== rule.expectedTitle ||
              (item.categoryId !== source.id && item.categoryId !== target.id)) {
            skipped.push({ key: `item:${rule.id}`, reason: `Vnos ${rule.expectedTitle} se ne ujema z odobrenim izvornim stanjem.` });
            return;
          }
          const attachments = await savepoint.select({
            id: itemCategoryAttachmentsTable.id,
            categoryId: itemCategoryAttachmentsTable.categoryId,
          }).from(itemCategoryAttachmentsTable)
            .where(eq(itemCategoryAttachmentsTable.itemId, item.id))
            .for("update");
          const sourceAttachments = attachments.filter((row) => row.categoryId === source.id);
          const targetAttachment = attachments.find((row) => row.categoryId === target.id);
          if (sourceAttachments.length > 0 && targetAttachment) {
            skipped.push({ key: `item:${rule.id}`, reason: `Vnos ${rule.expectedTitle} ima podvojeno izvorno in ciljno povezavo; ostal je nedotaknjen.` });
            return;
          }
          let itemChanged = false;
          if (item.categoryId === source.id) {
            await savepoint.update(itemsTable).set({ categoryId: target.id })
              .where(and(eq(itemsTable.id, item.id), eq(itemsTable.categoryId, source.id)));
            itemChanged = true;
          }
          if (sourceAttachments.length > 0) {
            await savepoint.update(itemCategoryAttachmentsTable).set({ categoryId: target.id })
              .where(inArray(itemCategoryAttachmentsTable.id, sourceAttachments.map((row) => row.id)));
            itemChanged = true;
          }
          if (itemChanged) counts.itemMoves += 1;
        });
      } catch {
        skipped.push({
          key: `item:${rule.id}`,
          reason: `Vnosa ${rule.expectedTitle} zaradi izolirane napake ni bilo mogoče prerazvrstiti.`,
        });
      }
    }

    const allProposalRules = [...proposalRules, ...(sightsSplit?.proposalRules ?? [])];
    for (const rule of allProposalRules) {
      const target = byKey.get(rule.targetKey);
      if (!target) {
        skipped.push({ key: `proposal:${rule.id}`, reason: `Manjka ciljna kategorija za ${rule.expectedName}.` });
        continue;
      }
      // Nested transaction is a PostgreSQL savepoint: one stale proposal does
      // not prevent independent approved proposal moves.
      try {
        await tx.transaction(async (savepoint) => {
          const [proposal] = await savepoint.select({
            id: creatorPlaceProposalsTable.id,
            tenantId: creatorPlaceProposalsTable.tenantId,
            categoryId: creatorPlaceProposalsTable.categoryId,
            proposedName: creatorPlaceProposalsTable.proposedName,
            updatedAt: creatorPlaceProposalsTable.updatedAt,
          }).from(creatorPlaceProposalsTable)
            .where(and(eq(creatorPlaceProposalsTable.id, rule.id), eq(creatorPlaceProposalsTable.tenantId, tenantId)))
            .for("update");
          if (!proposal) {
            skipped.push({ key: `proposal:${rule.id}`, reason: `Odobreni predlog ${rule.expectedName} ni bil najden.` });
            return;
          }
          const source = byKey.get(rule.sourceKey);
          if (!source) {
            skipped.push({ key: `proposal:${rule.id}`, reason: `Manjka odobrena izvorna kategorija za ${rule.expectedName}.` });
            return;
          }
          if (proposal.proposedName !== rule.expectedName ||
              (proposal.categoryId !== source.id && proposal.categoryId !== target.id)) {
            skipped.push({ key: `proposal:${rule.id}`, reason: `Predlog ${rule.expectedName} se ne ujema z odobrenim izvornim stanjem.` });
            return;
          }
          const [attached] = await savepoint.select({
            id: itemCategoryAttachmentsTable.id,
            categoryId: itemCategoryAttachmentsTable.categoryId,
          })
            .from(itemCategoryAttachmentsTable)
            .where(eq(itemCategoryAttachmentsTable.sourceProposalId, rule.id)).limit(1);
          if (attached && attached.categoryId !== source.id && attached.categoryId !== target.id) {
            skipped.push({ key: `proposal:${rule.id}`, reason: `Povezava predloga ${rule.expectedName} ni v odobreni izvorni ali ciljni kategoriji.` });
            return;
          }
          // MENINA rules remain restricted to untouched unresolved proposals.
          if (rule.sourceKey !== "sights") {
            const [linked] = await savepoint.select({ id: creatorPlaceMaterializationsTable.id })
              .from(creatorPlaceMaterializationsTable)
              .where(eq(creatorPlaceMaterializationsTable.proposalId, rule.id)).limit(1);
            const fullProposal = await savepoint.select({ status: creatorPlaceProposalsTable.status })
              .from(creatorPlaceProposalsTable).where(eq(creatorPlaceProposalsTable.id, rule.id)).limit(1);
            if (linked || attached || fullProposal[0]?.status !== "unresolved") {
              skipped.push({ key: `proposal:${rule.id}`, reason: `Predlog ${rule.expectedName} ni več nespremenjen nerazrešen predlog; ostal je nedotaknjen.` });
              return;
            }
          }
          if (attached?.categoryId === source.id) {
            await savepoint.update(itemCategoryAttachmentsTable).set({ categoryId: target.id })
              .where(and(
                eq(itemCategoryAttachmentsTable.id, attached.id),
                eq(itemCategoryAttachmentsTable.categoryId, source.id),
              ));
            if (proposal.categoryId === target.id) counts.itemMoves += 1;
          }
          if (proposal.categoryId === target.id) return;
          const predicates = [
            eq(creatorPlaceProposalsTable.id, rule.id),
            eq(creatorPlaceProposalsTable.tenantId, tenantId),
            eq(creatorPlaceProposalsTable.categoryId, source.id),
            eq(creatorPlaceProposalsTable.proposedName, rule.expectedName),
          ];
          if (rule.sourceKey !== "sights") {
            predicates.push(eq(creatorPlaceProposalsTable.status, "unresolved"));
          }
          const moved = await savepoint.update(creatorPlaceProposalsTable)
            // Drizzle's schema-level $onUpdate would otherwise rewrite
            // updated_at. This maintenance migration is intentionally a
            // category-only re-key so queue ordering/audit timestamps remain
            // byte-for-byte stable.
            .set({ categoryId: target.id, updatedAt: proposal.updatedAt })
            .where(and(...predicates)).returning({ id: creatorPlaceProposalsTable.id });
          counts.proposalsRekeyed += moved.length;
        });
      } catch {
        skipped.push({
          key: `proposal:${rule.id}`,
          reason: `Predloga ${rule.expectedName} zaradi izolirane napake ni bilo mogoče prerazvrstiti.`,
        });
      }
    }

    const retirementKeys: Array<"food" | "health" | "transport" | "sights"> =
      sightsSplit ? ["food", "health", "transport", "sights"] : ["food", "health", "transport"];
    for (const key of retirementKeys) {
      const category = byKey.get(key);
      if (!category || category.deletedAt !== null) continue;
      const retired = await tx.execute(sql`
        UPDATE categories AS c SET deleted_at = transaction_timestamp()
        WHERE c.id = ${category.id} AND c.deleted_at IS NULL
          AND EXISTS (
            SELECT 1 FROM sections s WHERE s.id = c.section_id AND s.tenant_id = ${tenantId}
          )
          AND NOT EXISTS (SELECT 1 FROM items i WHERE i.category_id = c.id)
          AND NOT EXISTS (SELECT 1 FROM creator_place_proposals p WHERE p.category_id = c.id)
          AND NOT EXISTS (SELECT 1 FROM item_category_attachments a WHERE a.category_id = c.id)
          AND NOT EXISTS (
            SELECT 1 FROM creator_place_materializations m
            JOIN items i ON i.id = m.item_id WHERE i.category_id = c.id
          )
        RETURNING c.id
      `);
      if (countChanged(retired) === 1) {
        counts.categoriesRetired += 1;
      } else {
        skipped.push({ key, reason: "Stara kategorija ostaja, ker še vsebuje vnose, predloge ali povezave." });
      }
    }

    const changed = Object.values(counts).some((value) => value > 0);
    if (changed) {
      await tx.update(tenantsTable).set({ hasUnpublishedChanges: true }).where(eq(tenantsTable.id, tenantId));
    }
    const summary = changed
      ? `Uskladitev je končana: ${counts.sectionsUpdated} razdelkov, ${counts.categoriesUpdated} kategorij, ${counts.translationsUpdated} prevodov, ${counts.categoriesRetired} umaknjenih starih kategorij in ${counts.proposalsRekeyed} prerazvrščenih predlogov.`
      : skipped.length > 0
        ? `Ni novih odobrenih sprememb. ${skipped.length} odprtih postavk ostaja za ročno odločitev.`
        : "Brez sprememb.";
    return { summary, counts, titleChanges, categoryMerges, stayTitleNormalization, skipped, changed };
  }, { isolationLevel: "serializable" });
}