import { db, hostMembershipsTable, hostUsersTable, tenantsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { rpOrigin } from "./adminAuth";
import { buildWelcomeEmailBody } from "./lifecycleEmails";
import { renderConciergeWelcomeEmail } from "./conciergeWelcomeEmail";
import { guestUrl } from "./guestUrl";

/** Deliberately shorter than the activation endpoint's minimum token length. */
export const WELCOME_PREVIEW_TOKEN = "preview-only";

export async function getWelcomePreview(tenantId: string) {
  const [tenant] = await db
    .select({
      propertyName: tenantsTable.name,
      recipient: hostUsersTable.email,
      tenantEmail: tenantsTable.email,
      managementMode: tenantsTable.managementMode,
      slug: tenantsTable.slug,
    })
    .from(tenantsTable)
    .leftJoin(hostMembershipsTable, eq(hostMembershipsTable.tenantId, tenantsTable.id))
    .leftJoin(hostUsersTable, eq(hostUsersTable.id, hostMembershipsTable.hostUserId))
    .where(eq(tenantsTable.id, tenantId))
    .limit(1);
  if (!tenant) return null;
  if (tenant.managementMode === "concierge") {
    const body = renderConciergeWelcomeEmail({
      tenantName: tenant.propertyName,
      guideUrl: guestUrl(tenant.slug),
    });
    return {
      propertyName: tenant.propertyName,
      recipient: tenant.tenantEmail,
      managementMode: tenant.managementMode,
      subject: body.subject,
      html: body.html,
      text: body.text,
    };
  }
  // Same pure renderer and inputs as send-invite. No invitation or mail provider access.
  const { subject, html, text } = buildWelcomeEmailBody({
    to: tenant.recipient ?? "",
    propertyName: tenant.propertyName,
    setPasswordUrl: `${rpOrigin()}/portal/povabilo?token=${encodeURIComponent(WELCOME_PREVIEW_TOKEN)}`,
  }, "");
  return {
    propertyName: tenant.propertyName,
    recipient: tenant.recipient,
    managementMode: tenant.managementMode,
    subject,
    html,
    text,
  };
}