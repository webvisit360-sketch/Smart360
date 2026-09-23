import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import express from "express";
import type { AddressInfo } from "node:net";
import { eq } from "drizzle-orm";
import {
  categoriesTable,
  db,
  translationsTable,
  sectionsTable,
  tenantsTable,
} from "@workspace/db";
import adminContentRouter from "../routes/adminContent";
import adminTenantsRouter from "../routes/adminTenants";
import publicTenantsRouter from "../routes/publicTenants";
import {
  ensurePublishedSnapshotSchema,
  ensureTenantPublication,
  previewPublication,
  readPublishedContent,
} from "../lib/publishedSnapshots";
import { actorStorage } from "../lib/actorContext";
import { logger } from "../lib/logger";

test("emergency contact route keeps draft isolated until publication", async () => {
  await ensurePublishedSnapshotSchema();
  const [tenant] = await db.insert(tenantsTable).values({
    slug: `emergency-help-${randomUUID()}`,
    name: "Emergency help disposable fixture",
    isPublished: true,
    languages: ["sl", "en"],
  }).returning();
  assert.ok(tenant);
  const [staySection] = await db.insert(sectionsTable).values({
    tenantId: tenant.id,
    key: "stay",
    title: "Bivanje",
    isVisible: true,
  }).returning();
  await ensureTenantPublication(tenant.id);

  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.actor = req.get("x-fixture-actor") === "host"
      ? { kind: "host", hostUserId: randomUUID(), tenantId: tenant.id }
      : { kind: "owner" };
    req.log = logger.child({ fixture: "emergency-help-publication" });
    actorStorage.run(req.actor, next);
  });
  app.use("/api", adminContentRouter);
  app.use("/api", adminTenantsRouter);
  app.use("/api", publicTenantsRouter);
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/admin/tenants/${tenant.id}/emergency-contacts`;

  try {
    const denied = await fetch(base, { headers: { "x-fixture-actor": "host" } });
    assert.equal(denied.status, 403, "host must not reach operator-curated emergency rows");

    const concurrent = await Promise.all(["A", "B"].map((suffix) => fetch(base, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rows: [{ title: `Kontakt ${suffix}`, phone: `+386 40 100 10${suffix === "A" ? "1" : "2"}` }] }),
    })));
    assert.deepEqual(concurrent.map((response) => response.status), [200, 200]);
    const emergencyCategories = await db.select().from(categoriesTable)
      .where(eq(categoriesTable.key, "operator-emergency-help"));
    assert.equal(
      emergencyCategories.filter((row) => row.sectionId === staySection!.id).length,
      1,
      "serialized lazy creation must create one reserved category",
    );
    await fetch(base, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rows: [] }),
    });

    const saveResponse = await fetch(base, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rows: [{ title: "Dežurni zdravnik", phone: "+386 1 234 56 78" }],
      }),
    });
    assert.equal(saveResponse.status, 200);
    const saved = await saveResponse.json() as {
      categoryId: string;
      rows: Array<{ id: string; title: string; phone: string }>;
    };
    assert.equal(saved.rows.length, 1);
    assert.equal(saved.rows[0]!.title, "Dežurni zdravnik");

    const [category] = await db.select().from(categoriesTable)
      .where(eq(categoriesTable.id, saved.categoryId));
    assert.equal(category?.key, "operator-emergency-help");
    assert.equal(category?.layout, "help");

    await db.insert(translationsTable).values({
      model: "item",
      recordId: saved.rows[0]!.id,
      field: "title",
      lang: "en",
      value: "Doctor on call",
      stale: false,
    });
    const renameResponse = await fetch(base, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rows: [{ id: saved.rows[0]!.id, title: "Dežurni zdravnik 24h", phone: "+386 1 234 56 79" }],
      }),
    });
    assert.equal(renameResponse.status, 200);
    const [translation] = await db.select().from(translationsTable)
      .where(eq(translationsTable.recordId, saved.rows[0]!.id));
    assert.equal(translation?.stale, true, "title changes mark existing item title translations stale");

    const stillPublished = await readPublishedContent(tenant.id);
    assert.equal(
      stillPublished.languages.sl!.tree.sections
        .flatMap((section) => section.categories)
        .some((entry) => entry.key === "operator-emergency-help"),
      false,
      "a draft route save must not mutate the guest snapshot",
    );
    const preview = await previewPublication(tenant.id);
    assert.ok(preview.added.includes("Dežurni zdravnik 24h"));

    const publishResponse = await fetch(
      `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/admin/tenants/${tenant.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          isPublished: true,
          publishNow: true,
          publishToken: preview.token,
        }),
      },
    );
    assert.equal(publishResponse.status, 200, await publishResponse.text());
    const publicResponse = await fetch(
      `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/public/tenants/${tenant.slug}?lang=sl`,
    );
    assert.equal(publicResponse.status, 200);
    const published = await publicResponse.json() as {
      sections: Array<{ categories: Array<{ key: string | null; items: Array<{ phone: string | null }> }> }>;
    };
    const publishedCategory = published.sections
      .flatMap((section) => section.categories)
      .find((entry) => entry.key === "operator-emergency-help");
    assert.equal(publishedCategory?.items[0]?.phone, "+386 1 234 56 79");
    assert.ok(!JSON.stringify(publishedCategory).includes('"112"'));
    assert.ok(!JSON.stringify(publishedCategory).includes('"113"'));

    const removeResponse = await fetch(base, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rows: [] }),
    });
    assert.equal(removeResponse.status, 200);
    const publishedAfterDraftRemoval = await readPublishedContent(tenant.id);
    assert.equal(
      publishedAfterDraftRemoval.languages.sl!.tree.sections
        .flatMap((section) => section.categories)
        .find((entry) => entry.key === "operator-emergency-help")
        ?.items.length,
      1,
      "removal also remains draft-only before confirmation",
    );
    const removalPreview = await previewPublication(tenant.id);
    assert.ok(removalPreview.removed.includes("Dežurni zdravnik 24h"));
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => error ? reject(error) : resolve()));
    await db.delete(tenantsTable).where(eq(tenantsTable.id, tenant.id));
  }
});