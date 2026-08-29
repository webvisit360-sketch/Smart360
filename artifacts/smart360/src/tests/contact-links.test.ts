import assert from "node:assert/strict";
import test from "node:test";

import { instagramLink, viberHref } from "../lib/contact-links";

test("Instagram accepts a handle or Instagram URL and emits a safe profile URL", () => {
  assert.deepEqual(instagramLink("@app_meli.pu"), {
    href: "https://www.instagram.com/app_meli.pu/",
    label: "@app_meli.pu",
  });
  assert.deepEqual(instagramLink("https://instagram.com/app_meli.pu/"), {
    href: "https://www.instagram.com/app_meli.pu/",
    label: "@app_meli.pu",
  });
});

test("Instagram rejects non-Instagram URLs and malformed handles", () => {
  assert.equal(instagramLink("https://example.com/app_meli.pu"), null);
  assert.equal(instagramLink("not a handle"), null);
});

test("Viber uses a normalized international phone number", () => {
  assert.equal(
    viberHref("+386 41 998 660"),
    "viber://chat?number=%2B38641998660",
  );
});