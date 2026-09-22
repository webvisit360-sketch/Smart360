import { createHash } from "node:crypto";

export const OKOLICA_LANGUAGES = ["sl", "en", "de", "it"] as const;
export type OkolicaLanguage = (typeof OKOLICA_LANGUAGES)[number];

export type BaselineRow = Record<string, unknown>;
export type OkolicaBaseline = {
  tenants: BaselineRow[];
  sections: BaselineRow[];
  categories: BaselineRow[];
  items: BaselineRow[];
  attachments: BaselineRow[];
  proposals: BaselineRow[];
  translations: BaselineRow[];
  materializations: BaselineRow[];
  customEvidence?: unknown;
};

type CanonicalCategory = {
  key: string;
  section: "explore" | "services";
  group: string;
  icon: string;
  layout: string;
  names: Record<OkolicaLanguage, string>;
};

const canonical = (
  section: CanonicalCategory["section"],
  key: string,
  group: string,
  icon: string,
  layout: string,
  sl: string,
  en: string,
  de: string,
  it: string,
): CanonicalCategory => ({ section, key, group, icon, layout, names: { sl, en, de, it } });

/** Standalone approval target. It intentionally does not import tenant seeding or migration code. */
export const OKOLICA_CANONICAL_CATEGORIES: readonly CanonicalCategory[] = [
  canonical("explore", "breakfast", "food_drink", "coffee", "poi", "Zajtrk", "Breakfast", "Frühstück", "Colazione"),
  canonical("explore", "culinary", "food_drink", "fork", "poi", "Kulinarika", "Where to eat", "Essen gehen", "Dove mangiare"),
  canonical("explore", "night", "food_drink", "cocktail", "poi", "Nočno življenje", "Nightlife", "Nachtleben", "Vita notturna"),
  canonical("explore", "pizza", "food_drink", "pizza", "poi", "Picerije", "Pizzerias", "Pizzerien", "Pizzerie"),
  canonical("explore", "act", "experiences", "star", "poi", "Aktivnosti", "Things to do", "Aktivitäten", "Attività"),
  canonical("explore", "hike", "nature_trails", "hike", "routes", "Pohodništvo", "Hiking", "Wandern", "Escursioni a piedi"),
  canonical("explore", "bike", "nature_trails", "bike", "routes", "Kolesarjenje", "Cycling", "Radfahren", "In bicicletta"),
  canonical("explore", "beach", "nature_trails", "beach", "poi", "Plaže", "Beaches", "Strände", "Spiagge"),
  canonical("explore", "culture", "sights", "culture", "poi", "Kulturna dediščina", "Heritage", "Kulturerbe", "Patrimonio culturale"),
  canonical("explore", "nature", "sights", "nature", "poi", "Naravna dediščina", "Nature", "Naturerbe", "Patrimonio naturale"),
  canonical("explore", "trips", "experiences", "map", "poi", "Izleti", "Day trips", "Ausflüge", "Gite"),
  canonical("explore", "events", "experiences", "party", "events", "Dogodki", "What's on", "Veranstaltungen", "Eventi"),
  canonical("services", "shops", "services", "cart", "poi", "Trgovine", "Shops", "Geschäfte", "Negozi"),
  canonical("services", "bakery", "services", "bread", "poi", "Pekarne", "Bakeries", "Bäckereien", "Panetterie"),
  canonical("services", "gas", "services", "gas", "poi", "Bencinske črpalke", "Petrol stations", "Tankstellen", "Distributori di carburante"),
  canonical("services", "atm", "services", "atm", "poi", "Bankomati", "Cash machines", "Geldautomaten", "Bancomat"),
  canonical("services", "pharm", "services", "pharm", "poi", "Lekarne", "Pharmacies", "Apotheken", "Farmacie"),
  canonical("services", "hosp", "services", "hosp", "poi", "Bolnišnica", "Hospital", "Krankenhaus", "Ospedale"),
] as const;

const get = (row: BaselineRow, camel: string, snake: string = camel): unknown =>
  row[camel] ?? row[snake];
const text = (value: unknown): string =>
  typeof value === "string" ? value : value instanceof Date ? value.toISOString() : "";
const number = (value: unknown): number => typeof value === "number" ? value : -1;

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

/**
 * Frozen approval ledger hash. This target changes only under a separately
 * reviewed approval; it is not a dynamic promise to follow future seed edits.
 */
export const OKOLICA_APPROVAL_TARGET_SHA256 = createHash("sha256")
  .update(canonicalJson(OKOLICA_CANONICAL_CATEGORIES))
  .digest("hex");

const sortedRows = (rows: BaselineRow[]): BaselineRow[] =>
  [...rows].sort((left, right) =>
    text(left.id).localeCompare(text(right.id)) || canonicalJson(left).localeCompare(canonicalJson(right)));

/** Returns only rows owned by the tenant, including indirect item/Creator references. */
export function tenantBaselineSlice(source: OkolicaBaseline, tenantId: string): OkolicaBaseline {
  const sections = source.sections.filter((row) => text(get(row, "tenantId", "tenant_id")) === tenantId);
  const sectionIds = new Set(sections.map((row) => text(row.id)));
  const categories = source.categories.filter((row) =>
    sectionIds.has(text(get(row, "sectionId", "section_id"))));
  const categoryIds = new Set(categories.map((row) => text(row.id)));
  const items = source.items.filter((row) => categoryIds.has(text(get(row, "categoryId", "category_id"))));
  const itemIds = new Set(items.map((row) => text(row.id)));
  const proposals = source.proposals.filter((row) =>
    text(get(row, "tenantId", "tenant_id")) === tenantId ||
    categoryIds.has(text(get(row, "categoryId", "category_id"))));
  const proposalIds = new Set(proposals.map((row) => text(row.id)));
  const attachments = source.attachments.filter((row) =>
    categoryIds.has(text(get(row, "categoryId", "category_id"))) ||
    itemIds.has(text(get(row, "itemId", "item_id"))) ||
    proposalIds.has(text(get(row, "sourceProposalId", "source_proposal_id"))));
  const materializations = source.materializations.filter((row) =>
    text(get(row, "tenantId", "tenant_id")) === tenantId ||
    itemIds.has(text(get(row, "itemId", "item_id"))) ||
    proposalIds.has(text(get(row, "proposalId", "proposal_id"))));
  const translations = source.translations.filter((row) =>
    categoryIds.has(text(get(row, "recordId", "record_id"))) ||
    sectionIds.has(text(get(row, "recordId", "record_id"))));

  return {
    tenants: sortedRows(source.tenants.filter((row) => text(row.id) === tenantId)),
    sections: sortedRows(sections),
    categories: sortedRows(categories),
    items: sortedRows(items),
    attachments: sortedRows(attachments),
    proposals: sortedRows(proposals),
    translations: sortedRows(translations),
    materializations: sortedRows(materializations),
    customEvidence: source.customEvidence ?? null,
  };
}

export function tenantSourceHash(source: OkolicaBaseline, tenantId: string): string {
  return createHash("sha256").update(canonicalJson(tenantBaselineSlice(source, tenantId))).digest("hex");
}

export type CategoryUpdateAction = {
  type: "update-category";
  categoryId: string;
  key: string;
  before: { label: string; exploreGroup: string; position: number; icon: string; layout: string };
  after: { label: string; exploreGroup: string; position: number; icon: string; layout: string };
};

export type TranslationAction = {
  type: "upsert-category-translation";
  categoryId: string;
  key: string;
  language: OkolicaLanguage;
  before: { translationId: string | null; value: string | null; stale: boolean | null };
  after: { value: string; stale: false };
};

export type ArchiveAction = {
  type: "archive-empty-legacy-category";
  categoryId: string;
  key: string;
  before: { deletedAt: null; position: number; isVisible: boolean };
  after: { deletedAt: "TRANSACTION_TIMESTAMP"; position: number; isVisible: boolean };
  guards: {
    itemCountIncludingHiddenDeleted: 0;
    attachmentCount: 0;
    proposalCount: 0;
    materializationCount: 0;
    orphanReferenceCount: 0;
  };
};

export type PublicationMarkerAction = {
  type: "mark-unpublished-changes";
  tenantId: string;
  before: { hasUnpublishedChanges: false; isPublished: boolean; lastPublishedAt: string | null };
  after: { hasUnpublishedChanges: true; isPublished: boolean; lastPublishedAt: string | null };
};

export type AlignmentAction = CategoryUpdateAction | TranslationAction | ArchiveAction | PublicationMarkerAction;
export type AlignmentFinding = {
  status: "BLOCKED" | "MANUAL_REVIEW" | "EXEMPT";
  categoryId: string;
  key: string;
  reason: string;
  itemIds?: string[];
  proposalIds?: string[];
};

export type TenantAlignmentPlan = {
  tenantId: string;
  tenantName: string;
  sourceHash: string;
  canonicalCategoryCount: number;
  canonicalCategoriesPresent: number;
  actions: AlignmentAction[];
  itemMoves: [];
  findings: AlignmentFinding[];
  residualBlockedLegacy: string[];
};

function categoryReferences(source: OkolicaBaseline, categoryId: string) {
  const items = source.items.filter((row) => text(get(row, "categoryId", "category_id")) === categoryId);
  const itemIds = new Set(items.map((row) => text(row.id)));
  const proposals = source.proposals.filter((row) =>
    text(get(row, "categoryId", "category_id")) === categoryId);
  const proposalIds = new Set(proposals.map((row) => text(row.id)));
  const attachments = source.attachments.filter((row) =>
    text(get(row, "categoryId", "category_id")) === categoryId ||
    itemIds.has(text(get(row, "itemId", "item_id"))) ||
    proposalIds.has(text(get(row, "sourceProposalId", "source_proposal_id"))));
  const materializations = source.materializations.filter((row) =>
    itemIds.has(text(get(row, "itemId", "item_id"))) ||
    proposalIds.has(text(get(row, "proposalId", "proposal_id"))));
  const orphans = attachments.filter((row) => {
    const itemId = text(get(row, "itemId", "item_id"));
    const proposalId = text(get(row, "sourceProposalId", "source_proposal_id"));
    return (itemId !== "" && !itemIds.has(itemId)) || (proposalId !== "" && !proposalIds.has(proposalId));
  });
  return { items, proposals, attachments, materializations, orphans };
}

function verifiedHostCustom(source: OkolicaBaseline, categoryId: string): boolean {
  if (!source.customEvidence || typeof source.customEvidence !== "object") return false;
  const evidence = source.customEvidence as Record<string, unknown>;
  const entry = evidence[categoryId];
  return Boolean(entry && typeof entry === "object" &&
    (entry as Record<string, unknown>).verifiedHostCreated === true);
}

export function planTenantAlignment(source: OkolicaBaseline, tenantId: string): TenantAlignmentPlan {
  const slice = tenantBaselineSlice(source, tenantId);
  const tenant = slice.tenants[0];
  if (!tenant) throw new Error(`Tenant ${tenantId} is absent from the supplied baseline`);
  const actions: AlignmentAction[] = [];
  const findings: AlignmentFinding[] = [];
  let canonicalCategoriesPresent = 0;

  for (const sectionKey of ["explore", "services"] as const) {
    const section = slice.sections.find((row) => row.key === sectionKey);
    if (!section) {
      findings.push({
        status: "BLOCKED",
        categoryId: `MISSING_SECTION:${sectionKey}`,
        key: sectionKey,
        reason: `Canonical ${sectionKey} section is missing. This approval ledger does not create sections or categories.`,
      });
      continue;
    }
    const sectionCategories = slice.categories
      .filter((row) => text(get(row, "sectionId", "section_id")) === text(section.id))
      .sort((left, right) => number(left.position) - number(right.position) || text(left.id).localeCompare(text(right.id)));
    const desired = OKOLICA_CANONICAL_CATEGORIES.filter((entry) => entry.section === sectionKey);
    const desiredKeys = new Set(desired.map((entry) => entry.key));
    const canonicalRows = desired.flatMap((entry) => {
      const matches = sectionCategories.filter((row) => row.key === entry.key);
      if (matches.length !== 1) {
        findings.push({
          status: "BLOCKED",
          categoryId: `MISSING_OR_DUPLICATE:${sectionKey}/${entry.key}`,
          key: entry.key,
          reason: `Canonical target requires exactly one ${sectionKey}/${entry.key}; found ${matches.length}. This approval ledger does not create or merge categories.`,
        });
        return [];
      }
      canonicalCategoriesPresent += 1;
      return [{ entry, row: matches[0]! }];
    });
    const extras = sectionCategories.filter((row) => !desiredKeys.has(text(row.key)));

    canonicalRows.forEach(({ entry, row }, desiredPosition) => {
      const before = {
        label: text(row.label),
        exploreGroup: text(get(row, "exploreGroup", "explore_group")),
        position: number(row.position),
        icon: text(row.icon),
        layout: text(row.layout),
      };
      const after = {
        label: entry.names.sl,
        exploreGroup: entry.group,
        position: desiredPosition,
        icon: entry.icon,
        layout: entry.layout,
      };
      if (canonicalJson(before) !== canonicalJson(after)) {
        actions.push({ type: "update-category", categoryId: text(row.id), key: entry.key, before, after });
      }
      for (const language of OKOLICA_LANGUAGES) {
        const current = slice.translations.find((translation) =>
          text(get(translation, "recordId", "record_id")) === text(row.id) &&
          translation.model === "category" && translation.field === "label" &&
          translation.lang === language);
        const beforeTranslation = {
          translationId: current ? text(current.id) : null,
          value: current ? text(current.value) : null,
          stale: current ? Boolean(current.stale) : null,
        };
        // Slovenian normally lives in categories.label. If a legacy sl
        // translation override exists, normalize it so it cannot shadow label.
        if ((language !== "sl" && !current) ||
            (current && (current.value !== entry.names[language] || current.stale !== false))) {
          actions.push({
            type: "upsert-category-translation",
            categoryId: text(row.id),
            key: entry.key,
            language,
            before: beforeTranslation,
            after: { value: entry.names[language], stale: false },
          });
        }
      }
    });

    extras.forEach((row, offset) => {
      const categoryId = text(row.id);
      const key = text(row.key);
      const desiredPosition = desired.length + offset;
      const before = {
        label: text(row.label),
        exploreGroup: text(get(row, "exploreGroup", "explore_group")),
        position: number(row.position),
        icon: text(row.icon),
        layout: text(row.layout),
      };
      if (key.startsWith("host-custom-") && verifiedHostCustom(slice, categoryId)) {
        if (before.position !== desiredPosition) {
          actions.push({ type: "update-category", categoryId, key, before, after: { ...before, position: desiredPosition } });
        }
        findings.push({ status: "EXEMPT", categoryId, key, reason: "Verified host-created custom category; retained after canonical skeleton." });
        return;
      }
      const refs = categoryReferences(slice, categoryId);
      const proposalIds = refs.proposals.map((proposal) => text(proposal.id));
      const itemIds = refs.items.map((item) => text(item.id));
      const legacyArchiveCandidate = ["food", "health", "transport", "sights"].includes(key);
      if (!legacyArchiveCandidate) {
        if (before.position !== desiredPosition) {
          actions.push({ type: "update-category", categoryId, key, before, after: { ...before, position: desiredPosition } });
        }
        findings.push({ status: "BLOCKED", categoryId, key, reason: "Unknown extra category without verified host provenance; conservative preserve." });
        return;
      }
      if (refs.items.length || refs.attachments.length || refs.proposals.length ||
          refs.materializations.length || refs.orphans.length) {
        if (before.position !== desiredPosition) {
          actions.push({ type: "update-category", categoryId, key, before, after: { ...before, position: desiredPosition } });
        }
        findings.push({
          status: "BLOCKED",
          categoryId,
          key,
          reason: `Legacy category retained: ${refs.items.length} items (including hidden/deleted), ${refs.attachments.length} attachments, ${refs.proposals.length} Creator proposals, ${refs.materializations.length} materializations, ${refs.orphans.length} orphan references.`,
          itemIds,
          proposalIds,
        });
        return;
      }
      if (get(row, "deletedAt", "deleted_at") == null) {
        actions.push({
          type: "archive-empty-legacy-category",
          categoryId,
          key,
          before: { deletedAt: null, position: before.position, isVisible: Boolean(get(row, "isVisible", "is_visible")) },
          after: { deletedAt: "TRANSACTION_TIMESTAMP", position: before.position, isVisible: Boolean(get(row, "isVisible", "is_visible")) },
          guards: {
            itemCountIncludingHiddenDeleted: 0,
            attachmentCount: 0,
            proposalCount: 0,
            materializationCount: 0,
            orphanReferenceCount: 0,
          },
        });
      }
    });
  }

  const golte = slice.items.find((row) => text(row.title) === "Golte");
  if (golte) {
    findings.push({
      status: "MANUAL_REVIEW",
      categoryId: text(get(golte, "categoryId", "category_id")),
      key: "hike",
      reason: "Golte is a generic plateau description; retained in hiking and no cycling move is guessed.",
      itemIds: [text(golte.id)],
    });
  }

  const actionRank: Record<AlignmentAction["type"], number> = {
    "update-category": 0,
    "upsert-category-translation": 1,
    "archive-empty-legacy-category": 2,
    "mark-unpublished-changes": 3,
  };
  if (actions.length > 0 && tenant.hasUnpublishedChanges === false) {
    const publication = {
      isPublished: Boolean(tenant.isPublished),
      lastPublishedAt: tenant.lastPublishedAt == null ? null : text(tenant.lastPublishedAt),
    };
    actions.push({
      type: "mark-unpublished-changes",
      tenantId,
      before: { hasUnpublishedChanges: false, ...publication },
      after: { hasUnpublishedChanges: true, ...publication },
    });
  }
  actions.sort((left, right) =>
    ("categoryId" in left ? left.categoryId : "").localeCompare("categoryId" in right ? right.categoryId : "") ||
    actionRank[left.type] - actionRank[right.type] ||
    ("language" in left ? left.language : "").localeCompare("language" in right ? right.language : ""));
  findings.sort((left, right) => left.categoryId.localeCompare(right.categoryId) || left.status.localeCompare(right.status));

  return {
    tenantId,
    tenantName: text(tenant.name),
    sourceHash: tenantSourceHash(source, tenantId),
    canonicalCategoryCount: OKOLICA_CANONICAL_CATEGORIES.length,
    canonicalCategoriesPresent,
    actions,
    itemMoves: [],
    findings,
    residualBlockedLegacy: findings.filter((finding) => finding.status === "BLOCKED").map((finding) => finding.categoryId),
  };
}

export type DisposableAlignmentTransaction = {
  lockTenantScope(tenantId: string): Promise<void>;
  loadBaseline(tenantId: string): Promise<OkolicaBaseline>;
  updateCategory(categoryId: string, patch: { label?: string; exploreGroup?: string; position?: number; icon?: string; layout?: string; deletedAt?: "TRANSACTION_TIMESTAMP" }): Promise<void>;
  upsertCategoryTranslation(categoryId: string, language: OkolicaLanguage, value: string): Promise<void>;
  archiveCategoryIfUnreferenced(categoryId: string): Promise<boolean>;
  markTenantHasUnpublishedChanges(
    tenantId: string,
    expected: { hasUnpublishedChanges: false; isPublished: boolean; lastPublishedAt: string | null },
  ): Promise<boolean>;
};

export type DisposableAlignmentExecutor = {
  environment: "disposable-development-fixture";
  transaction<T>(
    callback: (transaction: DisposableAlignmentTransaction) => Promise<T>,
    options: { isolationLevel: "serializable" },
  ): Promise<T>;
};

/**
 * Guarded applier for injected disposable fixtures only. There is deliberately
 * no database import, production adapter, startup hook, server hook, or CLI.
 * Branding alone is not a concurrency guarantee: an injected adapter must
 * implement the requested serializable transaction, tenant lock, and atomic
 * reference-free archive predicate. The repository intentionally supplies only
 * a test adapter, so this must not be described as production-race-proof.
 */
export async function applyTenantAlignmentToDisposableFixture(
  approvedPlan: TenantAlignmentPlan,
  executor: DisposableAlignmentExecutor,
): Promise<{ tenantId: string; appliedActions: number }> {
  if (executor.environment !== "disposable-development-fixture") {
    throw new Error("Okolica alignment may run only against an injected disposable development fixture");
  }
  return executor.transaction(async (transaction) => {
    await transaction.lockTenantScope(approvedPlan.tenantId);
    const current = await transaction.loadBaseline(approvedPlan.tenantId);
    const currentPlan = planTenantAlignment(current, approvedPlan.tenantId);
    if (currentPlan.sourceHash !== approvedPlan.sourceHash) {
      throw new Error(`STALE_BASELINE: expected ${approvedPlan.sourceHash}, got ${currentPlan.sourceHash}`);
    }
    if (canonicalJson(currentPlan.actions) !== canonicalJson(approvedPlan.actions)) {
      throw new Error("MANIFEST_MISMATCH: approved actions do not match deterministic current plan");
    }

    for (const action of approvedPlan.actions) {
      if (action.type === "update-category") {
        await transaction.updateCategory(action.categoryId, {
          label: action.after.label,
          exploreGroup: action.after.exploreGroup,
          position: action.after.position,
          icon: action.after.icon,
          layout: action.after.layout,
        });
      } else if (action.type === "upsert-category-translation") {
        await transaction.upsertCategoryTranslation(action.categoryId, action.language, action.after.value);
      } else if (action.type === "archive-empty-legacy-category") {
        const refs = categoryReferences(current, action.categoryId);
        if (refs.items.length || refs.attachments.length || refs.proposals.length ||
            refs.materializations.length || refs.orphans.length) {
          throw new Error(`ARCHIVE_GUARD_FAILED: ${action.categoryId} gained a reference`);
        }
        if (!await transaction.archiveCategoryIfUnreferenced(action.categoryId)) {
          throw new Error(`ARCHIVE_GUARD_FAILED: ${action.categoryId} changed before guarded write`);
        }
      } else if (!await transaction.markTenantHasUnpublishedChanges(action.tenantId, action.before)) {
        throw new Error(`PUBLICATION_GUARD_FAILED: ${action.tenantId} publication state changed`);
      }
    }
    return { tenantId: approvedPlan.tenantId, appliedActions: approvedPlan.actions.length };
  }, { isolationLevel: "serializable" });
}