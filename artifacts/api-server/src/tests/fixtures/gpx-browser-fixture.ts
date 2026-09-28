/**
 * Disposable development-only browser fixture. This is a CLI, never an API route.
 * Usage: NODE_ENV=development pnpm --filter @workspace/api-server exec tsx src/tests/fixtures/gpx-browser-fixture.ts create|repair|publish|cleanup
 * The browser signs in at /admin/login with the temporary host credentials in
 * /tmp/gpx-browser-fixture.json, then uploads synthetic-soca-route.gpx as cycling.
 */
import { randomBytes, randomUUID } from "node:crypto";
import { chmod, readFile, rename, rm, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { and, eq } from "drizzle-orm";
import {
  categoriesTable, db, hostMembershipsTable, hostUsersTable, itemsTable,
  pool, runWithDatabase, sectionsTable, tenantsTable, type Db,
} from "@workspace/db";
import { hashPassword } from "../../lib/hostAuth";
import { createHostOnboardingDraft, currentHostOnboarding } from "../../lib/hostOnboarding";
import { guestUrl } from "../../lib/guestUrl";
import { replacePublishedSnapshot, readPublishedContent } from "../../lib/publishedSnapshots";
import { seedTenantContent } from "../../lib/tenantSeeds";
import { invalidateTenantCache } from "../../routes/publicTenants";
import { ObjectStorageService, objectStorageClient } from "../../lib/objectStorage";

const STATE_PATH = "/tmp/gpx-browser-fixture.json";
const GPX_PATH = fileURLToPath(new URL("./synthetic-soca-route.gpx", import.meta.url));
type State = {
  version: 1;
  tenantId: string;
  slug: string;
  itemId: string;
  hostUserId: string;
  hostEmail: string;
  hostPassword: string;
  hostFormPath: "/admin/login";
  hostOnboardingPath: "/admin/onboarding";
  hostEditorPath: string;
  guestUrl: string;
  gpxFixturePath: string;
};

async function guard(): Promise<void> {
  if (process.env.NODE_ENV !== "development" || process.env.REPLIT_DEPLOYMENT || process.env.REPLIT_DEPLOYMENT_ID)
    throw new Error("Refusing fixture writes outside non-deployed development");
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  const result = await pool.query<{ database_name: string; server_name: string }>(
    "select current_database() as database_name, coalesce(inet_server_addr()::text, '') as server_name",
  );
  const identity = `${result.rows[0]?.database_name ?? ""} ${result.rows[0]?.server_name ?? ""} ${process.env.DATABASE_URL}`;
  if (/(^|[^a-z])(prod|production)([^a-z]|$)/i.test(identity))
    throw new Error("Refusing fixture writes against a production-identified database");
}

async function load(): Promise<State> {
  const state = JSON.parse(await readFile(STATE_PATH, "utf8")) as State;
  if (state.version !== 1 || !/^gpxfx-[0-9a-f]{24}$/.test(state.slug) ||
      state.hostEmail !== `${state.slug}@example.invalid` ||
      !state.tenantId || !state.hostUserId || !state.itemId)
    throw new Error("Invalid GPX fixture state");
  return state;
}

async function assertOwned(state: State) {
  const [tenant] = await db.select().from(tenantsTable).where(eq(tenantsTable.id, state.tenantId));
  const [host] = await db.select().from(hostUsersTable).where(eq(hostUsersTable.id, state.hostUserId));
  if (tenant?.slug !== state.slug || host?.email !== state.hostEmail)
    throw new Error("Fixture ownership changed; refusing to modify rows");
  const [item] = await db.select({ id: itemsTable.id }).from(itemsTable)
    .innerJoin(categoriesTable, eq(itemsTable.categoryId, categoriesTable.id))
    .innerJoin(sectionsTable, eq(categoriesTable.sectionId, sectionsTable.id))
    .where(and(eq(itemsTable.id, state.itemId), eq(sectionsTable.tenantId, state.tenantId)));
  if (!item) throw new Error("Fixture cycling item missing");
  return tenant;
}

async function create(): Promise<void> {
  try {
    await readFile(STATE_PATH);
    throw new Error("Fixture already exists; cleanup before creating another");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  const slug = `gpxfx-${randomUUID().replaceAll("-", "").slice(0, 24)}`;
  const hostEmail = `${slug}@example.invalid`;
  const hostPassword = randomBytes(24).toString("base64url");
  // Fail before any inserts if a usable guest URL cannot be determined.
  const url = guestUrl(slug);
  let tenantId: string | undefined;
  let hostUserId: string | undefined;
  try {
    const [tenant] = await db.insert(tenantsTable).values({
      slug, name: "GPX browser fixture", tenantType: "apartmaji",
      guestUiMode: "living-guide", theme: "poteg", isPublished: true,
      hasUnpublishedChanges: false,
    }).returning();
    if (!tenant) throw new Error("Could not create fixture tenant");
    tenantId = tenant.id;
    await seedTenantContent(tenant.id, "apartmaji");
    const [bike] = await db.select({ id: categoriesTable.id }).from(categoriesTable)
      .innerJoin(sectionsTable, eq(categoriesTable.sectionId, sectionsTable.id))
      .where(and(eq(sectionsTable.tenantId, tenant.id), eq(sectionsTable.key, "explore"), eq(categoriesTable.key, "bike"),
        eq(categoriesTable.layout, "routes")));
    if (!bike) throw new Error("Living Guide explore/bike routes category missing");
    const [item] = await db.insert(itemsTable).values({
      categoryId: bike.id, title: "Testna kolesarska pot ob Soči",
      body: "Sintetična testna pot za preverjanje GPX v brskalniku.",
      position: 0,
    }).returning();
    if (!item) throw new Error("Could not create cycling item");
    const [host] = await db.insert(hostUsersTable).values({
      email: hostEmail, passwordHash: await hashPassword(hostPassword),
    }).returning();
    if (!host) throw new Error("Could not create fixture host");
    hostUserId = host.id;
    await db.insert(hostMembershipsTable).values({ hostUserId: host.id, tenantId: tenant.id });
    await db.transaction(tx => createHostOnboardingDraft(tx, tenant.id, host.id));
    const onboarding = await currentHostOnboarding(tenant.id, host.id);
    if (!onboarding || onboarding.round.status !== "draft")
      throw new Error("Host onboarding form is not ready");
    // Baseline publication intentionally has no GPX. Subsequent upload is draft-only.
    await replacePublishedSnapshot(tenant);
    const snapshot = await readPublishedContent(tenant.id);
    const publishedItem = snapshot.languages.sl?.tree.sections.flatMap(s => s.categories)
      .find(c => c.key === "bike")?.items.find(i => i.id === item.id);
    if (!publishedItem || publishedItem.gpxRoute)
      throw new Error("Initial published cycling item missing or contains GPX");
    const state: State = {
      version: 1, tenantId: tenant.id, slug, itemId: item.id, hostUserId: host.id,
      hostEmail, hostPassword, hostFormPath: "/admin/login",
      hostOnboardingPath: "/admin/onboarding", hostEditorPath: `/admin/tenants/${tenant.id}`,
      guestUrl: url,
      gpxFixturePath: GPX_PATH,
    };
    const temporary = `${STATE_PATH}.${process.pid}`;
    await writeFile(temporary, `${JSON.stringify(state)}\n`, { flag: "wx", mode: 0o600 });
    await chmod(temporary, 0o600);
    await rename(temporary, STATE_PATH);
    await chmod(STATE_PATH, 0o600);
    invalidateTenantCache();
    // Credentials are ONLY in the chmod-600 state file, never stdout.
    console.log(JSON.stringify({ command: "create", statePath: STATE_PATH, tenantId: tenant.id,
      slug, itemId: item.id, hostFormPath: state.hostFormPath,
      hostOnboardingPath: state.hostOnboardingPath, hostEditorPath: state.hostEditorPath,
      guestUrl: url, gpxFixturePath: GPX_PATH }));
  } catch (error) {
    if (tenantId) await db.delete(tenantsTable).where(eq(tenantsTable.id, tenantId));
    if (hostUserId) await db.delete(hostUsersTable).where(eq(hostUsersTable.id, hostUserId));
    throw error;
  }
}

/**
 * Fill only missing canonical submit prerequisites. Repeat-safe; never resets
 * the browser's draft, host session, cycling item, or uploaded GPX.
 */
async function repair(): Promise<void> {
  const state = await load();
  await assertOwned(state);
  const round = await currentHostOnboarding(state.tenantId, state.hostUserId);
  if (!round || round.round.status !== "draft")
    throw new Error("Fixture onboarding is not an editable draft");
  await db.transaction(async tx => {
    const [tenant] = await tx.select().from(tenantsTable).where(eq(tenantsTable.id, state.tenantId)).for("update");
    if (!tenant || tenant.slug !== state.slug) throw new Error("Fixture tenant changed");
    const patch: Partial<typeof tenantsTable.$inferInsert> = {};
    if (!tenant.address?.trim()) patch.address = "Testna ulica 1, 5230 Bovec";
    if (!tenant.phone?.trim()) patch.phone = "+386 40 123 456";
    if (!tenant.email?.trim()) patch.email = "gpx-browser-contact@example.invalid";
    if (Object.keys(patch).length) await tx.update(tenantsTable).set({
      ...patch, hasUnpublishedChanges: true,
    }).where(eq(tenantsTable.id, state.tenantId));

    const categories = await tx.select({
      id: categoriesTable.id, key: categoriesTable.key, sectionKey: sectionsTable.key,
    }).from(categoriesTable)
      .innerJoin(sectionsTable, eq(categoriesTable.sectionId, sectionsTable.id))
      .where(eq(sectionsTable.tenantId, state.tenantId));
    const categoryId = (key: string) => categories.find(c => c.key === key && c.sectionKey === "stay")?.id;
    const welcomeId = categoryId("welcome");
    const checkId = categoryId("check");
    if (!welcomeId || !checkId) throw new Error("Fixture stay/welcome or stay/check category missing");
    const checkItems = await tx.select().from(itemsTable).where(eq(itemsTable.categoryId, checkId));
    const check = checkItems.find(i => /Prijava od:|Odjava do:/i.test(i.body ?? "")) ?? checkItems[0];
    if (!check) {
      await tx.insert(itemsTable).values({
        categoryId: checkId, title: "Prijava in odjava",
        body: "Prijava od: 15:00\nOdjava do: 10:00",
      });
    } else {
      const body = check.body ?? "";
      const missingFrom = !/Prijava od:\s*[0-2]\d:[0-5]\d/i.test(body);
      const missingUntil = !/Odjava do:\s*[0-2]\d:[0-5]\d/i.test(body);
      if (missingFrom || missingUntil) await tx.update(itemsTable).set({
        body: [body.trim(), missingFrom ? "Prijava od: 15:00" : "", missingUntil ? "Odjava do: 10:00" : ""]
          .filter(Boolean).join("\n"),
      }).where(eq(itemsTable.id, check.id));
    }
    const contacts = await tx.select().from(itemsTable).where(eq(itemsTable.categoryId, welcomeId));
    if (!contacts.some(i => i.noteType === "host-onboarding-contact" && i.title?.trim() && i.phone?.trim()))
      await tx.insert(itemsTable).values({
        categoryId: welcomeId, noteType: "host-onboarding-contact",
        title: "Testni gostitelj", phone: "+386 40 123 456",
      });
    await tx.update(tenantsTable).set({ hasUnpublishedChanges: true })
      .where(eq(tenantsTable.id, state.tenantId));
  });
  const updated = await currentHostOnboarding(state.tenantId, state.hostUserId);
  const data = updated?.round.draftData;
  if (!data || ![data.accommodationName, data.address, data.guestPhone, data.guestEmail,
    data.checkInFrom, data.checkOutUntil].every(v => v?.trim()) ||
    !data.contacts.some(c => c.name.trim() && c.phone.trim()))
    throw new Error("Fixture canonical onboarding still lacks submit prerequisites");
  invalidateTenantCache();
  console.log(JSON.stringify({ command: "repair", tenantId: state.tenantId,
    itemId: state.itemId, canonicalSubmitPrerequisitesReady: true }));
}

async function publish(): Promise<void> {
  const state = await load();
  await assertOwned(state);
  await db.transaction(async tx => runWithDatabase(tx as unknown as Db, async () => {
    const [tenant] = await db.select().from(tenantsTable).where(eq(tenantsTable.id, state.tenantId)).for("update");
    if (!tenant || tenant.slug !== state.slug) throw new Error("Fixture tenant missing or changed");
    const [updated] = await db.update(tenantsTable).set({
      hasUnpublishedChanges: false, lastPublishedAt: new Date(),
    }).where(eq(tenantsTable.id, tenant.id)).returning();
    if (!updated) throw new Error("Fixture publish failed");
    await replacePublishedSnapshot(updated);
  }), { isolationLevel: "repeatable read" });
  invalidateTenantCache();
  // This helper is a separate process: the live API's in-memory cache expires
  // naturally. Real HTTP publication invalidates that cache in its middleware.
  console.log(JSON.stringify({ command: "publish", tenantId: state.tenantId, itemId: state.itemId,
    guestReloadAfterMs: 61000 }));
}

async function cleanup(): Promise<void> {
  const state = await load();
  await assertOwned(state);
  // List the WHOLE tenant development prefix: replaced files may no longer be
  // referenced by the item or published snapshot.
  const dir = new ObjectStorageService().getPrivateObjectDir().replace(/\/+$/, "");
  const [_, bucket, ...base] = dir.split("/");
  if (!bucket) throw new Error("Invalid PRIVATE_OBJECT_DIR");
  const prefix = [...base, "gpx", "development", state.tenantId, ""].join("/");
  const [files] = await objectStorageClient.bucket(bucket).getFiles({ prefix });
  for (const file of files) await file.delete({ ignoreNotFound: true });
  await db.delete(tenantsTable).where(eq(tenantsTable.id, state.tenantId));
  await db.delete(hostUsersTable).where(eq(hostUsersTable.id, state.hostUserId));
  await rm(STATE_PATH);
  invalidateTenantCache();
  console.log(JSON.stringify({ command: "cleanup", tenantId: state.tenantId, gpxFilesDeleted: files.length }));
}

async function main(): Promise<void> {
  const command = process.argv[2];
  if (!["create", "repair", "publish", "cleanup"].includes(command ?? ""))
    throw new Error("Usage: gpx-browser-fixture.ts create|repair|publish|cleanup");
  await guard();
  if (command === "create") await create();
  else if (command === "repair") await repair();
  else if (command === "publish") await publish();
  else await cleanup();
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "GPX fixture failed");
  process.exitCode = 1;
}).finally(() => pool.end());