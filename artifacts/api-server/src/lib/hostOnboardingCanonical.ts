import {
  categoriesTable,
  itemsTable,
  mediaTable,
  sectionsTable,
  tenantsTable,
  type HostOnboardingData,
} from "@workspace/db";
import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import { createHash } from "node:crypto";

type Transaction = Parameters<Parameters<typeof import("@workspace/db").db.transaction>[0]>[0];
type Patch = Partial<HostOnboardingData>;

const managedContact = "host-onboarding-contact";
const managedGallery = "host-onboarding-gallery";
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f-]{27}$/i;

function text(value: string | null | undefined): string {
  return value ?? "";
}

function eventParts(value: string | null): { date: string; time: string } {
  if (!value) return { date: "", time: "" };
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/.exec(value);
  return match ? { date: match[1]!, time: match[2]! } : { date: "", time: "" };
}

function checkParts(body: string | null): { checkInFrom: string; checkOutUntil: string } {
  const input = body ?? "";
  return {
    checkInFrom: /Prijava od:\s*([0-2]\d:[0-5]\d)/i.exec(input)?.[1] ?? "",
    checkOutUntil: /Odjava do:\s*([0-2]\d:[0-5]\d)/i.exec(input)?.[1] ?? "",
  };
}

async function rejectForeignIds(
  tx: Transaction,
  incomingIds: string[],
  currentIds: Set<string>,
): Promise<void> {
  const unknownUuids = incomingIds.filter((id) => uuidPattern.test(id) && !currentIds.has(id));
  if (!unknownUuids.length) return;
  const [foreign] = await tx.select({ id: itemsTable.id }).from(itemsTable)
    .where(inArray(itemsTable.id, unknownUuids)).limit(1);
  if (foreign) throw new Error("Element ne pripada tej zbirki ali namestitvi.");
}

export async function readCanonicalHostOnboarding(
  tx: Transaction,
  tenantId: string,
  workflow: HostOnboardingData,
): Promise<HostOnboardingData> {
  const [tenant] = await tx.select().from(tenantsTable)
    .where(eq(tenantsTable.id, tenantId)).limit(1);
  if (!tenant) throw new Error("Namestitev ne obstaja.");
  const sections = await tx.select().from(sectionsTable)
    .where(eq(sectionsTable.tenantId, tenantId)).orderBy(asc(sectionsTable.position));
  const sectionIds = sections.map((row) => row.id);
  const categories = sectionIds.length
    ? await tx.select().from(categoriesTable).where(and(
        inArray(categoriesTable.sectionId, sectionIds),
        isNull(categoriesTable.deletedAt),
      )).orderBy(asc(categoriesTable.position))
    : [];
  const categoryIds = categories.map((row) => row.id);
  const items = categoryIds.length
    ? await tx.select().from(itemsTable).where(and(
        inArray(itemsTable.categoryId, categoryIds),
        isNull(itemsTable.deletedAt),
      )).orderBy(asc(itemsTable.position))
    : [];
  const sectionKey = new Map(sections.map((row) => [row.id, row.key]));
  const categorySection = new Map(categories.map((row) => [row.id, sectionKey.get(row.sectionId)]));
  const categoryKey = new Map(categories.map((row) => [row.id, row.key ?? row.id]));
  const liveTenantItemIds = items.map((row) => row.id);
  const media = liveTenantItemIds.length
    ? await tx.select().from(mediaTable)
        .where(inArray(mediaTable.itemId, liveTenantItemIds))
        .orderBy(asc(mediaTable.position))
    : [];
  const byKey = (key: string) => items.filter((row) => categoryKey.get(row.categoryId) === key);
  const check = checkParts(byKey("check")[0]?.body ?? null);
  const welcome = byKey("welcome");
  const contactRows = welcome.filter((row) =>
    row.noteType === managedContact ||
    row.title?.trim().toLocaleLowerCase() === "kontakt" ||
    Boolean(row.phone) ||
    Boolean(row.website)
  );
  const contacts = contactRows.map((row) => ({
    id: row.id,
    name: row.noteType === managedContact ? text(row.title) : "Kontakt",
    phone: text(row.phone) || text(row.body),
  }));
  const website = contactRows.find((row) => row.website)?.website ?? "";
  const offers = items
    .filter((row) => categorySection.get(row.categoryId) === "offer")
    .map((row) => ({ id: row.id, name: text(row.title), price: text(row.price) }));
  const eventRows = byKey("events");
  const events = eventRows.map((row) => ({
    id: row.id,
    name: text(row.title),
    ...eventParts(row.eventStart),
  }));
  const eventIds = new Set(eventRows.map((row) => row.id));
  const canonicalRecommendations = items
    .filter((row) =>
      ["explore", "services"].includes(categorySection.get(row.categoryId) ?? "") &&
      !eventIds.has(row.id)
    )
    .map((row) => ({
      id: row.id,
      categoryId: categoryKey.get(row.categoryId) ?? row.categoryId,
      name: text(row.title),
    }));
  const canonicalIds = new Set(canonicalRecommendations.map((row) => row.id));
  const pendingHints = (workflow.recommendations ?? []).filter((row) => !canonicalIds.has(row.id));
  return {
    ...workflow,
    accommodationName: tenant.name,
    address: text(tenant.address),
    guestPhone: text(tenant.phone),
    guestEmail: text(tenant.email),
    website,
    ...check,
    contacts,
    wifiName: text(tenant.wifiSsid),
    wifiPassword: text(tenant.wifiPass),
    houseRulesParking: text(byKey("house")[0]?.body),
    offers,
    recommendations: [...canonicalRecommendations, ...pendingHints],
    events,
    media: media.map((row) => ({
      id: row.id,
      itemId: row.itemId,
      kind: row.kind === "video" ? "video" : "image",
      url: row.url,
      alt: text(row.alt),
      position: row.position,
      posterUrl: row.posterUrl,
      durationSec: row.durationSec,
      width: row.width,
      height: row.height,
      focusX: row.focusX,
      focusY: row.focusY,
    })),
    canonicalItems: items.map((row) => ({
      id: row.id,
      categoryId: row.categoryId,
      categoryKey: categoryKey.get(row.categoryId) ?? null,
      sectionKey: categorySection.get(row.categoryId) ?? "",
      title: text(row.title),
      body: text(row.body),
      price: text(row.price),
      priceUnit: text(row.priceUnit),
      phone: text(row.phone),
      website: text(row.website),
      mapQuery: text(row.mapQuery),
      difficulty: text(row.difficulty),
      duration: text(row.duration),
      distance: text(row.distance),
      noteType: text(row.noteType),
      noteText: text(row.noteText),
      bullets: row.bullets,
      tint: text(row.tint),
      frame: text(row.frame),
      isVisible: row.isVisible,
      orderEnabled: row.orderEnabled,
      soldOut: row.soldOut,
      producerName: text(row.producerName),
      producerNote: text(row.producerNote),
    })),
    hero: (tenant.livingGuideHeroUrl || tenant.heroUrl)
      ? {
          url: tenant.livingGuideHeroUrl || tenant.heroUrl || "",
          alt: tenant.name,
          mediaId: media.find((row) =>
            row.url === (tenant.livingGuideHeroUrl || tenant.heroUrl)
          )?.id ?? null,
        }
      : null,
  };
}

export async function canonicalHostOnboardingRevision(
  tx: Transaction,
  tenantId: string,
  lock = false,
): Promise<string> {
  let tenantQuery = tx.select().from(tenantsTable).where(eq(tenantsTable.id, tenantId));
  const tenantRows = lock ? await tenantQuery.for("update") : await tenantQuery;
  const sections = await tx.select().from(sectionsTable)
    .where(eq(sectionsTable.tenantId, tenantId)).orderBy(asc(sectionsTable.id));
  const sectionIds = sections.map((row) => row.id);
  const categories = sectionIds.length
    ? await tx.select().from(categoriesTable)
        .where(inArray(categoriesTable.sectionId, sectionIds)).orderBy(asc(categoriesTable.id))
    : [];
  const categoryIds = categories.map((row) => row.id);
  let itemRows = categoryIds.length
    ? tx.select().from(itemsTable)
        .where(inArray(itemsTable.categoryId, categoryIds)).orderBy(asc(itemsTable.id))
    : null;
  const items = itemRows ? (lock ? await itemRows.for("update") : await itemRows) : [];
  const itemIds = items.map((row) => row.id);
  let mediaRows = itemIds.length
    ? tx.select().from(mediaTable)
        .where(inArray(mediaTable.itemId, itemIds)).orderBy(asc(mediaTable.id))
    : null;
  const media = mediaRows ? (lock ? await mediaRows.for("update") : await mediaRows) : [];
  return createHash("sha256").update(JSON.stringify({
    tenant: tenantRows[0] ?? null,
    sections,
    categories,
    items,
    media,
  })).digest("hex");
}

async function categoryByKey(tx: Transaction, tenantId: string, key: string) {
  const [row] = await tx.select({ id: categoriesTable.id }).from(categoriesTable)
    .innerJoin(sectionsTable, eq(categoriesTable.sectionId, sectionsTable.id))
    .where(and(
      eq(sectionsTable.tenantId, tenantId),
      eq(categoriesTable.key, key),
      isNull(categoriesTable.deletedAt),
    )).orderBy(asc(categoriesTable.position)).limit(1);
  return row ?? null;
}

async function firstCategoryInSection(tx: Transaction, tenantId: string, key: string) {
  const [row] = await tx.select({ id: categoriesTable.id }).from(categoriesTable)
    .innerJoin(sectionsTable, eq(categoriesTable.sectionId, sectionsTable.id))
    .where(and(
      eq(sectionsTable.tenantId, tenantId),
      eq(sectionsTable.key, key),
      isNull(categoriesTable.deletedAt),
    )).orderBy(asc(categoriesTable.position)).limit(1);
  return row ?? null;
}

async function upsertSingleton(
  tx: Transaction,
  tenantId: string,
  key: string,
  title: string,
  updates: Partial<typeof itemsTable.$inferInsert>,
) {
  const category = await categoryByKey(tx, tenantId, key);
  if (!category) throw new Error(`Manjka kategorija ${key}.`);
  const [existing] = await tx.select().from(itemsTable).where(and(
    eq(itemsTable.categoryId, category.id),
    isNull(itemsTable.deletedAt),
  )).orderBy(asc(itemsTable.position)).limit(1).for("update");
  if (existing) {
    await tx.update(itemsTable).set(updates).where(eq(itemsTable.id, existing.id));
    return existing.id;
  }
  const [created] = await tx.insert(itemsTable).values({
    categoryId: category.id,
    title,
    position: 0,
    ...updates,
  }).returning({ id: itemsTable.id });
  return created!.id;
}

async function replaceContacts(
  tx: Transaction,
  tenantId: string,
  contacts: HostOnboardingData["contacts"],
  website: string | undefined,
) {
  const category = await categoryByKey(tx, tenantId, "welcome");
  if (!category) throw new Error("Manjka kategorija Dobrodošli.");
  const current = await tx.select().from(itemsTable).where(and(
    eq(itemsTable.categoryId, category.id),
    isNull(itemsTable.deletedAt),
    sql`(${itemsTable.noteType} = ${managedContact} OR lower(trim(coalesce(${itemsTable.title}, ''))) = 'kontakt')`,
  )).for("update");
  const currentById = new Map(current.map((row) => [row.id, row]));
  await rejectForeignIds(tx, contacts.map((row) => row.id), new Set(currentById.keys()));
  const retained: string[] = [];
  for (const [position, contact] of contacts.entries()) {
    const existing = currentById.get(contact.id);
    const values = {
      title: contact.name,
      phone: contact.phone,
      body: null,
      website: position === 0 ? (website ?? existing?.website ?? null) : null,
      noteType: managedContact,
      position,
      deletedAt: null,
    };
    if (existing) {
      await tx.update(itemsTable).set(values).where(eq(itemsTable.id, existing.id));
      retained.push(existing.id);
    } else {
      const [created] = await tx.insert(itemsTable).values({
        categoryId: category.id,
        ...values,
      }).returning({ id: itemsTable.id });
      retained.push(created!.id);
    }
  }
}

async function replaceItems(
  tx: Transaction,
  tenantId: string,
  sectionKey: string,
  incoming: Array<{ id: string; name: string; price?: string; date?: string; time?: string }>,
) {
  const sectionCategories = await tx.select({ id: categoriesTable.id }).from(categoriesTable)
    .innerJoin(sectionsTable, eq(categoriesTable.sectionId, sectionsTable.id))
    .where(and(
      eq(sectionsTable.tenantId, tenantId),
      eq(sectionsTable.key, sectionKey),
      isNull(categoriesTable.deletedAt),
    )).orderBy(asc(categoriesTable.position));
  if (!sectionCategories.length) throw new Error(`Manjka razdelek ${sectionKey}.`);
  const ids = sectionCategories.map((row) => row.id);
  const current = await tx.select().from(itemsTable).where(and(
    inArray(itemsTable.categoryId, ids),
    isNull(itemsTable.deletedAt),
  )).for("update");
  const byId = new Map(current.map((row) => [row.id, row]));
  await rejectForeignIds(tx, incoming.map((row) => row.id), new Set(byId.keys()));
  const retained: string[] = [];
  for (const [position, row] of incoming.entries()) {
    const existing = byId.get(row.id);
    const values = {
      title: row.name,
      price: row.price ?? null,
      eventStart: row.date && row.time ? `${row.date}T${row.time}:00` : null,
      position,
      deletedAt: null,
    };
    if (existing) {
      await tx.update(itemsTable).set(values).where(eq(itemsTable.id, existing.id));
      retained.push(existing.id);
    } else {
      const [created] = await tx.insert(itemsTable).values({
        categoryId: ids[0]!,
        ...values,
      }).returning({ id: itemsTable.id });
      retained.push(created!.id);
    }
  }
}

async function applyCanonicalItems(
  tx: Transaction,
  tenantId: string,
  rows: NonNullable<Patch["canonicalItems"]>,
) {
  const incomingIds = rows.map((row) => row.id);
  const owned = incomingIds.length
    ? await tx.select({ id: itemsTable.id }).from(itemsTable)
        .innerJoin(categoriesTable, eq(itemsTable.categoryId, categoriesTable.id))
        .innerJoin(sectionsTable, eq(categoriesTable.sectionId, sectionsTable.id))
        .where(and(
          eq(sectionsTable.tenantId, tenantId),
          inArray(itemsTable.id, incomingIds),
        )).for("update")
    : [];
  if (owned.length !== new Set(incomingIds).size) {
    throw new Error("Kanonični element ne pripada tej namestitvi.");
  }
  for (const row of rows) {
    await tx.update(itemsTable).set({
      title: row.title || null,
      body: row.body || null,
      price: row.price || null,
      priceUnit: row.priceUnit || null,
      phone: row.phone || null,
      website: row.website || null,
      mapQuery: row.mapQuery || null,
      difficulty: row.difficulty || null,
      duration: row.duration || null,
      distance: row.distance || null,
      noteType: row.noteType || null,
      noteText: row.noteText || null,
      bullets: row.bullets,
      tint: row.tint || null,
      frame: row.frame || null,
      isVisible: row.isVisible,
      orderEnabled: row.orderEnabled,
      soldOut: row.soldOut,
      producerName: row.producerName || null,
      producerNote: row.producerNote || null,
    }).where(eq(itemsTable.id, row.id));
  }
}

export async function applyCanonicalHostOnboardingPatch(
  tx: Transaction,
  tenantId: string,
  patch: Patch,
): Promise<void> {
  // Apply the complete rich/opaque item view first. Named onboarding fields
  // below intentionally win when both representations are present in a full
  // submit payload.
  if (patch.canonicalItems !== undefined) {
    await applyCanonicalItems(tx, tenantId, patch.canonicalItems);
  }
  const tenantUpdates: Partial<typeof tenantsTable.$inferInsert> = {};
  if (patch.accommodationName !== undefined) tenantUpdates.name = patch.accommodationName;
  if (patch.address !== undefined) tenantUpdates.address = patch.address || null;
  if (patch.guestPhone !== undefined) tenantUpdates.phone = patch.guestPhone || null;
  if (patch.guestEmail !== undefined) tenantUpdates.email = patch.guestEmail || null;
  if (patch.wifiName !== undefined) tenantUpdates.wifiSsid = patch.wifiName || null;
  if (patch.wifiPassword !== undefined) tenantUpdates.wifiPass = patch.wifiPassword || null;
  if (Object.keys(tenantUpdates).length) {
    await tx.update(tenantsTable).set({
      ...tenantUpdates,
      hasUnpublishedChanges: true,
    }).where(eq(tenantsTable.id, tenantId));
  }
  if (patch.contacts !== undefined || patch.website !== undefined) {
    const canonical = await readCanonicalHostOnboarding(tx, tenantId, {
      accommodationName: "", address: "", guestPhone: "", guestEmail: "", website: "",
      checkInFrom: "", checkOutUntil: "", contacts: [], wifiName: "", wifiPassword: "",
      houseRulesParking: "", offers: [], recommendations: [], customCategories: [], events: [],
    });
    await replaceContacts(
      tx,
      tenantId,
      patch.contacts ?? canonical.contacts,
      patch.website ?? canonical.website,
    );
  }
  if (patch.checkInFrom !== undefined || patch.checkOutUntil !== undefined) {
    const canonical = await readCanonicalHostOnboarding(tx, tenantId, {
      accommodationName: "", address: "", guestPhone: "", guestEmail: "", website: "",
      checkInFrom: "", checkOutUntil: "", contacts: [], wifiName: "", wifiPassword: "",
      houseRulesParking: "", offers: [], recommendations: [], customCategories: [], events: [],
    });
    const checkIn = patch.checkInFrom ?? canonical.checkInFrom;
    const checkOut = patch.checkOutUntil ?? canonical.checkOutUntil;
    await upsertSingleton(tx, tenantId, "check", "Prijava in odjava", {
      body: [
        checkIn ? `Prijava od: ${checkIn}` : "",
        checkOut ? `Odjava do: ${checkOut}` : "",
      ].filter(Boolean).join("\n"),
    });
  }
  const hasCanonicalHouseUpdate = patch.canonicalItems?.some((row) =>
    row.categoryKey === "house"
  ) ?? false;
  if (patch.houseRulesParking !== undefined && !hasCanonicalHouseUpdate) {
    await upsertSingleton(tx, tenantId, "house", "Hišni red", {
      body: patch.houseRulesParking,
    });
  }
  if (patch.offers !== undefined) {
    await replaceItems(tx, tenantId, "offer", patch.offers);
  }
  if (patch.events !== undefined) {
    const category = await categoryByKey(tx, tenantId, "events");
    if (!category) throw new Error("Manjka kategorija Dogodki.");
    const current = await tx.select().from(itemsTable).where(and(
      eq(itemsTable.categoryId, category.id), isNull(itemsTable.deletedAt),
    )).for("update");
    const byId = new Map(current.map((row) => [row.id, row]));
    await rejectForeignIds(tx, patch.events.map((row) => row.id), new Set(byId.keys()));
    const kept: string[] = [];
    for (const [position, event] of patch.events.entries()) {
      const existing = byId.get(event.id);
      const values = {
        title: event.name,
        eventStart: event.date && event.time ? `${event.date}T${event.time}:00` : null,
        position,
        deletedAt: null,
      };
      if (existing) {
        await tx.update(itemsTable).set(values).where(eq(itemsTable.id, existing.id));
        kept.push(existing.id);
      } else {
        const [created] = await tx.insert(itemsTable).values({
          categoryId: category.id, ...values,
        }).returning({ id: itemsTable.id });
        kept.push(created!.id);
      }
    }
  }
  if (patch.media !== undefined) {
    const sectionIds = (await tx.select({ id: sectionsTable.id }).from(sectionsTable)
      .where(eq(sectionsTable.tenantId, tenantId))).map((row) => row.id);
    const categoryIds = sectionIds.length
      ? (await tx.select({ id: categoriesTable.id }).from(categoriesTable)
          .where(and(
            inArray(categoriesTable.sectionId, sectionIds),
            isNull(categoriesTable.deletedAt),
          ))).map((row) => row.id)
      : [];
    const itemIds = categoryIds.length
      ? (await tx.select({ id: itemsTable.id }).from(itemsTable)
          .where(and(
            inArray(itemsTable.categoryId, categoryIds),
            isNull(itemsTable.deletedAt),
          ))).map((row) => row.id)
      : [];
    const existing = itemIds.length
      ? await tx.select().from(mediaTable).where(inArray(mediaTable.itemId, itemIds)).for("update")
      : [];
    const byId = new Map(existing.map((row) => [row.id, row]));
    const kept: string[] = [];
    for (const media of patch.media) {
      const current = byId.get(media.id);
      if (!current || !media.itemId || !itemIds.includes(media.itemId)) {
        throw new Error("Predstavnost ne pripada tej namestitvi.");
      }
      await tx.update(mediaTable).set({
        itemId: media.itemId,
        kind: media.kind,
        url: media.url,
        alt: media.alt || null,
        position: media.position,
        posterUrl: media.posterUrl,
        durationSec: media.durationSec,
        width: media.width,
        height: media.height,
        focusX: media.focusX ?? current.focusX,
        focusY: media.focusY ?? current.focusY,
      }).where(eq(mediaTable.id, current.id));
      kept.push(current.id);
    }
  }
  const deleteItemIds = [
    ...(patch.deleteContactIds ?? []),
    ...(patch.deleteOfferIds ?? []),
    ...(patch.deleteEventIds ?? []),
  ];
  if (deleteItemIds.length) {
    const owned = await tx.select({ id: itemsTable.id }).from(itemsTable)
      .innerJoin(categoriesTable, eq(itemsTable.categoryId, categoriesTable.id))
      .innerJoin(sectionsTable, eq(categoriesTable.sectionId, sectionsTable.id))
      .where(and(
        eq(sectionsTable.tenantId, tenantId),
        inArray(itemsTable.id, deleteItemIds),
      )).for("update");
    if (owned.length !== new Set(deleteItemIds).size) {
      throw new Error("Element za brisanje ne pripada tej namestitvi.");
    }
    await tx.update(itemsTable).set({ deletedAt: new Date() })
      .where(inArray(itemsTable.id, deleteItemIds));
  }
  if (patch.deleteMediaIds?.length) {
    const owned = await tx.select({ id: mediaTable.id }).from(mediaTable)
      .innerJoin(itemsTable, eq(mediaTable.itemId, itemsTable.id))
      .innerJoin(categoriesTable, eq(itemsTable.categoryId, categoriesTable.id))
      .innerJoin(sectionsTable, eq(categoriesTable.sectionId, sectionsTable.id))
      .where(and(
        eq(sectionsTable.tenantId, tenantId),
        inArray(mediaTable.id, patch.deleteMediaIds),
      )).for("update");
    if (owned.length !== new Set(patch.deleteMediaIds).size) {
      throw new Error("Predstavnost za brisanje ne pripada tej namestitvi.");
    }
    await tx.delete(mediaTable).where(inArray(mediaTable.id, patch.deleteMediaIds));
  }
  if (Object.keys(patch).some((key) =>
    !["recommendations", "customCategories"].includes(key)
  )) {
    await tx.update(tenantsTable).set({ hasUnpublishedChanges: true })
      .where(eq(tenantsTable.id, tenantId));
  }
}

export async function ensureHostOnboardingGalleryItem(
  tx: Transaction,
  tenantId: string,
): Promise<string> {
  const category = await categoryByKey(tx, tenantId, "welcome")
    ?? await firstCategoryInSection(tx, tenantId, "stay");
  if (!category) throw new Error("Namestitev nima kategorije za fotografije.");
  const [existing] = await tx.select({ id: itemsTable.id }).from(itemsTable).where(and(
    eq(itemsTable.categoryId, category.id),
    eq(itemsTable.noteType, managedGallery),
    isNull(itemsTable.deletedAt),
  )).limit(1).for("update");
  if (existing) return existing.id;
  const [created] = await tx.insert(itemsTable).values({
    categoryId: category.id,
    title: "Fotografije nastanitve",
    noteType: managedGallery,
    position: sql<number>`(select coalesce(max(${itemsTable.position}), -1) + 1 from ${itemsTable} where ${itemsTable.categoryId} = ${category.id})`,
  }).returning({ id: itemsTable.id });
  return created!.id;
}

export function recommendationNeedsCreatorQueue(
  recommendation: HostOnboardingData["recommendations"][number],
  canonical: { title: string | null; categoryKey: string | null } | undefined,
): boolean {
  return !canonical ||
    canonical.title?.trim() !== recommendation.name.trim() ||
    (canonical.categoryKey ?? "") !== recommendation.categoryId;
}