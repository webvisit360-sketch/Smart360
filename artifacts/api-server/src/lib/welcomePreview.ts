import { db, hostMembershipsTable, hostUsersTable, tenantsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { rpOrigin } from "./adminAuth";
import { buildWelcomeEmailBody } from "./lifecycleEmails";

/** Deliberately shorter than the activation endpoint's minimum token length. */
export const WELCOME_PREVIEW_TOKEN = "preview-only";

export async function getWelcomePreview(tenantId: string) {
  const [tenant] = await db
    .select({ propertyName: tenantsTable.name, recipient: hostUsersTable.email })
    .from(tenantsTable)
    .leftJoin(hostMembershipsTable, eq(hostMembershipsTable.tenantId, tenantsTable.id))
    .leftJoin(hostUsersTable, eq(hostUsersTable.id, hostMembershipsTable.hostUserId))
    .where(eq(tenantsTable.id, tenantId))
    .limit(1);
  if (!tenant) return null;
  // Same pure renderer and inputs as send-invite. No invitation or mail provider access.
  const { subject, html, text } = buildWelcomeEmailBody({
    to: tenant.recipient ?? "",
    propertyName: tenant.propertyName,
    setPasswordUrl: `${rpOrigin()}/portal/povabilo?token=${encodeURIComponent(WELCOME_PREVIEW_TOKEN)}`,
  }, "");
  return { ...tenant, subject, html, text };
}