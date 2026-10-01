/**
 * Explicit disposable DEV fixture; never run in deployment or against production.
 * seed | theme light | theme dark | cleanup
 * No accounts, passwords, existing tenants or file bytes are modified.
 */
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile, unlink } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { eq } from "drizzle-orm";
import { db, pool, runWithDatabase, tenantsTable, tenantAnnouncementsTable } from "@workspace/db";
import { replacePublishedSnapshot } from "../src/lib/publishedSnapshots";

const marker = "TEST – Obvestila in meni (začasni DEV)";
const manifestPath = resolve(import.meta.dirname, "../../../reports/announcements/dev-fixture.json");
type Manifest = { tenantId: string; slug: string; guestPath: string; announcementIds: string[]; theme: string };
const command = process.argv[2] ?? "seed";
if (process.env.NODE_ENV === "production" || process.env.REPLIT_DEPLOYMENT === "1") {
  throw new Error("Disposable announcements fixture is DEV-only.");
}
if (!process.env.DATABASE_URL) throw new Error("DEV DATABASE_URL is required.");

async function load(): Promise<Manifest | null> {
  try { return JSON.parse(await readFile(manifestPath, "utf8")) as Manifest; }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}
async function verify(fixture: Manifest) {
  if (!fixture.slug.startsWith("announcements-dev-")) throw new Error("Unsafe fixture slug.");
  const [tenant] = await db.select().from(tenantsTable).where(eq(tenantsTable.id, fixture.tenantId));
  if (!tenant || tenant.slug !== fixture.slug || tenant.name !== marker) {
    throw new Error("Fixture identity/marker does not match; refusing to modify any row.");
  }
  return tenant;
}
async function save(fixture: Manifest) {
  await mkdir(dirname(manifestPath), { recursive: true });
  await writeFile(manifestPath, JSON.stringify(fixture, null, 2));
}
async function seed(): Promise<Manifest> {
  const existing = await load();
  if (existing) { await verify(existing); return existing; }
  const slug = `announcements-dev-${randomUUID().slice(0, 8)}`;
  const now = Date.now();
  const domain = process.env.REPLIT_DEV_DOMAIN;
  // Existing project photos, not placeholder/generated media or new storage bytes.
  const image = domain && /^[a-z0-9.-]+$/i.test(domain)
    ? `https://${domain}/images/hero_pool.jpg` : "/images/hero_pool.jpg";
  const fixture = await db.transaction(async (tx) => runWithDatabase(tx, async () => {
    const [tenant] = await tx.insert(tenantsTable).values({
      slug, name: marker, subtitle: "Razvojni preizkus – ni prava nastanitev",
      guestUiMode: "living-guide", isPublished: true, theme: "noc",
      heroUrl: "/images/hero_pool.jpg", livingGuideHeroUrl: "/images/hero_pool.jpg",
      languages: ["sl", "en", "de", "it"], guestDirty: false,
    }).returning();
    if (!tenant) throw new Error("Fixture creation failed.");
    await replacePublishedSnapshot(tenant);
    const shared = { tenantId: tenant.id, validFrom: new Date(now - 86_400_000) };
    const announcements = await tx.insert(tenantAnnouncementsTable).values([
      {
        ...shared, createdAt: new Date(now - 60_000), imageUrl: image,
        titleSl: "Recepcija popoldne zaprta", titleEn: "Reception closed this afternoon",
        titleDe: "Rezeption nachmittags geschlossen", titleIt: "Reception chiusa nel pomeriggio",
        bodySl: "TESTNO OBVESTILO. Danes med 14.00 in 17.00 je recepcija zaprta. To so razvojni testni podatki, ne obvestilo prave nastanitve.",
        bodyEn: "TEST ANNOUNCEMENT. Reception is closed between 14:00 and 17:00. Development test data, not a real property's notice.",
        bodyDe: "TESTMITTEILUNG. Die Rezeption ist zwischen 14:00 und 17:00 geschlossen. Entwicklungsdaten, keine echte Unterkunft.",
        bodyIt: "AVVISO DI TEST. La reception è chiusa tra le 14:00 e le 17:00. Dati di sviluppo, non un avviso reale.",
        validTo: new Date(now + 7 * 86_400_000),
      },
      {
        ...shared, createdAt: new Date(now - 120_000),
        titleDe: "Neuer Sauna-Zeitplan", bodyDe: "TESTMITTEILUNG. Nur Deutsch ausgefüllt: prüft Sprach-Fallback ohne Bild.",
      },
      {
        ...shared, createdAt: new Date(now - 180_000), imageUrl: image,
        titleSl: "Večer risank za otroke ob 20.00", titleEn: "Children's cartoons at 20:00",
        titleDe: "Zeichentrickabend um 20:00", titleIt: "Cartoni per bambini alle 20:00",
        bodySl: "TESTNO OBVESTILO. Razvojni prikaz podrobnosti s fotografijo in brez datuma izteka.",
        bodyEn: "TEST ANNOUNCEMENT. Development image detail with no expiry date.",
        bodyDe: "TESTMITTEILUNG. Detail mit Foto und ohne Ablaufdatum.",
        bodyIt: "AVVISO DI TEST. Dettaglio con fotografia senza data di scadenza.",
      },
      { ...shared, titleSl: "TEST EXPIRED – ne sme biti viden", bodySl: "Expired test row.", validTo: new Date(now - 60_000) },
      { ...shared, titleSl: "TEST DELETED – ne sme biti viden", bodySl: "Soft-deleted test row.", deletedAt: new Date(now - 60_000) },
      { ...shared, titleSl: "TEST FUTURE – ne sme biti viden", bodySl: "Future test row.", validFrom: new Date(now + 86_400_000) },
    ]).returning({ id: tenantAnnouncementsTable.id });
    return { tenantId: tenant.id, slug, guestPath: `/g/${slug}`, announcementIds: announcements.map((a) => a.id), theme: "noc" };
  }));
  await save(fixture);
  return fixture;
}

try {
  if (command === "seed") {
    process.stdout.write(`${JSON.stringify(await seed())}\n`);
  } else {
    const fixture = await load();
    if (!fixture) throw new Error("No disposable fixture manifest exists.");
    await verify(fixture);
    if (command === "cleanup") {
      await db.delete(tenantsTable).where(eq(tenantsTable.id, fixture.tenantId));
      await unlink(manifestPath);
      process.stdout.write("Deleted only the verified disposable DEV tenant and its cascading test data.\n");
    } else if (command === "theme") {
      const mode = process.argv[3];
      if (mode !== "light" && mode !== "dark") throw new Error("Use theme light or theme dark.");
      fixture.theme = mode === "dark" ? "noc" : "mediterran";
      await db.transaction(async (tx) => runWithDatabase(tx, async () => {
        const [tenant] = await tx.update(tenantsTable).set({ theme: fixture.theme, bgColor: null, guestDirty: false })
          .where(eq(tenantsTable.id, fixture.tenantId)).returning();
        if (!tenant) throw new Error("Verified fixture disappeared.");
        await replacePublishedSnapshot(tenant);
      }));
      await save(fixture);
      process.stdout.write(`${JSON.stringify(fixture)}\n`);
    } else {
      throw new Error("Use seed | theme light | theme dark | cleanup.");
    }
  }
} finally {
  await pool.end();
}