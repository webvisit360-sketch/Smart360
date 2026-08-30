import { and, asc, eq, isNull, or, sql } from "drizzle-orm";
import {
  categoriesTable,
  creatorRunsTable,
  db,
  sectionsTable,
  tenantAliasesTable,
  tenantsTable,
} from "@workspace/db";
import { resolveCreatorOrigin } from "./creatorOrigin";
import { runCreatorC1 } from "./creatorC1";
import { logger } from "./logger";
import { RESERVED_SLUGS, slugify } from "./slug";
import { seedTenantContent } from "./tenantSeeds";

const MENINA_NAME = "Camping MENINA";
const MENINA_ADDRESS = "Varpolje 105, 3332 Rečica ob Savinji";
const MENINA_MAP_URL =
  "https://www.google.com/maps/place/Camping+MENINA/@46.3114597,14.9067248,794m/data=!3m2!1e3!4b1!4m9!3m8!1s0x476544b2dceb3c9d:0xfed2eb6fc9373f3d!5m2!4m1!1i2!8m2!3d46.311456!4d14.9093051!16s%2Fg%2F11b76h070l";
const MENINA_LATITUDE = 46.311456;
const MENINA_LONGITUDE = 14.9093051;
export const MENINA_AUTHORIZED_RUN_COUNT = 3;

export function isPreservedMeninaEvidenceTenant(input: {
  name: string;
  latitude: number;
  longitude: number;
}): boolean {
  return input.name.trim().toLocaleLowerCase("sl") === MENINA_NAME.toLocaleLowerCase("sl")
    && Math.abs(input.latitude - MENINA_LATITUDE) <= 0.000001
    && Math.abs(input.longitude - MENINA_LONGITUDE) <= 0.000001;
}

function numberedSlug(base: string, number: number): string {
  if (number === 0) return base;
  const suffix = `-${number + 1}`;
  return `${base.slice(0, 40 - suffix.length).replace(/-+$/g, "")}${suffix}`;
}

async function findOrCreateMeninaDraft(): Promise<string> {
  const existingWhere = or(
    eq(tenantsTable.name, MENINA_NAME),
    and(
      eq(tenantsTable.latitude, MENINA_LATITUDE),
      eq(tenantsTable.longitude, MENINA_LONGITUDE),
    ),
  );
  const validateExisting = (existing: typeof tenantsTable.$inferSelect): string => {
    if (!existing.creatorDraft || existing.isPublished) {
      throw new Error("Camping MENINA exists but is not an unpublished Creator draft.");
    }
    return existing.id;
  };
  const [existingBeforeResolve] = await db.select().from(tenantsTable)
    .where(existingWhere)
    .limit(1);
  if (existingBeforeResolve) return validateExisting(existingBeforeResolve);

  const origin = await resolveCreatorOrigin(MENINA_MAP_URL);
  if (
    Math.abs(origin.lat - MENINA_LATITUDE) > 0.000001 ||
    Math.abs(origin.lng - MENINA_LONGITUDE) > 0.000001
  ) {
    throw new Error("Camping MENINA Maps pin no longer resolves to the approved coordinates.");
  }

  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('creator-c1-menina-production'))`);
    const [existing] = await tx.select().from(tenantsTable).where(existingWhere).limit(1);
    if (existing) return validateExisting(existing);

    let base = slugify(MENINA_NAME).slice(0, 40).replace(/-+$/g, "");
    if (base.length < 3 || RESERVED_SLUGS.has(base)) base = "camping-menina";
    for (let n = 0; n < 1000; n += 1) {
      const slug = numberedSlug(base, n);
      const [reserved] = await tx.select({ slug: tenantAliasesTable.slug })
        .from(tenantAliasesTable)
        .where(eq(tenantAliasesTable.slug, slug))
        .limit(1);
      if (reserved) continue;
      const [tenant] = await tx.insert(tenantsTable).values({
        slug,
        name: MENINA_NAME,
        address: MENINA_ADDRESS,
        mapUrl: origin.expandedUrl,
        latitude: origin.lat,
        longitude: origin.lng,
        tenantType: "kamp",
        creatorDraft: true,
        creatorOriginRegion: origin.nominatimDisplayName,
        isPublished: false,
        firstPublishedAt: null,
      }).onConflictDoNothing().returning({ id: tenantsTable.id });
      if (!tenant) continue;
      await seedTenantContent(tenant.id, "kamp", tx);
      return tenant.id;
    }
    throw new Error("No free slug is available for the Camping MENINA draft.");
  });
}

export async function claimCreatorRunOnce(
  tenantId: string,
  origin: { latitude: number; longitude: number },
  maximumRuns = 1,
): Promise<{
  claimedRunId: string | null;
  existingRun: { id: string; status: string } | null;
}> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(
      hashtextextended(${`creator-c1-once:${tenantId}`}, 0)
    )`);
    const existingRuns = await tx.select({
      id: creatorRunsTable.id,
      status: creatorRunsTable.status,
    }).from(creatorRunsTable)
      .where(eq(creatorRunsTable.tenantId, tenantId))
      .orderBy(asc(creatorRunsTable.createdAt));
    const runningRun = existingRuns.find((run) => run.status === "running");
    if (runningRun) return { existingRun: runningRun, claimedRunId: null };
    if (existingRuns.length >= maximumRuns) {
      return { existingRun: existingRuns.at(-1) ?? null, claimedRunId: null };
    }
    const [claimed] = await tx.insert(creatorRunsTable).values({
      tenantId,
      originLatitude: origin.latitude,
      originLongitude: origin.longitude,
    }).returning({ id: creatorRunsTable.id });
    if (!claimed) throw new Error("Creator C1 run could not be claimed.");
    return { existingRun: null, claimedRunId: claimed.id };
  });
}

/**
 * Exactly the explicitly authorized number of production C1 runs. It never
 * creates a host or invokes invitation/e-mail code, and self-disables when the
 * durable run limit is reached, including failed runs.
 */
export async function runMeninaCreatorC1OnceAtStartup(): Promise<void> {
  if (process.env["NODE_ENV"] !== "production" || !process.env["REPLIT_DEPLOYMENT"]) return;
  try {
    const tenantId = await findOrCreateMeninaDraft();
    const catalogue = await db.select({
      section: sectionsTable.title,
      id: categoriesTable.id,
      key: categoriesTable.key,
      label: categoriesTable.label,
    }).from(categoriesTable)
      .innerJoin(sectionsTable, eq(categoriesTable.sectionId, sectionsTable.id))
      .where(and(
        eq(sectionsTable.tenantId, tenantId),
        isNull(categoriesTable.deletedAt),
      ))
      .orderBy(asc(sectionsTable.position), asc(categoriesTable.position));
    logger.info(
      { tenantId, catalogue },
      "[creatorC1Menina] production category catalogue before run",
    );

    const [tenant] = await db.select({ region: tenantsTable.creatorOriginRegion })
      .from(tenantsTable)
      .where(eq(tenantsTable.id, tenantId))
      .limit(1);
    if (!tenant?.region) throw new Error("Camping MENINA draft has no machine-resolved region.");

    const claim = await claimCreatorRunOnce(tenantId, {
      latitude: MENINA_LATITUDE,
      longitude: MENINA_LONGITUDE,
    }, MENINA_AUTHORIZED_RUN_COUNT);
    if (claim.existingRun) {
      logger.info(
        { tenantId, runId: claim.existingRun.id, status: claim.existingRun.status },
        "[creatorC1Menina] skipped; authorized durable run limit reached or another run is active",
      );
      return;
    }

    const result = await runCreatorC1({
      tenantId,
      claimedRunId: claim.claimedRunId!,
      origin: { latitude: MENINA_LATITUDE, longitude: MENINA_LONGITUDE },
      region: tenant.region,
      tenantType: "kamp",
    });
    logger.info(
      { tenantId, runId: result.runId, report: result.report },
      "[creatorC1Menina] authorized production run completed",
    );
  } catch (error) {
    const databaseCode = (error as { code?: string })?.code;
    if (databaseCode === "23505") {
      logger.info("[creatorC1Menina] skipped; another production instance acquired the run lock");
      return;
    }
    logger.error({ error }, "[creatorC1Menina] authorized production run failed");
  }
}