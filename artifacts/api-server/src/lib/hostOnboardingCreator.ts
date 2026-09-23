import { createHash } from "node:crypto";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import {
  categoriesTable,
  creatorCanonicalPlacesTable,
  creatorPlaceProposalsTable,
  db,
  itemDistanceProposalsTable,
  itemsTable,
  sectionsTable,
  tenantsTable,
} from "@workspace/db";
import { MELI_PU_SKELETON } from "./tenantSeeds";
import { computeRoadRoute } from "./distanceEngine";
import { adminPlaceDuplicateRows, fetchAdminPlaceNominatim, findAdminPlaceDuplicate } from "./adminPlaceCreation";
import { lockCreatorPlaceIdentity } from "./creatorProposalLedger";

export const HOST_ONBOARDING_PROVENANCE = "vnesel gostitelj prek obrazca";
export const HOST_ONBOARDING_UNRESOLVED_REASON = "host-name-awaiting-resolution";

export type HostOnboardingCategory = {
  key: string;
  label: string;
};

export type HostRecommendation = {
  categoryKey: string;
  categoryId?: string;
  name: string;
};

export type HostDraftResult = HostRecommendation & {
  proposalId: null;
  itemId: string;
  materializationStatus: "created" | "created_without_coordinates" | "matched_existing";
  existingArchived?: boolean;
  provenance: typeof HOST_ONBOARDING_PROVENANCE;
};

/**
 * Form names are hints, not verified places. Only one exact OSM name at a
 * routable location is sufficiently confident; otherwise create an editable
 * ordinary item with no fabricated pin. Never route a Creator queue row.
 */
export async function materializeHostRecommendations(
  tx: CreatorTransaction,
  input: { tenantId: string; recommendations: HostRecommendation[] },
  dependencies: {
    search?: typeof fetchAdminPlaceNominatim;
    route?: typeof computeRoadRoute;
  } = {},
): Promise<HostDraftResult[]> {
  const allowed = new Set(getHostOnboardingCategories().map(row => row.key));
  const categories = await tx.select({
    id: categoriesTable.id, key: categoriesTable.key,
  }).from(categoriesTable)
    .innerJoin(sectionsTable, eq(sectionsTable.id, categoriesTable.sectionId))
    .where(and(eq(sectionsTable.tenantId, input.tenantId),
      isNull(categoriesTable.deletedAt)));
  const [origin] = await tx.select({
    latitude: tenantsTable.latitude, longitude: tenantsTable.longitude,
  }).from(tenantsTable).where(eq(tenantsTable.id, input.tenantId)).limit(1);
  const results: HostDraftResult[] = [];
  for (const hint of input.recommendations) {
    const name = hint.name.trim();
    const normalized = normalizeHostRecommendationName(name);
    const category = hint.categoryId
      ? categories.find(row => row.id === hint.categoryId)
      : categories.find(row => row.key === hint.categoryKey);
    if (!name || !normalized || !category || (!hint.categoryId && !allowed.has(hint.categoryKey))) {
      throw new Error("Kategorija ali ime priporočila gostitelja ni veljavno.");
    }
    let candidates: Awaited<ReturnType<typeof fetchAdminPlaceNominatim>> = [];
    try {
      candidates = await (dependencies.search ?? fetchAdminPlaceNominatim)("/search", {
        q: name, limit: "8", namedetails: "1",
      });
    } catch {
      // An unavailable geocoder must not discard the host's submitted name.
    }
    const exact = candidates.filter(row =>
      typeof row.name === "string" &&
      normalizeHostRecommendationName(row.name) === normalized &&
      ["node", "way", "relation"].includes(String(row.osm_type)) &&
      Number.isSafeInteger(Number(row.osm_id)) &&
      Number.isFinite(Number(row.lat)) && Number.isFinite(Number(row.lon)));
    const unique = exact.length === 1 ? exact[0]! : null;
    const entityKey = unique
      ? `osm:${unique.osm_type}:${unique.osm_id}` : `host-name:${normalized}`;
    // All canonical writers acquire entity THEN name. Geocoding must precede
    // the lock, or operator creation (entity -> name) can deadlock a host
    // submission that took name first and then waited for the OSM entity.
    await lockCreatorPlaceIdentity(tx, input.tenantId, entityKey, normalized);
    const latitude = unique ? Number(unique.lat) : null;
    const longitude = unique ? Number(unique.lon) : null;
    const place = {
      name, osmType: unique ? String(unique.osm_type) : null,
      osmId: unique ? Number(unique.osm_id) : null, latitude, longitude,
    };
    const rows = await adminPlaceDuplicateRows(input.tenantId, tx as typeof db);
    // Pending Creator evidence is dormant, not a canonical identity. Exclude
    // it so an archived canonical item cannot be masked by a pending hint.
    const identityMatch = unique
      ? findAdminPlaceDuplicate(place, rows.filter(row => row.match.kind !== "pending"))
      : null;
    const byName = rows.filter(row => row.match.kind === "item" &&
      row.match.categoryId === category.id &&
      normalizeHostRecommendationName(row.name) === normalized);
    // A verified different identity must NEVER fall through to a name-only
    // match (including an old row without coordinates). Without a confident
    // geocode, only one live same-category name can replay an unlocated hint.
    const existing = identityMatch?.kind === "item" ||
      identityMatch?.kind === "archived"
      ? identityMatch : !unique && byName.length === 1 ? byName[0]!.match : null;
    if (existing) {
      const archived = existing.kind === "archived";
      const itemId = archived
        ? rows.find(row => row.match === existing)?.itemId ?? existing.id
        : existing.id;
      results.push({ ...hint, proposalId: null, itemId,
        materializationStatus: "matched_existing",
        ...(archived ? { existingArchived: true } : {}),
        provenance: HOST_ONBOARDING_PROVENANCE });
      continue;
    }
    let route: Awaited<ReturnType<typeof computeRoadRoute>> = null;
    if (latitude !== null && longitude !== null &&
      origin?.latitude !== null && origin?.longitude !== null &&
      origin?.latitude !== undefined && origin?.longitude !== undefined) {
      try {
        route = await (dependencies.route ?? computeRoadRoute)(
          { latitude: origin.latitude, longitude: origin.longitude }, { latitude, longitude });
      } catch {
        // An unroutable hint remains an editable coordinate-less draft.
      }
    }
    const withCoordinates = Boolean(unique && route && route.durationMinutes <= 90);
    const [item] = await tx.insert(itemsTable).values({
      categoryId: category.id, title: name,
      ...(withCoordinates ? {
        mapQuery: String(unique!.display_name ?? name),
        distanceMeters: Math.round(route!.distanceMeters),
        duration: `${Math.round(route!.durationMinutes)} min`,
      } : {}),
    }).returning({ id: itemsTable.id });
    if (withCoordinates) {
      await tx.insert(creatorCanonicalPlacesTable).values({
        tenantId: input.tenantId, entityKey, itemId: item!.id,
      });
      await tx.insert(itemDistanceProposalsTable).values({
        tenantId: input.tenantId, itemId: item!.id,
        status: "approved", source: HOST_ONBOARDING_PROVENANCE,
        confidence: "high", latitude, longitude,
        distanceMeters: Math.round(route!.distanceMeters),
        durationMinutes: route!.durationMinutes,
        resolvedAddress: String(unique!.display_name ?? name),
        geocodeQuery: name, inputFingerprint: entityKey,
      });
    }
    results.push({ ...hint, proposalId: null, itemId: item!.id,
      materializationStatus: withCoordinates ? "created" : "created_without_coordinates",
      provenance: HOST_ONBOARDING_PROVENANCE });
  }
  if (results.length) {
    await tx.update(tenantsTable).set({ hasUnpublishedChanges: true })
      .where(eq(tenantsTable.id, input.tenantId));
  }
  return results;
}

type CreatorTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

function normalizeHostRecommendationName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("sl")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/**
 * The existing ledger allows one unresolved normalized name in a run. Give
 * every category block its own stable run UUID so a host may intentionally
 * recommend the same venue in multiple categories. The immutable onboarding
 * submission retains the returned proposal IDs as its canonical linkage.
 */
function hostCategoryRunId(submissionId: string, categoryKey: string): string {
  const bytes = createHash("sha256")
    .update("smart360-host-onboarding-category\0")
    .update(submissionId)
    .update("\0")
    .update(categoryKey)
    .digest()
    .subarray(0, 16);
  // RFC 4122 variant with a name-based (v5) version nibble.
  bytes[6] = (bytes[6]! & 0x0f) | 0x50;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * The form follows the shared guest skeleton rather than maintaining a second
 * frontend category list. Events are intentionally omitted: onboarding keeps
 * their host-provided date and time as event suggestions, never place rows.
 */
export function getHostOnboardingCategories(): HostOnboardingCategory[] {
  return MELI_PU_SKELETON
    .filter((section) => section.key === "explore" || section.key === "services")
    .flatMap((section) => section.categories)
    .filter((category) => category.key !== "events")
    .map((category) => ({ key: category.key, label: category.names.sl }));
}

/**
 * Adds host name-only recommendations to the existing Creator proposal ledger.
 *
 * A deterministic run UUID is derived from submissionId + categoryKey. This
 * preserves distinct category assignments for the same normalized place name,
 * while the onboarding submission durably links to the returned proposal IDs.
 * proposalIds is positionally aligned with recommendations: a same-category
 * duplicate repeats the canonical proposal ID rather than creating another row.
 * No Creator source/fact row is created: a host recommendation is evidence of
 * the hint, not evidence for a municipality website or an invented URL.
 */
export async function enqueueHostRecommendations(
  tx: CreatorTransaction,
  input: {
    tenantId: string;
    submissionId: string;
    recommendations: HostRecommendation[];
  },
): Promise<{ proposalIds: string[] }> {
  const allowedKeys = new Set(getHostOnboardingCategories().map(({ key }) => key));
  const recommendations = input.recommendations.map((recommendation) => ({
    categoryKey: recommendation.categoryKey.trim(),
    categoryId: recommendation.categoryId,
    name: recommendation.name.trim(),
    normalizedName: normalizeHostRecommendationName(recommendation.name),
  }));

  for (const recommendation of recommendations) {
    if (!recommendation.name || !recommendation.normalizedName) {
      throw new Error("Priporočilo gostitelja potrebuje ime.");
    }
    if (!recommendation.categoryId && !allowedKeys.has(recommendation.categoryKey)) {
      throw new Error(`Kategorija priporočila ni dovoljena: ${recommendation.categoryKey || "(prazna)"}.`);
    }
  }
  if (recommendations.length === 0) return { proposalIds: [] };

  await tx.execute(sql`SELECT pg_advisory_xact_lock(
    hashtextextended(${`${input.tenantId}:host-onboarding:${input.submissionId}`}, 0)
  )`);

  const categoryKeys = [...new Set(
    recommendations.filter(({ categoryId }) => !categoryId).map(({ categoryKey }) => categoryKey),
  )];
  const directCategoryIds = [...new Set(
    recommendations.flatMap(({ categoryId }) => categoryId ? [categoryId] : []),
  )];
  const categories = categoryKeys.length === 0
    ? []
    : await tx
      .select({ id: categoriesTable.id, key: categoriesTable.key })
      .from(categoriesTable)
      .innerJoin(sectionsTable, eq(categoriesTable.sectionId, sectionsTable.id))
      .where(and(
        eq(sectionsTable.tenantId, input.tenantId),
        inArray(categoriesTable.key, categoryKeys),
        isNull(categoriesTable.deletedAt),
      ));
  const directCategories = directCategoryIds.length === 0
    ? []
    : await tx
      .select({ id: categoriesTable.id })
      .from(categoriesTable)
      .innerJoin(sectionsTable, eq(categoriesTable.sectionId, sectionsTable.id))
      .where(and(
        eq(sectionsTable.tenantId, input.tenantId),
        inArray(categoriesTable.id, directCategoryIds),
        isNull(categoriesTable.deletedAt),
      ));
  const categoryIdByKey = new Map(categories.map((category) => [category.key, category.id]));
  const missingKeys = categoryKeys.filter((key) => !categoryIdByKey.has(key));
  if (missingKeys.length > 0) {
    throw new Error(`Kategorije priporočil v vodniku ne obstajajo: ${missingKeys.join(", ")}.`);
  }
  const validDirectCategoryIds = new Set(directCategories.map(({ id }) => id));
  const missingIds = directCategoryIds.filter((id) => !validDirectCategoryIds.has(id));
  if (missingIds.length > 0) {
    throw new Error("Kategorija gostitelja ne pripada tej namestitvi.");
  }

  const proposalIds: string[] = [];
  const proposalIdByCategoryName = new Map<string, string>();
  for (const recommendation of recommendations) {
    // Same-category duplicates collapse, while the same name in two category
    // blocks remains two intentional attachments. Repeat the existing ID in
    // the result to preserve positional alignment with the caller's rows.
    const assignedCategoryId =
      recommendation.categoryId ?? categoryIdByKey.get(recommendation.categoryKey)!;
    const categoryName = `${assignedCategoryId}\0${recommendation.normalizedName}`;
    const alreadyEnqueuedId = proposalIdByCategoryName.get(categoryName);
    if (alreadyEnqueuedId) {
      proposalIds.push(alreadyEnqueuedId);
      continue;
    }
    const runId = hostCategoryRunId(input.submissionId, assignedCategoryId);

    // Read before insert so replay remains stable after Nominatim has populated
    // OSM identity and the partial unresolved-name unique index no longer
    // applies to this row.
    const [existing] = await tx
      .select({ id: creatorPlaceProposalsTable.id })
      .from(creatorPlaceProposalsTable)
      .where(and(
        eq(creatorPlaceProposalsTable.tenantId, input.tenantId),
        eq(creatorPlaceProposalsTable.runId, runId),
        eq(creatorPlaceProposalsTable.normalizedName, recommendation.normalizedName),
      ))
      .limit(1);
    if (existing) {
      proposalIdByCategoryName.set(categoryName, existing.id);
      proposalIds.push(existing.id);
      continue;
    }

    const [inserted] = await tx
      .insert(creatorPlaceProposalsTable)
      .values({
        tenantId: input.tenantId,
        runId,
        categoryId: assignedCategoryId,
        proposedName: recommendation.name,
        normalizedName: recommendation.normalizedName,
        originalQuery: recommendation.name,
        geocodingLookupHint: recommendation.name,
        inclusionReason: HOST_ONBOARDING_PROVENANCE,
        contentReady: false,
        status: "unresolved",
        refusalReason: HOST_ONBOARDING_UNRESOLVED_REASON,
      })
      .onConflictDoNothing()
      .returning({ id: creatorPlaceProposalsTable.id });

    if (inserted) {
      proposalIdByCategoryName.set(categoryName, inserted.id);
      proposalIds.push(inserted.id);
      continue;
    }
    const [racedExisting] = await tx
      .select({ id: creatorPlaceProposalsTable.id })
      .from(creatorPlaceProposalsTable)
      .where(and(
        eq(creatorPlaceProposalsTable.tenantId, input.tenantId),
        eq(creatorPlaceProposalsTable.runId, runId),
        eq(creatorPlaceProposalsTable.normalizedName, recommendation.normalizedName),
      ))
      .limit(1);
    if (!racedExisting) {
      throw new Error("Predloga gostitelja po ponovitvi ni bilo mogoče prebrati.");
    }
    proposalIdByCategoryName.set(categoryName, racedExisting.id);
    proposalIds.push(racedExisting.id);
  }

  return { proposalIds };
}