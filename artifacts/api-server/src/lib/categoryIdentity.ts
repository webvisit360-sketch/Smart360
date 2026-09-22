/** Shared identity fallback for operator alignment and additive startup top-up. */
export function normalizedCategoryName(value: string): string {
  return value.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("sl");
}