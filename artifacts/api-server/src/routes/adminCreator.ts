import { Router, type IRouter } from "express";
import { and, count, desc, eq, isNull, sql } from "drizzle-orm";
import { categoriesTable, creatorPlaceProposalsTable, creatorRunsTable, db, sectionsTable, tenantsTable } from "@workspace/db";
import {
  ApproveCreatorProposalResponse,
  ApproveCreatorProposalsBulkBody,
  ApproveCreatorProposalsBulkResponse,
  ConfirmCreatorTenantOriginBody,
  ConfirmCreatorTenantOriginResponse,
  ConfirmCreatorProposalCoordinatesBody,
  ConfirmCreatorProposalCoordinatesResponse,
  EditCreatorProposalBody,
  EditCreatorProposalResponse,
  GetLatestCreatorRunResponse,
  ListCreatorCategoryOptionsResponse,
  ListCreatorProposalsResponse,
  PreviewCreatorOriginBody,
  PreviewCreatorOriginResponse,
  RejectCreatorProposalResponse,
  StartCreatorRunResponse,
} from "@workspace/api-zod";
import { requireAdmin, getAdminUser } from "../lib/adminAuth";
import {
  approveCreatorProposalIndividually,
  approveCreatorProposalsBulk,
  confirmCreatorProposalCoordinates,
  CreatorBulkApprovalError,
  editCreatorProposalEditorial,
  listCreatorProposalQueue,
  rejectCreatorProposalIndividually,
} from "../lib/creatorProposalLedger";
import {
  GoogleMapsParseError,
  GoogleMapsRedirectError,
  resolveCreatorOrigin,
} from "../lib/creatorOrigin";
import { CREATOR_C1_PRICING, runCreatorC1, type CreatorC1Report } from "../lib/creatorC1";
import { logChange } from "../lib/changelog";
import {
  claimCreatorRunOnce,
  isPreservedMeninaEvidenceTenant,
  MENINA_AUTHORIZED_RUN_COUNT,
} from "../lib/creatorMeninaProductionRun";

const router: IRouter = Router();
router.use("/admin", requireAdmin);
const first = (value: string | string[] | undefined) =>
  (Array.isArray(value) ? value[0] : value) ?? "";
const serialize = <T,>(value: T): T => JSON.parse(JSON.stringify(value));

class CreatorOriginReplacementRequiredError extends Error {
  constructor() {
    super("Creator origin replacement requires explicit confirmation.");
    this.name = "CreatorOriginReplacementRequiredError";
  }
}

class CreatorTenantNotFoundError extends Error {
  constructor() {
    super("Creator tenant not found.");
    this.name = "CreatorTenantNotFoundError";
  }
}

async function requireCreatorTenant(tenantId: string): Promise<boolean> {
  const [tenant] = await db
    .select({ id: tenantsTable.id })
    .from(tenantsTable)
    .where(eq(tenantsTable.id, tenantId))
    .limit(1);
  return Boolean(tenant);
}

function parseRunReport(value: string | null): CreatorC1Report | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as CreatorC1Report;
  } catch {
    return null;
  }
}

export async function creatorRunResponse(row: typeof creatorRunsTable.$inferSelect) {
  const report = parseRunReport(row.reportJson);
  const [{ durableRunCount = 0 } = {}] = await db.select({
    durableRunCount: count(),
  }).from(creatorRunsTable).where(eq(creatorRunsTable.tenantId, row.tenantId));
  return {
    id: row.id,
    tenantId: row.tenantId,
    status: row.status,
    model: "gpt-5.6-terra",
    durableRunCount,
    proposedCount: report?.proposed ?? 0,
    confirmedCount: report?.confirmed ?? 0,
    unresolvedCount: report?.unconfirmed ?? 0,
    outsidePracticalCount: report?.outsidePractical ?? 0,
    outsideNearCount: report?.outsideNear ?? 0,
    outsideExcursionCount: report?.outsideExcursion ?? 0,
    routeFailuresCount: report?.routeFailures ?? 0,
    duplicatesMergedCount: report?.duplicatesMerged ?? 0,
    inputTokens: row.inputTokens,
    outputTokens: row.outputTokens,
    costUsd: row.costUsd ?? 0,
    wallClockMs: report?.wallClockMs ?? null,
    nominatimThrottleMs: row.nominatimThrottleWaitMs,
    // Pre-near-ring runs did not measure this; do not invent historical data.
    nearEnvelopeKm: report?.nearEnvelopeKm ?? null,
    nearEnvelopeEdgeBandCount: report?.nearEnvelopeEdgeBandCount ?? null,
    dependencyAttempts: report?.dependencyAttempts ?? [],
    nearCatalogue: report?.nearCatalogue ?? null,
    surroundingSettlements: report?.surroundingSettlements ?? [],
    surroundingSettlementFeatureCounts: report?.surroundingSettlementFeatureCounts ?? [],
    minimumLocalProposalsPerBatch: report?.minimumLocalProposalsPerBatch ?? null,
    localProposalCount: report?.localProposalCount ?? null,
    quotaTargetedProposalCount: report?.quotaTargetedProposalCount ?? null,
    quotaTargetedUnconfirmedCount: report?.quotaTargetedUnconfirmedCount ?? null,
    nearRingResolvedAfterGlobalSieveFailedCount:
      report?.nearRingResolvedAfterGlobalSieveFailedCount ?? null,
    error: report?.error ?? null,
    startedAt: row.startedAt,
    completedAt: row.completedAt,
    // Historical evidence is returned exactly as persisted. Queue edits,
    // coordinate confirmation, and later review must never rewrite a run.
    outcomes: report?.outcomes ?? [],
    unconfirmedByCategory: report?.unconfirmedByCategory ?? [],
    pricing: report?.pricing ?? CREATOR_C1_PRICING,
  };
}

router.post("/admin/creator/origin-preview", async (req, res): Promise<void> => {
  const input = PreviewCreatorOriginBody.safeParse(req.body);
  if (!input.success) {
    res.status(400).json({ error: "Vnesite Google Maps povezavo." });
    return;
  }

  try {
    const resolved = await resolveCreatorOrigin(input.data.mapUrl);

    res.json(PreviewCreatorOriginResponse.parse({
      ...resolved,
    }));
  } catch (error) {
    if (error instanceof GoogleMapsParseError || error instanceof GoogleMapsRedirectError) {
      res.status(422).json({ error: error.message, code: error.kind });
      return;
    }
    req.log.warn({ error }, "Creator origin preview failed");
    res.status(502).json({ error: "Bližnje znane točke pri Nominatimu ni bilo mogoče preveriti.", code: "nominatim-failed" });
  }
});

router.post("/admin/tenants/:id/creator/origin", async (req, res): Promise<void> => {
  const tenantId = first(req.params["id"]);
  const input = ConfirmCreatorTenantOriginBody.safeParse(req.body);
  if (!tenantId || !input.success) {
    res.status(400).json({ error: "Vnesite naslov in Google Maps povezavo." });
    return;
  }
  const address = input.data.address.replace(/\s+/g, " ").trim();
  if (!address) {
    res.status(400).json({ error: "Naslov ne sme biti prazen." });
    return;
  }

  try {
    // Re-resolve the original URL; browser-provided coordinates and identity
    // are never accepted as authority.
    const origin = await resolveCreatorOrigin(input.data.mapUrl);
    const result = await db.transaction(async (tx) => {
      // The cockpit tenant ID is the only tenant identity. This lock makes the
      // existing-origin guard and the update one atomic replacement decision.
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${tenantId}))`);
      const [current] = await tx
        .select()
        .from(tenantsTable)
        .where(eq(tenantsTable.id, tenantId))
        .limit(1);
      if (!current) throw new CreatorTenantNotFoundError();

      const hasStoredOrigin = Boolean(
        current.mapUrl
        || current.latitude !== null
        || current.longitude !== null
        || current.creatorOriginRegion,
      );
      if (hasStoredOrigin && input.data.replaceExistingOrigin !== true) {
        throw new CreatorOriginReplacementRequiredError();
      }

      const [updated] = await tx
        .update(tenantsTable)
        .set({
          address,
          latitude: origin.lat,
          longitude: origin.lng,
          creatorDraft: true,
          creatorOriginRegion: origin.nominatimDisplayName,
        })
        .where(eq(tenantsTable.id, tenantId))
        .returning();
      if (!updated) throw new CreatorTenantNotFoundError();
      return { tenant: updated, replacedExistingOrigin: hasStoredOrigin };
    });

    await logChange({
      tenantId: result.tenant.id,
      action: result.replacedExistingOrigin ? "replace-origin" : "confirm-origin",
      entity: "creator-origin",
      summary: result.replacedExistingOrigin
        ? "Izhodišče Kreatorja je bilo izrecno zamenjano."
        : "Izhodišče Kreatorja je bilo potrjeno.",
    });

    if (origin.originVerificationStatus === "unverified") {
      req.log.warn({
        tenantId: result.tenant.id,
        latitude: origin.lat,
        longitude: origin.lng,
        originVerificationStatus: origin.originVerificationStatus,
        originVerificationReason: origin.originVerificationReason,
      }, "Creator origin confirmed with an unverified pin position");
    }

    res.json(ConfirmCreatorTenantOriginResponse.parse(serialize({
      id: result.tenant.id,
      address: result.tenant.address,
      latitude: result.tenant.latitude,
      longitude: result.tenant.longitude,
      creatorDraft: result.tenant.creatorDraft,
      creatorOriginRegion: result.tenant.creatorOriginRegion,
      replacedExistingOrigin: result.replacedExistingOrigin,
    })));
  } catch (error) {
    if (error instanceof CreatorOriginReplacementRequiredError) {
      res.status(409).json({ error: "Nastanitev že ima shranjeno izhodišče. Pred zamenjavo jo morate izrecno potrditi." });
      return;
    }
    if (error instanceof CreatorTenantNotFoundError) {
      res.status(404).json({ error: "Nastanitev ni bila najdena." });
      return;
    }
    if (error instanceof GoogleMapsParseError || error instanceof GoogleMapsRedirectError) {
      res.status(422).json({ error: error.message, code: error.kind });
      return;
    }
    req.log.warn({ error, tenantId }, "Creator origin confirmation failed");
    res.status(500).json({ error: "Izhodišča ni bilo mogoče potrditi.", code: "creator-origin-confirmation-failed" });
  }
});

router.post("/admin/tenants/:id/creator/runs", async (req, res): Promise<void> => {
  const tenantId = first(req.params["id"]);
  const [tenant] = await db.select({
    id: tenantsTable.id,
    name: tenantsTable.name,
    latitude: tenantsTable.latitude,
    longitude: tenantsTable.longitude,
    address: tenantsTable.address,
    tenantType: tenantsTable.tenantType,
    creatorDraft: tenantsTable.creatorDraft,
    creatorOriginRegion: tenantsTable.creatorOriginRegion,
    isPublished: tenantsTable.isPublished,
  }).from(tenantsTable).where(eq(tenantsTable.id, tenantId)).limit(1);
  if (!tenant) {
    res.status(404).json({ error: "Namestitev ni najdena." });
    return;
  }
  if (
    tenant.latitude === null ||
    tenant.longitude === null ||
    !tenant.address ||
    !tenant.tenantType ||
    !tenant.creatorDraft ||
    !tenant.creatorOriginRegion ||
    tenant.isPublished
  ) {
    res.status(400).json({ error: "Osnutek nima popolnega potrjenega izhodišča." });
    return;
  }
  const isMenina = isPreservedMeninaEvidenceTenant({
    name: tenant.name,
    latitude: tenant.latitude,
    longitude: tenant.longitude,
  });
  try {
    const claim = isMenina
      ? await claimCreatorRunOnce(
        tenantId,
        { latitude: tenant.latitude, longitude: tenant.longitude },
        MENINA_AUTHORIZED_RUN_COUNT,
      )
      : null;
    if (claim?.existingRun) {
      res.status(409).json({ error: "Pet odobrenih produkcijskih izvedb C1 za Camping MENINA je dokazno zaklenjenih ali pa peta izvedba že teče." });
      return;
    }
    const result = await runCreatorC1({
      tenantId,
      claimedRunId: claim?.claimedRunId ?? undefined,
      origin: { latitude: tenant.latitude, longitude: tenant.longitude },
      region: tenant.creatorOriginRegion,
      tenantType: tenant.tenantType,
    });
    const [completed] = await db.select().from(creatorRunsTable)
      .where(eq(creatorRunsTable.id, result.runId))
      .limit(1);
    if (!completed) throw new Error("Poročila izvedbe ni mogoče ponovno prebrati.");
    res.json(StartCreatorRunResponse.parse(serialize(await creatorRunResponse(completed))));
  } catch (error) {
    const databaseCode = (error as { code?: string })?.code;
    if (databaseCode === "23505") {
      res.status(409).json({ error: "C1 za ta osnutek že teče. Počakajte, da se trenutna izvedba zaključi." });
      return;
    }
    req.log.error({ error, tenantId }, "Creator C1 run failed");
    res.status(500).json({
      error: error instanceof Error ? error.message : "C1 se ni uspešno zaključil. Poročilo o napaki je shranjeno.",
    });
  }
});

router.get("/admin/tenants/:id/creator/runs/latest", async (req, res): Promise<void> => {
  const tenantId = first(req.params["id"]);
  if (!await requireCreatorTenant(tenantId)) {
    res.status(404).json({ error: "Namestitev ni najdena." });
    return;
  }
  const [run] = await db.select().from(creatorRunsTable)
    .where(eq(creatorRunsTable.tenantId, tenantId))
    .orderBy(desc(creatorRunsTable.createdAt))
    .limit(1);
  res.json(GetLatestCreatorRunResponse.parse(run ? serialize(await creatorRunResponse(run)) : null));
});

router.get("/admin/tenants/:id/creator/catalogue", async (req, res): Promise<void> => {
  const tenantId = first(req.params["id"]);
  if (!await requireCreatorTenant(tenantId)) {
    res.status(404).json({ error: "Namestitev ni najdena." });
    return;
  }
  const categories = await db.select({
    id: categoriesTable.id,
    label: categoriesTable.label,
  }).from(categoriesTable)
    .innerJoin(sectionsTable, eq(categoriesTable.sectionId, sectionsTable.id))
    .where(and(
      eq(sectionsTable.tenantId, tenantId),
      isNull(categoriesTable.deletedAt),
    ))
    .orderBy(sectionsTable.position, categoriesTable.position);
  res.json(ListCreatorCategoryOptionsResponse.parse(categories));
});

router.patch("/admin/tenants/:id/creator/proposals/:proposalId", async (req, res): Promise<void> => {
  const input = EditCreatorProposalBody.safeParse(req.body);
  if (!input.success) {
    res.status(400).json({ error: "Ureditev potrebuje kategorijo in vse štiri jezike." });
    return;
  }
  try {
    const tenantId = first(req.params["id"]);
    if (!await requireCreatorTenant(tenantId)) {
      res.status(404).json({ error: "Namestitev ni najdena." });
      return;
    }
    const actor = await getAdminUser();
    if (!actor) {
      res.status(403).json({ error: "Operater ni najden." });
      return;
    }
    const row = await editCreatorProposalEditorial({
      tenantId,
      proposalId: first(req.params["proposalId"]),
      actorId: actor.id,
      categoryId: input.data.categoryId,
      translations: input.data.translations,
    });
    if (!row) throw new Error("Predlog po ureditvi ni najden.");
    res.json(EditCreatorProposalResponse.parse(serialize({
      ...row,
      nearestAlternatives: [],
    })));
  } catch (error) {
    res.status(error instanceof CreatorBulkApprovalError ? 400 : 404).json({
      error: error instanceof Error ? error.message : "Predloga ni mogoče urediti.",
    });
  }
});

router.post("/admin/tenants/:id/creator/proposals/:proposalId/reject", async (req, res): Promise<void> => {
  try {
    const tenantId = first(req.params["id"]);
    if (!await requireCreatorTenant(tenantId)) {
      res.status(404).json({ error: "Namestitev ni najdena." });
      return;
    }
    const actor = await getAdminUser();
    if (!actor) {
      res.status(403).json({ error: "Operater ni najden." });
      return;
    }
    const row = await rejectCreatorProposalIndividually(
      tenantId,
      first(req.params["proposalId"]),
      actor.id,
    );
    if (!row) throw new Error("Predlog po zavrnitvi ni najden.");
    res.json(RejectCreatorProposalResponse.parse(serialize({
      ...row,
      nearestAlternatives: [],
    })));
  } catch (error) {
    res.status(404).json({
      error: error instanceof Error ? error.message : "Predloga ni mogoče zavrniti.",
    });
  }
});

router.post("/admin/tenants/:id/creator/proposals/:proposalId/confirm-coordinates", async (req, res): Promise<void> => {
  const input = ConfirmCreatorProposalCoordinatesBody.safeParse(req.body);
  if (!input.success) {
    res.status(400).json({ error: "Vnesite veljavni koordinati." });
    return;
  }
  try {
    const actor = await getAdminUser();
    if (!actor) {
      res.status(403).json({ error: "Operater ni najden." });
      return;
    }
    const row = await confirmCreatorProposalCoordinates({
      tenantId: first(req.params["id"]),
      proposalId: first(req.params["proposalId"]),
      actorId: actor.id,
      latitude: input.data.latitude,
      longitude: input.data.longitude,
    });
    if (!row) throw new Error("Predlog po potrditvi koordinat ni najden.");
    res.json(ConfirmCreatorProposalCoordinatesResponse.parse(serialize(row)));
  } catch (error) {
    res.status(404).json({
      error: error instanceof Error ? error.message : "Koordinat ni mogoče potrditi.",
    });
  }
});

router.get("/admin/tenants/:id/creator/proposals", async (req, res): Promise<void> => {
  const tenantId = first(req.params["id"]);
  if (!await requireCreatorTenant(tenantId)) {
    res.status(404).json({ error: "Namestitev ni najdena." });
    return;
  }
  const rows = await listCreatorProposalQueue(tenantId);
  res.json(ListCreatorProposalsResponse.parse(serialize(rows)));
});

router.post(
  "/admin/tenants/:id/creator/proposals/:proposalId/approve",
  async (req, res): Promise<void> => {
    try {
      const tenantId = first(req.params["id"]);
      if (!await requireCreatorTenant(tenantId)) {
        res.status(404).json({ error: "Namestitev ni najdena." });
        return;
      }
      const actor = await getAdminUser();
      if (!actor) {
        res.status(403).json({ error: "Operater ni najden." });
        return;
      }
      const row = await approveCreatorProposalIndividually(
        tenantId,
        first(req.params["proposalId"]),
        actor.id,
      );
      res.json(ApproveCreatorProposalResponse.parse(serialize({
        ...row,
        nearestAlternatives: [],
      })));
    } catch (error) {
      res.status(404).json({
        error: error instanceof Error ? error.message : "Predloga ni mogoče potrditi.",
      });
    }
  },
);

router.post(
  "/admin/tenants/:id/creator/proposals/approve-bulk",
  async (req, res): Promise<void> => {
    const input = ApproveCreatorProposalsBulkBody.safeParse(req.body);
    if (!input.success) {
      res.status(400).json({ error: "Izberite predloge za potrditev." });
      return;
    }
    try {
      const tenantId = first(req.params["id"]);
      if (!await requireCreatorTenant(tenantId)) {
        res.status(404).json({ error: "Namestitev ni najdena." });
        return;
      }
      const actor = await getAdminUser();
      if (!actor) {
        res.status(403).json({ error: "Operater ni najden." });
        return;
      }
      await approveCreatorProposalsBulk(
        tenantId,
        input.data.proposalIds,
        actor.id,
      );
      const rows = await listCreatorProposalQueue(tenantId);
      res.json(ApproveCreatorProposalsBulkResponse.parse(serialize(rows)));
    } catch (error) {
      res.status(error instanceof CreatorBulkApprovalError ? 400 : 500).json({
        error: error instanceof Error ? error.message : "Predlogov ni mogoče potrditi.",
      });
    }
  },
);

export default router;