type Identified = { id: string };

export function replaceSavedProposal<T extends Identified>(
  current: T[] | undefined,
  saved: T,
): T[] {
  if (!current) return [saved];
  let replaced = false;
  const next = current.map((proposal) => {
    if (proposal.id !== saved.id) return proposal;
    replaced = true;
    return saved;
  });
  return replaced ? next : [...next, saved];
}

export function mutationErrorMessage(error: unknown): string | null {
  if (!error || typeof error !== "object") return null;
  const data = "data" in error ? error.data : null;
  if (
    data &&
    typeof data === "object" &&
    "error" in data &&
    typeof data.error === "string" &&
    data.error.trim()
  ) {
    return data.error;
  }
  if ("message" in error && typeof error.message === "string" && error.message.trim()) {
    return error.message;
  }
  return null;
}