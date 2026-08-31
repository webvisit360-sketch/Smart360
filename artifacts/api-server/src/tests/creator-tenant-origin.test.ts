import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import crypto from "node:crypto";
import { count, eq, inArray } from "drizzle-orm";
import {
  adminSessionsTable,
  changelogTable,
  db,
  tenantsTable,
} from "@workspace/db";
import app from "../app";

const GRIL_MAP_URL =
  "https://www.google.com/maps/place/Piknik+prostor+in+kamp+Gril/@46.3499833,14.8470013,1311m/data=!3m1!1e3!4m14!1m7!3m6!1s0x47655bac1c180a51:0xec9821cb7ac81b4b!2sGlamping+Gril!8m2!3d46.35001!4d14.850273!16s%2Fg%2F11vyqnsc6n!3m5!1s0x47655bc349c591dd:0xd66c5a12dbe4dc27!8m2!3d46.3536005!4d14.8509723!16s%2Fg%2F11s57htx7l";
const MENINA_MAP_URL =
  "https://www.google.com/maps/place/Camping+MENINA/@46.3114597,14.9067248,794m/data=!3m2!1e3!4b1!4m9!3m8!1s0x476544b2dceb3c9d:0xfed2eb6fc9373f3d!5m2!4m1!1i2!8m2!3d46.311456!4d14.9093051!16s%2Fg%2F11b76h070l";

const sha256 = (value: string) =>
  crypto.createHash("sha256").update(value).digest("hex");

async function jreq(
  base: string,
  method: string,
  path: string,
  cookie: string,
  body?: unknown,
): Promise<Response> {
  return fetch(`${base}/api${path}`, {
    method,
    headers: { "content-type": "application/json", cookie },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

test("Creator confirms origin onto the cockpit tenant and never inserts by name", async (t) => {
  const server = app.listen(0);
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const base = `http://127.0.0.1:${address.port}`;

  const stamp = Date.now().toString(36);
  const sharedName = `Creator same-name ${stamp}`;
  const inserted = await db
    .insert(tenantsTable)
    .values([
      { slug: `creator-target-${stamp}`, name: sharedName },
      { slug: `creator-other-${stamp}`, name: sharedName },
    ])
    .returning({ id: tenantsTable.id });
  const targetId = inserted[0]!.id;
  const otherId = inserted[1]!.id;

  const ownerToken = crypto.randomBytes(32).toString("base64url");
  const [session] = await db
    .insert(adminSessionsTable)
    .values({
      tokenHash: sha256(ownerToken),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    })
    .returning({ id: adminSessionsTable.id });
  const ownerCookie = `__Host-s360_admin=${ownerToken}`;

  const nativeFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const url = typeof input === "string"
      ? input
      : input instanceof URL
        ? input.href
        : input.url;
    if (url.startsWith("https://nominatim.openstreetmap.org/reverse")) {
      return new Response(
        JSON.stringify({ display_name: "Ljubno ob Savinji, Savinjska, Slovenija" }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }
    return nativeFetch(input, init);
  };

  t.after(async () => {
    globalThis.fetch = nativeFetch;
    await db.delete(changelogTable).where(inArray(changelogTable.tenantId, [targetId, otherId]));
    await db.delete(adminSessionsTable).where(eq(adminSessionsTable.id, session!.id));
    await db.delete(tenantsTable).where(inArray(tenantsTable.id, [targetId, otherId]));
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  const [{ value: beforeCount }] = await db.select({ value: count() }).from(tenantsTable);

  const confirmed = await jreq(
    base,
    "POST",
    `/admin/tenants/${targetId}/creator/origin`,
    ownerCookie,
    {
      mapUrl: GRIL_MAP_URL,
      address: "Ter 35, 3333 Ljubno ob Savinji",
      municipality: "Ljubno ob Savinji",
    },
  );
  assert.equal(confirmed.status, 200);
  const confirmedBody = await confirmed.json() as Record<string, unknown>;
  assert.equal(confirmedBody.id, targetId);
  assert.equal(confirmedBody.replacedExistingOrigin, false);

  const retiredRun = await jreq(
    base,
    "POST",
    `/admin/tenants/${targetId}/creator/runs`,
    ownerCookie,
  );
  assert.equal(retiredRun.status, 410);
  assert.equal(
    (await retiredRun.json() as { code: string }).code,
    "creator-c1-retired",
  );

  const [{ value: afterCount }] = await db.select({ value: count() }).from(tenantsTable);
  assert.equal(afterCount, beforeCount, "Creator confirmation must not insert a tenant");

  const [target] = await db
    .select()
    .from(tenantsTable)
    .where(eq(tenantsTable.id, targetId));
  assert.equal(target!.latitude, 46.3536005);
  assert.equal(target!.longitude, 14.8509723);
  assert.equal(target!.creatorDraft, true);
  assert.equal(target!.address, "Ter 35, 3333 Ljubno ob Savinji");
  assert.equal(target!.creatorOriginRegion, "Ljubno ob Savinji, Savinjska, Slovenija");
  assert.equal(target!.municipality, "Ljubno ob Savinji");
  assert.equal(target!.mapUrl, null, "Creator must not persist extra origin fields");

  const [sameNamedOther] = await db
    .select()
    .from(tenantsTable)
    .where(eq(tenantsTable.id, otherId));
  assert.equal(sameNamedOther!.latitude, null, "same-name tenant must stay untouched");
  assert.equal(sameNamedOther!.creatorDraft, false);

  const blocked = await jreq(
    base,
    "POST",
    `/admin/tenants/${targetId}/creator/origin`,
    ownerCookie,
    {
      mapUrl: MENINA_MAP_URL,
      address: "Varpolje 105",
      municipality: "Rečica ob Savinji",
    },
  );
  assert.equal(blocked.status, 409, "stored origin must require explicit replacement");

  const [stillGril] = await db
    .select()
    .from(tenantsTable)
    .where(eq(tenantsTable.id, targetId));
  assert.equal(stillGril!.latitude, 46.3536005);
  assert.equal(stillGril!.longitude, 14.8509723);

  const replaced = await jreq(
    base,
    "POST",
    `/admin/tenants/${targetId}/creator/origin`,
    ownerCookie,
    {
      mapUrl: MENINA_MAP_URL,
      address: "Varpolje 105",
      municipality: "Rečica ob Savinji",
      replaceExistingOrigin: true,
    },
  );
  assert.equal(replaced.status, 200);
  assert.equal((await replaced.json() as { replacedExistingOrigin: boolean }).replacedExistingOrigin, true);

  const logs = await db
    .select({
      action: changelogTable.action,
      actorType: changelogTable.actorType,
      createdAt: changelogTable.createdAt,
    })
    .from(changelogTable)
    .where(eq(changelogTable.tenantId, targetId));
  assert.ok(logs.some((row) => row.action === "confirm-origin" && row.actorType === "owner"));
  assert.ok(logs.some((row) => row.action === "replace-origin" && row.actorType === "owner"));
  assert.ok(logs.every((row) => row.createdAt instanceof Date));

  const legacyInsert = await jreq(
    base,
    "POST",
    "/admin/creator/draft-tenants",
    ownerCookie,
    {
      mapUrl: GRIL_MAP_URL,
      name: sharedName,
      address: "Ter 35",
      tenantType: "kamp",
    },
  );
  assert.equal(legacyInsert.status, 404, "the insertion route must no longer exist");
});