import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { UpdateTenantBody } from "@workspace/api-zod";
import { dispatchNotification } from "../lib/notificationDispatcher";
import {
  isValidE164,
  isWhatsappConfigured,
  normalizeWhatsappPhonePatch,
  sendWhatsappTemplate,
} from "../lib/whatsapp";

const configuredEnv = {
  META_WHATSAPP_ACCESS_TOKEN: "token",
  META_WHATSAPP_PHONE_NUMBER_ID: "123",
  META_WHATSAPP_ORDER_TEMPLATE_NAME: "novo_narocilo",
  META_WHATSAPP_ORDER_TEMPLATE_LANGUAGE: "sl",
  META_WHATSAPP_MESSAGE_TEMPLATE_NAME: "novo_sporocilo_gosta",
  META_WHATSAPP_MESSAGE_TEMPLATE_LANGUAGE: "en",
};

describe("notification channel configuration", () => {
  test("generated API schema and server enum permit exactly one known channel", () => {
    assert.equal(UpdateTenantBody.safeParse({ notificationChannel: "email" }).success, true);
    assert.equal(UpdateTenantBody.safeParse({ notificationChannel: "whatsapp" }).success, true);
    assert.equal(UpdateTenantBody.safeParse({ notificationChannel: "sms" }).success, false);
    assert.equal(UpdateTenantBody.safeParse({ notificationChannel: ["email", "whatsapp"] }).success, false);
    assert.equal(UpdateTenantBody.safeParse({ notificationChannel: null }).success, false);
  });

  test("blank phone means omission and international E.164 validation is strict", () => {
    assert.equal(normalizeWhatsappPhonePatch("   "), undefined);
    assert.equal(normalizeWhatsappPhonePatch("+386 40 123 456"), "+386 40 123 456");
    assert.equal(isValidE164("+38640123456"), true);
    assert.equal(isValidE164("+386 40 123 456"), false);
    assert.equal(isValidE164("040123456"), false);
  });

  test("all four exact Meta keys are required", () => {
    assert.equal(isWhatsappConfigured(configuredEnv), true);
    assert.equal(
      isWhatsappConfigured({ ...configuredEnv, META_WHATSAPP_MESSAGE_TEMPLATE_NAME: "" }),
      false,
    );
  });

  test("unconfigured WhatsApp is rejected without touching the network", async () => {
    let fetched = false;
    const result = await sendWhatsappTemplate(
      {
        kind: "order",
        notificationId: "order-1",
        to: "+38640123456",
        guestName: "Ana",
        guestUnit: "A1",
        item: "Zajtrk",
        quantity: 1,
        time: "10:00",
      },
      {
        env: {},
        fetchImpl: async () => {
          fetched = true;
          throw new Error("network must not be called");
        },
      },
    );
    assert.equal(result.ok, false);
    assert.equal(fetched, false);
    if (!result.ok) assert.equal(result.providerError, "Meta WhatsApp ni konfiguriran.");
  });
});

describe("shared notification dispatcher", () => {
  const base = {
    tenantId: "00000000-0000-4000-8000-000000000001",
    kind: "order" as const,
    notificationId: "00000000-0000-4000-8000-000000000002",
    emailRecipient: "host@example.com",
    whatsappRecipient: "+38640123456",
    whatsappPayload: {
      guestName: "Ana",
      guestUnit: "A1",
      item: "Zajtrk",
      quantity: 2,
      time: "2026-01-01T10:00:00.000Z",
    },
  };

  test("current email-selected delivery flows through dispatcher and persists", async () => {
    const rows: Array<Record<string, unknown>> = [];
    const result = await dispatchNotification(
      {
        ...base,
        channel: "email",
        sendEmail: async () => ({ ok: true, providerMessageId: "email-1" }),
      },
      { persistAttempt: async (row) => void rows.push(row) },
    );
    assert.equal(result.ok, true);
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.["channel"], "email");
    assert.equal(rows[0]?.["outcome"], "sent");
  });

  test("exact WhatsApp provider error is persisted and copied to fallback event", async () => {
    const exact = '{"error":{"message":"template rejected: ž"}}';
    const rows: Array<Record<string, unknown>> = [];
    const result = await dispatchNotification(
      {
        ...base,
        channel: "whatsapp",
        sendEmail: async () => ({ ok: true, providerMessageId: "fallback-email" }),
      },
      {
        sendWhatsapp: async () => ({ ok: false, providerError: exact, providerResponse: exact }),
        persistAttempt: async (row) => void rows.push(row),
      },
    );
    assert.equal(result.ok, true);
    assert.equal(result.usedFallback, true);
    assert.equal(rows.length, 2);
    assert.equal(rows[0]?.["providerError"], exact);
    assert.equal(rows[1]?.["fallbackFrom"], "whatsapp");
    assert.equal(rows[1]?.["fallbackTriggerError"], exact);
  });

  test("Meta adapter preserves a rejected response verbatim with injected fetch", async () => {
    const exact = '{"error":{"message":"invalid parameter"}}\n';
    const result = await sendWhatsappTemplate(
      {
        kind: "message",
        notificationId: "message-1",
        to: "+38640123456",
        guestName: "Ana",
        guestUnit: "A1",
        preview: "Kratek predogled",
      },
      {
        env: configuredEnv,
        fetchImpl: async () => new Response(exact, { status: 400 }),
      },
    );
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.providerError, exact);
  });

  test("Meta adapter sends the configured name and language for each notification type", async () => {
    const sentTemplates: Array<{ name: string; language: string }> = [];
    const fetchImpl = async (_input: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as {
        template: { name: string; language: { code: string } };
      };
      sentTemplates.push({
        name: body.template.name,
        language: body.template.language.code,
      });
      return new Response('{"messages":[{"id":"wamid.mock"}]}', { status: 200 });
    };

    const common = {
      to: "+38640811395",
      guestName: "Ana",
      guestUnit: "A1",
    };
    const orderResult = await sendWhatsappTemplate(
      {
        ...common,
        kind: "order",
        notificationId: "order-template-pair",
        item: "Zajtrk",
        quantity: 2,
        time: "10:00",
      },
      { env: configuredEnv, fetchImpl },
    );
    const messageResult = await sendWhatsappTemplate(
      {
        ...common,
        kind: "message",
        notificationId: "message-template-pair",
        preview: "Kratek predogled",
      },
      { env: configuredEnv, fetchImpl },
    );

    assert.equal(orderResult.ok, true);
    assert.equal(messageResult.ok, true);
    assert.deepEqual(sentTemplates, [
      { name: "novo_narocilo", language: "sl" },
      { name: "novo_sporocilo_gosta", language: "en" },
    ]);
  });

  test("ledger failure prevents dispatcher from claiming durable success", async () => {
    const result = await dispatchNotification(
      {
        ...base,
        channel: "email",
        sendEmail: async () => ({ ok: true }),
      },
      { persistAttempt: async () => { throw new Error("ledger unavailable"); } },
    );
    assert.equal(result.ok, false);
    assert.equal(result.evidencePersisted, false);
  });
});