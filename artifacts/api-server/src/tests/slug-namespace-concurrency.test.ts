/**
 * Published slug races are real transactions, not just availability checks.
 * All rows belong to this development-only fixture and are removed afterwards.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import QRCode from "qrcode";
import { eq } from "drizzle-orm";
import {
  db,
  adminSessionsTable,
  changelogTable,
  tenantAliasesTable,
  tenantSlugReservationsTable,
  tenantsTable,
} from "@workspace/db";
import app from "../app";
import { guestUrl, guestQrSvg } from "../lib/guestUrl";
import { renderReadyNotice, makeReadySticker } from "../lib/guideReadyNotice";

test("two published tenants cannot claim one draft slug concurrently; winner owns all new URLs", async (t) => {
  const server = app.listen(0);
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const base = `http://127.0.0.1:${address.port}/api`;
  const suffix = crypto.randomBytes(5).toString("hex");
  const oldSlugs = [`race-a-${suffix}`, `race-b-${suffix}`];
  const target = `race-new-${suffix}`;
  const tenantIds: string[] = [];
  const ownerToken = crypto.randomBytes(32).toString("base64url");
  const tokenHash = crypto.createHash("sha256").update(ownerToken).digest("hex");
  const [session] = await db.insert(adminSessionsTable)
    .values({ tokenHash, expiresAt: new Date(Date.now() + 60 * 60 * 1000) })
    .returning({ id: adminSessionsTable.id });
  const cookie = `__Host-s360_admin=${ownerToken}`;
  t.after(async () => {
    for (const tenantId of tenantIds) {
      await db.delete(changelogTable).where(eq(changelogTable.tenantId, tenantId));
      await db.delete(tenantsTable).where(eq(tenantsTable.id, tenantId));
      await db.delete(tenantAliasesTable).where(eq(tenantAliasesTable.tenantId, tenantId));
      await db.delete(tenantSlugReservationsTable).where(eq(tenantSlugReservationsTable.tenantId, tenantId));
    }
    await db.delete(adminSessionsTable).where(eq(adminSessionsTable.id, session!.id));
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  const call = async (method: string, route: string, body?: unknown) =>
    fetch(`${base}${route}`, {
      method,
      headers: { cookie, "content-type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      redirect: "manual",
    });
  const preview = async (id: string): Promise<string> => {
    const response = await call("GET", `/admin/tenants/${id}/publish-preview`);
    assert.equal(response.status, 200);
    return (await response.json() as { token: string }).token;
  };
  for (const [index, slug] of oldSlugs.entries()) {
    const created = await call("POST", "/admin/tenants", {
      slug, name: `Concurrent slug fixture ${suffix}-${index}`, type: "apartmaji",
    });
    assert.equal(created.status, 201);
    const tenantId = (await created.json() as { id: string }).id;
    tenantIds.push(tenantId);
    const published = await call("PATCH", `/admin/tenants/${tenantId}`, {
      isPublished: true, publishNow: true, publishToken: await preview(tenantId),
    });
    assert.equal(published.status, 200);
  }

  for (const id of tenantIds) {
    const draft = await call("PATCH", `/admin/tenants/${id}`, { slug: target });
    assert.equal(draft.status, 200, "both unreserved drafts may propose the same slug");
  }
  const tokens = await Promise.all(tenantIds.map(preview));
  const responses = await Promise.all(tenantIds.map((id, index) =>
    call("PATCH", `/admin/tenants/${id}`, {
      isPublished: true, publishNow: true, publishToken: tokens[index],
    })));
  assert.deepEqual(responses.map(({ status }) => status).sort(), [200, 409],
    "exactly one contender may publish");
  const loserIndex = responses.findIndex(({ status }) => status === 409);
  const winnerIndex = 1 - loserIndex;
  assert.match((await responses[loserIndex]!.json() as { error: string }).error,
    /Naslov je že zaseden ali trajno rezerviran/);

  const [reservation] = await db.select().from(tenantSlugReservationsTable)
    .where(eq(tenantSlugReservationsTable.slug, target));
  assert.equal(reservation!.tenantId, tenantIds[winnerIndex]);
  const [winner] = await db.select().from(tenantsTable)
    .where(eq(tenantsTable.id, tenantIds[winnerIndex]!));
  const [loser] = await db.select().from(tenantsTable)
    .where(eq(tenantsTable.id, tenantIds[loserIndex]!));
  assert.equal(winner!.slug, target);
  assert.equal(winner!.draftSlug, null);
  assert.equal(loser!.slug, oldSlugs[loserIndex], "failed transaction leaves live URL unchanged");
  assert.equal(loser!.draftSlug, target, "failed transaction retains its reviewed draft");
  const winnerAliases = await db.select().from(tenantAliasesTable)
    .where(eq(tenantAliasesTable.tenantId, winner!.id));
  const loserAliases = await db.select().from(tenantAliasesTable)
    .where(eq(tenantAliasesTable.tenantId, loser!.id));
  assert.deepEqual(winnerAliases.map(({ slug }) => slug), [oldSlugs[winnerIndex]]);
  assert.equal(loserAliases.length, 0, "failed transaction writes no partial alias");

  const oldGuide = await fetch(`${base}/public/tenants/${oldSlugs[winnerIndex]}`, { redirect: "manual" });
  assert.equal(oldGuide.status, 301);
  assert.equal(oldGuide.headers.get("location"), `/api/public/tenants/${target}`);
  const ownHistory = await call("PATCH", `/admin/tenants/${winner!.id}`, { slug: oldSlugs[winnerIndex] });
  assert.equal(ownHistory.status, 409, "even the original owner cannot reclaim history");
  const takenCurrent = await call("PATCH", `/admin/tenants/${loser!.id}`, { slug: target });
  assert.equal(takenCurrent.status, 409, "the other tenant cannot take the winner's current URL");

  // These renderers consume the canonical URL in both supported lifecycle
  // variants; inspect the actual QR input and PDF text, not just a filename.
  const currentUrl = guestUrl(winner!.slug);
  const formerUrl = guestUrl(oldSlugs[winnerIndex]!);
  const details = await call("GET", `/admin/tenants/${winner!.id}`);
  assert.equal(details.status, 200);
  const detailsBody = await details.json() as { publicUrl: string; qrSvg: string };
  assert.equal(detailsBody.publicUrl, currentUrl);
  assert.equal(detailsBody.qrSvg, await guestQrSvg(currentUrl));
  const expectedEmailQr = await QRCode.toDataURL(currentUrl, {
    errorCorrectionLevel: "H", margin: 4, width: 640,
    color: { dark: "#000000", light: "#FFFFFF" },
  });
  for (const mode of ["self_service", "concierge"] as const) {
    const rendered = await renderReadyNotice({
      tenantName: winner!.name, slug: winner!.slug, guideUrl: currentUrl, mode,
    });
    assert.ok(rendered.html.includes(currentUrl));
    assert.ok(rendered.text.includes(currentUrl));
    assert.ok(rendered.html.includes(expectedEmailQr), `${mode} email QR encodes current URL`);
    assert.ok(!rendered.html.includes(formerUrl));
  }
  const qrResponse = await call("GET", `/admin/tenants/${winner!.id}/qr.png`);
  assert.equal(qrResponse.status, 200);
  const expectedPng = await QRCode.toBuffer(currentUrl, {
    type: "png", width: 1024, margin: 2, errorCorrectionLevel: "M",
  });
  assert.deepEqual(Buffer.from(await qrResponse.arrayBuffer()), expectedPng,
    "the downloaded QR pixels encode the current URL");
  const label = await call("GET", `/admin/tenants/${winner!.id}/label.pdf`);
  assert.equal(label.status, 200);
  const readyPdf = await makeReadySticker({
    tenantName: winner!.name, slug: winner!.slug,
    guideUrl: currentUrl, mode: "concierge",
  });
  const tempDir = mkdtempSync(path.join(os.tmpdir(), "slug-pdf-"));
  try {
    for (const [file, buffer] of [
      ["admin.pdf", Buffer.from(await label.arrayBuffer())],
      ["ready.pdf", readyPdf],
    ] as const) {
      const pdfPath = path.join(tempDir, file);
      writeFileSync(pdfPath, buffer);
      const printed = execFileSync("pdftotext", [pdfPath, "-"], { encoding: "utf8" });
      // The older admin label intentionally omits the printed https://,
      // while both QR encoders still receive the full absolute HTTPS URL.
      // pdftotext can lose the hyphen glyph in the legacy Helvetica label.
      const printedUrl = file === "admin.pdf" ? currentUrl.replace(/^https:\/\//, "") : currentUrl;
      const oldPrintedUrl = file === "admin.pdf" ? formerUrl.replace(/^https:\/\//, "") : formerUrl;
      const normalize = (value: string) => value.replace(/[\s-]/g, "");
      assert.ok(normalize(printed).includes(normalize(printedUrl)), `${file} prints the canonical URL`);
      assert.ok(!normalize(printed).includes(normalize(oldPrintedUrl)), `${file} does not print the old URL`);
    }
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});