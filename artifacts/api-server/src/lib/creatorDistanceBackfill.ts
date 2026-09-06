import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import {
  categoriesTable,
  creatorDistanceBackfillAttemptsTable,
  creatorDistanceBackfillRunsTable,
  creatorOsrmThrottleTable,
  creatorPlaceMaterializationsTable,
  creatorPlaceProposalsTable,
  db,
  itemCategoryAttachmentsTable,
  itemDistanceProposalsTable,
  itemsTable,
  sectionsTable,
  tenantsTable,
} from "@workspace/db";
import {
  computeRoadRoute,
  type FetchFn,
} from "./distanceEngine";
import { recomputedCreatorRange } from "./adminPlaceCreation";

const sleep = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
let osrmQueue: Promise<void> = Promise.resolve();

export class CreatorDistanceBackfillError extends Error {
  constructor(
    message: string,
    readonly kind: "not-found" | "conflict" | "invalid-origin",
  ) {
    super(message);
  }
}

/** One public-OSRM request per second across processes sharing this database. */
export async function acquireCreatorOsrmTurn(): Promise<number> {
  const startedAt = Date.now();
  const turn = osrmQueue.then(async () => {
    await db.transaction(async (tx) => {
      await tx.insert(creatorOsrmThrottleTable).values({ id: 1 }).onConflictDoNothing();
      const [lease] = await tx
        .select()
        .from(creatorOsrmThrottleTable)
        .where(eq(creatorOsrmThrottleTable.id, 1))
        .for("update");
      const wait = 1000 - (Date.now() - (lease?.lastRequestAt?.getTime() ?? 0));
      if (wait > 0) await sleep(wait);
      await tx
        .update(creatorOsrmThrottleTable)
        .set({ lastRequestAt: new Date() })
        .where(eq(creatorOsrmThrottleTable.id, 1));
    });
  });
  osrmQueue = turn.catch(() => undefined);
  await turn;
  return Date.now() - startedAt;
}

type BackfillNamedItem = { itemId: string; itemName: string };
type BackfillFailure = BackfillNamedItem & { reason: string };
export type CreatorDistanceBackfillResult = {
  runId: string;
  computed: number;
  skipped: number;
  noCoordinates: BackfillNamedItem[];
  failures: BackfillFailure[];
};

function itemName(title: string | null): string {
  return title?.replace(/\s+/g, " ").trim() || "Neimenovan vnos";
}

function alreadyHasDistance(row: {
  itemDistanceMeters: number | null;
  itemDistanceText: string | null;
  itemDurationText: string | null;
  proposalDistanceMeters: number | null;
  proposalDurationMinutes: number | null;
  materializationRoadDistanceM: number | null;
  materializationTravelDurationS: number | null;
}): boolean {
  return row.itemDistanceMeters !== null ||
    Boolean(row.itemDistanceText?.trim()) ||
    Boolean(row.itemDurationText?.trim()) ||
    row.proposalDistanceMeters !== null ||
    row.proposalDurationMinutes !== null ||
    row.materializationRoadDistanceM !== null ||
    row.materializationTravelDurationS !== null;
}

export async function backfillCreatorDistances(
  tenantId: string,
  options: {
    fetchFn?: FetchFn;
    acquireTurn?: () => Promise<number>;
  } = {},
): Promise<CreatorDistanceBackfillResult> {
  let setup: {
    origin: { latitude: number; longitude: number };
    run: typeof creatorDistanceBackfillRunsTable.$inferSelect;
  };
  try {
    setup = await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${tenantId}))`);
      const [tenant] = await tx.select({
        latitude: tenantsTable.latitude,
        longitude: tenantsTable.longitude,
        creatorDraft: tenantsTable.creatorDraft,
        creatorOriginRegion: tenantsTable.creatorOriginRegion,
      }).from(tenantsTable).where(eq(tenantsTable.id, tenantId)).limit(1);
      if (!tenant) {
        throw new CreatorDistanceBackfillError("Namestitev ni bila najdena.", "not-found");
      }
      if (
        tenant.creatorDraft !== true
        || !tenant.creatorOriginRegion?.trim()
        || tenant.latitude === null
        || tenant.longitude === null
      ) {
        throw new CreatorDistanceBackfillError(
          "Namestitev nima potrjenega izhodišča Kreatorja za izračun razdalj.",
          "invalid-origin",
        );
      }
      const origin = { latitude: tenant.latitude, longitude: tenant.longitude };
      const [run] = await tx.insert(creatorDistanceBackfillRunsTable).values({
        tenantId,
        originLatitude: origin.latitude,
        originLongitude: origin.longitude,
      }).returning();
      return { origin, run: run! };
    });
  } catch (error) {
    const databaseError = error as { code?: string; constraint?: string };
    if (
      databaseError.code === "23505"
      && databaseError.constraint === "creator_distance_backfill_runs_one_running_uq"
    ) {
      throw new CreatorDistanceBackfillError(
        "Preračun razdalj za to namestitev že poteka.",
        "conflict",
      );
    }
    throw error;
  }
  const { origin, run } = setup;

  const result: CreatorDistanceBackfillResult = {
    runId: run!.id,
    computed: 0,
    skipped: 0,
    noCoordinates: [],
    failures: [],
  };

  try {
    const primaryItems = await db.select({ itemId: itemsTable.id })
      .from(itemsTable)
      .innerJoin(categoriesTable, eq(itemsTable.categoryId, categoriesTable.id))
      .innerJoin(sectionsTable, eq(categoriesTable.sectionId, sectionsTable.id))
      .where(and(
        eq(sectionsTable.tenantId, tenantId),
        inArray(sectionsTable.key, ["explore", "services"]),
        isNull(itemsTable.deletedAt),
        isNull(categoriesTable.deletedAt),
      ));
    const attachedItems = await db.select({ itemId: itemCategoryAttachmentsTable.itemId })
      .from(itemCategoryAttachmentsTable)
      .innerJoin(categoriesTable, eq(itemCategoryAttachmentsTable.categoryId, categoriesTable.id))
      .innerJoin(sectionsTable, eq(categoriesTable.sectionId, sectionsTable.id))
      .innerJoin(itemsTable, eq(itemCategoryAttachmentsTable.itemId, itemsTable.id))
      .where(and(
        eq(sectionsTable.tenantId, tenantId),
        inArray(sectionsTable.key, ["explore", "services"]),
        isNull(itemsTable.deletedAt),
        isNull(categoriesTable.deletedAt),
      ));
    const itemIds = [...new Set([
      ...primaryItems.map((row) => row.itemId),
      ...attachedItems.map((row) => row.itemId),
    ])];

    const rows = itemIds.length === 0
      ? []
      : await db.select({
          itemId: itemsTable.id,
          title: itemsTable.title,
          itemDistanceMeters: itemsTable.distanceMeters,
          itemDistanceText: itemsTable.distance,
          itemDurationText: itemsTable.duration,
          proposalId: itemDistanceProposalsTable.id,
          proposalLatitude: itemDistanceProposalsTable.latitude,
          proposalLongitude: itemDistanceProposalsTable.longitude,
          proposalDistanceMeters: itemDistanceProposalsTable.distanceMeters,
          proposalDurationMinutes: itemDistanceProposalsTable.durationMinutes,
          materializationId: creatorPlaceMaterializationsTable.id,
          materializationProposalId: creatorPlaceMaterializationsTable.proposalId,
          materializationLatitude: creatorPlaceMaterializationsTable.latitude,
          materializationLongitude: creatorPlaceMaterializationsTable.longitude,
          materializationRoadDistanceM: creatorPlaceMaterializationsTable.roadDistanceM,
          materializationTravelDurationS: creatorPlaceMaterializationsTable.travelDurationS,
          creatorRange: creatorPlaceProposalsTable.range,
        })
        .from(itemsTable)
        .leftJoin(
          itemDistanceProposalsTable,
          and(
            eq(itemDistanceProposalsTable.itemId, itemsTable.id),
            eq(itemDistanceProposalsTable.status, "approved"),
          ),
        )
        .leftJoin(
          creatorPlaceMaterializationsTable,
          and(
            eq(creatorPlaceMaterializationsTable.itemId, itemsTable.id),
            eq(creatorPlaceMaterializationsTable.isActive, true),
          ),
        )
        .leftJoin(
          creatorPlaceProposalsTable,
          eq(creatorPlaceProposalsTable.id, creatorPlaceMaterializationsTable.proposalId),
        )
        .where(inArray(itemsTable.id, itemIds));

    const uniqueRows = [...new Map(rows.map((row) => [row.itemId, row])).values()];
    for (const row of uniqueRows) {
      const name = itemName(row.title);
      if (alreadyHasDistance(row)) {
        result.skipped++;
        await db.insert(creatorDistanceBackfillAttemptsTable).values({
          runId: run!.id,
          itemId: row.itemId,
          itemName: name,
          outcome: "skipped",
          reason: "Razdalja ali trajanje je že shranjeno.",
        });
        continue;
      }

      const destination = row.materializationLatitude !== null &&
          row.materializationLongitude !== null
        ? {
            latitude: row.materializationLatitude,
            longitude: row.materializationLongitude,
          }
        : row.proposalLatitude !== null && row.proposalLongitude !== null
          ? { latitude: row.proposalLatitude, longitude: row.proposalLongitude }
          : null;
      if (!destination) {
        result.noCoordinates.push({ itemId: row.itemId, itemName: name });
        await db.insert(creatorDistanceBackfillAttemptsTable).values({
          runId: run!.id,
          itemId: row.itemId,
          itemName: name,
          outcome: "no_coordinates",
          reason: "Vnos nima shranjenih koordinat.",
        });
        continue;
      }

      try {
        await (options.acquireTurn ?? acquireCreatorOsrmTurn)();
        let failureReason = "OSRM ni vrnil veljavne poti.";
        const route = await computeRoadRoute(
          origin,
          destination,
          options.fetchFn ?? fetch,
          (attempt) => {
            if (!attempt.ok && attempt.error) failureReason = attempt.error;
          },
        );
        if (!route) throw new Error(failureReason);
        const roadDistanceM = Math.round(route.distanceMeters);
        const travelDurationS = Math.round(route.durationMinutes * 60);
        const range = recomputedCreatorRange(row.creatorRange, route.durationMinutes);

        const outcome = await db.transaction(async (tx) => {
          await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${tenantId}))`);
          const [currentOrigin] = await tx.select({
            latitude: tenantsTable.latitude,
            longitude: tenantsTable.longitude,
            creatorDraft: tenantsTable.creatorDraft,
            creatorOriginRegion: tenantsTable.creatorOriginRegion,
          }).from(tenantsTable).where(eq(tenantsTable.id, tenantId)).limit(1);
          const originStillMatches = currentOrigin?.creatorDraft === true
            && Boolean(currentOrigin.creatorOriginRegion?.trim())
            && currentOrigin.latitude === origin.latitude
            && currentOrigin.longitude === origin.longitude;
          if (!originStillMatches) {
            const reason = "Potrjeno izhodišče Kreatorja se je med preračunom spremenilo.";
            await tx.insert(creatorDistanceBackfillAttemptsTable).values({
              runId: run.id,
              itemId: row.itemId,
              itemName: name,
              outcome: "failed",
              reason,
              destinationLatitude: destination.latitude,
              destinationLongitude: destination.longitude,
            });
            return { kind: "failed" as const, reason };
          }
          const [currentItem] = await tx.select({
            id: itemsTable.id,
            distanceMeters: itemsTable.distanceMeters,
            distance: itemsTable.distance,
            duration: itemsTable.duration,
          }).from(itemsTable)
            .where(and(eq(itemsTable.id, row.itemId), isNull(itemsTable.deletedAt)))
            .for("update")
            .limit(1);
          if (!currentItem) throw new Error("Vnos med preračunom ni več na voljo.");

          const [currentProposal] = await tx.select()
            .from(itemDistanceProposalsTable)
            .where(and(
              eq(itemDistanceProposalsTable.itemId, row.itemId),
              eq(itemDistanceProposalsTable.status, "approved"),
            ))
            .for("update")
            .limit(1);
          const [currentMaterialization] = await tx.select()
            .from(creatorPlaceMaterializationsTable)
            .where(and(
              eq(creatorPlaceMaterializationsTable.itemId, row.itemId),
              eq(creatorPlaceMaterializationsTable.isActive, true),
            ))
            .for("update")
            .limit(1);
          if (alreadyHasDistance({
            itemDistanceMeters: currentItem.distanceMeters,
            itemDistanceText: currentItem.distance,
            itemDurationText: currentItem.duration,
            proposalDistanceMeters: currentProposal?.distanceMeters ?? null,
            proposalDurationMinutes: currentProposal?.durationMinutes ?? null,
            materializationRoadDistanceM: currentMaterialization?.roadDistanceM ?? null,
            materializationTravelDurationS: currentMaterialization?.travelDurationS ?? null,
          })) {
            await tx.insert(creatorDistanceBackfillAttemptsTable).values({
              runId: run!.id,
              itemId: row.itemId,
              itemName: name,
              outcome: "skipped",
              reason: "Razdalja ali trajanje je bilo med preračunom že shranjeno.",
              destinationLatitude: destination.latitude,
              destinationLongitude: destination.longitude,
            });
            return { kind: "skipped" as const };
          }
          const currentCoordinates = currentMaterialization
            ? {
                latitude: currentMaterialization.latitude,
                longitude: currentMaterialization.longitude,
              }
            : currentProposal?.latitude !== null && currentProposal?.latitude !== undefined &&
                currentProposal.longitude !== null
              ? {
                  latitude: currentProposal.latitude,
                  longitude: currentProposal.longitude,
                }
              : null;
          if (!currentCoordinates ||
              currentCoordinates.latitude !== destination.latitude ||
              currentCoordinates.longitude !== destination.longitude) {
            throw new Error("Koordinate so se med preračunom spremenile.");
          }

          await tx.update(itemsTable).set({
            distanceMeters: roadDistanceM,
            duration: `${Math.round(travelDurationS / 60)} min`,
          }).where(and(eq(itemsTable.id, row.itemId), isNull(itemsTable.distanceMeters)));
          if (currentProposal) {
            await tx.update(itemDistanceProposalsTable).set({
              distanceMeters: roadDistanceM,
              durationMinutes: travelDurationS / 60,
              updatedAt: new Date(),
            }).where(eq(itemDistanceProposalsTable.id, currentProposal.id));
          }
          if (currentMaterialization) {
            await tx.update(creatorPlaceMaterializationsTable).set({
              roadDistanceM,
              travelDurationS,
              range,
              updatedAt: new Date(),
            }).where(eq(creatorPlaceMaterializationsTable.id, currentMaterialization.id));
            await tx.update(creatorPlaceProposalsTable).set({
              roadDistanceM,
              travelDurationS,
              range,
              updatedAt: new Date(),
            }).where(eq(creatorPlaceProposalsTable.id, currentMaterialization.proposalId));
          }
          await tx.insert(creatorDistanceBackfillAttemptsTable).values({
            runId: run!.id,
            itemId: row.itemId,
            itemName: name,
            outcome: "computed",
            destinationLatitude: destination.latitude,
            destinationLongitude: destination.longitude,
            roadDistanceM,
            travelDurationS,
          });
          return { kind: "computed" as const };
        });
        if (outcome.kind === "computed") result.computed++;
        else if (outcome.kind === "skipped") result.skipped++;
        else result.failures.push({
          itemId: row.itemId,
          itemName: name,
          reason: outcome.reason,
        });
      } catch (error) {
        const reason = error instanceof Error ? error.message : "Neznana napaka OSRM.";
        result.failures.push({ itemId: row.itemId, itemName: name, reason });
        await db.insert(creatorDistanceBackfillAttemptsTable).values({
          runId: run!.id,
          itemId: row.itemId,
          itemName: name,
          outcome: "failed",
          reason,
          destinationLatitude: destination.latitude,
          destinationLongitude: destination.longitude,
        });
      }
    }

    await db.update(creatorDistanceBackfillRunsTable).set({
      status: "completed",
      computedCount: result.computed,
      skippedCount: result.skipped,
      noCoordinatesCount: result.noCoordinates.length,
      failureCount: result.failures.length,
      completedAt: new Date(),
    }).where(eq(creatorDistanceBackfillRunsTable.id, run!.id));
    return result;
  } catch (error) {
    await db.update(creatorDistanceBackfillRunsTable).set({
      status: "failed",
      computedCount: result.computed,
      skippedCount: result.skipped,
      noCoordinatesCount: result.noCoordinates.length,
      failureCount: result.failures.length,
      completedAt: new Date(),
    }).where(eq(creatorDistanceBackfillRunsTable.id, run!.id));
    throw error;
  }
}