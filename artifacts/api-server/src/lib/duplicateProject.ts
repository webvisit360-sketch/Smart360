import { randomUUID } from "node:crypto";
import { eq, inArray, or } from "drizzle-orm";
import { db, tenantsTable, sectionsTable, categoriesTable, itemsTable, mediaTable,
  translationsTable, pluralFormsTable, itemCategoryAttachmentsTable, tenantCopyJobsTable, runWithDatabase, type Db } from "@workspace/db";
import { claimSlug } from "./tenantSlugReservations";
import { logChange } from "./changelog";
import { planTenantFiles, TenantDuplicateError } from "./tenantCopyFiles";
import { withCopyLock, removeIncompleteCopyLocked } from "./tenantCopyRecovery";
import { gpxEnvironment } from "../routes/gpx";

/** Copy the actual draft, never reseed it or project it through a published snapshot. */
export async function duplicateProject(sourceId: string, name: string, slug: string) {
  const id = randomUUID();
  return withCopyLock(id, async () => {
    const prepared = await db.transaction(async tx => {
      const [source] = await tx.select().from(tenantsTable).where(eq(tenantsTable.id, sourceId));
      if (!source) throw new TenantDuplicateError("Izvirna nastanitev ni najdena.");
      if (source.copyState !== "ready") throw new TenantDuplicateError("Nedokončane kopije ni mogoče podvojiti.");
      const sections = await tx.select().from(sectionsTable).where(eq(sectionsTable.tenantId, sourceId));
      const categories = sections.length ? await tx.select().from(categoriesTable)
        .where(inArray(categoriesTable.sectionId, sections.map(row => row.id))) : [];
      const items = categories.length ? await tx.select().from(itemsTable)
        .where(inArray(itemsTable.categoryId, categories.map(row => row.id))) : [];
      const media = await tx.select().from(mediaTable).where(or(eq(mediaTable.tenantId, sourceId),
        items.length ? inArray(mediaTable.itemId, items.map(row => row.id)) : undefined));
      const attachments = items.length ? await tx.select().from(itemCategoryAttachmentsTable)
        .where(inArray(itemCategoryAttachmentsTable.itemId, items.map(row => row.id))) : [];
      const ids = new Map<string, string>([[sourceId, id]]);
      for (const row of [...sections, ...categories, ...items, ...media]) ids.set(row.id, randomUUID());
      const translations = await tx.select().from(translationsTable)
        .where(inArray(translationsTable.recordId, [...ids.keys()]));
      const plurals = await tx.select().from(pluralFormsTable).where(eq(pluralFormsTable.tenantId, sourceId));
      const { id: _id, createdAt: _created, updatedAt: _updated, ...settings } = source;
      const tenant = {
        ...settings, id, name, slug, draftSlug: null, customDomain: null,
        managementMode: "concierge", isPublished: false, isTemplate: false,
        firstPublishedAt: null, lastPublishedAt: null, renewsAt: null,
        rating: null, reviewsCount: null, orderPassword: null,
        notificationWhatsappPhone: null, notificationChannel: "email",
        creatorDraft: false, creatorOriginRegion: null,
        copiedFromTenantId: sourceId, hasUnpublishedChanges: true, operatorDraftPending: true,
        mediaQuotaBytes: 2_000_000_000,
        copyState: "copying",
      };
      // Reject unsupported media instead of silently retaining shared files.
      const directUrls = [...media.flatMap(row => [row.url, row.posterUrl]),
        tenant.heroUrl, tenant.livingGuideHeroUrl, tenant.logoUrl, tenant.logoSquareUrl,
        ...sections.map(row => row.imageUrl)].filter(Boolean) as string[];
      // Rich text and translated rich text can also contain uploaded media.
      // Never preserve an unmanaged embedded image as a shared reference.
      const richTexts = [...items.map(row => row.body), ...translations.map(row => row.value)];
      for (const text of richTexts) {
        for (const tag of (text ?? "").matchAll(/<(?:img|video|source)\b[^>]*>/gi)) {
          for (const attr of tag[0].matchAll(/\b(?:src|poster)\s*=\s*["']([^"']+)["']/gi)) directUrls.push(attr[1]);
          if (/\bsrcset\s*=/i.test(tag[0])) throw new TenantDuplicateError("Vdelan srcset je treba pred podvajanjem pretvoriti v naloženo sliko.");
        }
      }
      for (const url of directUrls) {
        if (!/^(?:https?:\/\/[^/]+)?\/api\/storage\/(?:img|video)\/[a-zA-Z0-9-]+\/[\w.-]+(?:\?[^#]*)?$/.test(url)) {
          throw new TenantDuplicateError("Projekt vsebuje medij zunaj upravljane shrambe. Pred podvajanjem ga naložite v projekt.");
        }
      }
      const files = await planTenantFiles({ tenant, sections, categories, items, media, translations, plurals }, sourceId, id, slug);
      if (files.bytes > tenant.mediaQuotaBytes) {
        throw new TenantDuplicateError(`Kopija potrebuje ${files.bytes} bajtov; kvota novega projekta je ${tenant.mediaQuotaBytes} bajtov. Podvajanje ni bilo izvedeno.`);
      }
      return { tenant: files.rewrite(tenant), files, finish: async (tx: Parameters<Parameters<typeof db.transaction>[0]>[0]) => {
      const rewrite = <T>(row: T): T => {
        const remap = (v: any): any => {
          if (v instanceof Date) return v;
          if (typeof v === "string") return ids.get(v) ?? v;
          if (Array.isArray(v)) return v.map(remap);
          if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, value]) => [k, remap(value)]));
          return v;
        };
        return remap(files!.rewrite(row));
      };
      if (sections.length) await tx.insert(sectionsTable).values(sections.map(rewrite));
      if (categories.length) await tx.insert(categoriesTable).values(categories.map(rewrite));
      if (items.length) await tx.insert(itemsTable).values(items.map(rewrite));
      if (media.length) await tx.insert(mediaTable).values(media.map(rewrite));
      if (attachments.length) await tx.insert(itemCategoryAttachmentsTable).values(attachments.map(row => {
        if (!ids.has(row.categoryId)) throw new TenantDuplicateError("Vsebina ima povezavo izven izvirnega projekta.");
        return { ...rewrite(row), id: randomUUID(), sourceProposalId: null, createdAt: new Date() };
      }));
      const copiedTranslations = translations.filter(row =>
        !(row.recordId === sourceId && ["rating", "reviewsCount"].includes(row.field)))
        .map(row => row.recordId === sourceId && row.field === "name" ? { ...row, value: name } : row);
      if (copiedTranslations.length) await tx.insert(translationsTable).values(copiedTranslations.map(row =>
        ({ ...rewrite(row), id: randomUUID(), updatedAt: new Date() })));
      if (plurals.length) await tx.insert(pluralFormsTable).values(plurals.map(row =>
        ({ ...rewrite(row), id: randomUUID() })));
      await runWithDatabase(tx as unknown as Db, () => logChange({
        tenantId: id, tenantName: name, action: "duplicate", entity: "tenant",
        summary: "Ustvarjena je neobjavljena kopija nastanitve.",
      }));
      }};
    }, { isolationLevel: "repeatable read" });
    // Commit the stub AND complete write-ahead manifest before any object write.
    await db.transaction(async tx => {
      await tx.insert(tenantsTable).values(prepared.tenant);
      await claimSlug(tx, slug, id);
      await tx.insert(tenantCopyJobsTable).values({
        tenantId: id, environment: gpxEnvironment(), objectManifest: prepared.files.manifest,
      });
    });
    try {
      await prepared.files.copy();
      return await db.transaction(async tx => {
        await prepared.finish(tx);
        const [created] = await tx.update(tenantsTable).set({ copyState: "ready" })
          .where(eq(tenantsTable.id, id)).returning();
        await tx.delete(tenantCopyJobsTable).where(eq(tenantCopyJobsTable.tenantId, id));
        return created;
      });
    } catch (error) {
      try { await removeIncompleteCopyLocked(id); }
      catch {
        throw new TenantDuplicateError("Kopiranje ni uspelo. Nedokončana kopija ostaja na seznamu; uporabite »Odstrani nedokončano kopijo«.");
      }
      throw error;
    }
  });
}