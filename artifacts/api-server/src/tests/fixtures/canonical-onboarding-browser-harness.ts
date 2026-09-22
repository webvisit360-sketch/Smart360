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
  db,
  itemsTable,
  mediaTable,
  pool,
  publishedSnapshotsTable,
  tenantsTable,
} from "@workspace/db";
import { GetTenantResponse } from "@workspace/api-zod";
import { eq } from "drizzle-orm";
import { createAdminPlace, searchAdminPlaces } from "../../lib/adminPlaceCreation";
import { buildTenantContent } from "../../lib/contentTree";
import { guestQrSvg, guestUrl } from "../../lib/guestUrl";
import {
  currentHostOnboarding,
  saveHostOnboarding,
  submitHostOnboarding,
} from "../../lib/hostOnboarding";
import { _setHostOnboardingDeliveryOverride } from "../../lib/hostOnboardingEmail";
import { isWhatsappConfigured } from "../../lib/whatsapp";
import { hostDto } from "../../routes/hostOnboarding";
import {
  canonicalFixtureDigest,
  cleanupCanonicalOnboardingFixture,
  createCanonicalOnboardingFixture,
  type CanonicalOnboardingFixture,
} from "../helpers/canonicalOnboardingFixture";

const STATE_PATH = "/tmp/canonical-onboarding-browser-fixture.json";
const allowedModes = new Set(["setup", "serve", "inspect", "cleanup"]);

type HarnessState = {
  version: 1;
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
    parsed.version !== 1 ||
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
  const value: HarnessState = {
    version: 1,
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
  console.log(JSON.stringify({
    command: "inspect",
    publishedSnapshotUnchanged: true,
    currentRevision: current.round.revision,
    mediaCount: current.round.draftData.media?.length ?? 0,
  }));
}

async function cleanup(): Promise<void> {
  const value = await state();
  await cleanupCanonicalOnboardingFixture(value.fixture);
  await rm(STATE_PATH);
  console.log(JSON.stringify({
    command: "cleanup",
    fixtureTenantsRemaining: 0,
    fixtureHostUsersRemaining: 0,
  }));
}

function publicFixture(value: HarnessState) {
  return {
    tenantId: value.fixture.tenantId,
    tenantSlug: value.fixture.tenantSlug,
    categoryIds: value.fixture.categoryIds,
    itemIds: value.fixture.itemIds,
    mediaIds: value.fixture.mediaIds,
  };
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
  app.use(express.json({ limit: "256kb" }));
  app.use((request, response, next) => {
    if (request.ip !== "127.0.0.1" && request.ip !== "::ffff:127.0.0.1" && request.ip !== "::1") {
      response.status(403).json({ error: "Loopback only" });
      return;
    }
    next();
  });
  app.get("/fixture", (_request, response) => response.json(publicFixture(value)));
  app.get("/admin/tenant", async (_request, response, next) => {
    try {
      response.set("Cache-Control", "no-store");
      response.json(await adminTenantDto(value.fixture.tenantId));
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
  app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
    response.status(400).json({
      error: error instanceof Error ? error.message : "Fixture service failed",
    });
  });
  const port = Number(process.env.CANONICAL_FIXTURE_PORT ?? 9137);
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