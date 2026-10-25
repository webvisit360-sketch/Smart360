import type { Request } from "express";
import { isAuthenticated } from "./adminAuth";
import { findHostActor } from "./hostAuth";

export async function canPreviewTenant(req: Request, tenantId: string | undefined): Promise<boolean> {
  if (!tenantId || !["1", "true"].includes(String(req.query.preview))) return false;
  if (await isAuthenticated(req)) return true;
  const host = await findHostActor(req);
  return host?.tenantId === tenantId;
}
