import { Router, type IRouter } from "express";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { categoriesTable, creatorRunsTable, db, sectionsTable, tenantAliasesTable, tenantsTable } from "@workspace/db";
import {
  ApproveCreatorProposalResponse,
  ApproveCreatorProposalsBulkBody,
  ApproveCreatorProposalsBulkResponse,
  CreateCreatorDraftTenantBody,
  CreateCreatorDraftTenantResponse,
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
import { seedTenantContent } from "../lib/tenantSeeds";
import { RESERVED_SLUGS, slugify } from "../lib/slug";
import { CREATOR_C1_PRICING, runCreatorC1, type CreatorC1Report } from "../lib/creatorC1";
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

function normalizedName(name: string): string {
  return name.normalize("NFKC").replace(/\s+/g, " ").trim().toLocaleLowerCase("sl");
}

function draftSlugBase(name: string): string {
  let base = slugify(name);
  if (base.length < 3) base = `tenant-${base || "draft"}`;
  base = base.slice(0, 40).replace(/-+$/g, "");
  if (RESERVED_SLUGS.has(base)) base = `tenant-${base}`.slice(0, 40);
  return base.length >= 3 ? base : "tenant-draft";
}

function numberedSlug(base: string, number: number): string {
  if (number === 0) return base;
  const suffix = `-${number + 1}`;
  return `${base.slice(0, 40 - suffix.length).replace(/-+$/g, "")}${suffix}`;
}

class CreatorDraftConflictError extends Error {
  constructor() {
    super("Creator draft already exists.");
    this.name = "CreatorDraftConflictError";
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

function creatorRunResponse(row: typeof creatorRunsTable.$inferSelect) {
  const report = parseRunReport(row.reportJson);
  return {
    id: row.id,
    tenantId: row.tenantId,
    status: row.status,
    model: "gpt-5.6-terra",
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
    error: report?.error ?? null,
    startedAt: row.startedAt,
    completedAt: row.completedAt,
    outcomes: report?.outcomes ?? [],
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

router.post("/admin/creator/draft-tenants", async (req, res): Promise<void> => {
  const input = CreateCreatorDraftTenantBody.safeParse(req.body);
  if (!input.success) {
    res.status(400).json({ error: "Vnesite ime, naslov, tip in Google Maps povezavo." });
    return;
  }
  const name = input.data.name.replace(/\s+/g, " ").trim();
  const address = input.data.address.replace(/\s+/g, " ").trim();
  if (!name || !address) {
    res.status(400).json({ error: "Ime in naslov ne smeta biti prazna." });
    return;
  }

  try {
    // Re-resolve the original URL; no browser-provided coordinates are used.
    const origin = await resolveCreatorOrigin(input.data.mapUrl);
    const base = draftSlugBase(name);
    const signature = `${normalizedName(name)}\u0000${origin.expandedUrl}`;
    const tenant = await db.transaction(async (tx) => {
      // Serialize identical origin/name requests and same-base slug allocation.
      // Hash collisions only serialize unrelated creations; they cannot merge them.
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${signature}))`);
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${base}))`);
      const sameOrigin = await tx
        .select({ id: tenantsTable.id, name: tenantsTable.name })
        .from(tenantsTable)
        .where(eq(tenantsTable.mapUrl, origin.expandedUrl));
      if (sameOrigin.some((row) => normalizedName(row.name) === normalizedName(name))) {
        throw new CreatorDraftConflictError();
      }

      for (let n = 0; n < 1000; n += 1) {
        const slug = numberedSlug(base, n);
        const [reserved] = await tx
          .select({ slug: tenantAliasesTable.slug })
          .from(tenantAliasesTable)
          .where(eq(tenantAliasesTable.slug, slug))
          .limit(1);
        if (reserved) continue;
        const inserted = await tx.insert(tenantsTable).values({
          slug,
          name,
          address,
          mapUrl: origin.expandedUrl,
          latitude: origin.lat,
          longitude: origin.lng,
          tenantType: input.data.tenantType,
          creatorDraft: true,
          creatorOriginRegion: origin.nominatimDisplayName,
          isPublished: false,
          firstPublishedAt: null,
        }).onConflictDoNothing().returning();
        if (!inserted[0]) continue;
        await seedTenantContent(inserted[0].id, input.data.tenantType, tx);
        return inserted[0];
      }
      throw new Error("Za nastanitev ni mogoče ustvariti prostega naslova.");
    });
    res.status(201).json(CreateCreatorDraftTenantResponse.parse(serialize(tenant)));
  } catch (error) {
    if (error instanceof CreatorDraftConflictError) {
      res.status(409).json({ error: "Osnutek za to nastanitev in izvor že obstaja." });
      return;
    }
    if (error instanceof GoogleMapsParseError || error instanceof GoogleMapsRedirectError) {
      res.status(422).json({ error: error.message, code: error.kind });
      return;
    }
    req.log.warn({ error }, "Creator draft tenant creation failed");
    res.status(502).json({ error: "Bližnje znane točke pri Nominatimu ni bilo mogoče preveriti.", code: "nominatim-failed" });
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
      res.status(409).json({ error: "Tri odobrene produkcijske izvedbe C1 za Camping MENINA so dokazno zaklenjene ali pa tretja izvedba že teče." });
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
    res.json(StartCreatorRunResponse.parse(serialize(creatorRunResponse(completed))));
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
  res.json(GetLatestCreatorRunResponse.parse(run ? serialize(creatorRunResponse(run)) : null));
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
    res.json(EditCreatorProposalResponse.parse(serialize(row)));
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
    res.json(RejectCreatorProposalResponse.parse(serialize(row)));
  } catch (error) {
    res.status(404).json({
      error: error instanceof Error ? error.message : "Predloga ni mogoče zavrniti.",
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
      res.json(ApproveCreatorProposalResponse.parse(serialize(row)));
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