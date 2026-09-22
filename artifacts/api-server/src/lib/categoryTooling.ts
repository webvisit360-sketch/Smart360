import { categoriesTable, db } from "@workspace/db";
import { eq } from "drizzle-orm";
import { sanitizePlain } from "./sanitizeBody";

type CategoryExecutor = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

export type CategoryToolingInput = {
  label: string;
  icon: string;
  layout: string;
  exploreGroup: string;
  position?: number;
  key?: string;
};

/**
 * Shared category creation primitive used by both the operator route and
 * system-owned onboarding submission. Auditing remains the caller's concern
 * because the two actor/provenance models differ.
 */
export async function createCategoryWithTooling(
  executor: CategoryExecutor,
  sectionId: string,
  input: CategoryToolingInput,
) {
  const existing = await executor
    .select({ position: categoriesTable.position })
    .from(categoriesTable)
    .where(eq(categoriesTable.sectionId, sectionId));
  const position =
    input.position ??
    (existing.length ? Math.max(...existing.map((category) => category.position)) + 1 : 0);
  const [category] = await executor
    .insert(categoriesTable)
    .values({
      sectionId,
      key: input.key,
      label: sanitizePlain(input.label),
      icon: input.icon,
      layout: input.layout,
      exploreGroup: input.exploreGroup,
      position,
    })
    .returning();
  if (!category) throw new Error("Kategorije ni bilo mogoče ustvariti.");
  return category;
}
