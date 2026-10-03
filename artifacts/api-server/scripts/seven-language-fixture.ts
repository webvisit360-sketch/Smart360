import { db, tenantsTable, publishedSnapshotsTable, translationsTable, tenantAnnouncementsTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { buildDraftPublication } from "../src/lib/publishedSnapshots";
const slug = "seven-language-verification";
const [existing] = await db.select().from(tenantsTable).where(eq(tenantsTable.slug, slug));
if (process.argv.includes("--cleanup")) {
  if (existing?.name === "SYNTHETIC seven-language verification") {
    await db.delete(translationsTable).where(and(eq(translationsTable.model, "tenant"), eq(translationsTable.recordId, existing.id)));
    await db.delete(tenantsTable).where(eq(tenantsTable.id, existing.id));
  }
  // The polymorphic translation table has no tenant FK. Recover a previously
  // interrupted cleanup only for this script's exact synthetic marker.
  const orphanMarkers = await db.select().from(translationsTable).where(and(
    eq(translationsTable.model, "tenant"), eq(translationsTable.lang, "en"),
    eq(translationsTable.field, "name"), eq(translationsTable.value, "English fallback verification"),
  ));
  for (const marker of orphanMarkers) {
    const [owner] = await db.select({ id: tenantsTable.id }).from(tenantsTable).where(eq(tenantsTable.id, marker.recordId));
    if (!owner) await db.delete(translationsTable).where(and(eq(translationsTable.model, "tenant"), eq(translationsTable.recordId, marker.recordId)));
  }
  console.log("Synthetic fixture cleanup complete");
  process.exit(0);
}
if (existing) throw new Error("Fixture slug already exists; refusing to overwrite");
const [tenant] = await db.insert(tenantsTable).values({
  slug, name: "SYNTHETIC seven-language verification", guestUiMode: "living-guide", isPublished: true, languages: ["sl"],
}).returning();
try {
  await db.insert(translationsTable).values([
    { model: "tenant", recordId: tenant!.id, field: "name", lang: "en", value: "English fallback verification" },
    { model: "tenant", recordId: tenant!.id, field: "name", lang: "fr", value: "" },
  ]);
  const snapshot = await buildDraftPublication(tenant!);
  await db.insert(publishedSnapshotsTable).values({ tenantId: tenant!.id, content: snapshot });
  await db.insert(tenantAnnouncementsTable).values({
    tenantId: tenant!.id, titleSl: "Slovenski naslov", titleEn: "English fallback title",
    titleFr: "", titleNl: "", titleHr: "", bodySl: "Slovensko besedilo", bodyEn: "English fallback body",
    validFrom: new Date("2026-01-01T00:00:00Z"),
  });
  console.log(`Synthetic DEV fixture ready: /${slug}/home`);
} catch (error) {
  await db.delete(translationsTable).where(and(eq(translationsTable.model, "tenant"), eq(translationsTable.recordId, tenant!.id)));
  await db.delete(tenantsTable).where(eq(tenantsTable.id, tenant!.id));
  throw error;
}
process.exit(0);