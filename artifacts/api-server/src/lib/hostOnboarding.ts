import { createHash } from "node:crypto";
import {
  categoriesTable,
  db,
  escapeHostDbContext,
  hostMembershipsTable,
  hostOnboardingPhotosTable,
  hostOnboardingRoundsTable,
  itemsTable,
  sectionsTable,
  tenantsTable,
  type HostOnboardingData,
  type HostOnboardingRecommendationReview,
  type HostOnboardingTargetReview,
} from "@workspace/db";
import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import {
  enqueueHostRecommendations,
  getHostOnboardingCategories,
  HOST_ONBOARDING_PROVENANCE,
} from "./hostOnboardingCreator";
import {
  HOST_ONBOARDING_OPERATOR_EMAIL,
  sendHostOnboardingEmail,
} from "./hostOnboardingEmail";
import { createCategoryWithTooling } from "./categoryTooling";
import {
  applyCanonicalHostOnboardingPatch,
  readCanonicalHostOnboarding,
  readCanonicalHostOnboardingStructure,
  recommendationNeedsCreatorQueue,
  canonicalHostOnboardingRevision,
} from "./hostOnboardingCanonical";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
const CANONICAL_BINDING_MARKER = "workflow.canonical_binding_v1";
const canonicalBindingReview = (): HostOnboardingTargetReview => ({
  target: CANONICAL_BINDING_MARKER,
  hostValue: true,
  operatorValue: true,
  resolution: "unchanged",
  suggestionVisible: false,
});

function legacyMeaningfulPatch(data: HostOnboardingData): Partial<HostOnboardingData> {
  const patch: Partial<HostOnboardingData> = {};
  for (const key of [
    "accommodationName", "address", "guestPhone", "guestEmail", "website",
    "checkInFrom", "checkOutUntil", "wifiName", "wifiPassword",
    "houseRulesParking",
  ] as const) {
    if (data[key]?.trim()) patch[key] = data[key];
  }
  for (const key of ["contacts", "offers", "events"] as const) {
    if (data[key]?.length) patch[key] = data[key] as never;
  }
  return patch;
}

export const EMPTY_HOST_ONBOARDING_DATA: HostOnboardingData = {
  accommodationName: "",
  address: "",
  guestPhone: "",
  guestEmail: "",
  website: "",
  checkInFrom: "",
  checkOutUntil: "",
  contacts: [],
  wifiName: "",
  wifiPassword: "",
  houseRulesParking: "",
  offers: [],
  recommendations: [],
  customCategories: [],
  events: [],
};

export type SaveOnboardingResult =
  | { ok: true; round: typeof hostOnboardingRoundsTable.$inferSelect }
  | { ok: false; kind: "missing" | "submitted" | "stale"; currentRevision?: number };

function clean(value: string): string {
  return value.trim();
}


function hasText(value: string | null | undefined): value is string {
  return !!value?.trim();
}

export function normalizeHostOnboardingData(
  data: HostOnboardingData | (Omit<HostOnboardingData, "customCategories"> & {
    customCategories?: HostOnboardingData["customCategories"];
  }),
): HostOnboardingData {
  return {
    ...data,
    customCategories: Array.isArray(data.customCategories) ? data.customCategories : [],
  };
}

export function hostCustomCategoriesAreSubmittable(data: HostOnboardingData): boolean {
  return data.customCategories.every((category) =>
    category.name.trim() || !category.entries.some((entry) => entry.name.trim())
  );
}

export async function createHostOnboardingDraft(
  tx: Transaction,
  tenantId: string,
  hostUserId: string,
): Promise<typeof hostOnboardingRoundsTable.$inferSelect> {
  const [existing] = await tx
    .select()
    .from(hostOnboardingRoundsTable)
    .where(and(
      eq(hostOnboardingRoundsTable.tenantId, tenantId),
      eq(hostOnboardingRoundsTable.status, "draft"),
    ))
    .limit(1);
  if (existing) return existing;
  const [tenant] = await tx
    .select({ name: tenantsTable.name })
    .from(tenantsTable)
    .where(eq(tenantsTable.id, tenantId))
    .limit(1);
  if (!tenant) throw new Error("Namestitev ne obstaja.");
  const [{ nextRound }] = await tx
    .select({
      nextRound: sql<number>`coalesce(max(${hostOnboardingRoundsTable.round}), 0) + 1`,
    })
    .from(hostOnboardingRoundsTable)
    .where(eq(hostOnboardingRoundsTable.tenantId, tenantId));
  const [created] = await tx
    .insert(hostOnboardingRoundsTable)
    .values({
      tenantId,
      hostUserId,
      round: Number(nextRound),
      draftData: { ...EMPTY_HOST_ONBOARDING_DATA, accommodationName: tenant.name },
      targetReview: [canonicalBindingReview()],
    })
    .returning();
  return created!;
}

export async function initializeWelcomeOnboardingDraft(
  tx: Transaction,
  tenantId: string,
  hostUserId: string,
): Promise<void> {
  await createHostOnboardingDraft(tx, tenantId, hostUserId);
}

export async function onboardingRequired(tenantId: string, hostUserId: string): Promise<boolean> {
  const [draft] = await db
    .select({ id: hostOnboardingRoundsTable.id })
    .from(hostOnboardingRoundsTable)
    .where(and(
      eq(hostOnboardingRoundsTable.tenantId, tenantId),
      eq(hostOnboardingRoundsTable.hostUserId, hostUserId),
      eq(hostOnboardingRoundsTable.status, "draft"),
    ))
    .limit(1);
  return !!draft;
}

export async function currentHostOnboarding(tenantId: string, hostUserId: string) {
  return db.transaction(async (tx) => {
    const [round] = await tx
      .select()
      .from(hostOnboardingRoundsTable)
      .where(and(
        eq(hostOnboardingRoundsTable.tenantId, tenantId),
        eq(hostOnboardingRoundsTable.hostUserId, hostUserId),
      ))
      .orderBy(desc(hostOnboardingRoundsTable.round))
      .limit(1)
      .for("update");
    if (!round) return null;
    let workflow = normalizeHostOnboardingData(round.draftData);
    const canonicalBound = round.targetReview.some((entry) =>
      entry.target === CANONICAL_BINDING_MARKER
    );
    if (!canonicalBound && round.status === "draft") {
      // Lazy compatibility bridge for a pre-binding draft. Its host-entered
      // values are applied once when that same authorized host next opens it;
      // no startup-wide migration or unrelated tenant write is performed.
      await applyCanonicalHostOnboardingPatch(tx, tenantId, legacyMeaningfulPatch(workflow));
      await tx.update(hostOnboardingRoundsTable).set({
        targetReview: [canonicalBindingReview()],
        updatedAt: new Date(),
      }).where(eq(hostOnboardingRoundsTable.id, round.id));
    }
    const photos = await tx
      .select()
      .from(hostOnboardingPhotosTable)
      .where(eq(hostOnboardingPhotosTable.onboardingId, round.id))
      .orderBy(asc(hostOnboardingPhotosTable.createdAt));
    const canonical = await readCanonicalHostOnboarding(tx, tenantId, workflow);
    const contentSections = await readCanonicalHostOnboardingStructure(tx, tenantId);
    const canonicalRevision = await canonicalHostOnboardingRevision(tx, tenantId);
    return {
      round: { ...round, draftData: canonical },
      photos,
      categories: getHostOnboardingCategories(),
      contentSections,
      canonicalRevision,
    };
  });
}

export async function saveHostOnboarding(
  tenantId: string,
  hostUserId: string,
  revision: number,
  patch: Partial<HostOnboardingData>,
  expectedCanonicalRevision?: string,
): Promise<SaveOnboardingResult> {
  return db.transaction(async (tx) => {
    const [round] = await tx
      .select()
      .from(hostOnboardingRoundsTable)
      .where(and(
        eq(hostOnboardingRoundsTable.tenantId, tenantId),
        eq(hostOnboardingRoundsTable.hostUserId, hostUserId),
      ))
      .orderBy(desc(hostOnboardingRoundsTable.round))
      .limit(1)
      .for("update");
    if (!round) return { ok: false, kind: "missing" };
    if (round.status !== "draft") return { ok: false, kind: "submitted" };
    if (round.revision !== revision) {
      return { ok: false, kind: "stale", currentRevision: round.revision };
    }
    const canonicalRevision = await canonicalHostOnboardingRevision(tx, tenantId, true);
    if (expectedCanonicalRevision && expectedCanonicalRevision !== canonicalRevision) {
      return { ok: false, kind: "stale", currentRevision: round.revision };
    }
    await applyCanonicalHostOnboardingPatch(tx, tenantId, patch);
    const workflow = normalizeHostOnboardingData(round.draftData);
    const nextWorkflow = {
      ...workflow,
      ...(patch.recommendations !== undefined
        ? { recommendations: patch.recommendations }
        : {}),
      ...(patch.customCategories !== undefined
        ? { customCategories: patch.customCategories }
        : {}),
    };
    const queued = (
      patch.recommendations !== undefined || patch.customCategories !== undefined
    )
      ? await mapSubmission(tx, tenantId, round.id, nextWorkflow, false)
      : null;
    const [updated] = await tx
      .update(hostOnboardingRoundsTable)
      .set({
        // Workflow-only hints remain here. Canonical tenant content is read
        // fresh on every GET and is never authoritative in this JSON column.
        draftData: nextWorkflow,
        targetReview: [canonicalBindingReview()],
        ...(queued ? { recommendationReview: queued.recommendationReview } : {}),
        revision: round.revision + 1,
        updatedAt: new Date(),
      })
      .where(and(
        eq(hostOnboardingRoundsTable.id, round.id),
        eq(hostOnboardingRoundsTable.revision, revision),
        eq(hostOnboardingRoundsTable.status, "draft"),
      ))
      .returning();
    if (!updated) {
      const [fresh] = await tx
        .select({ revision: hostOnboardingRoundsTable.revision })
        .from(hostOnboardingRoundsTable)
        .where(eq(hostOnboardingRoundsTable.id, round.id));
      return { ok: false, kind: "stale", currentRevision: fresh?.revision };
    }
    return { ok: true, round: updated };
  });
}

async function canonicalCategory(
  tx: Transaction,
  tenantId: string,
  categoryKey: string,
) {
  const [category] = await tx
    .select({ id: categoriesTable.id })
    .from(categoriesTable)
    .innerJoin(sectionsTable, eq(categoriesTable.sectionId, sectionsTable.id))
    .where(and(
      eq(sectionsTable.tenantId, tenantId),
      eq(categoriesTable.key, categoryKey),
      isNull(categoriesTable.deletedAt),
    ))
    .orderBy(asc(categoriesTable.position))
    .limit(1);
  return category ?? null;
}

async function firstSectionCategory(tx: Transaction, tenantId: string, sectionKey: string) {
  const [category] = await tx
    .select({ id: categoriesTable.id })
    .from(categoriesTable)
    .innerJoin(sectionsTable, eq(categoriesTable.sectionId, sectionsTable.id))
    .where(and(
      eq(sectionsTable.tenantId, tenantId),
      eq(sectionsTable.key, sectionKey),
      isNull(categoriesTable.deletedAt),
    ))
    .orderBy(asc(categoriesTable.position))
    .limit(1);
  return category ?? null;
}

function customCategoryKey(onboardingId: string, sourceId: string): string {
  return `host-custom-${createHash("sha256")
    .update("smart360-host-custom-category\0")
    .update(onboardingId)
    .update("\0")
    .update(sourceId)
    .digest("hex")
    .slice(0, 24)}`;
}

async function ensureHostCustomCategory(
  tx: Transaction,
  tenantId: string,
  onboardingId: string,
  sourceId: string,
  label: string,
) {
  const key = customCategoryKey(onboardingId, sourceId);
  const [existing] = await tx
    .select({ category: categoriesTable })
    .from(categoriesTable)
    .innerJoin(sectionsTable, eq(categoriesTable.sectionId, sectionsTable.id))
    .where(and(
      eq(sectionsTable.tenantId, tenantId),
      inArray(sectionsTable.key, ["explore", "services"]),
      eq(categoriesTable.key, key),
      isNull(categoriesTable.deletedAt),
    ))
    .limit(1);
  if (existing) return existing.category;
  const [section] = await tx
    .select({ id: sectionsTable.id })
    .from(sectionsTable)
    .where(and(
      eq(sectionsTable.tenantId, tenantId),
      eq(sectionsTable.key, "explore"),
    ))
    .limit(1);
  if (!section) throw new Error("Razdelek Odkrij okolico za namestitev ne obstaja.");
  return createCategoryWithTooling(tx, section.id, {
    key,
    label,
    icon: "star",
    layout: "poi",
    exploreGroup: "experiences",
  });
}

async function mapSimpleTenantField(
  tx: Transaction,
  tenantId: string,
  target: string,
  hostValue: string,
  operatorValue: string | null,
  field: "name" | "address" | "phone" | "email" | "wifiSsid" | "wifiPass",
  review: HostOnboardingTargetReview[],
): Promise<void> {
  const value = clean(hostValue);
  if (!value) return;
  if (!hasText(operatorValue)) {
    await tx
      .update(tenantsTable)
      .set({ [field]: value })
      .where(eq(tenantsTable.id, tenantId));
    review.push({
      target,
      hostValue: value,
      operatorValue,
      resolution: "filled_blank",
      suggestionVisible: true,
    });
    return;
  }
  review.push({
    target,
    hostValue: value,
    operatorValue,
    resolution: operatorValue.trim() === value ? "unchanged" : "suggestion",
    suggestionVisible: operatorValue.trim() !== value,
  });
}

async function mapCanonicalItem(
  tx: Transaction,
  tenantId: string,
  categoryKey: string,
  title: string,
  body: string,
  target: string,
  review: HostOnboardingTargetReview[],
): Promise<void> {
  if (!clean(body)) return;
  const category = await canonicalCategory(tx, tenantId, categoryKey);
  if (!category) {
    review.push({
      target,
      hostValue: body,
      operatorValue: null,
      resolution: "suggestion",
      suggestionVisible: true,
    });
    return;
  }
  const [existing] = await tx
    .select()
    .from(itemsTable)
    .where(and(eq(itemsTable.categoryId, category.id), isNull(itemsTable.deletedAt)))
    .orderBy(asc(itemsTable.position))
    .limit(1)
    .for("update");
  if (!existing) {
    await tx.insert(itemsTable).values({
      categoryId: category.id,
      title,
      body,
      position: 0,
    });
    review.push({
      target,
      hostValue: body,
      operatorValue: null,
      resolution: "filled_blank",
      suggestionVisible: true,
    });
    return;
  }
  if (!hasText(existing.body)) {
    await tx.update(itemsTable).set({ body }).where(eq(itemsTable.id, existing.id));
    review.push({
      target,
      hostValue: body,
      operatorValue: existing.body,
      resolution: "filled_blank",
      suggestionVisible: true,
    });
    return;
  }
  review.push({
    target,
    hostValue: body,
    operatorValue: existing.body,
    resolution: existing.body.trim() === body.trim() ? "unchanged" : "suggestion",
    suggestionVisible: existing.body.trim() !== body.trim(),
  });
}

async function mapContactItem(
  tx: Transaction,
  tenantId: string,
  websiteRaw: string,
  contacts: HostOnboardingData["contacts"],
  review: HostOnboardingTargetReview[],
): Promise<void> {
  const category = await canonicalCategory(tx, tenantId, "welcome");
  const website = clean(websiteRaw);
  const people = contacts
    .filter((contact) => clean(contact.name) || clean(contact.phone))
    .map((contact) => `${clean(contact.name)}${clean(contact.phone) ? `: ${clean(contact.phone)}` : ""}`)
    .join("\n");
  if (!website && !people) return;
  if (!category) {
    if (website) review.push({
      target: "contact.website",
      hostValue: website,
      operatorValue: null,
      resolution: "suggestion",
      suggestionVisible: true,
    });
    if (people) review.push({
      target: "contact.people",
      hostValue: people,
      operatorValue: null,
      resolution: "suggestion",
      suggestionVisible: true,
    });
    return;
  }
  let [item] = await tx
    .select()
    .from(itemsTable)
    .where(and(
      eq(itemsTable.categoryId, category.id),
      sql`lower(trim(coalesce(${itemsTable.title}, ''))) = 'kontakt'`,
      isNull(itemsTable.deletedAt),
    ))
    .limit(1)
    .for("update");
  if (!item) {
    [item] = await tx
      .insert(itemsTable)
      .values({
        categoryId: category.id,
        title: "Kontakt",
        position: sql<number>`(select coalesce(max(${itemsTable.position}), -1) + 1 from ${itemsTable} where ${itemsTable.categoryId} = ${category.id})`,
      })
      .returning();
  }
  if (!item) throw new Error("Kontaktnega vnosa ni bilo mogoče pripraviti.");
  const updates: { website?: string; body?: string } = {};
  if (website) {
    const operatorValue = item.website;
    const blank = !hasText(operatorValue);
    if (blank) updates.website = website;
    review.push({
      target: "contact.website",
      hostValue: website,
      operatorValue,
      resolution: blank ? "filled_blank" : operatorValue.trim() === website ? "unchanged" : "suggestion",
      suggestionVisible: blank || operatorValue.trim() !== website,
    });
  }
  if (people) {
    const operatorValue = item.body;
    const blank = !hasText(operatorValue);
    if (blank) updates.body = people;
    review.push({
      target: "contact.people",
      hostValue: people,
      operatorValue,
      resolution: blank ? "filled_blank" : operatorValue.trim() === people ? "unchanged" : "suggestion",
      suggestionVisible: blank || operatorValue.trim() !== people,
    });
  }
  if (Object.keys(updates).length > 0) {
    await tx.update(itemsTable).set(updates).where(eq(itemsTable.id, item.id));
  }
}

async function mapSubmission(
  tx: Transaction,
  tenantId: string,
  onboardingId: string,
  data: HostOnboardingData,
  applyCanonical = true,
): Promise<{
  targetReview: HostOnboardingTargetReview[];
  recommendationReview: HostOnboardingRecommendationReview[];
}> {
  const review: HostOnboardingTargetReview[] = [];
  if (applyCanonical) await applyCanonicalHostOnboardingPatch(tx, tenantId, data);

  const canonicalRows = await tx.select({
    id: itemsTable.id,
    title: itemsTable.title,
    categoryKey: categoriesTable.key,
  }).from(itemsTable)
    .innerJoin(categoriesTable, eq(itemsTable.categoryId, categoriesTable.id))
    .innerJoin(sectionsTable, eq(categoriesTable.sectionId, sectionsTable.id))
    .where(and(
      eq(sectionsTable.tenantId, tenantId),
      eq(sectionsTable.key, "explore"),
      isNull(itemsTable.deletedAt),
      isNull(categoriesTable.deletedAt),
    ));
  const canonicalById = new Map(canonicalRows.map((row) => [row.id, row]));
  const canonicalByIdentity = new Set(canonicalRows.map((row) =>
    `${row.categoryKey ?? ""}\0${clean(row.title ?? "").toLocaleLowerCase("sl")}`
  ));
  const incomingIds = data.recommendations.map((row) => row.id)
    .filter((id) => /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(id));
  if (incomingIds.length) {
    const knownIds = new Set((await tx.select({ id: itemsTable.id }).from(itemsTable)
      .where(inArray(itemsTable.id, incomingIds))).map((row) => row.id));
    for (const row of data.recommendations) {
      if (knownIds.has(row.id) && !canonicalById.has(row.id)) {
        throw new Error("Izbrani kraj ne pripada kanonični Okolici te namestitve.");
      }
    }
  }
  const recommendations = data.recommendations
    .filter((row) =>
      recommendationNeedsCreatorQueue(row, canonicalById.get(row.id)) &&
      !canonicalByIdentity.has(
        `${clean(row.categoryId)}\0${clean(row.name).toLocaleLowerCase("sl")}`,
      )
    )
    .map((row) => ({ categoryKey: clean(row.categoryId), name: clean(row.name) }))
    .filter((row) => row.name);
  const creator = await enqueueHostRecommendations(tx, {
    tenantId,
    submissionId: onboardingId,
    recommendations,
  });
  const recommendationReview: HostOnboardingRecommendationReview[] = recommendations.map((row, index) => ({
    ...row,
    proposalId: creator.proposalIds[index] ?? null,
  }));
  for (const customCategory of data.customCategories) {
    const categoryName = clean(customCategory.name);
    if (!categoryName) continue;
    const category = await ensureHostCustomCategory(
      tx,
      tenantId,
      onboardingId,
      customCategory.id,
      categoryName,
    );
    const entries = customCategory.entries
      .map((entry) => ({ ...entry, name: clean(entry.name) }))
      .filter((entry) => entry.name);
    const queued = await enqueueHostRecommendations(tx, {
      tenantId,
      submissionId: onboardingId,
      recommendations: entries.map((entry) => ({
        categoryKey: category.key ?? category.id,
        categoryId: category.id,
        name: entry.name,
      })),
    });
    recommendationReview.push(...entries.map((entry, index) => ({
      categoryKey: category.key ?? category.id,
      categoryId: category.id,
      name: entry.name,
      proposalId: queued.proposalIds[index] ?? null,
      hostCreated: true,
      provenance: HOST_ONBOARDING_PROVENANCE,
      customCategoryId: customCategory.id,
      customEntryId: entry.id,
    })));
    if (entries.length === 0) {
      recommendationReview.push({
        categoryKey: category.key ?? category.id,
        categoryId: category.id,
        name: "",
        proposalId: null,
        hostCreated: true,
        provenance: HOST_ONBOARDING_PROVENANCE,
        customCategoryId: customCategory.id,
      });
    }
  }
  await tx.update(tenantsTable).set({ hasUnpublishedChanges: true }).where(eq(tenantsTable.id, tenantId));
  return { targetReview: review, recommendationReview };
}

export type SubmitResult =
  | { ok: true; id: string; round: number; alreadySubmitted: boolean }
  | {
      ok: false;
      kind: "missing" | "wrong_round" | "stale" | "photo_uploading" | "invalid_custom_category";
      currentRevision?: number;
    };

/**
 * Resolve immutable replay before parsing fields that matter only to a mutable
 * draft. This intentionally addresses the requested round rather than the
 * latest round, so round 1 remains replayable after round 2 is opened.
 */
export async function submittedHostOnboardingReplay(
  tenantId: string,
  hostUserId: string,
  roundNumber: number,
): Promise<{ id: string; round: number } | null> {
  const [round] = await db
    .select({
      id: hostOnboardingRoundsTable.id,
      round: hostOnboardingRoundsTable.round,
    })
    .from(hostOnboardingRoundsTable)
    .where(and(
      eq(hostOnboardingRoundsTable.tenantId, tenantId),
      eq(hostOnboardingRoundsTable.hostUserId, hostUserId),
      eq(hostOnboardingRoundsTable.round, roundNumber),
      eq(hostOnboardingRoundsTable.status, "submitted"),
    ))
    .limit(1);
  return round ?? null;
}

export async function submitHostOnboarding(
  tenantId: string,
  hostUserId: string,
  roundNumber: number,
  revision: number,
  data: HostOnboardingData,
  expectedCanonicalRevision?: string,
): Promise<SubmitResult> {
  const result = await escapeHostDbContext(() => db.transaction(async (tx) => {
    const [round] = await tx
      .select()
      .from(hostOnboardingRoundsTable)
      .where(and(
        eq(hostOnboardingRoundsTable.tenantId, tenantId),
        eq(hostOnboardingRoundsTable.hostUserId, hostUserId),
        eq(hostOnboardingRoundsTable.round, roundNumber),
      ))
      .limit(1)
      .for("update");
    if (!round) return { ok: false, kind: "missing" } as const;
    if (round.status === "submitted") {
      return { ok: true, id: round.id, round: round.round, alreadySubmitted: true } as const;
    }
    if (round.round !== roundNumber) return { ok: false, kind: "wrong_round" } as const;
    if (round.revision !== revision) {
      return {
        ok: false,
        kind: "stale",
        currentRevision: round.revision,
      } as const;
    }
    const canonicalRevision = await canonicalHostOnboardingRevision(tx, tenantId, true);
    if (expectedCanonicalRevision && expectedCanonicalRevision !== canonicalRevision) {
      return {
        ok: false,
        kind: "stale",
        currentRevision: round.revision,
      } as const;
    }
    if (!hostCustomCategoriesAreSubmittable(data)) {
      return { ok: false, kind: "invalid_custom_category" } as const;
    }
    const [uploading] = await tx
      .select({ id: hostOnboardingPhotosTable.id })
      .from(hostOnboardingPhotosTable)
      .where(and(
        eq(hostOnboardingPhotosTable.onboardingId, round.id),
        eq(hostOnboardingPhotosTable.status, "uploading"),
      ))
      .limit(1);
    if (uploading) return { ok: false, kind: "photo_uploading" } as const;
    const mapped = await mapSubmission(tx, tenantId, round.id, data);
    const now = new Date();
    await tx
      .update(hostOnboardingPhotosTable)
      .set({ status: "submitted", submittedAt: now })
      .where(and(
        eq(hostOnboardingPhotosTable.onboardingId, round.id),
        eq(hostOnboardingPhotosTable.status, "ready"),
      ));
    await tx
      .update(hostOnboardingRoundsTable)
      .set({
        draftData: {
          ...normalizeHostOnboardingData(round.draftData),
          recommendations: data.recommendations,
          customCategories: data.customCategories,
        },
        targetReview: [canonicalBindingReview(), ...mapped.targetReview],
        recommendationReview: mapped.recommendationReview,
        status: "submitted",
        revision: round.revision + 1,
        submittedAt: now,
        updatedAt: now,
        notificationStatus: "pending",
        notificationRecipient: HOST_ONBOARDING_OPERATOR_EMAIL,
      })
      .where(eq(hostOnboardingRoundsTable.id, round.id));
    return { ok: true, id: round.id, round: round.round, alreadySubmitted: false } as const;
  }));
  if (result.ok) await dispatchHostOnboardingNotification(result.id);
  return result;
}

export async function dispatchHostOnboardingNotification(onboardingId: string): Promise<void> {
  const claimed = await escapeHostDbContext(() => db.transaction(async (tx) => {
    const [round] = await tx
      .update(hostOnboardingRoundsTable)
      .set({
        notificationStatus: "sending",
        notificationAttemptedAt: new Date(),
        notificationError: null,
      })
      .where(and(
        eq(hostOnboardingRoundsTable.id, onboardingId),
        eq(hostOnboardingRoundsTable.notificationStatus, "pending"),
      ))
      .returning({
        id: hostOnboardingRoundsTable.id,
        tenantId: hostOnboardingRoundsTable.tenantId,
        round: hostOnboardingRoundsTable.round,
      });
    if (!round) return null;
    const [tenant] = await tx
      .select({ name: tenantsTable.name })
      .from(tenantsTable)
      .where(eq(tenantsTable.id, round.tenantId));
    return tenant ? { ...round, propertyName: tenant.name } : null;
  }));
  if (!claimed) return;
  const sent = await sendHostOnboardingEmail(
    claimed.propertyName,
    claimed.tenantId,
    claimed.round,
    claimed.id,
  );
  await escapeHostDbContext(() =>
    db
      .update(hostOnboardingRoundsTable)
      .set(sent.ok
        ? {
            notificationStatus: "sent",
            notificationProviderMessageId: sent.providerMessageId,
            notificationError: null,
          }
        : {
            notificationStatus: "failed",
            notificationProviderMessageId: null,
            notificationError: sent.error,
          })
      .where(and(
        eq(hostOnboardingRoundsTable.id, claimed.id),
        eq(hostOnboardingRoundsTable.notificationStatus, "sending"),
      )),
  );
}

export async function openHostOnboarding(tenantId: string, reopen: boolean) {
  return db.transaction(async (tx) => {
    const [membership] = await tx
      .select({ hostUserId: hostMembershipsTable.hostUserId })
      .from(hostMembershipsTable)
      .where(eq(hostMembershipsTable.tenantId, tenantId))
      .limit(1)
      .for("update");
    if (!membership) return null;
    const [latest] = await tx
      .select()
      .from(hostOnboardingRoundsTable)
      .where(eq(hostOnboardingRoundsTable.tenantId, tenantId))
      .orderBy(desc(hostOnboardingRoundsTable.round))
      .limit(1)
      .for("update");
    if (latest && (!reopen || latest.status === "draft")) return latest;
    return createHostOnboardingDraft(tx, tenantId, membership.hostUserId);
  });
}

export async function ownerHostOnboarding(tenantId: string) {
  return db.transaction(async (tx) => {
    const [tenant] = await tx
      .select({ id: tenantsTable.id, name: tenantsTable.name })
      .from(tenantsTable)
      .where(eq(tenantsTable.id, tenantId));
    if (!tenant) return null;
    const rounds = await tx
      .select()
      .from(hostOnboardingRoundsTable)
      .where(eq(hostOnboardingRoundsTable.tenantId, tenantId))
      .orderBy(desc(hostOnboardingRoundsTable.round));
    const output = [];
    for (const round of rounds) {
      const photos = await tx.select().from(hostOnboardingPhotosTable)
        .where(eq(hostOnboardingPhotosTable.onboardingId, round.id))
        .orderBy(asc(hostOnboardingPhotosTable.createdAt));
      const canonical = await readCanonicalHostOnboarding(
        tx,
        tenantId,
        normalizeHostOnboardingData(round.draftData),
      );
      output.push({
        round: { ...round, draftData: canonical },
        photos,
        events: canonical.events.map((event) => ({
          id: event.id,
          onboardingId: round.id,
          tenantId,
          sourceRowId: event.id,
          name: event.name,
          eventDate: event.date,
          eventTime: event.time,
          status: "reviewed",
          createdAt: round.updatedAt,
        })),
      });
    }
    return { tenant, rounds: output };
  });
}
