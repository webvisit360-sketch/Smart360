/**
 * Approved e-mail template contract (attached emaili-gostitelju file).
 *
 * Pins for ALL SIX templates:
 *  - subject and inbox-preview lines exactly as approved,
 *  - the shared design system (green bar, brand kicker, CTA, footer),
 *  - the global rules: inline styles only, no web fonts, no external images,
 *    no tracking pixels, no auto-login links, plain-text alternative.
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";

import { buildEmailBody, type OrderEmailPayload } from "../lib/orderEmail";
import { buildMessageEmailBody } from "../lib/messageEmail";
import { buildResetEmailBody, resetLink, HOST_RESET_FROM_NAME } from "../lib/hostResetEmail";
import {
  buildWelcomeEmailBody,
  buildGuideReadyEmailBody,
  buildPublishedEmailBody,
} from "../lib/lifecycleEmails";

process.env["ORDER_EMAIL_FROM"] = "info@webvisit360.com";

const FROM = "Smart360 <info@webvisit360.com>";

const ORDER: OrderEmailPayload = {
  to: "gostitelj@example.com",
  tenantName: "Apartmaji Meli Pu",
  orderRef: "ref-1",
  itemTitle: "SUP — dnevni najem",
  qty: 2,
  price: "25 €",
  priceUnit: "dan",
  guestName: "Ana Novak",
  guestPhone: "+386 41 998 660",
  guestUnit: "Apartma 3",
  guestNote: "Prevzeli bi okoli 10h, če je mogoče.",
};

function allSix() {
  return [
    [
      "welcome",
      buildWelcomeEmailBody(
        { to: "g@example.com", hostName: "Melita", propertyName: "Apartmaji Meli Pu" },
        FROM,
      ),
    ],
    ["order", buildEmailBody(ORDER, "info@webvisit360.com")],
    [
      "message",
      buildMessageEmailBody(
        {
          to: "g@example.com",
          tenantName: "Apartmaji Meli Pu",
          guestUnit: "Apartma 3",
          messageId: "m-1",
          threadRef: "t-1",
        },
        "info@webvisit360.com",
      ),
    ],
    [
      "guide-ready",
      buildGuideReadyEmailBody(
        {
          to: "g@example.com",
          hostName: "Melita",
          propertyName: "Apartmaji Meli Pu",
          slug: "meli-pu",
          setPasswordUrl: "https://example.com/portal/ponastavitev?token=abc",
        },
        FROM,
      ),
    ],
    [
      "reset",
      buildResetEmailBody(
        "melita.pu@gmail.com",
        resetLink("tok"),
        `${HOST_RESET_FROM_NAME} <info@webvisit360.com>`,
      ),
    ],
    [
      "published",
      buildPublishedEmailBody(
        { to: "g@example.com", tenantName: "Apartmaji Meli Pu", slug: "meli-pu" },
        FROM,
      ),
    ],
  ] as const;
}

describe("approved subjects and preview lines (emaili-gostitelju)", () => {
  test("order: subject + preview match the file", () => {
    const b = buildEmailBody(ORDER, "info@webvisit360.com");
    assert.equal(b["subject"], "Novo naročilo · Apartma 3 · SUP — dnevni najem");
    assert.ok((b["html"] as string).includes("Ana Novak, 2 × · odprite portal za potrditev"));
  });

  test("message: subject + preview match the file", () => {
    const b = allSix()[2][1] as Record<string, unknown>;
    assert.equal(b["subject"], "Novo sporočilo · Apartma 3");
    assert.ok((b["html"] as string).includes("Odprite portal za odgovor"));
  });

  test("guide ready: subject + preview match the file", () => {
    const b = allSix()[3][1] as Record<string, unknown>;
    assert.equal(b["subject"], "Vaš digitalni vodnik je pripravljen");
    assert.ok((b["html"] as string).includes("Nastavite geslo in preglejte, kar smo pripravili"));
    assert.ok((b["html"] as string).includes("Povezava velja 24 ur"));
  });

  test("reset: subject + preview match the file", () => {
    const b = allSix()[4][1] as Record<string, unknown>;
    assert.equal(b["subject"], "Ponastavitev gesla za Smart360");
    assert.ok((b["html"] as string).includes("Povezava velja 60 minut"));
    assert.ok((b["html"] as string).includes("melita.pu@gmail.com"));
  });

  test("published: subject + preview match the file", () => {
    const b = allSix()[5][1] as Record<string, unknown>;
    assert.equal(b["subject"], "Vaš vodnik je objavljen");
    assert.ok((b["html"] as string).includes("QR kode za apartmaje so pripravljene za tisk"));
  });

  test("welcome: collects materials and does NOT teach the creator", () => {
    const b = allSix()[0][1] as Record<string, unknown>;
    const html = b["html"] as string;
    assert.equal(b["subject"], "Dobrodošli — začenjamo z vašim vodnikom");
    assert.ok(html.includes("Fotografije"), "asks for photos");
    assert.ok(html.includes("sestavimo mi"), "states the guide is built by us");
    assert.ok(!html.includes("Kreator"), "must not teach the creator");
    assert.ok(!/geslo/i.test(html), "no password talk at purchase time");
  });
});

describe("global rules hold for every template", () => {
  for (const [name, body] of allSix()) {
    const html = (body as Record<string, unknown>)["html"] as string;
    const text = (body as Record<string, unknown>)["text"] as string;

    test(`${name}: design system present`, () => {
      assert.ok(html.includes("#157347"), "green accent bar/CTA");
      assert.match(html, /letter-spacing:\.14em/, "brand kicker style");
      assert.match(html, /font-size:24px;font-weight:800/, "24px title");
    });

    test(`${name}: no external images, no web fonts, no tracking, no <style> block`, () => {
      assert.ok(!html.includes("<img"), "no images at all — nothing external to load");
      assert.ok(!/url\(|@font-face|fonts\.googleapis/.test(html), "no web fonts");
      assert.ok(!html.includes("<style"), "inline styles only");
      assert.ok(!/href="https?:\/\/[^"]*(utm_|track|pixel)/i.test(html), "no tracking params");
    });

    test(`${name}: no auto-login links`, () => {
      // Tokens may appear ONLY in set/reset-password links pointing at the
      // dedicated reset page — never a link that logs the user in.
      const tokenLinks = [...html.matchAll(/href="([^"]*token[^"]*)"/gi)].map((m) => m[1]);
      for (const l of tokenLinks) {
        assert.ok(l!.includes("/portal/ponastavitev"), `token link must be the set-password page, got ${l}`);
      }
    });

    test(`${name}: plain-text alternative reads on its own`, () => {
      assert.ok(typeof text === "string" && text.length > 40, "text version exists");
      assert.ok(!text.includes("<") && !text.includes("style="), "no HTML in text");
    });
  }
});
