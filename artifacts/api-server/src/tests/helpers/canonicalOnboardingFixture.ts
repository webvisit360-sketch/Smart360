import { createHash, randomBytes, randomUUID } from "node:crypto";
import {
  categoriesTable,
  creatorPlaceProposalsTable,
  db,
  hostMembershipsTable,
  hostOnboardingRoundsTable,
  hostSessionsTable,
  hostUsersTable,
  itemsTable,
  mediaTable,
  publishedSnapshotsTable,
  sectionsTable,
  tenantsTable,
} from "@workspace/db";
import { and, eq, inArray } from "drizzle-orm";
import { buildDraftPublication } from "../../lib/publishedSnapshots";
import { seedTenantContent } from "../../lib/tenantSeeds";

const FIXTURE_PREFIX = "canonical-onboarding-fixture-";

export type CanonicalOnboardingFixture = {
  marker: string;
  tenantId: string;
  tenantSlug: string;
  hostUserId: string;
  hostSessionId: string;
  hostSessionCookie: string;
  roundId: string;
  categoryIds: Record<string, string>;
  itemIds: {
    welcome: string;
    contacts: [string, string];
    check: string;
    house: string;
    park: string;
    offer: string;
    customOffer: string;
    event: string;
  };
  mediaIds: {
    photo: string;
    video: string;
  };
  publishedContent: unknown;
};

const canonical = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, canonical(item)]));
  }
  return value;
};

export const canonicalFixtureDigest = (value: unknown): string =>
  createHash("sha256").update(JSON.stringify(canonical(value))).digest("hex");

export async function createCanonicalOnboardingFixture(): Promise<CanonicalOnboardingFixture> {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Canonical onboarding fixtures are forbidden in production");
  }
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");

  const marker = `${FIXTURE_PREFIX}${randomUUID()}`;
  // Keep disposable browser slugs within the same public-route contract as
  // real tenant slugs (SLUG_SHAPE allows at most 40 characters).
  const tenantSlug = `cofx-${randomUUID().replaceAll("-", "").slice(0, 24)}`;
  let tenantId: string | undefined;
  let hostUserId: string | undefined;
  try {
    const [tenant] = await db.insert(tenantsTable).values({
      slug: tenantSlug,
      name: "Objavljeno ime pred osnutkom",
      tenantType: "apartmaji",
      guestUiMode: "living-guide",
      phone: "+386 40 100 100",
      email: "published@example.invalid",
      address: "Objavljeni trg 1",
      latitude: 46.056946,
      longitude: 14.505751,
      isPublished: true,
      hasUnpublishedChanges: false,
    }).returning();
    if (!tenant) throw new Error("Fixture tenant was not created");
    tenantId = tenant.id;
    await seedTenantContent(tenant.id, "apartmaji");

    const [baselineTenant] = await db.select().from(tenantsTable)
      .where(eq(tenantsTable.id, tenant.id));
    if (!baselineTenant) throw new Error("Fixture tenant baseline is missing");
    const publishedContent = await buildDraftPublication(baselineTenant);
    await db.insert(publishedSnapshotsTable).values({
      tenantId: tenant.id,
      content: publishedContent as unknown as Record<string, unknown>,
      publishedAt: new Date("2026-01-01T00:00:00Z"),
    });

    const sections = await db.select().from(sectionsTable)
      .where(eq(sectionsTable.tenantId, tenant.id));
    const categories = await db.select({
      id: categoriesTable.id,
      key: categoriesTable.key,
    }).from(categoriesTable)
      .where(inArray(categoriesTable.sectionId, sections.map((section) => section.id)));
    const categoryIds = Object.fromEntries(categories
      .filter((category): category is typeof category & { key: string } => !!category.key)
      .map((category) => [category.key, category.id]));
    for (const key of ["welcome", "check", "house", "park", "sup", "events", "shops"]) {
      if (!categoryIds[key]) throw new Error(`Fixture skeleton category ${key} is missing`);
    }
    const staySection = sections.find((section) => section.key === "stay");
    const offerSection = sections.find((section) => section.key === "offer");
    if (!staySection || !offerSection) throw new Error("Fixture content sections are missing");
    await db.update(sectionsTable).set({ title: "Vaše bivanje po meri" })
      .where(eq(sectionsTable.id, staySection.id));
    await db.update(categoriesTable).set({ label: "Parkiranje pri oljkah" })
      .where(eq(categoriesTable.id, categoryIds["park"]!));
    const [emptyCustomStay, customOfferCategory] = await db.insert(categoriesTable).values([
      {
        sectionId: staySection.id,
        key: `fixture-empty-${randomUUID()}`,
        label: "Navodila po meri",
        position: 999,
      },
      {
        sectionId: offerSection.id,
        key: `fixture-offer-${randomUUID()}`,
        label: "Posebna doživetja",
        position: 999,
      },
    ]).returning();
    if (!emptyCustomStay || !customOfferCategory) throw new Error("Fixture custom categories are missing");
    categoryIds.emptyCustomStay = emptyCustomStay.id;
    categoryIds.customOffer = customOfferCategory.id;

    const insertedItems = await db.insert(itemsTable).values([
      {
        categoryId: categoryIds["welcome"]!,
        title: "Dobrodošli v operaterjevem osnutku",
        body: "<p><strong>Operaterjevo bogato besedilo</strong> ostane nespremenjeno.</p>",
        position: 0,
      },
      {
        categoryId: categoryIds["welcome"]!,
        title: "Ana",
        phone: "+386 40 200 201",
        website: "https://fixture.example.invalid",
        noteType: "host-onboarding-contact",
        position: 1,
      },
      {
        categoryId: categoryIds["welcome"]!,
        title: "Bine",
        phone: "+386 40 200 202",
        noteType: "host-onboarding-contact",
        position: 2,
      },
      {
        categoryId: categoryIds["check"]!,
        title: "Prijava in odjava",
        body: "Prijava od: 15:00\nOdjava do: 10:00",
        position: 0,
      },
      {
        categoryId: categoryIds["house"]!,
        title: "Hišni red",
        body: "<p>Po 22. uri prosimo za mir.</p>",
        position: 0,
      },
      {
        categoryId: categoryIds["park"]!,
        title: "Parkiranje",
        body: "Parkirajte ob leseni ograji.",
        position: 0,
      },
      {
        categoryId: categoryIds["sup"]!,
        title: "Košarica zajtrka",
        body: "Dostava ob dogovorjeni uri.",
        price: "14 EUR",
        position: 0,
      },
      {
        categoryId: categoryIds["customOffer"]!,
        title: "Zasebni ogled",
        price: "35 EUR",
        position: 0,
      },
      {
        categoryId: categoryIds["events"]!,
        title: "Poletni koncert",
        body: "Dogodek v operaterjevem osnutku.",
        eventStart: "2026-08-11T19:30:00",
        position: 0,
      },
    ]).returning();
    const [welcome, contactAna, contactBine, check, house, park, offer, customOffer, event] = insertedItems;
    if (!welcome || !contactAna || !contactBine || !check || !house || !park || !offer || !customOffer || !event) {
      throw new Error("Fixture canonical items were not created");
    }
    const [photo, video] = await db.insert(mediaTable).values([
      {
        itemId: welcome.id,
        url: `/objects/${marker}/welcome-photo.jpg`,
        alt: "Operaterjeva fotografija",
        kind: "image",
        width: 1600,
        height: 1067,
        position: 0,
      },
      {
        itemId: welcome.id,
        url: `/objects/${marker}/welcome-video.mp4`,
        posterUrl: `/objects/${marker}/welcome-video-poster.jpg`,
        alt: "Operaterjev video",
        kind: "video",
        durationSec: 37,
        width: 1920,
        height: 1080,
        position: 1,
      },
    ]).returning();
    if (!photo || !video) throw new Error("Fixture media were not created");

    await db.update(tenantsTable).set({
      name: "Operaterjev trenutni osnutek",
      address: "Osnutkova ulica 2",
      phone: "+386 40 200 200",
      email: "draft@example.invalid",
      wifiSsid: "Fixture Wi-Fi",
      wifiPass: "fixture-password",
      hasUnpublishedChanges: true,
    }).where(eq(tenantsTable.id, tenant.id));

    const [host] = await db.insert(hostUsersTable).values({
      email: `${marker}@example.invalid`,
    }).returning();
    if (!host) throw new Error("Fixture host was not created");
    hostUserId = host.id;
    await db.insert(hostMembershipsTable).values({ tenantId: tenant.id, hostUserId: host.id });
    const rawToken = randomBytes(32).toString("base64url");
    const [session] = await db.insert(hostSessionsTable).values({
      hostUserId: host.id,
      tokenHash: createHash("sha256").update(rawToken).digest("hex"),
      ip: "127.0.0.1",
      userAgent: marker,
      expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
    }).returning();
    if (!session) throw new Error("Fixture host session was not created");
    const [round] = await db.insert(hostOnboardingRoundsTable).values({
      tenantId: tenant.id,
      hostUserId: host.id,
      round: 1,
      draftData: {
        accommodationName: "Zastarela ločena kopija, ki se ne sme prikazati",
        address: "",
        guestPhone: "",
        guestEmail: "",
        website: "",
        checkInFrom: "",
        checkOutUntil: "",
        contacts: [],
        wifiName: "",
        wifiPassword: "",
        houseRulesParking: "",
        offers: [],
        recommendations: [{
          id: "queue-hint-stable",
          categoryId: "shops",
          name: "Trgovina iz čakalne vrste",
        }],
        customCategories: [],
        events: [],
      },
      // This fixture represents a post-binding round. The deliberately stale
      // JSON proves canonical overlay behavior without invoking the one-time
      // legacy-draft compatibility import.
      targetReview: [{
        target: "workflow.canonical_binding_v1",
        hostValue: true,
        operatorValue: true,
        resolution: "unchanged",
        suggestionVisible: false,
      }],
    }).returning();
    if (!round) throw new Error("Fixture onboarding round was not created");

    return {
      marker,
      tenantId: tenant.id,
      tenantSlug,
      hostUserId: host.id,
      hostSessionId: session.id,
      hostSessionCookie: `__Host-s360_host=${rawToken}`,
      roundId: round.id,
      categoryIds,
      itemIds: {
        welcome: welcome.id,
        contacts: [contactAna.id, contactBine.id],
        check: check.id,
        house: house.id,
        park: park.id,
        offer: offer.id,
        customOffer: customOffer.id,
        event: event.id,
      },
      mediaIds: { photo: photo.id, video: video.id },
      publishedContent,
    };
  } catch (error) {
    if (tenantId) await db.delete(tenantsTable).where(eq(tenantsTable.id, tenantId)).catch(() => undefined);
    if (hostUserId) await db.delete(hostUsersTable).where(eq(hostUsersTable.id, hostUserId)).catch(() => undefined);
    throw error;
  }
}

export async function cleanupCanonicalOnboardingFixture(
  fixture: Pick<CanonicalOnboardingFixture, "tenantId" | "tenantSlug" | "hostUserId" | "marker">,
): Promise<void> {
  const [tenant] = await db.select({ slug: tenantsTable.slug }).from(tenantsTable)
    .where(eq(tenantsTable.id, fixture.tenantId));
  if (tenant && tenant.slug !== fixture.tenantSlug) {
    throw new Error("Refusing fixture cleanup because tenant identity changed");
  }
  const [host] = await db.select({ email: hostUsersTable.email }).from(hostUsersTable)
    .where(eq(hostUsersTable.id, fixture.hostUserId));
  if (host && host.email !== `${fixture.marker}@example.invalid`) {
    throw new Error("Refusing fixture cleanup because host identity changed");
  }
  await db.delete(tenantsTable).where(eq(tenantsTable.id, fixture.tenantId));
  await db.delete(hostUsersTable).where(eq(hostUsersTable.id, fixture.hostUserId));
}

export async function canonicalOnboardingFixtureRows(fixture: CanonicalOnboardingFixture) {
  const [tenant] = await db.select().from(tenantsTable)
    .where(eq(tenantsTable.id, fixture.tenantId));
  const items = await db.select().from(itemsTable)
    .where(inArray(
      itemsTable.id,
      [
        fixture.itemIds.welcome,
        ...fixture.itemIds.contacts,
        fixture.itemIds.check,
        fixture.itemIds.house,
        fixture.itemIds.park,
        fixture.itemIds.offer,
        fixture.itemIds.customOffer,
        fixture.itemIds.event,
      ],
    ));
  const media = await db.select().from(mediaTable)
    .where(inArray(mediaTable.id, Object.values(fixture.mediaIds)));
  const proposals = await db.select().from(creatorPlaceProposalsTable)
    .where(eq(creatorPlaceProposalsTable.tenantId, fixture.tenantId));
  const [snapshot] = await db.select().from(publishedSnapshotsTable)
    .where(eq(publishedSnapshotsTable.tenantId, fixture.tenantId));
  return { tenant, items, media, proposals, snapshot };
}

export async function assertNoCanonicalOnboardingFixtureRows(
  fixture: Pick<CanonicalOnboardingFixture, "tenantSlug" | "marker">,
): Promise<void> {
  const tenants = await db.select({ id: tenantsTable.id }).from(tenantsTable)
    .where(eq(tenantsTable.slug, fixture.tenantSlug));
  const hosts = await db.select({ id: hostUsersTable.id }).from(hostUsersTable)
    .where(eq(hostUsersTable.email, `${fixture.marker}@example.invalid`));
  if (tenants.length || hosts.length) throw new Error("Canonical onboarding fixture cleanup was incomplete");
}