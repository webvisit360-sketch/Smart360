import assert from "node:assert/strict";
import test from "node:test";
import { randomBytes } from "node:crypto";
import { Webhook } from "svix";
import {
  parseResendEmailEvent,
  shouldApplyProviderEvent,
  verifyResendPayload,
} from "../lib/resendWebhook";

const secret = `whsec_${randomBytes(32).toString("base64")}`;
const webhook = new Webhook(secret);
const raw = Buffer.from(JSON.stringify({
  type: "email.delivered",
  created_at: "2026-01-02T03:04:05.000Z",
  data: { email_id: "email_123" },
}));
const timestamp = new Date();
const headers = {
  "svix-id": "msg_123",
  "svix-timestamp": Math.floor(timestamp.getTime() / 1000).toString(),
  "svix-signature": webhook.sign("msg_123", timestamp, raw),
};

test("verifies a valid untouched Resend Svix payload", () => {
  const event = parseResendEmailEvent(verifyResendPayload(raw, headers, secret));
  assert.equal(event?.name, "email.delivered");
  assert.equal(event?.messageId, "email_123");
});

test("rejects invalid or unsigned Resend payloads", () => {
  assert.throws(() => verifyResendPayload(raw, { ...headers, "svix-signature": "v1,bad" }, secret));
  assert.throws(() => verifyResendPayload(raw, {
    "svix-id": headers["svix-id"],
    "svix-timestamp": headers["svix-timestamp"],
    "svix-signature": "",
  }, secret));
});

test("provider state transitions are duplicate and out-of-order safe", () => {
  const delivered = parseResendEmailEvent(JSON.parse(raw.toString()));
  const bounced = parseResendEmailEvent({
    type: "email.bounced", created_at: "2026-01-01T00:00:00.000Z", data: { email_id: "email_123" },
  });
  assert.ok(delivered && bounced);
  assert.equal(shouldApplyProviderEvent("delivered", delivered.occurredAt, delivered), false);
  assert.equal(shouldApplyProviderEvent("bounced", new Date("2026-01-03T00:00:00.000Z"), delivered), false);
  assert.equal(shouldApplyProviderEvent("delivered", delivered.occurredAt, bounced), true);
});

test("a complaint supersedes a delivered email", () => {
  const complaint = parseResendEmailEvent({
    type: "email.complained", created_at: "2026-01-01T00:00:00.000Z", data: { email_id: "email_123" },
  });
  assert.ok(complaint);
  assert.equal(shouldApplyProviderEvent("delivered", new Date("2026-02-01T00:00:00.000Z"), complaint), true);
});