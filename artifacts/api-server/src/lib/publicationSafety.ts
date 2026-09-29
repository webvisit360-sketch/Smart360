/** Keep publication provenance monotonic between publications. */
export function operatorDraftAfterWrite(
  pending: boolean,
  actor: "host" | "owner" | "system",
  action: "dirty" | "publish" | "noop",
): boolean {
  if (action === "publish" && actor === "owner") return false;
  if (action === "dirty" && actor !== "host") return true;
  return pending;
}

export function hostOperatorDraftPublishDenied(
  actor: "host" | "owner" | "system",
  pending: boolean,
  publishing: boolean,
): boolean {
  return actor === "host" && publishing && pending;
}