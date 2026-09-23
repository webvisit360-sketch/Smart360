/**
 * Workspace-loopback bridge for one combined browser verification.
 *
 * It invokes the real onboarding and place-search services, but binds every
 * request to one disposable tenant. It is not imported by the application and
 * exposes no production route.
 */
import { chmod, readFile, rename, rm, writeFile } from "node:fs/promises";
import express from "express";
import {
  adminUsersTable,
  categoriesTable,
  creatorPlaceProposalsTable,
  db,
  itemsTable,
  mediaTable,
  pool,
  publishedSnapshotsTable,
  sectionsTable,
  tenantsTable,
} from "@workspace/db";
import {
  CreateCategoryBody,
  CreateCategoryResponse,
  GetTenantResponse,
  PreviewTenantPublicationResponse,
} from "@workspace/api-zod";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { actorStorage, type Actor } from "../../lib/actorContext";
import { createAdminPlace, searchAdminPlaces } from "../../lib/adminPlaceCreation";
import { createCategoryWithTooling } from "../../lib/categoryTooling";
import { logChange } from "../../lib/changelog";
import { buildTenantContent } from "../../lib/contentTree";
import { guestQrSvg, guestUrl } from "../../lib/guestUrl";
import {
  currentHostOnboarding,
  saveHostOnboarding,
  submitHostOnboarding,
} from "../../lib/hostOnboarding";
import { _setHostOnboardingDeliveryOverride } from "../../lib/hostOnboardingEmail";
import { logger } from "../../lib/logger";
import { previewPublication } from "../../lib/publishedSnapshots";
import {
  ObjectStorageService,
  objectStorageClient,
} from "../../lib/objectStorage";
import { isWhatsappConfigured } from "../../lib/whatsapp";
import hostOnboardingRouter, { hostDto } from "../../routes/hostOnboarding";
import storageRouter, { VIDEO_MAX_BYTES } from "../../routes/storage";
import {
  canonicalFixtureDigest,
  cleanupCanonicalOnboardingFixture,
  createCanonicalOnboardingFixture,
  type CanonicalOnboardingFixture,
} from "../helpers/canonicalOnboardingFixture";

const STATE_PATH = "/tmp/canonical-onboarding-browser-fixture.json";
const allowedModes = new Set(["setup", "serve", "inspect", "cleanup"]);

type HarnessState = {
  version: 2;
  fixture: CanonicalOnboardingFixture;
  reviewerId: string;
  publishedDigest: string;
};

function guardEnvironment(): void {
  if (process.env.NODE_ENV !== "development") {
    throw new Error("Refusing: NODE_ENV must be development");
  }
  if (process.env.REPLIT_DEPLOYMENT || process.env.REPLIT_DEPLOYMENT_ID) {
    throw new Error("Refusing: deployment environment detected");
  }
  if (!process.env.DATABASE_URL) throw new Error("Refusing: DATABASE_URL is unavailable");
}

async function state(): Promise<HarnessState> {
  const parsed = JSON.parse(await readFile(STATE_PATH, "utf8")) as HarnessState;
  if (
    parsed.version !== 2 ||
    !parsed.fixture?.marker?.startsWith("canonical-onboarding-fixture-") ||
    !parsed.fixture.tenantSlug?.startsWith("cofx-") ||
    !parsed.reviewerId
  ) {
    throw new Error("Refusing: invalid fixture state");
  }
  return parsed;
}

async function setup(): Promise<void> {
  try {
    await readFile(STATE_PATH);
    throw new Error("Fixture state already exists; inspect or cleanup first");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  const [reviewer] = await db.select({ id: adminUsersTable.id }).from(adminUsersTable).limit(1);
  if (!reviewer) {
    throw new Error("An existing development reviewer row is required read-only");
  }
  const fixture = await createCanonicalOnboardingFixture();
  const apartCategoryId = fixture.categoryIds["apart"];
  if (!apartCategoryId) {
    await cleanupCanonicalOnboardingFixture(fixture);
    throw new Error("Fixture Apartmaji category is missing");
  }
  const existingApartItems = await db.select({ id: itemsTable.id }).from(itemsTable)
    .where(eq(itemsTable.categoryId, apartCategoryId));
  if (existingApartItems.length) {
    await cleanupCanonicalOnboardingFixture(fixture);
    throw new Error("Fixture Apartmaji category must initially be empty");
  }
  const value: HarnessState = {
    version: 2,
    fixture,
    reviewerId: reviewer.id,
    publishedDigest: canonicalFixtureDigest(fixture.publishedContent),
  };
  const temporary = `${STATE_PATH}.${process.pid}`;
  await writeFile(temporary, `${JSON.stringify(value)}\n`, { mode: 0o600, flag: "wx" });
  await chmod(temporary, 0o600);
  await rename(temporary, STATE_PATH);
  await chmod(STATE_PATH, 0o600);
  console.log(JSON.stringify({
    command: "setup",
    tenantId: fixture.tenantId,
    tenantSlug: fixture.tenantSlug,
    statePath: STATE_PATH,
    ownerAccountCreated: false,
    hostAccountScope: "disposable fixture tenant only",
  }));
}

async function inspect(): Promise<void> {
  const value = await state();
  const [snapshot] = await db.select({ content: publishedSnapshotsTable.content })
    .from(publishedSnapshotsTable)
    .where(eq(publishedSnapshotsTable.tenantId, value.fixture.tenantId));
  if (!snapshot || canonicalFixtureDigest(snapshot.content) !== value.publishedDigest) {
    throw new Error("Published snapshot changed during browser verification");
  }
  const current = await currentHostOnboarding(value.fixture.tenantId, value.fixture.hostUserId);
  if (!current) throw new Error("Fixture onboarding round is missing");
  const creatorQueue = await db.select({
    proposedName: creatorPlaceProposalsTable.proposedName,
    status: creatorPlaceProposalsTable.status,
    categoryId: creatorPlaceProposalsTable.categoryId,
  }).from(creatorPlaceProposalsTable)
    .where(eq(creatorPlaceProposalsTable.tenantId, value.fixture.tenantId));
  const apartCategoryId = value.fixture.categoryIds["apart"];
  if (!apartCategoryId) throw new Error("Fixture Apartmaji category is missing");
  const apartItems = await db.select({
    id: itemsTable.id,
    title: itemsTable.title,
  }).from(itemsTable).where(eq(itemsTable.categoryId, apartCategoryId));
  const apartMedia = apartItems.length
    ? await db.select({
        id: mediaTable.id,
        itemId: mediaTable.itemId,
        kind: mediaTable.kind,
        url: mediaTable.url,
        position: mediaTable.position,
      }).from(mediaTable).where(inArray(
        mediaTable.itemId,
        apartItems.map((item) => item.id),
      ))
    : [];
  const customCategories = await db.select({
    id: categoriesTable.id,
    key: categoriesTable.key,
    label: categoriesTable.label,
    sectionKey: sectionsTable.key,
  }).from(categoriesTable)
    .innerJoin(sectionsTable, eq(categoriesTable.sectionId, sectionsTable.id))
    .where(and(
      eq(sectionsTable.tenantId, value.fixture.tenantId),
      isNull(categoriesTable.deletedAt),
    ));
  const publicationPreview = await previewPublication(value.fixture.tenantId);
  console.log(JSON.stringify({
    command: "inspect",
    publishedSnapshotUnchanged: true,
    currentRevision: current.round.revision,
    mediaCount: current.round.draftData.media?.length ?? 0,
    apartItems,
    apartMedia,
    creatorQueue,
    customCategories: customCategories.filter((category) =>
      !Object.values(value.fixture.categoryIds).includes(category.id)
    ),
    publicationPreview,
  }));
}

function parseObjectPath(path: string): { bucketName: string; objectName: string } {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  const parts = normalized.split("/");
  return {
    bucketName: parts[1] ?? "",
    objectName: parts.slice(2).join("/"),
  };
}

async function cleanupFixtureStorage(value: HarnessState): Promise<number> {
  const uploaded = await db.select({ url: mediaTable.url })
    .from(mediaTable)
    .innerJoin(itemsTable, eq(mediaTable.itemId, itemsTable.id))
    .innerJoin(categoriesTable, eq(itemsTable.categoryId, categoriesTable.id))
    .innerJoin(sectionsTable, eq(categoriesTable.sectionId, sectionsTable.id))
    .where(eq(sectionsTable.tenantId, value.fixture.tenantId));
  if (!uploaded.some((row) => row.url.startsWith("/api/storage/"))) return 0;

  const storage = new ObjectStorageService();
  let deleted = 0;
  for (const searchPath of storage.getPublicObjectSearchPaths()) {
    const { bucketName, objectName } = parseObjectPath(
      `${searchPath}/media/${value.fixture.tenantSlug}/`,
    );
    const [files] = await objectStorageClient.bucket(bucketName).getFiles({
      prefix: objectName,
    });
    await Promise.all(files.map(async (file) => {
      await file.delete({ ignoreNotFound: true });
      deleted += 1;
    }));
  }
  return deleted;
}

async function cleanup(): Promise<void> {
  const value = await state();
  const [snapshot] = await db.select({ content: publishedSnapshotsTable.content })
    .from(publishedSnapshotsTable)
    .where(eq(publishedSnapshotsTable.tenantId, value.fixture.tenantId));
  if (!snapshot || canonicalFixtureDigest(snapshot.content) !== value.publishedDigest) {
    throw new Error("Refusing cleanup because the published snapshot changed");
  }
  const storageObjectsDeleted = await cleanupFixtureStorage(value);
  await cleanupCanonicalOnboardingFixture(value.fixture);
  await rm(STATE_PATH);
  console.log(JSON.stringify({
    command: "cleanup",
    fixtureTenantsRemaining: 0,
    fixtureHostUsersRemaining: 0,
    storageObjectsDeleted,
  }));
}

function publicFixture(value: HarnessState) {
  return {
    tenantId: value.fixture.tenantId,
    tenantSlug: value.fixture.tenantSlug,
    categoryIds: value.fixture.categoryIds,
    apartCategoryId: value.fixture.categoryIds["apart"],
    itemIds: value.fixture.itemIds,
    mediaIds: value.fixture.mediaIds,
  };
}

async function fixtureSection(
  tenantId: string,
  sectionId: string,
): Promise<{ id: string; key: string }> {
  const [section] = await db.select({
    id: sectionsTable.id,
    key: sectionsTable.key,
  }).from(sectionsTable).where(and(
    eq(sectionsTable.id, sectionId),
    eq(sectionsTable.tenantId, tenantId),
  )).limit(1);
  if (!section || !["stay", "offer"].includes(section.key)) {
    throw new Error("Section is outside the disposable stay/offer fixture");
  }
  return section;
}

async function adminTenantDto(tenantId: string) {
  const [tenant] = await db.select().from(tenantsTable)
    .where(eq(tenantsTable.id, tenantId)).limit(1);
  if (!tenant) throw new Error("Fixture tenant is missing");
  const tree = await buildTenantContent(tenant, { visibleOnly: false });
  const publicUrl = guestUrl(tenant.slug);
  const qrSvg = await guestQrSvg(publicUrl);
  return GetTenantResponse.parse(JSON.parse(JSON.stringify({
    ...tree,
    whatsappConfigured: isWhatsappConfigured(),
    publicUrl,
    qrSvg,
  })));
}

async function serve(): Promise<void> {
  const value = await state();
  const app = express();
  app.disable("x-powered-by");
  app.use((request, response, next) => {
    if (request.ip !== "127.0.0.1" && request.ip !== "::ffff:127.0.0.1" && request.ip !== "::1") {
      response.status(403).json({ error: "Loopback only" });
      return;
    }
    next();
  });
  const port = Number(process.env.CANONICAL_FIXTURE_PORT ?? 9137);

  /**
   * Remote browser interception cannot forward multipart bytes directly to a
   * workspace-loopback service. The interceptor base64-encodes the selected
   * file and calls this adapter; it reconstructs multipart and sends it
   * through the real storage router mounted below.
   */
  app.post(
    "/bridge/admin/items/:id/media/upload",
    express.json({ limit: "135mb" }),
    async (request, response, next) => {
      try {
        const filename = request.body?.filename;
        const mimeType = request.body?.mimeType;
        const encoded = request.body?.base64;
        if (
          typeof filename !== "string" ||
          !filename.trim() ||
          typeof mimeType !== "string" ||
          !mimeType.trim() ||
          typeof encoded !== "string" ||
          !encoded.length ||
          !/^[A-Za-z0-9+/]*={0,2}$/.test(encoded)
        ) {
          response.status(400).json({
            error: "filename, mimeType and valid base64 are required",
          });
          return;
        }
        const bytes = Buffer.from(encoded, "base64");
        if (!bytes.length || bytes.length > VIDEO_MAX_BYTES) {
          response.status(400).json({
            error: "file exceeds the upload limit or is empty",
          });
          return;
        }
        const form = new FormData();
        form.append("file", new Blob([bytes], { type: mimeType }), filename);
        const itemId = encodeURIComponent(String(request.params["id"] ?? ""));
        const upstream = await fetch(
          `http://127.0.0.1:${port}/_real/admin/items/${itemId}/media/upload`,
          { method: "POST", body: form },
        );
        response.status(upstream.status);
        response.set(
          "Content-Type",
          upstream.headers.get("content-type") ?? "application/json",
        );
        response.send(Buffer.from(await upstream.arrayBuffer()));
      } catch (error) {
        next(error);
      }
    },
  );

  app.use(express.json({ limit: "256kb" }));
  app.get("/fixture", (_request, response) => response.json(publicFixture(value)));
  app.get("/host/session", (_request, response) => response.json({
    authenticated: true,
    onboardingRequired: true,
    host: {
      id: value.fixture.hostUserId,
      tenantId: value.fixture.tenantId,
      tenantName: "Operaterjev trenutni osnutek",
    },
  }));
  app.get("/admin/tenant", async (_request, response, next) => {
    try {
      response.set("Cache-Control", "no-store");
      response.json(await adminTenantDto(value.fixture.tenantId));
    } catch (error) {
      next(error);
    }
  });
  app.get("/admin/publish-preview", async (_request, response, next) => {
    try {
      response.set("Cache-Control", "no-store");
      response.json(PreviewTenantPublicationResponse.parse(
        await previewPublication(value.fixture.tenantId),
      ));
    } catch (error) {
      next(error);
    }
  });
  app.post("/admin/sections/:id/categories", async (request, response, next) => {
    try {
      const section = await fixtureSection(
        value.fixture.tenantId,
        String(request.params.id ?? ""),
      );
      const parsed = CreateCategoryBody.safeParse(request.body);
      if (!parsed.success) {
        response.status(400).json({ error: parsed.error.message });
        return;
      }
      const category = await actorStorage.run(
        { kind: "owner", requestIp: request.ip },
        async () => {
          const created = await createCategoryWithTooling(db, section.id, parsed.data);
          await logChange({
            tenantId: value.fixture.tenantId,
            tenantName: null,
            action: "create",
            entity: "category",
            detail: parsed.data.label,
            summary: `Ustvarjena kategorija · ${created.label}`,
            operationKey: `category-create:${created.id}`,
          });
          await db.update(tenantsTable).set({ hasUnpublishedChanges: true })
            .where(eq(tenantsTable.id, value.fixture.tenantId));
          return created;
        },
      );
      response.status(201).json(CreateCategoryResponse.parse(category));
    } catch (error) {
      next(error);
    }
  });
  app.get("/host/onboarding", async (_request, response, next) => {
    try {
      const current = await currentHostOnboarding(value.fixture.tenantId, value.fixture.hostUserId);
      if (!current) {
        response.status(404).json({ error: "Fixture round missing" });
        return;
      }
      response.json(hostDto(current));
    } catch (error) {
      next(error);
    }
  });
  app.patch("/host/onboarding", async (request, response, next) => {
    try {
      const revision = Number(request.body?.revision);
      const result = await saveHostOnboarding(
        value.fixture.tenantId,
        value.fixture.hostUserId,
        revision,
        request.body?.data ?? {},
        String(request.body?.canonicalRevision ?? ""),
      );
      if (!result.ok) {
        response.status(result.kind === "stale" ? 409 : 400).json(result);
        return;
      }
      const current = await currentHostOnboarding(value.fixture.tenantId, value.fixture.hostUserId);
      if (!current) {
        response.status(404).json({ error: "Fixture round missing" });
        return;
      }
      const dto = hostDto(current);
      response.json({
        ok: true,
        revision: dto.revision,
        canonicalRevision: dto.canonicalRevision,
        updatedAt: dto.updatedAt,
        data: dto.data,
        photos: dto.photos,
        categories: dto.categories,
        contentSections: dto.contentSections,
      });
    } catch (error) {
      next(error);
    }
  });
  app.post("/host/onboarding/submit", async (request, response, next) => {
    try {
      const current = await currentHostOnboarding(value.fixture.tenantId, value.fixture.hostUserId);
      if (!current) {
        response.status(404).json({ error: "Fixture round missing" });
        return;
      }
      _setHostOnboardingDeliveryOverride(async () => ({
        ok: true,
        providerMessageId: "browser-fixture-no-email",
      }));
      const result = await submitHostOnboarding(
        value.fixture.tenantId,
        value.fixture.hostUserId,
        current.round.round,
        Number(request.body?.revision),
        request.body?.data,
        String(request.body?.canonicalRevision ?? ""),
      );
      response.status(result.ok ? 200 : result.kind === "stale" ? 409 : 400).json(result);
    } catch (error) {
      next(error);
    } finally {
      _setHostOnboardingDeliveryOverride(null);
    }
  });
  app.get("/admin/place-search", async (request, response, next) => {
    try {
      const categoryId = String(request.query.categoryId ?? "");
      if (!Object.values(value.fixture.categoryIds).includes(categoryId)) {
        response.status(403).json({ error: "Category is outside the disposable fixture" });
        return;
      }
      response.json(await searchAdminPlaces(categoryId, String(request.query.q ?? "")));
    } catch (error) {
      next(error);
    }
  });
  app.post("/admin/place-create", async (request, response, next) => {
    try {
      const categoryId = String(request.body?.categoryId ?? "");
      if (!Object.values(value.fixture.categoryIds).includes(categoryId)) {
        response.status(403).json({ error: "Category is outside the disposable fixture" });
        return;
      }
      response.json(await createAdminPlace({
        categoryId,
        actorId: value.reviewerId,
        selection: request.body?.selection,
      }));
    } catch (error) {
      next(error);
    }
  });
  app.patch("/admin/items/:id", async (request, response, next) => {
    try {
      const id = String(request.params.id ?? "");
      const fixtureItemIds = [
        value.fixture.itemIds.welcome,
        ...value.fixture.itemIds.contacts,
        value.fixture.itemIds.check,
        value.fixture.itemIds.house,
        value.fixture.itemIds.park,
        value.fixture.itemIds.offer,
        value.fixture.itemIds.customOffer,
        value.fixture.itemIds.event,
      ];
      if (!fixtureItemIds.includes(id)) {
        response.status(403).json({ error: "Item is outside the disposable fixture" });
        return;
      }
      const patch: { title?: string | null; body?: string | null } = {};
      if (request.body?.title !== undefined) {
        if (typeof request.body.title !== "string") throw new Error("title must be a string");
        patch.title = request.body.title || null;
      }
      if (request.body?.body !== undefined) {
        if (typeof request.body.body !== "string") throw new Error("body must be a string");
        patch.body = request.body.body || null;
      }
      if (!Object.keys(patch).length) throw new Error("title or body is required");
      const [updated] = await db.update(itemsTable).set(patch)
        .where(eq(itemsTable.id, id)).returning();
      if (!updated) throw new Error("Fixture item is missing");
      await db.update(tenantsTable).set({ hasUnpublishedChanges: true })
        .where(eq(tenantsTable.id, value.fixture.tenantId));
      response.json(updated);
    } catch (error) {
      next(error);
    }
  });
  app.patch("/admin/media/:id", async (request, response, next) => {
    try {
      const id = String(request.params.id ?? "");
      if (!Object.values(value.fixture.mediaIds).includes(id)) {
        response.status(403).json({ error: "Media is outside the disposable fixture" });
        return;
      }
      if (typeof request.body?.alt !== "string") throw new Error("alt must be a string");
      const [updated] = await db.update(mediaTable).set({ alt: request.body.alt || null })
        .where(eq(mediaTable.id, id)).returning();
      if (!updated) throw new Error("Fixture media is missing");
      await db.update(tenantsTable).set({ hasUnpublishedChanges: true })
        .where(eq(tenantsTable.id, value.fixture.tenantId));
      response.json(updated);
    } catch (error) {
      next(error);
    }
  });
  app.patch("/admin/categories/:id", async (request, response, next) => {
    try {
      const id = String(request.params.id ?? "");
      if (!Object.values(value.fixture.categoryIds).includes(id)) {
        response.status(403).json({ error: "Category is outside the disposable fixture" });
        return;
      }
      if (typeof request.body?.label !== "string" || !request.body.label.trim()) {
        throw new Error("label must be a non-empty string");
      }
      const [updated] = await db.update(categoriesTable).set({ label: request.body.label.trim() })
        .where(eq(categoriesTable.id, id)).returning();
      if (!updated) throw new Error("Fixture category is missing");
      await db.update(tenantsTable).set({ hasUnpublishedChanges: true })
        .where(eq(tenantsTable.id, value.fixture.tenantId));
      response.json(updated);
    } catch (error) {
      next(error);
    }
  });
  app.patch("/admin/sections/:id", async (request, response, next) => {
    try {
      const id = String(request.params.id ?? "");
      const tenantSections = await db.select({ id: sectionsTable.id }).from(sectionsTable)
        .where(eq(sectionsTable.tenantId, value.fixture.tenantId));
      if (!tenantSections.some((section) => section.id === id)) {
        response.status(403).json({ error: "Section is outside the disposable fixture" });
        return;
      }
      if (typeof request.body?.title !== "string" || !request.body.title.trim()) {
        throw new Error("title must be a non-empty string");
      }
      const [updated] = await db.update(sectionsTable).set({ title: request.body.title.trim() })
        .where(eq(sectionsTable.id, id)).returning();
      if (!updated) throw new Error("Fixture section is missing");
      await db.update(tenantsTable).set({ hasUnpublishedChanges: true })
        .where(eq(tenantsTable.id, value.fixture.tenantId));
      response.json(updated);
    } catch (error) {
      next(error);
    }
  });
  app.use(
    "/_real-host",
    (request, response, next) => {
      if (
        request.method !== "POST" ||
        request.path !== "/admin/host/onboarding/categories"
      ) {
        response.status(404).json({ error: "Fixture route not found" });
        return;
      }
      const actor: Actor = {
        kind: "host",
        hostUserId: value.fixture.hostUserId,
        tenantId: value.fixture.tenantId,
        requestIp: request.ip,
      };
      request.actor = actor;
      request.log = logger.child({ fixture: value.fixture.marker });
      actorStorage.run(actor, next);
    },
    hostOnboardingRouter,
  );
  app.use(
    "/_real",
    async (request, response, next) => {
      try {
        const match = request.method === "POST"
          ? /^\/admin\/items\/([^/]+)\/media\/upload$/.exec(request.path)
          : null;
        if (!match) {
          response.status(404).json({ error: "Fixture route not found" });
          return;
        }
        const itemId = decodeURIComponent(match[1] ?? "");
        const [owned] = await db.select({ tenantId: sectionsTable.tenantId })
          .from(itemsTable)
          .innerJoin(categoriesTable, eq(itemsTable.categoryId, categoriesTable.id))
          .innerJoin(sectionsTable, eq(categoriesTable.sectionId, sectionsTable.id))
          .where(eq(itemsTable.id, itemId));
        if (!owned || owned.tenantId !== value.fixture.tenantId) {
          response.status(404).json({ error: "Item not found in disposable fixture" });
          return;
        }
        const actor: Actor = {
          kind: "host",
          hostUserId: value.fixture.hostUserId,
          tenantId: value.fixture.tenantId,
          requestIp: request.ip,
        };
        request.actor = actor;
        request.log = logger.child({ fixture: value.fixture.marker });
        actorStorage.run(actor, next);
      } catch (error) {
        next(error);
      }
    },
    storageRouter,
  );
  app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
    response.status(400).json({
      error: error instanceof Error ? error.message : "Fixture service failed",
    });
  });
  app.listen(port, "127.0.0.1", () => {
    console.log(JSON.stringify({
      command: "serve",
      origin: `http://127.0.0.1:${port}`,
      scope: value.fixture.tenantId,
      authentication: "simulated actor binding restricted to disposable fixture",
    }));
  });
}

async function main(): Promise<void> {
  guardEnvironment();
  const mode = process.argv[2] ?? "";
  if (!allowedModes.has(mode)) {
    throw new Error("Usage: canonical-onboarding-browser-harness.ts setup|serve|inspect|cleanup");
  }
  if (mode === "setup") await setup();
  else if (mode === "serve") await serve();
  else if (mode === "inspect") await inspect();
  else await cleanup();
  if (mode !== "serve") await pool.end();
}

main().catch((error: unknown) => {
  console.error(JSON.stringify({
    command: "failed",
    message: error instanceof Error ? error.message : "unknown failure",
  }));
  process.exitCode = 1;
});