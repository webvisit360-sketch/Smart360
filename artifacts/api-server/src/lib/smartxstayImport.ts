import { randomUUID, createHash } from "node:crypto";
import sharp from "sharp";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db, tenantsTable, tenantAliasesTable, sectionsTable, categoriesTable, itemsTable, mediaTable, translationsTable,
  smartxstayImportRunsTable as runs, smartxstayImportSourcesTable as sources, changelogTable } from "@workspace/db";
import { GUIDE_LANGUAGES } from "@workspace/guide-languages";
import { fetchSmartxstay, smartxstayUrl } from "./smartxstayFetch";
import { importedItemState } from "./smartxstayFingerprint";
import { normalizedName, parseSmartxstay, type SourcePage } from "./smartxstayParse";
import { admitImport, invalidateMediaUsage } from "./mediaUsage";
import { storePhotoVariants, deletePhotoVariants, IMG_WIDTHS, JPEG_QUALITY } from "../routes/storage";

export type ImportReport = {
  entries: number; sections: number; categories: number; images: number; bytes: number; sourceBytes: number;
  languages: Record<string, number>; groups: Record<string, number>; skipped: string[]; error?: string;
};
const emptyReport = (): ImportReport => ({ entries: 0, sections: 0, categories: 0, images: 0, bytes: 0, sourceBytes: 0, languages: {}, groups: {}, skipped: [] });
const MAX_TOTAL = 128 * 1024 * 1024;
const MAX_IMAGES = 300;
type Photo = { name: string; width: number; height: number; bytes: number; hash: string };
type Checkpoint = {
  version?: number; pages?: Record<string, { page: SourcePage; bytes: number }>;
  photos?: Record<string, Photo>; uploaded?: string[]; downloaded?: number; cancelling?: boolean;
  contentCursor?: number;
  contentHashes?: Record<string, string>;
};
class YieldStep extends Error {}
const defaultIO = { fetch: fetchSmartxstay, store: (slug: string, name: string, data: Buffer) => storePhotoVariants(slug, name, data, true), remove: (slug: string, name: string) => deletePhotoVariants(slug, name, undefined, true), admit: admitImport };
export type ImportIO = typeof defaultIO;
const sectionKey = (label: string) => {
  const name = normalizedName(label);
  if (/local|recommend|okolica|services|storitve/.test(name)) return "explore";
  if (/bar|ponudba|offer/.test(name)) return "offer";
  if (/guest interaction|kontakt|contact/.test(name)) return "info";
  return "stay";
};

export async function startSmartxstayImport(tenantId: string, value: string) {
  const url = smartxstayUrl(value, true);
  url.search = "?lang=sl"; url.hash = "";
  const [tenant] = await db.select().from(tenantsTable).where(eq(tenantsTable.id, tenantId));
  if (!tenant) throw new Error("Nastanitev ne obstaja.");
  // Recovery is explicit operator action, not startup DDL or automatic fetching.
  const active = await db.select().from(runs).where(and(eq(runs.tenantId, tenantId), sql`${runs.status} IN ('preparing','importing')`));
  if (active.length) throw new Error("Uvoz že poteka. Če se je strežnik med uvozom ustavil, naj operater najprej preveri in počisti evidentirane datoteke.");
  const [run] = await db.insert(runs).values({ tenantId, sourceUrl: url.href, checkpoint: { version: 1 }, report: emptyReport() }).returning();
  return run.id;
}

/** Transaction-scoped advisory lock fences concurrent instances AND cancellation.
 * Unlike an expiring lease alone, it never lets a slow live worker overlap cleanup.
 * Process death releases the lock; checkpoints survive. No background work. */
export async function stepSmartxstayImport(runId: string, tenantId: string, cancel = false, io: ImportIO = defaultIO) {
  // Cancellation intent can be recorded while a step owns the lock. Cleanup
  // cannot begin until that step releases it. Never interrupt an object write.
  if (cancel) {
    const [found] = await db.select({ id: runs.id }).from(runs).where(and(eq(runs.id, runId), eq(runs.tenantId, tenantId)));
    if (!found) throw new Error("Uvoz ne obstaja.");
    await db.update(runs).set({ checkpoint: sql`${runs.checkpoint} || '{"cancelling":true}'::jsonb` })
      .where(and(eq(runs.id, runId), sql`${runs.status} IN ('preparing','importing')`));
  }
  return db.transaction(async lock => {
    const result = await lock.execute(sql`SELECT pg_try_advisory_xact_lock(hashtextextended(${runId}, 731)) AS acquired`);
    if (!result.rows[0]?.acquired) return { busy: true };
    const [run] = await db.select().from(runs).where(and(eq(runs.id, runId), eq(runs.tenantId, tenantId)));
    if (!run) throw new Error("Uvoz ne obstaja.");
    if (["completed", "failed"].includes(run.status)) return { busy: false };
    const checkpoint = run.checkpoint as Checkpoint;
    if (cancel) {
      checkpoint.cancelling = true;
      await db.update(runs).set({ checkpoint, report: { ...emptyReport(), ...run.report as object, error: "Operater je preklical uvoz. Čiščenje poteka." } }).where(eq(runs.id, runId));
    }
    if (checkpoint.cancelling) {
      const manifest = run.objectManifest as { slug: string; name: string }[];
      const object = manifest[0];
      if (object) {
        const [referenced] = await db.select({ id: mediaTable.id }).from(mediaTable)
          .where(eq(mediaTable.url, `/api/storage/img/${object.slug}/${object.name}`)).limit(1);
        if (!referenced) await io.remove(object.slug, object.name);
        await db.update(runs).set({ objectManifest: manifest.slice(1) }).where(eq(runs.id, runId));
      } else {
        await db.update(runs).set({ status: "failed", report: { ...run.report as object, error: ((run.report as ImportReport).error || "Operater je preklical uvoz. Čiščenje končano.").replace("Čiščenje poteka.", "Čiščenje končano.") }, finishedAt: new Date(), leaseToken: null, leaseExpiresAt: null }).where(eq(runs.id, runId));
        invalidateMediaUsage();
      }
      return { busy: false };
    }
    if (checkpoint.version !== 1) throw new Error("Stari obtičani uvoz najprej prekličite.");
    await db.update(runs).set({ leaseToken: randomUUID(), leaseExpiresAt: new Date(Date.now() + 120_000) }).where(eq(runs.id, runId));
    await performSmartxstayImport(runId, tenantId, run.sourceUrl, io);
    await db.update(runs).set({ leaseToken: null, leaseExpiresAt: null }).where(eq(runs.id, runId));
    return { busy: false };
  });
}

async function performSmartxstayImport(runId: string, tenantId: string, sourceUrl: string, io: ImportIO) {
  const [run] = await db.select().from(runs).where(eq(runs.id, runId));
  const checkpoint = run.checkpoint as Checkpoint;
  checkpoint.pages ??= {}; checkpoint.photos ??= {}; checkpoint.uploaded ??= [];
  const report = emptyReport();
  if (checkpoint.contentCursor) {
    const prior = run.report as ImportReport;
    for (const key of ["entries", "sections", "categories", "languages", "groups"] as const) Object.assign(report, { [key]: prior[key] });
  }
  const written = run.objectManifest as { slug: string; name: string }[];
  const saveStep = async () => {
    await db.update(runs).set({ checkpoint: sql`${runs.checkpoint} || ${JSON.stringify(checkpoint)}::jsonb`, report }).where(eq(runs.id, runId));
    throw new YieldStep();
  };
  const loadPage = async (lang: string, url: string) => {
    if (!checkpoint.pages![lang]) {
      const data = await io.fetch(url, 4 * 1024 * 1024);
      checkpoint.pages![lang] = { page: parseSmartxstay(data.toString("utf8"), url), bytes: data.length };
      report.sourceBytes = Object.values(checkpoint.pages!).reduce((n, p) => n + p.bytes, 0);
      await saveStep();
    }
    report.sourceBytes += checkpoint.pages![lang].bytes;
    return checkpoint.pages![lang].page;
  };
  let committed = false;
  let releaseQuota: (() => void) | undefined;
  try {
    const [tenant] = await db.select().from(tenantsTable).where(eq(tenantsTable.id, tenantId));
    if (!tenant) throw new Error("Nastanitev ne obstaja.");
    const base = await loadPage("sl", sourceUrl);
    if (base.lang !== "sl") throw new Error("Vir ne vrne slovenskega izvirnika.");
    const pages = new Map<string, SourcePage>([["sl", base]]);
    // Probe every supported language; a fallback HTML lang is not a translation.
    for (const lang of GUIDE_LANGUAGES.filter(x => x !== "sl")) {
      const url = new URL(sourceUrl); url.searchParams.set("lang", lang);
      const page = await loadPage(lang, url.href);
      if (page.guideId !== base.guideId) throw new Error("Jezikovni vir pripada drugemu vodniku.");
      if (page.lang !== lang || !base.languages.includes(lang)) {
        report.skipped.push(`${lang}: vir tega jezika ne oglašuje oziroma vrne nadomestni jezik.`); continue;
      }
      pages.set(lang, page);
    }
    report.skipped.push(...base.skipped);
    const previous = await db.select().from(sources).where(and(eq(sources.tenantId, tenantId), eq(sources.sourceGuideId, base.guideId), sql`${sources.runId} <> ${runId}`));
    const known = new Set(previous.map(x => x.sourceItemId));
    const entries = base.entries.filter(e => {
      if (!known.has(e.identity)) return true;
      report.skipped.push(`${e.title}: že uvoženo (${e.identity}).`); return false;
    });
    // Preflight ALL assets and exact encoded variant sizes before any content/storage write.
    const urls = [...new Set(entries.flatMap(e => e.images))];
    if (urls.length > MAX_IMAGES) throw new Error(`Preveč slik (${urls.length}; meja ${MAX_IMAGES}).`);
    const photos = new Map<string, Photo>(Object.entries(checkpoint.photos));
    let downloaded = checkpoint.downloaded ?? 0;
    for (const url of urls) {
      if (photos.has(url)) continue;
      const data = await io.fetch(url, 15 * 1024 * 1024);
      downloaded += data.length;
      if (downloaded > MAX_TOTAL) throw new Error("Slike presegajo skupno omejitev 128 MiB.");
      const meta = await sharp(data, { limitInputPixels: 40_000_000 }).metadata();
      if (!meta.width || !meta.height || !["jpeg", "png", "webp", "avif", "gif"].includes(meta.format || ""))
        throw new Error("Vir slike ni podprt ali nima veljavnih dimenzij.");
      let bytes = 0;
      for (const width of IMG_WIDTHS) {
        bytes += (await sharp(data, { limitInputPixels: 40_000_000 }).rotate().resize({ width, withoutEnlargement: true })
          .jpeg({ quality: JPEG_QUALITY[width], mozjpeg: true }).toBuffer()).length;
      }
      checkpoint.photos[url] = { name: `smartxstay-${randomUUID()}.jpg`, width: meta.width, height: meta.height, bytes, hash: createHash("sha256").update(data).digest("hex") };
      checkpoint.downloaded = downloaded;
      await saveStep();
    }
    const aliases = await db.select().from(tenantAliasesTable).where(eq(tenantAliasesTable.tenantId, tenantId));
    const totalBytes = [...photos.values()].reduce((sum, p) => sum + p.bytes, 0);
    const remainingBytes = [...photos.values()].filter(p => !checkpoint.uploaded!.includes(p.name)).reduce((n, p) => n + p.bytes, 0);
    const admission = await io.admit(tenantId, [tenant.slug, ...aliases.map(x => x.slug)], tenant.mediaQuotaBytes, remainingBytes);
    if (!admission.ok)
      throw new Error(`Uvoz zavrnjen pred shranjevanjem: potrebuje ${totalBytes} bajtov; kvota bi bila presežena.`);
    releaseQuota = admission.release;
    await db.update(runs).set({ status: "importing" }).where(eq(runs.id, runId));
    report.images = checkpoint.uploaded.length;
    report.bytes = [...photos.values()].filter(p => checkpoint.uploaded!.includes(p.name)).reduce((n, p) => n + p.bytes, 0);
    for (const [url, photo] of photos) {
      if (checkpoint.uploaded.includes(photo.name)) continue;
      const data = await io.fetch(url, 15 * 1024 * 1024);
      if (createHash("sha256").update(data).digest("hex") !== photo.hash) throw new Error("Izvorna slika se je med uvozom spremenila; ponovite uvoz.");
      if (!written.some(p => p.name === photo.name)) written.push({ slug: tenant.slug, name: photo.name });
      await db.update(runs).set({ objectManifest: written }).where(eq(runs.id, runId));
      await io.store(tenant.slug, photo.name, data);
      checkpoint.uploaded.push(photo.name);
      report.images++; report.bytes += photo.bytes;
      invalidateMediaUsage();
      await saveStep();
    }
    await db.transaction(async tx => {
      // Serialize content insertion with publication and other tenant edits.
      await tx.execute(sql`SELECT id FROM tenants WHERE id = ${tenantId} FOR UPDATE`);
      const sections = await tx.select().from(sectionsTable).where(and(eq(sectionsTable.tenantId, tenantId), isNull(sectionsTable.deletedAt)));
      const categories = await tx.select({ category: categoriesTable }).from(categoriesTable)
        .innerJoin(sectionsTable, eq(categoriesTable.sectionId, sectionsTable.id))
        .where(and(eq(sectionsTable.tenantId, tenantId), isNull(sectionsTable.deletedAt), isNull(categoriesTable.deletedAt)));
      const translations = async (model: string, recordId: string, field: string, lang: string, value: string) => {
        if (value) await tx.insert(translationsTable).values({ model, recordId, field, lang, value }).onConflictDoNothing();
      };
      // One entry per request; its identity, translations, media, report and
      // cursor commit atomically. Retrying after a lost response cannot duplicate.
      const cursor = checkpoint.contentCursor ?? 0;
      for (const entry of entries.slice(cursor, cursor + 1)) {
        let category = categories.find(c => normalizedName(c.category.label) === normalizedName(entry.category))?.category;
        let newCategory = false, newSection = false;
        let section = category ? sections.find(s => s.id === category!.sectionId) : sections.find(s => s.key === sectionKey(entry.section));
        if (!section) {
          [section] = await tx.insert(sectionsTable).values({ tenantId, key: sectionKey(entry.section), title: entry.section, position: sections.length }).returning();
          sections.push(section); report.sections++; newSection = true;
        }
        if (!category) {
          [category] = await tx.insert(categoriesTable).values({ sectionId: section.id, label: entry.category, layout: "cards", position: categories.length }).returning();
          categories.push({ category }); report.categories++; newCategory = true;
        }
        const [position] = await tx.select({ value: sql<number>`coalesce(max(${itemsTable.position}), -1) + 1` }).from(itemsTable).where(eq(itemsTable.categoryId, category.id));
        const [item] = await tx.insert(itemsTable).values({
          categoryId: category.id, title: entry.title, body: entry.body, bullets: entry.bullets,
          phone: entry.phone, website: entry.website, mapQuery: entry.mapQuery, position: Number(position.value),
        }).returning();
        await tx.insert(sources).values({ tenantId, runId, sourceGuideId: base.guideId, sourceItemId: entry.identity,
          sourceUrl: `${sourceUrl}#${entry.pageId}`, itemId: item.id });
        for (const [lang, page] of pages) {
          const translated = page.entries.find(x => x.identity === entry.identity);
          if (!translated) { report.skipped.push(`${entry.title}: brez vnosa v ${lang}.`); continue; }
          report.languages[lang] = (report.languages[lang] || 0) + 1;
          if (lang === "sl") continue;
          if (newCategory) await translations("category", category.id, "label", lang, translated.category);
          if (newSection) await translations("section", section.id, "title", lang, translated.section);
          await translations("item", item.id, "title", lang, translated.title);
          await translations("item", item.id, "body", lang, translated.body);
          for (let i = 0; i < translated.bullets.length; i++) await translations("item", item.id, `bullets[${i}]`, lang, translated.bullets[i]);
        }
        for (let i = 0; i < entry.images.length; i++) {
          const photo = photos.get(entry.images[i])!;
          await tx.insert(mediaTable).values({ tenantId, itemId: item.id, url: `/api/storage/img/${tenant.slug}/${photo.name}`,
            alt: entry.title, position: i, width: photo.width, height: photo.height });
        }
        checkpoint.contentHashes ??= {};
        checkpoint.contentHashes[item.id] = (await importedItemState(tx, item)).hash;
        report.entries++; const group = `${section.title} / ${category.label}`;
        report.groups[group] = (report.groups[group] || 0) + 1;
      }
      report.images = photos.size; report.bytes = totalBytes;
      if (entries.length) {
        await tx.update(tenantsTable).set({ hasUnpublishedChanges: true, operatorDraftPending: true }).where(eq(tenantsTable.id, tenantId));
        await tx.insert(changelogTable).values({ tenantId, action: "create", entity: "content", actorType: "owner", summary: "Uvoz vsebine v osnutek" });
      }
      checkpoint.contentCursor = Math.min(cursor + 1, entries.length);
      const complete = checkpoint.contentCursor >= entries.length;
      await tx.update(runs).set({ status: complete ? "completed" : "importing", report,
        checkpoint: sql`${runs.checkpoint} || ${JSON.stringify(checkpoint)}::jsonb`,
        finishedAt: complete ? new Date() : null }).where(eq(runs.id, runId));
    });
    committed = true;
    invalidateMediaUsage();
  } catch (error) {
    if (error instanceof YieldStep) return;
    if (committed) throw error;
    report.error = error instanceof Error ? error.message : "Uvoz ni uspel.";
    checkpoint.cancelling = true;
    await db.update(runs).set({ checkpoint, report }).where(eq(runs.id, runId));
    invalidateMediaUsage();
  } finally {
    releaseQuota?.();
  }
}
