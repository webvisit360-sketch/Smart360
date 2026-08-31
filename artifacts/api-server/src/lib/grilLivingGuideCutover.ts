import { eq, sql } from "drizzle-orm";
import { db, tenantsTable } from "@workspace/db";
import { logger } from "./logger";

export type LegacyTenantLivingGuideTarget = {
  id: string;
  name: string;
  slug: string;
};

const APPROVED_TARGETS: readonly LegacyTenantLivingGuideTarget[] = [{
  id: "177e633a-6030-4eca-8ce8-e0a0afdff599",
  name: "Piknik prostor in kamp Gril",
  slug: "glamping-gril",
}, {
  id: "e0303a50-aeba-4ff2-a919-1e2558df55f3",
  name: "Camping MENINA",
  slug: "camping-menina",
}];

export type LegacyTenantLivingGuideCutoverResult =
  | { outcome: "updated" | "already-applied"; guestUiMode: "living-guide" }
  | { outcome: "skipped"; guestUiMode: string | null; reason: string };

export async function applyLegacyTenantLivingGuideCutover(
  target: LegacyTenantLivingGuideTarget,
): Promise<LegacyTenantLivingGuideCutoverResult> {
  // Raw SQL is intentional: the Drizzle tenant model has an automatic
  // updated_at hook, while this approved correction may change only the mode.
  const changed = await db.execute(sql`
    UPDATE "tenants"
    SET "guest_ui_mode" = 'living-guide'
    WHERE "id" = ${target.id}::uuid
      AND "name" = ${target.name}
      AND "slug" = ${target.slug}
      AND "guest_ui_mode" = 'legacy'
  `);

  if ((changed.rowCount ?? 0) === 1) {
    return { outcome: "updated", guestUiMode: "living-guide" };
  }

  const [current] = await db
    .select({
      name: tenantsTable.name,
      slug: tenantsTable.slug,
      guestUiMode: tenantsTable.guestUiMode,
    })
    .from(tenantsTable)
    .where(eq(tenantsTable.id, target.id))
    .limit(1);

  if (
    current?.name === target.name
    && current.slug === target.slug
    && current.guestUiMode === "living-guide"
  ) {
    return { outcome: "already-applied", guestUiMode: "living-guide" };
  }

  return {
    outcome: "skipped",
    guestUiMode: current?.guestUiMode ?? null,
    reason: current
      ? "target identity or source mode no longer matches the approved cutover"
      : "approved tenant ID does not exist",
  };
}

export async function runLegacyTenantLivingGuideCutoversAtStartup(
  options: {
    nodeEnv?: string;
    isDeployment?: boolean;
    targets?: readonly LegacyTenantLivingGuideTarget[];
  } = {},
): Promise<void> {
  const nodeEnv = options.nodeEnv ?? process.env["NODE_ENV"];
  const isDeployment = options.isDeployment ?? Boolean(process.env["REPLIT_DEPLOYMENT"]);
  if (nodeEnv !== "production" || !isDeployment) return;
  for (const target of options.targets ?? APPROVED_TARGETS) {
    try {
      const result = await applyLegacyTenantLivingGuideCutover(target);
      if (result.outcome === "updated") {
        logger.info({ target }, "[legacyTenantLivingGuideCutover] switched approved tenant to Living Guide");
      } else if (result.outcome === "skipped") {
        logger.error({ target, result }, "[legacyTenantLivingGuideCutover] approved target did not match");
      }
    } catch (err) {
      logger.error({ target, err }, "[legacyTenantLivingGuideCutover] failed (boot continues)");
    }
  }
}