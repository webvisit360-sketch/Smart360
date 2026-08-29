import { Router, type IRouter, type Request, type Response } from "express";
import { db, enquiriesTable, hostInvitesTable, adminSecurityEmailsTable } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "../lib/logger";
import {
  isUnknownProviderMessage,
  parseResendEmailEvent,
  RESEND_EVENT_STATUSES,
  verifyResendPayload,
} from "../lib/resendWebhook";

const router: IRouter = Router();

const statusSeverity = sql<number>`CASE ${enquiriesTable.deliveryStatus}
  WHEN 'complained' THEN 6
  WHEN 'bounced' THEN 5
  WHEN 'failed' THEN 4
  WHEN 'delivered' THEN 3
  WHEN 'pending' THEN 2
  WHEN 'accepted' THEN 1
  ELSE 0 END`;
const inviteStatusSeverity = sql<number>`CASE ${hostInvitesTable.deliveryStatus}
  WHEN 'complained' THEN 6
  WHEN 'bounced' THEN 5
  WHEN 'failed' THEN 4
  WHEN 'delivered' THEN 3
  WHEN 'pending' THEN 2
  WHEN 'accepted' THEN 1
  ELSE 0 END`;
const securityStatusSeverity = sql<number>`CASE ${adminSecurityEmailsTable.deliveryStatus}
  WHEN 'complained' THEN 6
  WHEN 'bounced' THEN 5
  WHEN 'failed' THEN 4
  WHEN 'delivered' THEN 3
  WHEN 'pending' THEN 2
  WHEN 'accepted' THEN 1
  ELSE 0 END`;

router.post("/", async (req: Request, res: Response): Promise<void> => {
  const secret = process.env["RESEND_WEBHOOK_SECRET"];
  const headers = {
    "svix-id": req.header("svix-id"),
    "svix-timestamp": req.header("svix-timestamp"),
    "svix-signature": req.header("svix-signature"),
  };
  if (!secret || !headers["svix-id"] || !headers["svix-timestamp"] || !headers["svix-signature"]) {
    logger.warn({ webhook: "resend", reason: secret ? "missing_signature_headers" : "missing_secret" }, "Resend webhook rejected");
    res.sendStatus(secret ? 401 : 503);
    return;
  }
  if (!Buffer.isBuffer(req.body)) {
    logger.warn({ webhook: "resend", reason: "missing_raw_body" }, "Resend webhook rejected");
    res.sendStatus(400);
    return;
  }
  const signatureHeaders = {
    "svix-id": headers["svix-id"],
    "svix-timestamp": headers["svix-timestamp"],
    "svix-signature": headers["svix-signature"],
  } as { "svix-id": string; "svix-timestamp": string; "svix-signature": string };

  let verified: unknown;
  try {
    verified = verifyResendPayload(req.body, signatureHeaders, secret);
  } catch {
    logger.warn({ webhook: "resend", reason: "invalid_signature" }, "Resend webhook rejected");
    res.sendStatus(401);
    return;
  }

  const event = parseResendEmailEvent(verified);
  if (!event) {
    logger.warn({ webhook: "resend", reason: "unsupported_event" }, "Resend webhook ignored");
    res.sendStatus(200);
    return;
  }

  const newSeverity = RESEND_EVENT_STATUSES[event.name].severity;
  const enquiryUpdated = await db
    .update(enquiriesTable)
    .set({
      deliveryStatus: event.status,
      providerEventName: event.name,
      providerEventAt: event.occurredAt,
    })
    .where(sql`
      ${enquiriesTable.providerMessageId} = ${event.messageId}
      AND ${enquiriesTable.providerMessageId} IS NOT NULL
      AND (
        ${newSeverity} > ${statusSeverity}
        OR (${newSeverity} = ${statusSeverity} AND (
          ${enquiriesTable.providerEventAt} IS NULL
          OR ${event.occurredAt} > ${enquiriesTable.providerEventAt}
        ))
      )
    `)
    .returning({ id: enquiriesTable.id });

  const inviteUpdated = await db
    .update(hostInvitesTable)
    .set({
      deliveryStatus: event.status,
      providerEventName: event.name,
      providerEventAt: event.occurredAt,
    })
    .where(sql`
      ${hostInvitesTable.providerMessageId} = ${event.messageId}
      AND ${hostInvitesTable.providerMessageId} IS NOT NULL
      AND (
        ${newSeverity} > ${inviteStatusSeverity}
        OR (${newSeverity} = ${inviteStatusSeverity} AND (
          ${hostInvitesTable.providerEventAt} IS NULL
          OR ${event.occurredAt} > ${hostInvitesTable.providerEventAt}
        ))
      )
    `)
    .returning({ id: hostInvitesTable.id });

  const securityUpdated = await db
    .update(adminSecurityEmailsTable)
    .set({
      deliveryStatus: event.status,
      providerEventName: event.name,
      providerEventAt: event.occurredAt,
    })
    .where(sql`
      ${adminSecurityEmailsTable.providerMessageId} = ${event.messageId}
      AND ${adminSecurityEmailsTable.providerMessageId} IS NOT NULL
      AND (
        ${newSeverity} > ${securityStatusSeverity}
        OR (${newSeverity} = ${securityStatusSeverity} AND (
          ${adminSecurityEmailsTable.providerEventAt} IS NULL
          OR ${event.occurredAt} > ${adminSecurityEmailsTable.providerEventAt}
        ))
      )
    `)
    .returning({ id: adminSecurityEmailsTable.id });

  if (enquiryUpdated.length === 0 && inviteUpdated.length === 0 && securityUpdated.length === 0) {
    const [enquiryMatch, inviteMatch, securityMatch] = await Promise.all([
      db.select({ id: enquiriesTable.id }).from(enquiriesTable)
        .where(sql`${enquiriesTable.providerMessageId} = ${event.messageId} AND ${enquiriesTable.providerMessageId} IS NOT NULL`).limit(1),
      db.select({ id: hostInvitesTable.id }).from(hostInvitesTable)
        .where(sql`${hostInvitesTable.providerMessageId} = ${event.messageId} AND ${hostInvitesTable.providerMessageId} IS NOT NULL`).limit(1),
      db.select({ id: adminSecurityEmailsTable.id }).from(adminSecurityEmailsTable)
        .where(sql`${adminSecurityEmailsTable.providerMessageId} = ${event.messageId} AND ${adminSecurityEmailsTable.providerMessageId} IS NOT NULL`).limit(1),
    ]);
    if (isUnknownProviderMessage(
      enquiryMatch.length > 0,
      inviteMatch.length > 0 || securityMatch.length > 0,
    )) {
      logger.warn({ webhook: "resend", eventName: event.name, reason: "unknown_message_id" }, "Resend webhook did not match a delivery record");
    }
  }
  res.sendStatus(200);
});

export default router;