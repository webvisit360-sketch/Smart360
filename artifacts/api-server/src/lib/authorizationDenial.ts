import type { Request, Response } from "express";
import { pool } from "@workspace/db";
import { logger } from "./logger";

/**
 * Record authorization denials in the same durable audit stores as login
 * events. Never retain the request body, rejected values, query, or user-agent.
 * The shared pool is intentional: a host-scoped RLS connection must not write
 * operator security audit data.
 */
export async function recordAuthorizationDenial(
  req: Request,
  options: { reason: string; fields?: string[]; tenantId?: string | null; route?: string },
): Promise<void> {
  const actor = req.actor;
  const detail = JSON.stringify({
    actor: actor?.kind ?? "anonymous",
    method: req.method.toUpperCase(),
    route: options.route ?? req.route?.path ?? req.path,
    reason: options.reason,
    fields: options.fields ?? [],
    tenantId: options.tenantId ?? (actor?.kind === "host" ? actor.tenantId : null),
  });
  const ip = actor?.requestIp ?? req.ip ?? null;
  try {
    if (actor?.kind === "host") {
      await pool.query(
        "INSERT INTO host_auth_events (host_user_id, type, detail, ip) VALUES ($1, $2, $3, $4)",
        [actor.hostUserId, "authorization_denied", detail, ip],
      );
    } else {
      await pool.query(
        "INSERT INTO admin_auth_events (type, detail, ip) VALUES ($1, $2, $3)",
        ["authorization_denied", detail, ip],
      );
    }
  } catch (err) {
    // Audit outages must never grant access or turn a denial into a 500.
    logger.error({ errName: err instanceof Error ? err.name : "Error" }, "[authorization] audit write failed");
  }
}

/** Send an explicit 403, optionally preserving the caller's existing message. */
export async function denyAuthorization(
  req: Request,
  res: Response,
  options: { reason: string; fields?: string[]; tenantId?: string | null; route?: string; message?: string },
): Promise<void> {
  await recordAuthorizationDenial(req, options);
  res.status(403).json({ error: options.message ?? "Samo za operaterja Smart360." });
}