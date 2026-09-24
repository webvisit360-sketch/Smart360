import { db, changelogTable } from "@workspace/db";
import { currentActor } from "./actorContext";
import { readyError } from "./guideReadyNotice";
import type { ResendResult } from "./resendDelivery";

export type LifecycleKind = "welcome_with_access" | "welcome_without_access" | "guide_ready";
export type LifecycleStatus = {
  kind: LifecycleKind;
  label: string;
  createdAt: string;
  deliveryStatus: "accepted" | "failed";
  archiveStatus: "accepted" | "failed" | "not_attempted";
  deliveryFailure: string | null;
  archiveFailure: string | null;
};

export async function recordLifecycleSend(
  tenantId: string,
  kind: LifecycleKind,
  host: ResendResult,
  archive: ResendResult | null,
): Promise<void> {
  const actor = currentActor();
  const safe = {
    version: 1,
    kind,
    deliveryStatus: host.ok ? "accepted" : "failed",
    archiveStatus: !archive ? "not_attempted" : archive.ok ? "accepted" : "failed",
    deliveryFailure: readyError(host),
    archiveFailure: archive ? readyError(archive) : null,
  };
  await db.insert(changelogTable).values({
    tenantId,
    action: host.ok ? "send" : "send-failed",
    entity: "lifecycle-email",
    summary: kind === "guide_ready" ? "Obvestilo o pripravljenem vodniku." : "Dobrodošlica gostitelju.",
    detail: JSON.stringify(safe),
    actorType: "owner",
    actorLabel: "Smart360",
    requestIp: actor?.requestIp ?? null,
  });
}

export function parseLifecycleHistory(detail: string | null, createdAt: Date): LifecycleStatus | null {
  try {
    const row: unknown = JSON.parse(detail ?? "");
    if (!row || typeof row !== "object") return null;
    const data = row as Record<string, unknown>;
    if (data.version !== 1 || !["welcome_with_access", "welcome_without_access", "guide_ready"].includes(String(data.kind))) return null;
    if (!["accepted", "failed"].includes(String(data.deliveryStatus))) return null;
    if (!["accepted", "failed", "not_attempted"].includes(String(data.archiveStatus))) return null;
    const safeCode = (code: unknown) => typeof code === "string" && /^[a-z_]{1,40}$/.test(code) ? code : null;
    const kind = data.kind as LifecycleKind;
    return {
      kind, label: kind === "guide_ready" ? "vodnik je pripravljen" : kind === "welcome_with_access" ? "dobrodošlica z dostopom" : "dobrodošlica brez dostopa",
      createdAt: createdAt.toISOString(),
      deliveryStatus: data.deliveryStatus as "accepted" | "failed",
      archiveStatus: data.archiveStatus as LifecycleStatus["archiveStatus"],
      deliveryFailure: safeCode(data.deliveryFailure),
      archiveFailure: safeCode(data.archiveFailure),
    };
  } catch { return null; }
}