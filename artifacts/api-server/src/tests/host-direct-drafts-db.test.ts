import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { eq } from "drizzle-orm";
import {
  categoriesTable, creatorCanonicalPlacesTable, creatorPlaceProposalsTable, db, itemDistanceProposalsTable,
  itemsTable, sectionsTable, tenantsTable,
} from "@workspace/db";
import { materializeHostRecommendations, HOST_ONBOARDING_PROVENANCE } from "../lib/hostOnboardingCreator";
import { pinHostDraftItem } from "../lib/adminPlaceCreation";
import { ensureTenantPublication, readPublishedContent } from "../lib/publishedSnapshots";
import { buildTenantContent } from "../lib/contentTree";
import { currentHostOnboarding, ownerHostOnboarding, submitHostOnboarding } from "../lib/hostOnboarding";
import { _setHostOnboardingDeliveryOverride } from "../lib/hostOnboardingEmail";
import {
  cleanupCanonicalOnboardingFixture, createCanonicalOnboardingFixture,
} from "./helpers/canonicalOnboardingFixture";

test("disposable tenant: confident, ambiguous and existing host names become two draft items, never guests", async (context) => {
  if (process.env.NODE_ENV === "production") throw new Error("Fixture writes are forbidden in production");
  if (!process.env.DATABASE_URL) return context.skip("development database unavailable");
  const token = randomUUID();
  const [tenant] = await db.insert(tenantsTable).values({
    slug: `host-direct-${token}`, name: "Disposable Gril identity fixture",
    tenantType: "apartmaji", guestUiMode: "living-guide",
    latitude: 46.39, longitude: 14.73, isPublished: true,
  }).returning();
  try {
    const [section] = await db.insert(sectionsTable).values({
      tenantId: tenant.id, key: "explore", title: "Okolica",
    }).returning();
    const [category] = await db.insert(categoriesTable).values({
      sectionId: section.id, key: "nature", label: "Narava",
    }).returning();
    const [existing] = await db.insert(itemsTable).values({
      categoryId: category.id, title: "Gril existing name",
    }).returning();
    await ensureTenantPublication(tenant.id);
    const guestBefore = await readPublishedContent(tenant.id);
    const cleanName = `Logarska dolina ${token.slice(0, 8)}`;
    const ambiguous = `Nejasen kraj ${token.slice(0, 8)}`;
    const search = async (_path: "/search" | "/lookup", params: Record<string, string>) => {
      if (params.q !== cleanName) return [];
      return [{
        name: cleanName, osm_type: "way", osm_id: 7821001,
        lat: "46.389", lon: "14.731", display_name: `${cleanName}, Slovenija`,
      }];
    };
    const route = async () => ({ distanceMeters: 2500, durationMinutes: 6 });
    const hints = [cleanName, ambiguous, "Gril existing name"].map(name => ({
      categoryKey: "nature", name,
    }));
    const first = await db.transaction(tx => materializeHostRecommendations(tx, {
      tenantId: tenant.id, recommendations: hints,
    }, { search, route }));
    assert.deepEqual(first.map(row => row.materializationStatus),
      ["created", "created_without_coordinates", "matched_existing"]);
    assert.ok(first.every(row => row.provenance === HOST_ONBOARDING_PROVENANCE &&
      row.proposalId === null));
    assert.equal(first[2]!.itemId, existing.id);
    const items = await db.select().from(itemsTable).where(eq(itemsTable.categoryId, category.id));
    assert.equal(items.length, 3);
    const coords = await db.select().from(itemDistanceProposalsTable)
      .where(eq(itemDistanceProposalsTable.tenantId, tenant.id));
    assert.equal(coords.length, 1);
    assert.equal(coords[0]!.itemId, first[0]!.itemId);
    assert.equal(coords[0]!.status, "approved");
    assert.equal((await db.select().from(creatorPlaceProposalsTable)
      .where(eq(creatorPlaceProposalsTable.tenantId, tenant.id))).length, 0);
    // Same round retry, or a second host submit with the same names, cannot
    // create another canonical place.
    const retry = await db.transaction(tx => materializeHostRecommendations(tx, {
      tenantId: tenant.id, recommendations: hints,
    }, { search, route }));
    assert.deepEqual(retry.map(row => row.itemId), first.map(row => row.itemId));
    const guestAfter = await readPublishedContent(tenant.id);
    assert.deepEqual(guestAfter, guestBefore);
    assert.ok(!JSON.stringify(guestAfter).includes(cleanName));
    const [fresh] = await db.select().from(tenantsTable).where(eq(tenantsTable.id, tenant.id));
    const draft = await buildTenantContent(fresh, { visibleOnly: true });
    assert.ok(JSON.stringify(draft).includes(cleanName));
    assert.ok(JSON.stringify(draft).includes(ambiguous));
  } finally {
    await db.delete(tenantsTable).where(eq(tenantsTable.id, tenant.id));
  }
});

test("canonical identity outranks names; archived identities are linked without resurrection", async context => {
  if (process.env.NODE_ENV === "production") throw new Error("Fixture writes are forbidden in production");
  if (!process.env.DATABASE_URL) return context.skip("development database unavailable");
  const marker = randomUUID();
  const [tenant] = await db.insert(tenantsTable).values({
    slug: `host-identity-${marker}`, name: "Disposable Gril identity boundary",
    latitude: 46.39, longitude: 14.73, tenantType: "apartmaji",
  }).returning();
  try {
    const [section] = await db.insert(sectionsTable).values({
      tenantId: tenant.id, key: "explore", title: "Okolica",
    }).returning();
    const [category] = await db.insert(categoriesTable).values({
      sectionId: section.id, key: "nature", label: "Narava",
    }).returning();
    const oldName = `Same name ${marker.slice(0, 6)}`;
    const archivedName = `Archived ${marker.slice(0, 6)}`;
    const renamed = `Alternative name ${marker.slice(0, 6)}`;
    const [unlocated, archived, existing] = await db.insert(itemsTable).values([
      { categoryId: category.id, title: oldName },
      { categoryId: category.id, title: archivedName, deletedAt: new Date() },
      { categoryId: category.id, title: `Original name ${marker.slice(0, 6)}` },
    ]).returning();
    const ids: Record<string, number> = {
      [oldName]: 920020,
      [archivedName]: 920030,
      [renamed]: 920040,
    };
    await db.insert(creatorCanonicalPlacesTable).values([
      { tenantId: tenant.id, itemId: archived.id, entityKey: "osm:way:920030" },
      { tenantId: tenant.id, itemId: existing.id, entityKey: "osm:way:920040" },
    ]);
    const search = async (_path: "/search" | "/lookup", params: Record<string, string>) =>
      params.q && ids[params.q] ? [{
        name: params.q, osm_type: "way", osm_id: ids[params.q],
        lat: "46.391", lon: "14.731", display_name: `${params.q}, Slovenija`,
      }] : [];
    const route = async () => ({ distanceMeters: 1000, durationMinutes: 4 });
    const names = [oldName, archivedName, renamed];
    const review = await db.transaction(tx => materializeHostRecommendations(tx, {
      tenantId: tenant.id, recommendations: names.map(name => ({
        categoryKey: "nature", name,
      })),
    }, { search, route }));
    assert.notEqual(review[0]?.itemId, unlocated.id,
      "a different verified OSM identity must not be merged by name");
    assert.equal(review[0]?.materializationStatus, "created");
    assert.equal(review[1]?.itemId, archived.id);
    assert.equal(review[1]?.materializationStatus, "matched_existing");
    assert.equal(review[1]?.existingArchived, true);
    assert.equal(review[2]?.itemId, existing.id,
      "identical OSM identity must match even when the stored name changed");
    assert.equal(review[2]?.materializationStatus, "matched_existing");
    const rows = await db.select().from(itemsTable).where(eq(itemsTable.categoryId, category.id));
    assert.equal(rows.length, 4, "only the separately verified same-name place is created");
    assert.ok((rows.find(row => row.id === archived.id))?.deletedAt,
      "host submission must never resurrect an archived canonical place");
    const replay = await db.transaction(tx => materializeHostRecommendations(tx, {
      tenantId: tenant.id, recommendations: names.map(name => ({
        categoryKey: "nature", name,
      })),
    }, { search, route }));
    assert.deepEqual(replay.map(entry => entry.itemId), review.map(entry => entry.itemId));
    const variants = [`Variant A ${marker.slice(0, 6)}`, `Variant B ${marker.slice(0, 6)}`];
    const sameOsmSearch = async (_path: "/search" | "/lookup", params: Record<string, string>) => [{
      name: params.q, osm_type: "way", osm_id: 920050,
      lat: "46.392", lon: "14.732", display_name: `${params.q}, Slovenija`,
    }];
    const competing = await Promise.all(variants.map(name =>
      db.transaction(tx => materializeHostRecommendations(tx, {
        tenantId: tenant.id, recommendations: [{ categoryKey: "nature", name }],
      }, { search: sameOsmSearch, route }))));
    assert.equal(competing[0]?.[0]?.itemId, competing[1]?.[0]?.itemId,
      "competing different names of the same OSM place must share a canonical item");
    assert.deepEqual(
      competing.map(result => result[0]?.materializationStatus).sort(),
      ["created", "matched_existing"],
    );
  } finally {
    await db.delete(tenantsTable).where(eq(tenantsTable.id, tenant.id));
  }
});

test("host submit persists statuses, retries without duplication, and operator pin stays behind publish gate", async context => {
  if (process.env.NODE_ENV === "production") throw new Error("Fixture writes are forbidden in production");
  if (!process.env.DATABASE_URL) return context.skip("development database unavailable");
  const fixture = await createCanonicalOnboardingFixture();
  _setHostOnboardingDeliveryOverride(async () => ({
    ok: true, providerMessageId: "fixture-direct-host-drafts",
  }));
  try {
    const [category] = await db.select().from(categoriesTable)
      .where(eq(categoriesTable.id, fixture.categoryIds.shops));
    assert.ok(category);
    const [existing] = await db.insert(itemsTable).values({
      categoryId: category.id, title: `Existing ${fixture.marker}`,
    }).returning();
    const opened = await currentHostOnboarding(fixture.tenantId, fixture.hostUserId);
    assert.ok(opened);
    const before = await readPublishedContent(fixture.tenantId);
    const clean = `Logarska dolina ${fixture.marker.slice(-6)}`;
    const ambiguous = `Unlocated ${fixture.marker.slice(-6)}`;
    const names = [clean, ambiguous, existing.title!];
    const dependencies = {
      search: async (_path: "/search" | "/lookup", params: Record<string, string>) =>
        params.q === clean ? [{
          name: clean, osm_type: "way", osm_id: 7821002, lat: "46.06",
          lon: "14.51", display_name: `${clean}, Slovenija`,
        }] : [],
      route: async () => ({ distanceMeters: 1400, durationMinutes: 5 }),
    };
    const submitted = await submitHostOnboarding(
      fixture.tenantId, fixture.hostUserId, opened.round.round,
      opened.round.revision,
      { ...opened.round.draftData, recommendations: names.map((name, index) => ({
        id: `host-${index}`, categoryId: "shops", name,
      })) },
      opened.canonicalRevision, dependencies,
    );
    assert.equal(submitted.ok && submitted.recommendationProcessing?.status, "succeeded",
      JSON.stringify(submitted));
    const owner = await ownerHostOnboarding(fixture.tenantId);
    const review = owner?.rounds[0]?.round.recommendationReview ?? [];
    assert.deepEqual(review.map(row => row.materializationStatus),
      ["created", "created_without_coordinates", "matched_existing"]);
    assert.equal(review[2]?.itemId, existing.id);
    assert.equal((await db.select().from(itemsTable)
      .where(eq(itemsTable.categoryId, category.id))).filter(row => names.includes(row.title ?? "")).length, 3);
    assert.deepEqual(await readPublishedContent(fixture.tenantId), before);
    assert.ok(!JSON.stringify(before).includes(clean));
    const replay = await submitHostOnboarding(
      fixture.tenantId, fixture.hostUserId, opened.round.round, opened.round.revision,
      opened.round.draftData,
    );
    assert.equal(replay.ok && replay.alreadySubmitted, true);
    const pinned = await pinHostDraftItem({
      itemId: review[1]!.itemId!, latitude: 46.065,
      longitude: 14.515, locationText: "Točko potrdil operater",
    }, { route: dependencies.route });
    assert.equal(pinned.itemId, review[1]!.itemId);
    assert.equal((await ownerHostOnboarding(fixture.tenantId))?.rounds[0]?.round
      .recommendationReview[1]?.materializationStatus, "created");
    assert.deepEqual(await readPublishedContent(fixture.tenantId), before);
  } finally {
    _setHostOnboardingDeliveryOverride(null);
    await cleanupCanonicalOnboardingFixture(fixture);
  }
});