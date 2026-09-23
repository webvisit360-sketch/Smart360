import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { afterEach, describe, test } from "node:test";

import {
  _setConciergeWelcomeDeliveryOverride,
  CONCIERGE_WELCOME_REPLY_TO,
  renderConciergeWelcomeEmail,
  sendConciergeWelcomeEmail,
  type ConciergeWelcomeEmailBody,
} from "../lib/conciergeWelcomeEmail";
import { buildWelcomeEmailBody } from "../lib/lifecycleEmails";

const EXACT_COPY =
  "Vaš digitalni vodnik v celoti pripravljamo in urejamo mi — vam ni treba storiti ničesar. Vse spremembe, dopolnitve ali fotografije nam kadar koli pošljite na info@webvisit360.com in jih vnesemo za vas.";
const FIXTURE = {
  recipient: "host@example.com",
  tenantName: "Apartmaji Gril",
  guideUrl: "https://gril.example.invalid/",
};

afterEach(() => {
  _setConciergeWelcomeDeliveryOverride(null);
});

describe("concierge welcome email", () => {
  test("uses the normal invitation's CGP renderer with exact concierge copy", () => {
    const body = renderConciergeWelcomeEmail(FIXTURE);
    for (const content of [body.html, body.text]) {
      assert.ok(content.includes(EXACT_COPY));
      assert.ok(content.includes("Oglejte si svoj vodnik"));
      assert.ok(content.includes(FIXTURE.guideUrl));
      assert.doesNotMatch(content, /Nastavite geslo/i);
      assert.doesNotMatch(content, /račun|account/i);
      assert.doesNotMatch(content, /povabil|invitation/i);
      assert.doesNotMatch(content, /portal\/|token=/i);
    }
    assert.ok(body.html.includes("background:#157347;color:#FFFFFF"));
    assert.ok(body.html.includes("background:#F4F6F2"));
    assert.ok(body.html.includes("height:3px;line-height:3px;font-size:0;background:#DD9A2B"));
    assert.ok(body.html.includes("https://smart360.info/brand/smart360-znak-40.png"));
  });

  test("escapes tenant content", () => {
    const body = renderConciergeWelcomeEmail({
      ...FIXTURE,
      tenantName: '<img src=x onerror="alert(1)">',
    });
    assert.ok(body.html.includes("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;"));
    assert.ok(!body.html.includes('<img src=x onerror="alert(1)">'));
  });

  test("sender passes the same rendered body to shared delivery without real I/O", async () => {
    process.env["ORDER_EMAIL_FROM"] = "info@webvisit360.com";
    let captured: ConciergeWelcomeEmailBody | null = null;
    let capturedKey: string | undefined;
    _setConciergeWelcomeDeliveryOverride(async (body, options) => {
      captured = body;
      capturedKey = options?.idempotencyKey;
      return { ok: true, providerMessageId: "test-only-id" };
    });

    const result = await sendConciergeWelcomeEmail(FIXTURE, "concierge-welcome-fixture");
    assert.deepEqual(result, { ok: true, providerMessageId: "test-only-id" });
    assert.deepEqual(captured, {
      from: "Smart360 <info@webvisit360.com>",
      reply_to: CONCIERGE_WELCOME_REPLY_TO,
      to: [FIXTURE.recipient],
      ...renderConciergeWelcomeEmail(FIXTURE),
    });
    assert.equal(
      (captured as ConciergeWelcomeEmailBody | null)?.reply_to,
      "info@webvisit360.com",
    );
    assert.equal(capturedKey, "concierge-welcome-fixture");
  });

  test("sender rejects a missing recipient before transport", async () => {
    let called = false;
    _setConciergeWelcomeDeliveryOverride(async () => {
      called = true;
      return { ok: true, providerMessageId: null };
    });
    await assert.rejects(
      sendConciergeWelcomeEmail({ ...FIXTURE, recipient: "" }),
      /recipient is required/,
    );
    assert.equal(called, false);
  });

  test("checked-in previews are exact outputs of the two production renderers", () => {
    const disabledUrl = "https://preview.invalid/disabled-example-not-a-real-link";
    const selfService = buildWelcomeEmailBody({
      to: "preview-recipient@example.invalid",
      propertyName: "Apartmaji Gril",
      setPasswordUrl: disabledUrl,
    }, "Smart360 <info@webvisit360.com>");
    const concierge = renderConciergeWelcomeEmail({
      tenantName: "Apartmaji Gril",
      guideUrl: disabledUrl,
    });
    const selfServicePreview = readFileSync(
      new URL("../../../../previews/management-mode/self-service.html", import.meta.url),
      "utf8",
    ).trimEnd();
    const conciergePreview = readFileSync(
      new URL("../../../../previews/management-mode/concierge.html", import.meta.url),
      "utf8",
    ).trimEnd();

    assert.equal(selfServicePreview, selfService.html);
    assert.equal(conciergePreview, concierge.html);
    assert.ok(selfServicePreview.includes(disabledUrl));
    assert.ok(conciergePreview.includes(disabledUrl));
    assert.doesNotMatch(selfServicePreview + conciergePreview, /token=|example\.com\/portal/i);
  });
});