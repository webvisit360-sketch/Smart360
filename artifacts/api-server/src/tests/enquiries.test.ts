import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import type { Server } from "node:http";
import app from "../app";
import { _setEnquiryDeliveryOverride } from "../lib/enquiryEmail";
import { db, enquiriesTable } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";

let server: Server;
let base = "";
const delivered: Array<Record<string, unknown>> = [];

before(async () => {
  _setEnquiryDeliveryOverride(async (body) => {
    delivered.push(body);
    return { status: "accepted", providerMessageId: "test-provider-id" };
  });
  await new Promise<void>((resolve) => {
    server = app.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") throw new Error("Missing test port");
      base = `http://127.0.0.1:${address.port}`;
      resolve();
    });
  });
});

after(async () => {
  _setEnquiryDeliveryOverride(null);
  await db.delete(enquiriesTable).where(inArray(enquiriesTable.email, [
    "ana@example.com",
    "limited@example.com",
    "failed@example.com",
  ]));
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});

const valid = {
  name: "Ana Novak",
  email: "ana@example.com",
  propertyName: "Apartmaji Test",
  address: "Testna 1, Izola",
  propertyType: "Apartma",
  message: "Prosim za informacije.",
  website: "",
};

test("public enquiry validates, addresses the owner, and uses enquiry reply-to", async () => {
  const response = await fetch(`${base}/api/public/enquiries`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Forwarded-For": "198.51.100.11" },
    body: JSON.stringify(valid),
  });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { sent: true });
  assert.equal(delivered.length, 1);
  assert.deepEqual(delivered[0]?.to, ["smart360hq@gmail.com"]);
  assert.equal(delivered[0]?.reply_to, "ana@example.com");
  const [stored] = await db.select().from(enquiriesTable).where(eq(enquiriesTable.email, "ana@example.com"));
  assert.equal(stored?.deliveryStatus, "accepted");
  assert.equal(stored?.providerMessageId, "test-provider-id");
  assert.equal(stored?.name, "Ana Novak");
  assert.ok(stored?.deleteAfter);
});

test("honeypot returns success without delivering", async () => {
  const beforeCount = delivered.length;
  const response = await fetch(`${base}/api/public/enquiries`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Forwarded-For": "198.51.100.12" },
    body: JSON.stringify({ ...valid, email: "bot@example.com", website: "https://spam.example" }),
  });
  assert.equal(response.status, 200);
  assert.equal(delivered.length, beforeCount);
});

test("rate limits repeated public enquiries per e-mail", async () => {
  for (let index = 0; index < 3; index++) {
    const response = await fetch(`${base}/api/public/enquiries`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Forwarded-For": `198.51.100.${20 + index}` },
      body: JSON.stringify({ ...valid, email: "limited@example.com" }),
    });
    assert.equal(response.status, 200);
  }
  const limited = await fetch(`${base}/api/public/enquiries`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Forwarded-For": "198.51.100.30" },
    body: JSON.stringify({ ...valid, email: "limited@example.com" }),
  });
  assert.equal(limited.status, 429);
});

test("a failed notification remains a successfully captured enquiry", async () => {
  _setEnquiryDeliveryOverride(async () => ({ status: "failed", providerMessageId: null }));
  const response = await fetch(`${base}/api/public/enquiries`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Forwarded-For": "198.51.100.41" },
    body: JSON.stringify({ ...valid, email: "failed@example.com" }),
  });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { sent: true });
  const [stored] = await db.select().from(enquiriesTable).where(eq(enquiriesTable.email, "failed@example.com"));
  assert.equal(stored?.deliveryStatus, "failed");
  assert.equal(stored?.providerMessageId, null);
});