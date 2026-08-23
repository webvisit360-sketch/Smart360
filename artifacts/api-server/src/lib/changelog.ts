import { db, changelogTable } from "@workspace/db";
import { currentActor } from "./actorContext";

/**
 * Every changelog row records WHO made the change (Instruction #28 CP1 §6).
 * Attribution is CENTRAL: it comes from the request's actor context set by
 * the admin gate, so no route can forget it and no host can forge it.
 * Outside any request context (startup backfills, cutovers, sweeps) rows are
 * recorded as 'system'.
 */
export async function logChange(entry: {
  tenantId?: string | null;
  tenantName?: string | null;
  action: string;
  entity: string;
  detail?: string | null;
}): Promise<void> {
  const actor = currentActor();
  const actorType = actor?.kind === "host" ? "host" : actor?.kind === "owner" ? "owner" : "system";
  const actorId = actor?.kind === "host" ? actor.hostUserId : null;
  const actorEmail = actor?.kind === "host" ? actor.email : null;
  // Host-context rows must carry the tenant (RLS WITH CHECK enforces it);
  // fill it from the session when the caller did not pass one.
  const tenantId =
    entry.tenantId ?? (actor?.kind === "host" ? actor.tenantId : null);
  await db.insert(changelogTable).values({
    tenantId,
    tenantName: entry.tenantName ?? null,
    action: entry.action,
    entity: entry.entity,
    detail: entry.detail ?? null,
    actorType,
    actorId,
    actorEmail,
  });
}
