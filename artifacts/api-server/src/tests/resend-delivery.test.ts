import assert from "node:assert/strict";
import { afterEach, describe, test } from "node:test";
import { deliverResend } from "../lib/resendDelivery";

const originalFetch = globalThis.fetch;
const originalKey = process.env["RESEND_API_KEY"];

afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalKey === undefined) delete process.env["RESEND_API_KEY"];
  else process.env["RESEND_API_KEY"] = originalKey;
});

describe("direct Resend transport", () => {
  test("missing key fails without making a network request", async () => {
    delete process.env["RESEND_API_KEY"];
    let calls = 0;
    globalThis.fetch = async () => {
      calls++;
      throw new Error("must not run");
    };

    const result = await deliverResend({ to: ["host@example.com"] });
    assert.deepEqual(result, {
      ok: false,
      error: {
        code: "missing_api_key",
        message: "Poštni ključ ni nastavljen",
        httpStatus: null,
        stage: "configuration",
      },
    });
    assert.equal(calls, 0);
  });

  test("a whitespace-only key is missing", async () => {
    process.env["RESEND_API_KEY"] = "   ";
    let calls = 0;
    globalThis.fetch = async () => {
      calls++;
      throw new Error("must not run");
    };
    const result = await deliverResend({});
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.error.code, "missing_api_key");
    assert.equal(result.error.message, "Poštni ključ ni nastavljen");
    assert.equal(calls, 0);
  });

  test("uses direct URL, bearer auth, JSON and idempotency and returns the provider id", async () => {
    process.env["RESEND_API_KEY"] = "test-key";
    let request: { input: string | URL | Request; init?: RequestInit } | undefined;
    globalThis.fetch = async (input, init) => {
      request = { input, init };
      return new Response(JSON.stringify({ id: "email_123" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    };

    const result = await deliverResend(
      { from: "Smart360 <info@webvisit360.com>", to: ["host@example.com"] },
      { idempotencyKey: "order-123" },
    );
    assert.deepEqual(result, { ok: true, providerMessageId: "email_123" });
    assert.equal(request?.input, "https://api.resend.com/emails");
    assert.equal(request?.init?.method, "POST");
    assert.deepEqual(request?.init?.headers, {
      Authorization: "Bearer test-key",
      "Content-Type": "application/json",
      "Idempotency-Key": "order-123",
    });
    assert.equal(
      request?.init?.body,
      JSON.stringify({ from: "Smart360 <info@webvisit360.com>", to: ["host@example.com"] }),
    );
  });

  for (const [status, code] of [
    [401, "provider_unauthorized"],
    [403, "provider_forbidden"],
    [429, "provider_rate_limited"],
  ] as const) {
    test(`sanitizes ${status} provider failures`, async () => {
      process.env["RESEND_API_KEY"] = "test-key";
      globalThis.fetch = async () =>
        new Response(
          JSON.stringify({
            name: "secret_unapproved_name",
            message: "token=https://private.example/invite?token=raw-contact-content",
          }),
          { status, headers: { "Content-Type": "application/json" } },
        );

      const result = await deliverResend({ html: "private-contact-content" });
      assert.equal(result.ok, false);
      if (result.ok) return;
      assert.equal(result.error.code, code);
      assert.equal(result.error.httpStatus, status);
      assert.equal(result.error.stage, "provider");
      assert.doesNotMatch(JSON.stringify(result), /raw-contact|private|test-key|secret_unapproved/);
    });
  }

  test("allowlists a provider validation name but never its message", async () => {
    process.env["RESEND_API_KEY"] = "test-key";
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({ name: "validation_error", message: "recipient and token are secret" }),
        { status: 422, headers: { "Content-Type": "application/json" } },
      );
    const result = await deliverResend({});
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.error.code, "validation_error");
    assert.equal(result.error.message, "Ponudnik je zavrnil podatke sporočila");
    assert.doesNotMatch(JSON.stringify(result), /recipient|token|secret/);
  });

  test("fails accepted responses that omit an id, including malformed JSON", async () => {
    process.env["RESEND_API_KEY"] = "test-key";
    globalThis.fetch = async () => new Response("<raw secret response>", { status: 200 });
    const result = await deliverResend({});
    assert.deepEqual(result, {
      ok: false,
      error: {
        code: "missing_message_id",
        message: "Ponudnik ni vrnil identifikatorja sporočila",
        httpStatus: 200,
        stage: "provider",
      },
    });
    assert.doesNotMatch(JSON.stringify(result), /raw secret/);
  });

  test("redacts network errors and does not retry", async () => {
    process.env["RESEND_API_KEY"] = "test-key";
    let calls = 0;
    globalThis.fetch = async () => {
      calls++;
      throw new Error("Bearer test-key https://private.example/token=secret");
    };
    const result = await deliverResend({});
    assert.equal(calls, 1);
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.error.code, "transport_error");
    assert.doesNotMatch(JSON.stringify(result), /test-key|private|secret/);
  });

  test("aborts at the bounded timeout without retrying", async () => {
    process.env["RESEND_API_KEY"] = "test-key";
    let calls = 0;
    globalThis.fetch = async (_input, init) => {
      calls++;
      return await new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () =>
          reject(new DOMException("private timeout detail", "AbortError")),
        );
      });
    };
    const result = await deliverResend({}, { timeoutMs: 5 });
    assert.equal(calls, 1);
    assert.deepEqual(result, {
      ok: false,
      error: {
        code: "transport_timeout",
        message: "Pošiljanje pošte je poteklo",
        httpStatus: null,
        stage: "transport",
      },
    });
  });
});