/**
 * CHECKPOINT 2b — owner's cockpit (Instruction #28).
 *
 * Proves:
 *  - create-by-type seeds the canonical sections + typed categories/groups,
 *  - the slug is editable before the first publish and frozen (409) after,
 *  - firstPublishedAt is stamped exactly once and the "guide published"
 *    e-mail fires exactly once (republish toggles never resend),
 *  - /admin/tenants/overview returns readiness + pending counts,
 *  - the per-tenant changelog carries owner attribution,
 *  - hosts see NONE of the cockpit endpoints (404, no existence oracle).
 *
 * Real Express app on an ephemeral port, real dev DB, throwaway rows with
 * unique suffixes (parallel-safe), cleaned up afterwards.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import crypto from "node:crypto";
import { asc, eq, inArray } from "drizzle-orm";
import {
  db,
  tenantsTable,
  sectionsTable,
  categoriesTable,
  changelogTable,
  adminSessionsTable,
  hostUsersTable,
  hostMembershipsTable,
} from "@workspace/db";
import app from "../app";
import { hashPassword, _clearHostRateLimiters } from "../lib/hostAuth";
import { _setLifecycleDeliveryOverride } from "../lib/lifecycleEmails";
import { tenantSeedPlan } from "../lib/tenantSeeds";

const sha256 = (v: string) => crypto.createHash("sha256").update(v).digest("hex");

async function jreq(
  base: string,
  method: string,
  path: string,
  cookie: string | null,
  body?: unknown,
  extraHeaders: Record<string, string> = {},
): Promise<Response> {
  return fetch(`${base}/api${path}`, {
    method,
    headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}), ...extraHeaders },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

test("CP2b owner cockpit: create-by-type, slug freeze, first publish, overview, attribution", async (t) => {
  _clearHostRateLimiters();
  const server = app.listen(0);
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const base = `http://127.0.0.1:${address.port}`;

  const stamp = Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36);
  const slug = `cp2b-${stamp}`;
  const hostEmail = `cp2b-host-${stamp}@example.com`;
  const hostPassword = "geslo-cp2b-testni-123";

  // Owner session directly in the DB (WebAuthn ceremony is out of scope here).
  const ownerToken = crypto.randomBytes(32).toString("base64url");
  const [session] = await db
    .insert(adminSessionsTable)
    .values({ tokenHash: sha256(ownerToken), expiresAt: new Date(Date.now() + 60 * 60 * 1000) })
    .returning({ id: adminSessionsTable.id });
  const ownerCookie = `__Host-s360_admin=${ownerToken}`;

  await t.test("unknown Creator tenant returns 404 instead of an empty queue", async () => {
    const unknownTenantId = crypto.randomUUID();
    const response = await jreq(
      base,
      "GET",
      `/admin/tenants/${unknownTenantId}/creator/proposals`,
      ownerCookie,
    );
    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), { error: "Namestitev ni najdena." });
  });

  // Captured lifecycle e-mails instead of Resend.
  const sentMails: Array<Record<string, unknown>> = [];
  _setLifecycleDeliveryOverride(async (body) => {
    sentMails.push(body);
    return { ok: true };
  });

  let tenantId = "";
  let hostUserId = "";
  let contentCategoryId = "";

  t.after(async () => {
    _setLifecycleDeliveryOverride(null);
    if (hostUserId) await db.delete(hostUsersTable).where(eq(hostUsersTable.id, hostUserId));
    if (tenantId) {
      await db.delete(changelogTable).where(eq(changelogTable.tenantId, tenantId));
      await db.delete(tenantsTable).where(eq(tenantsTable.id, tenantId));
    }
    await db.delete(adminSessionsTable).where(eq(adminSessionsTable.id, session!.id));
    await new Promise<void>((r) => server.close(() => r()));
  });

  // ---------- Create with type ----------
  await t.test("POST /admin/tenants with type=kamp seeds sections/categories/groups", async () => {
    const bad = await jreq(base, "POST", "/admin/tenants", ownerCookie, {
      slug: `${slug}-x`, name: "Neveljaven tip", type: "hostel",
    });
    assert.equal(bad.status, 400, "unknown type must be rejected");

    const res = await jreq(base, "POST", "/admin/tenants", ownerCookie, {
      slug, name: `Kamp CP2b ${stamp}`, subtitle: "Testni kamp ob reki", type: "kamp",
    });
    assert.equal(res.status, 201, `create got ${res.status}`);
    const created = (await res.json()) as {
      id: string;
      tenantType?: string | null;
      firstPublishedAt?: string | null;
      guestUiMode?: string;
    };
    tenantId = created.id;
    assert.equal(created.tenantType, "kamp");
    assert.equal(created.firstPublishedAt ?? null, null);
    assert.equal(created.guestUiMode, "living-guide");

    const legacy = await jreq(
      base,
      "PATCH",
      `/admin/tenants/${tenantId}`,
      ownerCookie,
      { guestUiMode: "legacy" },
    );
    assert.equal(legacy.status, 400, "no admin path may switch a tenant back to legacy");

    const sections = await db
      .select({ id: sectionsTable.id, key: sectionsTable.key, position: sectionsTable.position })
      .from(sectionsTable)
      .where(eq(sectionsTable.tenantId, tenantId))
      .orderBy(asc(sectionsTable.position));
    const plan = tenantSeedPlan("kamp");
    assert.deepEqual(sections.map((s) => s.key), plan.map((p) => p.key),
      "seeded section keys/order must match the plan");

    const cats = await db
      .select({
        id: categoriesTable.id,
        sectionId: categoriesTable.sectionId,
        key: categoriesTable.key,
        group: categoriesTable.exploreGroup,
        icon: categoriesTable.icon,
      })
      .from(categoriesTable)
      .where(inArray(categoriesTable.sectionId, sections.map((s) => s.id)));
    const expected = plan.flatMap((p) => p.categories);
    assert.equal(cats.length, expected.length, "every planned category must exist");
    assert.ok(cats.every((c) => c.group && c.group.length > 0), "every category carries a group");
    const gate = cats.find((c) => c.key === "gate");
    assert.ok(gate, "the owner-approved Meli Pu skeleton must be seeded for every tenant type");
    const staySection = sections.find((section) => section.key === "stay");
    const stayCategory = cats.find((category) => category.sectionId === staySection?.id);
    assert.ok(stayCategory, "a seeded Nastanitev category is required for dirty-state coverage");
    contentCategoryId = stayCategory!.id;

    const [logRow] = await db
      .select({ detail: changelogTable.detail, summary: changelogTable.summary, actorType: changelogTable.actorType })
      .from(changelogTable)
      .where(eq(changelogTable.tenantId, tenantId));
    assert.equal(logRow!.detail, null, "submitted type must not enter audit detail");
    assert.equal(logRow!.summary, `Ustvarjena je nova nastanitev »Kamp CP2b ${stamp}«.`);
    assert.equal(logRow!.actorType, "owner");
  });

  // ---------- Slug lifecycle + first publish ----------
  await t.test("slug editable before first publish, frozen after; e-mail fires once", async () => {
    const newSlug = `${slug}-nov`;
    const rename = await jreq(base, "PATCH", `/admin/tenants/${tenantId}`, ownerCookie, { slug: newSlug });
    assert.equal(rename.status, 200, "slug change before first publish must succeed");

    // Give the tenant a host e-mail so the published mail has a recipient.
    const settingsEmail = `cp2b-lastnik-${stamp}@example.com`;
    const orderPassword = "zasebno-testno-geslo";
    const setEmail = await jreq(base, "PATCH", `/admin/tenants/${tenantId}`, ownerCookie, {
      email: settingsEmail,
      orderPassword,
      theme: "swipe",
    });
    assert.equal(setEmail.status, 200);
    assert.equal(sentMails.length, 0, "no mail before the first publish");
    const settingLogs = await db
      .select({ action: changelogTable.action, summary: changelogTable.summary })
      .from(changelogTable)
      .where(eq(changelogTable.tenantId, tenantId));
    const settingsLog = settingLogs.find((row) =>
      row.action === "update" && row.summary.includes("kontaktni podatki"),
    );
    assert.ok(settingsLog, "settings PATCH must name the changed setting categories");
    assert.match(settingsLog!.summary, /dostop do naročil/);
    assert.match(settingsLog!.summary, /videz/);
    assert.ok(!settingsLog!.summary.includes(settingsEmail), "an e-mail value must never enter history");
    assert.ok(!settingsLog!.summary.includes(orderPassword), "a password must never enter history");

    const publish = await jreq(base, "PATCH", `/admin/tenants/${tenantId}`, ownerCookie, {
      isPublished: true,
      publishNow: true,
    });
    assert.equal(publish.status, 200);
    const published = (await publish.json()) as {
      firstPublishedAt: string | null;
      lastPublishedAt: string | null;
      hasUnpublishedChanges: boolean;
    };
    assert.ok(published.firstPublishedAt, "first publish must stamp firstPublishedAt");
    assert.ok(published.lastPublishedAt, "publish must stamp lastPublishedAt");
    assert.equal(published.hasUnpublishedChanges, false, "publish must clear the dirty flag");
    assert.equal(sentMails.length, 1, "exactly one published e-mail after the first publish");
    const to = (sentMails[0] as { to?: string[] }).to;
    assert.deepEqual(to, [`cp2b-lastnik-${stamp}@example.com`]);

    const frozen = await jreq(base, "PATCH", `/admin/tenants/${tenantId}`, ownerCookie, { slug: `${slug}-se-en` });
    assert.equal(frozen.status, 409, "slug change after first publish must be 409");

    // Republish cycle: no new stamp, no new mail.
    const unpublish = await jreq(base, "PATCH", `/admin/tenants/${tenantId}`, ownerCookie, { isPublished: false });
    assert.equal(unpublish.status, 200);
    const republish = await jreq(base, "PATCH", `/admin/tenants/${tenantId}`, ownerCookie, {
      isPublished: true,
      publishNow: true,
    });
    assert.equal(republish.status, 200);
    const again = (await republish.json()) as { firstPublishedAt: string | null };
    assert.equal(again.firstPublishedAt, published.firstPublishedAt, "stamp must never change");
    assert.equal(sentMails.length, 1, "republish must NOT resend the published e-mail");
    const publicationLogs = await db
      .select({ action: changelogTable.action, summary: changelogTable.summary })
      .from(changelogTable)
      .where(eq(changelogTable.tenantId, tenantId));
    assert.ok(
      publicationLogs.some((row) => row.action === "publish" && row.summary.includes("prvič objavljena")),
      "first publish needs a distinct Slovenian history entry",
    );
    assert.ok(
      publicationLogs.some((row) => row.action === "unpublish" && row.summary.includes("umaknjena iz objave")),
      "unpublish needs a distinct Slovenian history entry",
    );
    assert.ok(
      publicationLogs.some((row) => row.action === "republish" && row.summary.includes("ponovno objavljena")),
      "republish needs a distinct Slovenian history entry",
    );

    const [row] = await db
      .select({ slug: tenantsTable.slug })
      .from(tenantsTable)
      .where(eq(tenantsTable.id, tenantId));
    assert.equal(row!.slug, newSlug, "the pre-publish rename sticks; the frozen one does not");
  });

  await t.test("repeated admin-change publish cycles survive reload", async () => {
    const settingsAutosave = await jreq(
      base,
      "PATCH",
      `/admin/tenants/${tenantId}`,
      ownerCookie,
      {
        subtitle: `Samodejno shranjen opis ${stamp}`,
        isPublished: true,
      },
    );
    assert.equal(settingsAutosave.status, 200);
    const autosaved = (await settingsAutosave.json()) as {
      hasUnpublishedChanges: boolean;
    };
    assert.equal(
      autosaved.hasUnpublishedChanges,
      true,
      "an auto-save that repeats isPublished=true must not masquerade as publish",
    );
    const cleanAfterAutosave = await jreq(
      base,
      "PATCH",
      `/admin/tenants/${tenantId}`,
      ownerCookie,
      { isPublished: true, publishNow: true },
    );
    assert.equal(cleanAfterAutosave.status, 200);

    const createdResponse = await jreq(
      base,
      "POST",
      `/admin/categories/${contentCategoryId}/items`,
      ownerCookie,
      { title: "Nastanitev testni vnos", body: "<p>Prvotni opis.</p>" },
    );
    assert.equal(createdResponse.status, 201);
    const created = (await createdResponse.json()) as { id: string };

    const editedResponse = await jreq(
      base,
      "PATCH",
      `/admin/items/${created.id}`,
      ownerCookie,
      { title: "Nastanitev spremenjeni vnos" },
    );
    assert.equal(editedResponse.status, 200);

    const reloadedResponse = await jreq(
      base,
      "GET",
      `/admin/tenants/${tenantId}`,
      ownerCookie,
    );
    assert.equal(reloadedResponse.status, 200);
    const reloaded = (await reloadedResponse.json()) as {
      hasUnpublishedChanges: boolean;
      lastPublishedAt: string | null;
    };
    assert.equal(
      reloaded.hasUnpublishedChanges,
      true,
      "item edit must remain dirty in a fresh server response",
    );
    const priorPublish = reloaded.lastPublishedAt;
    await new Promise((resolve) => setTimeout(resolve, 5));

    const publishResponse = await jreq(
      base,
      "PATCH",
      `/admin/tenants/${tenantId}`,
      ownerCookie,
      { isPublished: true, publishNow: true },
    );
    assert.equal(publishResponse.status, 200);
    const published = (await publishResponse.json()) as {
      hasUnpublishedChanges: boolean;
      lastPublishedAt: string | null;
    };
    assert.equal(published.hasUnpublishedChanges, false);
    assert.ok(published.lastPublishedAt);
    assert.notEqual(published.lastPublishedAt, priorPublish);

    const cleanReloadResponse = await jreq(
      base,
      "GET",
      `/admin/tenants/${tenantId}`,
      ownerCookie,
    );
    assert.equal(cleanReloadResponse.status, 200);
    const cleanReload = (await cleanReloadResponse.json()) as {
      hasUnpublishedChanges: boolean;
    };
    assert.equal(
      cleanReload.hasUnpublishedChanges,
      false,
      "cycle one publish must remain clean in a fresh response",
    );

    const deleteTextResponse = await jreq(
      base,
      "PATCH",
      `/admin/items/${created.id}`,
      ownerCookie,
      { body: null },
    );
    assert.equal(deleteTextResponse.status, 200);

    const afterTextDeletionResponse = await jreq(
      base,
      "GET",
      `/admin/tenants/${tenantId}`,
      ownerCookie,
    );
    assert.equal(afterTextDeletionResponse.status, 200);
    const afterTextDeletion = (await afterTextDeletionResponse.json()) as {
      hasUnpublishedChanges: boolean;
    };
    assert.equal(
      afterTextDeletion.hasUnpublishedChanges,
      true,
      "cycle two text deletion must remain dirty in a fresh response",
    );

    const addPhotoResponse = await jreq(
      base,
      "POST",
      `/admin/items/${created.id}/media`,
      ownerCookie,
      {
        url: `https://example.com/cp2b-photo-${stamp}.jpg`,
        kind: "image",
        alt: "Testna fotografija",
      },
    );
    assert.equal(addPhotoResponse.status, 201);
    const addedPhoto = (await addPhotoResponse.json()) as { id: string };

    const afterPhotoAddResponse = await jreq(
      base,
      "GET",
      `/admin/tenants/${tenantId}`,
      ownerCookie,
    );
    assert.equal(afterPhotoAddResponse.status, 200);
    const afterPhotoAdd = (await afterPhotoAddResponse.json()) as {
      hasUnpublishedChanges: boolean;
    };
    assert.equal(
      afterPhotoAdd.hasUnpublishedChanges,
      true,
      "cycle two photo addition must remain dirty in a fresh response",
    );

    const removePhotoResponse = await jreq(
      base,
      "DELETE",
      `/admin/media/${addedPhoto.id}`,
      ownerCookie,
    );
    assert.equal(removePhotoResponse.status, 204);

    const afterPhotoRemoveResponse = await jreq(
      base,
      "GET",
      `/admin/tenants/${tenantId}`,
      ownerCookie,
    );
    assert.equal(afterPhotoRemoveResponse.status, 200);
    const afterPhotoRemove = (await afterPhotoRemoveResponse.json()) as {
      hasUnpublishedChanges: boolean;
    };
    assert.equal(
      afterPhotoRemove.hasUnpublishedChanges,
      true,
      "cycle two photo removal must remain dirty in a fresh response",
    );

    const secondPublishResponse = await jreq(
      base,
      "PATCH",
      `/admin/tenants/${tenantId}`,
      ownerCookie,
      { isPublished: true, publishNow: true },
    );
    assert.equal(secondPublishResponse.status, 200);
    const secondPublish = (await secondPublishResponse.json()) as {
      hasUnpublishedChanges: boolean;
      lastPublishedAt: string | null;
    };
    assert.equal(secondPublish.hasUnpublishedChanges, false);
    assert.ok(secondPublish.lastPublishedAt);
    assert.notEqual(secondPublish.lastPublishedAt, published.lastPublishedAt);

    const secondCleanReloadResponse = await jreq(
      base,
      "GET",
      `/admin/tenants/${tenantId}`,
      ownerCookie,
    );
    assert.equal(secondCleanReloadResponse.status, 200);
    const secondCleanReload = (await secondCleanReloadResponse.json()) as {
      hasUnpublishedChanges: boolean;
    };
    assert.equal(
      secondCleanReload.hasUnpublishedChanges,
      false,
      "cycle two publish must remain clean in a fresh response",
    );

    const whatsappResponse = await jreq(
      base,
      "PATCH",
      `/admin/tenants/${tenantId}`,
      ownerCookie,
      {
        notificationChannel: "whatsapp",
        notificationWhatsappPhone: "+38640123456",
        orderNotifyEmail: false,
      },
    );
    assert.equal(whatsappResponse.status, 200);
    const whatsappSaved = (await whatsappResponse.json()) as {
      hasUnpublishedChanges: boolean;
    };
    assert.equal(
      whatsappSaved.hasUnpublishedChanges,
      true,
      "a saved WhatsApp notification number must mark the tenant dirty",
    );

    const afterWhatsappResponse = await jreq(
      base,
      "GET",
      `/admin/tenants/${tenantId}`,
      ownerCookie,
    );
    const afterWhatsapp = (await afterWhatsappResponse.json()) as {
      hasUnpublishedChanges: boolean;
    };
    assert.equal(
      afterWhatsapp.hasUnpublishedChanges,
      true,
      "the WhatsApp settings dirty state must survive a fresh GET",
    );

    const publishWhatsappResponse = await jreq(
      base,
      "PATCH",
      `/admin/tenants/${tenantId}`,
      ownerCookie,
      { isPublished: true, publishNow: true },
    );
    assert.equal(publishWhatsappResponse.status, 200);
    const publishWhatsapp = (await publishWhatsappResponse.json()) as {
      hasUnpublishedChanges: boolean;
    };
    assert.equal(publishWhatsapp.hasUnpublishedChanges, false);

    const cleanAfterWhatsappResponse = await jreq(
      base,
      "GET",
      `/admin/tenants/${tenantId}`,
      ownerCookie,
    );
    const cleanAfterWhatsapp = (await cleanAfterWhatsappResponse.json()) as {
      hasUnpublishedChanges: boolean;
    };
    assert.equal(
      cleanAfterWhatsapp.hasUnpublishedChanges,
      false,
      "publishing WhatsApp settings must remain clean in a fresh GET",
    );

    const wifiResponse = await jreq(
      base,
      "PATCH",
      `/admin/tenants/${tenantId}`,
      ownerCookie,
      {
        wifiSsid: "Smart360 test",
        wifiPass: "test-wifi-password",
        messageNotifyEmail: false,
        mediaQuotaBytes: 2_500_000_000,
      },
    );
    assert.equal(wifiResponse.status, 200);
    const wifiSaved = (await wifiResponse.json()) as {
      hasUnpublishedChanges: boolean;
    };
    assert.equal(
      wifiSaved.hasUnpublishedChanges,
      true,
      "a saved WiFi password and internal tenant settings must mark dirty",
    );

    const afterWifiResponse = await jreq(
      base,
      "GET",
      `/admin/tenants/${tenantId}`,
      ownerCookie,
    );
    const afterWifi = (await afterWifiResponse.json()) as {
      hasUnpublishedChanges: boolean;
    };
    assert.equal(
      afterWifi.hasUnpublishedChanges,
      true,
      "the WiFi settings dirty state must survive a fresh GET",
    );

    const publishWifiResponse = await jreq(
      base,
      "PATCH",
      `/admin/tenants/${tenantId}`,
      ownerCookie,
      { isPublished: true, publishNow: true },
    );
    assert.equal(publishWifiResponse.status, 200);
    const publishWifi = (await publishWifiResponse.json()) as {
      hasUnpublishedChanges: boolean;
    };
    assert.equal(publishWifi.hasUnpublishedChanges, false);

    const cleanAfterWifiResponse = await jreq(
      base,
      "GET",
      `/admin/tenants/${tenantId}`,
      ownerCookie,
    );
    const cleanAfterWifi = (await cleanAfterWifiResponse.json()) as {
      hasUnpublishedChanges: boolean;
    };
    assert.equal(
      cleanAfterWifi.hasUnpublishedChanges,
      false,
      "publishing WiFi settings must remain clean in a fresh GET",
    );
  });

  // ---------- Overview ----------
  await t.test("GET /admin/tenants/overview reports readiness and pending work", async () => {
    const res = await jreq(base, "GET", "/admin/tenants/overview", ownerCookie);
    assert.equal(res.status, 200);
    const rows = (await res.json()) as Array<{
      tenantId: string;
      readinessPct: number;
      checks: Array<{ key: string; label: string; done: boolean }>;
      pendingOrders: number; pendingMessages: number; pendingLocations: number; missingPhotos: number;
    }>;
    const mine = rows.find((r) => r.tenantId === tenantId);
    assert.ok(mine, "overview must include the new tenant");
    assert.equal(mine!.checks.length, 8, "readiness is the 8 agreed checks");
    assert.ok(mine!.readinessPct >= 0 && mine!.readinessPct <= 100);
    const published = mine!.checks.find((c) => c.key === "published");
    assert.equal(published?.done, true, "published check reflects the publish above");
    const basics = mine!.checks.find((c) => c.key === "basics");
    assert.equal(basics?.done, true, "name+subtitle exist");
    assert.equal(mine!.pendingOrders, 0);
    assert.equal(mine!.pendingMessages, 0);
    assert.equal(mine!.pendingLocations, 0);
    assert.ok(mine!.missingPhotos > 0, "freshly seeded categories have no photos yet");
  });

  // ---------- Per-tenant changelog attribution ----------
  await t.test("GET /admin/tenants/:id/changelog attributes owner work", async () => {
    const res = await jreq(base, "GET", `/admin/tenants/${tenantId}/changelog`, ownerCookie);
    assert.equal(res.status, 200);
    const rows = (await res.json()) as Array<{ action: string; actorLabel: string; summary: string; requestIp: string | null; actorEmail?: unknown; createdAt: string }>;
    assert.ok(rows.length >= 3, "create + patches must be logged");
    assert.ok(rows.every((r) => r.actorLabel === "Smart360"), "owner work has the safe Smart360 label");
    assert.ok(rows.every((r) => typeof r.summary === "string" && r.summary.length > 0));
    assert.ok(rows.every((r) => r.requestIp === null && r.actorEmail === undefined), "operator IP and private fields never leave the API");
    assert.ok(rows.some((r) => r.action === "publish"), "the first publish is logged as publish");
    for (let i = 1; i < rows.length; i++) {
      assert.ok(rows[i - 1]!.createdAt >= rows[i]!.createdAt, "newest first");
    }
  });

  await t.test("tenant changelog returns the complete history beyond fifty rows", async () => {
    await db.insert(changelogTable).values(
      Array.from({ length: 51 }, (_, n) => ({
        tenantId,
        action: "update",
        entity: "tenant",
        summary: `Testna sprememba ${n}`,
      })),
    );
    const res = await jreq(base, "GET", `/admin/tenants/${tenantId}/changelog`, ownerCookie);
    assert.equal(res.status, 200);
    const rows = (await res.json()) as Array<{ summary: string }>;
    assert.ok(rows.length > 50, "history must not truncate at fifty entries");
  });

  await t.test("operator entry is explicit and idempotent", async () => {
    const key = `cockpit-${stamp}`;
    const before = await db.select({ id: changelogTable.id }).from(changelogTable)
      .where(eq(changelogTable.tenantId, tenantId));
    for (let i = 0; i < 2; i++) {
      const entry = await jreq(base, "POST", `/admin/tenants/${tenantId}/operator-entry`, ownerCookie, undefined, {
        "Idempotency-Key": key,
      });
      assert.equal(entry.status, 204);
    }
    const after = await db.select({ action: changelogTable.action }).from(changelogTable)
      .where(eq(changelogTable.tenantId, tenantId));
    assert.equal(after.filter((r) => r.action === "cockpit-entry").length, 1);
    assert.equal(after.length, before.length + 1);
  });

  await t.test("tenant copy refuses before creating an incomplete multilingual tenant", async () => {
    const copySlug = `${slug}-copy-disabled`;
    const res = await jreq(
      base,
      "POST",
      `/admin/tenants/${tenantId}/duplicate`,
      ownerCookie,
      {
        slug: copySlug,
        name: `Blocked copy ${stamp}`,
        copyContent: true,
      },
    );
    assert.equal(res.status, 409);
    assert.deepEqual(await res.json(), {
      code: "TENANT_COPY_DISABLED",
      error:
        "Tenant copy is disabled until translations can be copied with the tenant.",
    });

    const copied = await db
      .select({ id: tenantsTable.id })
      .from(tenantsTable)
      .where(eq(tenantsTable.slug, copySlug));
    assert.equal(copied.length, 0, "refused copy must not create a tenant");
  });

  // ---------- Concurrency: double publish races the CAS ----------
  await t.test("two parallel first publishes: one stamp, one log entry, one e-mail", async () => {
    const [race] = await db
      .insert(tenantsTable)
      .values({
        slug: `${slug}-race`,
        name: `CP2b race ${stamp}`,
        email: `cp2b-race-${stamp}@example.com`,
      })
      .returning({ id: tenantsTable.id });
    const raceId = race!.id;
    t.after(async () => {
      await db.delete(changelogTable).where(eq(changelogTable.tenantId, raceId));
      await db.delete(tenantsTable).where(eq(tenantsTable.id, raceId));
    });

    const mailsBefore = sentMails.length;
    const [r1, r2] = await Promise.all([
      jreq(base, "PATCH", `/admin/tenants/${raceId}`, ownerCookie, { isPublished: true }),
      jreq(base, "PATCH", `/admin/tenants/${raceId}`, ownerCookie, { isPublished: true }),
    ]);
    assert.equal(r1.status, 200);
    assert.equal(r2.status, 200);

    const [row] = await db
      .select({ firstPublishedAt: tenantsTable.firstPublishedAt })
      .from(tenantsTable)
      .where(eq(tenantsTable.id, raceId));
    assert.ok(row!.firstPublishedAt, "the stamp must exist");

    const publishRows = await db
      .select({ action: changelogTable.action })
      .from(changelogTable)
      .where(eq(changelogTable.tenantId, raceId));
    assert.equal(
      publishRows.filter((r) => r.action === "publish").length, 1,
      "exactly one of the two concurrent requests wins the first publish",
    );
    assert.equal(sentMails.length, mailsBefore + 1, "exactly one published e-mail");
  });

  // ---------- Host access stays tenant-scoped ----------
  await t.test("host can read own history but not owner cockpit controls", async () => {
    const [host] = await db
      .insert(hostUsersTable)
      .values({ email: hostEmail, passwordHash: await hashPassword(hostPassword) })
      .returning({ id: hostUsersTable.id });
    hostUserId = host!.id;
    await db.insert(hostMembershipsTable).values({ hostUserId, tenantId });

    const login = await jreq(base, "POST", "/admin/host/login", null, {
      email: hostEmail, password: hostPassword,
    });
    assert.equal(login.status, 200);
    const m = /__Host-s360_host=([^;]+)/.exec(login.headers.get("set-cookie") ?? "");
    assert.ok(m);
    const hostCookie = `__Host-s360_host=${m![1]}`;

    const history = await jreq(base, "GET", `/admin/tenants/${tenantId}/changelog`, hostCookie);
    assert.equal(history.status, 200);
    assert.ok(Array.isArray(await history.json()));

    for (const [method, path, body] of [
      ["GET", "/admin/tenants/overview", undefined],
      ["POST", `/admin/tenants/${tenantId}/operator-entry`, undefined],
      ["POST", "/admin/tenants", { slug: `${slug}-host`, name: "Host poskus", type: "kamp" }],
    ] as const) {
      const res = await jreq(base, method, path, hostCookie, body);
      assert.equal(res.status, 404, `${method} ${path} must be 404 for a host, got ${res.status}`);
      assert.deepEqual(await res.json(), { error: "Not found" }, "no detail leak");
    }
  });
});
