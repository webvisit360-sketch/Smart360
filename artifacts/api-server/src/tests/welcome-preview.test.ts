import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { db, pool, tenantsTable } from "@workspace/db";
import { getWelcomePreview, WELCOME_PREVIEW_TOKEN } from "../lib/welcomePreview";
import { buildWelcomeEmailBody } from "../lib/lifecycleEmails";
import { rpOrigin } from "../lib/adminAuth";
import { ADMIN_ROUTE_REGISTRY } from "../lib/actorGate";

test("welcome preview: same template, tenant-specific, read-only and operator-only", async () => {
  try {
    const fingerprint = async () => (await pool.query(`
      SELECT md5(coalesce(json_agg(row_to_json(i) ORDER BY i.id)::text, '[]')) AS fingerprint
      FROM (
        SELECT id, host_user_id, expires_at, used_at, invalidated_at,
               delivery_status, provider_message_id, delivery_attempted_at
        FROM host_invites
      ) i
    `)).rows[0].fingerprint;
    const before = await fingerprint();
    const tenants = await db.select({ id: tenantsTable.id, name: tenantsTable.name }).from(tenantsTable);
    assert.ok(tenants.length > 0);
    for (const tenant of tenants) {
      const preview = await getWelcomePreview(tenant.id);
      assert.ok(preview);
      assert.equal(preview.propertyName, tenant.name);
      const expected = buildWelcomeEmailBody({
        to: preview.recipient ?? "",
        propertyName: tenant.name,
        setPasswordUrl: `${rpOrigin()}/portal/povabilo?token=${WELCOME_PREVIEW_TOKEN}`,
      }, "");
      assert.equal(preview.html, expected.html);
      assert.equal(preview.text, expected.text);
      assert.equal(preview.subject, expected.subject);
      for (const content of [preview.html, preview.text]) {
        assert.ok(content.includes("Po nastavitvi gesla vas počaka kratek obrazec — vpišete podatke o svoji nastanitvi in priporočila za okolico, vse ostalo uredimo mi."));
        assert.ok(!content.includes("Od vas potrebujemo samo gradivo"));
        assert.ok(!content.includes("Gradivo lahko pošljete kar kot odgovor"));
        assert.ok(content.includes("Ko bo vodnik pripravljen, prejmete še povabilo za pregled."));
      }
      assert.ok(!preview.html.includes("/admin/login"));
      assert.deepEqual(await getWelcomePreview(tenant.id), preview);
    }
    assert.equal(await getWelcomePreview("00000000-0000-0000-0000-000000000000"), null);
    assert.equal(await fingerprint(), before, "no invite creation, invalidation, use or delivery mutation");
    assert.ok(WELCOME_PREVIEW_TOKEN.length < 20, "sample token is rejected before token lookup");
    const route = ADMIN_ROUTE_REGISTRY.find(r => r.path === "/admin/tenants/:id/host/welcome-preview");
    assert.equal(route?.method, "get");
    assert.equal(route?.binding.kind, "owner-only");
    const source = readFileSync(new URL("../lib/welcomePreview.ts", import.meta.url), "utf8");
    assert.doesNotMatch(source, /sendWelcomeEmail|issueHostInviteForTenant|\.insert\(|\.update\(|\.delete\(|\.transaction\(/);
  } finally {
    await pool.end();
  }
});