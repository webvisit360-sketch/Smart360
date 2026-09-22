import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { and, eq, inArray, isNull } from "drizzle-orm";
import {
  categoriesTable,
  creatorPlaceProposalsTable,
  db,
  itemCategoryAttachmentsTable,
  itemsTable,
  publishedSnapshotsTable,
  sectionsTable,
  tenantsTable,
  translationsTable,
} from "@workspace/db";
import { alignTenantSkeleton, type ProposalRekeyRule } from "../lib/tenantSkeletonAlignment";
import { seedTenantContent } from "../lib/tenantSeeds";
import { ADMIN_ROUTE_REGISTRY, requireOperator } from "../lib/actorGate";
import type { NextFunction, Request, Response } from "express";

test("alignment route is explicitly owner-only", () => {
  const route = ADMIN_ROUTE_REGISTRY.find((entry) =>
    entry.method === "post" && entry.path === "/admin/tenants/:id/align-skeleton");
  assert.deepEqual(route?.binding, { kind: "owner-only" });
});

test("operator guard rejects anonymous and host actors", () => {
  const statusCodes: number[] = [];
  const response = {
    status(code: number) {
      statusCodes.push(code);
      return this;
    },
    json() { return this; },
  } as unknown as Response;
  let nextCalls = 0;
  const next = (() => { nextCalls += 1; }) as NextFunction;
  requireOperator({} as Request, response, next);
  requireOperator({ actor: { kind: "host", hostUserId: randomUUID(), tenantId: randomUUID() } } as Request, response, next);
  requireOperator({ actor: { kind: "owner" } } as Request, response, next);
  assert.deepEqual(statusCodes, [401, 403]);
  assert.equal(nextCalls, 1);
});

test("real development DB: Gril and MENINA copies align without losing content or proposals", async (context) => {
  if (process.env["NODE_ENV"] === "production") throw new Error("Alignment fixture is forbidden in production");
  if (!process.env["DATABASE_URL"]) {
    context.skip("development database is unavailable");
    return;
  }
  const grilId = randomUUID();
  const meninaId = randomUUID();
  const tenantIds = [grilId, meninaId];
  try {
    await db.insert(tenantsTable).values([
      { id: grilId, slug: `alignment-gril-${grilId}`, name: "Disposable Gril copy", tenantType: "kamp", isPublished: true },
      { id: meninaId, slug: `alignment-menina-${meninaId}`, name: "Disposable MENINA copy", tenantType: "kamp" },
    ]);
    await seedTenantContent(grilId, "kamp");
    await seedTenantContent(meninaId, "kamp");

    const setup = async (tenantId: string) => {
      const sections = await db.select().from(sectionsTable).where(eq(sectionsTable.tenantId, tenantId));
      const explore = sections.find((row) => row.key === "explore")!;
      const services = sections.find((row) => row.key === "services")!;
      const standard = await db.select().from(categoriesTable)
        .where(inArray(categoriesTable.sectionId, [explore.id, services.id]));
      const byKey = new Map(standard.map((row) => [row.key, row]));
      await db.update(categoriesTable).set({ position: 30 })
        .where(eq(categoriesTable.id, byKey.get("breakfast")!.id));
      await db.update(categoriesTable).set({ label: "Bolnišnica" })
        .where(eq(categoriesTable.id, byKey.get("hosp")!.id));
      await db.update(translationsTable).set({ value: "Hospital" })
        .where(and(eq(translationsTable.recordId, byKey.get("hosp")!.id), eq(translationsTable.lang, "en")));
      const extras = await db.insert(categoriesTable).values([
        { sectionId: explore.id, key: "food", label: "Hrana in pijača", icon: "fork", layout: "poi", position: 20 },
        { sectionId: explore.id, key: "sights", label: "Znamenitosti", icon: "pin", layout: "poi", position: 21 },
        { sectionId: services.id, key: "health", label: "Zdravje", icon: "hosp", layout: "poi", position: 20 },
        { sectionId: services.id, key: "transport", label: "Prevozi", icon: "car", layout: "poi", position: 21 },
      ]).returning();
      return { byKey, extras: new Map(extras.map((row) => [row.key, row])) };
    };

    const gril = await setup(grilId);
    const [sightItem] = await db.insert(itemsTable).values({
      categoryId: gril.extras.get("sights")!.id,
      title: "Jama Pekel",
      body: "Kraška jama.",
      position: 0,
    }).returning();
    await db.insert(itemCategoryAttachmentsTable).values({
      itemId: sightItem!.id,
      categoryId: gril.extras.get("sights")!.id,
    });
    await db.insert(publishedSnapshotsTable).values({ tenantId: grilId, content: { fixture: "gril" } });

    const menina = await setup(meninaId);
    await db.insert(publishedSnapshotsTable).values({ tenantId: meninaId, content: { fixture: "menina" } });
    const rules: ProposalRekeyRule[] = [
      { id: randomUUID(), expectedName: "Gostilna Pri Kumru", sourceKey: "food", targetKey: "culinary" },
      { id: randomUUID(), expectedName: "Gostilna Čater", sourceKey: "food", targetKey: "culinary" },
      { id: randomUUID(), expectedName: "Hiša Raduha", sourceKey: "food", targetKey: "culinary" },
      { id: randomUUID(), expectedName: "Lekarna Mozirje", sourceKey: "health", targetKey: "pharm" },
      { id: randomUUID(), expectedName: "Zdravstveni dom Mozirje", sourceKey: "health", targetKey: "hosp" },
    ];
    const isolatedStaleRule: ProposalRekeyRule = {
      id: randomUUID(),
      expectedName: "Neodobren spremenjen predlog",
      sourceKey: "food",
      targetKey: "culinary",
    };
    const untouched = [
      { id: randomUUID(), name: "Fontana piv Zeleno zlato" },
      { id: randomUUID(), name: "Pivovarna Laško" },
    ];
    await db.insert(creatorPlaceProposalsTable).values([
      ...rules.map((rule) => ({
        id: rule.id,
        tenantId: meninaId,
        runId: randomUUID(),
        categoryId: menina.extras.get(rule.sourceKey)!.id,
        proposedName: rule.expectedName,
        normalizedName: rule.expectedName.toLowerCase(),
        originalQuery: rule.expectedName,
        status: "unresolved",
        refusalReason: "fixture-unresolved",
      })),
      {
        id: isolatedStaleRule.id,
        tenantId: meninaId,
        runId: randomUUID(),
        categoryId: menina.extras.get("food")!.id,
        proposedName: isolatedStaleRule.expectedName,
        normalizedName: isolatedStaleRule.expectedName.toLowerCase(),
        originalQuery: isolatedStaleRule.expectedName,
        status: "pending",
      },
      ...untouched.map((proposal) => ({
        id: proposal.id,
        tenantId: meninaId,
        runId: randomUUID(),
        categoryId: menina.extras.get("food")!.id,
        proposedName: proposal.name,
        normalizedName: proposal.name.toLowerCase(),
        originalQuery: proposal.name,
      })),
    ]);

    const before = {
      grilItems: await db.select().from(itemsTable).where(eq(itemsTable.categoryId, gril.extras.get("sights")!.id)),
      proposals: await db.select().from(creatorPlaceProposalsTable).where(eq(creatorPlaceProposalsTable.tenantId, meninaId)),
      snapshots: await db.select().from(publishedSnapshotsTable).where(inArray(publishedSnapshotsTable.tenantId, tenantIds)),
    };
    const grilResult = await alignTenantSkeleton(grilId);
    const meninaResult = await alignTenantSkeleton(meninaId, { fixtureProposalRules: [...rules, isolatedStaleRule] });
    assert.ok(grilResult && meninaResult);
    assert.equal(grilResult.counts.itemMoves, 0);
    assert.equal(meninaResult.counts.proposalsRekeyed, 5);
    assert.equal(meninaResult.counts.itemMoves, 0);
    assert.ok(meninaResult.skipped.some((row) =>
      row.key === `proposal:${isolatedStaleRule.id}` && row.reason.includes("nedotaknjen")));
    assert.equal((await db.select().from(itemsTable)
      .where(eq(itemsTable.categoryId, gril.extras.get("sights")!.id))).length, before.grilItems.length);
    assert.equal((await db.select().from(creatorPlaceProposalsTable)
      .where(eq(creatorPlaceProposalsTable.tenantId, meninaId))).length, before.proposals.length);
    assert.deepEqual(
      await db.select().from(publishedSnapshotsTable).where(inArray(publishedSnapshotsTable.tenantId, tenantIds)),
      before.snapshots,
    );
    const moved = await db.select().from(creatorPlaceProposalsTable)
      .where(inArray(creatorPlaceProposalsTable.id, rules.map((rule) => rule.id)));
    for (const rule of rules) {
      const after = moved.find((row) => row.id === rule.id)!;
      const beforeProposal = before.proposals.find((row) => row.id === rule.id)!;
      assert.equal(after.categoryId, menina.byKey.get(rule.targetKey)!.id);
      assert.equal(after.updatedAt.getTime(), beforeProposal.updatedAt.getTime(), "re-key preserves queue/audit timestamp");
    }
    const stillFood = await db.select().from(creatorPlaceProposalsTable)
      .where(inArray(creatorPlaceProposalsTable.id, untouched.map((proposal) => proposal.id)));
    assert.ok(stillFood.every((row) => row.categoryId === menina.extras.get("food")!.id));
    const activeMeninaExtras = await db.select().from(categoriesTable).where(and(
      inArray(categoriesTable.id, [...menina.extras.values()].map((row) => row.id)),
      isNull(categoriesTable.deletedAt),
    ));
    assert.deepEqual(activeMeninaExtras.map((row) => row.key).sort(), ["food", "sights"]);
    const [retiredHealth] = await db.select().from(categoriesTable)
      .where(eq(categoriesTable.id, menina.extras.get("health")!.id));
    assert.equal(retiredHealth!.isVisible, true, "retirement preserves the independent visibility setting");
    assert.equal((await db.select().from(categoriesTable)
      .where(eq(categoriesTable.id, menina.extras.get("sights")!.id)))[0]!.position, 13);

    const grilReplay = await alignTenantSkeleton(grilId);
    const meninaReplay = await alignTenantSkeleton(meninaId, { fixtureProposalRules: [...rules, isolatedStaleRule] });
    assert.equal(grilReplay!.changed, false);
    assert.deepEqual(grilReplay!.counts, {
      categoriesUpdated: 0, translationsUpdated: 0, categoriesRetired: 0, proposalsRekeyed: 0, itemMoves: 0,
    });
    assert.equal(meninaReplay!.changed, false);
    assert.equal(meninaReplay!.counts.proposalsRekeyed, 0);
    assert.match(meninaReplay!.summary, /Ni novih odobrenih sprememb/);
  } finally {
    await db.delete(tenantsTable).where(inArray(tenantsTable.id, tenantIds));
  }
});