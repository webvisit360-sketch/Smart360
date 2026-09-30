import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const route = readFileSync(new URL("../routes/adminContent.ts", import.meta.url), "utf8");

test("offer section creation is tenant-key serialized and conflicts before insertion/logging", () => {
  const create = route.slice(route.indexOf('router.post("/admin/tenants/:id/sections"'), route.indexOf('router.patch("/admin/sections/:id"'));
  assert.match(create, /parsed\.data\.key === "offer"\s*\?\s*await db\.transaction/);
  assert.match(create, /pg_advisory_xact_lock\(hashtext\('section:offer'\), hashtext\(\$\{tenantId\}\)\)/);
  assert.match(create, /eq\(sectionsTable\.tenantId, tenantId\), eq\(sectionsTable\.key, "offer"\), isNull\(sectionsTable\.deletedAt\)/);
  assert.ok(create.indexOf("pg_advisory_xact_lock") < create.indexOf("if (activeOffer)"));
  assert.ok(create.indexOf("if (activeOffer)") < create.indexOf("tx.insert(sectionsTable)"));
  assert.ok(create.indexOf("res.status(409)") < create.indexOf("await logChange"));
  assert.match(create, /if \(result\.existing\) \{\s*res\.status\(409\)/);
});