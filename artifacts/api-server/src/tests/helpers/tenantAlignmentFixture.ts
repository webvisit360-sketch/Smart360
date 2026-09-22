import { createHash, randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import {
  adminUsersTable,
  categoriesTable,
  creatorCanonicalPlacesTable,
  creatorPlaceMaterializationsTable,
  creatorPlaceProposalsTable,
  db,
  itemCategoryAttachmentsTable,
  itemsTable,
  mediaTable,
  publishedSnapshotsTable,
  sectionsTable,
  tenantsTable,
  translationsTable,
} from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
import { buildTenantContent } from "../../lib/contentTree";
import {
  alignTenantSkeleton,
  type ProposalRekeyRule,
  type TenantSkeletonAlignmentResult,
} from "../../lib/tenantSkeletonAlignment";

const CAPTURED_GRIL_ID = "177e633a-6030-4eca-8ce8-e0a0afdff599";
const CAPTURED_MENINA_ID = "e0303a50-aeba-4ff2-a919-1e2558df55f3";
const baselineUrl = new URL("../../../../../reports/okolica-production-baseline.json", import.meta.url);

type RawRow = Record<string, unknown>;
type CapturedBaseline = Record<
  "items" | "tenants" | "sections" | "categories" | "attachments" |
  "proposals" | "translations" | "materializations",
  RawRow[]
>;

export type FullCopyFixture = {
  source: "Gril" | "MENINA";
  tenantId: string;
  sectionIds: string[];
  categoryIds: string[];
  itemIds: string[];
  proposalIds: string[];
  approvedRules: ProposalRekeyRule[];
  capturedCategoryShape: Array<{
    section: string;
    key: string | null;
    label: string;
    layout: string;
    position: number;
  }>;
  baselineCounts: FixtureCounts;
};

export type FixtureCounts = {
  categories: number;
  items: number;
  proposals: number;
  attachments: number;
  materializations: number;
  media: number;
  snapshots: number;
};

export type FullCopyFixtureSet = {
  gril: FullCopyFixture;
  menina: FullCopyFixture;
  tenantIds: string[];
  /** Existing development-only audit metadata, selected read-only. */
  existingReviewerId: string;
};

export class ExistingReviewerMetadataUnavailableError extends Error {
  constructor() {
    super("Full-copy fixture requires existing development reviewer metadata; no admin user was created");
    this.name = "ExistingReviewerMetadataUnavailableError";
  }
}

const value = (row: RawRow, camel: string, snake: string = camel): unknown =>
  row[camel] ?? row[snake];

const stable = (input: unknown): unknown => {
  if (input instanceof Date) return input.toISOString();
  if (Array.isArray(input)) return input.map(stable);
  if (input && typeof input === "object") {
    return Object.fromEntries(Object.entries(input as RawRow)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, entry]) => [key, stable(entry)]));
  }
  return input;
};

export const fixtureHash = (input: unknown): string =>
  createHash("sha256").update(JSON.stringify(stable(input))).digest("hex");

function capturedSlice(baseline: CapturedBaseline, tenantId: string) {
  const tenant = baseline.tenants.find((row) => row.id === tenantId);
  if (!tenant) throw new Error(`Captured tenant ${tenantId} is missing`);
  const sections = baseline.sections.filter((row) => value(row, "tenantId", "tenant_id") === tenantId);
  const sectionIds = new Set(sections.map((row) => String(row.id)));
  const categories = baseline.categories.filter((row) => sectionIds.has(String(value(row, "sectionId", "section_id"))));
  const categoryIds = new Set(categories.map((row) => String(row.id)));
  const items = baseline.items.filter((row) => categoryIds.has(String(value(row, "categoryId", "category_id"))));
  const itemIds = new Set(items.map((row) => String(row.id)));
  const proposals = baseline.proposals.filter((row) => value(row, "tenantId", "tenant_id") === tenantId);
  const proposalIds = new Set(proposals.map((row) => String(row.id)));
  return {
    tenant,
    sections,
    categories,
    items,
    proposals,
    attachments: baseline.attachments.filter((row) =>
      categoryIds.has(String(value(row, "categoryId", "category_id"))) ||
      itemIds.has(String(value(row, "itemId", "item_id"))) ||
      proposalIds.has(String(value(row, "sourceProposalId", "source_proposal_id")))),
    translations: baseline.translations.filter((row) => {
      const recordId = String(value(row, "recordId", "record_id"));
      return sectionIds.has(recordId) || categoryIds.has(recordId) || itemIds.has(recordId);
    }),
    materializations: baseline.materializations.filter((row) =>
      value(row, "tenantId", "tenant_id") === tenantId),
  };
}

function remapSlice(slice: ReturnType<typeof capturedSlice>) {
  const map = new Map<string, string>();
  const rows = [
    [slice.tenant],
    slice.sections,
    slice.categories,
    slice.items,
    slice.proposals,
    slice.attachments,
    slice.translations,
  ];
  for (const table of rows) {
    for (const row of table) {
      if (typeof row.id === "string") map.set(row.id, randomUUID());
    }
  }
  const remap = (id: unknown): string | null => {
    if (id == null) return null;
    const mapped = map.get(String(id));
    if (!mapped) throw new Error(`Fixture reference was not remapped: ${String(id)}`);
    return mapped;
  };
  return { map, remap };
}

async function insertFullCopy(
  baseline: CapturedBaseline,
  source: "Gril" | "MENINA",
  capturedTenantId: string,
  reviewerId: string,
  fixtureTenantId: string,
): Promise<FullCopyFixture> {
  const slice = capturedSlice(baseline, capturedTenantId);
  if (slice.categories.length !== 22) throw new Error(`${source} capture must contain exactly 22 categories`);
  const expected = source === "Gril"
    ? { items: 27, proposals: 367 }
    : { items: 0, proposals: 272 };
  if (slice.items.length !== expected.items || slice.proposals.length !== expected.proposals) {
    throw new Error(`${source} capture count drift`);
  }
  const { map, remap } = remapSlice(slice);
  // The pair creator knows both IDs before either insert begins, allowing it to
  // clean a partially-created second tenant if any later fixture insert fails.
  map.set(capturedTenantId, fixtureTenantId);
  const tenantId = remap(capturedTenantId)!;
  const sectionIds = slice.sections.map((row) => remap(row.id)!);
  const categoryIds = slice.categories.map((row) => remap(row.id)!);
  const itemIds = slice.items.map((row) => remap(row.id)!);
  const proposalIds = slice.proposals.map((row) => remap(row.id)!);

  await db.insert(tenantsTable).values({
    id: tenantId,
    slug: `alignment-full-copy-${source.toLowerCase()}-${tenantId}`,
    name: `Disposable ${source} captured full copy`,
    tenantType: String(slice.tenant.tenantType ?? slice.tenant.tenant_type ?? "kamp"),
    isPublished: Boolean(slice.tenant.isPublished ?? slice.tenant.is_published),
    hasUnpublishedChanges: Boolean(slice.tenant.hasUnpublishedChanges ?? slice.tenant.has_unpublished_changes),
    lastPublishedAt: value(slice.tenant, "lastPublishedAt", "last_published_at")
      ? new Date(String(value(slice.tenant, "lastPublishedAt", "last_published_at")))
      : null,
  });
  await db.insert(sectionsTable).values(slice.sections.map((row) => ({
    id: remap(row.id)!,
    tenantId,
    key: String(row.key),
    title: String(row.title),
    subtitle: row.subtitle == null ? null : String(row.subtitle),
    icon: String(row.icon),
    imageUrl: value(row, "imageUrl", "image_url") == null ? null : String(value(row, "imageUrl", "image_url")),
    position: Number(row.position),
    isVisible: Boolean(value(row, "isVisible", "is_visible")),
  })));
  await db.insert(categoriesTable).values(slice.categories.map((row) => ({
    id: remap(row.id)!,
    sectionId: remap(value(row, "sectionId", "section_id"))!,
    key: row.key == null ? null : String(row.key),
    label: String(row.label),
    icon: String(row.icon),
    layout: String(row.layout),
    exploreGroup: String(value(row, "exploreGroup", "explore_group")),
    position: Number(row.position),
    isVisible: Boolean(value(row, "isVisible", "is_visible")),
    deletedAt: value(row, "deletedAt", "deleted_at")
      ? new Date(String(value(row, "deletedAt", "deleted_at")))
      : null,
  })));
  if (slice.items.length) {
    await db.insert(itemsTable).values(slice.items.map((row) => ({
      id: remap(row.id)!,
      categoryId: remap(value(row, "categoryId", "category_id"))!,
      title: row.title == null ? null : String(row.title),
      body: row.body == null ? null : String(row.body),
      bullets: Array.isArray(row.bullets) ? row.bullets.map(String) : [],
      distance: row.distance == null ? null : String(row.distance),
      duration: row.duration == null ? null : String(row.duration),
      difficulty: row.difficulty == null ? null : String(row.difficulty),
      position: Number(row.position),
      isVisible: Boolean(value(row, "isVisible", "is_visible")),
      deletedAt: value(row, "deletedAt", "deleted_at")
        ? new Date(String(value(row, "deletedAt", "deleted_at")))
        : null,
    })));
  }
  if (slice.translations.length) {
    await db.insert(translationsTable).values(slice.translations.map((row) => ({
      id: remap(row.id)!,
      model: String(row.model),
      recordId: remap(value(row, "recordId", "record_id"))!,
      field: String(row.field),
      lang: String(row.lang),
      value: String(row.value),
      stale: Boolean(row.stale),
    })));
  }

  // Insert first with constraint-safe pending state, then restore every captured
  // status. The capture intentionally omits operational audit columns.
  await db.insert(creatorPlaceProposalsTable).values(slice.proposals.map((row) => ({
    id: remap(row.id)!,
    tenantId,
    runId: randomUUID(),
    categoryId: remap(value(row, "categoryId", "category_id")),
    proposedName: String(row.proposedName),
    normalizedName: `${String(row.proposedName).toLocaleLowerCase()}-${randomUUID()}`,
    originalQuery: String(row.proposedName),
    resolvedName: row.resolvedName == null ? null : String(row.resolvedName),
    status: "pending",
  })));
  const firstProposalId = proposalIds[0]!;
  for (const row of slice.proposals) {
    const status = String(row.status);
    const id = remap(row.id)!;
    if (status === "pending") continue;
    await db.update(creatorPlaceProposalsTable).set({
      status,
      refusalReason: status === "unresolved" ? "captured-full-copy-unresolved" : null,
      reviewedBy: status === "approved" || status === "rejected" ? reviewerId : null,
      reviewedAt: status === "approved" || status === "rejected" ? new Date("2026-01-01T00:00:00Z") : null,
      rejectionIdentity: status === "rejected" ? `fixture-rejection-${id}` : null,
      supersededBy: status === "superseded" ? (id === firstProposalId ? proposalIds[1]! : firstProposalId) : null,
    }).where(eq(creatorPlaceProposalsTable.id, id));
  }

  if (slice.attachments.length) {
    await db.insert(itemCategoryAttachmentsTable).values(slice.attachments.map((row) => ({
      id: remap(row.id)!,
      itemId: remap(value(row, "itemId", "item_id"))!,
      categoryId: remap(value(row, "categoryId", "category_id"))!,
      sourceProposalId: value(row, "sourceProposalId", "source_proposal_id") == null
        ? null
        : remap(value(row, "sourceProposalId", "source_proposal_id")),
      createdAt: value(row, "createdAt", "created_at")
        ? new Date(String(value(row, "createdAt", "created_at")))
        : undefined,
    })));
  }

  // Captured materialization rows contain stable links only. Representative
  // fixture metadata fills the wider current schema without inventing guest data.
  for (const [index, row] of slice.materializations.entries()) {
    const itemId = remap(value(row, "itemId", "item_id"))!;
    const proposalId = remap(value(row, "proposalId", "proposal_id"))!;
    const canonicalId = randomUUID();
    const entityKey = `captured-${source.toLowerCase()}-${index}-${randomUUID()}`;
    await db.insert(creatorCanonicalPlacesTable).values({
      id: canonicalId, tenantId, entityKey, itemId,
    });
    await db.insert(creatorPlaceMaterializationsTable).values({
      id: randomUUID(),
      tenantId,
      entityKey,
      canonicalPlaceId: canonicalId,
      proposalId,
      itemId,
      runId: randomUUID(),
      confirmationMethod: "exact",
      authoritativeAddress: "Captured fixture metadata",
      latitude: 46.25,
      longitude: 14.35,
      roadDistanceM: 1000 + index,
      travelDurationS: 120 + index,
      range: "near",
      editorialJson: JSON.stringify({ fixture: true, source }),
      provenanceJson: JSON.stringify({ capture: "okolica-production-baseline", originalId: row.proposalId }),
      isActive: Boolean(row.active ?? true),
    });
  }
  if (source === "Gril") {
    await db.insert(mediaTable).values([
      {
        id: randomUUID(), tenantId, itemId: itemIds[0]!,
        url: "https://fixture.invalid/gril-item-sentinel.webp", alt: "Gril item media sentinel",
      },
      {
        id: randomUUID(), tenantId,
        url: "https://fixture.invalid/gril-tenant-sentinel.webp", alt: "Gril tenant media sentinel",
      },
    ]);
  } else {
    await db.insert(mediaTable).values({
      id: randomUUID(), tenantId,
      url: "https://fixture.invalid/menina-tenant-sentinel.webp", alt: "MENINA tenant media sentinel",
    });
  }
  await db.insert(publishedSnapshotsTable).values({
    tenantId,
    content: { fixture: "tenant-skeleton-alignment-full-copy", source, sentinel: randomUUID() },
  });

  const approvedRules: ProposalRekeyRule[] = source === "MENINA"
    ? [
      ["5892165a-12d9-4630-a813-746a72840038", "Gostilna Pri Kumru", "food", "culinary"],
      ["0de9aa96-eb7b-4a77-86a5-679d8d813ea9", "Gostilna Čater", "food", "culinary"],
      ["c6264904-a96f-4be6-89d9-004a5b0dadef", "Hiša Raduha", "food", "culinary"],
      ["ec4b801e-bc2a-4aa0-8445-f4e029fa650a", "Lekarna Mozirje", "health", "pharm"],
      ["8966a4b2-7f70-4032-abc6-a3707e7476db", "Zdravstveni dom Mozirje", "health", "hosp"],
    ].map(([id, expectedName, sourceKey, targetKey]) => ({
      id: map.get(id)!, expectedName, sourceKey, targetKey,
    } as ProposalRekeyRule))
    : [];
  const capturedSectionKey = new Map(slice.sections.map((row) => [String(row.id), String(row.key)]));
  return {
    source,
    tenantId,
    sectionIds,
    categoryIds,
    itemIds,
    proposalIds,
    approvedRules,
    capturedCategoryShape: slice.categories.map((row) => ({
      section: capturedSectionKey.get(String(value(row, "sectionId", "section_id")))!,
      key: row.key == null ? null : String(row.key),
      label: String(row.label),
      layout: String(row.layout),
      position: Number(row.position),
    })).sort((a, b) => `${a.section}/${a.position}/${a.key}`.localeCompare(`${b.section}/${b.position}/${b.key}`)),
    baselineCounts: await fixtureCounts(tenantId),
  };
}

export async function createFullCopyFixtures(): Promise<FullCopyFixtureSet> {
  if (process.env["NODE_ENV"] === "production") {
    throw new Error("Disposable tenant alignment fixtures are forbidden in production");
  }
  if (!process.env["DATABASE_URL"]) throw new Error("DATABASE_URL is required for the real development fixture");
  const baseline = JSON.parse(await readFile(baselineUrl, "utf8")) as CapturedBaseline;
  // Approved/rejected captured statuses require reviewer audit metadata. Use
  // an existing development row read-only: fixtures must never create operator
  // accounts, credentials, sessions, or authentication state.
  const [reviewer] = await db.select({ id: adminUsersTable.id }).from(adminUsersTable).limit(1);
  if (!reviewer) {
    throw new ExistingReviewerMetadataUnavailableError();
  }
  const grilId = randomUUID();
  const meninaId = randomUUID();
  try {
    const gril = await insertFullCopy(baseline, "Gril", CAPTURED_GRIL_ID, reviewer.id, grilId);
    const menina = await insertFullCopy(baseline, "MENINA", CAPTURED_MENINA_ID, reviewer.id, meninaId);
    return {
      gril,
      menina,
      tenantIds: [gril.tenantId, menina.tenantId],
      existingReviewerId: reviewer.id,
    };
  } catch (error) {
    await db.delete(tenantsTable).where(inArray(tenantsTable.id, [grilId, meninaId]));
    throw error;
  }
}

export async function cleanupFullCopyFixtures(fixtures: FullCopyFixtureSet): Promise<void> {
  await db.delete(tenantsTable).where(inArray(tenantsTable.id, fixtures.tenantIds));
}

export async function fixtureCounts(tenantId: string): Promise<FixtureCounts> {
  const sections = await db.select({ id: sectionsTable.id }).from(sectionsTable).where(eq(sectionsTable.tenantId, tenantId));
  const sectionIds = sections.map((row) => row.id);
  const categories = sectionIds.length
    ? await db.select({ id: categoriesTable.id }).from(categoriesTable).where(inArray(categoriesTable.sectionId, sectionIds))
    : [];
  const categoryIds = categories.map((row) => row.id);
  const items = categoryIds.length
    ? await db.select({ id: itemsTable.id }).from(itemsTable).where(inArray(itemsTable.categoryId, categoryIds))
    : [];
  return {
    categories: categories.length,
    items: items.length,
    proposals: (await db.select({ id: creatorPlaceProposalsTable.id }).from(creatorPlaceProposalsTable)
      .where(eq(creatorPlaceProposalsTable.tenantId, tenantId))).length,
    attachments: categoryIds.length
      ? (await db.select({ id: itemCategoryAttachmentsTable.id }).from(itemCategoryAttachmentsTable)
        .where(inArray(itemCategoryAttachmentsTable.categoryId, categoryIds))).length
      : 0,
    materializations: (await db.select({ id: creatorPlaceMaterializationsTable.id })
      .from(creatorPlaceMaterializationsTable)
      .where(eq(creatorPlaceMaterializationsTable.tenantId, tenantId))).length,
    media: (await db.select({ id: mediaTable.id }).from(mediaTable).where(eq(mediaTable.tenantId, tenantId))).length,
    snapshots: (await db.select({ tenantId: publishedSnapshotsTable.tenantId }).from(publishedSnapshotsTable)
      .where(eq(publishedSnapshotsTable.tenantId, tenantId))).length,
  };
}

export async function protectedFixtureState(fixture: FullCopyFixture) {
  // SELECT without ORDER BY is intentionally unordered, and PostgreSQL may
  // return updated tuples in a different physical order. Canonicalize the
  // rowset before hashing so order churn cannot masquerade as payload drift.
  const proposals = (await db.select().from(creatorPlaceProposalsTable)
    .where(eq(creatorPlaceProposalsTable.tenantId, fixture.tenantId)))
    .sort((a, b) => a.id.localeCompare(b.id));
  return {
    counts: await fixtureCounts(fixture.tenantId),
    items: await db.select().from(itemsTable).where(inArray(itemsTable.id, fixture.itemIds)),
    attachments: fixture.categoryIds.length
      ? await db.select().from(itemCategoryAttachmentsTable)
        .where(inArray(itemCategoryAttachmentsTable.categoryId, fixture.categoryIds))
      : [],
    materializations: await db.select().from(creatorPlaceMaterializationsTable)
      .where(eq(creatorPlaceMaterializationsTable.tenantId, fixture.tenantId)),
    media: await db.select().from(mediaTable).where(eq(mediaTable.tenantId, fixture.tenantId)),
    snapshots: await db.select().from(publishedSnapshotsTable)
      .where(eq(publishedSnapshotsTable.tenantId, fixture.tenantId)),
    proposals,
    proposalPayloadWithoutCategory: proposals.map(({ categoryId: _categoryId, ...row }) => row),
  };
}

export type FixtureHarness = {
  port: number;
  fixtures: FullCopyFixtureSet;
  summaryPath: string;
  close(): Promise<void>;
};

export async function startTenantAlignmentFixtureHarness(port = 43127): Promise<FixtureHarness> {
  if (process.env["NODE_ENV"] === "production") throw new Error("Fixture harness rejects production");
  const fixtures = await createFullCopyFixtures();
  const results: Partial<Record<"gril" | "menina", TenantSkeletonAlignmentResult | null>> = {};
  const summaryPath = "/tmp/tenant-alignment-fixture-state.json";
  const writeSummary = async () => writeFile(summaryPath, JSON.stringify({
    mode: "alignment-browser-fixture-explorer",
    auth: "simulated frontend context only; no account, session, password, or production auth bypass",
    port,
    fixtures: {
      gril: { tenantId: fixtures.gril.tenantId, counts: await fixtureCounts(fixtures.gril.tenantId) },
      menina: { tenantId: fixtures.menina.tenantId, counts: await fixtureCounts(fixtures.menina.tenantId) },
    },
    results,
  }, null, 2));
  await writeSummary();
  const known = new Map([
    [fixtures.gril.tenantId, fixtures.gril],
    [fixtures.menina.tenantId, fixtures.menina],
  ]);
  const server: Server = createServer(async (request, response) => {
    response.setHeader("content-type", "application/json; charset=utf-8");
    try {
      const url = new URL(request.url ?? "/", `http://127.0.0.1:${port}`);
      if (request.method === "GET" && url.pathname === "/state") {
        await writeSummary();
        response.end(await readFile(summaryPath, "utf8"));
        return;
      }
      const tenantMatch = /^\/tenant\/([0-9a-f-]+)$/.exec(url.pathname);
      if (request.method === "GET" && tenantMatch) {
        const fixture = known.get(tenantMatch[1]!);
        if (!fixture) {
          response.statusCode = 404;
          response.end(JSON.stringify({ error: "Unknown scratch fixture tenant" }));
          return;
        }
        const [tenant] = await db.select().from(tenantsTable).where(eq(tenantsTable.id, fixture.tenantId));
        response.end(JSON.stringify(await buildTenantContent(tenant!, { visibleOnly: false })));
        return;
      }
      const actionMatch = /^\/tenant\/([0-9a-f-]+)\/align$/.exec(url.pathname);
      if (request.method === "POST" && actionMatch) {
        const fixture = known.get(actionMatch[1]!);
        if (!fixture) {
          response.statusCode = 404;
          response.end(JSON.stringify({ error: "Unknown scratch fixture tenant" }));
          return;
        }
        const key = fixture.source === "Gril" ? "gril" : "menina";
        results[key] = await alignTenantSkeleton(fixture.tenantId, fixture.source === "MENINA"
          ? { fixtureProposalRules: fixture.approvedRules }
          : undefined);
        await writeSummary();
        response.end(JSON.stringify(results[key]));
        return;
      }
      if (request.method === "POST" && url.pathname === "/cleanup") {
        response.end(JSON.stringify({ cleaned: true }));
        setImmediate(() => void close());
        return;
      }
      response.statusCode = 404;
      response.end(JSON.stringify({ error: "Fixture-only route not found" }));
    } catch (error) {
      response.statusCode = 500;
      response.end(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }));
    }
  });
  let closed = false;
  const close = async () => {
    if (closed) return;
    closed = true;
    await cleanupFullCopyFixtures(fixtures);
    if (server.listening) await new Promise<void>((resolve, reject) =>
      server.close((error) => error ? reject(error) : resolve()));
  };
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolve);
  });
  return { port, fixtures, summaryPath, close };
}