import {
  categoriesTable,
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
    categoriesUpdated: number;
    translationsUpdated: number;
    categoriesRetired: number;
    proposalsRekeyed: number;
    itemMoves: number;
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
      categoriesUpdated: 0,
      translationsUpdated: 0,
      categoriesRetired: 0,
      proposalsRekeyed: 0,
      itemMoves: 0,
    };
    const skipped: Array<{ key: string; reason: string }> = [];
    const type = (["kamp", "hotel", "apartmaji"] as const).includes(tenant.tenantType as TenantType)
      ? tenant.tenantType as TenantType
      : "apartmaji";
    const plan = tenantSeedPlan(type).filter((section) => section.key === "explore" || section.key === "services");
    const sectionRows = await tx.select().from(sectionsTable)
      .where(and(eq(sectionsTable.tenantId, tenantId), inArray(sectionsTable.key, ["explore", "services"])))
      .orderBy(asc(sectionsTable.position));

    for (const sectionSeed of plan) {
      const section = sectionRows.find((row) => row.key === sectionSeed.key);
      if (!section) {
        skipped.push({ key: sectionSeed.key, reason: "Manjka standardni razdelek; samodejno ustvarjanje razdelka ni dovoljeno." });
        continue;
      }
      const existing = await tx.select().from(categoriesTable)
        .where(and(eq(categoriesTable.sectionId, section.id), isNull(categoriesTable.deletedAt)))
        .orderBy(asc(categoriesTable.position));
      for (const [position, seed] of sectionSeed.categories.entries()) {
        const matches = existing.filter((row) => row.key === seed.key);
        if (matches.length > 1) {
          skipped.push({ key: `${sectionSeed.key}/${seed.key}`, reason: "Obstaja več aktivnih kategorij z istim standardnim ključem; potrebna je ročna odločitev." });
          continue;
        }
        let category = matches[0];
        if (!category) {
          [category] = await tx.insert(categoriesTable).values({
            sectionId: section.id,
            key: seed.key,
            label: seed.names.sl,
            icon: seed.icon,
            layout: seed.layout,
            exploreGroup: seed.group,
            position,
          }).returning();
          counts.categoriesUpdated += 1;
        } else {
          const changed = category.label !== seed.names.sl ||
            category.icon !== seed.icon ||
            category.layout !== seed.layout ||
            category.exploreGroup !== seed.group ||
            category.position !== position;
          if (changed) {
            await tx.update(categoriesTable).set({
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
          const [current] = await tx.select({
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
      ? `Uskladitev je končana: ${counts.categoriesUpdated} kategorij, ${counts.translationsUpdated} prevodov, ${counts.categoriesRetired} umaknjenih starih kategorij in ${counts.proposalsRekeyed} prerazvrščenih predlogov.`
      : skipped.length > 0
        ? `Ni novih odobrenih sprememb. ${skipped.length} odprtih postavk ostaja za ročno odločitev.`
        : "Ni novih odobrenih sprememb.";
    return { summary, counts, skipped, changed };
  }, { isolationLevel: "serializable" });
}