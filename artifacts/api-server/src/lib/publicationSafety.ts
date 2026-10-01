/** Keep publication provenance monotonic between publications. */
export function operatorDraftAfterWrite(
  pending: boolean,
  actor: "host" | "owner" | "system",
  action: "dirty" | "publish" | "noop",
  selfServicePublish = false,
): boolean {
  if (action === "publish" && (actor === "owner" || (actor === "host" && selfServicePublish))) return false;
  if (action === "dirty" && actor !== "host") return true;
  return pending;
}
