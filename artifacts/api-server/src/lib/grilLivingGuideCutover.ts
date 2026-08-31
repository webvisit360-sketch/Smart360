import { and, eq } from "drizzle-orm";
import { db, tenantsTable } from "@workspace/db";
import { logger } from "./logger";

export type GrilLivingGuideTarget = {
  id: string;
  name: string;
  slug: string;
};

const GRIL_TARGET: GrilLivingGuideTarget = {
  id: "177e633a-6030-4eca-8ce8-e0a0afdff599",
  name: "Piknik prostor in kamp Gril",
  slug: "glamping-gril",
};

export type GrilLivingGuideCutoverResult =
  | { outcome: "updated" | "already-applied"; guestUiMode: "living-guide" }
  | { outcome: "skipped"; guestUiMode: string | null; reason: string };

export async function applyGrilLivingGuideCutover(
  target: GrilLivingGuideTarget = GRIL_TARGET,
): Promise<GrilLivingGuideCutoverResult> {
  const changed = await db
    .update(tenantsTable)
    .set({ guestUiMode: "living-guide" })
    .where(
      and(
        eq(tenantsTable.id, target.id),
        eq(tenantsTable.name, target.name),
        eq(tenantsTable.slug, target.slug),
        eq(tenantsTable.guestUiMode, "legacy"),
      ),
    )
    .returning({ guestUiMode: tenantsTable.guestUiMode });

  if (changed.length === 1) {
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

export async function runGrilLivingGuideCutoverAtStartup(
  options: {
    nodeEnv?: string;
    isDeployment?: boolean;
    target?: GrilLivingGuideTarget;
  } = {},
): Promise<void> {
  const nodeEnv = options.nodeEnv ?? process.env["NODE_ENV"];
  const isDeployment = options.isDeployment ?? Boolean(process.env["REPLIT_DEPLOYMENT"]);
  if (nodeEnv !== "production" || !isDeployment) return;
  try {
    const result = await applyGrilLivingGuideCutover(options.target);
    if (result.outcome === "updated") {
      logger.info("[grilLivingGuideCutover] switched approved tenant to Living Guide");
    } else if (result.outcome === "skipped") {
      logger.error({ result }, "[grilLivingGuideCutover] approved target did not match");
    }
  } catch (err) {
    logger.error({ err }, "[grilLivingGuideCutover] failed (boot continues)");
  }
}