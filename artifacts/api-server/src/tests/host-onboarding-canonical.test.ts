import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import {
  categoriesTable,
  db,
  itemsTable,
  mediaTable,
  publishedSnapshotsTable,
  sectionsTable,
  tenantsTable,
  type HostOnboardingData,
} from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { ensureTenantSkeleton } from "../lib/tenantSeeds";
import {
  applyCanonicalHostOnboardingPatch,
  readCanonicalHostOnboarding,
  recommendationNeedsCreatorQueue,
} from "../lib/hostOnboardingCanonical";

const workflow = (): HostOnboardingData => ({
  accommodationName: "",
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
  recommendations: [],
  customCategories: [],
  events: [],
});

test("canonical onboarding reads admin draft and partial form saves preserve rich content, media and snapshot", async (context) => {
  if (!process.env["DATABASE_URL"]) {
    context.skip("development database is unavailable");
    return;
  }
  const tenantId = randomUUID();
  await db.insert(tenantsTable).values({
    id: tenantId,
    slug: `canonical-onboarding-${tenantId}`,
    name: "Admin ime",
    tenantType: "kamp",
    phone: "+386 40 100 100",
  });
  try {
    await ensureTenantSkeleton(tenantId, "kamp");
    const sections = await db.select().from(sectionsTable)
      .where(eq(sectionsTable.tenantId, tenantId));
    const section = new Map(sections.map((row) => [row.key, row.id]));
    const categories = await db.select().from(categoriesTable);
    const category = (key: string) => categories.find((row) =>
      row.key === key && [...section.values()].includes(row.sectionId)
    )!;
    const [house] = await db.insert(itemsTable).values({
      categoryId: category("house").id,
      title: "Hišni red",
      body: "<p>Poljubno <strong>bogato</strong> besedilo</p>",
    }).returning();
    const [place] = await db.insert(itemsTable).values({
      categoryId: category("culture").id,
      title: "Grad",
    }).returning();
    const [servicePlace] = await db.insert(itemsTable).values({
      categoryId: category("pharm").id,
      title: "Dežurna lekarna",
    }).returning();
    const offerSectionId = section.get("offer");
    const offerCategory = categories.find((row) => row.sectionId === offerSectionId);
    assert.ok(offerCategory);
    const [offer] = await db.insert(itemsTable).values({
      categoryId: offerCategory.id,
      title: "Zajtrk",
      price: "12 EUR",
    }).returning();
    const [video] = await db.insert(mediaTable).values({
      itemId: house!.id,
      url: "/api/storage/video/test/video.mp4",
      kind: "video",
      posterUrl: "/api/storage/img/test/poster.jpg",
      durationSec: 12,
      alt: "Video",
    }).returning();
    const [offerPhoto] = await db.insert(mediaTable).values({
      itemId: offer!.id,
      url: "/api/storage/img/test/offer.jpg",
      kind: "image",
      alt: "Fotografija ponudbe",
    }).returning();
    const snapshot = { tenant: { name: "Objavljeno ime" } };
    await db.insert(publishedSnapshotsTable).values({ tenantId, content: snapshot });

    const before = await db.transaction((tx) =>
      readCanonicalHostOnboarding(tx, tenantId, workflow())
    );
    assert.equal(before.accommodationName, "Admin ime");
    assert.equal(before.houseRulesParking, "<p>Poljubno <strong>bogato</strong> besedilo</p>");
    assert.equal(before.media?.find((row) => row.id === video!.id)?.kind, "video");
    assert.ok(before.media?.some((row) =>
      row.id === offerPhoto!.id && row.itemId === offer!.id
    ));
    assert.equal(before.recommendations.find((row) => row.id === place!.id)?.name, "Grad");
    assert.deepEqual(
      before.recommendations.find((row) => row.id === servicePlace!.id),
      { id: servicePlace!.id, categoryId: "pharm", name: "Dežurna lekarna" },
    );

    const canonicalHouse = before.canonicalItems?.find((row) => row.id === house!.id);
    assert.ok(canonicalHouse);
    await db.transaction((tx) => applyCanonicalHostOnboardingPatch(tx, tenantId, {
      // A full/stale form payload can still carry the old compatibility field.
      // The explicitly edited stable canonical row must win in this same patch.
      houseRulesParking: "<p>Zastarelo besedilo</p>",
      canonicalItems: [{
        ...canonicalHouse,
        body: "<p>Izrecno urejeno kanonično besedilo</p>",
      }],
    }));
    const [houseAfterMixedPatch] = await db.select().from(itemsTable)
      .where(eq(itemsTable.id, house!.id));
    assert.equal(houseAfterMixedPatch?.body, "<p>Izrecno urejeno kanonično besedilo</p>");

    await db.transaction((tx) =>
      applyCanonicalHostOnboardingPatch(tx, tenantId, { guestPhone: "+386 40 222 222" })
    );
    const [unchangedHouse] = await db.select().from(itemsTable)
      .where(eq(itemsTable.id, house!.id));
    const [unchangedVideo] = await db.select().from(mediaTable)
      .where(eq(mediaTable.id, video!.id));
    const [unchangedOfferPhoto] = await db.select().from(mediaTable)
      .where(eq(mediaTable.id, offerPhoto!.id));
    const [unchangedSnapshot] = await db.select().from(publishedSnapshotsTable)
      .where(eq(publishedSnapshotsTable.tenantId, tenantId));
    assert.equal(unchangedHouse?.body, "<p>Izrecno urejeno kanonično besedilo</p>");
    assert.deepEqual(unchangedVideo, video);
    assert.deepEqual(unchangedOfferPhoto, offerPhoto);
    assert.equal(unchangedOfferPhoto?.itemId, offer!.id);
    assert.deepEqual(unchangedSnapshot?.content, snapshot);

    await db.transaction((tx) => applyCanonicalHostOnboardingPatch(tx, tenantId, {
      contacts: [
        { id: "new-a", name: "Ana", phone: "+386 40 1" },
        { id: "new-b", name: "Bine", phone: "+386 40 2" },
      ],
      website: "https://example.test",
      offers: [{ id: offer!.id, name: "Zajtrk", price: "15 EUR" }],
      events: [{ id: "new-event", name: "Koncert", date: "2026-08-11", time: "19:30" }],
    }));
    const after = await db.transaction((tx) =>
      readCanonicalHostOnboarding(tx, tenantId, workflow())
    );
    assert.deepEqual(after.contacts.map(({ name, phone }) => ({ name, phone })), [
      { name: "Ana", phone: "+386 40 1" },
      { name: "Bine", phone: "+386 40 2" },
    ]);
    assert.equal(after.website, "https://example.test");
    assert.deepEqual(after.offers.map(({ name, price }) => ({ name, price })), [
      { name: "Zajtrk", price: "15 EUR" },
    ]);
    assert.deepEqual(after.events.map(({ name, date, time }) => ({ name, date, time })), [
      { name: "Koncert", date: "2026-08-11", time: "19:30" },
    ]);

    const canonical = { title: "Grad", categoryKey: "culture" };
    assert.equal(recommendationNeedsCreatorQueue(
      { id: place!.id, name: "Grad", categoryId: "culture" },
      canonical,
    ), false);
    assert.equal(recommendationNeedsCreatorQueue(
      { id: place!.id, name: "Grad Celje", categoryId: "culture" },
      canonical,
    ), true);
    assert.equal(recommendationNeedsCreatorQueue(
      { id: "new-hint", name: "Nov kraj", categoryId: "culture" },
      undefined,
    ), true);
  } finally {
    await db.delete(tenantsTable).where(eq(tenantsTable.id, tenantId));
  }
});