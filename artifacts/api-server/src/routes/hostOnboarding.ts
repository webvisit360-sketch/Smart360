import { randomUUID } from "node:crypto";
import { Router, type IRouter, type Request, type Response } from "express";
import sharp from "sharp";
import {
  AllocateHostOnboardingPhotoUploadBody,
  AutosaveHostOnboardingBody,
  ConfirmHostOnboardingSubmissionBody,
  CreateHostOnboardingCategoryBody,
} from "@workspace/api-zod";
import {
  db,
  hostOnboardingPhotosTable,
  hostOnboardingRoundsTable,
  itemsTable,
  mediaTable,
  tenantsTable,
  type HostOnboardingData,
} from "@workspace/db";
import { and, eq, sql } from "drizzle-orm";
import { requireAdmin } from "../lib/adminAuth";
import {
  currentHostOnboarding,
  createHostOnboardingCategory,
  hostCustomCategoriesAreSubmittable,
  openHostOnboarding,
  ownerHostOnboarding,
  processHostRecommendationIntents,
  recommendationProcessingStatus,
  saveHostOnboarding,
  submittedHostOnboardingReplay,
  submitHostOnboarding,
} from "../lib/hostOnboarding";
import { ObjectStorageService } from "../lib/objectStorage";
import { HOST_ONBOARDING_OPERATOR_EMAIL } from "../lib/hostOnboardingEmail";
import { HOST_ONBOARDING_PROVENANCE } from "../lib/hostOnboardingCreator";
import {
  hostOnboardingObjectCounterpart,
  hostOnboardingRawObjectPath,
  hostOnboardingSanitizedObjectPath,
} from "../lib/hostOnboardingPhotoPaths";
import { ensureHostOnboardingGalleryItem } from "../lib/hostOnboardingCanonical";
import { logChange } from "../lib/changelog";
import {
  safeDatabaseErrorDiagnostic,
  safeRequestId,
} from "../lib/infrastructureDiagnostics";
import { storePhotoVariants } from "./storage";

const router: IRouter = Router();
const storage = new ObjectStorageService();
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_PHOTO_BYTES = 20 * 1024 * 1024;

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function dataFormatsAreValid(data: HostOnboardingData): boolean {
  if (data.guestEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.guestEmail)) return false;
  if (data.website) {
    try {
      const protocol = new URL(data.website).protocol;
      if (protocol !== "http:" && protocol !== "https:") return false;
    } catch {
      return false;
    }
  }
  if (data.checkInFrom && !TIME_RE.test(data.checkInFrom)) return false;
  if (data.checkOutUntil && !TIME_RE.test(data.checkOutUntil)) return false;
  const customCategoryIds = new Set(data.customCategories.map(({ id }) => id));
  if (customCategoryIds.size !== data.customCategories.length) return false;
  for (const category of data.customCategories) {
    const entryIds = new Set(category.entries.map(({ id }) => id));
    if (entryIds.size !== category.entries.length) return false;
  }
  return data.events.every((event) =>
    (!event.date || DATE_RE.test(event.date)) && (!event.time || TIME_RE.test(event.time)),
  );
}

function fail(res: Response, status: number, message: string, extra?: object): void {
  res.status(status).json({ message, ...extra });
}

function validationPaths(
  issues: ReadonlyArray<{ path: ReadonlyArray<PropertyKey> }>,
): string[] {
  return [...new Set(issues.map(({ path }) => path.map(String).join(".") || "body"))];
}

type HostOnboardingFailureReason =
  | "validation_failed"
  | "stale_revision"
  | "session_unavailable"
  | "database_permission_denied"
  | "save_failed"
  | "submit_failed";

function infrastructureFailure(
  error: unknown,
  fallback: "save_failed" | "submit_failed",
) {
  const diagnostic = safeDatabaseErrorDiagnostic(error);
  const reasonCode: HostOnboardingFailureReason =
    diagnostic.databaseCode === "42501" ? "database_permission_denied" : fallback;
  return { diagnostic, reasonCode };
}

function failureDetails(
  req: Request,
  reasonCode: HostOnboardingFailureReason,
  invalidFields?: string[],
) {
  return {
    reasonCode,
    requestId: safeRequestId(req),
    ...(invalidFields ? { invalidFields } : {}),
  };
}

function hostActor(req: Request, res: Response) {
  if (req.actor?.kind !== "host") {
    req.log.warn(
      {
        requestId: safeRequestId(req),
        operation: "host_onboarding_request",
        outcome: "rejected",
        reasonCode: "session_unavailable",
      },
      "Host onboarding request rejected",
    );
    fail(
      res,
      401,
      "Za nadaljevanje se prijavite kot gostitelj.",
      failureDetails(req, "session_unavailable"),
    );
    return null;
  }
  return req.actor;
}

function tenantIdParam(req: Request, res: Response): string | null {
  const id = String(req.params["id"] ?? "");
  if (!UUID_RE.test(id)) {
    fail(res, 404, "Namestitev ne obstaja.");
    return null;
  }
  return id;
}

function photoDto(
  row: typeof hostOnboardingPhotosTable.$inferSelect,
  previewUrl: string,
  mediaId?: string,
) {
  return {
    id: row.id,
    fileName: row.fileName,
    contentType: row.contentType,
    size: row.actualSize ?? row.expectedSize,
    status: row.status,
    previewUrl,
    ...(mediaId ? { mediaId } : {}),
  };
}

export function hostDto(result: NonNullable<Awaited<ReturnType<typeof currentHostOnboarding>>>) {
  const { round } = result;
  return {
    id: round.id,
    tenantId: round.tenantId,
    round: round.round,
    revision: round.revision,
    canonicalRevision: result.canonicalRevision,
    status: round.status,
    data: round.draftData,
    categories: result.categories.map((category, order) => ({
      id: category.key,
      key: category.key,
      name: category.label,
      label: category.label,
      order,
    })),
    contentSections: result.contentSections,
    photos: result.photos.map((photo) => {
      const mediaId = round.draftData.media?.find((media) =>
        media.url.includes(`onboarding-${photo.id}.jpg`)
      )?.id;
      return photoDto(photo, `/api/admin/host/onboarding/photos/${photo.id}`, mediaId);
    }),
    updatedAt: round.updatedAt.toISOString(),
    submittedAt: round.submittedAt?.toISOString() ?? null,
    recommendationProcessing: recommendationProcessingStatus(round.targetReview),
  };
}

const onboardingPhotoProvenance = (photoId: string) =>
  JSON.stringify({ source: "host-onboarding", photoId });

async function materializeReadyPhoto(
  tenantId: string,
  photo: typeof hostOnboardingPhotosTable.$inferSelect,
): Promise<void> {
  const provenanceJson = onboardingPhotoProvenance(photo.id);
  const [existing] = await db.select({ id: mediaTable.id }).from(mediaTable)
    .where(and(
      eq(mediaTable.tenantId, tenantId),
      eq(mediaTable.provenanceJson, provenanceJson),
    )).limit(1);
  if (existing) return;
  const [tenant] = await db.select({ slug: tenantsTable.slug }).from(tenantsTable)
    .where(eq(tenantsTable.id, tenantId)).limit(1);
  if (!tenant) throw new Error("missing_tenant");
  const source = await storage.getObjectEntityFile(photo.objectPath);
  const [bytes] = await source.download();
  const name = `onboarding-${photo.id}.jpg`;
  await storePhotoVariants(tenant.slug, name, bytes);
  await db.transaction(async (tx) => {
    const itemId = await ensureHostOnboardingGalleryItem(tx, tenantId);
    await tx.execute(sql`SELECT 1 FROM ${itemsTable} WHERE ${itemsTable.id} = ${itemId} FOR UPDATE`);
    const [duplicate] = await tx.select({ id: mediaTable.id }).from(mediaTable)
      .where(and(
        eq(mediaTable.tenantId, tenantId),
        eq(mediaTable.provenanceJson, provenanceJson),
      )).limit(1);
    if (duplicate) return;
    await tx.insert(mediaTable).values({
      itemId,
      tenantId,
      url: `/api/storage/img/${tenant.slug}/${name}`,
      alt: photo.fileName,
      kind: "image",
      width: photo.width,
      height: photo.height,
      provenanceProvider: "host-onboarding",
      provenanceFile: photo.objectPath,
      provenanceJson,
      position: sql<number>`(select coalesce(max(${mediaTable.position}), -1) + 1 from ${mediaTable} where ${mediaTable.itemId} = ${itemId})`,
    });
    await tx.update(tenantsTable).set({ hasUnpublishedChanges: true })
      .where(eq(tenantsTable.id, tenantId));
  });
}

router.get("/admin/host/onboarding", async (req, res): Promise<void> => {
  const actor = hostActor(req, res);
  if (!actor) return;
  const result = await currentHostOnboarding(actor.tenantId, actor.hostUserId);
  if (!result) {
    fail(res, 404, "Obrazec za to namestitev še ni odprt.");
    return;
  }
  res.json(hostDto(result));
});

async function save(req: Request, res: Response): Promise<void> {
  const actor = hostActor(req, res);
  if (!actor) return;
  const parsed = AutosaveHostOnboardingBody.safeParse(req.body);
  if (
    !parsed.success ||
    !Number.isInteger(parsed.data.revision) ||
    parsed.data.revision < 1
  ) {
    const invalidFields = !parsed.success
      ? validationPaths(parsed.error.issues)
      : ["revision"];
    req.log.warn(
      {
        requestId: safeRequestId(req),
        operation: "host_onboarding_save",
        tenantId: actor.tenantId,
        outcome: "rejected",
        reasonCode: "validation_failed",
        invalidFields,
      },
      "Host onboarding save rejected",
    );
    fail(
      res,
      400,
      "Podatki obrazca niso veljavni.",
      failureDetails(req, "validation_failed", invalidFields),
    );
    return;
  }
  const diagnosticBase = {
    requestId: safeRequestId(req),
    operation: "host_onboarding_save",
    tenantId: actor.tenantId,
    requestedRevision: parsed.data.revision,
  };
  let current;
  try {
    current = await currentHostOnboarding(actor.tenantId, actor.hostUserId);
  } catch (error) {
    const failure = infrastructureFailure(error, "save_failed");
    req.log.error(
      {
        ...diagnosticBase,
        outcome: "failed",
        reasonCode: failure.reasonCode,
        ...failure.diagnostic,
      },
      "Host onboarding save infrastructure failure",
    );
    fail(
      res,
      500,
      "Shranjevanje trenutno ni uspelo. Poskusite znova.",
      failureDetails(req, failure.reasonCode),
    );
    return;
  }
  if (!current) {
    req.log.warn(
      { ...diagnosticBase, outcome: "rejected", reasonCode: "session_unavailable" },
      "Host onboarding save rejected",
    );
    fail(
      res,
      404,
      "Obrazec za to namestitev še ni odprt.",
      failureDetails(req, "session_unavailable"),
    );
    return;
  }
  const merged = ConfirmHostOnboardingSubmissionBody.safeParse({
    round: current.round.round,
    revision: parsed.data.revision,
    data: { ...current.round.draftData, ...parsed.data.data },
  });
  if (!merged.success || !merged.data.data || !dataFormatsAreValid(merged.data.data)) {
    const invalidFields = !merged.success
      ? validationPaths(merged.error.issues)
      : ["data"];
    req.log.warn(
      {
        ...diagnosticBase,
        outcome: "rejected",
        reasonCode: "validation_failed",
        invalidFields,
      },
      "Host onboarding save rejected",
    );
    fail(
      res,
      400,
      "Podatki obrazca niso veljavni.",
      failureDetails(req, "validation_failed", invalidFields),
    );
    return;
  }
  let result;
  try {
    result = await saveHostOnboarding(
      actor.tenantId,
      actor.hostUserId,
      parsed.data.revision,
      parsed.data.data,
      (req.body as { canonicalRevision?: string }).canonicalRevision,
    );
  } catch (error) {
    const failure = infrastructureFailure(error, "save_failed");
    req.log.error(
      {
        ...diagnosticBase,
        round: current.round.round,
        outcome: "failed",
        reasonCode: failure.reasonCode,
        ...failure.diagnostic,
      },
      "Host onboarding save infrastructure failure",
    );
    fail(
      res,
      500,
      "Shranjevanje trenutno ni uspelo. Poskusite znova.",
      failureDetails(req, failure.reasonCode),
    );
    return;
  }
  if (!result.ok) {
    const reasonCode: HostOnboardingFailureReason = result.kind === "stale"
      ? "stale_revision"
      : result.kind === "missing"
        ? "session_unavailable"
        : "save_failed";
    req.log.warn(
      {
        ...diagnosticBase,
        round: current.round.round,
        outcome: "rejected",
        reasonCode,
        reason: result.kind === "stale" ? result.staleReason : result.kind,
        currentRevision: result.currentRevision,
      },
      "Host onboarding save rejected",
    );
    if (result.kind === "stale") {
      fail(
        res,
        409,
        "Osnutek je bil medtem spremenjen. Osvežite obrazec in poskusite znova.",
        {
          ...failureDetails(req, reasonCode),
          currentRevision: result.currentRevision,
        },
      );
    } else {
      fail(
        res,
        result.kind === "missing" ? 404 : 409,
        result.kind === "missing"
          ? "Obrazec za to namestitev še ni odprt."
          : "Oddanega obrazca ni več mogoče spreminjati.",
        failureDetails(req, reasonCode),
      );
    }
    return;
  }
  let canonical;
  try {
    canonical = await currentHostOnboarding(actor.tenantId, actor.hostUserId);
  } catch (error) {
    const failure = infrastructureFailure(error, "save_failed");
    req.log.error(
      {
        ...diagnosticBase,
        round: current.round.round,
        outcome: "failed",
        phase: "response_read",
        reasonCode: failure.reasonCode,
        ...failure.diagnostic,
      },
      "Host onboarding save infrastructure failure",
    );
    fail(
      res,
      500,
      "Sprememba je bila shranjena, vendar osvežitev podatkov ni uspela.",
      failureDetails(req, failure.reasonCode),
    );
    return;
  }
  if (!canonical) {
    req.log.warn(
      {
        ...diagnosticBase,
        round: current.round.round,
        outcome: "rejected",
        reasonCode: "session_unavailable",
      },
      "Host onboarding save rejected",
    );
    fail(
      res,
      404,
      "Obrazec za to namestitev še ni odprt.",
      failureDetails(req, "session_unavailable"),
    );
    return;
  }
  const dto = hostDto(canonical);
  if (result.recommendationProcessing?.status === "failed") {
    req.log.warn(
      {
        ...diagnosticBase,
        round: canonical.round.round,
        outcome: "recommendation_processing_failed",
        recommendationRevision: result.recommendationProcessing.revision,
        errorCode: result.recommendationProcessing.errorCode,
        statusPersistence: result.recommendationProcessing.statusPersistence,
        persistenceErrorCode: result.recommendationProcessing.persistenceErrorCode,
      },
      "Host onboarding recommendation processing failed after save committed",
    );
  }
  req.log.info(
    {
      ...diagnosticBase,
      round: canonical.round.round,
      outcome: "saved",
      resultingRevision: dto.revision,
    },
    "Host onboarding save completed",
  );
  res.json({
    ok: true,
    revision: dto.revision,
    canonicalRevision: dto.canonicalRevision,
    updatedAt: dto.updatedAt,
    data: dto.data,
    photos: dto.photos,
    categories: dto.categories,
    contentSections: dto.contentSections,
    recommendationProcessing: result.recommendationProcessing,
  });
}

router.patch("/admin/host/onboarding", save);
router.post("/admin/host/onboarding/save", save);

router.post("/admin/host/onboarding/recommendations/retry", async (req, res): Promise<void> => {
  const actor = hostActor(req, res);
  if (!actor) return;
  const current = await currentHostOnboarding(actor.tenantId, actor.hostUserId);
  if (!current) {
    fail(res, 404, "Obrazec za to namestitev še ni odprt.");
    return;
  }
  const recommendationProcessing = await processHostRecommendationIntents(
    current.round.id,
    current.round.revision,
  );
  res.json({ ok: recommendationProcessing.status !== "failed", recommendationProcessing });
});

router.post("/admin/host/onboarding/categories", async (req, res): Promise<void> => {
  const actor = hostActor(req, res);
  if (!actor) return;
  const parsed = CreateHostOnboardingCategoryBody.safeParse(req.body);
  if (!parsed.success || !Number.isInteger(parsed.data.revision)) {
    fail(res, 400, "Podatki kategorije niso veljavni.");
    return;
  }
  const result = await createHostOnboardingCategory(
    actor.tenantId,
    actor.hostUserId,
    parsed.data,
  );
  if (!result.ok) {
    if (result.kind === "stale") {
      fail(res, 409, "Osnutek je bil medtem spremenjen. Osvežite obrazec in poskusite znova.", {
        currentRevision: result.currentRevision,
      });
      return;
    }
    fail(
      res,
      result.kind === "missing" || result.kind === "missing_section" ? 404 : 409,
      result.kind === "submitted"
        ? "Oddanega obrazca ni več mogoče spreminjati."
        : "Obrazec ali razdelek za to namestitev ne obstaja.",
    );
    return;
  }
  const canonical = await currentHostOnboarding(actor.tenantId, actor.hostUserId);
  if (!canonical) {
    fail(res, 404, "Obrazec za to namestitev še ni odprt.");
    return;
  }
  await logChange({
    tenantId: actor.tenantId,
    action: "create",
    entity: "category",
    summary: `Ustvarjena kategorija: ${parsed.data.name}`,
    operationKey: `category-create:${result.categoryId}`,
  });
  res.status(201).json(hostDto(canonical));
});

router.post("/admin/host/onboarding/submit", async (req, res): Promise<void> => {
  const actor = hostActor(req, res);
  if (!actor) return;
  const requestedRound =
    req.body && typeof req.body === "object"
      ? (req.body as Record<string, unknown>)["round"]
      : undefined;
  if (
    typeof requestedRound !== "number" ||
    !Number.isInteger(requestedRound) ||
    requestedRound < 1
  ) {
    req.log.warn(
      {
        requestId: safeRequestId(req),
        operation: "host_onboarding_submit",
        tenantId: actor.tenantId,
        outcome: "rejected",
        reasonCode: "validation_failed",
        invalidFields: ["round"],
      },
      "Host onboarding submit rejected",
    );
    fail(
      res,
      400,
      "Krog obrazca ni veljaven.",
      failureDetails(req, "validation_failed", ["round"]),
    );
    return;
  }
  const submitRequestDiagnostic = {
    requestId: safeRequestId(req),
    operation: "host_onboarding_submit",
    tenantId: actor.tenantId,
    round: requestedRound,
  };

  // Immutable replay is resolved before mutable payload validation. It never
  // maps data, publishes, or admits another notification attempt.
  let replay;
  try {
    replay = await submittedHostOnboardingReplay(
      actor.tenantId,
      actor.hostUserId,
      requestedRound,
    );
  } catch (error) {
    const failure = infrastructureFailure(error, "submit_failed");
    req.log.error(
      {
        ...submitRequestDiagnostic,
        outcome: "failed",
        phase: "replay_lookup",
        reasonCode: failure.reasonCode,
        ...failure.diagnostic,
      },
      "Host onboarding submit infrastructure failure",
    );
    fail(
      res,
      500,
      "Oddaja trenutno ni uspela. Poskusite znova.",
      failureDetails(req, failure.reasonCode),
    );
    return;
  }
  if (replay) {
    req.log.info(
      { ...submitRequestDiagnostic, outcome: "replayed" },
      "Host onboarding submit completed",
    );
    res.json({
      ok: true,
      alreadySubmitted: true,
      message: "Hvala! Vaš vodnik pripravljamo — obvestili vas bomo, ko bo pripravljen za pregled.",
    });
    return;
  }

  const parsed = ConfirmHostOnboardingSubmissionBody.safeParse(req.body);
  if (!parsed.success) {
    const invalidFields = validationPaths(parsed.error.issues);
    req.log.warn(
      {
        ...submitRequestDiagnostic,
        outcome: "rejected",
        reasonCode: "validation_failed",
        invalidFields,
      },
      "Host onboarding submit rejected",
    );
    fail(
      res,
      400,
      "Za prvo oddajo pošljite trenutno revizijo osnutka.",
      failureDetails(req, "validation_failed", invalidFields),
    );
    return;
  }
  if (
    parsed.data.revision === undefined ||
    !Number.isInteger(parsed.data.revision) ||
    parsed.data.revision < 1
  ) {
    req.log.warn(
      {
        ...submitRequestDiagnostic,
        outcome: "rejected",
        reasonCode: "validation_failed",
        invalidFields: ["revision"],
      },
      "Host onboarding submit rejected",
    );
    fail(
      res,
      400,
      "Za prvo oddajo pošljite trenutno revizijo osnutka.",
      failureDetails(req, "validation_failed", ["revision"]),
    );
    return;
  }
  let data = parsed.data.data;
  if (!data) {
    let current;
    try {
      current = await currentHostOnboarding(actor.tenantId, actor.hostUserId);
    } catch (error) {
      const failure = infrastructureFailure(error, "submit_failed");
      req.log.error(
        {
          ...submitRequestDiagnostic,
          requestedRevision: parsed.data.revision,
          outcome: "failed",
          phase: "draft_read",
          reasonCode: failure.reasonCode,
          ...failure.diagnostic,
        },
        "Host onboarding submit infrastructure failure",
      );
      fail(
        res,
        500,
        "Oddaja trenutno ni uspela. Poskusite znova.",
        failureDetails(req, failure.reasonCode),
      );
      return;
    }
    if (
      !current ||
      current.round.round !== requestedRound ||
      current.round.status !== "draft"
    ) {
      const reasonCode: HostOnboardingFailureReason = current
        ? "validation_failed"
        : "session_unavailable";
      req.log.warn(
        {
          ...submitRequestDiagnostic,
          requestedRevision: parsed.data.revision,
          outcome: "rejected",
          reasonCode,
          invalidFields: ["round"],
        },
        "Host onboarding submit rejected",
      );
      fail(
        res,
        409,
        "Krog obrazca ni veljaven.",
        failureDetails(req, reasonCode, ["round"]),
      );
      return;
    }
    data = current.round.draftData;
  }
  const validated = ConfirmHostOnboardingSubmissionBody.safeParse({
    round: requestedRound,
    revision: parsed.data.revision,
    data,
  });
  if (!validated.success || !validated.data.data || !dataFormatsAreValid(validated.data.data)) {
    const invalidFields = !validated.success
      ? validationPaths(validated.error.issues)
      : ["data"];
    req.log.warn(
      {
        ...submitRequestDiagnostic,
        requestedRevision: parsed.data.revision,
        outcome: "rejected",
        reasonCode: "validation_failed",
        invalidFields,
      },
      "Host onboarding submit rejected",
    );
    fail(
      res,
      400,
      "Podatki obrazca niso veljavni.",
      failureDetails(req, "validation_failed", invalidFields),
    );
    return;
  }
  data = validated.data.data;
  const required = [
    data.accommodationName,
    data.address,
    data.guestPhone,
    data.guestEmail,
    data.checkInFrom,
    data.checkOutUntil,
  ];
  if (required.some((value) => !value.trim())) {
    const requiredFields = [
      "data.accommodationName",
      "data.address",
      "data.guestPhone",
      "data.guestEmail",
      "data.checkInFrom",
      "data.checkOutUntil",
    ];
    const invalidFields = requiredFields.filter((_, index) => !required[index]?.trim());
    req.log.warn(
      {
        ...submitRequestDiagnostic,
        requestedRevision: parsed.data.revision,
        outcome: "rejected",
        reasonCode: "validation_failed",
        invalidFields,
      },
      "Host onboarding submit rejected",
    );
    fail(
      res,
      400,
      "Izpolnite vsa obvezna polja v osnovnih podatkih.",
      failureDetails(req, "validation_failed", invalidFields),
    );
    return;
  }
  if (!data.contacts.some((contact) => contact.name.trim() && contact.phone.trim())) {
    req.log.warn(
      {
        ...submitRequestDiagnostic,
        requestedRevision: parsed.data.revision,
        outcome: "rejected",
        reasonCode: "validation_failed",
        invalidFields: ["data.contacts"],
      },
      "Host onboarding submit rejected",
    );
    fail(
      res,
      400,
      "Dodajte vsaj eno kontaktno osebo z imenom in telefonom.",
      failureDetails(req, "validation_failed", ["data.contacts"]),
    );
    return;
  }
  for (const event of data.events) {
    if (event.name.trim() && (!event.date || !event.time)) {
      req.log.warn(
        {
          ...submitRequestDiagnostic,
          requestedRevision: parsed.data.revision,
          outcome: "rejected",
          reasonCode: "validation_failed",
          invalidFields: ["data.events"],
        },
        "Host onboarding submit rejected",
      );
      fail(
        res,
        400,
        "Pri dogodku z nazivom izberite tudi datum in uro.",
        failureDetails(req, "validation_failed", ["data.events"]),
      );
      return;
    }
  }
  if (!hostCustomCategoriesAreSubmittable(data)) {
    req.log.warn(
      {
        ...submitRequestDiagnostic,
        requestedRevision: parsed.data.revision,
        outcome: "rejected",
        reasonCode: "validation_failed",
        invalidFields: ["data.customCategories"],
      },
      "Host onboarding submit rejected",
    );
    fail(
      res,
      400,
      "Vnesite ime svoje kategorije ali odstranite njene vnose.",
      failureDetails(req, "validation_failed", ["data.customCategories"]),
    );
    return;
  }
  const diagnosticBase = {
    ...submitRequestDiagnostic,
    requestedRevision: parsed.data.revision,
  };
  let result;
  try {
    result = await submitHostOnboarding(
      actor.tenantId,
      actor.hostUserId,
      requestedRound,
      parsed.data.revision,
      data,
      parsed.data.canonicalRevision,
    );
  } catch (error) {
    const failure = infrastructureFailure(error, "submit_failed");
    req.log.error(
      {
        ...diagnosticBase,
        outcome: "failed",
        reasonCode: failure.reasonCode,
        ...failure.diagnostic,
      },
      "Host onboarding submit infrastructure failure",
    );
    fail(
      res,
      500,
      "Oddaja trenutno ni uspela. Poskusite znova.",
      failureDetails(req, failure.reasonCode),
    );
    return;
  }
  if (!result.ok) {
    const reasonCode: HostOnboardingFailureReason = result.kind === "stale"
      ? "stale_revision"
      : result.kind === "missing"
        ? "session_unavailable"
        : result.kind === "invalid_custom_category" || result.kind === "wrong_round"
          ? "validation_failed"
          : "submit_failed";
    req.log.warn(
      {
        ...diagnosticBase,
        outcome: "rejected",
        reasonCode,
        reason: result.kind === "stale" ? result.staleReason : result.kind,
        currentRevision: result.currentRevision,
      },
      "Host onboarding submit rejected",
    );
    const messages = {
      missing: "Obrazec za to namestitev še ni odprt.",
      wrong_round: "Krog obrazca ni veljaven.",
      stale: "Osnutek je bil medtem spremenjen. Osvežite obrazec in poskusite znova.",
      photo_uploading: "Počakajte, da se nalaganje fotografij konča.",
      invalid_custom_category: "Vnesite ime svoje kategorije ali odstranite njene vnose.",
    } as const;
    fail(res, result.kind === "missing" ? 404 : 409, messages[result.kind], {
      ...failureDetails(
        req,
        reasonCode,
        result.kind === "invalid_custom_category"
          ? ["data.customCategories"]
          : result.kind === "wrong_round"
            ? ["round"]
            : undefined,
      ),
      ...(result.currentRevision ? { currentRevision: result.currentRevision } : {}),
    });
    return;
  }
  if (result.recommendationProcessing?.status === "failed") {
    req.log.warn(
      {
        ...diagnosticBase,
        outcome: "recommendation_processing_failed",
        recommendationRevision: result.recommendationProcessing.revision,
        errorCode: result.recommendationProcessing.errorCode,
        statusPersistence: result.recommendationProcessing.statusPersistence,
        persistenceErrorCode: result.recommendationProcessing.persistenceErrorCode,
      },
      "Host onboarding recommendation processing failed after submit committed",
    );
  }
  req.log.info(
    { ...diagnosticBase, outcome: result.alreadySubmitted ? "replayed" : "submitted" },
    "Host onboarding submit completed",
  );
  res.json({
    ok: true,
    alreadySubmitted: result.alreadySubmitted,
    recommendationProcessing: result.recommendationProcessing,
    message: "Hvala! Vaš vodnik pripravljamo — obvestili vas bomo, ko bo pripravljen za pregled.",
  });
});

router.post("/admin/host/onboarding/photos/upload-url", async (req, res): Promise<void> => {
  const actor = hostActor(req, res);
  if (!actor) return;
  const parsed = AllocateHostOnboardingPhotoUploadBody.safeParse(req.body);
  if (
    !parsed.success ||
    !parsed.data.fileName.trim() ||
    !Number.isInteger(parsed.data.size)
  ) {
    fail(res, 400, "Izberite veljavno sliko do 20 MB.");
    return;
  }
  const photoId = randomUUID();
  const allocation = await db.transaction(async (tx) => {
    const [round] = await tx
      .select()
      .from(hostOnboardingRoundsTable)
      .where(and(
        eq(hostOnboardingRoundsTable.tenantId, actor.tenantId),
        eq(hostOnboardingRoundsTable.hostUserId, actor.hostUserId),
        eq(hostOnboardingRoundsTable.status, "draft"),
      ))
      .limit(1)
      .for("update");
    if (!round) return null;
    const [{ count }] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(hostOnboardingPhotosTable)
      .where(eq(hostOnboardingPhotosTable.onboardingId, round.id));
    if (Number(count) >= 20) return { full: true as const };
    const objectPath = hostOnboardingRawObjectPath(actor.tenantId, round.id, photoId);
    await tx.insert(hostOnboardingPhotosTable).values({
      id: photoId,
      onboardingId: round.id,
      tenantId: actor.tenantId,
      objectPath,
      fileName: parsed.data.fileName.replace(/[^\p{L}\p{N}_. -]+/gu, "_"),
      contentType: parsed.data.contentType,
      expectedSize: parsed.data.size,
    });
    return { full: false as const, objectPath };
  });
  if (!allocation) {
    fail(res, 404, "Aktivni osnutek ne obstaja.");
    return;
  }
  if (allocation.full) {
    fail(res, 409, "Dodate lahko največ 20 fotografij.");
    return;
  }
  try {
    const uploadUrl = await storage.getObjectEntityUploadURLForPath(allocation.objectPath);
    res.status(201).json({ uploadUrl, objectPath: allocation.objectPath, photoId });
  } catch (error) {
    await db.delete(hostOnboardingPhotosTable).where(eq(hostOnboardingPhotosTable.id, photoId));
    req.log.error({ err: error }, "host onboarding staged upload signing failed");
    fail(res, 503, "Povezave za nalaganje trenutno ni mogoče pripraviti.");
  }
});

router.post("/admin/host/onboarding/photos/:photoId/complete", async (req, res): Promise<void> => {
  const actor = hostActor(req, res);
  if (!actor) return;
  const photoId = String(req.params["photoId"] ?? "");
  if (!UUID_RE.test(photoId)) {
    fail(res, 404, "Fotografija ne obstaja.");
    return;
  }
  let rawPath: string | null = null;
  let finalPath: string | null = null;
  try {
    const updated = await db.transaction(async (tx) => {
      // The row lock serializes concurrent completion attempts. A waiter sees
      // the ready row and returns it without decoding or writing another key.
      const [photo] = await tx
        .select()
        .from(hostOnboardingPhotosTable)
        .where(and(
          eq(hostOnboardingPhotosTable.id, photoId),
          eq(hostOnboardingPhotosTable.tenantId, actor.tenantId),
        ))
        .limit(1)
        .for("update");
      if (!photo) return null;
      if (photo.status === "ready") return photo;
      if (photo.status !== "uploading") throw new Error("immutable_photo");

      rawPath = hostOnboardingRawObjectPath(
        actor.tenantId,
        photo.onboardingId,
        photo.id,
      );
      finalPath = hostOnboardingSanitizedObjectPath(
        actor.tenantId,
        photo.onboardingId,
        photo.id,
      );
      if (photo.objectPath !== rawPath || finalPath === rawPath) {
        throw new Error("invalid_object_path");
      }

      const rawFile = await storage.getObjectEntityFile(rawPath);
      const [metadata] = await rawFile.getMetadata();
      const actualUploadSize = Number(metadata.size ?? 0);
      if (
        !Number.isSafeInteger(actualUploadSize) ||
        actualUploadSize <= 0 ||
        actualUploadSize > MAX_PHOTO_BYTES ||
        actualUploadSize !== photo.expectedSize
      ) {
        throw new Error("size_mismatch");
      }
      const [original] = await rawFile.download();
      const source = sharp(original).rotate();
      const metadataDecoded = await source.metadata();
      if (
        !metadataDecoded.width ||
        !metadataDecoded.height ||
        metadataDecoded.width * metadataDecoded.height > 60_000_000
      ) {
        throw new Error("invalid_dimensions");
      }
      const stripped = await source
        .resize({ width: 2400, height: 2400, fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: 82, mozjpeg: true })
        .toBuffer();
      const outputMeta = await sharp(stripped).metadata();
      const finalFile = storage.getHostOnboardingSanitizedFileForWrite(finalPath);
      // Private-object directory, no public ACL, and no signed URL for this key.
      await finalFile.save(stripped, {
        contentType: "image/jpeg",
        metadata: { cacheControl: "private, no-store" },
        resumable: false,
      });
      const [ready] = await tx
        .update(hostOnboardingPhotosTable)
        .set({
          objectPath: finalPath,
          contentType: "image/jpeg",
          actualSize: stripped.length,
          width: outputMeta.width ?? null,
          height: outputMeta.height ?? null,
          status: "ready",
          completedAt: new Date(),
        })
        .where(and(
          eq(hostOnboardingPhotosTable.id, photo.id),
          eq(hostOnboardingPhotosTable.status, "uploading"),
          eq(hostOnboardingPhotosTable.objectPath, rawPath),
        ))
        .returning();
      if (!ready) throw new Error("completion_cas_failed");
      await rawFile.delete({ ignoreNotFound: true });
      return ready;
    });
    if (!updated) {
      fail(res, 404, "Fotografija ne obstaja.");
      return;
    }
    await materializeReadyPhoto(actor.tenantId, updated);
    res.json(photoDto(updated, `/api/admin/host/onboarding/photos/${updated.id}`));
  } catch (error) {
    for (const path of [rawPath, finalPath]) {
      if (!path) continue;
      const file = await storage.getObjectEntityFile(path).catch(() => null);
      if (file) await file.delete({ ignoreNotFound: true }).catch(() => {});
    }
    await db.delete(hostOnboardingPhotosTable).where(and(
      eq(hostOnboardingPhotosTable.id, photoId),
      eq(hostOnboardingPhotosTable.tenantId, actor.tenantId),
      eq(hostOnboardingPhotosTable.status, "uploading"),
    ));
    req.log.warn({ err: error }, "host onboarding staged upload rejected");
    fail(res, 400, "Datoteka ni veljavna slika ali pa se njena velikost ne ujema.");
  }
});

router.delete("/admin/host/onboarding/photos/:photoId", async (req, res): Promise<void> => {
  const actor = hostActor(req, res);
  if (!actor) return;
  const photoId = String(req.params["photoId"] ?? "");
  if (!UUID_RE.test(photoId)) {
    fail(res, 404, "Fotografija ne obstaja.");
    return;
  }
  const [photo] = await db
    .delete(hostOnboardingPhotosTable)
    .where(and(
      eq(hostOnboardingPhotosTable.id, photoId),
      eq(hostOnboardingPhotosTable.tenantId, actor.tenantId),
      sql`${hostOnboardingPhotosTable.status} IN ('uploading','ready')`,
    ))
    .returning();
  if (!photo) {
    fail(res, 409, "Oddane fotografije ni mogoče odstraniti.");
    return;
  }
  await db.delete(mediaTable).where(and(
    eq(mediaTable.tenantId, actor.tenantId),
    eq(mediaTable.provenanceJson, onboardingPhotoProvenance(photo.id)),
  ));
  await db.update(tenantsTable).set({ hasUnpublishedChanges: true })
    .where(eq(tenantsTable.id, actor.tenantId));
  const file = await storage.getObjectEntityFile(photo.objectPath).catch(() => null);
  if (file) await file.delete({ ignoreNotFound: true });
  const counterpart = hostOnboardingObjectCounterpart(photo.objectPath);
  if (counterpart) {
    const counterpartFile = await storage.getObjectEntityFile(counterpart).catch(() => null);
    if (counterpartFile) await counterpartFile.delete({ ignoreNotFound: true });
  }
  res.status(204).end();
});

async function streamPhoto(req: Request, res: Response, tenantId: string): Promise<void> {
  const photoId = String(req.params["photoId"] ?? "");
  if (!UUID_RE.test(photoId)) {
    fail(res, 404, "Fotografija ne obstaja.");
    return;
  }
  const [photo] = await db
    .select()
    .from(hostOnboardingPhotosTable)
    .where(and(
      eq(hostOnboardingPhotosTable.id, photoId),
      eq(hostOnboardingPhotosTable.tenantId, tenantId),
      sql`${hostOnboardingPhotosTable.status} IN ('ready','submitted')`,
    ));
  if (!photo) {
    fail(res, 404, "Fotografija ne obstaja.");
    return;
  }
  try {
    const file = await storage.getObjectEntityFile(photo.objectPath);
    const [metadata] = await file.getMetadata();
    res.setHeader("Content-Type", String(metadata.contentType ?? "image/jpeg"));
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    file.createReadStream().pipe(res);
  } catch (error) {
    req.log.error({ err: error }, "host onboarding staged photo stream failed");
    if (!res.headersSent) fail(res, 404, "Fotografije ni mogoče prebrati.");
  }
}

router.get("/admin/host/onboarding/photos/:photoId", async (req, res): Promise<void> => {
  const actor = hostActor(req, res);
  if (!actor) return;
  await streamPhoto(req, res, actor.tenantId);
});

router.get(
  "/admin/tenants/:id/host/onboarding",
  requireAdmin,
  async (req, res): Promise<void> => {
    const tenantId = tenantIdParam(req, res);
    if (!tenantId) return;
    const result = await ownerHostOnboarding(tenantId);
    if (!result) {
      fail(res, 404, "Namestitev ne obstaja.");
      return;
    }
    res.json({
      tenantId: result.tenant.id,
      tenantName: result.tenant.name,
      rounds: result.rounds.map(({ round, photos, events }) => ({
        id: round.id,
        round: round.round,
        revision: round.revision,
        status: round.status,
        data: round.draftData,
        targetReview: round.targetReview,
        recommendations: round.recommendationReview.filter((entry) => !entry.hostCreated),
        customCategories: round.draftData.customCategories
          .filter((category) => category.name.trim())
          .map((category) => {
            const categoryReview = round.recommendationReview.find((entry) =>
              entry.hostCreated && entry.customCategoryId === category.id
            );
            return {
              id: category.id,
              name: category.name.trim(),
              hostCreated: true as const,
              provenance: HOST_ONBOARDING_PROVENANCE,
              categoryId: categoryReview?.categoryId ?? null,
              entries: category.entries
                .filter((entry) => entry.name.trim())
                .map((entry) => ({
                  id: entry.id,
                  name: entry.name.trim(),
                  proposalId: round.recommendationReview.find((review) =>
                    review.hostCreated &&
                    review.customCategoryId === category.id &&
                    review.customEntryId === entry.id
                  )?.proposalId ?? null,
                  itemId: round.recommendationReview.find((review) =>
                    review.hostCreated && review.customCategoryId === category.id &&
                    review.customEntryId === entry.id
                  )?.itemId ?? null,
                  materializationStatus: round.recommendationReview.find((review) =>
                    review.hostCreated && review.customCategoryId === category.id &&
                    review.customEntryId === entry.id
                  )?.materializationStatus ?? null,
                  existingArchived: round.recommendationReview.find((review) =>
                    review.hostCreated && review.customCategoryId === category.id &&
                    review.customEntryId === entry.id
                  )?.existingArchived ?? false,
                  provenance: HOST_ONBOARDING_PROVENANCE,
                })),
            };
          }),
        events: events.map((event) => ({
          id: event.id,
          name: event.name,
          date: event.eventDate,
          time: event.eventTime,
          status: event.status,
        })),
        photos: photos.map((photo) =>
          photoDto(
            photo,
            `/api/admin/tenants/${tenantId}/host/onboarding/photos/${photo.id}`,
          ),
        ),
        notification: {
          status: round.notificationStatus === "not_admitted"
            ? "pending"
            : round.notificationStatus,
          recipient: round.notificationRecipient ?? HOST_ONBOARDING_OPERATOR_EMAIL,
          providerMessageId: round.notificationProviderMessageId,
          error: round.notificationError,
          attemptedAt: round.notificationAttemptedAt?.toISOString() ?? null,
        },
        createdAt: round.createdAt.toISOString(),
        updatedAt: round.updatedAt.toISOString(),
        submittedAt: round.submittedAt?.toISOString() ?? null,
      })),
    });
  },
);

for (const action of ["open", "reopen"] as const) {
  router.post(
    `/admin/tenants/:id/host/onboarding/${action}`,
    requireAdmin,
    async (req, res): Promise<void> => {
      const tenantId = tenantIdParam(req, res);
      if (!tenantId) return;
      const round = await openHostOnboarding(tenantId, action === "reopen");
      if (!round) {
        fail(res, 409, "Namestitev še nima gostiteljskega računa.");
        return;
      }
      res.status(201).json({
        id: round.id,
        round: round.round,
        revision: round.revision,
        status: round.status,
      });
    },
  );
}

router.get(
  "/admin/tenants/:id/host/onboarding/photos/:photoId",
  requireAdmin,
  async (req, res): Promise<void> => {
    const tenantId = tenantIdParam(req, res);
    if (!tenantId) return;
    await streamPhoto(req, res, tenantId);
  },
);

export default router;