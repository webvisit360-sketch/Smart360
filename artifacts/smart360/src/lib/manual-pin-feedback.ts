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

export type ManualPlaceField = "manualName" | "locationText" | "latitude" | "longitude";
export type ManualPlaceValues = Record<ManualPlaceField, string>;
export type ManualPlaceErrors = Partial<Record<ManualPlaceField, string>>;

export function validateManualPlace(values: ManualPlaceValues): ManualPlaceErrors {
  const errors: ManualPlaceErrors = {};
  if (!values.manualName.trim()) errors.manualName = "Vnesite ime kraja.";
  if (!values.locationText.trim()) errors.locationText = "Vnesite opis lokacije.";

  for (const [field, limit, label] of [
    ["latitude", 90, "širino"],
    ["longitude", 180, "dolžino"],
  ] as const) {
    const value = values[field].trim();
    if (!value) {
      errors[field] = `Vnesite geografsko ${label}.`;
    } else if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(value) || !Number.isFinite(Number(value)) || Math.abs(Number(value)) > limit) {
      errors[field] = `Vnesite veljavno ${label} (−${limit} do ${limit}).`;
    }
  }
  return errors;
}