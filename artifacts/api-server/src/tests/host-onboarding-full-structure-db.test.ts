import assert from "node:assert/strict";
import test from "node:test";
import { eq } from "drizzle-orm";
import { db, itemsTable, publishedSnapshotsTable } from "@workspace/db";
import { currentHostOnboarding, saveHostOnboarding } from "../lib/hostOnboarding";
import {
  canonicalFixtureDigest,
  cleanupCanonicalOnboardingFixture,
  createCanonicalOnboardingFixture,
  type CanonicalOnboardingFixture,
} from "./helpers/canonicalOnboardingFixture";

test("real DB: empty stay entry creation and offer category linkage are canonical", async (context) => {
  if (!process.env.DATABASE_URL) {
    context.skip("development database is unavailable");
    return;
  }
  let fixture: CanonicalOnboardingFixture | undefined;
  try {
    fixture = await createCanonicalOnboardingFixture();
    const initial = await currentHostOnboarding(fixture.tenantId, fixture.hostUserId);
    assert.ok(initial);
    const stay = initial.contentSections.find((section) => section.key === "stay");
    const offer = initial.contentSections.find((section) => section.key === "offer");
    assert.equal(stay?.title, "Vaše bivanje po meri");
    assert.equal(
      stay?.categories.find((category) => category.id === fixture!.categoryIds.park)?.label,
      "Parkiranje pri oljkah",
    );
    const emptyCategory = stay?.categories.find(
      (category) => category.id === fixture!.categoryIds.emptyCustomStay,
    );
    assert.ok(emptyCategory);
    assert.ok(offer?.categories.some(
      (category) => category.id === fixture!.categoryIds.customOffer,
    ));

    const saved = await saveHostOnboarding(
      fixture.tenantId,
      fixture.hostUserId,
      initial.round.revision,
      {
        canonicalItems: [{
          id: "new-empty-category-entry",
          categoryId: emptyCategory.id,
          categoryKey: emptyCategory.key,
          sectionKey: "stay",
          title: "Navodila po meri",
          body: "<p>Besedilo gostitelja.</p>",
          price: "",
          priceUnit: "",
          phone: "",
          website: "",
          mapQuery: "",
          difficulty: "",
          duration: "",
          distance: "",
          noteType: "",
          noteText: "",
          bullets: [],
          tint: "",
          frame: "",
          isVisible: true,
          orderEnabled: false,
          soldOut: false,
          producerName: "",
          producerNote: "",
        }],
        offers: [{
          id: "new-custom-offer",
          name: "Gostiteljeva ponudba",
          price: "22 EUR",
          categoryId: fixture.categoryIds.customOffer,
        }],
      },
      initial.canonicalRevision,
    );
    assert.equal(saved.ok, true);

    const reloaded = await currentHostOnboarding(fixture.tenantId, fixture.hostUserId);
    assert.ok(reloaded);
    assert.ok(reloaded.round.draftData.canonicalItems?.some((item) =>
      item.categoryId === fixture!.categoryIds.emptyCustomStay &&
      item.body === "<p>Besedilo gostitelja.</p>"
    ));
    const linkedOffer = reloaded.round.draftData.offers.find(
      (item) => item.name === "Gostiteljeva ponudba",
    );
    assert.equal(linkedOffer?.categoryId, fixture.categoryIds.customOffer);
    const [linkedRow] = await db.select({ categoryId: itemsTable.categoryId })
      .from(itemsTable).where(eq(itemsTable.id, linkedOffer!.id));
    assert.equal(linkedRow?.categoryId, fixture.categoryIds.customOffer);

    const [snapshot] = await db.select({ content: publishedSnapshotsTable.content })
      .from(publishedSnapshotsTable)
      .where(eq(publishedSnapshotsTable.tenantId, fixture.tenantId));
    assert.equal(
      canonicalFixtureDigest(snapshot?.content),
      canonicalFixtureDigest(fixture.publishedContent),
    );
  } finally {
    if (fixture) await cleanupCanonicalOnboardingFixture(fixture);
  }
});