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

export type ProposalRekeyRule = {
  id: string;
  expectedName: string;
  sourceKey: "food" | "health";
  targetKey: "culinary" | "pharm" | "hosp";
};

const MENINA_ID = "e0303a50-aeba-4ff2-a919-1e2558df55f3";
const MENINA_PROPOSAL_RULES: readonly ProposalRekeyRule[] = [
  { id: "5892165a-12d9-4630-a813-746a72840038", expectedName: "Gostilna Pri Kumru", sourceKey: "food", targetKey: "culinary" },
  { id: "0de9aa96-eb7b-4a77-86a5-679d8d813ea9", expectedName: "Gostilna Čater", sourceKey: "food", targetKey: "culinary" },
  { id: "c6264904-a96f-4be6-89d9-004a5b0dadef", expectedName: "Hiša Raduha", sourceKey: "food", targetKey: "culinary" },
  { id: "ec4b801e-bc2a-4aa0-8445-f4e029fa650a", expectedName: "Lekarna Mozirje", sourceKey: "health", targetKey: "pharm" },
  { id: "8966a4b2-7f70-4032-abc6-a3707e7476db", expectedName: "Zdravstveni dom Mozirje", sourceKey: "health", targetKey: "hosp" },
] as const;

type AlignmentOptions = {
  /**
   * Test-only remapped IDs. The HTTP route never accepts rules from callers;
   * production always uses the owner-approved stable-ID ledger above.
   */
  fixtureProposalRules?: readonly ProposalRekeyRule[];
};

const countChanged = (result: { rowCount?: number | null }): number => result.rowCount ?? 0;

/**
 * Idempotent operator action. It is deliberately not called from startup.
 * The legacy sights split is excluded until its item/proposal ledger is approved.
 */
export async function alignTenantSkeleton(
  tenantId: string,
  options: AlignmentOptions = {},
): Promise<TenantSkeletonAlignmentResult | null> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${`align-skeleton:${tenantId}`}, 0))`);
    const [tenant] = await tx.select({
      id: tenantsTable.id,
      slug: tenantsTable.slug,
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
    }).from(categoriesTable)
      .where(and(inArray(categoriesTable.sectionId, sectionRows.map((row) => row.id)), isNull(categoriesTable.deletedAt)));
    const sectionById = new Map(sectionRows.map((section) => [section.id, section.key]));
    const canonicalSection = new Map(plan.flatMap((section) =>
      section.categories.map((category) => [category.key, section.key] as const)));
    const byKey = new Map<string, typeof categories[number]>();
    for (const key of [...canonicalSection.keys(), "food", "sights", "health", "transport"]) {
      const expectedSection = canonicalSection.get(key) ??
        (key === "food" || key === "sights" ? "explore" : "services");
      const matches = categories.filter((category) =>
        category.key === key && sectionById.get(category.sectionId) === expectedSection);
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

    const rules = options.fixtureProposalRules ??
      (tenant.id === MENINA_ID && tenant.slug === "camping-menina" ? MENINA_PROPOSAL_RULES : []);
    for (const rule of rules) {
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
          if (proposal.categoryId === target.id) return;
          const source = byKey.get(rule.sourceKey);
          if (!source) {
            skipped.push({ key: `proposal:${rule.id}`, reason: `Manjka odobrena izvorna kategorija za ${rule.expectedName}.` });
            return;
          }
          const [linked] = await savepoint.select({ id: creatorPlaceMaterializationsTable.id })
            .from(creatorPlaceMaterializationsTable)
            .where(eq(creatorPlaceMaterializationsTable.proposalId, rule.id)).limit(1);
          const [attached] = await savepoint.select({ id: itemCategoryAttachmentsTable.id })
            .from(itemCategoryAttachmentsTable)
            .where(eq(itemCategoryAttachmentsTable.sourceProposalId, rule.id)).limit(1);
          const fullProposal = await savepoint.select({ status: creatorPlaceProposalsTable.status })
            .from(creatorPlaceProposalsTable).where(eq(creatorPlaceProposalsTable.id, rule.id)).limit(1);
          if (linked || attached || fullProposal[0]?.status !== "unresolved") {
            skipped.push({ key: `proposal:${rule.id}`, reason: `Predlog ${rule.expectedName} ni več nespremenjen nerazrešen predlog; ostal je nedotaknjen.` });
            return;
          }
          if (proposal.categoryId !== source.id || proposal.proposedName !== rule.expectedName) {
            skipped.push({ key: `proposal:${rule.id}`, reason: `Predlog ${rule.expectedName} se ne ujema z odobrenim izvornim stanjem.` });
            return;
          }
          const moved = await savepoint.update(creatorPlaceProposalsTable)
            // Drizzle's schema-level $onUpdate would otherwise rewrite
            // updated_at. This maintenance migration is intentionally a
            // category-only re-key so queue ordering/audit timestamps remain
            // byte-for-byte stable.
            .set({ categoryId: target.id, updatedAt: proposal.updatedAt })
            .where(and(
              eq(creatorPlaceProposalsTable.id, rule.id),
              eq(creatorPlaceProposalsTable.tenantId, tenantId),
              eq(creatorPlaceProposalsTable.categoryId, source.id),
              eq(creatorPlaceProposalsTable.proposedName, rule.expectedName),
              eq(creatorPlaceProposalsTable.status, "unresolved"),
            )).returning({ id: creatorPlaceProposalsTable.id });
          counts.proposalsRekeyed += moved.length;
        });
      } catch {
        skipped.push({
          key: `proposal:${rule.id}`,
          reason: `Predloga ${rule.expectedName} zaradi izolirane napake ni bilo mogoče prerazvrstiti.`,
        });
      }
    }

    for (const key of ["food", "health", "transport"] as const) {
      const category = byKey.get(key);
      if (!category) continue;
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

    if (byKey.has("sights")) {
      skipped.push({
        key: "sights",
        reason: "Razdelitev Znamenitosti še ni odobrena; vsi vnosi in predlogi ostajajo nespremenjeni.",
      });
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