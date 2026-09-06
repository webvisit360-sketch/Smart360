const PUBLICATION_CONTROL_FIELDS = new Set([
  "isPublished",
  "publishNow",
  "hasUnpublishedChanges",
  "firstPublishedAt",
  "lastPublishedAt",
]);

function sameValue(left: unknown, right: unknown): boolean {
  if (Array.isArray(left) || Array.isArray(right)) {
    return JSON.stringify(left ?? null) === JSON.stringify(right ?? null);
  }
  return (left ?? null) === (right ?? null);
}

export function hasTenantAdminChanges(
  before: Record<string, unknown>,
  patch: Record<string, unknown>,
): boolean {
  for (const [field, value] of Object.entries(patch)) {
    if (PUBLICATION_CONTROL_FIELDS.has(field) || value === undefined) continue;
    if (!sameValue(before[field], value)) return true;
  }
  return false;
}