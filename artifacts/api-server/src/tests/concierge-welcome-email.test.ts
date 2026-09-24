import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { afterEach, describe, test } from "node:test";
import sharp from "sharp";

import {
  _setConciergeWelcomeDeliveryOverride,
  CONCIERGE_WELCOME_REPLY_TO,
  renderConciergeWelcomeEmail,
  sendConciergeWelcomeEmail,
  type ConciergeWelcomeEmailBody,
} from "../lib/conciergeWelcomeEmail";
import { buildWelcomeEmailBody } from "../lib/lifecycleEmails";
import { renderReadyNotice } from "../lib/guideReadyNotice";

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
  test("all four lifecycle variants share one exact 198x46 header without an accent bar", async () => {
    const url = "https://smart360.info/glamping-gril";
    const htmls = [
      buildWelcomeEmailBody({
        to: "preview@example.invalid", propertyName: "Apartmaji Gril",
        setPasswordUrl: "https://preview.invalid/disabled-example",
      }, "Smart360 <info@webvisit360.com>").html,
      renderConciergeWelcomeEmail({ tenantName: "Apartmaji Gril", guideUrl: url }).html,
      (await renderReadyNotice({ tenantName: "Apartmaji Gril", slug: "glamping-gril", guideUrl: url, mode: "self_service" })).html,
      (await renderReadyNotice({ tenantName: "Apartmaji Gril", slug: "glamping-gril", guideUrl: url, mode: "concierge" })).html,
    ];
    const img = /<img src="https:\/\/smart360\.info\/brand\/smart360-email-lockup-host-594x138\.png" width="198" height="46" alt="Smart360" style="width:198px;height:46px;[^"]*">/;
    const headers = htmls.map(html => {
      assert.doesNotMatch(html, /#DD9A2B|height:5px;line-height:5px;font-size:0;background:|<tr><td><div style="height:3px/);
      assert.doesNotMatch(html, />SMART360<\/|>Smart360<\/div>/);
      return html.match(img)?.[0];
    });
    assert.ok(headers[0], "canonical header is present");
    assert.deepEqual(headers, Array(4).fill(headers[0]));
  });
  test("one canonical lockup meets the largest 3x display, opaque white field and dark ink", async () => {
    const file = new URL("../../../smart360/public/brand/smart360-email-lockup-host-594x138.png", import.meta.url);
    const { data, info } = await sharp(readFileSync(file)).raw().toBuffer({ resolveWithObject: true });
    assert.equal(info.width, 198 * 3);
    assert.equal(info.height, 46 * 3);
    assert.equal(info.channels, 3);
    assert.deepEqual([...data.subarray(0, 3)], [255, 255, 255]);
    assert.deepEqual([...data.subarray((info.width * info.height - 1) * 3)], [255, 255, 255]);
    let darkWordmarkPixels = 0;
    for (let y = 0; y < info.height; y++) {
      for (let x = 174; x < info.width; x++) {
        const i = (y * info.width + x) * 3;
        if (data[i] === 18 && data[i + 1] === 26 && data[i + 2] === 20) darkWordmarkPixels++;
      }
    }
    assert.ok(darkWordmarkPixels > 1000, "raster wordmark has solid #121A14 ink");
  });
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
    assert.ok(body.html.includes("max-width:560px;background:#FFFFFF"));
    assert.doesNotMatch(body.html, /#DD9A2B|height:3px;line-height:3px;font-size:0;background:/);
    assert.ok(body.html.includes('src="https://smart360.info/brand/smart360-email-lockup-host-594x138.png" width="198" height="46" alt="Smart360" style="width:198px;height:46px;'));
    assert.doesNotMatch(body.html, />SMART360<\/|>Smart360<\/div>/);
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